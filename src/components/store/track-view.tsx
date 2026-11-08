import { useState } from "react";
import clsx from "clsx";
import { findOrder } from "@/lib/store/api";
import { money } from "@/lib/store/store";

type Found = {
  orderId: string;
  status: string;
  total: number;
  items: { name?: string; itemNo?: string; qty?: number }[];
};

const STEPS = ["Confirmed", "Shipped", "Delivered"] as const;

export function TrackView() {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [order, setOrder] = useState<Found | null>(null);

  return (
    <div className="px-4 py-6">
      <p className="text-xs font-semibold tracking-widest text-brick uppercase">Orders</p>
      <h2 className="mt-1 font-display text-3xl font-semibold">Track your order</h2>
      <p className="mt-2 text-sm text-pretty text-ink/70">
        Enter the Order ID you received after checkout — it looks like JM7K2P9X.
      </p>
      <form
        className="mt-4 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const next = code.trim().toUpperCase();
          if (!next) {
            setOrder(null);
            setMessage("Please enter your Order ID.");
            return;
          }
          setBusy(true);
          setMessage("");
          void findOrder(next)
            .then((data) => {
              if (!data) {
                setOrder(null);
                setMessage(`No order found with ID ${next}. Please check and try again.`);
                return;
              }
              setOrder({
                orderId: String(data.orderId || next),
                status: String(data.status || "Pending"),
                total: Number(data.total) || 0,
                items: Array.isArray(data.items) ? (data.items as Found["items"]) : [],
              });
            })
            .catch((error: unknown) => {
              setOrder(null);
              setMessage(error instanceof Error ? error.message : "Something went wrong.");
            })
            .finally(() => setBusy(false));
        }}
      >
        <input
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="Order ID"
          className="h-12 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 uppercase outline-none focus:border-teal"
        />
        <button type="submit" disabled={busy} className="h-12 rounded-xl bg-teal px-4 font-medium text-ivory disabled:opacity-60">
          {busy ? "…" : "Track"}
        </button>
      </form>
      {message && <p className="mt-4 text-sm text-ink/80">{message}</p>}
      {order && (
        <article className="mt-4 rounded-2xl border border-line bg-surface p-4">
          <p className="font-display text-xl font-semibold">Order {order.orderId}</p>
          <p className="mt-1 text-sm text-ink/70">
            {order.items.map((item) => `${item.name ?? "Item"} (${item.itemNo ?? ""}) x${item.qty ?? 1}`).join(", ")}
          </p>
          <p className="mt-2 font-semibold text-brick tabular-nums">{money(order.total)}</p>
          <p className="mt-2 inline-flex rounded-full bg-cream px-3 py-1 text-sm font-medium">{order.status}</p>
          {order.status === "Cancelled" ? (
            <p className="mt-4 font-semibold text-brick">This order was cancelled.</p>
          ) : (
            <ol className="mt-5 flex items-start">
              {STEPS.map((label, index) => {
                const current = STEPS.indexOf(order.status as (typeof STEPS)[number]);
                const done = index <= current;
                return (
                  <li key={label} className="flex flex-1 items-start">
                    <div className="flex flex-1 flex-col items-center gap-1">
                      <span className={clsx("flex size-8 items-center justify-center rounded-full border-2 text-sm", done ? "border-teal bg-teal text-ivory" : "border-line text-ink/50")}>
                        {done ? "✓" : index + 1}
                      </span>
                      <span className="text-center text-xs uppercase tracking-wide text-ink/70">{label}</span>
                    </div>
                    {index < STEPS.length - 1 && <span className={clsx("mt-4 h-0.5 w-6", index < current ? "bg-teal" : "bg-line")} />}
                  </li>
                );
              })}
            </ol>
          )}
        </article>
      )}
    </div>
  );
}
