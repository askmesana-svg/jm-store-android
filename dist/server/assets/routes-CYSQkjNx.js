import { useEffect, useMemo, useRef, useState } from "react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { Heart, Home as Home$1, MessageCircle, Minus, Moon, Plus, Search, Share2, ShoppingBag, Star, Sun, Trash2, UserRound, X } from "lucide-react";
import clsx from "clsx";
import { Toaster, toast } from "sonner";
import { create } from "zustand";
//#region src/lib/store/api.ts
var API_KEY = "AIzaSyCzkPjeewFjdnhBvOE-OpwaM1zCe_2RiCs";
var DOCS = `https://firestore.googleapis.com/v1/projects/jm-store-6655a/databases/(default)/documents`;
function num(v) {
	const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
	return Number.isFinite(n) ? n : 0;
}
function parseValue(v) {
	if (!v) return null;
	if ("stringValue" in v) return v.stringValue;
	if ("integerValue" in v) return num(v.integerValue);
	if ("doubleValue" in v) return num(v.doubleValue);
	if ("booleanValue" in v) return v.booleanValue;
	if ("nullValue" in v) return null;
	if ("timestampValue" in v) return v.timestampValue;
	if ("arrayValue" in v) return (v.arrayValue?.values ?? []).map((item) => parseValue(item));
	if ("mapValue" in v) {
		const fields = v.mapValue?.fields ?? {};
		const out = {};
		for (const [key, val] of Object.entries(fields)) out[key] = parseValue(val);
		return out;
	}
	return null;
}
function parseDoc(doc) {
	const id = doc.name?.split("/").pop() ?? "";
	const data = {};
	for (const [key, val] of Object.entries(doc.fields ?? {})) data[key] = parseValue(val);
	const createdMs = doc.createTime ? Date.parse(doc.createTime) : 0;
	return {
		id,
		data,
		createdMs: Number.isFinite(createdMs) ? createdMs : 0
	};
}
function toValue(value) {
	if (value === null || value === void 0) return { nullValue: null };
	if (typeof value === "string") return { stringValue: value };
	if (typeof value === "boolean") return { booleanValue: value };
	if (typeof value === "number") {
		if (Number.isInteger(value) && Math.abs(value) < Number.MAX_SAFE_INTEGER) return { integerValue: String(value) };
		return { doubleValue: value };
	}
	if (Array.isArray(value)) return { arrayValue: value.length ? { values: value.map((item) => toValue(item)) } : {} };
	if (typeof value === "object") {
		const fields = {};
		for (const [key, val] of Object.entries(value)) fields[key] = toValue(val);
		return { mapValue: { fields } };
	}
	return { stringValue: String(value) };
}
function toFields(data) {
	const fields = {};
	for (const [key, val] of Object.entries(data)) fields[key] = toValue(val);
	return fields;
}
async function readError(res) {
	try {
		return (await res.json()).error?.message || res.statusText;
	} catch {
		return res.statusText;
	}
}
async function listCollection(name) {
	const rows = [];
	let pageToken = "";
	do {
		const url = new URL(`${DOCS}/${name}`);
		url.searchParams.set("pageSize", "100");
		url.searchParams.set("key", API_KEY);
		if (pageToken) url.searchParams.set("pageToken", pageToken);
		const res = await fetch(url);
		if (!res.ok) throw new Error(await readError(res));
		const body = await res.json();
		for (const doc of body.documents ?? []) rows.push(parseDoc(doc));
		pageToken = body.nextPageToken ?? "";
	} while (pageToken);
	return rows;
}
async function getDocument(path, token) {
	const url = new URL(`${DOCS}/${path}`);
	url.searchParams.set("key", API_KEY);
	const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
	if (res.status === 404) return null;
	if (!res.ok) throw new Error(await readError(res));
	return parseDoc(await res.json());
}
async function createDocument(collection, data, token) {
	const url = new URL(`${DOCS}/${collection}`);
	url.searchParams.set("key", API_KEY);
	const res = await fetch(url, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			...token ? { Authorization: `Bearer ${token}` } : {}
		},
		body: JSON.stringify({ fields: toFields(data) })
	});
	if (!res.ok) throw new Error(await readError(res));
}
async function patchDocument(path, data, token) {
	const url = new URL(`${DOCS}/${path}`);
	url.searchParams.set("key", API_KEY);
	for (const key of Object.keys(data)) url.searchParams.append("updateMask.fieldPaths", key);
	const res = await fetch(url, {
		method: "PATCH",
		headers: {
			"Content-Type": "application/json",
			...token ? { Authorization: `Bearer ${token}` } : {}
		},
		body: JSON.stringify({ fields: toFields(data) })
	});
	if (!res.ok) throw new Error(await readError(res));
}
function asStringArray(value) {
	return Array.isArray(value) ? value.filter((v) => typeof v === "string") : [];
}
function mapProduct(row, order) {
	if (row.data.hidden === true) return null;
	const images = asStringArray(row.data.images);
	const single = typeof row.data.img === "string" ? row.data.img : "";
	const gallery = images.length > 0 ? images : single ? [single] : [];
	const price = num(row.data.price);
	const rawDiscount = row.data.discountPrice === void 0 || row.data.discountPrice === "" || row.data.discountPrice === null ? null : num(row.data.discountPrice);
	const discountPrice = rawDiscount !== null && rawDiscount < price ? rawDiscount : null;
	const stock = row.data.stock === void 0 || row.data.stock === "" || row.data.stock === null ? null : num(row.data.stock);
	const colors = Array.isArray(row.data.colors) ? row.data.colors.map((c) => {
		if (!c || typeof c !== "object") return null;
		const rec = c;
		const name = typeof rec.name === "string" ? rec.name : "";
		const hex = typeof rec.hex === "string" ? rec.hex : "#cccccc";
		return name ? {
			name,
			hex
		} : null;
	}).filter((c) => !!c) : [];
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
		order
	};
}
async function loadCatalogue() {
	const [productRows, categoryRows, couponRows, reviewRows, marqueeDoc] = await Promise.all([
		listCollection("products"),
		listCollection("categories"),
		listCollection("coupons").catch(() => []),
		listCollection("reviews").catch(() => []),
		getDocument("settings/marquee").catch(() => null)
	]);
	const products = productRows.map((row, index) => mapProduct(row, index)).filter((p) => !!p);
	const categories = [];
	for (const row of categoryRows) {
		const name = row.data.name;
		if (typeof name === "string" && name && !categories.includes(name)) categories.push(name);
	}
	for (const product of products) if (product.category && !categories.includes(product.category)) categories.push(product.category);
	const coupons = {};
	for (const row of couponRows) {
		const code = String(row.data.code || "").trim().toUpperCase();
		if (!code) continue;
		coupons[code] = {
			code,
			type: row.data.type === "flat" ? "flat" : "percent",
			value: num(row.data.value),
			active: row.data.active !== false
		};
	}
	const reviews = {};
	for (const row of reviewRows) {
		const productId = typeof row.data.productId === "string" ? row.data.productId : "";
		if (!productId) continue;
		const review = {
			id: row.id,
			productId,
			name: String(row.data.name || "Anonymous"),
			rating: num(row.data.rating),
			comment: String(row.data.comment || ""),
			createdAt: num(row.data.createdAt)
		};
		(reviews[productId] ??= []).push(review);
	}
	for (const list of Object.values(reviews)) list.sort((a, b) => b.createdAt - a.createdAt);
	let marquee = null;
	if (marqueeDoc && marqueeDoc.data.enabled && typeof marqueeDoc.data.text === "string") marquee = marqueeDoc.data.text;
	return {
		products,
		categories,
		coupons,
		reviews,
		marquee
	};
}
async function placeOrder(data) {
	await createDocument("orders", data);
}
async function submitReview(data) {
	await createDocument("reviews", data);
}
async function submitStockAlert(data) {
	await createDocument("stockAlerts", data);
}
async function findOrder(orderId) {
	const url = new URL(`${DOCS}:runQuery`);
	url.searchParams.set("key", API_KEY);
	const res = await fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ structuredQuery: {
			from: [{ collectionId: "orders" }],
			where: { fieldFilter: {
				field: { fieldPath: "orderId" },
				op: "EQUAL",
				value: { stringValue: orderId }
			} },
			limit: 1
		} })
	});
	if (!res.ok) throw new Error(await readError(res));
	const doc = (await res.json()).find((row) => row.document)?.document;
	if (!doc) return null;
	return parseDoc(doc).data;
}
function sessionFrom(payload) {
	return {
		idToken: payload.idToken,
		refreshToken: payload.refreshToken,
		localId: payload.localId,
		email: payload.email,
		expiresAt: Date.now() + num(payload.expiresIn) * 1e3
	};
}
async function authPost(path, body) {
	const res = await fetch(`https://identitytoolkit.googleapis.com/v1/${path}?key=${API_KEY}`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body)
	});
	const json = await res.json();
	if (!res.ok) {
		const message = json.error?.message || "AUTH_FAILED";
		throw new Error(message.split(" ")[0] || message);
	}
	return json;
}
function authErrorText(code) {
	if (code.includes("EMAIL_EXISTS")) return "This email is already registered — try signing in instead.";
	if (code.includes("INVALID_EMAIL")) return "Please enter a valid email address.";
	if (code.includes("WEAK_PASSWORD")) return "Password should be at least 6 characters.";
	if (code.includes("EMAIL_NOT_FOUND") || code.includes("INVALID_PASSWORD") || code.includes("INVALID_LOGIN_CREDENTIALS")) return "Incorrect email or password.";
	if (code.includes("TOO_MANY_ATTEMPTS")) return "Too many attempts — please try again later.";
	return "Something went wrong. Please try again.";
}
async function signIn(email, password) {
	return sessionFrom(await authPost("accounts:signInWithPassword", {
		email,
		password,
		returnSecureToken: true
	}));
}
async function signUp(email, password, name) {
	const session = sessionFrom(await authPost("accounts:signUp", {
		email,
		password,
		returnSecureToken: true
	}));
	await authPost("accounts:update", {
		idToken: session.idToken,
		displayName: name,
		returnSecureToken: true
	});
	return session;
}
async function refreshSession(session) {
	const body = new URLSearchParams({
		grant_type: "refresh_token",
		refresh_token: session.refreshToken
	});
	const res = await fetch(`https://securetoken.googleapis.com/v1/token?key=${API_KEY}`, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body
	});
	const json = await res.json();
	if (!res.ok || !json.id_token || !json.refresh_token) throw new Error(json.error?.message || "SESSION_EXPIRED");
	return {
		idToken: json.id_token,
		refreshToken: json.refresh_token,
		localId: json.user_id || session.localId,
		email: session.email,
		expiresAt: Date.now() + num(json.expires_in) * 1e3
	};
}
async function ensureSession(session) {
	if (session.expiresAt > Date.now() + 6e4) return session;
	return refreshSession(session);
}
function mapProfile(data, session) {
	return {
		name: String(data?.name || ""),
		phone: String(data?.phone || ""),
		email: String(data?.email || session.email || ""),
		photoURL: String(data?.photoURL || "")
	};
}
function mapCart(value) {
	if (!Array.isArray(value)) return [];
	return value.map((item) => {
		if (!item || typeof item !== "object") return null;
		const rec = item;
		if (typeof rec.id !== "string") return null;
		return {
			cartId: num(rec.cartId) || Date.now() + Math.random(),
			id: rec.id,
			itemNo: String(rec.itemNo || ""),
			name: String(rec.name || ""),
			price: num(rec.price),
			color: String(rec.color || ""),
			size: String(rec.size || ""),
			qty: Math.min(20, Math.max(1, num(rec.qty) || 1))
		};
	}).filter((item) => !!item);
}
async function loadAccount(session) {
	const fresh = await ensureSession(session);
	const doc = await getDocument(`users/${fresh.localId}`, fresh.idToken);
	const wishlist = Array.isArray(doc?.data.wishlist) ? doc.data.wishlist.filter((id) => typeof id === "string") : [];
	return {
		session: fresh,
		profile: mapProfile(doc?.data ?? null, fresh),
		cart: mapCart(doc?.data.cart),
		wishlist
	};
}
async function saveAccount(session, data) {
	const fresh = await ensureSession(session);
	const path = `users/${fresh.localId}`;
	try {
		await patchDocument(path, data, fresh.idToken);
	} catch (error) {
		if (!(error instanceof Error ? error.message : "").includes("NOT_FOUND")) throw error;
		const url = new URL(`${DOCS}/users`);
		url.searchParams.set("key", API_KEY);
		url.searchParams.set("documentId", fresh.localId);
		const res = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${fresh.idToken}`
			},
			body: JSON.stringify({ fields: toFields(data) })
		});
		if (!res.ok) throw new Error(await readError(res));
	}
	return fresh;
}
async function updateDisplayName(session, name) {
	const fresh = await ensureSession(session);
	await authPost("accounts:update", {
		idToken: fresh.idToken,
		displayName: name,
		returnSecureToken: true
	});
	return fresh;
}
//#endregion
//#region src/lib/store/store.ts
var CART_KEY = "jm_store_cart";
var WISH_KEY = "jm_store_wishlist";
var THEME_KEY = "jm_store_theme";
var SESSION_KEY = "jm_store_session";
var emptyProfile = {
	name: "",
	phone: "",
	email: "",
	photoURL: ""
};
function readJson(key, fallback) {
	try {
		const raw = localStorage.getItem(key);
		return raw ? JSON.parse(raw) : fallback;
	} catch {
		return fallback;
	}
}
function variantKey(item) {
	return `${item.id}__${item.color || ""}__${item.size || ""}`;
}
var NO_LINES = [];
var syncTimer = null;
var bootPromise = null;
var useStore = create((set, get) => {
	function persistLocal() {
		const { cart, wishlist } = get();
		try {
			localStorage.setItem(CART_KEY, JSON.stringify(cart));
			localStorage.setItem(WISH_KEY, JSON.stringify(wishlist));
		} catch {}
		scheduleSync();
	}
	function scheduleSync() {
		const { session, cloudSyncReady, cart, wishlist } = get();
		if (!session || !cloudSyncReady) return;
		if (syncTimer) clearTimeout(syncTimer);
		const snapshot = session;
		syncTimer = setTimeout(() => {
			saveAccount(snapshot, {
				cart,
				wishlist,
				updatedAt: Date.now()
			}).then((fresh) => {
				if (get().session?.localId === fresh.localId) {
					set({ session: fresh });
					try {
						localStorage.setItem(SESSION_KEY, JSON.stringify(fresh));
					} catch {}
				}
			}).catch(() => {});
		}, 500);
	}
	function rememberSession(session) {
		try {
			if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
			else localStorage.removeItem(SESSION_KEY);
		} catch {}
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
			if (!bootPromise) bootPromise = (async () => {
				let dark = false;
				try {
					const saved = localStorage.getItem(THEME_KEY);
					dark = saved ? saved === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
				} catch {
					dark = false;
				}
				const cart = readJson(CART_KEY, []).map((item) => item.cartId ? item : {
					...item,
					cartId: Date.now() + Math.random()
				});
				const wishlist = readJson(WISH_KEY, []);
				const session = readJson(SESSION_KEY, null);
				document.documentElement.classList.toggle("dark", dark);
				set({
					dark,
					cart,
					wishlist,
					session
				});
				const tasks = [get().refreshCatalogue()];
				if (session?.refreshToken) tasks.push((async () => {
					try {
						const account = await loadAccount(session);
						const keyset = new Set(account.cart.map(variantKey));
						const merged = [...account.cart, ...get().cart.filter((item) => !keyset.has(variantKey(item)))];
						const wish = Array.from(/* @__PURE__ */ new Set([...account.wishlist, ...get().wishlist]));
						set({
							session: account.session,
							profile: account.profile,
							cart: merged,
							wishlist: wish,
							cloudSyncReady: true
						});
						rememberSession(account.session);
						try {
							localStorage.setItem(CART_KEY, JSON.stringify(merged));
							localStorage.setItem(WISH_KEY, JSON.stringify(wish));
						} catch {}
						saveAccount(account.session, {
							cart: merged,
							wishlist: wish,
							updatedAt: Date.now()
						}).catch(() => void 0);
					} catch {
						set({
							session: null,
							profile: emptyProfile,
							cloudSyncReady: false
						});
						rememberSession(null);
					}
				})());
				await Promise.all(tasks);
				set({ ready: true });
			})();
			return bootPromise;
		},
		refreshCatalogue: async () => {
			try {
				const data = await loadCatalogue();
				set({
					products: data.products,
					categories: data.categories,
					coupons: data.coupons,
					reviews: data.reviews,
					marquee: data.marquee,
					catalogError: null
				});
			} catch (error) {
				set({ catalogError: error instanceof Error ? error.message : "Could not load the catalogue." });
			}
		},
		setTab: (tab) => set({
			tab,
			screen: null
		}),
		setScreen: (screen) => set({ screen }),
		setSearch: (search) => set({
			search,
			tab: search.trim() ? "shop" : get().tab,
			screen: null
		}),
		setSort: (sort) => set({ sort }),
		setCategory: (category) => set({
			category,
			tab: "shop",
			screen: null
		}),
		toggleDark: () => {
			const dark = !get().dark;
			document.documentElement.classList.toggle("dark", dark);
			try {
				localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
			} catch {}
			set({ dark });
		},
		openProduct: (id) => set({ productId: id }),
		closeProduct: () => set({ productId: null }),
		setSelection: (id, patch) => {
			const product = get().products.find((item) => item.id === id);
			if (!product) return;
			const current = get().selectionFor(product);
			set({ selections: {
				...get().selections,
				[id]: {
					...current,
					...patch
				}
			} });
		},
		selectionFor: (product) => {
			return get().selections[product.id] ?? {
				color: product.colors[0]?.name ?? "",
				size: product.sizes[0] ?? "",
				qty: 1
			};
		},
		addToCart: (product, selection) => {
			const chosen = selection ?? get().selectionFor(product);
			const cart = get().cart;
			const key = variantKey({
				id: product.id,
				color: chosen.color,
				size: chosen.size
			});
			const existing = cart.find((item) => variantKey(item) === key);
			set({ cart: existing ? cart.map((item) => item.cartId === existing.cartId ? {
				...item,
				qty: Math.min(20, item.qty + chosen.qty)
			} : item) : [...cart, {
				cartId: Date.now() + Math.random(),
				id: product.id,
				itemNo: product.itemNo,
				name: product.name,
				price: product.effectivePrice,
				color: chosen.color,
				size: chosen.size,
				qty: chosen.qty
			}] });
			persistLocal();
		},
		setQty: (cartId, qty) => {
			set({ cart: get().cart.map((item) => item.cartId === cartId ? {
				...item,
				qty: Math.min(20, Math.max(1, qty))
			} : item) });
			persistLocal();
		},
		removeFromCart: (cartId) => {
			set({ cart: get().cart.filter((item) => item.cartId !== cartId) });
			persistLocal();
		},
		toggleWishlist: (productId) => {
			set({ wishlist: get().wishlist.includes(productId) ? get().wishlist.filter((id) => id !== productId) : [...get().wishlist, productId] });
			persistLocal();
		},
		openCheckoutCart: () => set({ checkout: { source: "cart" } }),
		openCheckoutBuy: (product) => {
			const chosen = get().selectionFor(product);
			set({ checkout: {
				source: "buy",
				items: [{
					cartId: Date.now() + Math.random(),
					id: product.id,
					itemNo: product.itemNo,
					name: product.name,
					price: product.effectivePrice,
					color: chosen.color,
					size: chosen.size,
					qty: chosen.qty
				}]
			} });
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
			set({ checkout: {
				source: "buy",
				items: checkout.items.map((item, i) => i === index ? {
					...item,
					qty: nextQty
				} : item)
			} });
		},
		addRelatedToOrder: (product) => {
			const chosen = get().selectionFor(product);
			const line = {
				cartId: Date.now() + Math.random(),
				id: product.id,
				itemNo: product.itemNo,
				name: product.name,
				price: product.effectivePrice,
				color: chosen.color,
				size: chosen.size,
				qty: 1
			};
			const checkout = get().checkout;
			if (!checkout) return;
			if (checkout.source === "cart") {
				get().addToCart(product, {
					...chosen,
					qty: 1
				});
				return;
			}
			set({ checkout: {
				source: "buy",
				items: [...checkout.items, line]
			} });
		},
		finishCartOrder: () => {
			if (get().checkout?.source === "cart") {
				set({ cart: [] });
				persistLocal();
			}
		},
		openLightbox: (images, index) => set({ lightbox: {
			images,
			index
		} }),
		closeLightbox: () => set({ lightbox: null }),
		signIn: async (email, password) => {
			const session = await signIn(email.trim(), password);
			const account = await loadAccount(session).catch(() => ({
				session,
				profile: {
					...emptyProfile,
					email: session.email
				},
				cart: [],
				wishlist: []
			}));
			const keyset = new Set(account.cart.map(variantKey));
			const merged = [...account.cart, ...get().cart.filter((item) => !keyset.has(variantKey(item)))];
			const wish = Array.from(/* @__PURE__ */ new Set([...account.wishlist, ...get().wishlist]));
			set({
				session: account.session,
				profile: account.profile.email ? account.profile : {
					...account.profile,
					email: session.email
				},
				cart: merged,
				wishlist: wish,
				cloudSyncReady: true
			});
			rememberSession(account.session);
			try {
				localStorage.setItem(CART_KEY, JSON.stringify(merged));
				localStorage.setItem(WISH_KEY, JSON.stringify(wish));
			} catch {}
			saveAccount(account.session, {
				cart: merged,
				wishlist: wish,
				updatedAt: Date.now()
			}).catch(() => void 0);
		},
		signUp: async ({ name, phone, email, password }) => {
			const session = await signUp(email.trim(), password, name.trim());
			const profile = {
				name: name.trim(),
				phone: phone.trim(),
				email: email.trim(),
				photoURL: ""
			};
			const cart = get().cart;
			const wishlist = get().wishlist;
			const fresh = await saveAccount(session, {
				name: profile.name,
				phone: profile.phone,
				email: profile.email,
				createdAt: Date.now(),
				cart,
				wishlist
			});
			set({
				session: fresh,
				profile,
				cloudSyncReady: true
			});
			rememberSession(fresh);
		},
		signOut: () => {
			set({
				session: null,
				profile: emptyProfile,
				cloudSyncReady: false,
				cart: [],
				wishlist: []
			});
			rememberSession(null);
			try {
				localStorage.setItem(CART_KEY, "[]");
				localStorage.setItem(WISH_KEY, "[]");
			} catch {}
		},
		saveProfile: async ({ name, phone, photoURL }) => {
			const session = get().session;
			if (!session) return;
			const profile = {
				...get().profile,
				name: name.trim(),
				phone: phone.trim(),
				...photoURL !== void 0 ? { photoURL } : {}
			};
			const fresh = await updateDisplayName(session, profile.name);
			const saved = await saveAccount(fresh, {
				name: profile.name,
				phone: profile.phone,
				email: profile.email || fresh.email,
				photoURL: profile.photoURL,
				updatedAt: Date.now()
			});
			set({
				session: saved,
				profile: {
					...profile,
					email: profile.email || saved.email
				}
			});
			rememberSession(saved);
		}
	};
});
function ratingSummary(reviews) {
	if (!reviews || reviews.length === 0) return null;
	return {
		avg: reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length,
		count: reviews.length
	};
}
function money(value) {
	return `Rs. ${Math.round(value).toLocaleString("en-PK")}`;
}
function visibleProducts(state) {
	let list = state.products;
	if (state.category !== "All") list = list.filter((product) => product.category === state.category);
	const query = state.search.trim().toLowerCase();
	if (query) list = list.filter((product) => product.name.toLowerCase().includes(query) || product.itemNo.toLowerCase().includes(query) || product.category.toLowerCase().includes(query) || product.colors.some((color) => color.name.toLowerCase().includes(query)));
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
		default: sorted.sort((a, b) => a.order - b.order);
	}
	return sorted;
}
function popularity(reviews, id) {
	const summary = ratingSummary(reviews[id]);
	return summary ? summary.count * summary.avg : 0;
}
function relatedProducts(products, lines, limit = 3) {
	const ids = new Set(lines.map((line) => line.id));
	const categories = new Set(lines.map((line) => products.find((product) => product.id === line.id)?.category).filter((category) => !!category));
	let related = products.filter((product) => categories.has(product.category) && !ids.has(product.id));
	if (related.length === 0) related = products.filter((product) => !ids.has(product.id));
	return related.slice(0, limit);
}
//#endregion
//#region src/components/store/account-view.tsx
function AccountView() {
	const session = useStore((s) => s.session);
	const profile = useStore((s) => s.profile);
	const signIn = useStore((s) => s.signIn);
	const signUp = useStore((s) => s.signUp);
	const signOut = useStore((s) => s.signOut);
	const saveProfile = useStore((s) => s.saveProfile);
	const setScreen = useStore((s) => s.setScreen);
	const [mode, setMode] = useState("signin");
	const [name, setName] = useState("");
	const [phone, setPhone] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);
	const [editing, setEditing] = useState(false);
	const [editName, setEditName] = useState(profile.name);
	const [editPhone, setEditPhone] = useState(profile.phone);
	const [photoNote, setPhotoNote] = useState("");
	const [installEvent, setInstallEvent] = useState(null);
	useEffect(() => {
		const onPrompt = (event) => {
			event.preventDefault();
			setInstallEvent(event);
		};
		window.addEventListener("beforeinstallprompt", onPrompt);
		return () => window.removeEventListener("beforeinstallprompt", onPrompt);
	}, []);
	if (!session) return /* @__PURE__ */ jsxs("div", {
		className: "px-4 py-6",
		children: [
			/* @__PURE__ */ jsx("p", {
				className: "text-xs font-semibold tracking-widest text-brick uppercase",
				children: "Account"
			}),
			/* @__PURE__ */ jsx("h2", {
				className: "mt-1 font-display text-3xl font-semibold text-balance",
				children: mode === "signin" ? "Sign in" : "Create account"
			}),
			/* @__PURE__ */ jsx("p", {
				className: "mt-2 text-sm text-pretty text-ink/70",
				children: mode === "signin" ? "Welcome back. This is the same JM-Store account as the website." : "Sign up to keep your cart, wishlist, and details on this phone and the website."
			}),
			/* @__PURE__ */ jsxs("form", {
				className: "mt-5 space-y-3",
				onSubmit: (event) => {
					event.preventDefault();
					setError("");
					if (!email.trim() || !password) {
						setError("Please fill in your email and password.");
						return;
					}
					if (mode === "signup" && (!name.trim() || !phone.trim())) {
						setError("Please fill in your name and phone number.");
						return;
					}
					setBusy(true);
					(mode === "signin" ? signIn(email, password) : signUp({
						name,
						phone,
						email,
						password
					})).then(() => {
						toast.success(mode === "signin" ? "You're logged in" : "You're signed up and logged in");
						setPassword("");
					}).catch((err) => {
						const code = err instanceof Error ? err.message : "";
						setError(authErrorText(code));
					}).finally(() => setBusy(false));
				},
				children: [
					mode === "signup" && /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx(Field$1, {
						label: "Full name",
						value: name,
						onChange: setName,
						placeholder: "e.g. Ahmed Raza"
					}), /* @__PURE__ */ jsx(Field$1, {
						label: "Phone number",
						value: phone,
						onChange: setPhone,
						placeholder: "03xx-xxxxxxx"
					})] }),
					/* @__PURE__ */ jsx(Field$1, {
						label: "Email",
						value: email,
						onChange: setEmail,
						placeholder: "you@example.com",
						type: "email"
					}),
					/* @__PURE__ */ jsx(Field$1, {
						label: "Password",
						value: password,
						onChange: setPassword,
						placeholder: "At least 6 characters",
						type: "password"
					}),
					error && /* @__PURE__ */ jsx("p", {
						className: "text-sm text-brick",
						children: error
					}),
					/* @__PURE__ */ jsx("button", {
						type: "submit",
						disabled: busy,
						className: "h-12 w-full rounded-xl bg-teal font-medium text-ivory disabled:opacity-60",
						children: mode === "signin" ? "Sign in" : "Sign up"
					}),
					/* @__PURE__ */ jsx("button", {
						type: "button",
						className: "h-12 w-full rounded-xl border border-ink font-medium",
						onClick: () => {
							setMode(mode === "signin" ? "signup" : "signin");
							setError("");
						},
						children: mode === "signin" ? "Create an account" : "Already have an account? Sign in"
					})
				]
			}),
			/* @__PURE__ */ jsx(InstallCard, { installEvent })
		]
	});
	const initial = (profile.name || profile.email || "?").charAt(0).toUpperCase();
	return /* @__PURE__ */ jsxs("div", {
		className: "px-4 py-6",
		children: [
			/* @__PURE__ */ jsx("p", {
				className: "text-xs font-semibold tracking-widest text-brick uppercase",
				children: "Your profile"
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "mt-4 flex flex-col items-center gap-2",
				children: [/* @__PURE__ */ jsxs("div", {
					className: "relative",
					children: [profile.photoURL ? /* @__PURE__ */ jsx("img", {
						src: profile.photoURL,
						alt: "",
						className: "size-24 rounded-full object-cover"
					}) : /* @__PURE__ */ jsx("div", {
						className: "flex size-24 items-center justify-center rounded-full bg-ink font-display text-3xl text-ivory",
						children: initial
					}), /* @__PURE__ */ jsxs("label", {
						className: "absolute right-0 bottom-0 flex size-9 cursor-pointer items-center justify-center rounded-full bg-ink text-xs text-ivory",
						children: ["Edit", /* @__PURE__ */ jsx("input", {
							type: "file",
							accept: "image/*",
							className: "sr-only",
							onChange: (event) => {
								const file = event.target.files?.[0];
								event.target.value = "";
								if (!file) return;
								if (!file.type.startsWith("image/")) {
									setPhotoNote("Please choose an image file.");
									return;
								}
								setPhotoNote("Uploading…");
								compressImage(file).then((photoURL) => saveProfile({
									name: profile.name || editName,
									phone: profile.phone,
									photoURL
								})).then(() => setPhotoNote("Photo updated")).catch(() => setPhotoNote("Could not upload photo. Try a smaller image."));
							}
						})]
					})]
				}), photoNote && /* @__PURE__ */ jsx("p", {
					className: "text-xs text-ink/70",
					children: photoNote
				})]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "mt-5 space-y-3",
				children: [
					/* @__PURE__ */ jsx(Field$1, {
						label: "Full name",
						value: editing ? editName : profile.name,
						onChange: setEditName,
						disabled: !editing
					}),
					/* @__PURE__ */ jsx(Field$1, {
						label: "Phone number",
						value: editing ? editPhone : profile.phone,
						onChange: setEditPhone,
						disabled: !editing
					}),
					/* @__PURE__ */ jsx(Field$1, {
						label: "Email",
						value: profile.email,
						onChange: () => void 0,
						disabled: true
					})
				]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "mt-4 space-y-2",
				children: [
					!editing ? /* @__PURE__ */ jsx("button", {
						type: "button",
						className: "h-12 w-full rounded-xl border border-ink font-medium",
						onClick: () => {
							setEditName(profile.name);
							setEditPhone(profile.phone);
							setEditing(true);
						},
						children: "Edit details"
					}) : /* @__PURE__ */ jsx("button", {
						type: "button",
						className: "h-12 w-full rounded-xl bg-teal font-medium text-ivory",
						onClick: () => {
							if (!editName.trim()) {
								toast.error("Name can't be empty.");
								return;
							}
							setBusy(true);
							saveProfile({
								name: editName,
								phone: editPhone
							}).then(() => {
								toast.success("Profile updated");
								setEditing(false);
							}).catch(() => toast.error("Could not save changes. Try again.")).finally(() => setBusy(false));
						},
						children: "Save changes"
					}),
					/* @__PURE__ */ jsx("button", {
						type: "button",
						className: "h-12 w-full rounded-xl border border-ink font-medium",
						onClick: () => {
							signOut();
							toast.success("You're logged out");
						},
						children: "Log out"
					}),
					/* @__PURE__ */ jsx("button", {
						type: "button",
						onClick: () => setScreen("track"),
						className: "h-12 w-full rounded-xl border border-line font-medium",
						children: "Track an order"
					}),
					/* @__PURE__ */ jsx("button", {
						type: "button",
						onClick: () => setScreen("help"),
						className: "h-12 w-full rounded-xl border border-line font-medium",
						children: "Help, size guide & policy"
					})
				]
			}),
			/* @__PURE__ */ jsx(InstallCard, { installEvent })
		]
	});
}
function Field$1({ label, value, onChange, placeholder, type = "text", disabled = false }) {
	return /* @__PURE__ */ jsxs("label", {
		className: "block text-sm font-medium",
		children: [label, /* @__PURE__ */ jsx("input", {
			type,
			value,
			placeholder,
			disabled,
			onChange: (event) => onChange(event.target.value),
			className: "mt-1 h-12 w-full rounded-xl border border-line bg-surface px-3 font-normal outline-none focus:border-teal disabled:opacity-60"
		})]
	});
}
function InstallCard({ installEvent }) {
	return /* @__PURE__ */ jsxs("section", {
		className: "mt-8 rounded-2xl border border-line bg-surface p-4",
		children: [
			/* @__PURE__ */ jsx("h3", {
				className: "font-display text-xl font-semibold",
				children: "Install on Android"
			}),
			/* @__PURE__ */ jsx("p", {
				className: "mt-1 text-sm text-pretty text-ink/75",
				children: "Add JM-Store to your home screen and it opens full screen, like an app — catalogue, cart, wishlist, and WhatsApp orders included."
			}),
			installEvent ? /* @__PURE__ */ jsx("button", {
				type: "button",
				className: "mt-3 h-11 rounded-xl bg-teal px-4 text-sm font-medium text-ivory",
				onClick: () => void installEvent.prompt(),
				children: "Install app"
			}) : /* @__PURE__ */ jsx("p", {
				className: "mt-3 text-sm text-ink/70",
				children: "In Chrome, open the menu and tap Install app or Add to Home screen."
			})
		]
	});
}
function compressImage(file) {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onerror = () => reject(/* @__PURE__ */ new Error("read"));
		reader.onload = () => {
			const img = new Image();
			img.onerror = () => reject(/* @__PURE__ */ new Error("image"));
			img.onload = () => {
				const maxDim = 280;
				let width = img.width;
				let height = img.height;
				if (width > height && width > maxDim) {
					height = Math.round(height * (maxDim / width));
					width = maxDim;
				} else if (height >= width && height > maxDim) {
					width = Math.round(width * (maxDim / height));
					height = maxDim;
				}
				const canvas = document.createElement("canvas");
				canvas.width = width;
				canvas.height = height;
				const ctx = canvas.getContext("2d");
				if (!ctx) {
					reject(/* @__PURE__ */ new Error("canvas"));
					return;
				}
				ctx.drawImage(img, 0, 0, width, height);
				resolve(canvas.toDataURL("image/jpeg", .72));
			};
			img.src = String(reader.result);
		};
		reader.readAsDataURL(file);
	});
}
//#endregion
//#region src/components/store/bag-view.tsx
function BagView() {
	const cart = useStore((s) => s.cart);
	const products = useStore((s) => s.products);
	const setQty = useStore((s) => s.setQty);
	const removeFromCart = useStore((s) => s.removeFromCart);
	const openCheckoutCart = useStore((s) => s.openCheckoutCart);
	const addToCart = useStore((s) => s.addToCart);
	const setTab = useStore((s) => s.setTab);
	const total = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
	const related = relatedProducts(products, cart);
	if (cart.length === 0) return /* @__PURE__ */ jsxs("div", {
		className: "px-4 py-16 text-center",
		children: [
			/* @__PURE__ */ jsx("h2", {
				className: "font-display text-3xl font-semibold",
				children: "Your cart is empty"
			}),
			/* @__PURE__ */ jsx("p", {
				className: "mt-2 text-ink/70",
				children: "Pick an item number, colour, and size from the catalogue."
			}),
			/* @__PURE__ */ jsx("button", {
				type: "button",
				onClick: () => setTab("shop"),
				className: "mt-6 h-12 rounded-xl bg-teal px-6 font-medium text-ivory",
				children: "Browse catalogue"
			})
		]
	});
	return /* @__PURE__ */ jsxs("div", {
		className: "space-y-4 px-4 py-4",
		children: [
			/* @__PURE__ */ jsx("h2", {
				className: "font-display text-3xl font-semibold",
				children: "Your cart"
			}),
			cart.map((item) => {
				const image = products.find((product) => product.id === item.id)?.images[0];
				return /* @__PURE__ */ jsxs("article", {
					className: "flex gap-3 rounded-2xl border border-line bg-surface p-3",
					children: [/* @__PURE__ */ jsx("div", {
						className: "size-20 overflow-hidden rounded-xl bg-line/40",
						children: image && /* @__PURE__ */ jsx("img", {
							src: image,
							alt: "",
							className: "h-full w-full object-cover"
						})
					}), /* @__PURE__ */ jsxs("div", {
						className: "min-w-0 flex-1",
						children: [
							/* @__PURE__ */ jsx("p", {
								className: "font-medium",
								children: item.name
							}),
							/* @__PURE__ */ jsxs("p", {
								className: "text-xs text-ink/60",
								children: [
									"#",
									item.itemNo,
									item.color ? ` · ${item.color}` : "",
									item.size ? ` / ${item.size}` : ""
								]
							}),
							/* @__PURE__ */ jsx("p", {
								className: "mt-1 font-semibold text-brick tabular-nums",
								children: money(item.price * item.qty)
							}),
							/* @__PURE__ */ jsxs("div", {
								className: "mt-2 flex items-center gap-2",
								children: [
									/* @__PURE__ */ jsx("button", {
										type: "button",
										"aria-label": "Decrease quantity",
										onClick: () => setQty(item.cartId, item.qty - 1),
										className: "flex size-10 items-center justify-center rounded-full border border-line",
										children: /* @__PURE__ */ jsx(Minus, { className: "size-4" })
									}),
									/* @__PURE__ */ jsx("span", {
										className: "w-6 text-center tabular-nums",
										children: item.qty
									}),
									/* @__PURE__ */ jsx("button", {
										type: "button",
										"aria-label": "Increase quantity",
										onClick: () => setQty(item.cartId, item.qty + 1),
										className: "flex size-10 items-center justify-center rounded-full border border-line",
										children: /* @__PURE__ */ jsx(Plus, { className: "size-4" })
									}),
									/* @__PURE__ */ jsx("button", {
										type: "button",
										"aria-label": "Remove",
										onClick: () => removeFromCart(item.cartId),
										className: "ml-auto flex size-10 items-center justify-center rounded-full text-brick",
										children: /* @__PURE__ */ jsx(Trash2, { className: "size-4" })
									})
								]
							})
						]
					})]
				}, item.cartId);
			}),
			related.length > 0 && /* @__PURE__ */ jsxs("section", { children: [/* @__PURE__ */ jsx("h3", {
				className: "font-display text-xl font-semibold",
				children: "You may also like"
			}), /* @__PURE__ */ jsx("div", {
				className: "mt-2 space-y-2",
				children: related.map((product) => /* @__PURE__ */ jsxs("div", {
					className: "flex items-center gap-3 rounded-2xl border border-line bg-surface p-2",
					children: [
						/* @__PURE__ */ jsx("div", {
							className: "size-14 overflow-hidden rounded-xl bg-line/40",
							children: product.images[0] && /* @__PURE__ */ jsx("img", {
								src: product.images[0],
								alt: "",
								className: "h-full w-full object-cover"
							})
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "min-w-0 flex-1",
							children: [/* @__PURE__ */ jsx("p", {
								className: "truncate text-sm font-medium",
								children: product.name
							}), /* @__PURE__ */ jsx("p", {
								className: "text-sm text-brick tabular-nums",
								children: money(product.effectivePrice)
							})]
						}),
						/* @__PURE__ */ jsx("button", {
							type: "button",
							onClick: () => addToCart(product, {
								color: product.colors[0]?.name ?? "",
								size: product.sizes[0] ?? "",
								qty: 1
							}),
							className: "h-10 rounded-full bg-teal px-3 text-sm font-medium text-ivory",
							children: "Add"
						})
					]
				}, product.id))
			})] }),
			/* @__PURE__ */ jsxs("div", {
				className: "flex items-center justify-between pt-2 font-display text-xl font-semibold",
				children: [/* @__PURE__ */ jsx("span", { children: "Total" }), /* @__PURE__ */ jsx("span", {
					className: "text-brick tabular-nums",
					children: money(total)
				})]
			}),
			/* @__PURE__ */ jsx("button", {
				type: "button",
				onClick: openCheckoutCart,
				className: "h-12 w-full rounded-xl bg-teal font-medium text-ivory",
				children: "Order cart on WhatsApp"
			})
		]
	});
}
//#endregion
//#region src/lib/store/types.ts
var SITE_REVIEW_ID = "site-general";
var WHATSAPP_NUMBER = "923219890946";
var WHATSAPP_DISPLAY = "0321-9890946";
var LOGO_URL = "https://i.postimg.cc/W4j4BfW1/file-00000000816081fa941c8a4c7585bc0c.png";
//#endregion
//#region src/components/store/checkout-sheet.tsx
function discountOf(subtotal, coupon) {
	if (!coupon) return 0;
	const raw = coupon.type === "percent" ? subtotal * (coupon.value / 100) : coupon.value;
	return Math.min(Math.max(raw, 0), subtotal);
}
function CheckoutSheet() {
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
	const [step, setStep] = useState(1);
	const [code, setCode] = useState("");
	const [coupon, setCoupon] = useState(null);
	const [couponMsg, setCouponMsg] = useState("");
	const [name, setName] = useState(profile.name);
	const [phone, setPhone] = useState(profile.phone);
	const [email, setEmail] = useState(profile.email);
	const [address, setAddress] = useState("");
	const [sending, setSending] = useState(false);
	const [placed, setPlaced] = useState(null);
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
	function whatsappText(orderId, items) {
		return `NEW ORDER - JM-STORE
------------------------------
${items.map((item, index) => {
			return [
				`${index + 1}. *${item.name}*`,
				`   - Item No: ${item.itemNo}`,
				item.color ? `   - Colour: ${item.color}` : "",
				item.size ? `   - Size: ${item.size}` : "",
				`   - Qty: ${item.qty}`,
				`   - Price: ${money(item.price * item.qty)}`
			].filter(Boolean).join("\n");
		}).join("\n\n")}

------------------------------
${coupon && discount > 0 ? `Coupon: ${coupon.code} (− ${money(discount)})\n` : ""}Total Amount: ${money(total)}

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
					size: item.size || ""
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
				createdAt: Date.now()
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
	if (placed) return /* @__PURE__ */ jsx("div", {
		className: "z-checkout fixed inset-0 flex items-end bg-ink/50 sm:items-center sm:justify-center",
		children: /* @__PURE__ */ jsxs("div", {
			className: "w-full rounded-t-3xl bg-cream p-5 sm:max-w-md sm:rounded-3xl",
			children: [
				/* @__PURE__ */ jsx("p", {
					className: "text-xs font-semibold tracking-widest text-brick uppercase",
					children: "Order placed"
				}),
				/* @__PURE__ */ jsx("h2", {
					className: "mt-1 font-display text-3xl font-semibold",
					children: "Save this Order ID"
				}),
				/* @__PURE__ */ jsx("p", {
					className: "mt-3 rounded-2xl bg-surface px-4 py-3 text-center font-display text-2xl tracking-wide text-teal",
					children: placed
				}),
				/* @__PURE__ */ jsx("p", {
					className: "mt-3 text-sm text-pretty text-ink/75",
					children: "WhatsApp should be open with your order filled in. Hit send there. Use this ID any time under Track."
				}),
				/* @__PURE__ */ jsxs("div", {
					className: "mt-4 grid grid-cols-2 gap-2",
					children: [/* @__PURE__ */ jsx("button", {
						type: "button",
						className: "h-12 rounded-xl border border-ink font-medium",
						onClick: () => {
							navigator.clipboard.writeText(placed).then(() => toast.success("Order ID copied"));
						},
						children: "Copy ID"
					}), /* @__PURE__ */ jsx("button", {
						type: "button",
						className: "h-12 rounded-xl bg-teal font-medium text-ivory",
						onClick: closeCheckout,
						children: "Done"
					})]
				})
			]
		})
	});
	return /* @__PURE__ */ jsxs("div", {
		className: "z-checkout fixed inset-0 flex flex-col bg-cream",
		children: [
			/* @__PURE__ */ jsxs("header", {
				className: "flex items-center justify-between border-b border-line px-3 py-2",
				children: [
					/* @__PURE__ */ jsx("button", {
						type: "button",
						"aria-label": "Close",
						onClick: closeCheckout,
						className: "flex size-11 items-center justify-center rounded-full",
						children: /* @__PURE__ */ jsx(X, { className: "size-5" })
					}),
					/* @__PURE__ */ jsx("h2", {
						className: "font-display text-lg font-semibold",
						children: "Confirm your order"
					}),
					/* @__PURE__ */ jsxs("span", {
						className: "w-11 text-center text-sm text-ink/60",
						children: [step, "/2"]
					})
				]
			}),
			/* @__PURE__ */ jsx("div", {
				className: "min-h-0 flex-1 overflow-y-auto px-4 py-4",
				children: step === 1 ? /* @__PURE__ */ jsxs("div", {
					className: "space-y-4",
					children: [
						/* @__PURE__ */ jsx("p", {
							className: "text-sm text-ink/70",
							children: "We'll open WhatsApp with these details filled in."
						}),
						lines.map((item, index) => /* @__PURE__ */ jsxs("div", {
							className: "rounded-2xl border border-line bg-surface p-3",
							children: [/* @__PURE__ */ jsxs("div", {
								className: "flex items-start justify-between gap-3",
								children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("p", {
									className: "font-medium",
									children: item.name
								}), /* @__PURE__ */ jsxs("p", {
									className: "text-xs text-ink/60",
									children: [
										"#",
										item.itemNo,
										item.color ? ` · ${item.color}` : "",
										item.size ? ` / ${item.size}` : ""
									]
								})] }), /* @__PURE__ */ jsx("p", {
									className: "tabular-nums font-semibold text-brick",
									children: money(item.price * item.qty)
								})]
							}), /* @__PURE__ */ jsxs("div", {
								className: "mt-2 flex items-center gap-3",
								children: [
									/* @__PURE__ */ jsx("button", {
										type: "button",
										"aria-label": "Decrease",
										onClick: () => adjustOrderQty(index, item.qty - 1),
										className: "flex size-10 items-center justify-center rounded-full border border-line",
										children: /* @__PURE__ */ jsx(Minus, { className: "size-4" })
									}),
									/* @__PURE__ */ jsx("span", {
										className: "tabular-nums",
										children: item.qty
									}),
									/* @__PURE__ */ jsx("button", {
										type: "button",
										"aria-label": "Increase",
										onClick: () => adjustOrderQty(index, item.qty + 1),
										className: "flex size-10 items-center justify-center rounded-full border border-line",
										children: /* @__PURE__ */ jsx(Plus, { className: "size-4" })
									})
								]
							})]
						}, item.cartId)),
						related.length > 0 && /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("h3", {
							className: "font-display text-lg font-semibold",
							children: "You may also like"
						}), /* @__PURE__ */ jsx("div", {
							className: "mt-2 space-y-2",
							children: related.map((product) => /* @__PURE__ */ jsxs("div", {
								className: "flex items-center gap-3 rounded-2xl border border-line bg-surface p-2",
								children: [
									/* @__PURE__ */ jsx("button", {
										type: "button",
										onClick: () => openProduct(product.id),
										className: "size-14 overflow-hidden rounded-xl bg-line/40",
										children: product.images[0] && /* @__PURE__ */ jsx("img", {
											src: product.images[0],
											alt: "",
											className: "h-full w-full object-cover"
										})
									}),
									/* @__PURE__ */ jsxs("div", {
										className: "min-w-0 flex-1",
										children: [/* @__PURE__ */ jsx("p", {
											className: "truncate text-sm font-medium",
											children: product.name
										}), /* @__PURE__ */ jsx("p", {
											className: "text-sm text-brick tabular-nums",
											children: money(product.effectivePrice)
										})]
									}),
									/* @__PURE__ */ jsx("button", {
										type: "button",
										onClick: () => addRelatedToOrder(product),
										className: "h-10 rounded-full bg-teal px-3 text-sm font-medium text-ivory",
										children: "Add"
									})
								]
							}, product.id))
						})] }),
						/* @__PURE__ */ jsxs("div", { children: [
							/* @__PURE__ */ jsx("label", {
								htmlFor: "coupon",
								className: "text-sm font-medium",
								children: "Coupon code (optional)"
							}),
							/* @__PURE__ */ jsxs("div", {
								className: "mt-1 flex gap-2",
								children: [/* @__PURE__ */ jsx("input", {
									id: "coupon",
									value: code,
									onChange: (event) => setCode(event.target.value),
									placeholder: "e.g. SAVE10",
									className: "h-12 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 uppercase outline-none focus:border-teal"
								}), /* @__PURE__ */ jsx("button", {
									type: "button",
									onClick: applyCoupon,
									className: "h-12 rounded-xl border border-ink px-4 text-sm font-medium",
									children: "Apply"
								})]
							}),
							couponMsg && /* @__PURE__ */ jsx("p", {
								className: "mt-1 text-sm text-teal",
								children: couponMsg
							})
						] }),
						discount > 0 && /* @__PURE__ */ jsxs("div", {
							className: "flex justify-between text-sm",
							children: [/* @__PURE__ */ jsxs("span", { children: [
								"Coupon (",
								coupon?.code,
								")"
							] }), /* @__PURE__ */ jsxs("span", {
								className: "tabular-nums",
								children: ["− ", money(discount)]
							})]
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "flex justify-between font-display text-xl font-semibold",
							children: [/* @__PURE__ */ jsx("span", { children: "Total" }), /* @__PURE__ */ jsx("span", {
								className: "text-brick tabular-nums",
								children: money(total)
							})]
						})
					]
				}) : /* @__PURE__ */ jsxs("form", {
					className: "space-y-3",
					onSubmit: (event) => {
						event.preventDefault();
						send();
					},
					children: [
						/* @__PURE__ */ jsx(Field, {
							label: "Your name",
							value: name,
							onChange: setName,
							placeholder: "e.g. Ahmed Raza"
						}),
						/* @__PURE__ */ jsx(Field, {
							label: "Contact number",
							value: phone,
							onChange: setPhone,
							placeholder: "03xx-xxxxxxx"
						}),
						/* @__PURE__ */ jsx(Field, {
							label: "Email (for order updates)",
							value: email,
							onChange: setEmail,
							placeholder: "you@example.com",
							type: "email"
						}),
						/* @__PURE__ */ jsxs("label", {
							className: "block text-sm font-medium",
							children: ["Delivery address", /* @__PURE__ */ jsx("textarea", {
								value: address,
								onChange: (event) => setAddress(event.target.value),
								placeholder: "House / street, area, city",
								rows: 3,
								className: "mt-1 w-full rounded-xl border border-line bg-surface px-3 py-3 outline-none focus:border-teal"
							})]
						}),
						/* @__PURE__ */ jsx("button", {
							type: "submit",
							disabled: sending,
							className: "h-12 w-full rounded-xl bg-teal font-medium text-ivory disabled:opacity-60",
							children: sending ? "Placing order…" : "Send via WhatsApp"
						})
					]
				})
			}),
			step === 1 && /* @__PURE__ */ jsxs("div", {
				className: "sheet-pad grid grid-cols-2 gap-2 border-t border-line px-4 pt-3",
				children: [/* @__PURE__ */ jsx("button", {
					type: "button",
					onClick: closeCheckout,
					className: "h-12 rounded-xl border border-ink font-medium",
					children: "Cancel"
				}), /* @__PURE__ */ jsx("button", {
					type: "button",
					onClick: () => {
						if (lines.length === 0) {
							toast.error("Your order is empty.");
							return;
						}
						setStep(2);
					},
					className: "h-12 rounded-xl bg-teal font-medium text-ivory",
					children: "Continue"
				})]
			}),
			step === 2 && /* @__PURE__ */ jsx("div", {
				className: "sheet-pad px-4 pt-3",
				children: /* @__PURE__ */ jsx("button", {
					type: "button",
					onClick: () => setStep(1),
					className: "h-12 w-full rounded-xl border border-ink font-medium",
					children: "Back to summary"
				})
			})
		]
	});
}
function Field({ label, value, onChange, placeholder, type = "text" }) {
	return /* @__PURE__ */ jsxs("label", {
		className: "block text-sm font-medium",
		children: [label, /* @__PURE__ */ jsx("input", {
			type,
			value,
			placeholder,
			onChange: (event) => onChange(event.target.value),
			className: "mt-1 h-12 w-full rounded-xl border border-line bg-surface px-3 font-normal outline-none focus:border-teal"
		})]
	});
}
//#endregion
//#region src/components/store/help-view.tsx
var FAQS = [
	["How do I place an order?", "Pick your item(s), select colour and size, then either add to cart or order directly. Confirm your details and we'll open WhatsApp with your order pre-filled — just hit send."],
	["Do you accept online payments?", "Currently all orders are confirmed and paid for via WhatsApp — usually cash on delivery, or bank transfer details shared by our team directly in chat."],
	["How long does delivery take?", "Most orders within the city are delivered in 2–4 working days, and other areas in 4–7 working days depending on location."],
	["How do I track my order?", "Open Track and enter the Order ID you received after checkout to see live status updates."],
	["What if an item doesn't fit?", "Check the size guide before ordering. If it still doesn't fit, message us on WhatsApp within 3 days to arrange a swap."],
	["Can I cancel or change my order?", "Yes — message us on WhatsApp with your Order ID as soon as possible. We can usually make changes as long as the order hasn't shipped yet."]
];
var SIZES = [
	[
		"XS",
		"32–34",
		"26–28",
		"34–36",
		"26"
	],
	[
		"S",
		"34–36",
		"28–30",
		"36–38",
		"27"
	],
	[
		"M",
		"36–38",
		"30–32",
		"38–40",
		"28"
	],
	[
		"L",
		"38–40",
		"32–34",
		"40–42",
		"29"
	],
	[
		"XL",
		"40–42",
		"34–36",
		"42–44",
		"30"
	],
	[
		"XXL",
		"42–44",
		"36–38",
		"44–46",
		"31"
	]
];
function HelpView() {
	const [open, setOpen] = useState(0);
	const [guide, setGuide] = useState(false);
	const reviews = useStore((s) => s.reviews["site-general"] ?? []);
	const refreshCatalogue = useStore((s) => s.refreshCatalogue);
	const profileName = useStore((s) => s.profile.name);
	const [rating, setRating] = useState(0);
	const [name, setName] = useState(profileName);
	const [comment, setComment] = useState("");
	const [busy, setBusy] = useState(false);
	return /* @__PURE__ */ jsxs("div", {
		className: "space-y-10 px-4 py-6",
		children: [
			/* @__PURE__ */ jsxs("section", {
				id: "about",
				children: [
					/* @__PURE__ */ jsx("p", {
						className: "text-xs font-semibold tracking-widest text-brick uppercase",
						children: "About us"
					}),
					/* @__PURE__ */ jsx("h2", {
						className: "mt-1 font-display text-3xl font-semibold",
						children: "Who we are"
					}),
					/* @__PURE__ */ jsx("p", {
						className: "mt-2 text-pretty text-ink/80",
						children: "JM-Store is a Hyderabad-based shop bringing our in-person catalogue online. Browse items here, and when you're ready, your pick goes straight to us on WhatsApp — just like asking at the counter, minus the queue."
					})
				]
			}),
			/* @__PURE__ */ jsxs("section", { children: [
				/* @__PURE__ */ jsx("p", {
					className: "text-xs font-semibold tracking-widest text-brick uppercase",
					children: "Help center"
				}),
				/* @__PURE__ */ jsx("h2", {
					className: "mt-1 font-display text-3xl font-semibold",
					children: "Questions"
				}),
				/* @__PURE__ */ jsx("button", {
					type: "button",
					onClick: () => setGuide((value) => !value),
					className: "mt-4 h-11 rounded-xl border border-line px-4 text-sm font-medium text-teal",
					children: guide ? "Hide size guide" : "View size guide"
				}),
				guide && /* @__PURE__ */ jsx("div", {
					className: "mt-3 overflow-x-auto rounded-2xl border border-line",
					children: /* @__PURE__ */ jsxs("table", {
						className: "w-full border-collapse text-center text-xs",
						children: [/* @__PURE__ */ jsx("thead", {
							className: "bg-surface",
							children: /* @__PURE__ */ jsx("tr", { children: [
								"Size",
								"Chest (in)",
								"Waist (in)",
								"Hip (in)",
								"Length (in)"
							].map((head) => /* @__PURE__ */ jsx("th", {
								className: "border-b border-line px-2 py-3 font-semibold",
								children: head
							}, head)) })
						}), /* @__PURE__ */ jsx("tbody", { children: SIZES.map((row) => /* @__PURE__ */ jsx("tr", { children: row.map((cell) => /* @__PURE__ */ jsx("td", {
							className: "border-t border-line px-2 py-3",
							children: cell
						}, cell)) }, row[0])) })]
					})
				}),
				/* @__PURE__ */ jsx("div", {
					className: "mt-4 divide-y divide-line border-y border-line",
					children: FAQS.map(([question, answer], index) => /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsxs("button", {
						type: "button",
						onClick: () => setOpen(open === index ? null : index),
						className: "flex w-full items-center justify-between gap-3 py-4 text-left font-display text-lg font-semibold",
						children: [question, /* @__PURE__ */ jsx("span", {
							className: clsx("text-xl transition-transform", open === index && "rotate-45"),
							children: "+"
						})]
					}), open === index && /* @__PURE__ */ jsx("p", {
						className: "pb-4 text-sm text-pretty text-ink/80",
						children: answer
					})] }, question))
				})
			] }),
			/* @__PURE__ */ jsxs("section", { children: [
				/* @__PURE__ */ jsx("p", {
					className: "text-xs font-semibold tracking-widest text-brick uppercase",
					children: "Store policy"
				}),
				/* @__PURE__ */ jsx("h2", {
					className: "mt-1 font-display text-3xl font-semibold",
					children: "Returns & exchange"
				}),
				/* @__PURE__ */ jsx(Policy, {
					title: "Eligibility",
					body: "Items can be returned or exchanged within 3 days of delivery, provided they are unused, unwashed, and in their original packaging with tags intact."
				}),
				/* @__PURE__ */ jsx(Policy, {
					title: "How to request a return or exchange",
					body: "Message us on WhatsApp with your Order ID and the reason. We'll confirm eligibility and arrange pickup or drop-off. Exchanges depend on stock of the size or colour you want."
				}),
				/* @__PURE__ */ jsx(Policy, {
					title: "Non-returnable items",
					body: "Sale items, innerwear, and made-to-order pieces cannot be returned or exchanged unless defective or damaged on arrival."
				}),
				/* @__PURE__ */ jsx(Policy, {
					title: "Refunds",
					body: "Approved refunds for any prepaid amount are processed via the original payment method within 5–7 business days. Cash-on-delivery orders are settled as store credit or an exchange."
				}),
				/* @__PURE__ */ jsx(Policy, {
					title: "Damaged or wrong item",
					body: "If you receive a damaged, defective, or incorrect item, contact us within 48 hours of delivery with photos for a quick resolution."
				})
			] }),
			/* @__PURE__ */ jsxs("section", { children: [
				/* @__PURE__ */ jsx("h2", {
					className: "font-display text-3xl font-semibold",
					children: "Customer reviews"
				}),
				/* @__PURE__ */ jsx("p", {
					className: "mt-1 text-sm text-ink/70",
					children: "What people say about JM-Store."
				}),
				/* @__PURE__ */ jsxs("div", {
					className: "mt-4 space-y-3",
					children: [reviews.length === 0 && /* @__PURE__ */ jsx("p", {
						className: "text-sm text-ink/70",
						children: "No reviews yet — be the first to share your thoughts."
					}), reviews.map((review) => /* @__PURE__ */ jsxs("article", {
						className: "rounded-2xl border border-line bg-surface p-3",
						children: [/* @__PURE__ */ jsxs("div", {
							className: "flex items-center justify-between",
							children: [/* @__PURE__ */ jsx("p", {
								className: "font-medium",
								children: review.name
							}), /* @__PURE__ */ jsx("p", {
								className: "text-sm text-marigold",
								children: "★".repeat(review.rating)
							})]
						}), review.comment && /* @__PURE__ */ jsx("p", {
							className: "mt-1 text-sm text-ink/80",
							children: review.comment
						})]
					}, review.id))]
				}),
				/* @__PURE__ */ jsxs("form", {
					className: "mt-4 space-y-3",
					onSubmit: (event) => {
						event.preventDefault();
						if (!name.trim() || rating === 0) {
							toast.error("Enter your name and a star rating.");
							return;
						}
						setBusy(true);
						submitReview({
							productId: SITE_REVIEW_ID,
							name: name.trim(),
							rating,
							comment: comment.trim(),
							createdAt: Date.now()
						}).then(async () => {
							toast.success("Thanks for the review");
							setComment("");
							setRating(0);
							await refreshCatalogue();
						}).catch(() => toast.error("Couldn't submit your review.")).finally(() => setBusy(false));
					},
					children: [
						/* @__PURE__ */ jsx("div", {
							className: "flex gap-1",
							children: [
								1,
								2,
								3,
								4,
								5
							].map((star) => /* @__PURE__ */ jsx("button", {
								type: "button",
								"aria-label": `${star} star`,
								onClick: () => setRating(star),
								className: "flex size-11 items-center justify-center",
								children: /* @__PURE__ */ jsx(Star, { className: clsx("size-6", star <= rating ? "fill-marigold text-marigold" : "text-ink/30") })
							}, star))
						}),
						/* @__PURE__ */ jsx("input", {
							value: name,
							onChange: (event) => setName(event.target.value),
							placeholder: "Your name",
							className: "h-12 w-full rounded-xl border border-line bg-surface px-3 outline-none focus:border-teal"
						}),
						/* @__PURE__ */ jsx("textarea", {
							value: comment,
							onChange: (event) => setComment(event.target.value),
							placeholder: "How was your order?",
							rows: 3,
							className: "w-full rounded-xl border border-line bg-surface px-3 py-3 outline-none focus:border-teal"
						}),
						/* @__PURE__ */ jsx("button", {
							type: "submit",
							disabled: busy,
							className: "h-12 w-full rounded-xl bg-teal font-medium text-ivory disabled:opacity-60",
							children: "Write a review"
						})
					]
				})
			] }),
			/* @__PURE__ */ jsxs("section", { children: [
				/* @__PURE__ */ jsx("h2", {
					className: "font-display text-2xl font-semibold",
					children: "Contact"
				}),
				/* @__PURE__ */ jsx("p", {
					className: "mt-2 text-ink/80",
					children: "Qasimabad, Hyderabad, Sindh"
				}),
				/* @__PURE__ */ jsxs("a", {
					href: `https://wa.me/${WHATSAPP_NUMBER}`,
					className: "mt-3 inline-flex h-12 items-center rounded-xl bg-teal px-4 font-medium text-ivory",
					children: ["WhatsApp ", WHATSAPP_DISPLAY]
				}),
				/* @__PURE__ */ jsx("p", {
					className: "mt-6 text-xs text-ink/50",
					children: "All rights reserved JM-Store"
				})
			] })
		]
	});
}
function Policy({ title, body }) {
	return /* @__PURE__ */ jsxs("div", {
		className: "mt-4",
		children: [/* @__PURE__ */ jsx("h3", {
			className: "font-display text-lg font-semibold",
			children: title
		}), /* @__PURE__ */ jsx("p", {
			className: "mt-1 text-sm text-pretty text-ink/80",
			children: body
		})]
	});
}
//#endregion
//#region src/components/store/product-card.tsx
function ProductCard({ product, compact = false }) {
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
	return /* @__PURE__ */ jsxs("article", {
		className: clsx("relative flex flex-col overflow-hidden rounded-2xl border border-line bg-surface", compact && "w-44 shrink-0 snap-start md:w-auto", out && "opacity-80"),
		children: [
			/* @__PURE__ */ jsxs("button", {
				type: "button",
				onClick: () => openProduct(product.id),
				className: "relative aspect-square bg-line/40 text-left",
				children: [
					image ? /* @__PURE__ */ jsx("img", {
						src: image,
						alt: product.name,
						className: "h-full w-full object-cover"
					}) : /* @__PURE__ */ jsx("span", {
						className: "flex h-full items-center justify-center font-display text-lg text-teal",
						children: product.itemNo
					}),
					/* @__PURE__ */ jsxs("span", {
						className: "absolute top-2 left-2 rounded-full border border-line bg-cream px-2 py-0.5 text-xs font-medium tracking-wide text-ink",
						children: ["#", product.itemNo]
					}),
					(out || low || product.discountPrice !== null) && /* @__PURE__ */ jsx("span", {
						className: clsx("absolute bottom-2 left-2 rounded-full px-2 py-0.5 text-xs font-semibold", out && "bg-ink text-ivory", !out && low && "bg-marigold text-teal-deep", !out && !low && "bg-brick text-ivory"),
						children: out ? "Out of stock" : low ? `Only ${product.stock} left` : "Sale"
					})
				]
			}),
			/* @__PURE__ */ jsx("button", {
				type: "button",
				"aria-label": saved ? "Remove from wishlist" : "Save to wishlist",
				onClick: () => toggleWishlist(product.id),
				className: clsx("absolute top-2 right-2 z-10 flex size-9 items-center justify-center rounded-full border border-line bg-surface", saved ? "text-brick" : "text-ink"),
				children: /* @__PURE__ */ jsx(Heart, {
					className: "size-4",
					fill: saved ? "currentColor" : "none"
				})
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "flex flex-1 flex-col gap-2 p-3",
				children: [
					/* @__PURE__ */ jsx("button", {
						type: "button",
						onClick: () => openProduct(product.id),
						className: "text-left",
						children: /* @__PURE__ */ jsx("h3", {
							className: "line-clamp-2 font-display text-base leading-snug font-semibold text-balance text-ink",
							children: product.name
						})
					}),
					rating && /* @__PURE__ */ jsxs("p", {
						className: "inline-flex items-center gap-1 text-xs text-ink/70",
						children: [
							/* @__PURE__ */ jsx(Star, { className: "size-3 fill-marigold text-marigold" }),
							rating.avg.toFixed(1),
							" (",
							rating.count,
							")"
						]
					}),
					product.colors.length > 0 && /* @__PURE__ */ jsx("div", {
						className: "flex flex-wrap gap-1.5",
						"aria-label": "Colour",
						children: product.colors.map((swatch) => /* @__PURE__ */ jsx("button", {
							type: "button",
							title: swatch.name,
							"aria-label": swatch.name,
							onClick: () => setSelection(product.id, { color: swatch.name }),
							className: clsx("size-6 rounded-full border", color === swatch.name ? "border-teal ring-2 ring-teal ring-offset-2 ring-offset-surface" : "border-line"),
							style: { background: swatch.hex }
						}, swatch.name))
					}),
					product.sizes.length > 0 && !compact && /* @__PURE__ */ jsx("div", {
						className: "flex flex-wrap gap-1",
						children: product.sizes.map((option) => /* @__PURE__ */ jsx("button", {
							type: "button",
							onClick: () => setSelection(product.id, { size: option }),
							className: clsx("min-h-8 rounded-full border px-2.5 text-xs font-medium", size === option ? "border-teal bg-teal text-ivory" : "border-line bg-surface text-ink"),
							children: option
						}, option))
					}),
					/* @__PURE__ */ jsxs("p", {
						className: "mt-auto flex items-baseline gap-2 tabular-nums",
						children: [product.discountPrice !== null && /* @__PURE__ */ jsx("span", {
							className: "text-xs text-ink/50 line-through",
							children: money(product.price)
						}), /* @__PURE__ */ jsx("span", {
							className: "font-semibold text-brick",
							children: money(product.effectivePrice)
						})]
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "grid grid-cols-2 gap-1.5",
						children: [/* @__PURE__ */ jsxs("button", {
							type: "button",
							disabled: out,
							onClick: () => {
								addToCart(product);
								toast.success("Added to cart", { action: {
									label: "View",
									onClick: () => useStore.getState().setTab("bag")
								} });
							},
							className: "inline-flex h-11 items-center justify-center gap-1 rounded-xl bg-teal-deep text-sm font-medium text-ivory disabled:opacity-40",
							children: [/* @__PURE__ */ jsx(ShoppingBag, { className: "size-4" }), "Cart"]
						}), /* @__PURE__ */ jsx("button", {
							type: "button",
							onClick: () => out ? openProduct(product.id) : openCheckoutBuy(product),
							className: "inline-flex h-11 items-center justify-center rounded-xl border border-teal text-sm font-medium text-teal",
							children: out ? "Notify" : "Order"
						})]
					})
				]
			})
		]
	});
}
//#endregion
//#region src/components/store/product-sheet.tsx
function ProductSheet() {
	const productId = useStore((s) => s.productId);
	const product = useStore((s) => s.products.find((item) => item.id === productId) ?? null);
	const reviews = useStore((s) => productId ? s.reviews[productId] : void 0);
	const saved = useStore((s) => productId ? s.wishlist.includes(productId) : false);
	const selection = useStore((s) => productId ? s.selections[productId] : void 0);
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
		const url = `${location.origin}${location.pathname}#item-${encodeURIComponent(product.itemNo)}`;
		const text = `${product.name} (#${product.itemNo}) — ${money(product.effectivePrice)} at JM-Store`;
		try {
			if (navigator.share) await navigator.share({
				title: product.name,
				text,
				url
			});
			else {
				await navigator.clipboard.writeText(`${text}\n${url}`);
				toast.success("Link copied");
			}
		} catch {}
	}
	return /* @__PURE__ */ jsxs("div", {
		className: "fixed inset-0 z-50 flex flex-col bg-cream",
		children: [
			/* @__PURE__ */ jsxs("header", {
				className: "flex items-center justify-between border-b border-line px-3 py-2",
				children: [
					/* @__PURE__ */ jsx("button", {
						type: "button",
						onClick: closeProduct,
						"aria-label": "Close",
						className: "flex size-11 items-center justify-center rounded-full",
						children: /* @__PURE__ */ jsx(X, { className: "size-5" })
					}),
					/* @__PURE__ */ jsxs("p", {
						className: "text-sm font-medium tracking-wide text-ink/70",
						children: ["#", product.itemNo]
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "flex",
						children: [/* @__PURE__ */ jsx("button", {
							type: "button",
							"aria-label": "Share",
							onClick: () => void share(),
							className: "flex size-11 items-center justify-center rounded-full",
							children: /* @__PURE__ */ jsx(Share2, { className: "size-5" })
						}), /* @__PURE__ */ jsx("button", {
							type: "button",
							"aria-label": saved ? "Remove from wishlist" : "Save",
							onClick: () => toggleWishlist(product.id),
							className: clsx("flex size-11 items-center justify-center rounded-full", saved && "text-brick"),
							children: /* @__PURE__ */ jsx(Heart, {
								className: "size-5",
								fill: saved ? "currentColor" : "none"
							})
						})]
					})
				]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "min-h-0 flex-1 overflow-y-auto",
				children: [/* @__PURE__ */ jsxs("div", {
					className: "relative bg-line/30",
					children: [images[activeSlide] ? /* @__PURE__ */ jsx("button", {
						type: "button",
						className: "block w-full",
						onClick: () => openLightbox(images, activeSlide),
						children: /* @__PURE__ */ jsx("img", {
							src: images[activeSlide],
							alt: "",
							className: "aspect-square w-full object-cover"
						})
					}) : /* @__PURE__ */ jsx("div", {
						className: "flex aspect-square items-center justify-center font-display text-3xl text-teal",
						children: product.itemNo
					}), images.length > 1 && /* @__PURE__ */ jsx("div", {
						className: "absolute inset-x-0 bottom-3 flex justify-center gap-1.5",
						children: images.map((_, index) => /* @__PURE__ */ jsx("button", {
							type: "button",
							"aria-label": `Photo ${index + 1}`,
							onClick: () => setSlide(index),
							className: clsx("h-1.5 rounded-full bg-cream", index === activeSlide ? "w-5" : "w-1.5 opacity-70")
						}, index))
					})]
				}), /* @__PURE__ */ jsxs("div", {
					className: "space-y-4 px-4 py-5",
					children: [
						/* @__PURE__ */ jsxs("div", { children: [
							product.category && /* @__PURE__ */ jsx("p", {
								className: "text-xs font-semibold tracking-widest text-brick uppercase",
								children: product.category
							}),
							/* @__PURE__ */ jsx("h2", {
								className: "mt-1 font-display text-3xl leading-tight font-semibold text-balance text-ink",
								children: product.name
							}),
							product.description && /* @__PURE__ */ jsx("p", {
								className: "mt-2 text-pretty text-ink/75",
								children: product.description
							})
						] }),
						/* @__PURE__ */ jsxs("p", {
							className: "flex items-baseline gap-2 tabular-nums",
							children: [product.discountPrice !== null && /* @__PURE__ */ jsx("span", {
								className: "text-ink/50 line-through",
								children: money(product.price)
							}), /* @__PURE__ */ jsx("span", {
								className: "font-display text-2xl font-semibold text-brick",
								children: money(product.effectivePrice)
							})]
						}),
						summary && /* @__PURE__ */ jsxs("p", {
							className: "inline-flex items-center gap-1 text-sm text-ink/80",
							children: [
								/* @__PURE__ */ jsx(Star, { className: "size-4 fill-marigold text-marigold" }),
								summary.avg.toFixed(1),
								" · ",
								summary.count,
								" review",
								summary.count === 1 ? "" : "s"
							]
						}),
						product.colors.length > 0 && /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsxs("p", {
							className: "mb-2 text-sm font-medium",
							children: ["Colour · ", color]
						}), /* @__PURE__ */ jsx("div", {
							className: "flex flex-wrap gap-2",
							children: product.colors.map((swatch) => /* @__PURE__ */ jsx("button", {
								type: "button",
								"aria-label": swatch.name,
								onClick: () => setSelection(product.id, { color: swatch.name }),
								className: clsx("size-10 rounded-full border", color === swatch.name ? "border-teal ring-2 ring-teal ring-offset-2 ring-offset-cream" : "border-line"),
								style: { background: swatch.hex }
							}, swatch.name))
						})] }),
						product.sizes.length > 0 && /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsxs("p", {
							className: "mb-2 text-sm font-medium",
							children: ["Size · ", size]
						}), /* @__PURE__ */ jsx("div", {
							className: "flex flex-wrap gap-2",
							children: product.sizes.map((option) => /* @__PURE__ */ jsx("button", {
								type: "button",
								onClick: () => setSelection(product.id, { size: option }),
								className: clsx("min-h-11 min-w-11 rounded-full border px-3 text-sm font-medium", size === option ? "border-teal bg-teal text-ivory" : "border-line bg-surface text-ink"),
								children: option
							}, option))
						})] }),
						/* @__PURE__ */ jsxs("div", {
							className: "flex items-center justify-between",
							children: [/* @__PURE__ */ jsx("p", {
								className: "text-sm font-medium",
								children: "Quantity"
							}), /* @__PURE__ */ jsxs("div", {
								className: "flex items-center gap-3",
								children: [
									/* @__PURE__ */ jsx("button", {
										type: "button",
										"aria-label": "Decrease",
										onClick: () => setSelection(product.id, { qty: Math.max(1, qty - 1) }),
										className: "flex size-11 items-center justify-center rounded-full border border-line bg-surface",
										children: /* @__PURE__ */ jsx(Minus, { className: "size-4" })
									}),
									/* @__PURE__ */ jsx("span", {
										className: "w-6 text-center tabular-nums",
										children: qty
									}),
									/* @__PURE__ */ jsx("button", {
										type: "button",
										"aria-label": "Increase",
										onClick: () => setSelection(product.id, { qty: Math.min(20, qty + 1) }),
										className: "flex size-11 items-center justify-center rounded-full border border-line bg-surface",
										children: /* @__PURE__ */ jsx(Plus, { className: "size-4" })
									})
								]
							})]
						}),
						out && /* @__PURE__ */ jsxs("form", {
							className: "space-y-2 rounded-2xl border border-line bg-surface p-3",
							onSubmit: (event) => {
								event.preventDefault();
								const email = alertEmail.trim();
								if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
									setAlertMsg("Please enter a valid email.");
									return;
								}
								setSending(true);
								submitStockAlert({
									productId: product.id,
									productName: product.name,
									itemNo: product.itemNo,
									email,
									createdAt: Date.now(),
									notified: false
								}).then(() => {
									setAlertMsg("We'll email you when it's back.");
									setAlertEmail("");
								}).catch(() => setAlertMsg("Something went wrong, try again.")).finally(() => setSending(false));
							},
							children: [
								/* @__PURE__ */ jsx("p", {
									className: "text-sm font-medium",
									children: "Notify me when it's back"
								}),
								/* @__PURE__ */ jsx("input", {
									type: "email",
									value: alertEmail,
									onChange: (event) => setAlertEmail(event.target.value),
									placeholder: "Your email address",
									className: "h-12 w-full rounded-xl border border-line bg-cream px-3 text-ink outline-none focus:border-teal"
								}),
								/* @__PURE__ */ jsx("button", {
									type: "submit",
									disabled: sending,
									className: "h-11 w-full rounded-xl border border-ink text-sm font-medium",
									children: "Notify me"
								}),
								alertMsg && /* @__PURE__ */ jsx("p", {
									className: "text-sm text-teal",
									children: alertMsg
								})
							]
						}),
						/* @__PURE__ */ jsxs("section", {
							className: "border-t border-line pt-4",
							children: [
								/* @__PURE__ */ jsx("h3", {
									className: "font-display text-xl font-semibold",
									children: "Reviews"
								}),
								/* @__PURE__ */ jsxs("div", {
									className: "mt-3 space-y-3",
									children: [(reviews ?? []).length === 0 && /* @__PURE__ */ jsx("p", {
										className: "text-sm text-ink/70",
										children: "No reviews yet — be the first."
									}), (reviews ?? []).map((review) => /* @__PURE__ */ jsxs("article", {
										className: "rounded-2xl border border-line bg-surface p-3",
										children: [/* @__PURE__ */ jsxs("div", {
											className: "flex items-center justify-between gap-2",
											children: [/* @__PURE__ */ jsx("p", {
												className: "font-medium",
												children: review.name
											}), /* @__PURE__ */ jsxs("p", {
												className: "text-marigold",
												children: ["★".repeat(review.rating), "☆".repeat(Math.max(0, 5 - review.rating))]
											})]
										}), review.comment && /* @__PURE__ */ jsx("p", {
											className: "mt-1 text-sm text-pretty text-ink/80",
											children: review.comment
										})]
									}, review.id))]
								}),
								/* @__PURE__ */ jsxs("form", {
									className: "mt-4 space-y-3",
									onSubmit: (event) => {
										event.preventDefault();
										if (!name.trim() || rating === 0) {
											toast.error("Enter your name and a star rating.");
											return;
										}
										setSending(true);
										submitReview({
											productId: product.id,
											name: name.trim(),
											rating,
											comment: comment.trim(),
											createdAt: Date.now()
										}).then(async () => {
											toast.success("Review posted");
											setComment("");
											setRating(0);
											await refreshCatalogue();
										}).catch((error) => {
											toast.error(error instanceof Error ? error.message : "Couldn't submit your review.");
										}).finally(() => setSending(false));
									},
									children: [
										/* @__PURE__ */ jsx("div", {
											className: "flex gap-1",
											children: [
												1,
												2,
												3,
												4,
												5
											].map((star) => /* @__PURE__ */ jsx("button", {
												type: "button",
												"aria-label": `${star} star`,
												onClick: () => setRating(star),
												className: "flex size-11 items-center justify-center",
												children: /* @__PURE__ */ jsx(Star, { className: clsx("size-6", star <= rating ? "fill-marigold text-marigold" : "text-ink/30") })
											}, star))
										}),
										/* @__PURE__ */ jsx("input", {
											value: name,
											onChange: (event) => setName(event.target.value),
											placeholder: "Your name",
											className: "h-12 w-full rounded-xl border border-line bg-surface px-3 outline-none focus:border-teal"
										}),
										/* @__PURE__ */ jsx("textarea", {
											value: comment,
											onChange: (event) => setComment(event.target.value),
											placeholder: "What did you think?",
											rows: 3,
											className: "w-full rounded-xl border border-line bg-surface px-3 py-3 outline-none focus:border-teal"
										}),
										/* @__PURE__ */ jsx("button", {
											type: "submit",
											disabled: sending,
											className: "h-12 w-full rounded-xl bg-teal font-medium text-ivory disabled:opacity-60",
											children: "Submit review"
										})
									]
								})
							]
						})
					]
				})]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "sheet-pad grid grid-cols-2 gap-2 border-t border-line bg-cream px-4 pt-3",
				children: [/* @__PURE__ */ jsx("button", {
					type: "button",
					disabled: out,
					onClick: () => {
						addToCart(product);
						toast.success("Added to cart");
					},
					className: "h-12 rounded-xl bg-teal-deep font-medium text-ivory disabled:opacity-40",
					children: "Add to cart"
				}), /* @__PURE__ */ jsx("button", {
					type: "button",
					disabled: out,
					onClick: () => openCheckoutBuy(product),
					className: "h-12 rounded-xl bg-teal font-medium text-ivory disabled:opacity-40",
					children: "Order on WhatsApp"
				})]
			})
		]
	});
}
//#endregion
//#region src/components/store/track-view.tsx
var STEPS = [
	"Confirmed",
	"Shipped",
	"Delivered"
];
function TrackView() {
	const [code, setCode] = useState("");
	const [busy, setBusy] = useState(false);
	const [message, setMessage] = useState("");
	const [order, setOrder] = useState(null);
	return /* @__PURE__ */ jsxs("div", {
		className: "px-4 py-6",
		children: [
			/* @__PURE__ */ jsx("p", {
				className: "text-xs font-semibold tracking-widest text-brick uppercase",
				children: "Orders"
			}),
			/* @__PURE__ */ jsx("h2", {
				className: "mt-1 font-display text-3xl font-semibold",
				children: "Track your order"
			}),
			/* @__PURE__ */ jsx("p", {
				className: "mt-2 text-sm text-pretty text-ink/70",
				children: "Enter the Order ID you received after checkout — it looks like JM7K2P9X."
			}),
			/* @__PURE__ */ jsxs("form", {
				className: "mt-4 flex gap-2",
				onSubmit: (event) => {
					event.preventDefault();
					const next = code.trim().toUpperCase();
					if (!next) {
						setOrder(null);
						setMessage("Please enter your Order ID.");
						return;
					}
					setBusy(true);
					setMessage("");
					findOrder(next).then((data) => {
						if (!data) {
							setOrder(null);
							setMessage(`No order found with ID ${next}. Please check and try again.`);
							return;
						}
						setOrder({
							orderId: String(data.orderId || next),
							status: String(data.status || "Pending"),
							total: Number(data.total) || 0,
							items: Array.isArray(data.items) ? data.items : []
						});
					}).catch((error) => {
						setOrder(null);
						setMessage(error instanceof Error ? error.message : "Something went wrong.");
					}).finally(() => setBusy(false));
				},
				children: [/* @__PURE__ */ jsx("input", {
					value: code,
					onChange: (event) => setCode(event.target.value),
					placeholder: "Order ID",
					className: "h-12 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 uppercase outline-none focus:border-teal"
				}), /* @__PURE__ */ jsx("button", {
					type: "submit",
					disabled: busy,
					className: "h-12 rounded-xl bg-teal px-4 font-medium text-ivory disabled:opacity-60",
					children: busy ? "…" : "Track"
				})]
			}),
			message && /* @__PURE__ */ jsx("p", {
				className: "mt-4 text-sm text-ink/80",
				children: message
			}),
			order && /* @__PURE__ */ jsxs("article", {
				className: "mt-4 rounded-2xl border border-line bg-surface p-4",
				children: [
					/* @__PURE__ */ jsxs("p", {
						className: "font-display text-xl font-semibold",
						children: ["Order ", order.orderId]
					}),
					/* @__PURE__ */ jsx("p", {
						className: "mt-1 text-sm text-ink/70",
						children: order.items.map((item) => `${item.name ?? "Item"} (${item.itemNo ?? ""}) x${item.qty ?? 1}`).join(", ")
					}),
					/* @__PURE__ */ jsx("p", {
						className: "mt-2 font-semibold text-brick tabular-nums",
						children: money(order.total)
					}),
					/* @__PURE__ */ jsx("p", {
						className: "mt-2 inline-flex rounded-full bg-cream px-3 py-1 text-sm font-medium",
						children: order.status
					}),
					order.status === "Cancelled" ? /* @__PURE__ */ jsx("p", {
						className: "mt-4 font-semibold text-brick",
						children: "This order was cancelled."
					}) : /* @__PURE__ */ jsx("ol", {
						className: "mt-5 flex items-start",
						children: STEPS.map((label, index) => {
							const current = STEPS.indexOf(order.status);
							const done = index <= current;
							return /* @__PURE__ */ jsxs("li", {
								className: "flex flex-1 items-start",
								children: [/* @__PURE__ */ jsxs("div", {
									className: "flex flex-1 flex-col items-center gap-1",
									children: [/* @__PURE__ */ jsx("span", {
										className: clsx("flex size-8 items-center justify-center rounded-full border-2 text-sm", done ? "border-teal bg-teal text-ivory" : "border-line text-ink/50"),
										children: done ? "✓" : index + 1
									}), /* @__PURE__ */ jsx("span", {
										className: "text-center text-xs uppercase tracking-wide text-ink/70",
										children: label
									})]
								}), index < STEPS.length - 1 && /* @__PURE__ */ jsx("span", { className: clsx("mt-4 h-0.5 w-6", index < current ? "bg-teal" : "bg-line") })]
							}, label);
						})
					})
				]
			})
		]
	});
}
//#endregion
//#region src/components/store/shell.tsx
var TABS = [
	{
		id: "home",
		label: "Home",
		icon: Home$1
	},
	{
		id: "shop",
		label: "Shop",
		icon: Search
	},
	{
		id: "saved",
		label: "Saved",
		icon: Heart
	},
	{
		id: "bag",
		label: "Cart",
		icon: ShoppingBag
	},
	{
		id: "me",
		label: "Account",
		icon: UserRound
	}
];
function Shell() {
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
			if (document.visibilityState === "visible") refreshCatalogue();
		};
		document.addEventListener("visibilitychange", refresh);
		const timer = window.setInterval(() => void refreshCatalogue(), 6e4);
		return () => {
			window.removeEventListener("hashchange", openHash);
			document.removeEventListener("visibilitychange", refresh);
			window.clearInterval(timer);
		};
	}, [openProduct, refreshCatalogue]);
	useEffect(() => {
		const onKey = (event) => {
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
	const title = screen === "track" ? "Track order" : screen === "help" ? "Help" : TABS.find((item) => item.id === tab)?.label;
	return /* @__PURE__ */ jsxs("div", {
		className: "min-h-dvh bg-cream text-ink",
		children: [
			/* @__PURE__ */ jsx(Toaster, { position: "top-center" }),
			/* @__PURE__ */ jsxs("header", {
				className: "sticky top-0 z-30 border-b border-line bg-cream/95 backdrop-blur",
				children: [
					/* @__PURE__ */ jsxs("div", {
						className: "mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 pt-3",
						children: [/* @__PURE__ */ jsxs("button", {
							type: "button",
							onClick: () => setTab("home"),
							className: "flex min-w-0 items-center gap-2",
							children: [/* @__PURE__ */ jsx("img", {
								src: LOGO_URL,
								alt: "",
								className: "size-9 rounded-lg object-cover"
							}), /* @__PURE__ */ jsxs("span", {
								className: "font-display text-xl font-bold tracking-tight",
								children: [
									"JM",
									/* @__PURE__ */ jsx("span", {
										className: "text-brick",
										children: "-"
									}),
									"Store"
								]
							})]
						}), /* @__PURE__ */ jsxs("div", {
							className: "flex items-center gap-2",
							children: [/* @__PURE__ */ jsx("button", {
								type: "button",
								"aria-label": dark ? "Switch to light mode" : "Switch to dark mode",
								onClick: toggleDark,
								className: "flex size-11 items-center justify-center rounded-full border border-line bg-surface",
								children: dark ? /* @__PURE__ */ jsx(Sun, { className: "size-5" }) : /* @__PURE__ */ jsx(Moon, { className: "size-5" })
							}), /* @__PURE__ */ jsx("a", {
								href: `https://wa.me/${WHATSAPP_NUMBER}`,
								"aria-label": "WhatsApp the shop",
								className: "flex size-11 items-center justify-center rounded-full bg-teal text-ivory",
								children: /* @__PURE__ */ jsx(MessageCircle, { className: "size-5" })
							})]
						})]
					}),
					/* @__PURE__ */ jsx("form", {
						className: "mx-auto max-w-5xl px-4 pt-2 pb-3",
						onSubmit: (event) => {
							event.preventDefault();
							setTab("shop");
						},
						children: /* @__PURE__ */ jsxs("label", {
							className: "flex h-12 items-center gap-2 rounded-full border border-line bg-surface px-3 focus-within:border-teal",
							children: [
								/* @__PURE__ */ jsx(Search, { className: "size-4 text-teal" }),
								/* @__PURE__ */ jsx("input", {
									value: search,
									onChange: (event) => setSearch(event.target.value),
									placeholder: "Search name, item no, colour",
									className: "h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-ink/40"
								}),
								search && /* @__PURE__ */ jsx("button", {
									type: "button",
									"aria-label": "Clear search",
									onClick: () => setSearch(""),
									children: /* @__PURE__ */ jsx(X, { className: "size-4" })
								})
							]
						})
					}),
					marquee && /* @__PURE__ */ jsx("div", {
						className: "overflow-hidden border-t border-line bg-marigold text-teal-deep",
						children: /* @__PURE__ */ jsxs("div", {
							className: "marquee flex w-max gap-16 py-2 text-sm font-semibold",
							children: [/* @__PURE__ */ jsx("span", { children: marquee }), /* @__PURE__ */ jsx("span", {
								"aria-hidden": "true",
								children: marquee
							})]
						})
					})
				]
			}),
			/* @__PURE__ */ jsxs("main", {
				className: "mx-auto min-h-[70dvh] max-w-5xl pb-28",
				children: [
					screen === "track" && /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx(Back, {
						onBack: () => setScreen(null),
						title: title ?? ""
					}), /* @__PURE__ */ jsx(TrackView, {})] }),
					screen === "help" && /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx(Back, {
						onBack: () => setScreen(null),
						title: title ?? ""
					}), /* @__PURE__ */ jsx(HelpView, {})] }),
					!screen && tab === "home" && /* @__PURE__ */ jsx(HomeView, {}),
					!screen && tab === "shop" && /* @__PURE__ */ jsx(Shop, {}),
					!screen && tab === "saved" && /* @__PURE__ */ jsx(Saved, {}),
					!screen && tab === "bag" && /* @__PURE__ */ jsx(BagView, {}),
					!screen && tab === "me" && /* @__PURE__ */ jsx(AccountView, {})
				]
			}),
			/* @__PURE__ */ jsx("nav", {
				className: "tabbar fixed inset-x-0 bottom-0 z-30 border-t border-line bg-cream/95 backdrop-blur",
				children: /* @__PURE__ */ jsx("ul", {
					className: "mx-auto grid max-w-5xl grid-cols-5",
					children: TABS.map((item) => {
						const Icon = item.icon;
						const active = !screen && tab === item.id;
						const badge = item.id === "bag" ? cartCount : item.id === "saved" ? savedCount : 0;
						return /* @__PURE__ */ jsx("li", { children: /* @__PURE__ */ jsxs("button", {
							type: "button",
							onClick: () => setTab(item.id),
							className: clsx("relative flex h-16 w-full flex-col items-center justify-center gap-0.5 text-xs font-medium", active ? "text-teal" : "text-ink/55"),
							children: [
								/* @__PURE__ */ jsx(Icon, {
									className: "size-5",
									fill: active && (item.id === "saved" || item.id === "home") ? "currentColor" : "none"
								}),
								item.label,
								badge > 0 && /* @__PURE__ */ jsx("span", {
									className: "absolute top-1 right-4 flex min-w-5 items-center justify-center rounded-full bg-marigold px-1 text-xs font-bold text-teal-deep",
									children: badge
								})
							]
						}) }, item.id);
					})
				})
			}),
			productOpen && /* @__PURE__ */ jsx(ProductSheet, {}),
			/* @__PURE__ */ jsx(CheckoutSheet, {}),
			lightbox && /* @__PURE__ */ jsxs("div", {
				className: "z-lightbox fixed inset-0 flex flex-col bg-ink text-ivory",
				children: [
					/* @__PURE__ */ jsx("div", {
						className: "flex justify-end p-2",
						children: /* @__PURE__ */ jsx("button", {
							type: "button",
							"aria-label": "Close photos",
							onClick: closeLightbox,
							className: "flex size-11 items-center justify-center rounded-full bg-ivory/15",
							children: /* @__PURE__ */ jsx(X, {})
						})
					}),
					/* @__PURE__ */ jsx("div", {
						className: "flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto",
						children: lightbox.images.map((src, index) => /* @__PURE__ */ jsx("img", {
							src,
							alt: "",
							className: "h-full w-full shrink-0 snap-center object-contain"
						}, src + index))
					}),
					/* @__PURE__ */ jsxs("p", {
						className: "py-4 text-center text-sm",
						children: [lightbox.images.length, " photos"]
					})
				]
			})
		]
	});
}
function Back({ title, onBack }) {
	return /* @__PURE__ */ jsxs("div", {
		className: "flex items-center gap-2 px-2 pt-2",
		children: [/* @__PURE__ */ jsx("button", {
			type: "button",
			onClick: onBack,
			className: "h-11 rounded-full px-3 text-sm font-medium text-teal",
			children: "Back"
		}), /* @__PURE__ */ jsx("h1", {
			className: "font-display text-lg font-semibold",
			children: title
		})]
	});
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
	const groups = /* @__PURE__ */ new Map();
	for (const product of products) {
		if (arrivalIds.has(product.id)) continue;
		const key = product.category || "More";
		const list = groups.get(key) ?? [];
		list.push(product);
		groups.set(key, list);
	}
	return /* @__PURE__ */ jsxs("div", { children: [
		/* @__PURE__ */ jsxs("section", {
			className: "px-4 pt-8 pb-4 text-center",
			children: [
				/* @__PURE__ */ jsx("p", {
					className: "text-xs font-semibold tracking-widest text-brick uppercase",
					children: "Item no. · Colour · WhatsApp"
				}),
				/* @__PURE__ */ jsxs("h1", {
					className: "mx-auto mt-3 max-w-xl font-display text-4xl leading-none font-semibold text-balance sm:text-5xl",
					children: ["The shop counter, ", /* @__PURE__ */ jsx("em", {
						className: "text-teal",
						children: "moved to your chat."
					})]
				}),
				/* @__PURE__ */ jsx("p", {
					className: "mx-auto mt-4 max-w-md text-pretty text-ink/75",
					children: "Browse the JM-Store catalogue, pick your item number, colour and quantity, drop your delivery address — and your order lands straight in our WhatsApp."
				}),
				/* @__PURE__ */ jsxs("div", {
					className: "mt-5 flex flex-wrap justify-center gap-2",
					children: [/* @__PURE__ */ jsx("button", {
						type: "button",
						onClick: () => setTab("shop"),
						className: "h-12 rounded-xl bg-teal px-5 font-medium text-ivory",
						children: "Browse catalogue"
					}), /* @__PURE__ */ jsx("button", {
						type: "button",
						onClick: () => setScreen("help"),
						className: "h-12 rounded-xl border border-ink px-5 font-medium",
						children: "About us"
					})]
				})
			]
		}),
		/* @__PURE__ */ jsxs("div", {
			className: "flex gap-2 overflow-x-auto px-4 pb-2",
			children: [
				/* @__PURE__ */ jsx(Quick, {
					label: "Track order",
					onClick: () => setScreen("track")
				}),
				/* @__PURE__ */ jsx(Quick, {
					label: "Size & FAQ",
					onClick: () => setScreen("help")
				}),
				/* @__PURE__ */ jsx(Quick, {
					label: "Reviews",
					onClick: () => setScreen("help")
				})
			]
		}),
		/* @__PURE__ */ jsxs("div", {
			className: "flex gap-2 overflow-x-auto px-4 py-3",
			children: [/* @__PURE__ */ jsx(Chip, {
				active: false,
				onClick: () => setCategory("All"),
				children: "All"
			}), categories.map((name) => /* @__PURE__ */ jsx(Chip, {
				active: false,
				onClick: () => setCategory(name),
				children: name
			}, name))]
		}),
		error && /* @__PURE__ */ jsxs("div", {
			className: "mx-4 rounded-2xl border border-line bg-surface p-4",
			children: [/* @__PURE__ */ jsx("p", {
				className: "font-medium",
				children: "Couldn’t load the catalogue."
			}), /* @__PURE__ */ jsx("button", {
				type: "button",
				onClick: () => void refreshCatalogue(),
				className: "mt-3 h-11 rounded-xl bg-teal px-4 text-sm font-medium text-ivory",
				children: "Try again"
			})]
		}),
		!error && products.length === 0 && /* @__PURE__ */ jsx("p", {
			className: "px-4 py-8 text-center text-ink/70",
			children: "The catalogue is empty right now."
		}),
		arrivals.length > 0 && /* @__PURE__ */ jsx(Row, {
			title: "New arrivals",
			items: arrivals,
			onSeeAll: () => {
				useStore.setState({ sort: "newest" });
				setTab("shop");
			}
		}),
		[...groups.entries()].map(([name, items]) => /* @__PURE__ */ jsx(Row, {
			title: name,
			items,
			onSeeAll: () => setCategory(name)
		}, name))
	] });
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
	const list = visibleProducts({
		products,
		category,
		search,
		sort,
		reviews
	});
	return /* @__PURE__ */ jsxs("div", {
		className: "px-4 py-4",
		children: [
			/* @__PURE__ */ jsxs("div", {
				className: "flex items-end justify-between gap-3",
				children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("h2", {
					className: "font-display text-3xl font-semibold",
					children: "Catalogue"
				}), /* @__PURE__ */ jsx("p", {
					className: "mt-1 max-w-sm text-sm text-ink/70",
					children: "Every item has its own number — quote it and we’ll know exactly what you mean."
				})] }), /* @__PURE__ */ jsxs("label", {
					className: "text-xs font-medium text-ink/70",
					children: ["Sort", /* @__PURE__ */ jsxs("select", {
						value: sort,
						onChange: (event) => setSort(event.target.value),
						className: "mt-1 block h-11 rounded-xl border border-line bg-surface px-2 text-sm text-ink",
						children: [
							/* @__PURE__ */ jsx("option", {
								value: "featured",
								children: "Featured"
							}),
							/* @__PURE__ */ jsx("option", {
								value: "newest",
								children: "Newest"
							}),
							/* @__PURE__ */ jsx("option", {
								value: "price-low",
								children: "Price: Low to High"
							}),
							/* @__PURE__ */ jsx("option", {
								value: "price-high",
								children: "Price: High to Low"
							}),
							/* @__PURE__ */ jsx("option", {
								value: "popular",
								children: "Most popular"
							})
						]
					})]
				})]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "mt-4 flex gap-2 overflow-x-auto pb-3",
				children: [/* @__PURE__ */ jsx(Chip, {
					active: category === "All",
					onClick: () => useStore.setState({ category: "All" }),
					children: "All"
				}), categories.map((name) => /* @__PURE__ */ jsx(Chip, {
					active: category === name,
					onClick: () => setCategory(name),
					children: name
				}, name))]
			}),
			error && /* @__PURE__ */ jsx("p", {
				className: "text-sm text-brick",
				children: error
			}),
			list.length === 0 ? /* @__PURE__ */ jsxs("div", {
				className: "rounded-2xl border border-line bg-surface p-6 text-center",
				children: [/* @__PURE__ */ jsx("h3", {
					className: "font-display text-2xl font-semibold",
					children: "Product not available"
				}), /* @__PURE__ */ jsx("p", {
					className: "mt-1 text-sm text-ink/70",
					children: "Sorry, we couldn’t find any matching products."
				})]
			}) : /* @__PURE__ */ jsx("div", {
				className: "grid grid-cols-2 gap-3 sm:grid-cols-3",
				children: list.map((product) => /* @__PURE__ */ jsx(ProductCard, { product }, product.id))
			})
		]
	});
}
function Saved() {
	const wishlist = useStore((s) => s.wishlist);
	const products = useStore((s) => s.products);
	const items = wishlist.map((id) => products.find((product) => product.id === id)).filter((product) => !!product);
	const setTab = useStore((s) => s.setTab);
	if (items.length === 0) return /* @__PURE__ */ jsxs("div", {
		className: "px-4 py-16 text-center",
		children: [
			/* @__PURE__ */ jsx("h2", {
				className: "font-display text-3xl font-semibold",
				children: "Nothing saved yet"
			}),
			/* @__PURE__ */ jsx("p", {
				className: "mt-2 text-ink/70",
				children: "Tap the heart on any product to keep it here."
			}),
			/* @__PURE__ */ jsx("button", {
				type: "button",
				onClick: () => setTab("shop"),
				className: "mt-6 h-12 rounded-xl bg-teal px-6 font-medium text-ivory",
				children: "Browse catalogue"
			})
		]
	});
	return /* @__PURE__ */ jsxs("div", {
		className: "px-4 py-4",
		children: [/* @__PURE__ */ jsx("h2", {
			className: "font-display text-3xl font-semibold",
			children: "Wishlist"
		}), /* @__PURE__ */ jsx("div", {
			className: "mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3",
			children: items.map((product) => /* @__PURE__ */ jsx(ProductCard, { product }, product.id))
		})]
	});
}
function Row({ title, items, onSeeAll }) {
	const products = useStore((s) => s.products);
	const cards = items.map((item) => products.find((product) => product.id === item.id)).filter((product) => !!product);
	if (cards.length === 0) return null;
	return /* @__PURE__ */ jsxs("section", {
		className: "mt-2 mb-4",
		children: [/* @__PURE__ */ jsxs("div", {
			className: "flex items-center justify-between px-4",
			children: [/* @__PURE__ */ jsx("h2", {
				className: "font-display text-xl font-semibold",
				children: title
			}), /* @__PURE__ */ jsx("button", {
				type: "button",
				onClick: onSeeAll,
				className: "text-sm font-medium text-teal",
				children: "See all"
			})]
		}), /* @__PURE__ */ jsx("div", {
			className: "mt-3 flex snap-x gap-3 overflow-x-auto px-4 pb-2 md:grid md:grid-cols-3 md:overflow-visible lg:grid-cols-4",
			children: cards.map((product) => /* @__PURE__ */ jsx(ProductCard, {
				product,
				compact: true
			}, product.id))
		})]
	});
}
function Chip({ active, onClick, children }) {
	return /* @__PURE__ */ jsx("button", {
		type: "button",
		onClick,
		className: clsx("h-10 shrink-0 rounded-full border px-4 text-sm font-medium", active ? "border-teal bg-teal text-ivory" : "border-line bg-surface text-ink"),
		children
	});
}
function Quick({ label, onClick }) {
	return /* @__PURE__ */ jsx("button", {
		type: "button",
		onClick,
		className: "h-10 shrink-0 rounded-full border border-line bg-surface px-4 text-sm font-medium",
		children: label
	});
}
//#endregion
//#region src/routes/index.tsx?tsr-split=component
function Home() {
	const ready = useStore((s) => s.ready);
	useEffect(() => {
		useStore.getState().boot();
	}, []);
	if (!ready) return /* @__PURE__ */ jsx(Splash, {});
	return /* @__PURE__ */ jsx(Shell, {});
}
function Splash() {
	return /* @__PURE__ */ jsxs("div", {
		className: "flex min-h-dvh flex-col items-center justify-center gap-4 bg-teal text-ivory",
		children: [
			/* @__PURE__ */ jsx("img", {
				src: LOGO_URL,
				alt: "",
				className: "size-20 rounded-2xl object-cover"
			}),
			/* @__PURE__ */ jsxs("p", {
				className: "font-display text-3xl font-bold",
				children: [
					"JM",
					/* @__PURE__ */ jsx("span", {
						className: "text-marigold",
						children: "-"
					}),
					"Store"
				]
			}),
			/* @__PURE__ */ jsx("p", {
				className: "text-sm text-ivory/80",
				children: "Opening the catalogue…"
			})
		]
	});
}
//#endregion
export { Home as component };
