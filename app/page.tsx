"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import AddItemModal from "@/components/AddItemModal";
import AllocateFundsModal from "@/components/AllocateFundsModal";
import ItemCard from "@/components/ItemCard";
import { getBuyNextItem } from "@/lib/buyNext";
import { Fund, Item } from "@/types/wyse";

type SessionUser = {
  _id: string;
  username: string;
  displayName: string;
};

export default function Home() {
  const [items, setItems] = useState<Item[]>([]);
  const [funds, setFunds] = useState<Fund[]>([]);
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [showAddItem, setShowAddItem] = useState(false);
  const [allocationAmount, setAllocationAmount] = useState<number | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authForm, setAuthForm] = useState({
    displayName: "",
    username: "",
    password: "",
  });

  const wishlistItems = useMemo(
    () =>
      items
        .filter((item) => item.zone === "wishlist" && item.status === "active")
        .sort((a, b) => +new Date(b.addedAt) - +new Date(a.addedAt)),
    [items],
  );

  const savingItems = useMemo(
    () =>
      items
        .filter((item) => item.zone === "saving" && item.status === "active")
        .sort((a, b) => {
          const ap = a.price > 0 ? a.funded / a.price : 0;
          const bp = b.price > 0 ? b.funded / b.price : 0;
          return bp - ap;
        }),
    [items],
  );

  const completedItems = useMemo(
    () =>
      items
        .filter((item) => item.status === "done")
        .sort((a, b) => +new Date(b.addedAt) - +new Date(a.addedAt)),
    [items],
  );

  const totals = useMemo(() => {
    const totalNeeded = savingItems.reduce((sum, item) => sum + item.price, 0);
    const totalFunded = savingItems.reduce((sum, item) => sum + item.funded, 0);
    return { totalNeeded, totalFunded };
  }, [savingItems]);

  const availableSavings = useMemo(
    () => funds.reduce((sum, fund) => sum + (fund.unallocated || 0), 0),
    [funds],
  );

  const nextUpItem = useMemo(() => getBuyNextItem(savingItems), [savingItems]);

  async function loadItems() {
    try {
      const response = await fetch("/api/items", {
      });
      if (!response.ok) {
        throw new Error("Failed to load items");
      }
      const data = (await response.json()) as Item[];
      setItems(data);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadFunds() {
    try {
      const response = await fetch("/api/funds", {
      });
      if (!response.ok) {
        throw new Error("Failed to load funds");
      }
      const data = (await response.json()) as Fund[];
      setFunds(data);
    } catch {
      setFunds([]);
    }
  }

  useEffect(() => {
    async function loadCurrentUser() {
      try {
        const response = await fetch("/api/auth/me");
        if (!response.ok) {
          setCurrentUser(null);
          return;
        }

        const data = (await response.json()) as { user: SessionUser };
        setCurrentUser(data.user);
      } catch {
        setCurrentUser(null);
      } finally {
        setAuthLoading(false);
      }
    }

    void loadCurrentUser();
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setItems([]);
      setFunds([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function init() {
      setLoading(true);
      try {
        const [itemsResponse, fundsResponse] = await Promise.all([
          fetch("/api/items", {
          }),
          fetch("/api/funds", {
          }),
        ]);

        if (!itemsResponse.ok || !fundsResponse.ok || cancelled) {
          throw new Error("Failed to load items");
        }

        const [itemsData, fundsData] = await Promise.all([
          itemsResponse.json() as Promise<Item[]>,
          fundsResponse.json() as Promise<Fund[]>,
        ]);

        if (!cancelled) {
          setItems(itemsData);
          setFunds(fundsData);
        }
      } catch {
        if (!cancelled) {
          setItems([]);
          setFunds([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void init();

    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthSubmitting(true);
    setAuthError(null);

    try {
      const endpoint = authMode === "login" ? "/api/auth/login" : "/api/auth/register";
      const payload =
        authMode === "login"
          ? {
              username: authForm.username,
              password: authForm.password,
            }
          : {
              displayName: authForm.displayName,
              username: authForm.username,
              password: authForm.password,
            };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Authentication failed");
      }

      setCurrentUser(data.user as SessionUser);
      setAuthForm({ displayName: "", username: "", password: "" });
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Authentication failed");
    } finally {
      setAuthSubmitting(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setCurrentUser(null);
    setItems([]);
    setFunds([]);
    setAllocationAmount(null);
  }

  async function handleStartSaving(item: Item) {
    await fetch(`/api/items/${item._id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ zone: "saving" }),
    });

    await loadItems();
  }

  async function handleRemove(item: Item) {
    await fetch(`/api/items/${item._id}`, {
      method: "DELETE",
      headers: {},
    });

    await loadItems();
  }

  async function handleOpenAllocateModal() {
    const amountInput = window.prompt("How much income do you want to log?", "100");
    if (!amountInput) return;

    const amount = Number(amountInput);
    if (!Number.isFinite(amount) || amount <= 0) {
      alert("Please enter a valid amount.");
      return;
    }

    setAllocationAmount(amount);
  }

  async function handleQuickAddFunds(item: Item) {
    const amountInput = window.prompt(`Add funds to ${item.name}`, "25");
    if (!amountInput) return;

    const amount = Number(amountInput);
    if (!Number.isFinite(amount) || amount <= 0) {
      alert("Please enter a valid amount.");
      return;
    }

    const fundRes = await fetch("/api/funds", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount,
        source: "quick-add",
        applyToItemId: item._id,
        applyAmount: amount,
      }),
    });

    if (!fundRes.ok) {
      alert("Could not create fund entry.");
      return;
    }

    await Promise.all([loadItems(), loadFunds()]);
  }

  const bigItems = savingItems.filter((item) => item.tier === "big");
  const mediumItems = savingItems.filter((item) => item.tier === "medium");
  const smallItems = savingItems.filter((item) => item.tier === "small");

  if (authLoading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top_left,_#d6f5ec,_#f8fafc_55%)] p-4 text-slate-900">
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
          Loading session...
        </div>
      </main>
    );
  }

  if (!currentUser) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#d6f5ec,_#f8fafc_55%)] p-4 text-slate-900 md:p-8">
        <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-md items-center justify-center md:min-h-[calc(100vh-4rem)]">
          <form
            onSubmit={handleAuthSubmit}
            className="w-full space-y-4 rounded-3xl border border-teal-200 bg-white p-6 shadow-sm"
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-800">Wyse</p>
              <h1 className="text-3xl font-bold text-[#0F6E56]">{authMode === "login" ? "Sign in" : "Create account"}</h1>
              <p className="mt-1 text-sm text-slate-600">
                Each user gets a private dashboard for their own Wishlist, Saving For, and Completed items.
              </p>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setAuthMode("login")}
                className={`mr-2 rounded-full px-3 py-1 text-sm font-medium ${authMode === "login" ? "bg-[#0F6E56] text-white" : "bg-slate-100 text-slate-700"}`}
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => setAuthMode("register")}
                className={`rounded-full px-3 py-1 text-sm font-medium ${authMode === "register" ? "bg-[#0F6E56] text-white" : "bg-slate-100 text-slate-700"}`}
              >
                Register
              </button>
            </div>

            {authMode === "register" ? (
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Display name</label>
                <input
                  value={authForm.displayName}
                  onChange={(event) => setAuthForm((prev) => ({ ...prev, displayName: event.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-[#0F6E56]"
                  required
                />
              </div>
            ) : null}

            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Username</label>
              <input
                value={authForm.username}
                onChange={(event) => setAuthForm((prev) => ({ ...prev, username: event.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-[#0F6E56]"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Password</label>
              <input
                value={authForm.password}
                onChange={(event) => setAuthForm((prev) => ({ ...prev, password: event.target.value }))}
                type="password"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-[#0F6E56]"
                required
              />
            </div>

            {authError ? <p className="text-sm font-medium text-red-600">{authError}</p> : null}

            <button
              disabled={authSubmitting}
              className="w-full rounded-lg bg-[#0F6E56] px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {authSubmitting ? "Please wait..." : authMode === "login" ? "Login" : "Create account"}
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#d6f5ec,_#f8fafc_55%)] p-4 text-slate-900 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 rounded-3xl border border-teal-200 bg-white/80 p-5 shadow-sm backdrop-blur md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-800">Wyse</p>
            <h1 className="text-3xl font-bold text-[#0F6E56]">Spend with intention</h1>
            <p className="text-sm font-medium text-slate-700">Signed in as {currentUser.displayName}</p>
            <p className="text-sm text-slate-600">
              Total funded LKR {totals.totalFunded.toFixed(2)} / needed LKR {totals.totalNeeded.toFixed(2)}
            </p>
            <p className="text-sm text-slate-600">Available savings: LKR {availableSavings.toFixed(2)}</p>
          </div>
          <div className="flex flex-wrap gap-2">

            <button
              type="button"
              onClick={() => setShowAddItem(true)}
              className="rounded-lg bg-[#0F6E56] px-4 py-2 text-sm font-semibold text-white"
            >
              Add item
            </button>
            <button
              type="button"
              onClick={handleOpenAllocateModal}
              className="rounded-lg bg-[#EF9F27] px-4 py-2 text-sm font-semibold text-slate-900"
            >
              Log funds
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
            >
              Logout
            </button>
          </div>
        </header>

        {nextUpItem ? (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Buy Next: <span className="font-semibold">{nextUpItem.name}</span> (LKR {nextUpItem.price.toFixed(2)})
          </section>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-xl font-semibold text-slate-900">Wishlist</h2>
            <div className="max-h-[65vh] space-y-3 overflow-y-auto pr-1">
              {loading ? <p className="text-sm text-slate-600">Loading...</p> : null}
              {!loading && wishlistItems.length === 0 ? (
                <p className="text-sm text-slate-600">No wishlist items yet.</p>
              ) : null}
              {wishlistItems.map((item) => (
                <ItemCard
                  key={item._id}
                  item={item}
                  onStartSaving={handleStartSaving}
                  onRemove={handleRemove}
                />
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-xl font-semibold text-slate-900">Saving For</h2>
            <div className="grid max-h-[65vh] gap-3 overflow-y-auto pr-1 md:grid-cols-3">
              <TierColumn
                title="Big"
                items={bigItems}
                onAddFunds={handleQuickAddFunds}
                onRemove={handleRemove}
                nextUpId={nextUpItem?._id}
              />
              <TierColumn
                title="Medium"
                items={mediumItems}
                onAddFunds={handleQuickAddFunds}
                onRemove={handleRemove}
                nextUpId={nextUpItem?._id}
              />
              <TierColumn
                title="Small"
                items={smallItems}
                onAddFunds={handleQuickAddFunds}
                onRemove={handleRemove}
                nextUpId={nextUpItem?._id}
              />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-xl font-semibold text-slate-900">Completed</h2>
          <div className="max-h-[45vh] space-y-3 overflow-y-auto pr-1">
            {loading ? <p className="text-sm text-slate-600">Loading...</p> : null}
            {!loading && completedItems.length === 0 ? (
              <p className="text-sm text-slate-600">No completed items yet.</p>
            ) : null}

            {completedItems.map((item) => (
              <article
                key={item._id}
                className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">{item.name}</h3>
                    <p className="text-xs text-slate-600">
                      LKR {item.price.toFixed(2)} • Funded LKR {item.funded.toFixed(2)}
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                    Completed
                  </span>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>

      {showAddItem ? (
        <AddItemModal
          onClose={() => setShowAddItem(false)}
          onAdded={(item) => {
            setItems((prev) => [item, ...prev]);
          }}
        />
      ) : null}

      {allocationAmount !== null ? (
        <AllocateFundsModal
          amount={allocationAmount}
          items={savingItems}
          onClose={() => setAllocationAmount(null)}
          onAllocated={async () => {
            await Promise.all([loadItems(), loadFunds()]);
          }}
        />
      ) : null}
    </main>
  );
}

type TierColumnProps = {
  title: string;
  items: Item[];
  onAddFunds: (item: Item) => void;
  onRemove: (item: Item) => void;
  nextUpId?: string;
};

function TierColumn({ title, items, onAddFunds, onRemove, nextUpId }: TierColumnProps) {
  return (
    <div className="space-y-2 rounded-xl bg-slate-50 p-2">
      <h3 className="px-1 text-sm font-semibold uppercase tracking-wide text-slate-700">{title}</h3>
      <div className="space-y-2">
        {items.length === 0 ? <p className="px-1 text-xs text-slate-500">No items</p> : null}
        {items.map((item) => (
          <ItemCard
            key={item._id}
            item={item}
            onAddFunds={onAddFunds}
            onRemove={onRemove}
            isNextUp={item._id === nextUpId}
          />
        ))}
      </div>
    </div>
  );
}
