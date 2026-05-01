import FundProgress from "@/components/FundProgress";
import AiBadge from "@/components/AiBadge";
import { Item } from "@/types/wyse";

type ItemCardProps = {
  item: Item;
  daysRemaining?: number;
  challengeQuestion?: string;
  onPromote?: (item: Item) => void;
  onDrop?: (item: Item) => void;
  onAddFunds?: (item: Item) => void;
};

export default function ItemCard({
  item,
  daysRemaining,
  challengeQuestion,
  onPromote,
  onDrop,
  onAddFunds,
}: ItemCardProps) {
  const promoteDisabled =
    typeof daysRemaining === "number" && daysRemaining > 0;

  return (
    <article className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">{item.name}</h3>
          <p className="text-sm text-slate-600">${item.price.toFixed(2)}</p>
        </div>
        {item.aiSuggested ? <AiBadge /> : null}
      </div>

      {item.zone === "incubator" ? (
        <>
          {typeof daysRemaining === "number" ? (
            <p className="text-xs font-medium text-slate-600">
              {daysRemaining > 0
                ? `${daysRemaining} day${daysRemaining === 1 ? "" : "s"} remaining`
                : "Cool-off complete"}
            </p>
          ) : null}

          {challengeQuestion ? (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {challengeQuestion}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onPromote?.(item)}
              disabled={promoteDisabled}
              className="rounded-lg bg-[#0F6E56] px-3 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Promote
            </button>
            <button
              type="button"
              onClick={() => onDrop?.(item)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700"
            >
              Drop
            </button>
          </div>
        </>
      ) : (
        <>
          <FundProgress funded={item.funded} price={item.price} />
          <button
            type="button"
            onClick={() => onAddFunds?.(item)}
            className="rounded-lg bg-[#EF9F27] px-3 py-1.5 text-sm font-semibold text-slate-900"
          >
            Add funds
          </button>
        </>
      )}
    </article>
  );
}
