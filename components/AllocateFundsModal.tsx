"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import AiBadge from "@/components/AiBadge";
import { Fund, FundAllocation, Item } from "@/types/wyse";

type AllocateFundsModalProps = {
  fund: Fund;
  items: Item[];
  onClose: () => void;
  onAllocated: () => void;
};

const adminSecret = process.env.NEXT_PUBLIC_ADMIN_SECRET ?? "";

export default function AllocateFundsModal({
  fund,
  items,
  onClose,
  onAllocated,
}: AllocateFundsModalProps) {
  const [loadingAi, setLoadingAi] = useState(true);
  const [aiAvailable, setAiAvailable] = useState(true);
  const [amountByItem, setAmountByItem] = useState<Record<string, number>>({});
  const [suggested, setSuggested] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function suggest() {
      try {
        const response = await fetch("/api/ai/allocate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-admin-secret": adminSecret,
          },
          body: JSON.stringify({
            fundId: fund._id,
            amount: fund.unallocated,
            items,
          }),
        });

        const data = await response.json();

        if (data?.aiAvailable && Array.isArray(data.result)) {
          const nextValues: Record<string, number> = {};
          const nextSuggested: Record<string, boolean> = {};

          for (const allocation of data.result as FundAllocation[]) {
            const amount = Number(allocation.amount);
            if (Number.isFinite(amount) && amount > 0) {
              nextValues[allocation.itemId] = amount;
              nextSuggested[allocation.itemId] = true;
            }
          }

          setAmountByItem(nextValues);
          setSuggested(nextSuggested);
          setAiAvailable(true);
        } else {
          setAiAvailable(false);
        }
      } catch {
        setAiAvailable(false);
      } finally {
        setLoadingAi(false);
      }
    }

    void suggest();
  }, [fund._id, fund.unallocated, items]);

  const allocatedTotal = useMemo(
    () =>
      Object.values(amountByItem).reduce(
        (sum, amount) => sum + (Number.isFinite(amount) ? amount : 0),
        0,
      ),
    [amountByItem],
  );

  const remaining = Math.max(0, fund.unallocated - allocatedTotal);
  const exceeds = allocatedTotal > fund.unallocated;

  function setItemAmount(itemId: string, value: string) {
    const parsed = Number(value);

    setAmountByItem((prev) => ({
      ...prev,
      [itemId]: Number.isFinite(parsed) && parsed > 0 ? parsed : 0,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (exceeds) {
      return;
    }

    const allocations = Object.entries(amountByItem)
      .filter(([, amount]) => amount > 0)
      .map(([itemId, amount]) => ({ itemId, amount }));

    if (allocations.length === 0) {
      alert("Enter at least one allocation amount.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(`/api/funds/${fund._id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": adminSecret,
        },
        body: JSON.stringify({ allocations }),
      });

      if (!response.ok) {
        throw new Error("Allocation failed");
      }

      onAllocated();
      onClose();
    } catch {
      alert("Could not allocate funds. Please retry.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-2xl space-y-4 rounded-2xl bg-white p-6 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Allocate funds</h2>
            <p className="text-sm text-slate-600">Available: ${fund.unallocated.toFixed(2)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-medium text-slate-600"
          >
            Close
          </button>
        </div>

        {loadingAi ? <p className="text-sm text-slate-600">AI is preparing suggestions...</p> : null}
        {!loadingAi && !aiAvailable ? <AiBadge label="Fill manually" /> : null}

        <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
          {items.map((item) => {
            const percentage = Math.min(
              100,
              Math.round((item.funded / Math.max(item.price, 1)) * 100),
            );
            const value = amountByItem[item._id] ?? 0;

            return (
              <div
                key={item._id}
                className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 p-3 md:grid-cols-[1fr_160px]"
              >
                <div>
                  <p className="font-medium text-slate-900">{item.name}</p>
                  <p className="text-xs text-slate-600">{percentage}% funded</p>
                  {suggested[item._id] ? <AiBadge /> : null}
                </div>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={value || ""}
                  onChange={(event) => setItemAmount(item._id, event.target.value)}
                  className="h-fit rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-[#0F6E56]"
                  placeholder="0.00"
                />
              </div>
            );
          })}
        </div>

        <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
          <p>Allocated: ${allocatedTotal.toFixed(2)}</p>
          <p>Remaining: ${remaining.toFixed(2)}</p>
          {exceeds ? (
            <p className="font-medium text-red-600">Allocated amount exceeds available funds.</p>
          ) : null}
        </div>

        <button
          disabled={submitting || exceeds}
          className="w-full rounded-lg bg-[#0F6E56] px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {submitting ? "Saving..." : "Confirm allocations"}
        </button>
      </form>
    </div>
  );
}
