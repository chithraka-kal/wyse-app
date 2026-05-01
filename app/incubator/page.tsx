import Link from "next/link";

export default function WishlistPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#d6f5ec,_#f8fafc_55%)] p-6 text-slate-900">
      <div className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-[#0F6E56]">Wishlist</h1>
        <p className="mt-2 text-sm text-slate-600">
          Use the dashboard for full wishlist controls and Start Saving actions.
        </p>
        <Link href="/" className="mt-4 inline-block text-sm font-medium text-[#0F6E56]">
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}
