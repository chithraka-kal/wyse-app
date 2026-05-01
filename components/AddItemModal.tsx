"use client";

import { FormEvent, useState } from "react";
import AiBadge from "@/components/AiBadge";
import { Item, Zone, Priority } from "@/types/wyse";

type AddItemModalProps = {
  onClose: () => void;
  onAdded: (item: Item) => void;
};

const adminSecret = process.env.NEXT_PUBLIC_ADMIN_SECRET ?? "";

export default function AddItemModal({ onClose, onAdded }: AddItemModalProps) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [zone, setZone] = useState<Zone>("wishlist");
  const [priority, setPriority] = useState<Priority>(2);
  const [isLoading, setIsLoading] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiUnavailable, setAiUnavailable] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setAiUnavailable(false);

    let computedPrice = Number(price);
    let computedPriority: Priority = priority;

    if (zone === "wishlist") {
      setIsAiLoading(true);
      try {
        const aiRes = await fetch("/api/ai/categorise", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-admin-secret": adminSecret,
          },
          body: JSON.stringify({ rawInput: name }),
        });

        const aiData = await aiRes.json();
        if (aiData?.aiAvailable && aiData?.result) {
          if (Number.isFinite(Number(aiData.result.price))) {
            computedPrice = Number(aiData.result.price);
            setPrice(String(aiData.result.price));
          }
          if (aiData.result.priority && [1, 2, 3].includes(Number(aiData.result.priority))) {
            computedPriority = Number(aiData.result.priority) as Priority;
            setPriority(computedPriority);
          }
        } else {
          setAiUnavailable(true);
        }
      } catch {
        setAiUnavailable(true);
      } finally {
        setIsAiLoading(false);
      }
    }

    try {
      const payload = {
        name,
        price: computedPrice,
        zone,
        priority: computedPriority ?? priority,
        notes,
        url,
      };

      const res = await fetch("/api/items", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": adminSecret,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error("Failed to create item");
      }

      const created = (await res.json()) as Item;
      onAdded(created);
      onClose();
    } catch {
      alert("Could not create item. Check your admin secret and try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-6 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Add item</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-medium text-slate-600"
          >
            Close
          </button>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Name</label>
          <div className="flex items-center gap-2">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-[#0F6E56]"
            />
            {isAiLoading ? (
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-[#0F6E56]" />
            ) : null}
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Price (LKR)</label>
          <input
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            type="number"
            min={0}
            step="0.01"
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-[#0F6E56]"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">URL</label>
          <input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-[#0F6E56]"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Zone</label>
          <select
            value={zone}
            onChange={(event) => setZone(event.target.value as Zone)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-[#0F6E56]"
          >
            <option value="wishlist">Wishlist</option>
            <option value="saving">Saving For</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Priority</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPriority(1)}
              className={`rounded-md px-3 py-1 border ${priority === 1 ? 'bg-amber-200 border-amber-400' : 'border-slate-300'}`}
            >
              ! Urgent
            </button>
            <button
              type="button"
              onClick={() => setPriority(2)}
              className={`rounded-md px-3 py-1 border ${priority === 2 ? 'bg-slate-200 border-slate-400' : 'border-slate-300'}`}
            >
              • Normal
            </button>
            <button
              type="button"
              onClick={() => setPriority(3)}
              className={`rounded-md px-3 py-1 border ${priority === 3 ? 'bg-gray-200 border-gray-400' : 'border-slate-300'}`}
            >
              ↓ Low
            </button>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Notes</label>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-[#0F6E56]"
          />
        </div>

        {aiUnavailable ? <AiBadge label="AI unavailable" /> : null}

        <button
          disabled={isLoading || isAiLoading}
          className="w-full rounded-lg bg-[#0F6E56] px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {isLoading ? "Saving..." : "Create item"}
        </button>
      </form>
    </div>
  );
}
