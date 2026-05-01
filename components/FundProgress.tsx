type FundProgressProps = {
  funded: number;
  price: number;
};

export default function FundProgress({ funded, price }: FundProgressProps) {
  const percentage = Math.min(100, Math.round((funded / Math.max(price, 1)) * 100));

  return (
    <div className="space-y-1">
      <div className="h-2 w-full overflow-hidden rounded-full bg-teal-100">
        <div
          className="h-full rounded-full bg-[#0F6E56] transition-all"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <p className="text-xs text-slate-600">
        LKR {funded.toFixed(2)} / LKR {price.toFixed(2)} ({percentage}%)
      </p>
    </div>
  );
}
