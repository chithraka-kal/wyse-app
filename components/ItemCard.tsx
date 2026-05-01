import FundProgress from "@/components/FundProgress";
import AiBadge from "@/components/AiBadge";
import { Item } from "@/types/wyse";

type ItemCardProps = {
  item: Item;
  isNextUp?: boolean;
  onStartSaving?: (item: Item) => void;
  onRemove?: (item: Item) => void;
  onAddFunds?: (item: Item) => void;
};

export default function ItemCard({ item, isNextUp, onStartSaving, onRemove, onAddFunds }: ItemCardProps) {

  return (
    <article className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">{item.name}</h3>
          <p className="text-sm text-slate-600">LKR {item.price.toFixed(2)}</p>
          <div className="mt-1 flex items-center gap-2">
            {item.tier ? (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                {item.tier === 'big' ? 'Big' : item.tier === 'medium' ? 'Medium' : 'Small'}
              </span>
            ) : null}
            {isNextUp ? <span className="text-sm">⭐ Next up</span> : null}
          </div>
        </div>
        {item.aiSuggested ? <AiBadge /> : null}
      </div>
      {item.zone === 'wishlist' ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onStartSaving?.(item)}
            className="rounded-lg bg-[#0F6E56] px-3 py-1.5 text-sm font-medium text-white"
          >
            Start Saving
          </button>
          <button
            type="button"
            onClick={() => onRemove?.(item)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700"
          >
            Remove
          </button>
        </div>
      ) : (
        <>
          <FundProgress funded={item.funded} price={item.price} />
          <div className="mt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={() => onAddFunds?.(item)}
              className="rounded-lg bg-[#EF9F27] px-3 py-1.5 text-sm font-semibold text-slate-900"
            >
              Add Savings
            </button>
            <button
              type="button"
              onClick={() => onRemove?.(item)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700"
            >
              Remove
            </button>
            {item.priority === 1 ? (
              <span className="inline-flex items-center gap-2 text-sm text-amber-600">
                <span className="h-2 w-2 rounded-full bg-amber-400" /> Urgent
              </span>
            ) : item.priority === 3 ? (
              <span className="inline-flex items-center gap-2 text-sm text-slate-500">
                <span className="h-2 w-2 rounded-full bg-gray-400" /> Low priority
              </span>
            ) : null}
          </div>
        </>
      )}
    </article>
  );
}
