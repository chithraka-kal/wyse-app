# Wyse — Spend With Intention

> **Wyse** is a personal goal-oriented savings, wishlist, and intentional spending application. It serves as a smart shopping queue that helps you evaluate impulse purchases, organize desires, track dedicated savings, and answer the core question: **"What should I buy next with the money I have?"**

---

## 🌟 Core Concepts & Zones

Wyse categorizes your goals into distinct zones to prevent impulse spending and keep your savings organized:

1. **⚡ Flash Items**: Quick capture zone for rapid thoughts, notes, or instant items. Price is **optional** for Flash items.
2. **Wishlist**: A cooling-off queue for items you're considering buying before committing.
3. **Saving For**: Your active, committed queue divided automatically into price-based tiers:
   - **Big Tier**: LKR 200+
   - **Medium Tier**: LKR 50 – 199
   - **Small Tier**: Under LKR 50
4. **Completed**: Archive of fully funded and intentional goals achieved.

---

## ✨ Features

- **Multi-User Authentication**: Secure user registration, sign-in, and session management powered by non-blocking asynchronous PBKDF2 (SHA-512) password hashing and HMAC-signed session cookies.
- **Smart "Buy Next" Recommendation Engine**: Calculates the optimal next purchase based on item priority (Urgent, Normal, Low), funding progress percentage, tier weight, and item age.
- **Full Item Editing & Management**: Inline creation, editing (name, price, priority, zone, URL, notes), zone promotion, quick fund additions, and item removal.
- **Income Logging & Fund Allocation**: Log income or savings deposits and distribute funds across active savings goals manually or with AI assistance.
- **AI-Powered Assistance (Google Gemini API)**:
  - **Categorization**: Auto-extracts item price and priority from natural language input.
  - **Interrogation**: Asks impulse challenge questions before committing items to savings.
  - **Smart Allocation**: Suggests optimal money distribution across saving targets.
- **Custom Boards & Drag-and-Drop**: Organize items into custom collections with mobile-friendly drag-and-drop mechanics using `@dnd-kit`.

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org/) (App Router, React 19, TypeScript)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Database**: [MongoDB](https://www.mongodb.com/) via [Mongoose](https://mongoosejs.com/)
- **Authentication**: Custom HMAC-signed cookies & `crypto.pbkdf2`
- **AI Integration**: [Google Gemini API](https://ai.google.dev/) (`@google/genai`)

---

## 📁 Project Structure

```text
Wyse - App/
├── app/
│   ├── api/
│   │   ├── ai/             # AI endpoints (allocate, categorise, interrogate)
│   │   ├── auth/           # Auth routes (login, register, me, logout)
│   │   ├── boards/         # Board management endpoints
│   │   ├── funds/          # Fund management endpoints
│   │   └── items/          # Item CRUD endpoints
│   ├── boards/             # Custom drag-and-drop boards page
│   ├── layout.tsx          # Root layout
│   └── page.tsx            # Main interactive dashboard
├── components/
│   ├── AddItemModal.tsx    # Create item modal
│   ├── AllocateFundsModal.tsx # Income allocation modal
│   ├── EditItemModal.tsx   # Edit item modal
│   ├── FundProgress.tsx    # Progress bar component
│   └── ItemCard.tsx        # Flexible item card (Flash, Wishlist, Saving For)
├── lib/
│   ├── auth.ts             # Auth session & context helpers
│   ├── buyNext.ts          # "Buy Next" algorithm
│   ├── db.ts               # Mongoose connection caching
│   ├── gemini.ts           # Gemini API client
│   ├── password.ts         # Async PBKDF2 password hashing
│   └── tierFromPrice.ts    # Auto-tier calculator helper
├── models/
│   ├── Board.js            # Mongoose Board schema
│   ├── Fund.js             # Mongoose Fund schema
│   ├── Item.js             # Mongoose Item schema
│   └── User.js             # Mongoose User schema
├── types/
│   └── wyse.ts             # TypeScript interfaces & types
└── README.md
```

---

## 🔌 API Endpoints Summary

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Register a new user account |
| `POST` | `/api/auth/login` | Authenticate user & set session cookie |
| `GET` | `/api/auth/me` | Fetch currently authenticated user session |
| `POST` | `/api/auth/logout` | Clear session cookie |
| `GET` | `/api/items` | List active items filtered by user and optional zone |
| `POST` | `/api/items` | Create a new item (Flash, Wishlist, or Saving For) |
| `PATCH` | `/api/items/:id` | Update item details, zone, priority, or board |
| `DELETE` | `/api/items/:id` | Soft-delete / mark item as removed |
| `GET` | `/api/funds` | Fetch logged funds and allocations |
| `POST` | `/api/funds` | Log new savings or income deposit |
| `GET` | `/api/boards` | Fetch custom boards for the user |
| `POST` | `/api/boards` | Create a new custom board |
| `PATCH` | `/api/boards/:id` | Rename a custom board |
| `DELETE` | `/api/boards/:id` | Delete a board (unassigns its items) |
| `POST` | `/api/ai/categorise` | AI item extraction & price estimation |
| `POST` | `/api/ai/interrogate` | Generate AI impulse challenge questions |
| `POST` | `/api/ai/allocate` | AI fund allocation recommendation |

---

## 🗄️ Database Relations

The application uses MongoDB (via Mongoose) with the following relational structures:

- **User**: The root entity. Has a one-to-many relationship with `Item`, `Fund`, and `Board`. Every document in the system maps back to a specific `userId`.
- **Item**: Belongs to a `User`. Optionally contains a `boardId` referencing a `Board` to place it in a custom collection. Tracks price, funded amount, zone, and tier.
- **Fund**: Belongs to a `User`. Represents a pool of money (e.g. income or savings deposit) that can be allocated to items. Contains an array of `allocations` storing the `itemId` and the `amount` contributed to that item.
- **Board**: Belongs to a `User`. Acts as a custom categorical grouping for `Item`s. When a board is deleted, related items are safely unassigned (their `boardId` is set to null).

---

## ⚙️ Environment Variables

Create a `.env` file in the project root:

```env
# MongoDB Connection String
MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/wyse?retryWrites=true&w=false

# Session Security Secret
SESSION_SECRET=your-secure-random-session-secret

# Google Gemini API Key (Optional for AI features)
GEMINI_API_KEY=your-gemini-api-key
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18.x or later
- npm or yarn
- MongoDB database instance (Local or MongoDB Atlas)

### Installation & Local Setup

1. **Clone the repository and install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment variables**:
   Create a `.env` file following `.env.example` or the specification above.

3. **Run the development server**:
   ```bash
   npm run dev
   ```

4. **Open the App**:
   Navigate to [http://localhost:3000](http://localhost:3000) in your browser.

5. **Build for Production**:
   ```bash
   npm run build
   npm run start
   ```

---

## 📄 License

MIT License. Designed for intentional spending and goal savings.
