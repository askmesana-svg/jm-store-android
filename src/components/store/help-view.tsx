import { useState } from "react";
import { Star } from "lucide-react";
import clsx from "clsx";
import { toast } from "sonner";
import { submitReview } from "@/lib/store/api";
import { useStore } from "@/lib/store/store";
import { SITE_REVIEW_ID, WHATSAPP_DISPLAY, WHATSAPP_NUMBER } from "@/lib/store/types";

const FAQS = [
  ["How do I place an order?", "Pick your item(s), select colour and size, then either add to cart or order directly. Confirm your details and we'll open WhatsApp with your order pre-filled — just hit send."],
  ["Do you accept online payments?", "Currently all orders are confirmed and paid for via WhatsApp — usually cash on delivery, or bank transfer details shared by our team directly in chat."],
  ["How long does delivery take?", "Most orders within the city are delivered in 2–4 working days, and other areas in 4–7 working days depending on location."],
  ["How do I track my order?", "Open Track and enter the Order ID you received after checkout to see live status updates."],
  ["What if an item doesn't fit?", "Check the size guide before ordering. If it still doesn't fit, message us on WhatsApp within 3 days to arrange a swap."],
  ["Can I cancel or change my order?", "Yes — message us on WhatsApp with your Order ID as soon as possible. We can usually make changes as long as the order hasn't shipped yet."],
] as const;

const SIZES = [
  ["XS", "32–34", "26–28", "34–36", "26"],
  ["S", "34–36", "28–30", "36–38", "27"],
  ["M", "36–38", "30–32", "38–40", "28"],
  ["L", "38–40", "32–34", "40–42", "29"],
  ["XL", "40–42", "34–36", "42–44", "30"],
  ["XXL", "42–44", "36–38", "44–46", "31"],
];

export function HelpView() {
  const [open, setOpen] = useState<number | null>(0);
  const [guide, setGuide] = useState(false);
  const reviews = useStore((s) => s.reviews[SITE_REVIEW_ID] ?? []);
  const refreshCatalogue = useStore((s) => s.refreshCatalogue);
  const profileName = useStore((s) => s.profile.name);
  const [rating, setRating] = useState(0);
  const [name, setName] = useState(profileName);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <div className="space-y-10 px-4 py-6">
      <section id="about">
        <p className="text-xs font-semibold tracking-widest text-brick uppercase">About us</p>
        <h2 className="mt-1 font-display text-3xl font-semibold">Who we are</h2>
        <p className="mt-2 text-pretty text-ink/80">
          JM-Store is a Hyderabad-based shop bringing our in-person catalogue online. Browse items here, and when you're ready, your pick goes straight to us on WhatsApp — just like asking at the counter, minus the queue.
        </p>
      </section>

      <section>
        <p className="text-xs font-semibold tracking-widest text-brick uppercase">Help center</p>
        <h2 className="mt-1 font-display text-3xl font-semibold">Questions</h2>
        <button type="button" onClick={() => setGuide((value) => !value)} className="mt-4 h-11 rounded-xl border border-line px-4 text-sm font-medium text-teal">
          {guide ? "Hide size guide" : "View size guide"}
        </button>
        {guide && (
          <div className="mt-3 overflow-x-auto rounded-2xl border border-line">
            <table className="w-full border-collapse text-center text-xs">
              <thead className="bg-surface">
                <tr>
                  {["Size", "Chest (in)", "Waist (in)", "Hip (in)", "Length (in)"].map((head) => (
                    <th key={head} className="border-b border-line px-2 py-3 font-semibold">{head}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SIZES.map((row) => (
                  <tr key={row[0]}>
                    {row.map((cell) => (
                      <td key={cell} className="border-t border-line px-2 py-3">{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-4 divide-y divide-line border-y border-line">
          {FAQS.map(([question, answer], index) => (
            <div key={question}>
              <button type="button" onClick={() => setOpen(open === index ? null : index)} className="flex w-full items-center justify-between gap-3 py-4 text-left font-display text-lg font-semibold">
                {question}
                <span className={clsx("text-xl transition-transform", open === index && "rotate-45")}>+</span>
              </button>
              {open === index && <p className="pb-4 text-sm text-pretty text-ink/80">{answer}</p>}
            </div>
          ))}
        </div>
      </section>

      <section>
        <p className="text-xs font-semibold tracking-widest text-brick uppercase">Store policy</p>
        <h2 className="mt-1 font-display text-3xl font-semibold">Returns & exchange</h2>
        <Policy title="Eligibility" body="Items can be returned or exchanged within 3 days of delivery, provided they are unused, unwashed, and in their original packaging with tags intact." />
        <Policy title="How to request a return or exchange" body="Message us on WhatsApp with your Order ID and the reason. We'll confirm eligibility and arrange pickup or drop-off. Exchanges depend on stock of the size or colour you want." />
        <Policy title="Non-returnable items" body="Sale items, innerwear, and made-to-order pieces cannot be returned or exchanged unless defective or damaged on arrival." />
        <Policy title="Refunds" body="Approved refunds for any prepaid amount are processed via the original payment method within 5–7 business days. Cash-on-delivery orders are settled as store credit or an exchange." />
        <Policy title="Damaged or wrong item" body="If you receive a damaged, defective, or incorrect item, contact us within 48 hours of delivery with photos for a quick resolution." />
      </section>

      <section>
        <h2 className="font-display text-3xl font-semibold">Customer reviews</h2>
        <p className="mt-1 text-sm text-ink/70">What people say about JM-Store.</p>
        <div className="mt-4 space-y-3">
          {reviews.length === 0 && <p className="text-sm text-ink/70">No reviews yet — be the first to share your thoughts.</p>}
          {reviews.map((review) => (
            <article key={review.id} className="rounded-2xl border border-line bg-surface p-3">
              <div className="flex items-center justify-between">
                <p className="font-medium">{review.name}</p>
                <p className="text-sm text-marigold">{"★".repeat(review.rating)}</p>
              </div>
              {review.comment && <p className="mt-1 text-sm text-ink/80">{review.comment}</p>}
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
            setBusy(true);
            void submitReview({
              productId: SITE_REVIEW_ID,
              name: name.trim(),
              rating,
              comment: comment.trim(),
              createdAt: Date.now(),
            })
              .then(async () => {
                toast.success("Thanks for the review");
                setComment("");
                setRating(0);
                await refreshCatalogue();
              })
              .catch(() => toast.error("Couldn't submit your review."))
              .finally(() => setBusy(false));
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
          <textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="How was your order?" rows={3} className="w-full rounded-xl border border-line bg-surface px-3 py-3 outline-none focus:border-teal" />
          <button type="submit" disabled={busy} className="h-12 w-full rounded-xl bg-teal font-medium text-ivory disabled:opacity-60">
            Write a review
          </button>
        </form>
      </section>

      <section>
        <h2 className="font-display text-2xl font-semibold">Contact</h2>
        <p className="mt-2 text-ink/80">Qasimabad, Hyderabad, Sindh</p>
        <a href={`https://wa.me/${WHATSAPP_NUMBER}`} className="mt-3 inline-flex h-12 items-center rounded-xl bg-teal px-4 font-medium text-ivory">
          WhatsApp {WHATSAPP_DISPLAY}
        </a>
        <p className="mt-6 text-xs text-ink/50">All rights reserved JM-Store</p>
      </section>
    </div>
  );
}

function Policy({ title, body }: { title: string; body: string }) {
  return (
    <div className="mt-4">
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-pretty text-ink/80">{body}</p>
    </div>
  );
}
