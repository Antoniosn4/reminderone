# Protocolo de sincronização (v1)

Sincronia entre o Reminder desktop e o Reminder mobile **sem nuvem**. O backend
local do desktop (FastAPI) guarda um banco SQLite com os registros **cifrados**;
os apps cifram e decifram. O servidor nunca vê o conteúdo: ele só ordena e
entrega os envelopes.

O mesmo texto está em `reminderMobile/docs/sincronizacao.md`. Mudou aqui, mude lá.

## Peças

| Peça | Papel |
|---|---|
| Chave de sincronização | 32 bytes aleatórios (AES-256), em hex (64 caracteres). Gerada pelo desktop ao ativar a sincronia. Fica no cofre do desktop (cifrada pelo PIN) e no Keychain/Keystore do celular. |
| Token de acesso | `hex(SHA-256(UTF-8("reminder-sync-auth|" + chaveHex)))`. Vai no header `Authorization: Bearer <token>`. O servidor guarda só `hex(SHA-256(token))`. |
| Código de pareamento | `reminder-sync:v1:<chaveHex>:<url>`, por exemplo `reminder-sync:v1:9f…e1:http://192.168.1.5:8000`. É o conteúdo do QR code. A URL vai por último porque contém `:`. |
| Servidor | `server/routers/sync.py`. Banco em `%LOCALAPPDATA%\Reminder1\sync.db` (ou `REMINDER_DATA_DIR`). |

## Envelope (o que trafega e o que o servidor guarda)

```json
{
  "entity": "task",
  "id": "8f0c…",
  "updatedAt": "2026-10-11T21:30:00.000Z",
  "deleted": false,
  "payload": "v1.<iv base64>.<ciphertext+tag base64>",
  "seq": 42
}
```

- `updatedAt`: ISO 8601 em UTC com milissegundos (`Date.prototype.toISOString`). É o relógio da regra de conflito.
- `payload`: AES-256-GCM, IV de 12 bytes e tag de 16 bytes anexada ao ciphertext (formato do WebCrypto). Base64 padrão.
- AAD: `UTF-8("<entity>|<id>|<updatedAt>|<1 se deleted, senão 0>")`. Um envelope antigo não pode ser reetiquetado como mais novo, nem um registro virar lápide sem a chave.
- Texto cifrado: o JSON do registro (abaixo). Lápide (`deleted: true`) cifra `{}`.
- `seq`: só nas respostas do servidor (posição na ordem global).
- Envelope que não decifra é descartado pelo app.

## Entidades e campos (o JSON dentro do payload)

Vocabulário fixo: prioridade `low|medium|high|urgent`; etapa `todo|in_progress|done`;
data `AAAA-MM-DD` no fuso do aparelho; horário `HH:MM` ou `null`.

| entity | Campos |
|---|---|
| `project` | `name`, `color` (hex ou null), `parentId` (subprojeto; null no projeto raiz), `position` (número), `createdAt` |
| `task` | `projectId` (`"inbox"` = Entrada), `title`, `description`, `dueDate`, `dueTime`, `priority`, `status`, `completedAt` (ISO ou null), `tags` (string[]), `subtasks` (`[{title, completed}]`), `estimatedDuration` (minutos ou null), `reminder` (ISO ou null), `origin` (`manual`/`voice`), `assignee` (`{name}` ou null), `createdAt` |
| `kanban_board` | `name`, `color` (hex ou null), `position`, `createdAt` — a "pasta" do Kanban |
| `kanban_column` | `boardId`, `title`, `position` |
| `kanban_card` | `boardId`, `columnId`, `title`, `description`, `color` (hex ou null), `position`, `createdAt` |
| `note` | `title`, `content`, `color` (`gray`, `blue`, `rose`, `emerald`, `violet`, `amber`), `completed`, `parentId` (nota-pai ou null), `position`, `createdAt` |
| `routine` | `label`, `time` (`HH:MM`), `icon` (nome do ícone lucide do desktop), `color` (classe Tailwind `text-*-400` ou hex), `streak`, `aiAdjusted`, `completedDates` (até 14 datas), `createdAt` |
| `profile` | id fixo `"me"`: `name`, `email` |

Regras:

- O projeto Entrada (`id = "inbox"`) existe em todo aparelho e **nunca** é sincronizado.
- **Campos desconhecidos são preservados.** Cada app guarda o último JSON completo recebido e grava por cima dele só os campos que ele mesmo modela. Sem isso, uma edição no celular apagaria as tags que só o desktop mostra.
- Pai pode chegar depois do filho: nenhuma tabela tem chave estrangeira. Tarefa com projeto desconhecido aparece na Entrada; coluna ou cartão de pasta inexistente fica oculto.
- Cascata é responsabilidade de quem exclui:
  - excluir pasta → lápides para as colunas e os cartões dela;
  - excluir coluna → lápides para os cartões;
  - excluir projeto → as tarefas vão para a Entrada (`projectId = "inbox"`) e os subprojetos viram lápides;
  - excluir nota → as filhas sobem para o pai dela.
- Ordem: `position` crescente e, no empate, `id`.

## Regra de conflito

A mais recente vence, **por registro** (o servidor não lê os campos):

- O servidor aceita o envelope se não tiver o registro ou se `updatedAt` recebido ≥ o guardado.
- Senão, recusa e devolve o que tem (o app aplica o do servidor).
- Lápide segue a mesma regra: uma edição mais nova "ressuscita" o registro.

## Endpoints

Todos sob `/api/sync`. "Token" = exige `Authorization: Bearer`. "Local" = só aceita conexão de 127.0.0.1/::1.

| Método e rota | Acesso | Corpo / resposta |
|---|---|---|
| `GET /status` | token | `{paired: true, storeId, cursor}`. 412 se o servidor não estiver pareado; 401 se o token for de outra chave. |
| `POST /push` | token | `{deviceId, changes: [envelope]}` (até 500) → `{accepted: [{entity,id}], rejected: [envelope do servidor], cursor}` |
| `GET /pull?since=<seq>&limit=<n>` | token | `{storeId, changes: [envelope], cursor, hasMore}`, na ordem de `seq` |
| `POST /pair` | local | `{authHash, reset?}` → `{storeId}`. 409 se já pareado com outra chave e `reset` não for `true`. `reset` apaga todos os registros. |
| `POST /unpair` | local | Apaga o pareamento e todos os registros. |
| `GET /hosts` | local | `{port, addresses: ["192.168.1.5", …]}` para montar o QR. |

Fora de `/api/sync`, toda rota `/api/*` (Gemini, Whisper) e a documentação do FastAPI exigem o token quando a conexão não é local. Só o health check `GET /` fica aberto.

## Ciclo do app

1. **Enviar:** os registros com mudança local pendente viram envelopes do estado **atual**: upsert, ou lápide se excluído. Uma pendência só sai da fila se não mudou durante o envio.
2. **Receber:** buscar desde o cursor salvo, em páginas, até `hasMore = false`. Para cada envelope:
   - descartar se não decifrar;
   - pular se o registro tiver pendência local;
   - aplicar só se `updatedAt` for mais novo que o local;
   - aplicar sem gerar nova pendência.
   - Salvar o cursor junto com o que foi aplicado.
3. **`storeId` diferente do salvo** (o servidor foi reiniciado ou repareado): cursor volta a 0 e todo registro local é marcado como pendente.
4. **Quando roda:** ao abrir o app, depois de cada escrita (com espera curta) e periodicamente enquanto o app está aberto.


## Durabilidade e notificação de alterações

`GET /api/sync/changes?since=<cursor>&store_id=<id>&timeout=25` usa o mesmo token das demais rotas. Retorna `cursor` e `storeId` quando mudam ou ao terminar a espera; o cliente então usa o pull existente. Clientes antigos continuam compatíveis via polling.

Páginas com envelopes não autenticáveis não avançam o cursor. Confirmações incompletas de push mantêm a outbox. Registros, outbox e cursor são persistidos atomicamente em cada dispositivo. Detalhes e limites em [validação local-first](local-first-validacao.md).
