import type { CartItem, Coupon, Product, Review, Session } from "./types";

const API_KEY = "AIzaSyCzkPjeewFjdnhBvOE-OpwaM1zCe_2RiCs";
const PROJECT = "jm-store-6655a";
const DOCS = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

type FsValue = Record<string, unknown>;

function num(v: unknown): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : 0;
}

function parseValue(v: FsValue | undefined): unknown {
  if (!v) return null;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return num(v.integerValue);
  if ("doubleValue" in v) return num(v.doubleValue);
  if ("booleanValue" in v) return v.booleanValue;
  if ("nullValue" in v) return null;
  if ("timestampValue" in v) return v.timestampValue;
  if ("arrayValue" in v) {
    const values = (v.arrayValue as { values?: FsValue[] } | undefined)?.values ?? [];
    return values.map((item) => parseValue(item));
  }
  if ("mapValue" in v) {
    const fields = (v.mapValue as { fields?: Record<string, FsValue> } | undefined)?.fields ?? {};
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(fields)) out[key] = parseValue(val);
    return out;
  }
  return null;
}

function parseDoc(doc: { name?: string; fields?: Record<string, FsValue>; createTime?: string }) {
  const id = doc.name?.split("/").pop() ?? "";
  const data: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(doc.fields ?? {})) data[key] = parseValue(val);
  const createdMs = doc.createTime ? Date.parse(doc.createTime) : 0;
  return { id, data, createdMs: Number.isFinite(createdMs) ? createdMs : 0 };
}

function toValue(value: unknown): FsValue {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    if (Number.isInteger(value) && Math.abs(value) < Number.MAX_SAFE_INTEGER) {
      return { integerValue: String(value) };
    }
    return { doubleValue: value };
  }
  if (Array.isArray(value)) {
    return { arrayValue: value.length ? { values: value.map((item) => toValue(item)) } : {} };
  }
  if (typeof value === "object") {
    const fields: Record<string, FsValue> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      fields[key] = toValue(val);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(value) };
}

function toFields(data: Record<string, unknown>) {
  const fields: Record<string, FsValue> = {};
  for (const [key, val] of Object.entries(data)) fields[key] = toValue(val);
  return fields;
}

async function readError(res: Response) {
  try {
    const body = (await res.json()) as { error?: { message?: string } };
    return body.error?.message || res.statusText;
  } catch {
    return res.statusText;
  }
}

export async function listCollection(name: string) {
  const rows: ReturnType<typeof parseDoc>[] = [];
  let pageToken = "";
  do {
    const url = new URL(`${DOCS}/${name}`);
    url.searchParams.set("pageSize", "100");
    url.searchParams.set("key", API_KEY);
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const res = await fetch(url);
    if (!res.ok) throw new Error(await readError(res));
    const body = (await res.json()) as {
      documents?: { name?: string; fields?: Record<string, FsValue>; createTime?: string }[];
      nextPageToken?: string;
    };
    for (const doc of body.documents ?? []) rows.push(parseDoc(doc));
    pageToken = body.nextPageToken ?? "";
  } while (pageToken);
  return rows;
}

export async function getDocument(path: string, token?: string) {
  const url = new URL(`${DOCS}/${path}`);
  url.searchParams.set("key", API_KEY);
  const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await readError(res));
  return parseDoc(await res.json());
}

async function createDocument(collection: string, data: Record<string, unknown>, token?: string) {
  const url = new URL(`${DOCS}/${collection}`);
  url.searchParams.set("key", API_KEY);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ fields: toFields(data) }),
  });
  if (!res.ok) throw new Error(await readError(res));
}

async function patchDocument(
  path: string,
  data: Record<string, unknown>,
  token?: string,
) {
  const url = new URL(`${DOCS}/${path}`);
  url.searchParams.set("key", API_KEY);
  for (const key of Object.keys(data)) url.searchParams.append("updateMask.fieldPaths", key);
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ fields: toFields(data) }),
  });
  if (!res.ok) throw new Error(await readError(res));
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

export function mapProduct(
  row: { id: string; data: Record<string, unknown>; createdMs: number },
  order: number,
): Product | null {
  if (row.data.hidden === true) return null;
  const images = asStringArray(row.data.images);
  const single = typeof row.data.img === "string" ? row.data.img : "";
  const gallery = images.length > 0 ? images : single ? [single] : [];
  const price = num(row.data.price);
  const rawDiscount =
    row.data.discountPrice === undefined || row.data.discountPrice === "" || row.data.discountPrice === null
      ? null
      : num(row.data.discountPrice);
  const discountPrice = rawDiscount !== null && rawDiscount < price ? rawDiscount : null;
  const stock =
    row.data.stock === undefined || row.data.stock === "" || row.data.stock === null
      ? null
      : num(row.data.stock);
  const colors = Array.isArray(row.data.colors)
    ? row.data.colors
        .map((c) => {
          if (!c || typeof c !== "object") return null;
          const rec = c as Record<string, unknown>;
          const name = typeof rec.name === "string" ? rec.name : "";
          const hex = typeof rec.hex === "string" ? rec.hex : "#cccccc";
          return name ? { name, hex } : null;
        })
        .filter((c): c is { name: string; hex: string } => !!c)
    : [];
  const createdAt = num(row.data.createdAt);
  const listedAt = createdAt || row.createdMs;
  return {
    id: row.id,
    itemNo: String(row.data.itemNo || row.data.id || row.id.slice(0, 6).toUpperCase()),
    name: String(row.data.name || "Untitled Product"),
    description: String(row.data.description || ""),
    price,
    discountPrice,
    effectivePrice: discountPrice ?? price,
    stock,
    images: gallery,
    colors,
    sizes: asStringArray(row.data.sizes),
    category: String(row.data.category || ""),
    createdAt,
    listedAt,
    order,
  };
}

export async function loadCatalogue() {
  const [productRows, categoryRows, couponRows, reviewRows, marqueeDoc] = await Promise.all([
    listCollection("products"),
    listCollection("categories"),
    listCollection("coupons").catch(() => []),
    listCollection("reviews").catch(() => []),
    getDocument("settings/marquee").catch(() => null),
  ]);

  const products = productRows
    .map((row, index) => mapProduct(row, index))
    .filter((p): p is Product => !!p);

  const categories: string[] = [];
  for (const row of categoryRows) {
    const name = row.data.name;
    if (typeof name === "string" && name && !categories.includes(name)) categories.push(name);
  }
  for (const product of products) {
    if (product.category && !categories.includes(product.category)) categories.push(product.category);
  }

  const coupons: Record<string, Coupon> = {};
  for (const row of couponRows) {
    const code = String(row.data.code || "").trim().toUpperCase();
    if (!code) continue;
    coupons[code] = {
      code,
      type: row.data.type === "flat" ? "flat" : "percent",
      value: num(row.data.value),
      active: row.data.active !== false,
    };
  }

  const reviews: Record<string, Review[]> = {};
  for (const row of reviewRows) {
    const productId = typeof row.data.productId === "string" ? row.data.productId : "";
    if (!productId) continue;
    const review: Review = {
      id: row.id,
      productId,
      name: String(row.data.name || "Anonymous"),
      rating: num(row.data.rating),
      comment: String(row.data.comment || ""),
      createdAt: num(row.data.createdAt),
    };
    (reviews[productId] ??= []).push(review);
  }
  for (const list of Object.values(reviews)) list.sort((a, b) => b.createdAt - a.createdAt);

  let marquee: string | null = null;
  if (marqueeDoc && marqueeDoc.data.enabled && typeof marqueeDoc.data.text === "string") {
    marquee = marqueeDoc.data.text;
  }

  return { products, categories, coupons, reviews, marquee };
}

export async function placeOrder(data: Record<string, unknown>) {
  await createDocument("orders", data);
}

export async function submitReview(data: Record<string, unknown>) {
  await createDocument("reviews", data);
}

export async function submitStockAlert(data: Record<string, unknown>) {
  await createDocument("stockAlerts", data);
}

export async function findOrder(orderId: string) {
  const url = new URL(`${DOCS}:runQuery`);
  url.searchParams.set("key", API_KEY);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: "orders" }],
        where: {
          fieldFilter: {
            field: { fieldPath: "orderId" },
            op: "EQUAL",
            value: { stringValue: orderId },
          },
        },
        limit: 1,
      },
    }),
  });
  if (!res.ok) throw new Error(await readError(res));
  const rows = (await res.json()) as { document?: { name?: string; fields?: Record<string, FsValue> } }[];
  const doc = rows.find((row) => row.document)?.document;
  if (!doc) return null;
  return parseDoc(doc).data;
}

type AuthPayload = {
  idToken: string;
  refreshToken: string;
  localId: string;
  email: string;
  expiresIn: string;
  displayName?: string;
};

function sessionFrom(payload: AuthPayload): Session {
  return {
    idToken: payload.idToken,
    refreshToken: payload.refreshToken,
    localId: payload.localId,
    email: payload.email,
    expiresAt: Date.now() + num(payload.expiresIn) * 1000,
  };
}

async function authPost(path: string, body: Record<string, unknown>) {
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/${path}?key=${API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as AuthPayload & { error?: { message?: string } };
  if (!res.ok) {
    const message = json.error?.message || "AUTH_FAILED";
    throw new Error(message.split(" ")[0] || message);
  }
  return json;
}

export function authErrorText(code: string) {
  if (code.includes("EMAIL_EXISTS")) return "This email is already registered — try signing in instead.";
  if (code.includes("INVALID_EMAIL")) return "Please enter a valid email address.";
  if (code.includes("WEAK_PASSWORD")) return "Password should be at least 6 characters.";
  if (
    code.includes("EMAIL_NOT_FOUND") ||
    code.includes("INVALID_PASSWORD") ||
    code.includes("INVALID_LOGIN_CREDENTIALS")
  ) {
    return "Incorrect email or password.";
  }
  if (code.includes("TOO_MANY_ATTEMPTS")) return "Too many attempts — please try again later.";
  return "Something went wrong. Please try again.";
}

export async function signIn(email: string, password: string) {
  const json = await authPost("accounts:signInWithPassword", {
    email,
    password,
    returnSecureToken: true,
  });
  return sessionFrom(json);
}

export async function signUp(email: string, password: string, name: string) {
  const json = await authPost("accounts:signUp", { email, password, returnSecureToken: true });
  const session = sessionFrom(json);
  await authPost("accounts:update", {
    idToken: session.idToken,
    displayName: name,
    returnSecureToken: true,
  });
  return session;
}

export async function refreshSession(session: Session): Promise<Session> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: session.refreshToken,
  });
  const res = await fetch(`https://securetoken.googleapis.com/v1/token?key=${API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json()) as {
    id_token?: string;
    refresh_token?: string;
    user_id?: string;
    expires_in?: string;
    error?: { message?: string };
  };
  if (!res.ok || !json.id_token || !json.refresh_token) {
    throw new Error(json.error?.message || "SESSION_EXPIRED");
  }
  return {
    idToken: json.id_token,
    refreshToken: json.refresh_token,
    localId: json.user_id || session.localId,
    email: session.email,
    expiresAt: Date.now() + num(json.expires_in) * 1000,
  };
}

export async function ensureSession(session: Session) {
  if (session.expiresAt > Date.now() + 60_000) return session;
  return refreshSession(session);
}

export function mapProfile(data: Record<string, unknown> | null, session: Session) {
  return {
    name: String(data?.name || ""),
    phone: String(data?.phone || ""),
    email: String(data?.email || session.email || ""),
    photoURL: String(data?.photoURL || ""),
  };
}

function mapCart(value: unknown): CartItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const rec = item as Record<string, unknown>;
      if (typeof rec.id !== "string") return null;
      return {
        cartId: num(rec.cartId) || Date.now() + Math.random(),
        id: rec.id,
        itemNo: String(rec.itemNo || ""),
        name: String(rec.name || ""),
        price: num(rec.price),
        color: String(rec.color || ""),
        size: String(rec.size || ""),
        qty: Math.min(20, Math.max(1, num(rec.qty) || 1)),
      } satisfies CartItem;
    })
    .filter((item): item is CartItem => !!item);
}

export async function loadAccount(session: Session) {
  const fresh = await ensureSession(session);
  const doc = await getDocument(`users/${fresh.localId}`, fresh.idToken);
  const wishlist = Array.isArray(doc?.data.wishlist)
    ? doc.data.wishlist.filter((id): id is string => typeof id === "string")
    : [];
  return {
    session: fresh,
    profile: mapProfile(doc?.data ?? null, fresh),
    cart: mapCart(doc?.data.cart),
    wishlist,
  };
}

export async function saveAccount(
  session: Session,
  data: Record<string, unknown>,
) {
  const fresh = await ensureSession(session);
  const path = `users/${fresh.localId}`;
  try {
    await patchDocument(path, data, fresh.idToken);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!message.includes("NOT_FOUND")) throw error;
    const url = new URL(`${DOCS}/users`);
    url.searchParams.set("key", API_KEY);
    url.searchParams.set("documentId", fresh.localId);
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${fresh.idToken}`,
      },
      body: JSON.stringify({ fields: toFields(data) }),
    });
    if (!res.ok) throw new Error(await readError(res));
  }
  return fresh;
}

export async function updateDisplayName(session: Session, name: string) {
  const fresh = await ensureSession(session);
  await authPost("accounts:update", {
    idToken: fresh.idToken,
    displayName: name,
    returnSecureToken: true,
  });
  return fresh;
}
