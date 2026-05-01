type AiBadgeProps = {
  label?: string;
};

export default function AiBadge({ label = "AI suggested" }: AiBadgeProps) {
  return (
    <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
      {label}
    </span>
  );
}
