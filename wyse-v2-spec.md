# Wyse v2 — Revised Business Logic & Refactor Spec

> This document is a **refactor guide** on top of the existing working codebase.
> Do not rebuild from scratch — apply the changes described here to the existing files.

---

## 1. The Core Mental Model (read this first)

Wyse works like a smart shopping queue, not a budget tracker.

1. **Something pops into your head** → dump it into the Wishlist instantly, no thinking required.
2. **You decide you actually want it** → move it to "Saving For" (your committed queue).
3. **The app tells you what to buy next** → based on priority, age, and price.
4. **You add savings whenever you have money** → the app shows your progress and ETA.

That's it. The app's job is to answer one question at all times:
> **"What should I buy next with the money I have?"**

---

## 2. Rename Map (apply everywhere — DB fields, UI labels, API responses, comments)

| Old name | New name | Where it appears |
|---|---|---|
| `zone: "incubator"` | `zone: "wishlist"` | DB field, API filter, UI |
| `zone: "definite"` | `zone: "saving"` | DB field, API filter, UI |
| `tier: "high"` | `tier: "big"` | DB field, UI label |
| `tier: "mid"` | `tier: "medium"` | DB field, UI label |
| `tier: "low"` | `tier: "small"` | DB field, UI label |
| "Incubator" (UI heading) | **"Wishlist"** | Dashboard, page headings |
| "Definite Pipeline" (UI heading) | **"Saving For"** | Dashboard, page headings |
| "Promote" (button) | **"Start Saving"** | ItemCard button |
| "Drop" (button) | **"Remove"** | ItemCard button |
| "Log Funds" (button) | **"Add Savings"** | Dashboard top bar |
| `promoteAfter` (field) | **remove entirely** | DB schema, API logic |
| Cool-off countdown UI | **remove entirely** | ItemCard |
| `addedAt` | keep, rename display to "on wishlist since" | ItemCard |

---

## 3. Mongoose Model Changes

### models/Item.js — apply these changes

```js
// REMOVE this field entirely:
promoteAfter: { type: Date, default: null }

// CHANGE enum values:
zone: { type: String, enum: ['wishlist', 'saving'], required: true }
tier: { type: String, enum: ['big', 'medium', 'small'], default: null }

// ADD this new field:
priority: { type: Number, enum: [1, 2, 3], default: 2 }
// 1 = urgent, 2 = normal, 3 = low — user sets this manually

// tier is now AUTO-SET by price on the server (do not accept tier from client):
// price >= 200  → tier = 'big'
// price 50–199  → tier = 'medium'
// price < 50    → tier = 'small'
```

### Full updated Item schema for reference

```js
const ItemSchema = new mongoose.Schema({
  name:        { type: String, required: true },
  price:       { type: Number, required: true },
  funded:      { type: Number, default: 0 },
  zone:        { type: String, enum: ['wishlist', 'saving'], required: true },
  tier:        { type: String, enum: ['big', 'medium', 'small'], default: null },
  status:      { type: String, enum: ['active', 'done', 'removed'], default: 'active' },
  priority:    { type: Number, enum: [1, 2, 3], default: 2 },
  notes:       { type: String, default: '' },
  url:         { type: String, default: '' },
  imageUrl:    { type: String, default: '' },
  aiSuggested: { type: Boolean, default: false },
  tags:        [String],
  addedAt:     { type: Date, default: Date.now },
});
```

> Note: `status: "dropped"` is renamed to `status: "removed"` — update all references.

---

## 4. Auto-Tier Logic (server-side, in API route)

Whenever an item is created or its price is updated, auto-calculate tier on the server.
**Never accept `tier` from the client request body.**

```ts
// lib/tierFromPrice.ts — create this helper
export function tierFromPrice(price: number): 'big' | 'medium' | 'small' {
  if (price >= 200) return 'big';
  if (price >= 50)  return 'medium';
  return 'small';
}
```

Apply in `POST /api/items` and `PATCH /api/items/[id]` (when price changes):

```ts
import { tierFromPrice } from '@/lib/tierFromPrice';

// In POST handler:
const tier = tierFromPrice(body.price);
const item = await Item.create({ ...body, tier, promoteAfter: undefined });

// In PATCH handler (if price is being updated):
if (body.price !== undefined) {
  body.tier = tierFromPrice(body.price);
}
```

---

## 5. "Start Saving" Flow (replaces Promote + cool-off)

Remove all `promoteAfter` date logic. Replace with a simple one-step confirmation.

**Old flow:** Promote button disabled until cool-off expires → user confirms tier manually.

**New flow:** "Start Saving" button always enabled → one confirmation dialog → item moves to Saving For zone with auto-calculated tier.

```ts
// PATCH /api/items/[id] — Start Saving action
// Client sends: { zone: 'saving' }
// Server sets:  zone = 'saving', tier = tierFromPrice(item.price) (recalculate)
// No promoteAfter logic anywhere
```

UI change in `components/ItemCard.tsx`:
- Remove the days-remaining countdown
- Remove the disabled state on the Promote button
- Rename button to "Start Saving"
- On click: show a simple confirm dialog — *"Move [name] to Saving For?"* → on confirm call PATCH

---

## 6. Priority Field — UI

Add a priority selector to `components/AddItemModal.tsx` and item edit flow.

```
Priority:  [ ! Urgent ]  [ • Normal ]  [ ↓ Low ]
           priority=1     priority=2    priority=3
```

- Default: Normal (2)
- Display as three toggle buttons, not a dropdown
- Show a small priority indicator on each ItemCard in the "Saving For" section:
  - priority=1 → amber dot + "Urgent" label
  - priority=2 → no label (normal, don't clutter)
  - priority=3 → grey dot + "Low priority" label

---

## 7. "Buy Next" Algorithm — The Core Feature

This is the most important business logic. It lives in a shared utility and drives the main recommendation shown at the top of the dashboard.

### lib/buyNext.ts — create this file

```ts
import { Item } from '@/types/wyse';

export function scoreSavingItem(item: Item, now: Date = new Date()): number {
  // Lower score = should buy sooner

  // Factor 1: Priority (most important)
  const priorityScore = item.priority * 1000;  // 1000, 2000, or 3000

  // Factor 2: Age on list — older items float up
  // Every 7 days on the saving list subtracts 100 from score
  const ageInDays = (now.getTime() - new Date(item.addedAt).getTime()) / (1000 * 60 * 60 * 24);
  const ageScore = -(Math.floor(ageInDays / 7) * 100);

  // Factor 3: Price — cheaper items float up within same priority
  // Divide price by 10 to make it a tiebreaker, not a dominant factor
  const priceScore = item.price / 10;

  return priorityScore + ageScore + priceScore;
}

export function getBuyNextItem(savingItems: Item[]): Item | null {
  const active = savingItems.filter(i => i.status === 'active' && i.zone === 'saving');
  if (active.length === 0) return null;

  return active.sort((a, b) => scoreSavingItem(a) - scoreSavingItem(b))[0];
}

export function getDaysUntilAffordable(item: Item, totalSavings: number, weeklyContribution: number): number | null {
  const remaining = item.price - item.funded;
  const gap = remaining - totalSavings;
  if (gap <= 0) return 0;  // already affordable
  if (weeklyContribution <= 0) return null;  // no saving pace set
  return Math.ceil((gap / weeklyContribution) * 7);  // days
}
```

### Dashboard — "Buy Next" banner

Add a highlighted banner at the top of the dashboard (above both columns) showing:

```
┌─────────────────────────────────────────────────────┐
│  🎯 Buy next:  Sony WH-1000XM5                      │
│  $280.00 · 91% funded · $20.00 remaining            │
│  [Add Savings →]                                    │
└─────────────────────────────────────────────────────┘
```

- If the item is already 100% funded → show "✅ Ready to buy! [name]"
- If Saving For is empty → show "Add items to start saving"
- This banner always reflects the result of `getBuyNextItem()`

---

## 8. Savings Pool — Simplified

Remove the per-deposit Fund document complexity from the UI.
The Fund collection stays in the DB for history, but the user experience is simplified.

**Old UX:** Log funds → open AllocateFundsModal → manually assign amounts per item.

**New UX:**
1. User taps "Add Savings" → enters amount and optional note (e.g. "April salary")
2. App creates a Fund document (unallocated = amount) — same as before
3. App immediately shows the "Buy Next" item and asks: *"Apply $X toward [item name]?"*
4. User can: **Apply all**, **Apply partial** (enter custom amount), or **Skip** (leave unallocated)
5. If skipped, unallocated savings sit in a visible "Available savings: $X" counter on the dashboard

**New field needed — app-level savings pool:**
Instead of summing across Fund documents each time, track a single `availableSavings` value.
The simplest approach: compute it on the fly:

```ts
// lib/getSavingsPool.ts
// availableSavings = sum of all Fund.unallocated across all Fund documents
export async function getAvailableSavings(): Promise<number> {
  const result = await Fund.aggregate([
    { $group: { _id: null, total: { $sum: '$unallocated' } } }
  ]);
  return result[0]?.total ?? 0;
}
```

Show this prominently: **"Available savings: $X.XX"** in the top bar next to "Add Savings".

---

## 9. Dashboard Layout Changes (app/page.tsx)

### Top bar
```
WYSE  |  Available savings: $45.00  |  [Add Savings]  [Add Item]
```

### Buy Next banner (new — add below top bar)
- Uses `getBuyNextItem()` on the sorted Saving For items
- Shows item name, price, funded %, remaining amount
- "Add Savings" button on the banner links directly to the add savings flow for that item

### Wishlist section (left column, was Incubator)
- Header: **"Wishlist"**
- Subheader: *"Things you're thinking about"*
- Each card shows: name, price, tier badge (Big/Medium/Small), priority, "on list since X days"
- Actions: **"Start Saving"** (teal button), **"Remove"** (ghost button)
- No countdown. No disabled states.

### Saving For section (right column, was Definite Pipeline)
- Header: **"Saving For"**
- Subheader: *"Things you've committed to buying"*
- Sort order: by score from `getBuyNextItem()` algorithm — top item = recommended next
- Each card shows: name, price, progress bar, funded amount, priority badge
- First card gets a subtle "⭐ Next up" highlight
- Three sub-groups: Big / Medium / Small (collapsible)
- Actions: **"Add funds"** button per item (quick allocate from available savings)

---

## 10. Updated API Route Changes

### POST /api/items
```ts
// Changes:
// 1. Remove promoteAfter logic entirely
// 2. Auto-calculate tier from price
// 3. Accept priority (1|2|3, default 2) from body
// 4. zone default should be 'wishlist' if not provided

const tier = tierFromPrice(body.price);
const item = await Item.create({
  name: body.name,
  price: body.price,
  zone: body.zone ?? 'wishlist',
  priority: body.priority ?? 2,
  tier,
  notes: body.notes,
  url: body.url,
});
```

### PATCH /api/items/[id]
```ts
// Changes:
// 1. Remove any promoteAfter logic
// 2. If price is in body, recalculate tier
// 3. If zone changes to 'saving', recalculate tier from current price
// 4. Rename status 'dropped' → 'removed'

if (body.price !== undefined) body.tier = tierFromPrice(body.price);
if (body.zone === 'saving' && !body.tier) {
  const current = await Item.findById(params.id);
  body.tier = tierFromPrice(current.price);
}
```

### DELETE /api/items/[id]
```ts
// Change: status = 'removed' (was 'dropped')
await Item.findByIdAndUpdate(params.id, { $set: { status: 'removed' } });
```

### GET /api/items
```ts
// Change: filter status != 'removed' (was 'dropped')
Item.find({ status: { $ne: 'removed' }, ...zoneFilter })
```

### POST /api/funds (new simplified endpoint behaviour)
```ts
// Body: { amount: number, note?: string, applyToItemId?: string, applyAmount?: number }
// 1. Create Fund with unallocated = amount
// 2. If applyToItemId and applyAmount provided, immediately allocate:
//    - Push allocation to fund.allocations
//    - Increment item.funded
//    - Set item.status = 'done' if funded >= price
//    - Decrement fund.unallocated
```

---

## 11. AI Prompt Updates

Update the Gemini prompts to use the new language.

### /api/ai/interrogate — update prompt
```
You are a mindful spending assistant. A user added an item to their Wishlist.

Item: "{name}"
Price: ${price} ({tier} purchase)
Priority they set: {priority === 1 ? 'Urgent' : priority === 3 ? 'Low' : 'Normal'}

Ask ONE short, non-judgmental question (under 25 words) that helps them decide
if this is something they genuinely want or just an impulse.
```

### /api/ai/allocate — update prompt
```
You are a savings advisor. The user has ${availableSavings} in available savings.

Their "Saving For" list (name | price | already saved | priority | tier):
{itemList}

Rules:
1. Recommend which ONE item they should put money toward next.
2. Suggest how much of the ${availableSavings} to apply.
3. Prioritise: urgent priority first, then oldest on list, then cheapest.
4. Return ONLY JSON: { "itemId": "...", "recommendedAmount": number, "reason": "one sentence" }
```

### /api/ai/categorise — update prompt (minor wording change)
```
The user wants to add this item to their Wishlist: "{rawInput}"

Extract the product name and estimate a realistic market price in USD.
Suggest a starting priority: 1 (urgent/needed), 2 (want it), 3 (nice to have).

Return ONLY valid JSON — no markdown, no explanation:
{ "name": "...", "price": number, "priority": 1|2|3 }

Note: Do not include tier — it is calculated automatically from price.
```

---

## 12. Copilot Refactor Prompts

Use these prompts in order in Copilot Chat.

---

### Refactor Prompt 1 — Mongoose model update

```
Refactor models/Item.js in the Wyse Next.js project.

Changes to apply:
1. Change zone enum from ['incubator', 'definite'] to ['wishlist', 'saving']
2. Change tier enum from ['high', 'mid', 'low'] to ['big', 'medium', 'small']
3. Change status enum from ['active', 'done', 'dropped'] to ['active', 'done', 'removed']
4. Remove the promoteAfter field entirely
5. Add priority field: { type: Number, enum: [1, 2, 3], default: 2 }

Do not change any other fields. Keep aiSuggested, addedAt, tags, notes, url, imageUrl.
Update mongoose.model() call to keep the same collection name 'items'.
```

---

### Refactor Prompt 2 — Create tierFromPrice helper

```
Create a new file lib/tierFromPrice.ts in the Wyse Next.js project.

Export a single function:
  tierFromPrice(price: number): 'big' | 'medium' | 'small'

Logic:
  price >= 200 → 'big'
  price >= 50  → 'medium'
  price < 50   → 'small'
```

---

### Refactor Prompt 3 — Create buyNext utility

```
Create a new file lib/buyNext.ts in the Wyse Next.js project.

Import the Item type from types/wyse.ts.

Export three functions:

1. scoreSavingItem(item: Item, now?: Date): number
   - priorityScore = item.priority * 1000
   - ageScore = -(Math.floor(ageInDays / 7) * 100)  where ageInDays = days since addedAt
   - priceScore = item.price / 10
   - return priorityScore + ageScore + priceScore

2. getBuyNextItem(savingItems: Item[]): Item | null
   - Filter to active items in zone 'saving'
   - Sort by scoreSavingItem ascending
   - Return the first item or null

3. getDaysUntilAffordable(item: Item, availableSavings: number, weeklyContribution: number): number | null
   - remaining = item.price - item.funded
   - gap = remaining - availableSavings
   - if gap <= 0 return 0
   - if weeklyContribution <= 0 return null
   - return Math.ceil((gap / weeklyContribution) * 7)
```

---

### Refactor Prompt 4 — Update API items routes

```
Refactor app/api/items/route.ts and app/api/items/[id]/route.ts in the Wyse project.

Changes for route.ts (POST handler):
1. Import tierFromPrice from lib/tierFromPrice
2. Remove all promoteAfter logic
3. Auto-calculate tier = tierFromPrice(body.price) — never accept tier from client
4. Accept priority (number, default 2) from body
5. Default zone to 'wishlist' if not provided

Changes for route.ts (GET handler):
1. Change status filter from 'dropped' to 'removed'

Changes for [id]/route.ts (PATCH handler):
1. Remove all promoteAfter logic
2. If body.price exists, recalculate body.tier = tierFromPrice(body.price)
3. If body.zone === 'saving' and tier not set, fetch current item price and recalculate tier

Changes for [id]/route.ts (DELETE handler):
1. Change status from 'dropped' to 'removed'

Keep all requireAdmin() auth checks. Keep all other logic unchanged.
```

---

### Refactor Prompt 5 — Update ItemCard component

```
Refactor components/ItemCard.tsx in the Wyse project.

Rename changes:
1. Remove the days-remaining countdown display entirely (no more promoteAfter)
2. Rename "Promote" button to "Start Saving"
3. Remove disabled state from the Start Saving button (always enabled)
4. Add a confirm dialog on "Start Saving" click: "Move [item.name] to Saving For?" with Confirm/Cancel
5. Rename "Drop" button to "Remove"
6. Replace tier display: show "Big" / "Medium" / "Small" badge instead of "High" / "Mid" / "Low"

New UI additions:
7. Show priority indicator on Saving For items only:
   - priority 1 → small amber dot + text "Urgent"
   - priority 2 → nothing (don't clutter normal items)
   - priority 3 → small grey dot + text "Low priority"
8. Show "⭐ Next up" badge on the item if it receives a prop: isNextUp={true}
9. Show "on wishlist since X days" on wishlist items (calculate from addedAt)

Keep all existing props. Add optional prop: isNextUp?: boolean
```

---

### Refactor Prompt 6 — Update AddItemModal

```
Refactor components/AddItemModal.tsx in the Wyse project.

Changes:
1. Remove the tier selector entirely (tier is now auto-calculated server-side)
2. Add a priority selector — three toggle buttons side by side:
   [! Urgent]  [• Normal]  [↓ Low]
   These map to values 1, 2, 3. Default selected: Normal (2).
3. Default zone to 'wishlist' (rename any 'incubator' references to 'wishlist')
4. Update the AI categorise response handling — the response no longer includes tier,
   only name, price, and priority. Pre-fill price and priority from AI response.
5. Update any zone/tier labels in the UI to use the new naming.

Keep the URL field, notes field, and all AI categorise fetch logic.
```

---

### Refactor Prompt 7 — Dashboard buy-next banner + layout

```
Refactor app/page.tsx (Dashboard) in the Wyse project.

Import getBuyNextItem from lib/buyNext.

Layout changes:
1. Top bar: show "Available savings: $X.XX" (sum of unallocated across all funds — fetch from /api/funds)
   alongside the "Add Savings" and "Add Item" buttons.

2. Add a "Buy Next" banner below the top bar, above the two columns.
   Use the result of getBuyNextItem(definiteItems) — rename to getBuyNextItem(savingItems).
   Banner content:
   - If item found: "🎯 Buy next: [name] · $[price] · [funded%]% funded · $[remaining] remaining"
     with an "Add Savings →" button
   - If item funded >= price: "✅ Ready to buy! [name]"
   - If no saving items: "Add items to Saving For to get a recommendation"

3. Rename left column heading "Incubator" → "Wishlist"
   Add subheading: "Things you're thinking about"

4. Rename right column heading "Definite Pipeline" → "Saving For"
   Add subheading: "Things you've committed to buying"

5. In the Saving For column, pass isNextUp={true} to the first ItemCard
   (the one matching getBuyNextItem result).

6. Rename all variable names: incubatorItems → wishlistItems, definiteItems → savingItems

Keep all existing fetch logic and action handlers. Update zone values in PATCH calls:
'incubator' → 'wishlist', 'definite' → 'saving'.
```

---

## 13. types/wyse.ts — update shared types

```ts
// Apply these changes to types/wyse.ts

export type Zone = 'wishlist' | 'saving';           // was 'incubator' | 'definite'
export type Tier = 'big' | 'medium' | 'small';      // was 'high' | 'mid' | 'low'
export type Status = 'active' | 'done' | 'removed'; // was 'active' | 'done' | 'dropped'
export type Priority = 1 | 2 | 3;

export interface Item {
  _id: string;
  name: string;
  price: number;
  funded: number;
  zone: Zone;
  tier: Tier | null;
  status: Status;
  priority: Priority;
  notes: string;
  url: string;
  imageUrl: string;
  aiSuggested: boolean;
  tags: string[];
  addedAt: string;
  // promoteAfter removed
}

// Fund and FundAllocation stay the same
```

---

## 14. Quick Search & Replace Reference

Run these find-and-replace operations across the whole codebase after applying Copilot prompts:

| Find | Replace | Files |
|---|---|---|
| `"incubator"` | `"wishlist"` | All .ts .tsx .js |
| `"definite"` | `"saving"` | All .ts .tsx .js |
| `"high"` (tier context) | `"big"` | All .ts .tsx .js |
| `"mid"` | `"medium"` | All .ts .tsx .js |
| `"low"` (tier context) | `"small"` | All .ts .tsx .js |
| `"dropped"` | `"removed"` | All .ts .tsx .js |
| `incubatorItems` | `wishlistItems` | .ts .tsx |
| `definiteItems` | `savingItems` | .ts .tsx |
| `Incubator` (UI string) | `Wishlist` | .tsx |
| `Definite Pipeline` (UI string) | `Saving For` | .tsx |
| `Promote` (button label) | `Start Saving` | .tsx |
| `Drop` (button label) | `Remove` | .tsx |
| `Log Funds` (button label) | `Add Savings` | .tsx |
| `promoteAfter` | *(delete the line)* | .ts .tsx .js |

---

## 15. MongoDB Migration Note

The existing documents in MongoDB still have old enum values (`incubator`, `definite`, `high`, `mid`, `low`, `dropped`).
Run this one-time migration script after deploying the code changes.

```js
// Run in MongoDB Atlas Data Explorer or via mongosh

// Fix zone values
db.items.updateMany({ zone: 'incubator' }, { $set: { zone: 'wishlist' } });
db.items.updateMany({ zone: 'definite' },  { $set: { zone: 'saving' } });

// Fix tier values
db.items.updateMany({ tier: 'high' }, { $set: { tier: 'big' } });
db.items.updateMany({ tier: 'mid' },  { $set: { tier: 'medium' } });
db.items.updateMany({ tier: 'low' },  { $set: { tier: 'small' } });

// Fix status values
db.items.updateMany({ status: 'dropped' }, { $set: { status: 'removed' } });

// Add priority field to existing documents (default to 2 = normal)
db.items.updateMany({ priority: { $exists: false } }, { $set: { priority: 2 } });

// Remove promoteAfter field from all documents
db.items.updateMany({}, { $unset: { promoteAfter: '' } });
```
