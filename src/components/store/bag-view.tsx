import { Minus, Plus, Trash2 } from "lucide-react";
import { money, relatedProducts, useStore } from "@/lib/store/store";

export function BagView() {
  const cart = useStore((s) => s.cart);
  const products = useStore((s) => s.products);
  const setQty = useStore((s) => s.setQty);
  const removeFromCart = useStore((s) => s.removeFromCart);
  const openCheckoutCart = useStore((s) => s.openCheckoutCart);
  const addToCart = useStore((s) => s.addToCart);
  const setTab = useStore((s) => s.setTab);
  const total = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const related = relatedProducts(products, cart);

  if (cart.length === 0) {
    return (
      <div className="px-4 py-16 text-center">
        <h2 className="font-display text-3xl font-semibold">Your cart is empty</h2>
        <p className="mt-2 text-ink/70">Pick an item number, colour, and size from the catalogue.</p>
        <button type="button" onClick={() => setTab("shop")} className="mt-6 h-12 rounded-xl bg-teal px-6 font-medium text-ivory">
          Browse catalogue
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 px-4 py-4">
      <h2 className="font-display text-3xl font-semibold">Your cart</h2>
      {cart.map((item) => {
        const image = products.find((product) => product.id === item.id)?.images[0];
        return (
          <article key={item.cartId} className="flex gap-3 rounded-2xl border border-line bg-surface p-3">
            <div className="size-20 overflow-hidden rounded-xl bg-line/40">
              {image && <img src={image} alt="" className="h-full w-full object-cover" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium">{item.name}</p>
              <p className="text-xs text-ink/60">
                #{item.itemNo}
                {item.color ? ` · ${item.color}` : ""}
                {item.size ? ` / ${item.size}` : ""}
              </p>
              <p className="mt-1 font-semibold text-brick tabular-nums">{money(item.price * item.qty)}</p>
              <div className="mt-2 flex items-center gap-2">
                <button type="button" aria-label="Decrease quantity" onClick={() => setQty(item.cartId, item.qty - 1)} className="flex size-10 items-center justify-center rounded-full border border-line">
                  <Minus className="size-4" />
                </button>
                <span className="w-6 text-center tabular-nums">{item.qty}</span>
                <button type="button" aria-label="Increase quantity" onClick={() => setQty(item.cartId, item.qty + 1)} className="flex size-10 items-center justify-center rounded-full border border-line">
                  <Plus className="size-4" />
                </button>
                <button type="button" aria-label="Remove" onClick={() => removeFromCart(item.cartId)} className="ml-auto flex size-10 items-center justify-center rounded-full text-brick">
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          </article>
        );
      })}
      {related.length > 0 && (
        <section>
          <h3 className="font-display text-xl font-semibold">You may also like</h3>
          <div className="mt-2 space-y-2">
            {related.map((product) => (
              <div key={product.id} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-2">
                <div className="size-14 overflow-hidden rounded-xl bg-line/40">
                  {product.images[0] && <img src={product.images[0]} alt="" className="h-full w-full object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{product.name}</p>
                  <p className="text-sm text-brick tabular-nums">{money(product.effectivePrice)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => addToCart(product, { color: product.colors[0]?.name ?? "", size: product.sizes[0] ?? "", qty: 1 })}
                  className="h-10 rounded-full bg-teal px-3 text-sm font-medium text-ivory"
                >
                  Add
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
      <div className="flex items-center justify-between pt-2 font-display text-xl font-semibold">
        <span>Total</span>
        <span className="text-brick tabular-nums">{money(total)}</span>
      </div>
      <button type="button" onClick={openCheckoutCart} className="h-12 w-full rounded-xl bg-teal font-medium text-ivory">
        Order cart on WhatsApp
      </button>
    </div>
  );
}
