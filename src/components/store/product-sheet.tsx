import { useEffect, useState } from "react";
import { Heart, Minus, Plus, Share2, Star, X } from "lucide-react";
import clsx from "clsx";
import { toast } from "sonner";
import { submitReview, submitStockAlert } from "@/lib/store/api";
import { money, ratingSummary, useStore } from "@/lib/store/store";

export function ProductSheet() {
  const productId = useStore((s) => s.productId);
  const product = useStore((s) => s.products.find((item) => item.id === productId) ?? null);
  const reviews = useStore((s) => (productId ? s.reviews[productId] : undefined));
  const saved = useStore((s) => (productId ? s.wishlist.includes(productId) : false));
  const selection = useStore((s) => (productId ? s.selections[productId] : undefined));
  const profileName = useStore((s) => s.profile.name);
  const closeProduct = useStore((s) => s.closeProduct);
  const setSelection = useStore((s) => s.setSelection);
  const addToCart = useStore((s) => s.addToCart);
  const toggleWishlist = useStore((s) => s.toggleWishlist);
  const openCheckoutBuy = useStore((s) => s.openCheckoutBuy);
  const openLightbox = useStore((s) => s.openLightbox);
  const refreshCatalogue = useStore((s) => s.refreshCatalogue);

  const [slide, setSlide] = useState(0);
  const [rating, setRating] = useState(0);
  const [name, setName] = useState(profileName);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [alertEmail, setAlertEmail] = useState("");
  const [alertMsg, setAlertMsg] = useState("");

  useEffect(() => {
    setSlide(0);
    setRating(0);
    setComment("");
    setAlertMsg("");
  }, [productId]);

  if (!product) return null;

  const color = selection?.color ?? product.colors[0]?.name ?? "";
  const size = selection?.size ?? product.sizes[0] ?? "";
  const qty = selection?.qty ?? 1;
  const out = product.stock !== null && product.stock <= 0;
  const summary = ratingSummary(reviews);
  const images = product.images.length > 0 ? product.images : [];
  const activeSlide = Math.min(slide, Math.max(images.length - 1, 0));

  async function share() {
    const url = `${location.origin}${location.pathname}#item-${encodeURIComponent(product!.itemNo)}`;
    const text = `${product!.name} (#${product!.itemNo}) — ${money(product!.effectivePrice)} at JM-Store`;
    try {
      if (navigator.share) await navigator.share({ title: product!.name, text, url });
      else {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        toast.success("Link copied");
      }
    } catch {
      /* user cancelled share */
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-cream">
      <header className="flex items-center justify-between border-b border-line px-3 py-2">
        <button type="button" onClick={closeProduct} aria-label="Close" className="flex size-11 items-center justify-center rounded-full">
          <X className="size-5" />
        </button>
        <p className="text-sm font-medium tracking-wide text-ink/70">#{product.itemNo}</p>
        <div className="flex">
          <button type="button" aria-label="Share" onClick={() => void share()} className="flex size-11 items-center justify-center rounded-full">
            <Share2 className="size-5" />
          </button>
          <button
            type="button"
            aria-label={saved ? "Remove from wishlist" : "Save"}
            onClick={() => toggleWishlist(product.id)}
            className={clsx("flex size-11 items-center justify-center rounded-full", saved && "text-brick")}
          >
            <Heart className="size-5" fill={saved ? "currentColor" : "none"} />
          </button>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="relative bg-line/30">
          {images[activeSlide] ? (
            <button type="button" className="block w-full" onClick={() => openLightbox(images, activeSlide)}>
              <img src={images[activeSlide]} alt="" className="aspect-square w-full object-cover" />
            </button>
          ) : (
            <div className="flex aspect-square items-center justify-center font-display text-3xl text-teal">{product.itemNo}</div>
          )}
          {images.length > 1 && (
            <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
              {images.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  aria-label={`Photo ${index + 1}`}
                  onClick={() => setSlide(index)}
                  className={clsx("h-1.5 rounded-full bg-cream", index === activeSlide ? "w-5" : "w-1.5 opacity-70")}
                />
              ))}
            </div>
          )}
        </div>
        <div className="space-y-4 px-4 py-5">
          <div>
            {product.category && <p className="text-xs font-semibold tracking-widest text-brick uppercase">{product.category}</p>}
            <h2 className="mt-1 font-display text-3xl leading-tight font-semibold text-balance text-ink">{product.name}</h2>
            {product.description && <p className="mt-2 text-pretty text-ink/75">{product.description}</p>}
          </div>
          <p className="flex items-baseline gap-2 tabular-nums">
            {product.discountPrice !== null && <span className="text-ink/50 line-through">{money(product.price)}</span>}
            <span className="font-display text-2xl font-semibold text-brick">{money(product.effectivePrice)}</span>
          </p>
          {summary && (
            <p className="inline-flex items-center gap-1 text-sm text-ink/80">
              <Star className="size-4 fill-marigold text-marigold" />
              {summary.avg.toFixed(1)} · {summary.count} review{summary.count === 1 ? "" : "s"}
            </p>
          )}
          {product.colors.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium">Colour · {color}</p>
              <div className="flex flex-wrap gap-2">
                {product.colors.map((swatch) => (
                  <button
                    key={swatch.name}
                    type="button"
                    aria-label={swatch.name}
                    onClick={() => setSelection(product.id, { color: swatch.name })}
                    className={clsx(
                      "size-10 rounded-full border",
                      color === swatch.name ? "border-teal ring-2 ring-teal ring-offset-2 ring-offset-cream" : "border-line",
                    )}
                    style={{ background: swatch.hex }}
                  />
                ))}
              </div>
            </div>
          )}
          {product.sizes.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium">Size · {size}</p>
              <div className="flex flex-wrap gap-2">
                {product.sizes.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setSelection(product.id, { size: option })}
                    className={clsx(
                      "min-h-11 min-w-11 rounded-full border px-3 text-sm font-medium",
                      size === option ? "border-teal bg-teal text-ivory" : "border-line bg-surface text-ink",
                    )}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Quantity</p>
            <div className="flex items-center gap-3">
              <button type="button" aria-label="Decrease" onClick={() => setSelection(product.id, { qty: Math.max(1, qty - 1) })} className="flex size-11 items-center justify-center rounded-full border border-line bg-surface">
                <Minus className="size-4" />
              </button>
              <span className="w-6 text-center tabular-nums">{qty}</span>
              <button type="button" aria-label="Increase" onClick={() => setSelection(product.id, { qty: Math.min(20, qty + 1) })} className="flex size-11 items-center justify-center rounded-full border border-line bg-surface">
                <Plus className="size-4" />
              </button>
            </div>
          </div>
          {out && (
            <form
              className="space-y-2 rounded-2xl border border-line bg-surface p-3"
              onSubmit={(event) => {
                event.preventDefault();
                const email = alertEmail.trim();
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                  setAlertMsg("Please enter a valid email.");
                  return;
                }
                setSending(true);
                void submitStockAlert({
                  productId: product.id,
                  productName: product.name,
                  itemNo: product.itemNo,
                  email,
                  createdAt: Date.now(),
                  notified: false,
                })
                  .then(() => {
                    setAlertMsg("We'll email you when it's back.");
                    setAlertEmail("");
                  })
                  .catch(() => setAlertMsg("Something went wrong, try again."))
                  .finally(() => setSending(false));
              }}
            >
              <p className="text-sm font-medium">Notify me when it's back</p>
              <input
                type="email"
                value={alertEmail}
                onChange={(event) => setAlertEmail(event.target.value)}
                placeholder="Your email address"
                className="h-12 w-full rounded-xl border border-line bg-cream px-3 text-ink outline-none focus:border-teal"
              />
              <button type="submit" disabled={sending} className="h-11 w-full rounded-xl border border-ink text-sm font-medium">
                Notify me
              </button>
              {alertMsg && <p className="text-sm text-teal">{alertMsg}</p>}
            </form>
          )}
          <section className="border-t border-line pt-4">
            <h3 className="font-display text-xl font-semibold">Reviews</h3>
            <div className="mt-3 space-y-3">
              {(reviews ?? []).length === 0 && <p className="text-sm text-ink/70">No reviews yet — be the first.</p>}
              {(reviews ?? []).map((review) => (
                <article key={review.id} className="rounded-2xl border border-line bg-surface p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{review.name}</p>
                    <p className="text-marigold">{"★".repeat(review.rating)}{"☆".repeat(Math.max(0, 5 - review.rating))}</p>
                  </div>
                  {review.comment && <p className="mt-1 text-sm text-pretty text-ink/80">{review.comment}</p>}
                </article>
              ))}
            </div>
            <form
              className="mt-4 space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                if (!name.trim() || rating === 0) {
                  toast.error("Enter your name and a star rating.");
                  return;
                }
                setSending(true);
                void submitReview({
                  productId: product.id,
                  name: name.trim(),
                  rating,
                  comment: comment.trim(),
                  createdAt: Date.now(),
                })
                  .then(async () => {
                    toast.success("Review posted");
                    setComment("");
                    setRating(0);
                    await refreshCatalogue();
                  })
                  .catch((error: unknown) => {
                    toast.error(error instanceof Error ? error.message : "Couldn't submit your review.");
                  })
                  .finally(() => setSending(false));
              }}
            >
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button key={star} type="button" aria-label={`${star} star`} onClick={() => setRating(star)} className="flex size-11 items-center justify-center">
                    <Star className={clsx("size-6", star <= rating ? "fill-marigold text-marigold" : "text-ink/30")} />
                  </button>
                ))}
              </div>
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" className="h-12 w-full rounded-xl border border-line bg-surface px-3 outline-none focus:border-teal" />
              <textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="What did you think?" rows={3} className="w-full rounded-xl border border-line bg-surface px-3 py-3 outline-none focus:border-teal" />
              <button type="submit" disabled={sending} className="h-12 w-full rounded-xl bg-teal font-medium text-ivory disabled:opacity-60">
                Submit review
              </button>
            </form>
          </section>
        </div>
      </div>
      <div className="sheet-pad grid grid-cols-2 gap-2 border-t border-line bg-cream px-4 pt-3">
        <button
          type="button"
          disabled={out}
          onClick={() => {
            addToCart(product);
            toast.success("Added to cart");
          }}
          className="h-12 rounded-xl bg-teal-deep font-medium text-ivory disabled:opacity-40"
        >
          Add to cart
        </button>
        <button
          type="button"
          disabled={out}
          onClick={() => openCheckoutBuy(product)}
          className="h-12 rounded-xl bg-teal font-medium text-ivory disabled:opacity-40"
        >
          Order on WhatsApp
        </button>
      </div>
    </div>
  );
}
