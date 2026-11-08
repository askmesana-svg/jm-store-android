import { create } from "zustand";
import * as api from "./api";
import type {
  CartItem,
  Coupon,
  ExtraScreen,
  Product,
  Profile,
  Review,
  Selection,
  Session,
  SortKey,
  TabId,
} from "./types";

const CART_KEY = "jm_store_cart";
const WISH_KEY = "jm_store_wishlist";
const THEME_KEY = "jm_store_theme";
const SESSION_KEY = "jm_store_session";

type Checkout =
  | null
  | { source: "cart" }
  | { source: "buy"; items: CartItem[] };

type State = {
  ready: boolean;
  catalogError: string | null;
  products: Product[];
  categories: string[];
  coupons: Record<string, Coupon>;
  reviews: Record<string, Review[]>;
  marquee: string | null;
  cart: CartItem[];
  wishlist: string[];
  session: Session | null;
  profile: Profile;
  cloudSyncReady: boolean;
  dark: boolean;
  tab: TabId;
  screen: ExtraScreen;
  search: string;
  sort: SortKey;
  category: string;
  productId: string | null;
  selections: Record<string, Selection>;
  checkout: Checkout;
  lightbox: null | { images: string[]; index: number };
};

type Actions = {
  boot: () => Promise<void>;
  refreshCatalogue: () => Promise<void>;
  setTab: (tab: TabId) => void;
  setScreen: (screen: ExtraScreen) => void;
  setSearch: (search: string) => void;
  setSort: (sort: SortKey) => void;
  setCategory: (category: string) => void;
  toggleDark: () => void;
  openProduct: (id: string) => void;
  closeProduct: () => void;
  setSelection: (id: string, patch: Partial<Selection>) => void;
  selectionFor: (product: Product) => Selection;
  addToCart: (product: Product, selection?: Selection) => void;
  setQty: (cartId: number, qty: number) => void;
  removeFromCart: (cartId: number) => void;
  toggleWishlist: (productId: string) => void;
  openCheckoutCart: () => void;
  openCheckoutBuy: (product: Product) => void;
  closeCheckout: () => void;
  orderLines: () => CartItem[];
  adjustOrderQty: (index: number, qty: number) => void;
  addRelatedToOrder: (product: Product) => void;
  finishCartOrder: () => void;
  openLightbox: (images: string[], index: number) => void;
  closeLightbox: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: { name: string; phone: string; email: string; password: string }) => Promise<void>;
  signOut: () => void;
  saveProfile: (input: { name: string; phone: string; photoURL?: string }) => Promise<void>;
};

const emptyProfile: Profile = { name: "", phone: "", email: "", photoURL: "" };

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function variantKey(item: { id: string; color?: string; size?: string }) {
  return `${item.id}__${item.color || ""}__${item.size || ""}`;
}

const NO_LINES: CartItem[] = [];
let syncTimer: ReturnType<typeof setTimeout> | null = null;
let bootPromise: Promise<void> | null = null;

export const useStore = create<State & Actions>((set, get) => {
  function persistLocal() {
    const { cart, wishlist } = get();
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
      localStorage.setItem(WISH_KEY, JSON.stringify(wishlist));
    } catch {
      /* private mode */
    }
    scheduleSync();
  }

  function scheduleSync() {
    const { session, cloudSyncReady, cart, wishlist } = get();
    if (!session || !cloudSyncReady) return;
    if (syncTimer) clearTimeout(syncTimer);
    const snapshot = session;
    syncTimer = setTimeout(() => {
      void api
        .saveAccount(snapshot, { cart, wishlist, updatedAt: Date.now() })
        .then((fresh) => {
          if (get().session?.localId === fresh.localId) {
            set({ session: fresh });
            try {
              localStorage.setItem(SESSION_KEY, JSON.stringify(fresh));
            } catch {
              /* ignore */
            }
          }
        })
        .catch(() => {
          /* keep local cart even if cloud sync fails */
        });
    }, 500);
  }

  function rememberSession(session: Session | null) {
    try {
      if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      else localStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
  }

  return {
    ready: false,
    catalogError: null,
    products: [],
    categories: [],
    coupons: {},
    reviews: {},
    marquee: null,
    cart: [],
    wishlist: [],
    session: null,
    profile: emptyProfile,
    cloudSyncReady: false,
    dark: false,
    tab: "home",
    screen: null,
    search: "",
    sort: "featured",
    category: "All",
    productId: null,
    selections: {},
    checkout: null,
    lightbox: null,

    boot: () => {
      if (!bootPromise) {
        bootPromise = (async () => {
          let dark = false;
          try {
            const saved = localStorage.getItem(THEME_KEY);
            dark = saved ? saved === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
          } catch {
            dark = false;
          }
          const cart = readJson<CartItem[]>(CART_KEY, []).map((item) =>
            item.cartId ? item : { ...item, cartId: Date.now() + Math.random() },
          );
          const wishlist = readJson<string[]>(WISH_KEY, []);
          const session = readJson<Session | null>(SESSION_KEY, null);
          document.documentElement.classList.toggle("dark", dark);
          set({ dark, cart, wishlist, session });

          const tasks: Promise<void>[] = [get().refreshCatalogue()];
          if (session?.refreshToken) {
            tasks.push(
              (async () => {
                try {
                  const account = await api.loadAccount(session);
                  const keyset = new Set(account.cart.map(variantKey));
                  const merged = [
                    ...account.cart,
                    ...get().cart.filter((item) => !keyset.has(variantKey(item))),
                  ];
                  const wish = Array.from(new Set([...account.wishlist, ...get().wishlist]));
                  set({
                    session: account.session,
                    profile: account.profile,
                    cart: merged,
                    wishlist: wish,
                    cloudSyncReady: true,
                  });
                  rememberSession(account.session);
                  try {
                    localStorage.setItem(CART_KEY, JSON.stringify(merged));
                    localStorage.setItem(WISH_KEY, JSON.stringify(wish));
                  } catch {
                    /* ignore */
                  }
                  void api
                    .saveAccount(account.session, {
                      cart: merged,
                      wishlist: wish,
                      updatedAt: Date.now(),
                    })
                    .catch(() => undefined);
                } catch {
                  set({ session: null, profile: emptyProfile, cloudSyncReady: false });
                  rememberSession(null);
                }
              })(),
            );
          }
          await Promise.all(tasks);
          set({ ready: true });
        })();
      }
      return bootPromise;
    },

    refreshCatalogue: async () => {
      try {
        const data = await api.loadCatalogue();
        set({
          products: data.products,
          categories: data.categories,
          coupons: data.coupons,
          reviews: data.reviews,
          marquee: data.marquee,
          catalogError: null,
        });
      } catch (error) {
        set({
          catalogError: error instanceof Error ? error.message : "Could not load the catalogue.",
        });
      }
    },

    setTab: (tab) => set({ tab, screen: null }),
    setScreen: (screen) => set({ screen }),
    setSearch: (search) => set({ search, tab: search.trim() ? "shop" : get().tab, screen: null }),
    setSort: (sort) => set({ sort }),
    setCategory: (category) => set({ category, tab: "shop", screen: null }),
    toggleDark: () => {
      const dark = !get().dark;
      document.documentElement.classList.toggle("dark", dark);
      try {
        localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
      } catch {
        /* ignore */
      }
      set({ dark });
    },
    openProduct: (id) => set({ productId: id }),
    closeProduct: () => set({ productId: null }),
    setSelection: (id, patch) => {
      const product = get().products.find((item) => item.id === id);
      if (!product) return;
      const current = get().selectionFor(product);
      set({ selections: { ...get().selections, [id]: { ...current, ...patch } } });
    },
    selectionFor: (product) => {
      return (
        get().selections[product.id] ?? {
          color: product.colors[0]?.name ?? "",
          size: product.sizes[0] ?? "",
          qty: 1,
        }
      );
    },
    addToCart: (product, selection) => {
      const chosen = selection ?? get().selectionFor(product);
      const cart = get().cart;
      const key = variantKey({ id: product.id, color: chosen.color, size: chosen.size });
      const existing = cart.find((item) => variantKey(item) === key);
      const next = existing
        ? cart.map((item) =>
            item.cartId === existing.cartId
              ? { ...item, qty: Math.min(20, item.qty + chosen.qty) }
              : item,
          )
        : [
            ...cart,
            {
              cartId: Date.now() + Math.random(),
              id: product.id,
              itemNo: product.itemNo,
              name: product.name,
              price: product.effectivePrice,
              color: chosen.color,
              size: chosen.size,
              qty: chosen.qty,
            },
          ];
      set({ cart: next });
      persistLocal();
    },
    setQty: (cartId, qty) => {
      set({
        cart: get().cart.map((item) =>
          item.cartId === cartId ? { ...item, qty: Math.min(20, Math.max(1, qty)) } : item,
        ),
      });
      persistLocal();
    },
    removeFromCart: (cartId) => {
      set({ cart: get().cart.filter((item) => item.cartId !== cartId) });
      persistLocal();
    },
    toggleWishlist: (productId) => {
      const wishlist = get().wishlist.includes(productId)
        ? get().wishlist.filter((id) => id !== productId)
        : [...get().wishlist, productId];
      set({ wishlist });
      persistLocal();
    },
    openCheckoutCart: () => set({ checkout: { source: "cart" } }),
    openCheckoutBuy: (product) => {
      const chosen = get().selectionFor(product);
      set({
        checkout: {
          source: "buy",
          items: [
            {
              cartId: Date.now() + Math.random(),
              id: product.id,
              itemNo: product.itemNo,
              name: product.name,
              price: product.effectivePrice,
              color: chosen.color,
              size: chosen.size,
              qty: chosen.qty,
            },
          ],
        },
      });
    },
    closeCheckout: () => set({ checkout: null }),
    orderLines: () => {
      const { checkout, cart } = get();
      if (!checkout) return NO_LINES;
      return checkout.source === "cart" ? cart : checkout.items;
    },
    adjustOrderQty: (index, qty) => {
      const checkout = get().checkout;
      if (!checkout) return;
      const nextQty = Math.min(20, Math.max(1, qty));
      if (checkout.source === "cart") {
        const item = get().cart[index];
        if (!item) return;
        get().setQty(item.cartId, nextQty);
        return;
      }
      const items = checkout.items.map((item, i) => (i === index ? { ...item, qty: nextQty } : item));
      set({ checkout: { source: "buy", items } });
    },
    addRelatedToOrder: (product) => {
      const chosen = get().selectionFor(product);
      const line: CartItem = {
        cartId: Date.now() + Math.random(),
        id: product.id,
        itemNo: product.itemNo,
        name: product.name,
        price: product.effectivePrice,
        color: chosen.color,
        size: chosen.size,
        qty: 1,
      };
      const checkout = get().checkout;
      if (!checkout) return;
      if (checkout.source === "cart") {
        get().addToCart(product, { ...chosen, qty: 1 });
        return;
      }
      set({ checkout: { source: "buy", items: [...checkout.items, line] } });
    },
    finishCartOrder: () => {
      if (get().checkout?.source === "cart") {
        set({ cart: [] });
        persistLocal();
      }
    },
    openLightbox: (images, index) => set({ lightbox: { images, index } }),
    closeLightbox: () => set({ lightbox: null }),

    signIn: async (email, password) => {
      const session = await api.signIn(email.trim(), password);
      const account = await api.loadAccount(session).catch(() => ({
        session,
        profile: { ...emptyProfile, email: session.email },
        cart: [] as CartItem[],
        wishlist: [] as string[],
      }));
      const keyset = new Set(account.cart.map(variantKey));
      const merged = [...account.cart, ...get().cart.filter((item) => !keyset.has(variantKey(item)))];
      const wish = Array.from(new Set([...account.wishlist, ...get().wishlist]));
      set({
        session: account.session,
        profile: account.profile.email ? account.profile : { ...account.profile, email: session.email },
        cart: merged,
        wishlist: wish,
        cloudSyncReady: true,
      });
      rememberSession(account.session);
      try {
        localStorage.setItem(CART_KEY, JSON.stringify(merged));
        localStorage.setItem(WISH_KEY, JSON.stringify(wish));
      } catch {
        /* ignore */
      }
      void api
        .saveAccount(account.session, { cart: merged, wishlist: wish, updatedAt: Date.now() })
        .catch(() => undefined);
    },

    signUp: async ({ name, phone, email, password }) => {
      const session = await api.signUp(email.trim(), password, name.trim());
      const profile = { name: name.trim(), phone: phone.trim(), email: email.trim(), photoURL: "" };
      const cart = get().cart;
      const wishlist = get().wishlist;
      const fresh = await api.saveAccount(session, {
        name: profile.name,
        phone: profile.phone,
        email: profile.email,
        createdAt: Date.now(),
        cart,
        wishlist,
      });
      set({ session: fresh, profile, cloudSyncReady: true });
      rememberSession(fresh);
    },

    signOut: () => {
      set({
        session: null,
        profile: emptyProfile,
        cloudSyncReady: false,
        cart: [],
        wishlist: [],
      });
      rememberSession(null);
      try {
        localStorage.setItem(CART_KEY, "[]");
        localStorage.setItem(WISH_KEY, "[]");
      } catch {
        /* ignore */
      }
    },

    saveProfile: async ({ name, phone, photoURL }) => {
      const session = get().session;
      if (!session) return;
      const profile = {
        ...get().profile,
        name: name.trim(),
        phone: phone.trim(),
        ...(photoURL !== undefined ? { photoURL } : {}),
      };
      const fresh = await api.updateDisplayName(session, profile.name);
      const saved = await api.saveAccount(fresh, {
        name: profile.name,
        phone: profile.phone,
        email: profile.email || fresh.email,
        photoURL: profile.photoURL,
        updatedAt: Date.now(),
      });
      set({ session: saved, profile: { ...profile, email: profile.email || saved.email } });
      rememberSession(saved);
    },
  };
});

export function ratingSummary(reviews: Review[] | undefined) {
  if (!reviews || reviews.length === 0) return null;
  const avg = reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;
  return { avg, count: reviews.length };
}

export function money(value: number) {
  return `Rs. ${Math.round(value).toLocaleString("en-PK")}`;
}

export function visibleProducts(state: Pick<State, "products" | "category" | "search" | "sort" | "reviews">) {
  let list = state.products;
  if (state.category !== "All") list = list.filter((product) => product.category === state.category);
  const query = state.search.trim().toLowerCase();
  if (query) {
    list = list.filter(
      (product) =>
        product.name.toLowerCase().includes(query) ||
        product.itemNo.toLowerCase().includes(query) ||
        product.category.toLowerCase().includes(query) ||
        product.colors.some((color) => color.name.toLowerCase().includes(query)),
    );
  }
  const sorted = [...list];
  switch (state.sort) {
    case "newest":
      sorted.sort((a, b) => b.listedAt - a.listedAt);
      break;
    case "price-low":
      sorted.sort((a, b) => a.effectivePrice - b.effectivePrice);
      break;
    case "price-high":
      sorted.sort((a, b) => b.effectivePrice - a.effectivePrice);
      break;
    case "popular":
      sorted.sort((a, b) => popularity(state.reviews, b.id) - popularity(state.reviews, a.id));
      break;
    default:
      sorted.sort((a, b) => a.order - b.order);
  }
  return sorted;
}

function popularity(reviews: Record<string, Review[]>, id: string) {
  const summary = ratingSummary(reviews[id]);
  return summary ? summary.count * summary.avg : 0;
}

export function relatedProducts(products: Product[], lines: CartItem[], limit = 3) {
  const ids = new Set(lines.map((line) => line.id));
  const categories = new Set(
    lines
      .map((line) => products.find((product) => product.id === line.id)?.category)
      .filter((category): category is string => !!category),
  );
  let related = products.filter((product) => categories.has(product.category) && !ids.has(product.id));
  if (related.length === 0) related = products.filter((product) => !ids.has(product.id));
  return related.slice(0, limit);
}
