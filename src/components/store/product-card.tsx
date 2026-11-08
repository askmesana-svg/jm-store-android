import { Heart, ShoppingBag, Star } from "lucide-react";
import clsx from "clsx";
import { toast } from "sonner";
import type { Product } from "@/lib/store/types";
import { money, ratingSummary, useStore } from "@/lib/store/store";

export function ProductCard({ product, compact = false }: { product: Product; compact?: boolean }) {
  const reviews = useStore((s) => s.reviews[product.id]);
  const saved = useStore((s) => s.wishlist.includes(product.id));
  const selection = useStore((s) => s.selections[product.id]);
  const setSelection = useStore((s) => s.setSelection);
  const openProduct = useStore((s) => s.openProduct);
  const addToCart = useStore((s) => s.addToCart);
  const toggleWishlist = useStore((s) => s.toggleWishlist);
  const openCheckoutBuy = useStore((s) => s.openCheckoutBuy);

  const color = selection?.color ?? product.colors[0]?.name ?? "";
  const size = selection?.size ?? product.sizes[0] ?? "";
  const out = product.stock !== null && product.stock <= 0;
  const low = product.stock !== null && product.stock > 0 && product.stock <= 5;
  const rating = ratingSummary(reviews);
  const image = product.images[0];

  return (
    <article
      className={clsx(
        "relative flex flex-col overflow-hidden rounded-2xl border border-line bg-surface",
        compact && "w-44 shrink-0 snap-start md:w-auto",
        out && "opacity-80",
      )}
    >
      <button
        type="button"
        onClick={() => openProduct(product.id)}
        className="relative aspect-square bg-line/40 text-left"
      >
        {image ? (
          <img src={image} alt={product.name} className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full items-center justify-center font-display text-lg text-teal">
            {product.itemNo}
          </span>
        )}
        <span className="absolute top-2 left-2 rounded-full border border-line bg-cream px-2 py-0.5 text-xs font-medium tracking-wide text-ink">
          #{product.itemNo}
        </span>
        {(out || low || product.discountPrice !== null) && (
          <span
            className={clsx(
              "absolute bottom-2 left-2 rounded-full px-2 py-0.5 text-xs font-semibold",
              out && "bg-ink text-ivory",
              !out && low && "bg-marigold text-teal-deep",
              !out && !low && "bg-brick text-ivory",
            )}
          >
            {out ? "Out of stock" : low ? `Only ${product.stock} left` : "Sale"}
          </span>
        )}
      </button>
      <button
        type="button"
        aria-label={saved ? "Remove from wishlist" : "Save to wishlist"}
        onClick={() => toggleWishlist(product.id)}
        className={clsx(
          "absolute top-2 right-2 z-10 flex size-9 items-center justify-center rounded-full border border-line bg-surface",
          saved ? "text-brick" : "text-ink",
        )}
      >
        <Heart className="size-4" fill={saved ? "currentColor" : "none"} />
      </button>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <button type="button" onClick={() => openProduct(product.id)} className="text-left">
          <h3 className="line-clamp-2 font-display text-base leading-snug font-semibold text-balance text-ink">
            {product.name}
          </h3>
        </button>
        {rating && (
          <p className="inline-flex items-center gap-1 text-xs text-ink/70">
            <Star className="size-3 fill-marigold text-marigold" />
            {rating.avg.toFixed(1)} ({rating.count})
          </p>
        )}
        {product.colors.length > 0 && (
          <div className="flex flex-wrap gap-1.5" aria-label="Colour">
            {product.colors.map((swatch) => (
              <button
                key={swatch.name}
                type="button"
                title={swatch.name}
                aria-label={swatch.name}
                onClick={() => setSelection(product.id, { color: swatch.name })}
                className={clsx(
                  "size-6 rounded-full border",
                  color === swatch.name ? "border-teal ring-2 ring-teal ring-offset-2 ring-offset-surface" : "border-line",
                )}
                style={{ background: swatch.hex }}
              />
            ))}
          </div>
        )}
        {product.sizes.length > 0 && !compact && (
          <div className="flex flex-wrap gap-1">
            {product.sizes.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setSelection(product.id, { size: option })}
                className={clsx(
                  "min-h-8 rounded-full border px-2.5 text-xs font-medium",
                  size === option ? "border-teal bg-teal text-ivory" : "border-line bg-surface text-ink",
                )}
              >
                {option}
              </button>
            ))}
          </div>
        )}
        <p className="mt-auto flex items-baseline gap-2 tabular-nums">
          {product.discountPrice !== null && (
            <span className="text-xs text-ink/50 line-through">{money(product.price)}</span>
          )}
          <span className="font-semibold text-brick">{money(product.effectivePrice)}</span>
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            disabled={out}
            onClick={() => {
              addToCart(product);
              toast.success("Added to cart", {
                action: { label: "View", onClick: () => useStore.getState().setTab("bag") },
              });
            }}
            className="inline-flex h-11 items-center justify-center gap-1 rounded-xl bg-teal-deep text-sm font-medium text-ivory disabled:opacity-40"
          >
            <ShoppingBag className="size-4" />
            Cart
          </button>
          <button
            type="button"
            onClick={() => (out ? openProduct(product.id) : openCheckoutBuy(product))}
            className="inline-flex h-11 items-center justify-center rounded-xl border border-teal text-sm font-medium text-teal"
          >
            {out ? "Notify" : "Order"}
          </button>
        </div>
      </div>
    </article>
  );
}
