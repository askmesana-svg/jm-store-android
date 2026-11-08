import { useEffect } from "react";
import {
  Heart,
  Home,
  MessageCircle,
  Moon,
  Search,
  ShoppingBag,
  Sun,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";
import clsx from "clsx";
import { Toaster } from "sonner";
import { AccountView } from "@/components/store/account-view";
import { BagView } from "@/components/store/bag-view";
import { CheckoutSheet } from "@/components/store/checkout-sheet";
import { HelpView } from "@/components/store/help-view";
import { ProductCard } from "@/components/store/product-card";
import { ProductSheet } from "@/components/store/product-sheet";
import { TrackView } from "@/components/store/track-view";
import { useStore, visibleProducts } from "@/lib/store/store";
import { LOGO_URL, WHATSAPP_NUMBER, type TabId } from "@/lib/store/types";

const TABS: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "shop", label: "Shop", icon: Search },
  { id: "saved", label: "Saved", icon: Heart },
  { id: "bag", label: "Cart", icon: ShoppingBag },
  { id: "me", label: "Account", icon: UserRound },
];

export function Shell() {
  const tab = useStore((s) => s.tab);
  const screen = useStore((s) => s.screen);
  const search = useStore((s) => s.search);
  const dark = useStore((s) => s.dark);
  const marquee = useStore((s) => s.marquee);
  const cartCount = useStore((s) => s.cart.reduce((sum, item) => sum + item.qty, 0));
  const savedCount = useStore((s) => s.wishlist.length);
  const setTab = useStore((s) => s.setTab);
  const setScreen = useStore((s) => s.setScreen);
  const setSearch = useStore((s) => s.setSearch);
  const toggleDark = useStore((s) => s.toggleDark);
  const refreshCatalogue = useStore((s) => s.refreshCatalogue);
  const openProduct = useStore((s) => s.openProduct);
  const lightbox = useStore((s) => s.lightbox);
  const closeLightbox = useStore((s) => s.closeLightbox);
  const productOpen = useStore((s) => s.productId);

  useEffect(() => {
    const openHash = () => {
      const match = location.hash.match(/^#item-(.+)$/);
      if (!match) return;
      const itemNo = decodeURIComponent(match[1]);
      const product = useStore.getState().products.find((item) => item.itemNo === itemNo);
      if (product) openProduct(product.id);
    };
    openHash();
    window.addEventListener("hashchange", openHash);
    const refresh = () => {
      if (document.visibilityState === "visible") void refreshCatalogue();
    };
    document.addEventListener("visibilitychange", refresh);
    const timer = window.setInterval(() => void refreshCatalogue(), 60_000);
    return () => {
      window.removeEventListener("hashchange", openHash);
      document.removeEventListener("visibilitychange", refresh);
      window.clearInterval(timer);
    };
  }, [openProduct, refreshCatalogue]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const state = useStore.getState();
      if (state.lightbox) state.closeLightbox();
      else if (state.checkout) state.closeCheckout();
      else if (state.productId) state.closeProduct();
      else if (state.screen) state.setScreen(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const title =
    screen === "track" ? "Track order" : screen === "help" ? "Help" : TABS.find((item) => item.id === tab)?.label;

  return (
    <div className="min-h-dvh bg-cream text-ink">
      <Toaster position="top-center" />
      <header className="sticky top-0 z-30 border-b border-line bg-cream/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 pt-3">
          <button type="button" onClick={() => setTab("home")} className="flex min-w-0 items-center gap-2">
            <img src={LOGO_URL} alt="" className="size-9 rounded-lg object-cover" />
            <span className="font-display text-xl font-bold tracking-tight">
              JM<span className="text-brick">-</span>Store
            </span>
          </button>
          <div className="flex items-center gap-2">
            <button type="button" aria-label={dark ? "Switch to light mode" : "Switch to dark mode"} onClick={toggleDark} className="flex size-11 items-center justify-center rounded-full border border-line bg-surface">
              {dark ? <Sun className="size-5" /> : <Moon className="size-5" />}
            </button>
            <a href={`https://wa.me/${WHATSAPP_NUMBER}`} aria-label="WhatsApp the shop" className="flex size-11 items-center justify-center rounded-full bg-teal text-ivory">
              <MessageCircle className="size-5" />
            </a>
          </div>
        </div>
        <form
          className="mx-auto max-w-5xl px-4 pt-2 pb-3"
          onSubmit={(event) => {
            event.preventDefault();
            setTab("shop");
          }}
        >
          <label className="flex h-12 items-center gap-2 rounded-full border border-line bg-surface px-3 focus-within:border-teal">
            <Search className="size-4 text-teal" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, item no, colour"
              className="h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-ink/40"
            />
            {search && (
              <button type="button" aria-label="Clear search" onClick={() => setSearch("")}>
                <X className="size-4" />
              </button>
            )}
          </label>
        </form>
        {marquee && (
          <div className="overflow-hidden border-t border-line bg-marigold text-teal-deep">
            <div className="marquee flex w-max gap-16 py-2 text-sm font-semibold">
              <span>{marquee}</span>
              <span aria-hidden="true">{marquee}</span>
            </div>
          </div>
        )}
      </header>

      <main className="mx-auto min-h-[70dvh] max-w-5xl pb-28">
        {screen === "track" && (
          <>
            <Back onBack={() => setScreen(null)} title={title ?? ""} />
            <TrackView />
          </>
        )}
        {screen === "help" && (
          <>
            <Back onBack={() => setScreen(null)} title={title ?? ""} />
            <HelpView />
          </>
        )}
        {!screen && tab === "home" && <HomeView />}
        {!screen && tab === "shop" && <Shop />}
        {!screen && tab === "saved" && <Saved />}
        {!screen && tab === "bag" && <BagView />}
        {!screen && tab === "me" && <AccountView />}
      </main>

      <nav className="tabbar fixed inset-x-0 bottom-0 z-30 border-t border-line bg-cream/95 backdrop-blur">
        <ul className="mx-auto grid max-w-5xl grid-cols-5">
          {TABS.map((item) => {
            const Icon = item.icon;
            const active = !screen && tab === item.id;
            const badge = item.id === "bag" ? cartCount : item.id === "saved" ? savedCount : 0;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={clsx(
                    "relative flex h-16 w-full flex-col items-center justify-center gap-0.5 text-xs font-medium",
                    active ? "text-teal" : "text-ink/55",
                  )}
                >
                  <Icon className="size-5" fill={active && (item.id === "saved" || item.id === "home") ? "currentColor" : "none"} />
                  {item.label}
                  {badge > 0 && (
                    <span className="absolute top-1 right-4 flex min-w-5 items-center justify-center rounded-full bg-marigold px-1 text-xs font-bold text-teal-deep">
                      {badge}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {productOpen && <ProductSheet />}
      <CheckoutSheet />
      {lightbox && (
        <div className="z-lightbox fixed inset-0 flex flex-col bg-ink text-ivory">
          <div className="flex justify-end p-2">
            <button type="button" aria-label="Close photos" onClick={closeLightbox} className="flex size-11 items-center justify-center rounded-full bg-ivory/15">
              <X />
            </button>
          </div>
          <div className="flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto">
            {lightbox.images.map((src, index) => (
              <img key={src + index} src={src} alt="" className="h-full w-full shrink-0 snap-center object-contain" />
            ))}
          </div>
          <p className="py-4 text-center text-sm">{lightbox.images.length} photos</p>
        </div>
      )}
    </div>
  );
}

function Back({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-2 px-2 pt-2">
      <button type="button" onClick={onBack} className="h-11 rounded-full px-3 text-sm font-medium text-teal">
        Back
      </button>
      <h1 className="font-display text-lg font-semibold">{title}</h1>
    </div>
  );
}

function HomeView() {
  const products = useStore((s) => s.products);
  const categories = useStore((s) => s.categories);
  const error = useStore((s) => s.catalogError);
  const setCategory = useStore((s) => s.setCategory);
  const setTab = useStore((s) => s.setTab);
  const setScreen = useStore((s) => s.setScreen);
  const refreshCatalogue = useStore((s) => s.refreshCatalogue);

  const arrivals = [...products].filter((product) => product.createdAt).sort((a, b) => b.createdAt - a.createdAt).slice(0, 8);
  const arrivalIds = new Set(arrivals.map((product) => product.id));
  const groups = new Map<string, typeof products>();
  for (const product of products) {
    if (arrivalIds.has(product.id)) continue;
    const key = product.category || "More";
    const list = groups.get(key) ?? [];
    list.push(product);
    groups.set(key, list);
  }

  return (
    <div>
      <section className="px-4 pt-8 pb-4 text-center">
        <p className="text-xs font-semibold tracking-widest text-brick uppercase">Item no. · Colour · WhatsApp</p>
        <h1 className="mx-auto mt-3 max-w-xl font-display text-4xl leading-none font-semibold text-balance sm:text-5xl">
          The shop counter, <em className="text-teal">moved to your chat.</em>
        </h1>
        <p className="mx-auto mt-4 max-w-md text-pretty text-ink/75">
          Browse the JM-Store catalogue, pick your item number, colour and quantity, drop your delivery address — and your order lands straight in our WhatsApp.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button type="button" onClick={() => setTab("shop")} className="h-12 rounded-xl bg-teal px-5 font-medium text-ivory">
            Browse catalogue
          </button>
          <button type="button" onClick={() => setScreen("help")} className="h-12 rounded-xl border border-ink px-5 font-medium">
            About us
          </button>
        </div>
      </section>
      <div className="flex gap-2 overflow-x-auto px-4 pb-2">
        <Quick label="Track order" onClick={() => setScreen("track")} />
        <Quick label="Size & FAQ" onClick={() => setScreen("help")} />
        <Quick label="Reviews" onClick={() => setScreen("help")} />
      </div>
      <div className="flex gap-2 overflow-x-auto px-4 py-3">
        <Chip active={false} onClick={() => setCategory("All")}>All</Chip>
        {categories.map((name) => (
          <Chip key={name} active={false} onClick={() => setCategory(name)}>{name}</Chip>
        ))}
      </div>
      {error && (
        <div className="mx-4 rounded-2xl border border-line bg-surface p-4">
          <p className="font-medium">Couldn’t load the catalogue.</p>
          <button type="button" onClick={() => void refreshCatalogue()} className="mt-3 h-11 rounded-xl bg-teal px-4 text-sm font-medium text-ivory">
            Try again
          </button>
        </div>
      )}
      {!error && products.length === 0 && <p className="px-4 py-8 text-center text-ink/70">The catalogue is empty right now.</p>}
      {arrivals.length > 0 && <Row title="New arrivals" items={arrivals} onSeeAll={() => { useStore.setState({ sort: "newest" }); setTab("shop"); }} />}
      {[...groups.entries()].map(([name, items]) => (
        <Row key={name} title={name} items={items} onSeeAll={() => setCategory(name)} />
      ))}
    </div>
  );
}

function Shop() {
  const products = useStore((s) => s.products);
  const categories = useStore((s) => s.categories);
  const category = useStore((s) => s.category);
  const sort = useStore((s) => s.sort);
  const search = useStore((s) => s.search);
  const reviews = useStore((s) => s.reviews);
  const error = useStore((s) => s.catalogError);
  const setCategory = useStore((s) => s.setCategory);
  const setSort = useStore((s) => s.setSort);
  const list = visibleProducts({ products, category, search, sort, reviews });

  return (
    <div className="px-4 py-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-3xl font-semibold">Catalogue</h2>
          <p className="mt-1 max-w-sm text-sm text-ink/70">Every item has its own number — quote it and we’ll know exactly what you mean.</p>
        </div>
        <label className="text-xs font-medium text-ink/70">
          Sort
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as typeof sort)}
            className="mt-1 block h-11 rounded-xl border border-line bg-surface px-2 text-sm text-ink"
          >
            <option value="featured">Featured</option>
            <option value="newest">Newest</option>
            <option value="price-low">Price: Low to High</option>
            <option value="price-high">Price: High to Low</option>
            <option value="popular">Most popular</option>
          </select>
        </label>
      </div>
      <div className="mt-4 flex gap-2 overflow-x-auto pb-3">
        <Chip active={category === "All"} onClick={() => useStore.setState({ category: "All" })}>All</Chip>
        {categories.map((name) => (
          <Chip key={name} active={category === name} onClick={() => setCategory(name)}>{name}</Chip>
        ))}
      </div>
      {error && <p className="text-sm text-brick">{error}</p>}
      {list.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface p-6 text-center">
          <h3 className="font-display text-2xl font-semibold">Product not available</h3>
          <p className="mt-1 text-sm text-ink/70">Sorry, we couldn’t find any matching products.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {list.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}

function Saved() {
  const wishlist = useStore((s) => s.wishlist);
  const products = useStore((s) => s.products);
  const items = wishlist
    .map((id) => products.find((product) => product.id === id))
    .filter((product): product is NonNullable<typeof product> => !!product);
  const setTab = useStore((s) => s.setTab);
  if (items.length === 0) {
    return (
      <div className="px-4 py-16 text-center">
        <h2 className="font-display text-3xl font-semibold">Nothing saved yet</h2>
        <p className="mt-2 text-ink/70">Tap the heart on any product to keep it here.</p>
        <button type="button" onClick={() => setTab("shop")} className="mt-6 h-12 rounded-xl bg-teal px-6 font-medium text-ivory">
          Browse catalogue
        </button>
      </div>
    );
  }
  return (
    <div className="px-4 py-4">
      <h2 className="font-display text-3xl font-semibold">Wishlist</h2>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {items.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
}

function Row({ title, items, onSeeAll }: { title: string; items: { id: string }[]; onSeeAll: () => void }) {
  const products = useStore((s) => s.products);
  const cards = items
    .map((item) => products.find((product) => product.id === item.id))
    .filter((product) => !!product);
  if (cards.length === 0) return null;
  return (
    <section className="mt-2 mb-4">
      <div className="flex items-center justify-between px-4">
        <h2 className="font-display text-xl font-semibold">{title}</h2>
        <button type="button" onClick={onSeeAll} className="text-sm font-medium text-teal">See all</button>
      </div>
      <div className="mt-3 flex snap-x gap-3 overflow-x-auto px-4 pb-2 md:grid md:grid-cols-3 md:overflow-visible lg:grid-cols-4">
        {cards.map((product) => (
          <ProductCard key={product.id} product={product} compact />
        ))}
      </div>
    </section>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "h-10 shrink-0 rounded-full border px-4 text-sm font-medium",
        active ? "border-teal bg-teal text-ivory" : "border-line bg-surface text-ink",
      )}
    >
      {children}
    </button>
  );
}

function Quick({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="h-10 shrink-0 rounded-full border border-line bg-surface px-4 text-sm font-medium">
      {label}
    </button>
  );
}
