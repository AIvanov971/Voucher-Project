# Voucher Maker Sync Server (MVP)

Node.js API skeleton for desktop sync.

## Features
- `POST /auth/login` returns JWT for one temporary env user.
- `POST /sync/push` accepts outbox operations and stores them in SQLite change log.
- `GET /sync/pull?since=token` returns org-scoped changes after token.
- Multi-tenant ready via `orgId` in JWT and DB rows.

## Local run
1. Open terminal in `server/`.
2. Install deps:
   ```bash
   npm install
   ```
3. Create env file:
   ```bash
   cp .env.example .env
   ```
   On PowerShell:
   ```powershell
   Copy-Item .env.example .env
   ```
4. Start API:
   ```bash
   npm run start
   ```

Default URL: `http://127.0.0.1:8787`

## Environment
- `PORT` default `8787`
- `HOST` default `127.0.0.1`
- `DB_PATH` default `./data/server.sqlite`
- `AUTH_EMAIL` default `admin@example.com`
- `AUTH_PASSWORD` default `change-me`
- `JWT_SECRET` default `dev-only-change-me`
- `JWT_EXPIRES_IN` default `12h`
- `DEFAULT_ORG_ID` default `local`

## API examples
### Login
```bash
curl -X POST http://127.0.0.1:8787/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"admin@example.com\",\"password\":\"change-me\",\"orgId\":\"local\"}"
```

### Push outbox operations
```bash
curl -X POST http://127.0.0.1:8787/sync/push \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d "{\"ops\":[{\"id\":\"op-1\",\"entityType\":\"service\",\"entityId\":\"svc-1\",\"op\":\"upsert\",\"payload\":{\"name\":\"Haircut\"}}]}"
```

### Pull changes
```bash
curl "http://127.0.0.1:8787/sync/pull?since=0" \
  -H "Authorization: Bearer <JWT>"
```

## Data model
- `sync_changes` stores immutable ordered change log (`token` is monotonic integer).
- `entity_state` stores latest known state per `(orgId, entityType, entityId)`.
