export type ColorOption = { name: string; hex: string };

export type Product = {
  id: string;
  itemNo: string;
  name: string;
  description: string;
  price: number;
  discountPrice: number | null;
  effectivePrice: number;
  stock: number | null;
  images: string[];
  colors: ColorOption[];
  sizes: string[];
  category: string;
  createdAt: number;
  listedAt: number;
  order: number;
};

export type Review = {
  id: string;
  productId: string;
  name: string;
  rating: number;
  comment: string;
  createdAt: number;
};

export type Coupon = {
  code: string;
  type: "percent" | "flat";
  value: number;
  active: boolean;
};

export type CartItem = {
  cartId: number;
  id: string;
  itemNo: string;
  name: string;
  price: number;
  color: string;
  size: string;
  qty: number;
};

export type Session = {
  idToken: string;
  refreshToken: string;
  localId: string;
  email: string;
  expiresAt: number;
};

export type Profile = {
  name: string;
  phone: string;
  email: string;
  photoURL: string;
};

export type Selection = { color: string; size: string; qty: number };

export type SortKey = "featured" | "newest" | "price-low" | "price-high" | "popular";

export type TabId = "home" | "shop" | "saved" | "bag" | "me";

export type ExtraScreen = null | "track" | "help";

export const SITE_REVIEW_ID = "site-general";
export const WHATSAPP_NUMBER = "923219890946";
export const WHATSAPP_DISPLAY = "0321-9890946";
export const LOGO_URL =
  "https://i.postimg.cc/W4j4BfW1/file-00000000816081fa941c8a4c7585bc0c.png";
