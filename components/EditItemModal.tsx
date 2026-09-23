"use client";

import { FormEvent, useState } from "react";
import { Item, Zone, Priority } from "@/types/wyse";

type EditItemModalProps = {
  item: Item;
  onClose: () => void;
  onUpdated: (updatedItem: Item) => void;
};

export default function EditItemModal({ item, onClose, onUpdated }: EditItemModalProps) {
  const [name, setName] = useState(item.name);
  const [price, setPrice] = useState(String(item.price));
  const [url, setUrl] = useState(item.url || "");
  const [notes, setNotes] = useState(item.notes || "");
  const [zone, setZone] = useState<Zone>(item.zone);
  const [priority, setPriority] = useState<Priority>(item.priority || 2);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    const computedPrice = zone === "flash" && (price === "" || price === undefined) ? 0 : Number(price);
    if (!Number.isFinite(computedPrice) || computedPrice < 0) {
      setError("Please enter a valid price.");
      setIsLoading(false);
      return;
    }

    try {
      const payload = {
        name,
        price: computedPrice,
        zone,
        priority,
        notes,
        url,
      };

      const res = await fetch(`/api/items/${item._id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error("Failed to update item");
      }

      const updated = (await res.json()) as Item;
      onUpdated(updated);
      onClose();
    } catch {
      setError("Could not update item. Please try again.");
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
          <h2 className="text-lg font-semibold text-slate-900">Edit item</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            Close
          </button>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Name</label>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-[#0F6E56]"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">
            Price (LKR) {zone === "flash" ? <span className="font-normal text-slate-500">(Optional)</span> : null}
          </label>
          <input
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            type="number"
            min={0}
            step="0.01"
            required={zone !== "flash"}
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
            <option value="flash">⚡ Flash</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Priority</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPriority(1)}
              className={`rounded-md px-3 py-1 border text-sm font-medium transition-colors ${
                priority === 1 ? "bg-amber-200 border-amber-400 text-amber-900" : "border-slate-300 text-slate-700 hover:bg-slate-50"
              }`}
            >
              ! Urgent
            </button>
            <button
              type="button"
              onClick={() => setPriority(2)}
              className={`rounded-md px-3 py-1 border text-sm font-medium transition-colors ${
                priority === 2 ? "bg-slate-200 border-slate-400 text-slate-900" : "border-slate-300 text-slate-700 hover:bg-slate-50"
              }`}
            >
              • Normal
            </button>
            <button
              type="button"
              onClick={() => setPriority(3)}
              className={`rounded-md px-3 py-1 border text-sm font-medium transition-colors ${
                priority === 3 ? "bg-gray-200 border-gray-400 text-gray-900" : "border-slate-300 text-slate-700 hover:bg-slate-50"
              }`}
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

        {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}

        <button
          disabled={isLoading}
          className="w-full rounded-lg bg-[#0F6E56] px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {isLoading ? "Saving..." : "Save changes"}
        </button>
      </form>
    </div>
  );
}
