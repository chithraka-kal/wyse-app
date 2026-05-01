"use client";

import { useEffect, useMemo, useState } from "react";
import AddItemModal from "@/components/AddItemModal";
import AllocateFundsModal from "@/components/AllocateFundsModal";
import ItemCard from "@/components/ItemCard";
import { Fund, Item, Tier } from "@/types/wyse";

const adminSecret = process.env.NEXT_PUBLIC_ADMIN_SECRET ?? "";

export default function Home() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddItem, setShowAddItem] = useState(false);
  const [allocationFund, setAllocationFund] = useState<Fund | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const incubatorItems = useMemo(
    () =>
      items
        .filter((item) => item.zone === "incubator" && item.status === "active")
        .sort((a, b) => +new Date(b.addedAt) - +new Date(a.addedAt)),
    [items],
  );

  const definiteItems = useMemo(
    () =>
      items
        .filter((item) => item.zone === "definite" && item.status === "active")
        .sort((a, b) => {
          const ap = a.price > 0 ? a.funded / a.price : 0;
          const bp = b.price > 0 ? b.funded / b.price : 0;
          return bp - ap;
        }),
    [items],
  );

  const totals = useMemo(() => {
    const totalNeeded = definiteItems.reduce((sum, item) => sum + item.price, 0);
    const totalFunded = definiteItems.reduce((sum, item) => sum + item.funded, 0);
    return { totalNeeded, totalFunded };
  }, [definiteItems]);

  async function loadItems() {
    try {
      const response = await fetch("/api/items", {
        headers: {
          "x-admin-secret": adminSecret,
        },
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

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const response = await fetch("/api/items", {
          headers: {
            "x-admin-secret": adminSecret,
          },
        });
        if (!response.ok || cancelled) {
          throw new Error("Failed to load items");
        }
        const data = (await response.json()) as Item[];
        if (!cancelled) {
          setItems(data);
        }
      } catch {
        if (!cancelled) {
          setItems([]);
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
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 60 * 60 * 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  function getDaysRemaining(promoteAfter: string | null) {
    if (!promoteAfter) return 0;
    const distance = new Date(promoteAfter).getTime() - now;
    if (distance <= 0) return 0;
    return Math.ceil(distance / (1000 * 60 * 60 * 24));
  }

  async function handlePromote(item: Item) {
    const remaining = getDaysRemaining(item.promoteAfter);
    if (remaining > 0) {
      const confirmed = window.confirm(
        `This item still has ${remaining} day(s) in cool-off. Promote anyway?`,
      );
      if (!confirmed) return;
    }

    const tierInput = window.prompt("Set tier for this item: high, mid, or low", "mid");
    const tier = (tierInput || "mid").toLowerCase() as Tier;

    if (!["high", "mid", "low"].includes(tier)) {
      alert("Invalid tier. Use high, mid, or low.");
      return;
    }

    await fetch(`/api/items/${item._id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-admin-secret": adminSecret,
      },
      body: JSON.stringify({ zone: "definite", tier }),
    });

    await loadItems();
  }

  async function handleDrop(item: Item) {
    await fetch(`/api/items/${item._id}`, {
      method: "DELETE",
      headers: {
        "x-admin-secret": adminSecret,
      },
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

    const response = await fetch("/api/funds", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-secret": adminSecret,
      },
      body: JSON.stringify({ amount, source: "manual" }),
    });

    if (!response.ok) {
      alert("Could not create fund entry.");
      return;
    }

    const fund = (await response.json()) as Fund;
    setAllocationFund(fund);
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
        "x-admin-secret": adminSecret,
      },
      body: JSON.stringify({ amount, source: "quick-add" }),
    });

    if (!fundRes.ok) {
      alert("Could not create fund entry.");
      return;
    }

    const fund = (await fundRes.json()) as Fund;

    await fetch(`/api/funds/${fund._id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-admin-secret": adminSecret,
      },
      body: JSON.stringify({ allocations: [{ itemId: item._id, amount }] }),
    });

    await loadItems();
  }

  const highItems = definiteItems.filter((item) => item.tier === "high");
  const midItems = definiteItems.filter((item) => item.tier === "mid");
  const lowItems = definiteItems.filter((item) => item.tier === "low");

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#d6f5ec,_#f8fafc_55%)] p-4 text-slate-900 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 rounded-3xl border border-teal-200 bg-white/80 p-5 shadow-sm backdrop-blur md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-800">Wyse</p>
            <h1 className="text-3xl font-bold text-[#0F6E56]">Spend with intention</h1>
            <p className="text-sm text-slate-600">
              Total funded ${totals.totalFunded.toFixed(2)} / needed ${totals.totalNeeded.toFixed(2)}
            </p>
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
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-xl font-semibold text-slate-900">Incubator</h2>
            <div className="max-h-[65vh] space-y-3 overflow-y-auto pr-1">
              {loading ? <p className="text-sm text-slate-600">Loading...</p> : null}
              {!loading && incubatorItems.length === 0 ? (
                <p className="text-sm text-slate-600">No incubator items yet.</p>
              ) : null}
              {incubatorItems.map((item) => (
                <ItemCard
                  key={item._id}
                  item={item}
                  daysRemaining={getDaysRemaining(item.promoteAfter)}
                  challengeQuestion={item.challengeQuestion}
                  onPromote={handlePromote}
                  onDrop={handleDrop}
                />
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-xl font-semibold text-slate-900">Definite Pipeline</h2>
            <div className="grid max-h-[65vh] gap-3 overflow-y-auto pr-1 md:grid-cols-3">
              <TierColumn title="High" items={highItems} onAddFunds={handleQuickAddFunds} />
              <TierColumn title="Mid" items={midItems} onAddFunds={handleQuickAddFunds} />
              <TierColumn title="Low" items={lowItems} onAddFunds={handleQuickAddFunds} />
            </div>
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

      {allocationFund ? (
        <AllocateFundsModal
          fund={allocationFund}
          items={definiteItems}
          onClose={() => setAllocationFund(null)}
          onAllocated={loadItems}
        />
      ) : null}
    </main>
  );
}

type TierColumnProps = {
  title: string;
  items: Item[];
  onAddFunds: (item: Item) => void;
};

function TierColumn({ title, items, onAddFunds }: TierColumnProps) {
  return (
    <div className="space-y-2 rounded-xl bg-slate-50 p-2">
      <h3 className="px-1 text-sm font-semibold uppercase tracking-wide text-slate-700">{title}</h3>
      <div className="space-y-2">
        {items.length === 0 ? <p className="px-1 text-xs text-slate-500">No items</p> : null}
        {items.map((item) => (
          <ItemCard key={item._id} item={item} onAddFunds={onAddFunds} />
        ))}
      </div>
    </div>
  );
}
