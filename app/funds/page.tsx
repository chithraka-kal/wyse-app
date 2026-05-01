"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Fund, Item } from "@/types/wyse";

const adminSecret = process.env.NEXT_PUBLIC_ADMIN_SECRET ?? "";

function getItemName(itemId: Fund["allocations"][number]["itemId"]) {
  if (!itemId) return "Unknown item";
  if (typeof itemId === "string") return itemId;
  return (itemId as Item).name;
}

export default function FundsPage() {
  const [funds, setFunds] = useState<Fund[]>([]);

  useEffect(() => {
    async function loadFunds() {
      const response = await fetch("/api/funds", {
        headers: { "x-admin-secret": adminSecret },
      });
      if (!response.ok) return;
      const data = (await response.json()) as Fund[];
      setFunds(data);
    }

    void loadFunds();
  }, []);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#d6f5ec,_#f8fafc_55%)] p-6 text-slate-900">
      <div className="mx-auto max-w-5xl space-y-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-[#0F6E56]">Funds</h1>
          <Link href="/" className="text-sm font-medium text-[#0F6E56]">
            Back to dashboard
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-600">
                <th className="py-2">Received</th>
                <th className="py-2">Amount</th>
                <th className="py-2">Unallocated</th>
                <th className="py-2">Allocations</th>
              </tr>
            </thead>
            <tbody>
              {funds.map((fund) => (
                <tr key={fund._id} className="border-b border-slate-100 align-top">
                  <td className="py-2">{new Date(fund.receivedAt).toLocaleDateString()}</td>
                  <td className="py-2">LKR {fund.amount.toFixed(2)}</td>
                  <td className="py-2">LKR {fund.unallocated.toFixed(2)}</td>
                  <td className="py-2">
                    {fund.allocations.length === 0 ? (
                      <span className="text-slate-500">No allocations</span>
                    ) : (
                      <ul className="space-y-1">
                        {fund.allocations.map((allocation, index) => (
                          <li key={`${fund._id}-${index}`}>
                            {getItemName(allocation.itemId)}: LKR {allocation.amount.toFixed(2)}
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
