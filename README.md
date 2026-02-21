# Voucher-Project

Офлайн десктоп приложение (Electron) за създаване, записване и експорт на ваучери в PDF/PNG, с QR кодове и изображения.

**Бърз старт**
1. Инсталирай зависимости: `npm install`
2. Стартирай приложението: `npm run start`

**Скриптове**
- `npm run start` стартира Electron приложението.
- `npm run test:smoke` пуска бърз тест за експорт на PDF/PNG.
- `npm run pack` билд без инсталатор (в `dist/win-unpacked`).
- `npm run dist` билд с Windows инсталатор (NSIS) в `dist/`.

**Структура**
- `main.js` main процес, IPC, шаблони, експорт, база/файлово съхранение.
- `preload.js` безопасен мост за IPC API към рендъра.
- `renderer/` UI (HTML/CSS/JS).
- `src/exporter.js` логика за рендър и експорт (PDF/PNG).
- `templates/` папка с шаблони.
- `tests/` smoke тестове.

**Шаблони**
- Всеки шаблон е папка `templates/<templateId>/`.
- В шаблонната папка има `template.json` (мета данни), `layout.json` (полета text/qr/image) и `assets/` (фон, лого, стикери).
- Базовият HTML за рендър е в `templates/_base/template.html`.
- Скритите шаблони са тези с име, започващо с `_`, както и `classic` и `minimal`.
- Размерът на страницата може да е в px (`widthPx`, `heightPx`) или като string с mm, напр. `"210mm"`.

**Данни и файлове**
- Настройки: `settings.json` в `app.getPath('userData')`.
- Ваучери (файлово съхранение): `vouchers/vouchers.json`.
- Изображения към ваучери: `vouchers/assets/<voucherId>/...`.
- Локална база: `vouchers.db` (SQLite).
- Експортите се записват по подразбиране в `Downloads` на потребителя.

**Бележки за базата**
- Приложението използва `better-sqlite3` (native). Ако модулът не се зареди, приложението пада обратно към файловия JSON (`vouchers.json`) за списъци и валидиране.
- При проблеми с `better-sqlite3` пробвай: `npm rebuild better-sqlite3` или `npx electron-rebuild`.

**Тестове**
- `npm run test:smoke` създава временен шаблон и експортира PDF/PNG в поддиректория `smoke-outputs` на `app.getPath('userData')`.




Ето ти **малки, структурирани Codex промптове** (по етапи), които можеш да подаваш един по един. Те са написани така, че Codex да прави **локални промени по съществуващия Electron проект**, без да “пренаписва всичко”. Използвам твоите вече налични IPC patterns (preload namespaces)  и DB/схема подхода в `main.js` .

> Как да ги ползваш: копираш **един промпт**, пускаш го, преглеждаш diff, после следващия.

---

# PROMPT 0.0 — Repo scan + правила за промени

**Codex Prompt**

> You are working in an existing Electron app “Voucher Maker”. First, scan the repository structure and identify where: IPC handlers live (main.js), preload API (preload.js), UI renderer files (renderer/*), templates/exporter (src/exporter.js), and any existing voucher storage (SQLite + JSON fallback).
> Rules:
>
> * Do NOT remove existing voucher/template/export functionality.
> * Prefer additive changes.
> * Follow existing IPC naming and patterns (see preload.js namespaces).
> * Any new DB tables must be added in ensureSchema() in main.js (or a dedicated schema module called from main.js).
>   Output: a short plan of which files you will touch for Stage 1 only.

---
 
# STAGE 1 — Services + Resources (offline) Implemented
 
## PROMPT 1.1 — DB schema for services/resources Implemented

**Codex Prompt**

> Implement Stage 1 database tables in SQLite in main.js ensureSchema():
> Add tables (TEXT ids, offline-first):
>
> * services(id TEXT PRIMARY KEY, orgId TEXT, name TEXT NOT NULL, durationMin INTEGER NOT NULL DEFAULT 30, priceCents INTEGER DEFAULT 0, currency TEXT DEFAULT 'BGN', isActive INTEGER DEFAULT 1, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL, deletedAt TEXT)
> * resources(id TEXT PRIMARY KEY, orgId TEXT, name TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'employee', isActive INTEGER DEFAULT 1, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL, deletedAt TEXT)
> * resource_services(resourceId TEXT NOT NULL, serviceId TEXT NOT NULL, PRIMARY KEY(resourceId, serviceId))
>   Requirements:
> * Keep existing vouchers table untouched.
> * Add helper function to generate UUID (crypto.randomUUID if available; fallback to randomBytes).
> * Add minimal indexes: services(orgId,isActive), resources(orgId,isActive).
> * Use WAL as already done.
>   Output: code changes only.
 
## PROMPT 1.2 — Repos (CRUD) in main process Implemented

**Codex Prompt**

> Add repository functions in main.js (or src/repos/* if you prefer) for services/resources with SQLite, with fallback to JSON ONLY if db is not available (mirror existing pattern).
> Functions needed:
>
> * services.list(limit=200, searchText='')
> * services.get(id)
> * services.save(service) => upsert, sets updatedAt, creates createdAt if missing
> * services.delete(id) => soft delete sets deletedAt
> * resources.list(limit=200, searchText='')
> * resources.get(id)
> * resources.save(resource)
> * resources.delete(id)
> * resource_services.set(resourceId, serviceIds[]) => replaces mappings
> * resource_services.get(resourceId) => serviceIds
>   Requirements:
> * Use safe parameterized queries.
> * Normalize orgId to 'local' for now.
> * Do not break existing vouchers JSON fallback.
>   Output: code only.

## PROMPT 1.3 — IPC handlers + preload API Implemented

**Codex Prompt**

> Extend IPC: add handlers in main.js:
>
> * services:list, services:get, services:save, services:delete
> * resources:list, resources:get, resources:save, resources:delete
> * resources:setServices, resources:getServices
>   Then extend preload.js to expose under window.api:
>   api.services.{list,get,save,delete}
>   api.resources.{list,get,save,delete,getServices,setServices}
>   Requirements:
> * Follow existing conventions in preload.js namespaces  (same style, ipcRenderer.invoke).
> * Return consistent payloads {ok:true,data:...} on writes; {ok:false,error:'...'} on errors.
>   Output: code only.

## PROMPT 1.4 — UI: Tabs + basic CRUD lists Implemented

**Codex Prompt**

> Update renderer UI to add two new tabs: “Services” and “Resources”.
> Implement simple CRUD screens:
>
> * Services: list table (name, duration, price, active), search box, Add/Edit modal, Delete.
> * Resources: list table (name, type, active), search, Add/Edit modal, Delete.
>   Use window.api.services/resources calls.
>   Requirements:
> * Keep existing Vouchers and Template Builder screens intact.
> * Minimal styling consistent with existing styles.css.
> * Handle errors with a simple inline alert/toast.
>   Output: code changes to renderer files only.

## PROMPT 1.5 — Resource ↔ Services mapping UI Implemented

**Codex Prompt**

> In Resources Edit modal, add “Allowed services” multi-select list.
> Load all services (active) and current mappings via: api.services.list + api.resources.getServices(resourceId).
> Save mapping via api.resources.setServices(resourceId, serviceIds).
> Requirements:
>
> * Keep UX simple: checkbox list is fine.
>   Output: renderer code only.

---

# STAGE 2 — Availability rules (offline) - Implemented

## PROMPT 2.1 — DB: availability rules + exceptions - Implemented

**Codex Prompt**

> Add tables to SQLite schema:
>
> * availability_rules(id TEXT PRIMARY KEY, orgId TEXT, resourceId TEXT NOT NULL, weekday INTEGER NOT NULL, startTime TEXT NOT NULL, endTime TEXT NOT NULL, breaksJson TEXT DEFAULT '[]', createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL, deletedAt TEXT)
> * availability_exceptions(id TEXT PRIMARY KEY, orgId TEXT, resourceId TEXT NOT NULL, date TEXT NOT NULL, isOff INTEGER NOT NULL DEFAULT 1, startTime TEXT, endTime TEXT, note TEXT, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL, deletedAt TEXT)
>   Add indexes on (resourceId, weekday) and (resourceId, date).
>   Output: code only.

## PROMPT 2.2 — IPC + UI for working hours - Implemented

**Codex Prompt**

> Implement repo + IPC for availability rules/exceptions:
>
> * availability:listRules(resourceId)
> * availability:saveRule(rule) / deleteRule(id)
> * availability:listExceptions(resourceId, from, to)
> * availability:saveException(ex) / deleteException(id)
>   Add a “Working hours” section in Resource Edit modal:
> * 7-day grid with start/end times
> * optional breaks (simple: one break start/end)
> * exceptions list with date picker (“off day” or “custom hours”)
>   Keep UI minimal but functional.
>   Output: code only.

---

# STAGE 3 — Bookings + Calendar (offline) Implemented

## PROMPT 3.1 — DB: customers + bookings 

**Codex Prompt**

> Add SQLite tables:
>
> * customers(id TEXT PRIMARY KEY, orgId TEXT, name TEXT NOT NULL, phone TEXT, email TEXT, notes TEXT, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL, deletedAt TEXT)
> * bookings(id TEXT PRIMARY KEY, orgId TEXT, serviceId TEXT NOT NULL, resourceId TEXT NOT NULL, customerId TEXT NOT NULL, startAt TEXT NOT NULL, endAt TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'confirmed', note TEXT, source TEXT NOT NULL DEFAULT 'desktop', voucherId TEXT, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL, deletedAt TEXT)
>   Index: bookings(resourceId,startAt,endAt,status), customers(orgId,name).
>   Output: code only.

## PROMPT 3.2 — Availability engine (compute slots) Implemented

**Codex Prompt**

> Implement a pure function module src/domain/availability.js that computes available slots:
> Inputs: rules, exceptions, existing bookings, service duration, date range, slotStepMin=15.
> Output: array of ISO startAt times (and optionally endAt) that are free.
> Rules: respect breaks and exceptions; exclude deleted/cancelled bookings.
> Provide unit-test-like self-check function (no external test framework) or minimal smoke check.
> Output: code only.
 
## PROMPT 3.3 — IPC: bookings CRUD + “availability query” Implemented

**Codex Prompt**

> Add IPC endpoints:
>
> * customers:list/get/save/delete
> * bookings:list(range, resourceIds?)
> * bookings:get/save/delete
> * bookings:computeSlots({serviceId, resourceId, from, to})
>   Make computeSlots use availability.js and SQLite data.
>   Output: main.js + preload.js changes only.

## PROMPT 3.4 — UI: Schedule tab (week/day) Implemented

**Codex Prompt**

> Add “Schedule” tab:
>
> * left filter: date picker, service selector, resource selector
> * main view: simple day grid by time (15 min rows) and bookings blocks
> * click empty slot => create booking modal
> * click booking => edit/cancel
>   Use computeSlots for available times when creating.
>   Keep UI simple (no drag-drop yet).
>   Output: renderer code only.

---

# STAGE 4 — Voucher ↔ Booking Implemented

## PROMPT 4.1 — Link voucher to booking + redeem history

**Codex Prompt**

> Extend vouchers domain to support redemptions linked to bookings:
> Add table voucher_redemptions(id TEXT PRIMARY KEY, voucherCode TEXT NOT NULL, bookingId TEXT, redeemedAt TEXT NOT NULL, amountCents INTEGER DEFAULT 0, note TEXT).
> Add IPC: vouchers:validateCode(code) returns {valid, redeemedAt?, expires?, value?}.
> In booking modal: input voucher code -> validate -> attach voucherId/code.
> On booking status change to “completed”: create redemption record and mark voucher redeemedAt (if your current schema supports it).
> Requirements: do not break existing redeemVoucher flow.
> Output: code only.

---

# STAGE 5 — Sync foundations (без backend още) Implemented

## PROMPT 5.1 — Outbox + sync status Implemented

**Codex Prompt**

> Add local-only tables:
>
> * sync_outbox(id TEXT PRIMARY KEY, entityType TEXT, entityId TEXT, op TEXT, payloadJson TEXT, createdAt TEXT, sentAt TEXT, ackAt TEXT, error TEXT)
> * sync_state(id TEXT PRIMARY KEY, lastPullToken TEXT, updatedAt TEXT)
>   Modify save/delete for services/resources/customers/bookings/vouchers to append an outbox record (op=upsert/delete) with minimal payload.
>   Add IPC: sync:getStatus, sync:listOutbox, sync:clearErrors.
>   UI: small Sync indicator in header showing pending outbox count.
>   Output: code only.

---

# STAGE 6 — Backend MVP (Node) + desktop sync Implemented

## PROMPT 6.1 — Create backend skeleton Implemented

**Codex Prompt**

> Create a new folder server/ with a Node.js (Express or Fastify) API skeleton:
>
> * POST /auth/login (temporary: email+password in env) -> jwt
> * POST /sync/push (accept outbox ops)
> * GET /sync/pull?since=token (return changes)
>   Data store: PostgreSQL preferred, but for MVP use SQLite in server folder.
>   Must be multi-tenant ready (orgId).
>   Output: code + README for running server locally.

## PROMPT 6.2 — Implement push/pull protocol Implemented

**Codex Prompt**

> Implement a simple sync protocol:
>
> * Each accepted operation writes to a changes log table with monotonic token (integer).
> * pull returns changes since token.
> * push returns ack list + latest token.
>   Add conflict detection for bookings overlapping in same resource/time: return conflict object.
>   Output: server code only.

## PROMPT 6.3 — Desktop sync client

**Codex Prompt**

> In Electron main process, implement sync:run against server baseUrl from settings.json.
> Flow: push pending outbox -> pull changes -> apply locally -> update sync_state.
> Handle booking conflict: store conflict in outbox error and surface in UI.
> Output: main.js + preload + renderer small UI update.

---

# STAGE 7 — Public bookings (B2C)

## PROMPT 7.1 — Public API + slot hold/confirm

**Codex Prompt**

> In server, add public endpoints:
>
> * GET /public/:org/services
> * GET /public/:org/resources?serviceId=
> * GET /public/:org/availability?serviceId=&resourceId=&from=&to=
> * POST /public/:org/holds {serviceId, resourceId?, startAt} -> {holdId, expiresAt}
> * POST /public/:org/bookings {holdId, customer:{name,phone,email}, note, voucherCode?}
>   Implement holds with TTL (expiresAt) and ensure no double-booking (atomic check).
>   Output: server code only.

## PROMPT 7.2 — Public web app (simple)

**Codex Prompt**

> Create server/public-web/ as a static web app (vanilla or small framework) that consumes the public endpoints:
> Step flow: service -> resource -> time -> customer -> confirm.
> Mobile-first styling.
> Show confirmation with booking reference + QR code (generated client-side).
> Output: code only.

---

## Ако искаш да го направим още по-“Codex-friendly”

Мога да ти ги дам и като **много къси “micro-prompts”** (по 1 файл/функция), но горните са достатъчно малки, за да се работи итеративно без хаос.

Кажи ми само: искаш ли backend-ът да е **Express** или **Fastify** (и двата са ок). Ако не кажеш — приемам Express за най-малко триене.
