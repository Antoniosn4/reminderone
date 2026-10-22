"""Cobre o servidor da sincronização (docs/SYNC_PROTOCOL.md): pareamento,
regra de conflito, paginação e quem pode acessar o quê pela rede.

O TestClient se apresenta como o host "testclient". Por padrão ele conta como
um aparelho da rede; a fixture `local` o trata como a própria máquina.
"""

import hashlib

import pytest
from fastapi.testclient import TestClient

import main
import security
from routers import sync as sync_router
from sync_store import SyncStore

KEY_HEX = "11" * 32
TOKEN = hashlib.sha256(f"reminder-sync-auth|{KEY_HEX}".encode()).hexdigest()
AUTH_HASH = hashlib.sha256(TOKEN.encode()).hexdigest()
OTHER_HASH = hashlib.sha256(b"outra-chave").hexdigest()
AUTH = {"Authorization": f"Bearer {TOKEN}"}

T1 = "2026-10-11T12:00:00.000Z"
T2 = "2026-10-11T12:00:05.000Z"
T3 = "2026-10-11T12:00:09.000Z"


@pytest.fixture
def store(tmp_path, monkeypatch):
    store = SyncStore(tmp_path / "sync.db")
    monkeypatch.setattr(sync_router, "_store", store)
    return store


@pytest.fixture
def client(store):
    return TestClient(main.app)


@pytest.fixture
def local(monkeypatch):
    monkeypatch.setattr(security, "LOOPBACK_HOSTS", security.LOOPBACK_HOSTS | {"testclient"})


@pytest.fixture
def paired(store):
    return store.pair(AUTH_HASH)


def envelope(record_id="t1", updated_at=T1, deleted=False, payload="v1.aXY=.Y3Q=", entity="task"):
    return {
        "entity": entity,
        "id": record_id,
        "updatedAt": updated_at,
        "deleted": deleted,
        "payload": payload,
    }


def push(client, *changes):
    response = client.post("/api/sync/push", json={"deviceId": "d1", "changes": list(changes)}, headers=AUTH)
    assert response.status_code == 200, response.text
    return response.json()


def pull(client, since=0, limit=500):
    response = client.get(f"/api/sync/pull?since={since}&limit={limit}", headers=AUTH)
    assert response.status_code == 200, response.text
    return response.json()


# ── Pareamento ──────────────────────────────────────────────

def test_pair_only_from_this_machine(client):
    response = client.post("/api/sync/pair", json={"authHash": AUTH_HASH})
    assert response.status_code == 403


def test_pair_is_idempotent_and_refuses_another_key(client, local):
    first = client.post("/api/sync/pair", json={"authHash": AUTH_HASH}).json()["storeId"]
    again = client.post("/api/sync/pair", json={"authHash": AUTH_HASH}).json()["storeId"]
    assert again == first

    conflict = client.post("/api/sync/pair", json={"authHash": OTHER_HASH})
    assert conflict.status_code == 409


def test_reset_switches_key_and_wipes_records(client, local, paired):
    push(client, envelope())
    response = client.post("/api/sync/pair", json={"authHash": OTHER_HASH, "reset": True})
    assert response.status_code == 200
    assert response.json()["storeId"] != paired

    # O token antigo não vale mais, e os registros cifrados com a chave antiga sumiram.
    assert client.get("/api/sync/status", headers=AUTH).status_code == 401
    store = sync_router.get_store()
    assert store.pull(0, 10).changes == []


def test_status_distinguishes_unpaired_and_wrong_token(client):
    assert client.get("/api/sync/status", headers=AUTH).status_code == 412


def test_status_with_wrong_token(client, paired):
    response = client.get("/api/sync/status", headers={"Authorization": "Bearer errado"})
    assert response.status_code == 401
    ok = client.get("/api/sync/status", headers=AUTH)
    assert ok.json() == {"paired": True, "storeId": paired, "cursor": 0}


def test_unpair_from_this_machine(client, local, paired):
    assert client.post("/api/sync/unpair").status_code == 200
    assert client.get("/api/sync/status", headers=AUTH).status_code == 412


# ── Push / pull ─────────────────────────────────────────────

def test_push_then_pull_in_global_order(client, paired):
    result = push(client, envelope("a"), envelope("b", entity="project"))
    assert result["accepted"] == [{"entity": "task", "id": "a"}, {"entity": "project", "id": "b"}]
    assert result["rejected"] == []
    assert result["cursor"] == 2

    page = pull(client)
    assert page["storeId"] == paired
    assert [(c["entity"], c["id"], c["seq"]) for c in page["changes"]] == [("task", "a", 1), ("project", "b", 2)]
    assert page["cursor"] == 2
    assert page["hasMore"] is False
    assert pull(client, since=2)["changes"] == []


def test_older_version_is_rejected_with_the_server_copy(client, paired):
    push(client, envelope("a", updated_at=T2, payload="v1.bm92bw==.YQ=="))
    result = push(client, envelope("a", updated_at=T1, payload="v1.dmVsaG8=.YQ=="))

    assert result["accepted"] == []
    [server_copy] = result["rejected"]
    assert server_copy["updatedAt"] == T2
    assert server_copy["payload"] == "v1.bm92bw==.YQ=="


def test_resending_the_same_version_does_not_bump_seq(client, paired):
    push(client, envelope("a"))
    result = push(client, envelope("a"))
    assert result["accepted"] == [{"entity": "task", "id": "a"}]
    assert result["cursor"] == 1


def test_newer_version_and_tombstone_replace_the_record(client, paired):
    push(client, envelope("a", updated_at=T1))
    push(client, envelope("a", updated_at=T2, payload="v1.Mg==.Mg=="))
    push(client, envelope("a", updated_at=T3, deleted=True, payload="v1.Mw==.Mw=="))

    [change] = pull(client)["changes"]
    assert change["deleted"] is True
    assert change["updatedAt"] == T3
    assert change["seq"] == 3


def test_pull_paginates(client, paired):
    push(client, *[envelope(f"t{i}") for i in range(5)])

    first = pull(client, since=0, limit=2)
    assert [c["id"] for c in first["changes"]] == ["t0", "t1"]
    assert first["hasMore"] is True
    second = pull(client, since=first["cursor"], limit=2)
    third = pull(client, since=second["cursor"], limit=2)
    assert [c["id"] for c in second["changes"] + third["changes"]] == ["t2", "t3", "t4"]
    assert third["hasMore"] is False
    assert third["cursor"] == 5


@pytest.mark.parametrize("change", [
    envelope(entity="unknown"),
    envelope(updated_at="2026-10-11 12:00"),
    envelope(updated_at="2026-10-11T12:00:00Z"),
    envelope(record_id=""),
])
def test_invalid_envelopes_are_refused(client, paired, change):
    response = client.post("/api/sync/push", json={"changes": [change]}, headers=AUTH)
    assert response.status_code == 422


def test_batch_limit(client, paired):
    changes = [envelope(f"t{i}") for i in range(sync_router.MAX_BATCH + 1)]
    response = client.post("/api/sync/push", json={"changes": changes}, headers=AUTH)
    assert response.status_code == 422


# ── Acesso pela rede ────────────────────────────────────────

def test_health_check_is_open(client):
    assert client.get("/").status_code == 200


def test_other_routes_need_the_token_from_the_network(client, paired):
    assert client.post("/api/gemini", json={}).status_code == 401
    assert client.get("/docs").status_code == 401
    assert client.get("/openapi.json").status_code == 401
    # Com o token, a requisição chega à rota (que recusa o corpo vazio).
    assert client.post("/api/gemini", json={}, headers=AUTH).status_code == 422


def test_network_is_closed_before_pairing(client):
    assert client.post("/api/gemini", json={}, headers=AUTH).status_code == 401


def test_this_machine_does_not_need_the_token(client, local):
    assert client.post("/api/gemini", json={}).status_code == 422
    assert client.get("/openapi.json").status_code == 200


def test_hosts_only_from_this_machine(client, local):
    response = client.get("/api/sync/hosts")
    assert response.status_code == 200
    body = response.json()
    assert isinstance(body["addresses"], list)
    assert all(not address.startswith("127.") for address in body["addresses"])


def test_hosts_refused_from_the_network(client):
    assert client.get("/api/sync/hosts").status_code == 403


def test_changes_requires_authentication(client, paired):
    assert client.get('/api/sync/changes?timeout=0').status_code == 401


def test_changes_observes_push_and_store_reset(client, store, paired):
    initial = client.get(f'/api/sync/changes?since=0&store_id={paired}&timeout=0', headers=AUTH).json()
    assert initial == {'storeId': paired, 'cursor': 0}
    push(client, envelope())
    changed = client.get(f'/api/sync/changes?since=0&store_id={paired}&timeout=0', headers=AUTH).json()
    assert changed['cursor'] > 0
    new_id = store.pair(AUTH_HASH, reset=True)
    reset = client.get(f'/api/sync/changes?since={changed["cursor"]}&store_id={paired}&timeout=0', headers=AUTH).json()
    assert reset['storeId'] == new_id
