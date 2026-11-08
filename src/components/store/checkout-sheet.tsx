import { useEffect, useMemo, useRef, useState } from "react";
import { Minus, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { placeOrder } from "@/lib/store/api";
import { money, relatedProducts, useStore } from "@/lib/store/store";
import { WHATSAPP_NUMBER } from "@/lib/store/types";
import type { CartItem, Coupon } from "@/lib/store/types";

function discountOf(subtotal: number, coupon: Coupon | null) {
  if (!coupon) return 0;
  const raw = coupon.type === "percent" ? subtotal * (coupon.value / 100) : coupon.value;
  return Math.min(Math.max(raw, 0), subtotal);
}

export function CheckoutSheet() {
  const checkout = useStore((s) => s.checkout);
  const lines = useStore((s) => s.orderLines());
  const products = useStore((s) => s.products);
  const coupons = useStore((s) => s.coupons);
  const profile = useStore((s) => s.profile);
  const closeCheckout = useStore((s) => s.closeCheckout);
  const adjustOrderQty = useStore((s) => s.adjustOrderQty);
  const addRelatedToOrder = useStore((s) => s.addRelatedToOrder);
  const finishCartOrder = useStore((s) => s.finishCartOrder);
  const openProduct = useStore((s) => s.openProduct);

  const [step, setStep] = useState<1 | 2>(1);
  const [code, setCode] = useState("");
  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const [couponMsg, setCouponMsg] = useState("");
  const [name, setName] = useState(profile.name);
  const [phone, setPhone] = useState(profile.phone);
  const [email, setEmail] = useState(profile.email);
  const [address, setAddress] = useState("");
  const [sending, setSending] = useState(false);
  const [placed, setPlaced] = useState<string | null>(null);

  const wasOpen = useRef(false);
  useEffect(() => {
    const open = !!checkout;
    if (open && !wasOpen.current) {
      setStep(1);
      setPlaced(null);
      setCoupon(null);
      setCode("");
      setCouponMsg("");
      const current = useStore.getState().profile;
      setName(current.name);
      setPhone(current.phone);
      setEmail(current.email);
      setAddress("");
    }
    wasOpen.current = open;
  }, [checkout]);

  const subtotal = lines.reduce((sum, item) => sum + item.price * item.qty, 0);
  const discount = discountOf(subtotal, coupon);
  const total = subtotal - discount;
  const related = useMemo(() => relatedProducts(products, lines), [products, lines]);

  if (!checkout) return null;

  function applyCoupon() {
    const next = code.trim().toUpperCase();
    const match = coupons[next];
    if (!next) {
      setCoupon(null);
      setCouponMsg("Please enter a coupon code.");
      return;
    }
    if (!match || !match.active) {
      setCoupon(null);
      setCouponMsg("Invalid or expired coupon code.");
      return;
    }
    setCoupon(match);
    setCouponMsg(match.type === "percent" ? `${match.value}% off applied` : `${money(match.value)} off applied`);
  }

  function whatsappText(orderId: string, items: CartItem[]) {
    const itemsText = items
      .map((item, index) => {
        const bits = [
          `${index + 1}. *${item.name}*`,
          `   - Item No: ${item.itemNo}`,
          item.color ? `   - Colour: ${item.color}` : "",
          item.size ? `   - Size: ${item.size}` : "",
          `   - Qty: ${item.qty}`,
          `   - Price: ${money(item.price * item.qty)}`,
        ].filter(Boolean);
        return bits.join("\n");
      })
      .join("\n\n");
    const couponLine = coupon && discount > 0 ? `Coupon: ${coupon.code} (− ${money(discount)})\n` : "";
    return `NEW ORDER - JM-STORE
------------------------------
${itemsText}

------------------------------
${couponLine}Total Amount: ${money(total)}

Customer Details:
- Name: ${name.trim()}
- Phone: ${phone.trim()}
- Address: ${address.trim()}

Order ID: ${orderId}
(Save this to track your order)`;
  }

  async function send() {
    if (!name.trim() || !phone.trim() || !email.trim() || !address.trim()) {
      toast.error("Please fill in your name, phone, email, and delivery address.");
      return;
    }
    const orderId = "JM" + Date.now().toString(36).toUpperCase();
    const snapshot = lines.map((item) => ({ ...item }));
    setSending(true);
    let tracked = true;
    try {
      await placeOrder({
        orderId,
        items: snapshot.map((item) => ({
          itemNo: item.itemNo,
          name: item.name,
          price: item.price,
          qty: item.qty,
          color: item.color || "",
          size: item.size || "",
        })),
        subtotal,
        couponCode: coupon?.code ?? "",
        discount,
        total,
        customerName: name.trim(),
        customerPhone: phone.trim(),
        customerEmail: email.trim(),
        customerAddress: address.trim(),
        status: "Pending",
        createdAt: Date.now(),
      });
    } catch {
      tracked = false;
    } finally {
      setSending(false);
    }
    finishCartOrder();
    setPlaced(orderId);
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(whatsappText(orderId, snapshot))}`;
    window.open(url, "_blank", "noopener,noreferrer");
    if (!tracked) toast.error("Order will still open in WhatsApp. Tracking could not be saved.");
  }

  if (placed) {
    return (
      <div className="z-checkout fixed inset-0 flex items-end bg-ink/50 sm:items-center sm:justify-center">
        <div className="w-full rounded-t-3xl bg-cream p-5 sm:max-w-md sm:rounded-3xl">
          <p className="text-xs font-semibold tracking-widest text-brick uppercase">Order placed</p>
          <h2 className="mt-1 font-display text-3xl font-semibold">Save this Order ID</h2>
          <p className="mt-3 rounded-2xl bg-surface px-4 py-3 text-center font-display text-2xl tracking-wide text-teal">{placed}</p>
          <p className="mt-3 text-sm text-pretty text-ink/75">
            WhatsApp should be open with your order filled in. Hit send there. Use this ID any time under Track.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              className="h-12 rounded-xl border border-ink font-medium"
              onClick={() => {
                void navigator.clipboard.writeText(placed).then(() => toast.success("Order ID copied"));
              }}
            >
              Copy ID
            </button>
            <button type="button" className="h-12 rounded-xl bg-teal font-medium text-ivory" onClick={closeCheckout}>
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="z-checkout fixed inset-0 flex flex-col bg-cream">
      <header className="flex items-center justify-between border-b border-line px-3 py-2">
        <button type="button" aria-label="Close" onClick={closeCheckout} className="flex size-11 items-center justify-center rounded-full">
          <X className="size-5" />
        </button>
        <h2 className="font-display text-lg font-semibold">Confirm your order</h2>
        <span className="w-11 text-center text-sm text-ink/60">{step}/2</span>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {step === 1 ? (
          <div className="space-y-4">
            <p className="text-sm text-ink/70">We'll open WhatsApp with these details filled in.</p>
            {lines.map((item, index) => (
              <div key={item.cartId} className="rounded-2xl border border-line bg-surface p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-xs text-ink/60">
                      #{item.itemNo}
                      {item.color ? ` · ${item.color}` : ""}
                      {item.size ? ` / ${item.size}` : ""}
                    </p>
                  </div>
                  <p className="tabular-nums font-semibold text-brick">{money(item.price * item.qty)}</p>
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <button type="button" aria-label="Decrease" onClick={() => adjustOrderQty(index, item.qty - 1)} className="flex size-10 items-center justify-center rounded-full border border-line">
                    <Minus className="size-4" />
                  </button>
                  <span className="tabular-nums">{item.qty}</span>
                  <button type="button" aria-label="Increase" onClick={() => adjustOrderQty(index, item.qty + 1)} className="flex size-10 items-center justify-center rounded-full border border-line">
                    <Plus className="size-4" />
                  </button>
                </div>
              </div>
            ))}
            {related.length > 0 && (
              <div>
                <h3 className="font-display text-lg font-semibold">You may also like</h3>
                <div className="mt-2 space-y-2">
                  {related.map((product) => (
                    <div key={product.id} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-2">
                      <button type="button" onClick={() => openProduct(product.id)} className="size-14 overflow-hidden rounded-xl bg-line/40">
                        {product.images[0] && <img src={product.images[0]} alt="" className="h-full w-full object-cover" />}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{product.name}</p>
                        <p className="text-sm text-brick tabular-nums">{money(product.effectivePrice)}</p>
                      </div>
                      <button type="button" onClick={() => addRelatedToOrder(product)} className="h-10 rounded-full bg-teal px-3 text-sm font-medium text-ivory">
                        Add
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div>
              <label htmlFor="coupon" className="text-sm font-medium">Coupon code (optional)</label>
              <div className="mt-1 flex gap-2">
                <input id="coupon" value={code} onChange={(event) => setCode(event.target.value)} placeholder="e.g. SAVE10" className="h-12 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 uppercase outline-none focus:border-teal" />
                <button type="button" onClick={applyCoupon} className="h-12 rounded-xl border border-ink px-4 text-sm font-medium">
                  Apply
                </button>
              </div>
              {couponMsg && <p className="mt-1 text-sm text-teal">{couponMsg}</p>}
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-sm">
                <span>Coupon ({coupon?.code})</span>
                <span className="tabular-nums">− {money(discount)}</span>
              </div>
            )}
            <div className="flex justify-between font-display text-xl font-semibold">
              <span>Total</span>
              <span className="text-brick tabular-nums">{money(total)}</span>
            </div>
          </div>
        ) : (
          <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); void send(); }}>
            <Field label="Your name" value={name} onChange={setName} placeholder="e.g. Ahmed Raza" />
            <Field label="Contact number" value={phone} onChange={setPhone} placeholder="03xx-xxxxxxx" />
            <Field label="Email (for order updates)" value={email} onChange={setEmail} placeholder="you@example.com" type="email" />
            <label className="block text-sm font-medium">
              Delivery address
              <textarea value={address} onChange={(event) => setAddress(event.target.value)} placeholder="House / street, area, city" rows={3} className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-3 outline-none focus:border-teal" />
            </label>
            <button type="submit" disabled={sending} className="h-12 w-full rounded-xl bg-teal font-medium text-ivory disabled:opacity-60">
              {sending ? "Placing order…" : "Send via WhatsApp"}
            </button>
          </form>
        )}
      </div>
      {step === 1 && (
        <div className="sheet-pad grid grid-cols-2 gap-2 border-t border-line px-4 pt-3">
          <button type="button" onClick={closeCheckout} className="h-12 rounded-xl border border-ink font-medium">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              if (lines.length === 0) {
                toast.error("Your order is empty.");
                return;
              }
              setStep(2);
            }}
            className="h-12 rounded-xl bg-teal font-medium text-ivory"
          >
            Continue
          </button>
        </div>
      )}
      {step === 2 && (
        <div className="sheet-pad px-4 pt-3">
          <button type="button" onClick={() => setStep(1)} className="h-12 w-full rounded-xl border border-ink font-medium">
            Back to summary
          </button>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
}) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-12 w-full rounded-xl border border-line bg-surface px-3 font-normal outline-none focus:border-teal"
      />
    </label>
  );
}
