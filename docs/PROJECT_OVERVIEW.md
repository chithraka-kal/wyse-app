# Wyse — Project Overview (current state)

Date: 2026-05-01

This document summarizes the current implemented project (frontend + API in Next.js), the main flows, data models, API routes, key files and exported symbols, environment variables, and run instructions.

---

## 1. High-level architecture

- Frontend: Next.js (App Router, TypeScript, Tailwind) located in `WYSE-APP` (previously `frontend`).
- Backend/API: Next.js App Router API routes bundled with the frontend under `app/api/*`.
- Database: MongoDB via Mongoose models in `models/`.
- AI integration: Gemini wrapper in `lib/gemini.ts` (progressive enhancement).
- Auth: Single-user guard using an `ADMIN_SECRET` header check in `lib/auth.ts`.

---

## 2. Data models (Mongoose)

Files: `models/Item.js`, `models/Fund.js`, `models/AgentLog.js`

- Collection names (current):
  - `items` (from `models/Item.js`)
  - `funds` (from `models/Fund.js`)
  - `agentlogs` (from `models/AgentLog.js`) — note: spec suggested `agent_logs`; model can be changed to use that exact collection name by passing a third arg to `mongoose.model`.

Brief schemas and key fields:

- Item
  - name (String)
  - price (Number)
  - funded (Number)
  - zone ("incubator" | "definite")
  - tier ("high"|"mid"|"low" | null)
  - status ("active"|"done"|"dropped")
  - promoteAfter (Date | null)
  - aiSuggested (Boolean)
  - addedAt (Date)

- Fund
  - amount (Number)
  - unallocated (Number)
  - allocations: [{ itemId: ObjectId, amount: Number }]
  - source, aiAssisted, receivedAt

- AgentLog
  - type ("interrogate"|"allocate"|"categorise")
  - itemId (ObjectId | null)
  - prompt (String)
  - response (String)
  - success (Boolean)
  - createdAt (Date)

---

## 3. Key library utilities (lib)

- `lib/db.ts`
  - Exports default `async function connectDB()` — Mongoose connection singleton that caches on `global.mongooseCache` to avoid reconnects during hot reload.

- `lib/auth.ts`
  - Exports `requireAdmin(request: NextRequest): NextResponse | null`.
  - Checks `x-admin-secret` header against `process.env.ADMIN_SECRET`. Returns a 401 NextResponse when missing/invalid.

- `lib/gemini.ts`
  - Exports `async function askGemini(prompt: string, timeoutMs = 5000): Promise<string|null>`.
  - Calls Gemini REST API with an AbortController timeout, returns null on failure.

---

## 4. API routes and handler functions (app/api)

Routes use Next.js App Router file-based API handlers (TypeScript). Each file exports HTTP method handlers: `GET`, `POST`, `PATCH`, `DELETE`.

- `app/api/items/route.ts`
  - Exports `GET(request)` — fetch all items where `status != 'dropped'`, optional `?zone=` filter. Calls `connectDB()` and `Item.find()`.
  - Exports `POST(request)` — creates a new `Item`. If `zone === 'incubator'` sets `promoteAfter = now + 7 days`.
  - Uses `requireAdmin` to enforce admin header.

- `app/api/items/[id]/route.ts`
  - Exports `GET(request, { params })` — fetch single item by id.
  - Exports `PATCH(request, { params })` — partial update via `$set` and returns updated item.
  - Exports `DELETE(request, { params })` — soft-delete by setting `status: 'dropped'`.
  - Uses `requireAdmin`.

- `app/api/funds/route.ts`
  - Exports `GET(request)` — fetch funds sorted by `receivedAt` desc, populates allocations.itemId.
  - Exports `POST(request)` — create a Fund doc with `amount` and `unallocated = amount`.
  - Uses `requireAdmin`.

- `app/api/funds/[id]/route.ts`
  - Exports `PATCH(request, { params })` — accept `allocations: [{ itemId, amount }]`:
    - Validates allocations sum ≤ `fund.unallocated`.
    - For each allocation: increments `Item.funded` via `Item.findByIdAndUpdate`, sets `item.status = 'done'` when funded ≥ price, pushes allocation into fund.allocations, decrements fund.unallocated.
    - Saves and returns updated fund (populated).
  - Uses `requireAdmin`.

- AI routes: all POST and return `{ result, aiAvailable: boolean }` plus AgentLog entries
  - `app/api/ai/interrogate/route.ts` — builds the interrogate prompt (single sharp question), calls `askGemini`, logs an AgentLog. Returns fallback string + `aiAvailable:false` when Gemini returns null.
  - `app/api/ai/allocate/route.ts` — sends pipeline item list and unallocated amount to Gemini, expects JSON array of allocations; attempts to parse JSON and returns parsed allocations with `aiAvailable:true` or falls back.
  - `app/api/ai/categorise/route.ts` — sends rawInput to Gemini and expects JSON `{ name, price, tier, zone }` to pre-fill item create form; logs AgentLog and returns `aiAvailable` flag.

---

## 5. Frontend pages & major components (app/ and components/)

Pages (client/server mix):
- `app/page.tsx` — Dashboard (client component) — the main UI. Exports default React component.
  - Fetches `/api/items` on mount (client-side) using `fetch` with `x-admin-secret` header.
  - Splits items into `incubator` and `definite` and calculates totals.
  - Implements actions: open AddItem modal, log funds (creates Fund then opens AllocateFundsModal), promote (PATCH item zone and tier), drop (DELETE soft-delete).

- `app/incubator/page.tsx` — Incubator page (static/small).
- `app/pipeline/page.tsx` — Pipeline page.
- `app/funds/page.tsx` — Funds page — lists Fund documents and allocation breakdowns.

Components (files and key exported behavior):
- `components/AddItemModal.tsx` (client)
  - Props: `{ onClose: () => void, onAdded: (item) => void }`.
  - Fields: name, price, url, zone, tier (conditional), notes.
  - Behavior: when zone === incubator, calls `/api/ai/categorise` to prefill price/tier (shows spinner). Then POST `/api/items` with `x-admin-secret` header.

- `components/AllocateFundsModal.tsx` (client)
  - Props `{ fund, items, onClose, onAllocated }`.
  - On open: POST `/api/ai/allocate` to get suggestions; pre-fills inputs if available; allows manual editing; on confirm PATCH `/api/funds/[id]`.

- `components/ItemCard.tsx`
  - Renders item name, price, incubator countdown, AI challenge question, promote/drop buttons, or progress + add funds button for definite items.

- `components/FundProgress.tsx` — small progress bar showing funded/price percent.
- `components/AiBadge.tsx` — small badge used to indicate AI suggested/unavailable.

Types used: `types/wyse.ts` defines `Item`, `Fund`, `FundAllocation`, `Zone`, `Tier`, etc.

---

## 6. Environment variables

Files: app reads `process.env` server-side and the frontend reads `NEXT_PUBLIC_ADMIN_SECRET` client-side.

- `MONGODB_URI` — MongoDB connection string (required for DB).
- `GEMINI_API_KEY` — Gemini API key (optional; AI features fallback gracefully when missing or failing).
- `ADMIN_SECRET` — server-only secret used to authorize API calls (checked by `lib/auth.ts`).
- `NEXT_PUBLIC_ADMIN_SECRET` — currently used by the client to send `x-admin-secret` on fetch; for production this exposes the secret and is not recommended for multi-user/public deployments.

Recommended local `.env` (example in repo: `.env.example` / `.env`):

```
MONGODB_URI=...
GEMINI_API_KEY=...
ADMIN_SECRET=some_long_random_string
NEXT_PUBLIC_ADMIN_SECRET=some_long_random_string  # note: exposes secret in client bundle
```

Security note: for production, prefer not to expose `NEXT_PUBLIC_ADMIN_SECRET` — instead proxy client requests server-side or implement proper auth.

---

## 7. Main user flows (sequence summaries)

1. Add an item (incubator)
   - UI: user opens `AddItemModal`, inputs name, price (or AI suggests), zone default `incubator`.
   - Client: POST `/api/ai/categorise` (optional) then POST `/api/items` with `x-admin-secret`.
   - Server: `POST /api/items` creates Item; if `incubator` sets `promoteAfter` = now + 7d.

2. Promote an item to definite
   - UI: Press Promote on incubator card (disabled until `promoteAfter`, user can override confirmation).
   - Client: PATCH `/api/items/[id]` with `{ zone: 'definite', tier }`.
   - Server: updates item zone/tier.

3. Log funds + allocate
   - UI: Click "Log funds" → prompt for amount → POST `/api/funds` creates Fund with `unallocated`.
   - Client: opens `AllocateFundsModal` which POSTs `/api/ai/allocate` to prefill suggestions, or user fills manually.
   - Client: PATCH `/api/funds/[id]` with allocations.
   - Server: For each allocation increment `Item.funded`, set `status` to `done` when funded≥price, push allocation and decrement `unallocated`.

4. AI interactions
   - Interrogate: `/api/ai/interrogate` returns a one-question challenge for incubator items.
   - Allocate: `/api/ai/allocate` suggests JSON allocations for a Fund.
   - Categorise: `/api/ai/categorise` parses freeform text into `{ name, price, tier, zone }`.
   - All AI calls: use `lib/gemini.askGemini()` with 5s timeout; failures return `aiAvailable: false` and are logged in `agentlogs`.

---

## 8. File map (high value files)

- lib/
  - `db.ts` — connectDB()
  - `auth.ts` — requireAdmin()
  - `gemini.ts` — askGemini()

- models/
  - `Item.js` — Item model (collection: `items`)
  - `Fund.js` — Fund model (collection: `funds`)
  - `AgentLog.js` — AgentLog model (collection: `agentlogs`)

- app/
  - `page.tsx` — Dashboard (client)
  - `incubator/page.tsx`, `pipeline/page.tsx`, `funds/page.tsx`
  - api/
    - items/route.ts, items/[id]/route.ts
    - funds/route.ts, funds/[id]/route.ts
    - ai/interrogate/route.ts, ai/allocate/route.ts, ai/categorise/route.ts

- components/
  - AddItemModal.tsx, AllocateFundsModal.tsx, ItemCard.tsx, FundProgress.tsx, AiBadge.tsx

- types/
  - `wyse.ts` — shared TS types (Item, Fund, Tier, Zone)

- `.env` / `.env.example` — env vars

---

## 9. Run & test locally

1. Ensure `.env` in repo root (or `WYSE-APP/.env.local`) contains:

```
MONGODB_URI=...
GEMINI_API_KEY=...   # optional
ADMIN_SECRET=<secure-random-hex>
NEXT_PUBLIC_ADMIN_SECRET=<same-as-admin-secret-for-local-testing>
```

2. Install deps and run dev from the Next.js folder (if you renamed `frontend` to `WYSE-APP`):

```bash
cd WYSE-APP
npm install
npm run dev
```

3. Open `http://localhost:3000` and test flows. Use browser DevTools Network tab to inspect requests — `x-admin-secret` header is required for API calls.

---

## 10. Next recommended steps / improvements

- Remove `NEXT_PUBLIC_ADMIN_SECRET` from client usage: implement a small server-side proxy route that injects the admin header, or add proper auth if multi-user.
- Change `agentlogs` collection name to `agent_logs` if you prefer underscore naming. Update `models/AgentLog.js` to: `mongoose.model('AgentLog', AgentLogSchema, 'agent_logs')`.
- Add unit/integration tests for API routes.
- Add small e2e script or Postman collection describing endpoints and sample payloads.

---

If you want, I can now:
- Save a JSON or OpenAPI spec for the API routes,
- Replace client-side exposure of `NEXT_PUBLIC_ADMIN_SECRET` with a secure proxy implementation,
- Or produce a short Postman/HTTPie example set to exercise the API endpoints.

Which of those should I do next? 
