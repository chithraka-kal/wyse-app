# Wyse — Project Specification & Copilot Prompt Guide

> **Tagline:** Spend with intention.
> **Stack:** Next.js (App Router) · Node.js API Routes · MongoDB (Mongoose) · Gemini API (optional AI layer)
> **User:** Single user, self-hosted or Vercel + MongoDB Atlas free tier.

---

## 1. What is Wyse?

Wyse is a personal goal-oriented savings and wishlist app. It is **not** a traditional expense tracker. Its job is to help you think before you spend, allocate money toward things that actually matter, and interrogate impulse purchases before they drain your budget.

The app has two zones:

- **Incubator** — A cooling-off zone for impulse items. Every new desire lands here first and must survive a time delay (and optionally an AI challenge) before being promoted.
- **Definite Pipeline** — Items you have logically committed to buying, sorted into High / Mid / Low tiers and waiting for funds.

The AI layer (Gemini) is a **progressive enhancement**. The app works perfectly without it. If the API fails or hits quota, the UI falls back gracefully to manual flows.

---

## 2. App Name & Branding

| Property | Value |
|---|---|
| Name | **Wyse** |
| Tagline | Spend with intention |
| Primary color | Deep teal `#0F6E56` |
| Accent | Amber `#EF9F27` |
| Font | Inter (Google Fonts) |
| Tone | Clean, analytical, minimal |

---

## 3. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router, TypeScript) |
| Styling | Tailwind CSS |
| Backend | Next.js API Routes |
| Database | MongoDB via Mongoose |
| AI | Google Gemini API (`gemini-1.5-flash`) |
| Hosting | Vercel (frontend + API) + MongoDB Atlas M0 free |
| Auth | None — single user, protect with `ADMIN_SECRET` env var as a simple header check |

---

## 4. MongoDB Schema

### Collection: `items`

```js
// models/Item.js
import mongoose from 'mongoose';

const ItemSchema = new mongoose.Schema({
  name:          { type: String, required: true },
  price:         { type: Number, required: true },
  funded:        { type: Number, default: 0 },
  zone:          { type: String, enum: ['incubator', 'definite'], required: true },
  tier:          { type: String, enum: ['high', 'mid', 'low'], default: null },
  status:        { type: String, enum: ['active', 'done', 'dropped'], default: 'active' },
  promoteAfter:  { type: Date, default: null },   // cool-off expiry date
  notes:         { type: String, default: '' },
  url:           { type: String, default: '' },
  imageUrl:      { type: String, default: '' },
  aiSuggested:   { type: Boolean, default: false },
  tags:          [String],
  addedAt:       { type: Date, default: Date.now },
});

export default mongoose.models.Item || mongoose.model('Item', ItemSchema);
```

### Collection: `funds`

```js
// models/Fund.js
import mongoose from 'mongoose';

const AllocationSchema = new mongoose.Schema({
  itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
  amount: { type: Number, required: true },
});

const FundSchema = new mongoose.Schema({
  amount:      { type: Number, required: true },
  source:      { type: String, default: 'manual' }, // e.g. "salary", "bonus"
  unallocated: { type: Number, required: true },
  allocations: [AllocationSchema],
  aiAssisted:  { type: Boolean, default: false },
  receivedAt:  { type: Date, default: Date.now },
});

export default mongoose.models.Fund || mongoose.model('Fund', FundSchema);
```

### Collection: `agentlogs`

```js
// models/AgentLog.js
import mongoose from 'mongoose';

const AgentLogSchema = new mongoose.Schema({
  type:      { type: String, enum: ['interrogate', 'allocate', 'categorise'] },
  itemId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Item', default: null },
  prompt:    { type: String },
  response:  { type: String },
  success:   { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.models.AgentLog || mongoose.model('AgentLog', AgentLogSchema);
```

---

## 5. Folder Structure

```
wyse/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                  ← Dashboard (both zones side by side)
│   ├── incubator/
│   │   └── page.tsx
│   ├── pipeline/
│   │   └── page.tsx
│   ├── funds/
│   │   └── page.tsx
│   └── api/
│       ├── items/
│       │   ├── route.ts          ← GET all, POST new item
│       │   └── [id]/
│       │       └── route.ts      ← GET one, PATCH, DELETE
│       ├── funds/
│       │   ├── route.ts          ← GET all, POST new fund entry
│       │   └── [id]/
│       │       └── route.ts      ← PATCH (add allocation)
│       └── ai/
│           ├── interrogate/route.ts
│           ├── allocate/route.ts
│           └── categorise/route.ts
├── models/
│   ├── Item.js
│   ├── Fund.js
│   └── AgentLog.js
├── lib/
│   ├── db.ts                     ← MongoDB connection singleton
│   ├── gemini.ts                 ← Gemini client wrapper with timeout + fallback
│   └── auth.ts                   ← Simple ADMIN_SECRET header check
├── components/
│   ├── ItemCard.tsx
│   ├── FundProgress.tsx
│   ├── AddItemModal.tsx
│   ├── AllocateFundsModal.tsx
│   └── AiBadge.tsx               ← Shows "AI suggested" tag
└── .env.local
    MONGODB_URI=...
    GEMINI_API_KEY=...
    ADMIN_SECRET=...
```

---

## 6. Environment Variables

```env
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster0.mongodb.net/wyse?retryWrites=true&w=majority
GEMINI_API_KEY=your_gemini_api_key_here
ADMIN_SECRET=some_long_random_string_you_choose
```

---

## 7. Core API Routes

### Items

| Method | Route | Action |
|---|---|---|
| GET | `/api/items` | Fetch all active items (optionally filter by `?zone=incubator`) |
| POST | `/api/items` | Create a new item |
| PATCH | `/api/items/[id]` | Update item (zone, tier, status, funded, etc.) |
| DELETE | `/api/items/[id]` | Soft delete (set status = "dropped") |

### Funds

| Method | Route | Action |
|---|---|---|
| GET | `/api/funds` | Fetch all fund entries |
| POST | `/api/funds` | Log new income |
| PATCH | `/api/funds/[id]` | Add allocations, reduce unallocated |

### AI (all POST, all wrapped in try/catch with 5s timeout)

| Method | Route | Action |
|---|---|---|
| POST | `/api/ai/interrogate` | Ask Gemini to challenge an incubator item |
| POST | `/api/ai/allocate` | Ask Gemini to suggest fund distribution |
| POST | `/api/ai/categorise` | Ask Gemini to parse a raw item name or URL |

---

## 8. UI Pages

### Dashboard (`/`)
- Two-column layout: **Incubator** (left) | **Definite Pipeline** (right)
- Top bar shows total saved vs total needed across all definite items
- Each item shows a progress bar (`funded / price`)
- "Add item" button opens `AddItemModal`
- "Log funds" button opens `AllocateFundsModal`

### Incubator view
- Cards sorted by `addedAt` descending
- Each card shows: name, price, days remaining on cool-off timer, AI challenge question (if one was generated)
- Actions: **Promote** (moves to definite, asks for tier), **Drop** (marks dropped), **Edit**

### Pipeline view
- Three columns: High / Mid / Low
- Each column sorted by funding % descending (nearly-funded items float to top)
- Each card: name, price, progress bar, funded amount, "Add funds" shortcut

### Funds view (`/funds`)
- Table of all fund entries
- Each row expandable to show how that deposit was allocated across items
- "Log new income" button

---

## 9. AI Layer — Gemini Integration

### Wrapper (lib/gemini.ts)

```ts
// Always wrap Gemini calls like this — timeout + fallback
export async function askGemini(prompt: string, timeoutMs = 5000): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);
    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
  } catch {
    return null; // Graceful fallback — caller handles null
  }
}
```

### AI Route: Interrogate

**Prompt template:**
```
You are a financial discipline assistant. A user has added an item to their impulse wishlist.

Item: "{name}"
Price: {price}
Their current High-tier savings goal: "{highTierGoal}" at {highTierProgress}% funded.

Ask ONE sharp, non-judgmental question that makes them justify this purchase logically.
The question must be under 30 words. Do not lecture. Just ask the question.
```

**Behaviour:** If Gemini returns null, the frontend skips the challenge UI and shows the item card normally.

### AI Route: Fund Allocation

**Prompt template:**
```
You are a savings allocation strategist. The user just received {amount} in unallocated funds.

Their Definite Pipeline items (name | price | already funded | tier):
{itemList}

Rules:
1. Prioritise completing items that are closest to 100% funded first (psychological win).
2. Distribute the remainder toward High-tier items.
3. Never allocate to Incubator items.
4. Return ONLY a JSON array: [{ "itemId": "...", "amount": number }, ...]
5. Total of all amounts must exactly equal {amount}.
```

**Behaviour:** If Gemini returns null or invalid JSON, the frontend opens the manual allocation modal instead.

### AI Route: Auto-Categorise

**Prompt template:**
```
The user pasted this text: "{rawInput}"

Extract the product name, estimate a realistic market price in LKR, and pick a tier.
Tier rules: high = over LKR 200,000, mid = LKR 50,000–200,000, low = under LKR 50,000.
Also suggest zone: "incubator" (impulse/new desire) or "definite" (they clearly need it).

Return ONLY valid JSON — no explanation, no markdown:
{ "name": "...", "price": number, "tier": "high"|"mid"|"low", "zone": "incubator"|"definite" }
```

---

## 10. Key Business Logic

### Cool-off Timer
- Default: 7 days for any new Incubator item
- Stored as `promoteAfter` date on the item
- Frontend shows "X days remaining" badge
- Promote button is **disabled** until `Date.now() >= promoteAfter`
- User can override (manual promote) with a confirmation dialog

### Fund Allocation Logic (manual fallback)
```
1. User logs income → creates Fund document with unallocated = amount
2. User picks items and enters amounts manually in AllocateFundsModal
3. On confirm → PATCH /api/funds/[id] with allocations array
4. Each item's `funded` field is incremented via PATCH /api/items/[id]
5. If item.funded >= item.price → set status = "done"
```

### Progress Calculation
```
percentage = Math.min(100, Math.round((item.funded / item.price) * 100))
```

---

## 11. Copilot Prompt Sequence

Use these prompts **in order** in GitHub Copilot Chat or your AI editor. Each builds on the last.

---

### Prompt 1 — MongoDB connection

```
Create a MongoDB connection singleton for a Next.js 14 app using Mongoose.
File: lib/db.ts
- Use MONGODB_URI from process.env
- Cache the connection on the global object to avoid hot-reload reconnections
- Export a default async function connectDB()
```

---

### Prompt 2 — Mongoose models

```
Create three Mongoose models for a Next.js app. Save each in the models/ folder.

1. models/Item.js — fields: name (String, required), price (Number, required),
   funded (Number, default 0), zone (enum: incubator/definite), tier (enum: high/mid/low, nullable),
   status (enum: active/done/dropped, default active), promoteAfter (Date, nullable),
   notes (String), url (String), imageUrl (String), aiSuggested (Boolean, default false),
   tags ([String]), addedAt (Date, default now)

2. models/Fund.js — fields: amount (Number), source (String, default manual),
   unallocated (Number), allocations ([{ itemId: ObjectId ref Item, amount: Number }]),
   aiAssisted (Boolean, default false), receivedAt (Date, default now)

3. models/AgentLog.js — fields: type (enum: interrogate/allocate/categorise),
   itemId (ObjectId ref Item, nullable), prompt (String), response (String),
   success (Boolean, default true), createdAt (Date, default now)

Use mongoose.models.X || mongoose.model() pattern to avoid recompile errors.
```

---

### Prompt 3 — Items API routes

```
Create Next.js 14 App Router API routes for items. Use TypeScript.

File: app/api/items/route.ts
- GET: fetch all items from MongoDB where status != "dropped". Support optional ?zone= query param.
  Call connectDB() first. Return JSON array.
- POST: create a new item. Body is JSON matching the Item schema.
  If zone is "incubator", automatically set promoteAfter = 7 days from now.

File: app/api/items/[id]/route.ts
- GET: fetch single item by _id
- PATCH: update any fields on the item (partial update using $set)
- DELETE: soft delete — set status = "dropped", do not remove from DB

Add a simple auth check: if request header "x-admin-secret" does not match
process.env.ADMIN_SECRET, return 401.
```

---

### Prompt 4 — Funds API routes

```
Create Next.js 14 App Router API routes for funds. Use TypeScript.

File: app/api/funds/route.ts
- GET: return all fund documents sorted by receivedAt descending, populate itemId in allocations
- POST: create a new Fund document. Body: { amount, source }. Set unallocated = amount.

File: app/api/funds/[id]/route.ts
- PATCH: accept body { allocations: [{ itemId, amount }] }
  For each allocation:
    1. Push to fund.allocations array
    2. Subtract amount from fund.unallocated
    3. Increment item.funded by amount using Item.findByIdAndUpdate
    4. If item.funded >= item.price, set item.status = "done"
  Save fund document. Return updated fund.

Use the same ADMIN_SECRET auth check.
```

---

### Prompt 5 — Gemini AI wrapper

```
Create lib/gemini.ts for a Next.js app.

Export an async function askGemini(prompt: string, timeoutMs = 5000): Promise<string | null>

- Call the Gemini 1.5 Flash REST API using fetch (not the SDK)
- Endpoint: https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={GEMINI_API_KEY}
- Use AbortController to enforce the timeout
- On any error (network, timeout, bad response), return null — never throw
- On success, return the text string from candidates[0].content.parts[0].text
- Log failures to console with the error reason
```

---

### Prompt 6 — AI API routes

```
Create three Next.js 14 API route files for the AI layer. All are POST routes.
Import askGemini from lib/gemini.ts and AgentLog from models/AgentLog.js.
All routes must save an AgentLog entry (success: true or false).
All routes return { result, aiAvailable: boolean }.
If askGemini returns null, set aiAvailable: false and return a fallback message.

1. app/api/ai/interrogate/route.ts
   Body: { itemId, name, price, highTierGoal, highTierProgress }
   Prompt: ask ONE sharp non-judgmental question (under 30 words) to justify the purchase.

2. app/api/ai/allocate/route.ts
   Body: { fundId, amount, items: [{ _id, name, price, funded, tier }] }
   Prompt: return JSON array of allocations [{ itemId, amount }].
   Parse the JSON. If parsing fails, set aiAvailable: false.

3. app/api/ai/categorise/route.ts
   Body: { rawInput }
   Prompt: return JSON { name, price, tier, zone }.
   Parse the JSON. If parsing fails, set aiAvailable: false.
```

---

### Prompt 7 — Dashboard page

```
Create app/page.tsx for the Wyse savings app using Next.js 14, TypeScript, Tailwind CSS.

Layout:
- Top bar: app name "Wyse", total funded vs total needed (sum across all definite items), a "Log Funds" button
- Two-column grid below: left = Incubator, right = Definite Pipeline
- Each column is a scrollable list of ItemCard components

Data fetching:
- Fetch /api/items on mount using useEffect + useState (client component)
- Split items into incubator and definite arrays by zone field

Incubator column:
- Each item shows name, price, cool-off countdown (days until promoteAfter), AI challenge question if present
- Promote button (disabled if cool-off not expired), Drop button

Pipeline column:
- Three sub-sections: High, Mid, Low
- Each item shows name, price, a progress bar (funded/price), "Add funds" button

Keep styling minimal and clean. Use teal (#0F6E56) as the primary color.
```

---

### Prompt 8 — AddItemModal component

```
Create components/AddItemModal.tsx for the Wyse app using TypeScript and Tailwind CSS.

Props: { onClose: () => void, onAdded: (item) => void }

Form fields:
- Name (text, required)
- Price (number, required)
- URL (text, optional)
- Zone selector: "Incubator" or "Definite Pipeline" (default Incubator)
- Tier selector (only shown when zone = Definite): High / Mid / Low
- Notes (textarea, optional)

On submit:
1. POST to /api/items with the form data
2. If zone is incubator, also POST to /api/ai/categorise with rawInput = name
   Show a small loading spinner on the name field while AI runs
   If AI returns a result, pre-fill price and tier fields (user can override)
   If AI is unavailable, show a subtle "AI unavailable" badge and continue normally
3. Call onAdded with the created item and close the modal

Include the x-admin-secret header on all fetch calls (read from a client-side env var NEXT_PUBLIC_ADMIN_SECRET).
```

---

### Prompt 9 — AllocateFundsModal component

```
Create components/AllocateFundsModal.tsx using TypeScript and Tailwind CSS.

Props: { fund: Fund, items: Item[], onClose: () => void, onAllocated: () => void }

Behaviour:
1. On open, POST to /api/ai/allocate with the fund and definite pipeline items
   Show a loading state while AI runs
   If AI returns suggestions, pre-fill the allocation inputs with suggested amounts
   Show a badge "AI suggested — you can edit" next to each pre-filled field
   If AI unavailable, skip pre-fill and show "Fill manually" label

2. Display a list of definite pipeline items with an amount input next to each
   Show current funded % next to each item name
   Show a running total of allocated vs available at the bottom
   Prevent submission if total allocated > fund.unallocated

3. On confirm: PATCH /api/funds/[fund._id] with the allocations array
   Call onAllocated and close modal
```

---

## 12. Deployment Checklist

- [ ] Create MongoDB Atlas cluster (M0 free), whitelist `0.0.0.0/0` for Vercel
- [ ] Add all three env vars to Vercel project settings
- [ ] Set `NEXT_PUBLIC_ADMIN_SECRET` in Vercel for client-side fetch headers
- [ ] Deploy via `vercel --prod` or connect GitHub repo
- [ ] Test Gemini quota fallback by temporarily setting a wrong API key

---

## 13. Future Ideas (not in v1)

- Weekly savings summary email (Resend API)
- Item images via URL scraping (Cheerio)
- Mobile PWA manifest
- Dark mode toggle
- Export wishlist as PDF
