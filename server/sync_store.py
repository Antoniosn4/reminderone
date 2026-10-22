"""Armazenamento da sincronização (protocolo v1, docs/SYNC_PROTOCOL.md).

Guarda os envelopes que os apps enviam, numa ordem global (``seq``). O servidor
é "cego": o conteúdo de cada registro chega cifrado pelos apps e é devolvido
como veio. Ele só decide qual versão de cada registro fica — a mais recente
pelo ``updatedAt`` do app.
"""

from __future__ import annotations

import sqlite3
import uuid
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path
from threading import Lock

ENTITIES = frozenset({
    "project",
    "task",
    "kanban_board",
    "kanban_column",
    "kanban_card",
    "note",
    "routine",
    "profile",
})

_SCHEMA = """
CREATE TABLE IF NOT EXISTS records (
    entity     TEXT    NOT NULL,
    id         TEXT    NOT NULL,
    seq        INTEGER NOT NULL UNIQUE,
    updated_at TEXT    NOT NULL,
    deleted    INTEGER NOT NULL DEFAULT 0,
    payload    TEXT    NOT NULL,
    device_id  TEXT,
    PRIMARY KEY (entity, id)
);
CREATE INDEX IF NOT EXISTS idx_records_seq ON records(seq);
CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
"""


class AlreadyPairedError(Exception):
    """O servidor já está pareado com outra chave e o pedido não autorizou reset."""


@dataclass(frozen=True)
class Envelope:
    entity: str
    id: str
    updated_at: str
    deleted: bool
    payload: str
    seq: int | None = None

    def to_wire(self) -> dict:
        return {
            "entity": self.entity,
            "id": self.id,
            "updatedAt": self.updated_at,
            "deleted": self.deleted,
            "payload": self.payload,
            "seq": self.seq,
        }


@dataclass(frozen=True)
class PushResult:
    accepted: list[tuple[str, str]]
    rejected: list[Envelope]
    cursor: int


@dataclass(frozen=True)
class PullResult:
    store_id: str
    changes: list[Envelope]
    cursor: int
    has_more: bool


class SyncStore:
    """SQLite com uma conexão por operação, serializadas por um lock.

    O FastAPI roda rotas síncronas em threads: o lock garante que duas
    pushes não reservem o mesmo ``seq``.
    """

    def __init__(self, path: Path):
        self._path = Path(path)
        self._lock = Lock()
        self._path.parent.mkdir(parents=True, exist_ok=True)
        with self._connect() as db:
            db.executescript(_SCHEMA)

    @contextmanager
    def _connect(self):
        db = sqlite3.connect(self._path, timeout=10, isolation_level=None)
        db.row_factory = sqlite3.Row
        try:
            yield db
        finally:
            db.close()

    # ── meta ──────────────────────────────────────────────────

    @staticmethod
    def _get_meta(db: sqlite3.Connection, key: str) -> str | None:
        row = db.execute("SELECT value FROM meta WHERE key = ?", (key,)).fetchone()
        return row["value"] if row else None

    @staticmethod
    def _set_meta(db: sqlite3.Connection, key: str, value: str) -> None:
        db.execute(
            "INSERT INTO meta (key, value) VALUES (?, ?) "
            "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            (key, value),
        )

    @classmethod
    def _cursor(cls, db: sqlite3.Connection) -> int:
        return int(cls._get_meta(db, "last_seq") or 0)

    def auth_hash(self) -> str | None:
        with self._connect() as db:
            return self._get_meta(db, "auth_hash")

    def status(self) -> tuple[str | None, int]:
        with self._connect() as db:
            return self._get_meta(db, "store_id"), self._cursor(db)

    # ── pareamento ────────────────────────────────────────────

    def pair(self, auth_hash: str, reset: bool = False) -> str:
        """Registra a chave. Idempotente para a mesma chave.

        Trocar de chave apaga todos os registros (cifrados com a antiga, não
        serviriam para mais ninguém) e gera um ``storeId`` novo — e só
        acontece com ``reset=True``.
        """
        with self._lock, self._connect() as db:
            db.execute("BEGIN IMMEDIATE")
            try:
                current = self._get_meta(db, "auth_hash")
                store_id = self._get_meta(db, "store_id")
                if current == auth_hash and store_id and not reset:
                    db.execute("COMMIT")
                    return store_id
                if current and current != auth_hash and not reset:
                    raise AlreadyPairedError()
                db.execute("DELETE FROM records")
                store_id = uuid.uuid4().hex
                self._set_meta(db, "auth_hash", auth_hash)
                self._set_meta(db, "store_id", store_id)
                db.execute("COMMIT")
                return store_id
            except BaseException:
                db.execute("ROLLBACK")
                raise

    def unpair(self) -> None:
        with self._lock, self._connect() as db:
            db.execute("BEGIN IMMEDIATE")
            db.execute("DELETE FROM records")
            db.execute("DELETE FROM meta WHERE key IN ('auth_hash', 'store_id')")
            db.execute("COMMIT")

    # ── push / pull ───────────────────────────────────────────

    def push(self, changes: list[Envelope], device_id: str = "") -> PushResult:
        accepted: list[tuple[str, str]] = []
        rejected: list[Envelope] = []
        with self._lock, self._connect() as db:
            db.execute("BEGIN IMMEDIATE")
            try:
                last_seq = self._cursor(db)
                for change in changes:
                    row = db.execute(
                        "SELECT seq, updated_at, deleted, payload FROM records "
                        "WHERE entity = ? AND id = ?",
                        (change.entity, change.id),
                    ).fetchone()
                    if row is not None:
                        if row["updated_at"] > change.updated_at:
                            rejected.append(_row_envelope(change.entity, change.id, row))
                            continue
                        if (
                            row["updated_at"] == change.updated_at
                            and bool(row["deleted"]) == change.deleted
                            and row["payload"] == change.payload
                        ):
                            # Reenvio do mesmo estado: nada muda, nem o seq.
                            accepted.append((change.entity, change.id))
                            continue
                    last_seq += 1
                    db.execute(
                        "INSERT INTO records (entity, id, seq, updated_at, deleted, payload, device_id) "
                        "VALUES (?, ?, ?, ?, ?, ?, ?) "
                        "ON CONFLICT(entity, id) DO UPDATE SET seq = excluded.seq, "
                        "updated_at = excluded.updated_at, deleted = excluded.deleted, "
                        "payload = excluded.payload, device_id = excluded.device_id",
                        (
                            change.entity,
                            change.id,
                            last_seq,
                            change.updated_at,
                            int(change.deleted),
                            change.payload,
                            device_id or None,
                        ),
                    )
                    accepted.append((change.entity, change.id))
                self._set_meta(db, "last_seq", str(last_seq))
                db.execute("COMMIT")
                return PushResult(accepted=accepted, rejected=rejected, cursor=last_seq)
            except BaseException:
                db.execute("ROLLBACK")
                raise

    def pull(self, since: int, limit: int) -> PullResult:
        with self._connect() as db:
            db.execute("BEGIN")
            store_id = self._get_meta(db, "store_id") or ""
            rows = db.execute(
                "SELECT entity, id, seq, updated_at, deleted, payload FROM records "
                "WHERE seq > ? ORDER BY seq LIMIT ?",
                (since, limit + 1),
            ).fetchall()
            has_more = len(rows) > limit
            rows = rows[:limit]
            changes = [_row_envelope(row["entity"], row["id"], row) for row in rows]
            cursor = changes[-1].seq if changes else max(since, 0)
            if not has_more:
                # Sem mais páginas, o cursor pode ir ao fim da ordem global.
                cursor = max(cursor, self._cursor(db))
            return PullResult(store_id=store_id, changes=changes, cursor=cursor, has_more=has_more)


def _row_envelope(entity: str, record_id: str, row: sqlite3.Row) -> Envelope:
    return Envelope(
        entity=entity,
        id=record_id,
        updated_at=row["updated_at"],
        deleted=bool(row["deleted"]),
        payload=row["payload"],
        seq=row["seq"],
    )
