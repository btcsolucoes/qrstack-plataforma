const ASSETS = {
  qrstackMark: "assets/qrstack-mark.png",
  qrstackWordmark: "assets/qrstack-wordmark.png",
};

const QRSTACK_API_URL =
  "https://script.google.com/macros/s/AKfycbxb7McfZcNZ1FwpJ1WXKS1NURWjE8AQdK5X7CYAL0zNQIH2UQdtnKCKQjlzmyyuQwrcuQ/exec";
const ACTIVE_CLIENT_SLUG = "amaro";
const ACTIVE_CLIENT_TOKEN = "qrstack-amaro-2026";
const OWNER_ACCESS_TOKEN = "qrstack-berna-2026";
const OWNER_SESSION_KEY = "qrstack:owner-access";
const CLIENT_SESSION_PREFIX = "qrstack:client-access:";
const AMARO_ASSETS_BASE_URL = "https://btcsolucoes.github.io/carda-pio/";
const AMARO_STORY_LINK = "https://tinyurl.com/amaromenu";

const DEFAULT_STATE = {
  restaurants: [
    {
      id: "rest_amaro",
      name: "Amaro Café",
      slug: "amaro",
      logoUrl: `${AMARO_ASSETS_BASE_URL}assets/amaro/amaro-logo-transparent.png`,
      symbolUrl: "",
      primaryColor: "#0b3422",
      secondaryColor: "#bd8732",
      whatsappNumber: "5581999999999",
      instagramUrl: "https://instagram.com/amarocafe",
      mapsUrl: "https://maps.google.com/?q=R.%20do%20Apolo%2C%20182%20-%20Recife%20Antigo%2C%20Recife%20-%20PE",
      address: "R. do Apolo, 182 - Recife Antigo, Recife - PE",
      githubRepo: "btcsolucoes/carda-pio",
      githubPagesUrl: AMARO_ASSETS_BASE_URL,
      assetsBaseUrl: AMARO_ASSETS_BASE_URL,
      manifestUrl: `${AMARO_ASSETS_BASE_URL}qrstack/amaro-manifest.json`,
      catalogUrl: `${AMARO_ASSETS_BASE_URL}qrstack/amaro-catalog.json`,
      sectionsUrl: `${AMARO_ASSETS_BASE_URL}qrstack/amaro-sections.json`,
      liveMenuEndpoint: "https://script.google.com/macros/s/AKfycbwzyID0E9XLYcR4VGvDgiY90YLRIcnaR6nWs9ybkC70LTTY4ScXABcqqhc1GFTr-AA2/exec",
      analyticsEndpoint: "https://script.google.com/macros/s/AKfycbwzyID0E9XLYcR4VGvDgiY90YLRIcnaR6nWs9ybkC70LTTY4ScXABcqqhc1GFTr-AA2/exec",
      adminToken: ACTIVE_CLIENT_TOKEN,
      reminderTime: "09:00",
      reminderEnabled: false,
      messageTemplate:
        "Bom dia! Segue o link do painel QrStack para publicar o cardápio e gerar o Story de hoje: {link}",
    },
  ],
  menuDays: [
    {
      id: "menu_amaro_today",
      restaurantId: "rest_amaro",
      date: todayIso(),
      title: "Almoço de Hoje",
      price: "",
      serviceHours: "11h às 15h",
      storyLink: AMARO_STORY_LINK,
      notes: "Importado do fluxo real do Amaro para a plataforma QrStack.",
      isPublished: true,
      publishedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
  menuItems: [
    item("menu_amaro_today", "Carne de Sol Desarrumada", "Executivo", true, 1, "Carne de sol em cubos montada sobre feijão verde com molho de queijos, farofa crocante, cebola crocante e pipoca de queijo coalho", "R$ 36,00"),
    item("menu_amaro_today", "Camarão Imperador", "Executivo", true, 2, "Camarões empanados e gratinados, com molho pomodoro, sobre purê de batatas e arroz de brócolis", "R$ 37,00"),
    item("menu_amaro_today", "Charque Brejeira", "Executivo", true, 3, "Charque desfiada e crocante, arroz cremoso de queijo coalho, farofa tropeira com cuscuz e feijão verde", "R$ 37,00"),
    item("menu_amaro_today", "Frango à Parmegiana", "Executivo", true, 4, "Frango empanado e gratinado, linguine ao tomate, fritas ou purê de batatas", "R$ 32,00"),
    item("menu_amaro_today", "Galinhada Amaro", "Executivo", true, 5, "Baião de arroz com fava cozido no caldo de cozimento do frango e coxa com sobrecoxa desossada frita", "R$ 36,00"),
    item("menu_amaro_today", "Maminha do Apolo", "Executivo", true, 6, "Maminha grelhada ao chimichurri, purê de batata, arroz de alho, picles de maxixe e crispy de cebola", "R$ 36,00"),
    item("menu_amaro_today", "Picadinho Carioca", "Executivo", true, 7, "Contra filé ao molho, arroz de couve e cenoura, feijão carioca, farofa panko e ovo frito", "R$ 35,00"),
  ],
  storyAssets: [],
  events: [],
};

const STORE_KEY = "qrstack-platform-v4-amaro";
const app = document.getElementById("app");
let state = loadState();
let lastStoryDataUrl = "";
let routeVersion = 0;

function item(menuDayId, name, category, isHighlight, sortOrder, description = "", price = "") {
  return {
    id: `item-${menuDayId}-${sortOrder}`,
    menuDayId,
    name,
    category,
    description,
    price,
    isHighlight,
    sortOrder,
    createdAt: new Date().toISOString(),
  };
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function loadState() {
  try {
    const stored = localStorage.getItem(STORE_KEY);
    if (!stored) return structuredClone(DEFAULT_STATE);
    const parsed = JSON.parse(stored);
    return hydratePersistedState({
      ...structuredClone(DEFAULT_STATE),
      ...parsed,
    });
  } catch {
    return structuredClone(DEFAULT_STATE);
  }
}

function hydratePersistedState(parsedState) {
  const defaultsBySlug = new Map(DEFAULT_STATE.restaurants.map((restaurant) => [restaurant.slug, restaurant]));
  parsedState.restaurants = (parsedState.restaurants || []).map((restaurant) => {
    const defaults = defaultsBySlug.get(restaurant.slug) || {};
    return {
      ...defaults,
      ...restaurant,
      githubRepo: restaurant.githubRepo || defaults.githubRepo || "",
      githubPagesUrl: restaurant.githubPagesUrl || defaults.githubPagesUrl || "",
      assetsBaseUrl: restaurant.assetsBaseUrl || defaults.assetsBaseUrl || "",
      manifestUrl: restaurant.manifestUrl || defaults.manifestUrl || "",
      catalogUrl: restaurant.catalogUrl || defaults.catalogUrl || "",
      sectionsUrl: restaurant.sectionsUrl || defaults.sectionsUrl || "",
      liveMenuEndpoint: restaurant.liveMenuEndpoint || defaults.liveMenuEndpoint || "",
      analyticsEndpoint: restaurant.analyticsEndpoint || defaults.analyticsEndpoint || restaurant.liveMenuEndpoint || defaults.liveMenuEndpoint || "",
    };
  });
  return parsedState;
}

function saveState() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

async function apiGet(action, params = {}) {
  if (!QRSTACK_API_URL) throw new Error("missing_api_url");
  const url = new URL(QRSTACK_API_URL);
  url.searchParams.set("action", action);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, value);
  });
  const response = await fetchWithTimeout(url.toString(), { cache: "no-store" }, 1600);
  const text = await response.text();
  if (!text.trim().startsWith("{")) throw new Error("api_not_public_or_not_json");
  const data = JSON.parse(text);
  if (!response.ok || data.ok === false) throw new Error(data.error || "api_request_failed");
  return data;
}

async function endpointGet(endpoint, action, params = {}) {
  if (!endpoint) throw new Error("missing_endpoint");
  const url = new URL(endpoint);
  url.searchParams.set("action", action);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, value);
  });
  try {
    const response = await fetchWithTimeout(url.toString(), { cache: "no-store" }, 12000);
    const text = await response.text();
    if (!text.trim().startsWith("{")) throw new Error("endpoint_not_public_or_not_json");
    const data = JSON.parse(text);
    if (!response.ok || data.ok === false) throw new Error(data.error || "endpoint_request_failed");
    return data;
  } catch (error) {
    if (action === "getInsights") return endpointJsonp(url, 12000);
    throw error;
  }
}

function endpointJsonp(url, timeoutMs = 12000) {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return Promise.reject(new Error("jsonp_not_available"));
  }
  const jsonpUrl = new URL(url.toString());
  const callbackName = `__qrstackJsonp${Date.now()}${Math.random().toString(16).slice(2)}`;
  jsonpUrl.searchParams.set("callback", callbackName);
  return new Promise((resolve, reject) => {
    let settled = false;
    const script = document.createElement("script");
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error("endpoint_jsonp_timeout"));
    }, timeoutMs);
    const cleanup = () => {
      clearTimeout(timeout);
      delete window[callbackName];
      script.remove();
    };
    window[callbackName] = (data) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (!data || data.ok === false) reject(new Error(data?.error || "endpoint_jsonp_failed"));
      else resolve(data);
    };
    script.onerror = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error("endpoint_jsonp_error"));
    };
    script.async = true;
    script.src = jsonpUrl.toString();
    document.head.appendChild(script);
  });
}

async function apiPost(payload) {
  if (!QRSTACK_API_URL) throw new Error("missing_api_url");
  const response = await fetchWithTimeout(QRSTACK_API_URL, {
    method: "POST",
    body: JSON.stringify(payload),
  }, 2200);
  const text = await response.text();
  if (!text.trim().startsWith("{")) throw new Error("api_not_public_or_not_json");
  const data = JSON.parse(text);
  if (!response.ok || data.ok === false) throw new Error(data.error || "api_request_failed");
  return data;
}

function sendAnalyticsEvent(endpoint, payload) {
  if (!endpoint) return Promise.resolve();
  const body = JSON.stringify(payload);
  if (navigator.sendBeacon) {
    const sent = navigator.sendBeacon(endpoint, new Blob([body], { type: "text/plain;charset=UTF-8" }));
    if (sent) return Promise.resolve();
  }
  return fetch(endpoint, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain;charset=UTF-8" },
    body,
    keepalive: true,
  }).then(() => undefined);
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 1800) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function syncRestaurantFromApi(slug) {
  try {
    const data = await apiGet("getRestaurant", { slug });
    if (data.restaurant) {
      const restaurant = fromSheetRestaurant(data.restaurant);
      upsertById(state.restaurants, restaurant);
      saveState();
      return restaurant;
    }
  } catch (error) {
    console.warn("QrStack API unavailable:", error.message);
  }
  return getRestaurant(slug);
}

async function syncMenuFromApi(slug, date = todayIso()) {
  try {
    const data = await apiGet("getMenu", { slug, date });
    if (data.restaurant) upsertById(state.restaurants, fromSheetRestaurant(data.restaurant));
    if (data.menu) {
      const menu = fromSheetMenu(data.menu);
      upsertById(state.menuDays, menu);
      state.menuItems = state.menuItems.filter((item) => item.menuDayId !== menu.id);
      state.menuItems.push(...(data.items || []).map(fromSheetItem));
      saveState();
      return { restaurant: fromSheetRestaurant(data.restaurant), menu, items: getMenuItems(menu.id), fromApi: true };
    }
  } catch (error) {
    console.warn("QrStack menu API unavailable:", error.message);
  }
  const restaurant = getRestaurant(slug);
  const menu = getLatestMenu(restaurant.id);
  return { restaurant, menu, items: menu ? getMenuItems(menu.id) : [], fromApi: false };
}

function upsertById(list, object) {
  const index = list.findIndex((item) => item.id === object.id);
  if (index === -1) list.push(object);
  else list[index] = { ...list[index], ...object };
}

function fromSheetRestaurant(row) {
  const defaults = DEFAULT_STATE.restaurants.find((restaurant) => restaurant.slug === row.slug) || {};
  return {
    id: row.id || defaults.id,
    name: row.name || defaults.name,
    slug: row.slug || defaults.slug,
    logoUrl: row.logo_url || defaults.logoUrl || ASSETS.qrstackWordmark,
    symbolUrl: row.symbol_url || defaults.symbolUrl || "",
    primaryColor: row.primary_color || defaults.primaryColor || "#4a1f16",
    secondaryColor: row.secondary_color || defaults.secondaryColor || "#d59b52",
    whatsappNumber: row.whatsapp_number || defaults.whatsappNumber || "",
    instagramUrl: row.instagram_url || defaults.instagramUrl || "#",
    mapsUrl: row.maps_url || defaults.mapsUrl || "#",
    address: row.address || defaults.address || "",
    githubRepo: row.github_repo || defaults.githubRepo || "",
    githubPagesUrl: row.github_pages_url || defaults.githubPagesUrl || "",
    assetsBaseUrl: row.assets_base_url || defaults.assetsBaseUrl || "",
    manifestUrl: row.manifest_url || defaults.manifestUrl || "",
    catalogUrl: row.catalog_url || defaults.catalogUrl || "",
    sectionsUrl: row.sections_url || defaults.sectionsUrl || "",
    liveMenuEndpoint: row.live_menu_endpoint || defaults.liveMenuEndpoint || "",
    adminToken: row.admin_token || ACTIVE_CLIENT_TOKEN,
    reminderTime: row.reminder_time || "",
    reminderEnabled: String(row.reminder_enabled).toUpperCase() === "TRUE",
    messageTemplate: row.message_template || "",
  };
}

function fromSheetMenu(row) {
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    date: String(row.date || todayIso()).slice(0, 10),
    title: row.title || "Cardápio de hoje",
    price: row.price || "",
    serviceHours: row.service_hours || "",
    storyLink: row.story_link || "",
    notes: row.notes || "",
    isPublished: String(row.is_published).toUpperCase() === "TRUE",
    publishedAt: row.published_at || "",
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || "",
  };
}

function fromSheetItem(row) {
  return {
    id: row.id,
    menuDayId: row.menu_day_id,
    name: row.name,
    category: row.category || "Geral",
    description: row.description || "",
    price: row.price || "",
    isHighlight: String(row.is_highlight).toUpperCase() === "TRUE",
    sortOrder: Number(row.sort_order || 0),
    createdAt: row.created_at || "",
  };
}

async function router() {
  const currentRouteVersion = routeVersion + 1;
  routeVersion = currentRouteVersion;
  const hash = window.location.hash.replace(/^#\/?/, "");
  const [path, hashQuery = ""] = hash.split("?");
  const parts = path.split("/").filter(Boolean);
  const params = new URLSearchParams(hashQuery || window.location.search);
  const source = resolveTrafficSource(params).source;

  if (!hash || parts[0] === "home") return renderHome();
  if (parts[0] === "hq" || parts[0] === "central") return renderOwnerRoute(parts[1] || "overview", params);
  if (parts[0] === "cliente" || parts[0] === "admin") return renderClientRoute(parts[1] || ACTIVE_CLIENT_SLUG, params, currentRouteVersion);
  if (parts[0] === "r") return renderPublicMenu(parts[1] || ACTIVE_CLIENT_SLUG, source, currentRouteVersion);
  renderHome();
}

function isCurrentRoute(version) {
  return version === routeVersion;
}

function renderOwnerRoute(tab, params) {
  if (!hasOwnerAccess(params)) return renderOwnerGate();
  return renderHq(tab);
}

async function renderClientRoute(slug, params, version) {
  const localRestaurant = getRestaurant(slug);
  if (hasClientAccess(localRestaurant, params)) return renderClientPortal(slug, version);
  const restaurant = await syncRestaurantFromApi(slug);
  if (!isCurrentRoute(version)) return;
  if (!hasClientAccess(restaurant, params)) return renderClientGate(restaurant);
  return renderClientPortal(slug, version);
}

function hasOwnerAccess(params) {
  if (params.get("key") === OWNER_ACCESS_TOKEN) {
    rememberAccess(OWNER_SESSION_KEY);
    return true;
  }
  return hasRememberedAccess(OWNER_SESSION_KEY);
}

function hasClientAccess(restaurant, params) {
  const token = params.get("token");
  const expectedToken = restaurant.adminToken || ACTIVE_CLIENT_TOKEN;
  if (token === expectedToken) {
    rememberAccess(clientSessionKey(restaurant));
    return true;
  }
  return hasRememberedAccess(clientSessionKey(restaurant));
}

function rememberAccess(key) {
  try {
    sessionStorage.setItem(key, "1");
  } catch {
    // Navegadores com storage bloqueado ainda usam o token da URL.
  }
}

function hasRememberedAccess(key) {
  try {
    return sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function clientSessionKey(restaurant) {
  return `${CLIENT_SESSION_PREFIX}${restaurant.slug}`;
}

function ownerLink(tab = "overview") {
  return `#/hq/${tab}?key=${encodeURIComponent(OWNER_ACCESS_TOKEN)}`;
}

function clientPortalLink(restaurant) {
  return `#/cliente/${restaurant.slug}?token=${encodeURIComponent(restaurant.adminToken || ACTIVE_CLIENT_TOKEN)}`;
}

function publicMenuHash(restaurant, source = "qr") {
  return `#/r/${restaurant.slug}?src=${encodeURIComponent(normalizeSource(source))}`;
}

function absoluteAppUrl(hash) {
  return `${location.origin}${location.pathname}${hash}`;
}

function restaurantAccessUrl(restaurant) {
  return absoluteAppUrl(clientPortalLink(restaurant));
}

function restaurantPublicUrl(restaurant, source = "qr") {
  return absoluteAppUrl(publicMenuHash(restaurant, source));
}

function restaurantOriginalMenuUrl(restaurant, source = "platform") {
  const base = restaurant.githubPagesUrl || restaurant.pagesUrl || restaurant.assetsBaseUrl || restaurantPublicUrl(restaurant, source);
  try {
    const url = new URL(base);
    url.searchParams.set("src", normalizeSource(source));
    return url.toString();
  } catch {
    return base;
  }
}

function restaurantStoryLink(restaurant) {
  return restaurant.slug === "amaro" ? AMARO_STORY_LINK : restaurantPublicUrl(restaurant);
}

function setTheme(restaurant) {
  document.documentElement.style.setProperty("--primary", restaurant.primaryColor);
  document.documentElement.style.setProperty("--secondary", restaurant.secondaryColor);
  document.documentElement.style.setProperty("--accent", "#f4b740");
  document.documentElement.style.setProperty("--hero-mark", restaurant.symbolUrl ? `url("${restaurant.symbolUrl}")` : "none");
  document.documentElement.style.setProperty("--brand-pattern", restaurant.symbolUrl ? `url("${restaurant.symbolUrl}")` : "none");
}

function setSystemTheme() {
  document.documentElement.style.setProperty("--primary", "#0b2239");
  document.documentElement.style.setProperty("--secondary", "#27d39f");
  document.documentElement.style.setProperty("--accent", "#f4b740");
  document.documentElement.style.setProperty("--hero-mark", `url("${ASSETS.qrstackMark}")`);
  document.documentElement.style.setProperty("--brand-pattern", `url("${ASSETS.qrstackMark}")`);
}

function buildTrafficPayload(sourceHint = "") {
  const params = new URLSearchParams(window.location.search);
  const hashQuery = window.location.hash.includes("?") ? window.location.hash.split("?").slice(1).join("?") : "";
  const hashParams = new URLSearchParams(hashQuery);
  hashParams.forEach((value, key) => {
    if (!params.has(key)) params.set(key, value);
  });
  const traffic = resolveTrafficSource(params, sourceHint);
  const device = detectDevice();
  return {
    source: traffic.source,
    source_detail: traffic.detail,
    url: location.href,
    path: `${location.pathname}${location.hash || ""}`,
    referrer: document.referrer || "",
    user_agent: navigator.userAgent,
    language: navigator.language || "",
    session_id: getSessionId(),
    visitor_id: getVisitorId(),
    device_type: device.type,
    browser: device.browser,
    os: device.os,
    screen: `${window.screen?.width || 0}x${window.screen?.height || 0}`,
    viewport: `${window.innerWidth || 0}x${window.innerHeight || 0}`,
    timezone_offset: String(new Date().getTimezoneOffset()),
    timestamp: new Date().toISOString(),
  };
}

function resolveTrafficSource(params = new URLSearchParams(), sourceHint = "") {
  const explicit = sourceHint || params.get("src") || params.get("source") || params.get("origem") || params.get("ref") || params.get("utm_source") || params.get("utm_medium");
  const explicitSource = sourceFromText(explicit);
  if (explicitSource) return { source: explicitSource, detail: explicit || explicitSource };
  if (params.has("gclid") || params.has("gbraid") || params.has("wbraid")) return { source: "google", detail: "google_ads" };
  const referrer = document.referrer || "";
  if (!referrer) return { source: "direct", detail: "sem_referrer" };
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, "");
    return { source: sourceFromText(host) || "internet", detail: host };
  } catch {
    return { source: "internet", detail: "referrer_invalido" };
  }
}

function normalizeSource(value = "") {
  return sourceFromText(value) || "direct";
}

function sourceFromText(value = "") {
  const text = normalizeKey(value);
  if (!text) return "";
  if (/\b(qr|qrcode|qr code|mesa|table)\b/.test(text)) return "qr";
  if (text.includes("whatsapp") || text === "wa" || text.includes("wpp") || text.includes("wa me")) return "whatsapp";
  if (text.includes("instagram") || text.includes("instagr") || text === "ig" || text.includes("stories") || text.includes("l instagram")) return "instagram";
  if (text.includes("google") || text.includes("pesquisa") || text.includes("search") || text.includes("organic")) return "google";
  if (text.includes("bing") || text.includes("yahoo") || text.includes("duckduckgo")) return "search";
  if (text.includes("facebook") || text === "fb" || text.includes("l facebook")) return "facebook";
  if (text.includes("tiktok")) return "tiktok";
  if (text.includes("direct") || text.includes("direto")) return "direct";
  if (text.includes("platform") || text.includes("qrstack")) return "platform";
  if (text.includes("cliente")) return "cliente";
  if (text.includes("hq") || text.includes("central")) return "hq";
  return "";
}

function getSessionId() {
  const key = "qrstack:session-id";
  try {
    let sessionId = sessionStorage.getItem(key);
    if (!sessionId) {
      sessionId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      sessionStorage.setItem(key, sessionId);
    }
    return sessionId;
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

function getVisitorId() {
  const key = "qrstack:visitor-id";
  try {
    let visitorId = localStorage.getItem(key);
    if (!visitorId) {
      visitorId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(key, visitorId);
    }
    return visitorId;
  } catch {
    return "";
  }
}

function detectDevice() {
  const ua = navigator.userAgent || "";
  const isMobile = /Mobile|Android|iPhone|iPod/i.test(ua);
  const isTablet = /iPad|Tablet/i.test(ua);
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : /Firefox\//.test(ua) ? "Firefox" : "Outro";
  const os = /Android/i.test(ua) ? "Android" : /iPhone|iPad|iPod/i.test(ua) ? "iOS" : /Windows/i.test(ua) ? "Windows" : /Mac OS/i.test(ua) ? "macOS" : /Linux/i.test(ua) ? "Linux" : "Outro";
  return { type: isTablet ? "tablet" : isMobile ? "mobile" : "desktop", browser, os };
}

function getRestaurant(slug) {
  return state.restaurants.find((restaurant) => restaurant.slug === slug) || state.restaurants[0];
}

function getLatestMenu(restaurantId) {
  return state.menuDays
    .filter((menu) => menu.restaurantId === restaurantId)
    .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
}

function getMenuItems(menuDayId) {
  return state.menuItems
    .filter((menuItem) => menuItem.menuDayId === menuDayId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

function getAmaroCatalog() {
  return Array.isArray(window.QRSTACK_AMARO_CATALOG) ? window.QRSTACK_AMARO_CATALOG : [];
}

function getAllCatalogItems() {
  const catalog = [...getAmaroCatalog()];
  const known = new Set(catalog.map((item) => `${item.restaurant_id}-${normalizeKey(item.name)}`));
  state.menuDays.forEach((menu) => {
    getMenuItems(menu.id).forEach((menuItem) => {
      const key = `${menu.restaurantId}-${normalizeKey(menuItem.name)}`;
      if (known.has(key)) return;
      known.add(key);
      catalog.push({
        id: `bank_${menuItem.id}`,
        restaurant_id: menu.restaurantId,
        section_id: normalizeKey(menuItem.category) || "publicados",
        section_title: menuItem.category || "Publicados",
        name: menuItem.name,
        category: menuItem.category,
        description: menuItem.description || "",
        price: menuItem.price || "",
        image_url: "",
        sort_order: menuItem.sortOrder,
        is_active: "TRUE",
      });
    });
  });
  return catalog;
}

function getCatalogForRestaurant(restaurant) {
  return getAllCatalogItems().filter((item) => item.restaurant_id === restaurant.id);
}

function getRestaurantDatabase(restaurant) {
  const dishes = getCatalogForRestaurant(restaurant);
  const dishPhotos = dishes
    .filter((item) => item.image_url)
    .map((item) => ({
      id: `photo_${item.id}`,
      type: "dish",
      label: item.name,
      category: item.section_title || item.category || "Pratos",
      url: catalogImageUrl(item.image_url, restaurant),
      rawUrl: item.image_url,
      dishId: item.id,
    }));
  const logoAssets = [
    restaurant.logoUrl
      ? {
          id: `logo_${restaurant.id}`,
          type: "logo",
          label: `${restaurant.name} - logo`,
          category: "Identidade visual",
          url: restaurant.logoUrl,
          rawUrl: restaurant.logoUrl,
        }
      : null,
    restaurant.symbolUrl && restaurant.symbolUrl !== restaurant.logoUrl
      ? {
          id: `symbol_${restaurant.id}`,
          type: "symbol",
          label: `${restaurant.name} - símbolo`,
          category: "Identidade visual",
          url: restaurant.symbolUrl,
          rawUrl: restaurant.symbolUrl,
        }
      : null,
  ].filter(Boolean);

  return {
    restaurant,
    source: {
      githubRepo: restaurant.githubRepo || "",
      githubPagesUrl: restaurant.githubPagesUrl || "",
      assetsBaseUrl: restaurant.assetsBaseUrl || "",
      manifestUrl: restaurant.manifestUrl || "",
      catalogUrl: restaurant.catalogUrl || "",
      sectionsUrl: restaurant.sectionsUrl || "",
      liveMenuEndpoint: restaurant.liveMenuEndpoint || "",
      isConnected: Boolean(restaurant.githubRepo && restaurant.githubPagesUrl),
    },
    dishes,
    assets: [...logoAssets, ...dishPhotos],
    dishPhotos,
    logoAssets,
  };
}

function getAllRestaurantDatabases() {
  return state.restaurants.map(getRestaurantDatabase);
}

function getAmaroSections() {
  return Array.isArray(window.QRSTACK_AMARO_SECTIONS) ? window.QRSTACK_AMARO_SECTIONS : [];
}

function getAmaroFormFields() {
  return Array.isArray(window.QRSTACK_AMARO_FORM_FIELDS) ? window.QRSTACK_AMARO_FORM_FIELDS : [];
}

function catalogByName() {
  return getAmaroCatalog().reduce((acc, item) => {
    acc[normalizeKey(item.name)] = item;
    return acc;
  }, {});
}

function normalizeMenuDate(value) {
  if (!value) return "";
  const raw = String(value).trim();
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  const brMatch = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})/);
  if (brMatch) {
    const year = brMatch[3].length === 2 ? `20${brMatch[3]}` : brMatch[3];
    return `${year}-${brMatch[2].padStart(2, "0")}-${brMatch[1].padStart(2, "0")}`;
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
}

function formatCurrencyValue(value) {
  const number = Number(String(value || "").replace(/[^\d,.-]/g, "").replace(",", "."));
  if (!Number.isFinite(number) || number <= 0) return "";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(number);
}

async function fetchLiveLunchItems(restaurant) {
  if (!restaurant.liveMenuEndpoint) return [];
  try {
    const response = await fetch(restaurant.liveMenuEndpoint, { cache: "no-store" });
    if (!response.ok) throw new Error("live_lunch_request_failed");
    const data = await response.json();
    const rows = Array.isArray(data) ? data : data?.ok === true && Array.isArray(data.pratos) ? data.pratos : [];
    const catalog = catalogByName();
    return rows
      .filter((row) => row?.prato && normalizeMenuDate(row.data) === todayIso())
      .map((row, index) => {
        const catalogItem = catalog[normalizeKey(row.prato)];
        return {
          id: `live-lunch-${index + 1}`,
          name: row.prato,
          category: "Almoço de Hoje",
          description: row.descricao || catalogItem?.description || "Prato informado pelo formulário atual do Amaro.",
          price: formatCurrencyValue(row.preco) || catalogItem?.price || "",
          image_url: catalogItem?.image_url || "",
          isHighlight: true,
          sortOrder: index + 1,
        };
      });
  } catch (error) {
    console.warn("QrStack live lunch API unavailable:", error.message);
    return [];
  }
}

function normalizeKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function trackEvent(restaurant, eventType, source = "", menuDayId = null) {
  const traffic = buildTrafficPayload(source);
  state.events.push({
    id: crypto.randomUUID(),
    restaurantId: restaurant.id,
    menuDayId,
    eventType,
    source: traffic.source,
    sourceDetail: traffic.source_detail,
    userAgent: navigator.userAgent,
    referrer: traffic.referrer,
    ipHash: "",
    createdAt: new Date().toISOString(),
  });
  saveState();
  sendAnalyticsEvent(restaurant.analyticsEndpoint || restaurant.liveMenuEndpoint || QRSTACK_API_URL, {
    action: "trackEvent",
    slug: restaurant.slug,
    menu_day_id: menuDayId || "",
    event_type: eventType,
    ...traffic,
  }).catch((error) => console.warn("QrStack event API unavailable:", error.message));
}

function renderHome() {
  setSystemTheme();
  const restaurant = getRestaurant(ACTIVE_CLIENT_SLUG);
  const ownerHasSession = hasRememberedAccess(OWNER_SESSION_KEY);
  const clientHasSession = hasRememberedAccess(clientSessionKey(restaurant));
  app.innerHTML = `
    <section class="hero">
      <div class="hero__inner">
        <img class="hero__logo" src="${ASSETS.qrstackWordmark}" alt="QrStack" />
        <p class="eyebrow">Plataforma QrStack</p>
        <h1>Cardápio, Story e Insights em um fluxo só</h1>
        <div class="hero__meta">
          <span class="pill">Central do dono</span>
          <span class="pill">Portal do restaurante</span>
          <span class="pill">Cardápio público</span>
        </div>
        <div class="actions">
          <a class="button" href="${ownerHasSession ? ownerLink("overview") : "#/hq"}">${ownerHasSession ? "Continuar na Central" : "Central QrStack"}</a>
          <a class="button secondary" href="${clientHasSession ? clientPortalLink(restaurant) : `#/cliente/${restaurant.slug}`}">${clientHasSession ? `Continuar ${restaurant.name}` : "Acesso do restaurante"}</a>
          <a class="button ghost" href="${publicMenuHash(restaurant)}">Cardápio público</a>
        </div>
      </div>
    </section>
  `;
}

function renderOwnerGate() {
  setSystemTheme();
  app.innerHTML = `
    <section class="hero">
      <div class="hero__inner">
        <img class="hero__logo" src="${ASSETS.qrstackWordmark}" alt="QrStack" />
        <p class="eyebrow">Acesso interno</p>
        <h1>Central QrStack</h1>
        <p class="muted muted--light">Use o link interno com chave de dono para abrir clientes, respostas, banco de pratos, cardápios e insights.</p>
        <form class="access-form" data-owner-access>
          <label for="owner-access-key">Chave ou link de acesso</label>
          <input id="owner-access-key" name="ownerAccessKey" autocomplete="off" placeholder="Cole sua chave ou o link da Central" />
          <div class="actions">
            <button type="submit">Entrar na Central</button>
            <a class="button ghost" href="#/home">Voltar</a>
          </div>
        </form>
      </div>
    </section>
  `;
}

function renderClientGate(restaurant) {
  setTheme(restaurant);
  app.innerHTML = `
    <section class="hero">
      <div class="hero__inner">
        <img class="hero__logo" src="${restaurant.logoUrl}" alt="${restaurant.name}" />
        <p class="eyebrow">Acesso do restaurante</p>
        <h1>${restaurant.name}</h1>
        <p class="muted muted--light">Este portal abre apenas pelo link privado do restaurante. A Central QrStack não fica disponível por aqui.</p>
        <form class="access-form" data-client-access data-slug="${restaurant.slug}">
          <label for="client-access-token">Token ou link privado</label>
          <input id="client-access-token" name="clientAccessToken" autocomplete="off" placeholder="Cole o token ou link do restaurante" />
          <div class="actions">
            <button type="submit">Abrir formulário</button>
            <a class="button ghost" href="${publicMenuHash(restaurant)}">Ver cardápio público</a>
          </div>
        </form>
      </div>
    </section>
  `;
}

function renderHq(tab = "overview") {
  setSystemTheme();
  const restaurants = state.restaurants;
  app.innerHTML = `
    <div class="admin-layout">
      ${renderAdminHero("Central QrStack", "Sua visão interna dos clientes, formulários, respostas, Stories e insights.", ASSETS.qrstackMark)}
      ${renderTopbar([
        [ownerLink("overview"), "Visão Geral", tab === "overview"],
        [ownerLink("clientes"), "Clientes", tab === "clientes"],
        [ownerLink("respostas"), "Respostas", tab === "respostas"],
        [ownerLink("banco"), "Banco", tab === "banco"],
        [ownerLink("cardapios"), "Cardápios", tab === "cardapios"],
        [ownerLink("stories"), "Stories", tab === "stories"],
        [ownerLink("insights"), "Insights", tab === "insights"],
      ])}
      <main class="page">
        ${tab === "clientes" ? renderHqClients(restaurants) : ""}
        ${tab === "respostas" ? renderHqResponses() : ""}
        ${tab === "banco" ? renderHqCatalogBank() : ""}
        ${tab === "cardapios" ? renderHqPublicMenus() : ""}
        ${tab === "stories" ? renderHqStories() : ""}
        ${tab === "insights" ? renderHqInsights() : ""}
        ${tab === "overview" ? renderHqOverview() : ""}
      </main>
    </div>
  `;
  if (tab === "insights") hydrateInsights(restaurants[0]);
}

function renderAdminHero(title, subtitle, logoUrl) {
  return `
    <header class="admin-hero">
      <div class="admin-hero__inner">
        <div class="admin-title">
          <div>
            <p class="eyebrow">QrStack</p>
            <h2>${title}</h2>
            <p>${subtitle}</p>
          </div>
          <img src="${logoUrl}" alt="" />
        </div>
      </div>
    </header>
  `;
}

function renderTopbar(links, restaurant = null, brandHref = null) {
  const chipHref = brandHref || (restaurant ? publicMenuHash(restaurant) : ownerLink("overview"));
  const chip = restaurant
    ? `<a class="brand-chip" href="${chipHref}"><img src="${restaurant.symbolUrl || restaurant.logoUrl}" alt="" /><span>${restaurant.name}</span></a>`
    : `<a class="brand-chip" href="${chipHref}"><img src="${ASSETS.qrstackMark}" alt="" /><span>QrStack</span></a>`;
  return `
    <nav class="topbar">
      <div class="topbar__inner">
        ${chip}
        ${links
          .map(([href, label, active]) => `<a class="nav-link ${active ? "active" : ""}" href="${href}">${label}</a>`)
          .join("")}
      </div>
    </nav>
  `;
}

function renderHqOverview() {
  const totalRestaurants = state.restaurants.length;
  const todayEvents = state.events.filter((event) => isToday(event.createdAt)).length;
  const stories = state.storyAssets.length;
  const menus = state.menuDays.length;
  const catalogItems = getAllCatalogItems().length;
  return `
    <section class="section">
      <div class="section__head">
        <p class="eyebrow">Operação</p>
        <h2>Painel central dos clientes</h2>
        <p>Aqui ficam seus restaurantes, respostas recebidas, banco de pratos com fotos, links dos cardápios públicos, Stories gerados e insights internos.</p>
      </div>
      <div class="grid grid--three">
        ${metric("Clientes", totalRestaurants)}
        ${metric("Pratos no banco", catalogItems)}
        ${metric("Stories gerados", stories)}
      </div>
      <div class="grid grid--three">
        ${metric("Publicações", menus)}
        ${metric("Acessos hoje", todayEvents)}
        ${metric("Fotos", getAllCatalogItems().filter((item) => item.image_url).length)}
      </div>
      <div class="card">
        <h3>Próxima automação</h3>
        <p class="muted">A estrutura de lembretes já está modelada por cliente. No futuro, a API de WhatsApp usa horário, status ativo/inativo e mensagem padrão para enviar o link do painel.</p>
      </div>
      <div class="card">
        <h3>Como substitui o Google Forms</h3>
        <p class="muted">No Amaro, o cardápio público busca um endpoint do Google Apps Script, filtra as respostas da planilha pela data de hoje e renderiza o almoço automaticamente. Na QrStack, o restaurante preenche este painel, o sistema salva no Supabase e a página pública lê o cardápio publicado pelo slug do cliente. O GitHub fica só para código/deploy, não para atualizar cardápio.</p>
      </div>
      <div class="card">
        <h3>Cardápios publicados</h3>
        <p class="muted">${menus} publicação cadastrada na plataforma.</p>
      </div>
    </section>
  `;
}

function renderHqClients(restaurants) {
  return `
    <section class="section">
      <div class="section__head">
        <p class="eyebrow">Clientes</p>
        <h2>Restaurantes cadastrados</h2>
        <p>Links internos para você copiar, conferir o formulário e abrir o cardápio público de cada cliente.</p>
      </div>
      <div class="grid">
        ${restaurants
          .map(
            (restaurant) => `
              <article class="card">
                <p class="eyebrow">${restaurant.slug}</p>
                <h3>${restaurant.name}</h3>
                <p class="muted">${restaurant.address || "Endereço não informado"}</p>
                <div class="brand-swatch">
                  <span style="background:${restaurant.primaryColor}"></span>
                  <span style="background:${restaurant.secondaryColor}"></span>
                  <img src="${restaurant.logoUrl}" alt="${restaurant.name}" />
                </div>
                <div class="actions">
                  <a class="button" href="${clientPortalLink(restaurant)}">Link do restaurante</a>
                  <button type="button" class="secondary" data-copy="${escapeAttr(restaurantAccessUrl(restaurant))}">Copiar acesso</button>
                  <a class="button secondary" href="${publicMenuHash(restaurant)}">Cardápio público</a>
                </div>
              </article>
            `
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderHqResponses() {
  const rows = state.menuDays
    .slice()
    .sort((a, b) => String(b.updatedAt || b.createdAt || b.date).localeCompare(String(a.updatedAt || a.createdAt || a.date)))
    .map((menu) => {
      const restaurant = state.restaurants.find((rest) => rest.id === menu.restaurantId);
      const itemCount = getMenuItems(menu.id).length;
      return `
        <article class="response-card">
          <div>
            <p class="eyebrow">${restaurant?.name || "Cliente"}</p>
            <h3>${menu.title}</h3>
            <p class="muted">${formatDate(menu.date)} • ${menu.serviceHours || "Horário não informado"} • ${itemCount} itens</p>
          </div>
          <div class="response-card__items">
            ${getMenuItems(menu.id)
              .map((item) => `<span>${item.name}${item.price ? ` • ${item.price}` : ""}</span>`)
              .join("")}
          </div>
          ${menu.notes ? `<p class="muted">${menu.notes}</p>` : ""}
          <div class="actions">
            <a class="button secondary" href="${clientPortalLink(restaurant || getRestaurant(ACTIVE_CLIENT_SLUG))}">Abrir formulário</a>
            <a class="button ghost" href="${publicMenuHash(restaurant || getRestaurant(ACTIVE_CLIENT_SLUG), "hq")}">Ver cardápio</a>
          </div>
        </article>
      `;
    })
    .join("");
  return `
    <section class="section">
      <div class="section__head">
        <p class="eyebrow">Formulários</p>
        <h2>Respostas recebidas</h2>
        <p>Cada envio do cliente aparece aqui com data, itens publicados, preço, observações e acesso direto ao cardápio.</p>
      </div>
      <div class="response-list">${rows || "<p class='muted'>Nenhuma resposta ainda.</p>"}</div>
    </section>
  `;
}

function renderHqStories() {
  const stories = state.storyAssets
    .slice()
    .reverse()
    .map((story) => {
      const restaurant = state.restaurants.find((rest) => rest.id === story.restaurantId);
      return `
        <div class="table-row">
          <span><strong>${restaurant?.name || "Cliente"}</strong><br><span class="muted">${formatDateTime(story.createdAt)}</span></span>
          <span>${story.templateName}</span>
        </div>
      `;
    })
    .join("");
  return `
    <section class="section">
      <div class="section__head">
        <p class="eyebrow">Stories</p>
        <h2>Artes geradas</h2>
        <p>O gerador usa a paleta do restaurante e coloca a logo na arte. O histórico abaixo registra o que cada cliente gerou.</p>
      </div>
      <div class="grid">
        ${state.restaurants
          .map(
            (restaurant) => `
              <article class="card story-brand-card">
                <div class="brand-swatch">
                  <span style="background:${restaurant.primaryColor}"></span>
                  <span style="background:${restaurant.secondaryColor}"></span>
                  <img src="${restaurant.logoUrl}" alt="${restaurant.name}" />
                </div>
                <h3>${restaurant.name}</h3>
                <p class="muted">Story com logo, cor primária, cor secundária e itens publicados no formulário do dia.</p>
                <div class="actions">
                  <a class="button" href="${clientPortalLink(restaurant)}">Gerar Story</a>
                </div>
              </article>
            `
          )
          .join("")}
      </div>
      <div class="card table">${stories || "<p class='muted'>Nenhum Story gerado ainda.</p>"}</div>
    </section>
  `;
}

function renderHqCatalogBank() {
  const databases = getAllRestaurantDatabases();
  const catalog = databases.flatMap((database) => database.dishes);
  const assets = databases.flatMap((database) => database.assets);
  return `
    <section class="section">
      <div class="section__head">
        <p class="eyebrow">Banco QrStack</p>
        <h2>Banco por restaurante</h2>
        <p>Cada cliente tem uma base separada com pratos, preços, fotos, logo e origem do repositório GitHub Pages usado no cardápio.</p>
      </div>
      <div class="grid grid--three">
        ${metric("Pratos", catalog.length)}
        ${metric("Fotos e logos", assets.length)}
        ${metric("Repos conectados", databases.filter((database) => database.source.isConnected).length)}
      </div>
      ${databases
        .map((database) => {
          const { restaurant, source, dishes, assets: restaurantAssets, logoAssets, dishPhotos } = database;
          const groups = groupBy(dishes, "section_title");
          return `
            <div class="section restaurant-database">
              <div class="section__head">
                <p class="eyebrow">${source.isConnected ? "GitHub Pages conectado" : "Banco local"}</p>
                <h3>${restaurant.name}</h3>
              </div>
              <div class="grid grid--three">
                ${databaseSourceCard(database)}
                ${databaseAssetSummaryCard(database)}
                ${databaseLinksCard(database)}
              </div>
              ${restaurantAssets.length ? `
                <div class="section catalog-section">
                  <div class="section__head">
                    <p class="eyebrow">${restaurantAssets.length} arquivos</p>
                    <h3>Fotos usadas e identidade</h3>
                  </div>
                  <div class="asset-grid">
                    ${logoAssets.map((asset) => renderAssetCard(asset, true)).join("")}
                    ${dishPhotos.slice(0, 12).map((asset) => renderAssetCard(asset)).join("")}
                  </div>
                </div>
              ` : ""}
              ${Object.entries(groups)
                .map(
                  ([category, categoryItems]) => `
                    <div class="section catalog-section">
                      <div class="section__head">
                        <p class="eyebrow">${categoryItems.length} itens</p>
                        <h3>${category}</h3>
                      </div>
                      <div class="rail">
                        ${categoryItems.map((item) => renderMenuItemCard(item, true, restaurant)).join("")}
                      </div>
                    </div>
                  `
                )
                .join("")}
            </div>
          `;
        })
        .join("")}
    </section>
  `;
}

function databaseSourceCard(database) {
  const { source } = database;
  return `
    <article class="card source-card">
      <p class="eyebrow">Origem</p>
      <h3>${source.githubRepo || "Sem repositório"}</h3>
      <p class="muted">${source.githubPagesUrl || "Cadastre o repositório GitHub Pages deste cardápio."}</p>
      <div class="actions">
        ${source.githubPagesUrl ? `<a class="button secondary" href="${source.githubPagesUrl}" target="_blank" rel="noreferrer">Abrir Pages</a>` : ""}
        ${source.githubRepo ? `<a class="button ghost" href="https://github.com/${source.githubRepo}" target="_blank" rel="noreferrer">Abrir repo</a>` : ""}
        ${source.manifestUrl ? `<a class="button ghost" href="${source.manifestUrl}" target="_blank" rel="noreferrer">Manifesto</a>` : ""}
        ${source.catalogUrl ? `<a class="button ghost" href="${source.catalogUrl}" target="_blank" rel="noreferrer">Catálogo</a>` : ""}
      </div>
    </article>
  `;
}

function databaseAssetSummaryCard(database) {
  return `
    <article class="card">
      <p class="eyebrow">Arquivos</p>
      <h3>${database.assets.length} assets</h3>
      <p class="muted">${database.logoAssets.length} logo/símbolo • ${database.dishPhotos.length} fotos de pratos</p>
    </article>
  `;
}

function databaseLinksCard(database) {
  const { restaurant } = database;
  return `
    <article class="card">
      <p class="eyebrow">Acessos</p>
      <h3>Links do cliente</h3>
      <p class="muted">${restaurantPublicUrl(restaurant)}</p>
      <div class="actions">
        <a class="button secondary" href="${publicMenuHash(restaurant, "hq")}">Cardápio</a>
        <a class="button ghost" href="${clientPortalLink(restaurant)}">Portal</a>
      </div>
    </article>
  `;
}

function renderAssetCard(asset, featured = false) {
  return `
    <article class="asset-card ${featured ? "asset-card--featured" : ""}">
      <div class="asset-card__media">
        <img src="${asset.url}" alt="${escapeAttr(asset.label)}" loading="lazy" />
      </div>
      <div>
        <p class="eyebrow">${asset.type === "dish" ? asset.category : "Logo"}</p>
        <h3>${asset.label}</h3>
      </div>
    </article>
  `;
}

function renderHqPublicMenus() {
  const menus = state.restaurants
    .map((restaurant) => {
      const menu = getLatestMenu(restaurant.id);
      const itemCount = menu ? getMenuItems(menu.id).length : 0;
      const publicUrl = restaurantPublicUrl(restaurant);
      const qrUrl = restaurantOriginalMenuUrl(restaurant, "qr");
      const instagramUrl = restaurantOriginalMenuUrl(restaurant, "instagram");
      const whatsappUrl = restaurantOriginalMenuUrl(restaurant, "whatsapp");
      const privateUrl = restaurantAccessUrl(restaurant);
      return `
        <article class="card public-menu-card">
          <div class="public-menu-card__brand">
            <img src="${restaurant.logoUrl}" alt="${restaurant.name}" />
            <div>
              <p class="eyebrow">${restaurant.slug}</p>
              <h3>${restaurant.name}</h3>
              <p class="muted">${restaurant.address || "Endereço não informado"}</p>
            </div>
          </div>
          <div class="table">
            <div class="table-row"><span>Última publicação</span><strong>${menu ? formatDate(menu.date) : "Nenhuma"}</strong></div>
            <div class="table-row"><span>Itens do dia</span><strong>${itemCount}</strong></div>
            <div class="table-row"><span>Preço exibido</span><strong>${menu ? priceSummary(menu, getMenuItems(menu.id)) : "Consulte"}</strong></div>
          </div>
          <p class="copy-url">${publicUrl}</p>
          <p class="copy-url">QR: ${qrUrl}</p>
          <p class="copy-url">Instagram: ${instagramUrl}</p>
          <p class="copy-url">WhatsApp: ${whatsappUrl}</p>
          <p class="copy-url">${privateUrl}</p>
              <div class="actions">
            <a class="button" href="${publicMenuHash(restaurant, "hq")}">Abrir cardápio</a>
            <a class="button secondary" href="${clientPortalLink(restaurant)}">Atualizar</a>
            <button type="button" class="secondary" data-copy="${escapeAttr(privateUrl)}">Copiar acesso</button>
            <button type="button" class="ghost" data-copy="${escapeAttr(qrUrl)}">Copiar QR</button>
            <button type="button" class="ghost" data-copy="${escapeAttr(instagramUrl)}">Copiar Instagram</button>
            <button type="button" class="ghost" data-copy="${escapeAttr(whatsappUrl)}">Copiar WhatsApp</button>
          </div>
        </article>
      `;
    })
    .join("");
  return `
    <section class="section">
      <div class="section__head">
        <p class="eyebrow">Cardápios públicos</p>
        <h2>Links que os clientes acessam</h2>
        <p>Aqui você confere o cardápio final de cada restaurante, o link de QR Code e o status da última publicação.</p>
      </div>
      <div class="grid">${menus}</div>
    </section>
  `;
}

function renderHqInsights() {
  const grouped = groupBy(state.events, "source");
  const clicksWhats = state.events.filter((event) => event.eventType === "whatsapp_click").length;
  const clicksMaps = state.events.filter((event) => event.eventType === "maps_click").length;
  const localSourceCounts = Object.fromEntries(Object.entries(grouped).map(([source, events]) => [source, events.length]));
  return `
    <section class="section insights-page">
      <div class="section__head">
        <p class="eyebrow">Insights internos</p>
        <h2>Dashboard de acessos</h2>
        <p>Leitura rápida de tráfego, origem dos acessos, ações importantes e comportamento do cardápio público.</p>
      </div>
      <form class="card insights-filter" data-insights-filter>
        <div>
          <p class="eyebrow">Período</p>
          <h3>Recorte do dashboard</h3>
          <p class="muted">Escolha um período para comparar acessos, origem e ações registradas.</p>
        </div>
        <div class="insights-filter__presets">
          <button type="button" class="secondary" data-insights-preset="today">Hoje</button>
          <button type="button" class="secondary" data-insights-preset="7">7 dias</button>
          <button type="button" class="secondary" data-insights-preset="30">30 dias</button>
          <button type="button" class="secondary" data-insights-preset="all">Todos</button>
        </div>
        <div class="insights-filter__dates">
          <label>
            Início
            <input type="date" name="startDate" />
          </label>
          <label>
            Fim
            <input type="date" name="endDate" />
          </label>
          <button type="submit">Aplicar</button>
        </div>
      </form>
      <div id="insights-live" class="insights-dashboard">
        <article class="card dashboard-hero">
          <div>
            <p class="eyebrow">Carregando</p>
            <h3>Buscando analytics reais</h3>
            <p class="muted">A plataforma está carregando o consolidado salvo na planilha via Apps Script.</p>
          </div>
          <span class="status-pill status-pill--pending">Sincronizando</span>
        </article>
      </div>
      <aside class="local-insights">
        <article class="card">
          <p class="eyebrow">Sessão local</p>
          <h3>Eventos capturados neste navegador</h3>
          <p class="muted">Útil para teste rápido, separado dos analytics reais da planilha.</p>
          <div class="compact-kpis">
            ${insightKpi("Eventos locais", state.events.length)}
            ${insightKpi("WhatsApp", clicksWhats)}
            ${insightKpi("Como chegar", clicksMaps)}
            ${insightKpi("7 dias locais", lastDaysEvents(7).length)}
          </div>
        </article>
        ${renderInsightBars("Origem local", localSourceCounts, { empty: "Sem eventos locais registrados ainda." })}
        <article class="card">
          <p class="eyebrow">Pico local</p>
          <h3>Horário de pico</h3>
          <p class="muted">${peakHour()}</p>
        </article>
      </aside>
    </section>
  `;
}

async function renderClientPortal(slug, version) {
  const remote = await syncMenuFromApi(slug);
  if (!isCurrentRoute(version)) return;
  const currentHash = window.location.hash.replace(/^#\/?/, "");
  if (!currentHash.startsWith(`cliente/${slug}`) && !currentHash.startsWith(`admin/${slug}`)) return;
  const restaurant = remote.restaurant || (await syncRestaurantFromApi(slug));
  const menu = remote.menu || createBlankMenu(restaurant.id);
  const menuItems = remote.items.length ? remote.items : getMenuItems(menu.id);
  const storyLink = menu.storyLink || restaurantStoryLink(restaurant);
  setTheme(restaurant);
  app.innerHTML = `
    <div class="client-form-shell">
      <header class="client-form-header">
        <img src="${restaurant.logoUrl}" alt="${restaurant.name}" />
        <div>
          <p class="eyebrow">QrStack</p>
          <h1>${restaurant.name}</h1>
          <p>Atualize o cardápio do dia e gere o Story.</p>
        </div>
      </header>
      ${renderTopbar([
        ["#formulario", "Formulário", true],
        ["#story-panel", "Story", false],
        [publicMenuHash(restaurant, "cliente"), "Cardápio público", false],
      ], restaurant, clientPortalLink(restaurant))}
      <main class="client-form-page">
        <section class="section client-step" id="formulario">
          <div class="section__head">
            <p class="eyebrow">Formulário</p>
            <h2>Cardápio de hoje</h2>
          </div>
          <form id="menu-form" class="card form-grid client-menu-form">
            <input type="hidden" name="menuId" value="${menu.id}" />
            <input type="hidden" name="title" value="${escapeAttr(menu.title || "Cardápio de hoje")}" />
            <input type="hidden" name="date" value="${escapeAttr(todayIso())}" />
            <input type="hidden" name="price" value="${escapeAttr(menu.price || "")}" />
            <input type="hidden" name="serviceHours" value="${escapeAttr(menu.serviceHours || "")}" />
            ${restaurant.slug === "amaro" ? renderAmaroOriginalForm(menuItems) : renderGenericItemsTextarea(menuItems)}
            <div class="field field--full">
              <label for="notes">Observações</label>
              <textarea id="notes" name="notes" placeholder="Observações do dia">${menu.notes || ""}</textarea>
            </div>
            <div class="actions field--full">
              <button type="submit">Enviar e gerar Story</button>
            </div>
          </form>
        </section>

        <section class="section client-step" id="story-panel">
          <div class="section__head">
            <p class="eyebrow">Story</p>
            <h2>Arte pronta</h2>
          </div>
          <div class="story-workbench">
            <div class="card">
              <h3>Link do Story</h3>
              <div class="field">
                <label for="storyLink">Hyperlink</label>
                <input id="storyLink" name="storyLink" type="url" value="${escapeAttr(storyLink)}" placeholder="Cole o link do cardápio" />
              </div>
              <div class="actions">
                <button type="button" id="download-story">Baixar Story</button>
                <button type="button" class="secondary" id="share-story">Compartilhar Story</button>
                <button type="button" class="ghost" data-copy-input="storyLink">Copiar link do Story</button>
              </div>
            </div>
            <div class="story-frame">
              <canvas id="story-canvas" width="1080" height="1920"></canvas>
            </div>
          </div>
        </section>
      </main>
    </div>
  `;
  attachClientHandlers(restaurant, menu);
  drawStory(restaurant, menu, getMenuItems(menu.id));
}

function createBlankMenu(restaurantId) {
  const menu = {
    id: crypto.randomUUID(),
    restaurantId,
    date: todayIso(),
    title: "Buffet de hoje",
    price: "",
    serviceHours: "",
    storyLink: "",
    notes: "",
    isPublished: false,
    publishedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  state.menuDays.push(menu);
  saveState();
  return menu;
}

function field(label, name, value, placeholder = "", type = "text") {
  return `
    <div class="field">
      <label for="${name}">${label}</label>
      <input id="${name}" name="${name}" type="${type}" value="${escapeAttr(value || "")}" placeholder="${placeholder}" />
    </div>
  `;
}

function renderGenericItemsTextarea(menuItems) {
  return `
    <div class="field field--full">
      <label for="items">Itens do cardápio</label>
      <textarea id="items" name="items" placeholder="Categoria: Item | Preço">${menuItems
        .map((menuItem) => `${menuItem.category}: ${menuItem.name}${menuItem.price ? ` | ${menuItem.price}` : ""}${menuItem.isHighlight ? "*" : ""}`)
        .join("\n")}</textarea>
    </div>
  `;
}

function renderAmaroOriginalForm(menuItems) {
  const fields = getAmaroFormFields().filter((field) => field.title.toLowerCase().startsWith("prato"));
  const selectedNames = menuItems.map((menuItem) => menuItem.name);
  return `
    <div class="field field--full">
      <label>Formulário original Amaro</label>
      <div class="select-grid">
        ${fields
          .map((field, index) => {
            const selectedName = selectedNames[index] || "";
            return `
              <div class="field">
                <label for="amaro-prato-${index + 1}">${field.title.replace(":", "")}</label>
                <select id="amaro-prato-${index + 1}" name="prato_${index + 1}" required>
                  <option value="">Selecione</option>
                  ${(field.options || [])
                    .map(
                      (option) =>
                        `<option value="${escapeAttr(option)}" ${option === selectedName ? "selected" : ""}>${option}</option>`
                    )
                    .join("")}
                </select>
              </div>
            `;
          })
          .join("")}
      </div>
    </div>
  `;
}

function attachClientHandlers(restaurant, menu) {
  document.getElementById("menu-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const storyLinkInput = document.querySelector('[name="storyLink"]');
    formData.set("storyLink", storyLinkInput?.value || restaurantStoryLink(restaurant));
    await saveMenuForm(restaurant, menu.id, formData);
    const updatedMenu = getLatestMenu(restaurant.id);
    drawStory(restaurant, updatedMenu, getMenuItems(updatedMenu.id));
    saveStoryPreview(restaurant, updatedMenu);
    toast("Enviado. Story pronto abaixo.");
    document.getElementById("story-panel").scrollIntoView({ behavior: "smooth" });
  });

  document.querySelector('[name="storyLink"]').addEventListener("input", (event) => {
    const latestMenu = getLatestMenu(restaurant.id);
    latestMenu.storyLink = event.currentTarget.value.trim();
    saveState();
    drawStory(restaurant, latestMenu, getMenuItems(latestMenu.id));
  });

  document.getElementById("download-story").addEventListener("click", () => {
    downloadStory(restaurant);
    const latestMenu = getLatestMenu(restaurant.id);
    trackEvent(restaurant, "story_downloaded", "admin", latestMenu.id);
  });

  document.getElementById("share-story").addEventListener("click", async () => {
    const latestMenu = getLatestMenu(restaurant.id);
    await shareStory(restaurant, latestMenu);
    trackEvent(restaurant, "story_shared", "admin", latestMenu.id);
  });
}

function saveStoryPreview(restaurant, menu) {
  state.storyAssets.push({
    id: crypto.randomUUID(),
    restaurantId: restaurant.id,
    menuDayId: menu.id,
    imageUrl: "local-canvas-preview",
    templateName: "daily-menu-v1",
    createdAt: new Date().toISOString(),
  });
  apiPost({
    action: "saveStoryAsset",
    slug: restaurant.slug,
    token: restaurant.adminToken || ACTIVE_CLIENT_TOKEN,
    menu_day_id: menu.id,
    image_url: "local-canvas-preview",
    template_name: "daily-menu-v1",
  }).catch((error) => console.warn("QrStack story API unavailable:", error.message));
  trackEvent(restaurant, "story_generated", "admin", menu.id);
  saveState();
}

async function saveMenuForm(restaurant, menuId, formData) {
  const menu = state.menuDays.find((entry) => entry.id === menuId);
  menu.title = formData.get("title").toString().trim();
  menu.date = formData.get("date").toString();
  menu.price = formData.get("price").toString().trim();
  menu.serviceHours = formData.get("serviceHours").toString().trim();
  menu.storyLink = formData.get("storyLink").toString().trim();
  menu.notes = formData.get("notes").toString().trim();
  menu.isPublished = true;
  menu.publishedAt = new Date().toISOString();
  menu.updatedAt = new Date().toISOString();

  state.menuItems = state.menuItems.filter((menuItem) => menuItem.menuDayId !== menuId);
  const selectedRows =
    restaurant.slug === "amaro" ? selectedAmaroRows(formData) : selectedGenericRows(formData);
  selectedRows.forEach((parsed, index) => {
    state.menuItems.push(item(menuId, parsed.name, parsed.category, parsed.isHighlight, index + 1, parsed.description, parsed.price));
  });
  trackEvent(restaurant, "menu_published", "admin", menuId);
  saveState();

  try {
    await apiPost({
      action: "saveMenuDay",
      slug: restaurant.slug,
      token: restaurant.adminToken || ACTIVE_CLIENT_TOKEN,
      date: menu.date,
      title: menu.title,
      price: menu.price,
      service_hours: menu.serviceHours,
      story_link: menu.storyLink,
      notes: menu.notes,
      items: state.menuItems
        .filter((menuItem) => menuItem.menuDayId === menuId)
        .map((menuItem) => ({
          name: menuItem.name,
          category: menuItem.category,
          description: menuItem.description,
          is_highlight: menuItem.isHighlight,
          sort_order: menuItem.sortOrder,
          price: menuItem.price,
        })),
    });
  } catch (error) {
    console.warn("QrStack save API unavailable:", error.message);
  }
}

function selectedGenericRows(formData) {
  return formData
    .get("items")
    .toString()
    .split("\n")
    .map((row) => row.trim())
    .filter(Boolean)
    .map(parseMenuItemLine);
}

function selectedAmaroRows(formData) {
  const catalog = catalogByName();
  return Array.from({ length: 7 }, (_, index) => formData.get(`prato_${index + 1}`)?.toString().trim())
    .filter(Boolean)
    .map((name, index) => {
      const catalogItem = catalog[normalizeKey(name)];
      return {
        name,
        category: catalogItem?.category || catalogItem?.section_title || "Executivo",
        description: catalogItem?.description || "",
        price: catalogItem?.price || "",
        isHighlight: true,
        sortOrder: index + 1,
      };
    });
}

function parseMenuItemLine(row, index) {
  const isHighlight = row.endsWith("*") || index < 6;
  const clean = row.replace(/\*$/, "").trim();
  const [itemPart, ...priceParts] = clean.split("|");
  const price = priceParts.join("|").trim();
  const [maybeCategory, ...rest] = itemPart.split(":");
  const hasCategory = rest.length > 0;
  return {
    category: hasCategory ? maybeCategory.trim() : "Destaques",
    name: hasCategory ? rest.join(":").trim() : itemPart.trim(),
    price,
    isHighlight,
  };
}

function renderMenuItemCard(menuItem, showImage = false, restaurant = null) {
  return `
    <article class="item-card">
      ${showImage && menuItem.image_url ? `<div class="item-card__media"><img src="${catalogImageUrl(menuItem.image_url, restaurant)}" alt="${escapeAttr(menuItem.name)}" loading="lazy" /></div>` : ""}
      <div class="item-card__top">
        <h3>${menuItem.name}</h3>
        ${menuItem.price ? `<span class="price">${menuItem.price}</span>` : menuItem.isHighlight ? '<span class="tag">Destaque</span>' : ""}
      </div>
      ${menuItem.price && menuItem.isHighlight ? '<span class="tag">Destaque</span>' : ""}
      ${menuItem.description ? `<p class="muted">${menuItem.description}</p>` : ""}
    </article>
  `;
}

function renderDailyMenuGroups(groups) {
  return Object.entries(groups)
    .map(
      ([category, items]) => `
        <div class="section">
          <div class="section__head">
            <p class="eyebrow">Categoria</p>
            <h3>${category}</h3>
          </div>
          <div class="rail">
            ${items.map((menuItem) => renderMenuItemCard(menuItem)).join("")}
          </div>
        </div>
      `
    )
    .join("");
}

function renderCatalogSectionsHtml(restaurant) {
  const catalog = getCatalogForRestaurant(restaurant);
  if (!catalog.length) return "";
  const bySection = groupBy(catalog, "section_id");
  const sections = restaurant.slug === "amaro" && getAmaroSections().length
    ? getAmaroSections()
    : Object.keys(bySection).map((sectionId) => ({ id: sectionId, title: bySection[sectionId][0]?.section_title || sectionId }));
  return sections
    .map((section) => {
      const items = bySection[section.id] || [];
      if (!items.length) return "";
      return `
        <div class="section catalog-section">
          <div class="section__head">
            <p class="eyebrow">${items.length} itens</p>
            <h3>${section.title}</h3>
          </div>
          <div class="rail">
            ${items.map((menuItem) => renderMenuItemCard(menuItem, true, restaurant)).join("")}
          </div>
        </div>
      `;
    })
    .join("");
}

function renderFullCatalog(restaurant) {
  const catalog = getCatalogForRestaurant(restaurant);
  if (!catalog.length) return "";
  return `
    <section id="catalogo" class="section">
      <div class="section__head">
        <p class="eyebrow">Cardápio completo</p>
        <h2>Catálogo ${restaurant.name}</h2>
        <p>Itens fixos importados do cardápio publicado, separados pelas categorias originais.</p>
      </div>
      ${renderCatalogSectionsHtml(restaurant)}
    </section>
  `;
}

async function hydrateInsights(restaurant) {
  const target = document.getElementById("insights-live");
  if (!target || !restaurant) return;
  try {
    const endpoint = restaurant.analyticsEndpoint || restaurant.liveMenuEndpoint || QRSTACK_API_URL;
    const filters = getInsightsFilters();
    const data = await endpointGet(endpoint, "getInsights", {
      slug: restaurant.slug,
      key: OWNER_ACCESS_TOKEN,
      startDate: filters.startDate,
      endDate: filters.endDate,
    });
    const insights = data.insights || {};
    const sourceCounts = normalizeCountKeys(insights.source_counts || {}, normalizeSource);
    const eventTypeCounts = insights.event_type_counts || {};
    const totalAccesses = insights.total_accesses ?? insights.total_page_views ?? insights.event_type_counts_all?.page_view;
    const periodAccesses = insights.period_accesses ?? insights.filtered_accesses ?? eventTypeCounts.page_view ?? 0;
    const periodEvents = insights.period_events ?? insights.filtered_events ?? insights.total_events ?? 0;
    const totalEvents = insights.total_events ?? periodEvents;
    const periodLabel = insights.period_label || formatInsightsPeriod(filters);
    const accessesToday = insights.accesses_today || 0;
    const accesses7Days = insights.accesses_7_days || 0;
    const uniqueSessions = insights.unique_sessions_period ?? insights.unique_sessions ?? 0;
    const uniqueSessionsTotal = insights.unique_sessions_total ?? 0;
    const whatsappClicks = eventTypeCounts.whatsapp_click || eventTypeCounts.whatsapp || 0;
    const mapsClicks = eventTypeCounts.maps_click || eventTypeCounts.maps || 0;
    const conversionBase = Number(periodAccesses) || 0;
    const whatsappRate = conversionBase ? `${Math.round((Number(whatsappClicks) / conversionBase) * 100)}%` : "0%";
    const mapsRate = conversionBase ? `${Math.round((Number(mapsClicks) / conversionBase) * 100)}%` : "0%";
    const peak = insights.peak_hour || "Sem dados suficientes no período.";
    const dailyAccesses = insights.daily_accesses || {};
    const hourCounts = insights.hour_counts || {};
    const deviceCounts = normalizeCountKeys(insights.device_counts || {}, (value) => String(value || "desconhecido").toLowerCase());
    const recentEvents = insights.recent_events || [];
    const testEvents = Number(insights.test_events || 0);
    const collectedAt = insights.collected_at ? formatDateTime(insights.collected_at) : "Agora";
    const topSource = sortedCountEntries(sourceCounts)[0];
    target.innerHTML = `
      <article class="card dashboard-hero">
        <div>
          <p class="eyebrow">Analytics reais</p>
          <h3>${restaurant.name} · ${periodLabel}</h3>
          <p class="muted">Dados carregados da aba <strong>qrstack_events</strong> na planilha real. A leitura abaixo separa origem, volume, visitantes únicos, dispositivos e ações de intenção.</p>
        </div>
        <div class="dashboard-hero__status">
          <span class="status-pill">Coleta ativa</span>
          <small>Atualizado: ${collectedAt}</small>
          ${testEvents ? `<small>${formatNumber(testEvents)} evento(s) de teste filtrado(s)</small>` : ""}
        </div>
      </article>
      <div class="dashboard-kpis">
        ${insightKpi("Acessos no período", periodAccesses, "page views filtrados")}
        ${insightKpi("Visitantes únicos", uniqueSessions, uniqueSessionsTotal ? `${formatNumber(uniqueSessionsTotal)} no histórico` : "por sessão")}
        ${insightKpi("Acessos hoje", accessesToday, "dia atual")}
        ${insightKpi("Últimos 7 dias", accesses7Days, "tendência recente")}
        ${insightKpi("WhatsApp", whatsappClicks, `${whatsappRate} dos acessos`)}
        ${insightKpi("Como chegar", mapsClicks, `${mapsRate} dos acessos`)}
      </div>
      <article class="card channel-board">
        <div>
          <p class="eyebrow">Canais</p>
          <h3>De onde o cliente está chegando</h3>
          <p class="muted">${topSource ? `${formatSourceLabel(topSource[0])} é a origem principal neste recorte.` : "Ainda sem origem dominante no período."}</p>
        </div>
        ${renderChannelCards(sourceCounts, periodAccesses)}
      </article>
      <div class="dashboard-grid">
        ${renderInsightBars("Origem dos acessos", sourceCounts, { empty: "Sem origem registrada neste período.", labeler: formatSourceLabel })}
        ${renderInsightBars("Eventos do período", eventTypeCounts, { empty: "Sem eventos registrados neste período.", labeler: formatEventLabel })}
        ${renderInsightBars("Dispositivos", deviceCounts, { empty: "Sem dispositivo registrado neste período.", labeler: formatDeviceLabel })}
        ${renderInsightBars("Acessos por horário", hourCounts, { empty: "Sem horário suficiente neste período.", labeler: formatHourLabel })}
        ${renderInsightBars("Acessos por dia", dailyAccesses, { empty: "Sem série diária neste período.", labeler: formatDateShort })}
        ${renderConversionFunnel(periodAccesses, whatsappClicks, mapsClicks)}
        <article class="card insight-card">
          <p class="eyebrow">Comportamento</p>
          <h3>Resumo operacional</h3>
          <div class="table">
            <div class="table-row"><span>Eventos no período</span><strong>${periodEvents}</strong></div>
            <div class="table-row"><span>Eventos totais</span><strong>${totalEvents}</strong></div>
            ${totalAccesses !== undefined ? `<div class="table-row"><span>Acessos totais</span><strong>${formatNumber(totalAccesses)}</strong></div>` : ""}
            <div class="table-row"><span>Horário de pico</span><strong>${peak}</strong></div>
          </div>
        </article>
        <article class="card insight-card">
          <p class="eyebrow">Leitura rápida</p>
          <h3>O que observar</h3>
          <p class="muted">${insightSummary(periodAccesses, sourceCounts, whatsappClicks, mapsClicks)}</p>
        </article>
      </div>
      <article class="card insight-table-card">
        <p class="eyebrow">Detalhamento</p>
        <h3>Origem e volume</h3>
        ${renderInsightTable(sourceCounts, formatSourceLabel, "Nenhuma origem registrada no período.")}
      </article>
      <article class="card insight-table-card">
        <p class="eyebrow">Eventos recentes</p>
        <h3>Últimas movimentações</h3>
        ${renderRecentEvents(recentEvents)}
      </article>
    `;
  } catch (error) {
    target.innerHTML = `
      <article class="card dashboard-hero dashboard-hero--warning">
        <p class="eyebrow">Analytics reais</p>
        <h3>Analytics do ${restaurant.name} ainda não ativo</h3>
        <p class="muted">A tela não vai inventar número. O endpoint real do ${restaurant.name} ainda não retornou JSON de insights. Publique o Apps Script da planilha original com suporte a <strong>getInsights</strong> e <strong>doPost</strong>.</p>
      </article>
      <div class="dashboard-kpis">
        ${insightKpi("Eventos locais", state.events.length, "capturados neste navegador")}
        ${insightKpi("Últimos 7 dias", lastDaysEvents(7).length, "sessão local")}
      </div>
    `;
  }
}

function getInsightsFilters() {
  const form = document.querySelector("[data-insights-filter]");
  if (!form) return { startDate: "", endDate: "" };
  const formData = new FormData(form);
  return {
    startDate: String(formData.get("startDate") || "").slice(0, 10),
    endDate: String(formData.get("endDate") || "").slice(0, 10),
  };
}

function setInsightsPreset(preset) {
  const form = document.querySelector("[data-insights-filter]");
  if (!form) return;
  const startInput = form.querySelector('[name="startDate"]');
  const endInput = form.querySelector('[name="endDate"]');
  const today = todayIso();
  if (preset === "all") {
    startInput.value = "";
    endInput.value = "";
  } else if (preset === "today") {
    startInput.value = today;
    endInput.value = today;
  } else {
    startInput.value = dateDaysAgo(Number(preset) - 1);
    endInput.value = today;
  }
}

function dateDaysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function formatInsightsPeriod(filters) {
  if (!filters.startDate && !filters.endDate) return "Todos os tempos";
  if (filters.startDate && filters.endDate && filters.startDate === filters.endDate) return formatDate(filters.startDate);
  const start = filters.startDate ? formatDate(filters.startDate) : "início";
  const end = filters.endDate ? formatDate(filters.endDate) : "hoje";
  return `${start} até ${end}`;
}

function catalogImageUrl(imageUrl, restaurant = null) {
  if (!imageUrl) return "";
  if (/^(https?:|data:|assets\/)/.test(imageUrl)) return imageUrl;
  if (restaurant?.assetsBaseUrl) {
    try {
      return new URL(imageUrl, restaurant.assetsBaseUrl).toString();
    } catch {
      return `${restaurant.assetsBaseUrl.replace(/\/$/, "")}/${imageUrl.replace(/^\//, "")}`;
    }
  }
  return `assets/amaro/${imageUrl}`;
}

async function renderPublicMenu(slug, source = "direct", version = routeVersion) {
  const localRestaurant = getRestaurant(slug);
  if (localRestaurant?.slug === "amaro") {
    if (!window.location.hash.replace(/^#\/?/, "").startsWith(`r/${slug}`)) return;
    setTheme(localRestaurant);
    trackEvent(localRestaurant, "page_view", source, getLatestMenu(localRestaurant.id)?.id);
    app.innerHTML = renderOriginalPublicMenu(localRestaurant, source);
    return;
  }
  const remote = await syncMenuFromApi(slug);
  if (!isCurrentRoute(version)) return;
  if (!window.location.hash.replace(/^#\/?/, "").startsWith(`r/${slug}`)) return;
  const restaurant = remote.restaurant;
  const menu = remote.menu;
  const menuItems = remote.items;
  const groups = groupBy(menuItems, "category");
  const useCanonicalCatalog = restaurant.slug === "amaro";
  setTheme(restaurant);
  trackEvent(restaurant, "page_view", source, menu?.id);
  if (useCanonicalCatalog) {
    app.innerHTML = renderOriginalPublicMenu(restaurant, source);
    return;
  }
  const liveLunchItems = [];
  app.innerHTML = `
    <section class="hero">
      <div class="hero__inner">
        <img class="hero__logo" src="${restaurant.logoUrl}" alt="${restaurant.name}" />
        <p class="eyebrow">Cardápio digital</p>
        <h1>${restaurant.name}</h1>
        <div class="hero__meta">
          <span class="pill">${restaurant.address || ""}</span>
          <span class="pill">${menu?.serviceHours || "Horário do dia"}</span>
        </div>
      </div>
    </section>
    ${renderTopbar([
      ...(liveLunchItems.length ? [["#almoco-hoje", "Almoço", true]] : []),
      ["#menu", "Cardápio", !liveLunchItems.length],
      ...(useCanonicalCatalog ? [] : [["#catalogo", "Completo", false]]),
      ["#contato", "Contato", false],
    ], restaurant)}
    <main class="page">
      ${useCanonicalCatalog ? `
        ${liveLunchItems.length ? `
          <section id="almoco-hoje" class="section">
            <div class="section__head">
              <p class="eyebrow">Atualizado pelo Google Forms</p>
              <h2>Almoço de Hoje</h2>
              <p>Itens puxados do mesmo endpoint usado pelo cardápio real do Amaro.</p>
            </div>
            <div class="rail">
              ${liveLunchItems.map((menuItem) => renderMenuItemCard(menuItem, Boolean(menuItem.image_url), restaurant)).join("")}
            </div>
          </section>
        ` : ""}
        <section id="menu" class="section">
          <div class="section__head">
            <p class="eyebrow">Cardápio verdadeiro</p>
            <h2>Cardápio ${restaurant.name}</h2>
            <p>Catálogo importado do repositório real do Amaro, com fotos, preços e categorias do cardápio publicado.</p>
          </div>
          ${renderCatalogSectionsHtml(restaurant)}
        </section>
      ` : `
        <section id="menu" class="section">
          <div class="section__head">
            <p class="eyebrow">${menu ? formatDate(menu.date) : "Hoje"}</p>
            <h2>${menu?.title || "Cardápio do dia"}</h2>
            <p>${menu?.notes || "Itens publicados pelo restaurante."}</p>
          </div>
          <div class="grid grid--three">
            ${metric("Preço", priceSummary(menu, menuItems))}
            ${metric("Categorias", Object.keys(groups).length)}
            ${metric("Destaques", menuItems.filter((entry) => entry.isHighlight).length)}
          </div>
          ${renderDailyMenuGroups(groups)}
        </section>
        ${renderFullCatalog(restaurant)}
      `}
      <section id="contato" class="section">
        <div class="section__head">
          <p class="eyebrow">Contato</p>
          <h2>Fale com o restaurante</h2>
        </div>
        <div class="actions">
          <a class="button" data-track="whatsapp_click" href="https://wa.me/55${restaurant.whatsappNumber}" target="_blank" rel="noreferrer">WhatsApp</a>
          <a class="button secondary" data-track="maps_click" href="${restaurant.mapsUrl}" target="_blank" rel="noreferrer">Como chegar</a>
          <a class="button ghost" data-track="instagram_click" href="${restaurant.instagramUrl}" target="_blank" rel="noreferrer">Instagram</a>
        </div>
      </section>
    </main>
  `;
  document.querySelectorAll("[data-track]").forEach((link) => {
    link.addEventListener("click", () => trackEvent(restaurant, link.dataset.track, source, menu?.id));
  });
}

function renderOriginalPublicMenu(restaurant, source) {
  const originalUrl = restaurantOriginalMenuUrl(restaurant, source);
  const showReturnBar = source === "hq" || source === "cliente";
  return `
    <div class="original-menu-shell">
      ${showReturnBar ? `
        <nav class="topbar">
          <div class="topbar__inner">
            <span class="brand-chip"><img src="${restaurant.logoUrl}" alt="" /><span>${restaurant.name}</span></span>
            <button type="button" class="nav-link" data-history-back>Voltar</button>
            <a class="nav-link active" href="${restaurantOriginalMenuUrl(restaurant, source)}" target="_blank" rel="noreferrer">Abrir original</a>
          </div>
        </nav>
      ` : ""}
      <iframe
        class="original-menu-frame"
        title="Cardápio original ${restaurant.name}"
        src="${originalUrl}"
        loading="eager"
      ></iframe>
    </div>
  `;
}

function drawStory(restaurant, menu, menuItems) {
  const canvas = document.getElementById("story-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  const highlights = menuItems.filter((menuItem) => menuItem.isHighlight).slice(0, 6);
  const storyLink = menu.storyLink || restaurantStoryLink(restaurant);
  const storyLinkLabel = formatStoryLink(storyLink);
  Promise.all([loadCanvasImage(restaurant.logoUrl), loadCanvasImage(restaurant.symbolUrl)]).then(([logo, mark]) => {
    const primary = restaurant.primaryColor || "#0b3422";
    const secondary = restaurant.secondaryColor || "#bd8732";
    const cream = restaurant.slug === "amaro" ? "#f5f0e6" : "rgba(255,255,255,0.9)";
    const ink = colorMix(primary, "#000000", 0.18);
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, colorMix(primary, "#000000", 0.18));
    gradient.addColorStop(0.52, primary);
    gradient.addColorStop(1, colorMix(secondary, "#000000", 0.16));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    ctx.globalAlpha = 0.08;
    if (mark) {
      for (let y = -80; y < h; y += 310) {
        for (let x = -60; x < w; x += 330) {
          ctx.drawImage(mark, x, y, 170, 170);
        }
      }
    }
    ctx.globalAlpha = 1;

    ctx.fillStyle = cream;
    roundRect(ctx, 84, 110, w - 168, h - 220, 28);
    ctx.fill();

    if (logo) {
      drawImageContain(ctx, logo, 250, 172, w - 500, 220);
    } else if (mark) {
      drawImageContain(ctx, mark, w / 2 - 110, 180, 220, 220);
    }
    ctx.textAlign = "center";
    ctx.fillStyle = secondary;
    ctx.font = "800 42px Manrope";
    ctx.fillText("CARDÁPIO DO DIA", w / 2, 495);

    ctx.fillStyle = primary;
    ctx.font = "800 94px Sora";
    wrapCanvasText(ctx, menu.title || "Buffet de hoje", w / 2, 630, w - 220, 104, 2);

    ctx.fillStyle = colorMix(primary, secondary, 0.45);
    ctx.font = "700 38px Manrope";
    ctx.fillText(formatDate(menu.date), w / 2, 820);

    ctx.textAlign = "left";
    let y = 940;
    highlights.forEach((entry) => {
      ctx.fillStyle = secondary;
      ctx.font = "800 44px Manrope";
      ctx.fillText("•", 178, y);
      ctx.fillStyle = ink;
      ctx.font = "800 44px Manrope";
      wrapCanvasText(ctx, entry.name, 222, y, w - 350, 52, 1);
      y += 92;
    });

    ctx.textAlign = "center";
    ctx.fillStyle = primary;
    roundRect(ctx, 210, 1430, w - 420, 118, 22);
    ctx.fill();
    ctx.fillStyle = "white";
    ctx.font = "900 48px Manrope";
    ctx.fillText(priceSummary(menu, menuItems), w / 2, 1504);

    ctx.fillStyle = colorMix(primary, secondary, 0.4);
    ctx.font = "700 34px Manrope";
    ctx.fillText(menu.serviceHours || "Confira o horário no cardápio", w / 2, 1618);
    ctx.fillStyle = primary;
    ctx.font = "900 38px Manrope";
    ctx.fillText("TOQUE NO LINK DO STORY", w / 2, 1718);
    ctx.fillStyle = ink;
    ctx.font = "700 28px Manrope";
    wrapCanvasText(ctx, storyLinkLabel, w / 2, 1772, w - 220, 34, 2);
    lastStoryDataUrl = canvas.toDataURL("image/png");
  });
}

function formatStoryLink(value) {
  try {
    const url = new URL(value);
    return `${url.hostname}${url.pathname}${url.hash || ""}`.replace(/\/index\.html/, "");
  } catch {
    return String(value || "");
  }
}

function loadCanvasImage(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

function drawImageContain(ctx, image, x, y, width, height) {
  const ratio = Math.min(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * ratio;
  const drawHeight = image.naturalHeight * ratio;
  ctx.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
}

function colorMix(hexA, hexB, weightB = 0.5) {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  if (!a || !b) return hexA;
  const weightA = 1 - weightB;
  const mixed = {
    r: Math.round(a.r * weightA + b.r * weightB),
    g: Math.round(a.g * weightA + b.g * weightB),
    b: Math.round(a.b * weightA + b.b * weightB),
  };
  return `rgb(${mixed.r}, ${mixed.g}, ${mixed.b})`;
}

function hexToRgb(hex) {
  const clean = String(hex || "").replace("#", "").trim();
  if (!/^[0-9a-f]{6}$/i.test(clean)) return null;
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

function downloadStory(restaurant) {
  const link = document.createElement("a");
  link.href = lastStoryDataUrl || document.getElementById("story-canvas").toDataURL("image/png");
  link.download = `story-${restaurant.slug}-${todayIso()}.png`;
  link.click();
}

function priceSummary(menu, menuItems = []) {
  if (menu?.price) return menu.price;
  const prices = menuItems
    .map((entry) => Number(String(entry.price || "").replace(/[^\d,.-]/g, "").replace(",", ".")))
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);
  if (!prices.length) return "Consulte";
  const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  if (prices[0] === prices[prices.length - 1]) return brl.format(prices[0]);
  return `${brl.format(prices[0])} a ${brl.format(prices[prices.length - 1])}`;
}

async function shareStory(restaurant, menu = null) {
  const storyLink = menu?.storyLink || document.querySelector('[name="storyLink"]')?.value || restaurantStoryLink(restaurant);
  await copyToClipboard(storyLink);
  toast("Link copiado. Cole no sticker do Instagram.");
  const canvas = document.getElementById("story-canvas");
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  const file = new File([blob], `story-${restaurant.slug}.png`, { type: "image/png" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: `Story ${restaurant.name}`,
        text: `Story do cardápio do dia pronto para publicar. Link: ${storyLink}`,
      });
    } catch {
      downloadStory(restaurant);
    }
    window.location.href = "instagram://story-camera";
    return;
  }
  downloadStory(restaurant);
  toast("Link copiado. Cole no sticker de link do Instagram.");
  setTimeout(() => {
    window.location.href = "instagram://story-camera";
  }, 400);
  setTimeout(() => {
    window.location.href = "https://www.instagram.com/";
  }, 900);
}

function metric(label, value) {
  return `
    <article class="card metric">
      <span class="eyebrow">${label}</span>
      <strong>${value}</strong>
    </article>
  `;
}

function insightKpi(label, value, detail = "") {
  return `
    <article class="card insight-kpi">
      <span class="eyebrow">${label}</span>
      <strong>${formatNumber(value)}</strong>
      ${detail ? `<small>${detail}</small>` : ""}
    </article>
  `;
}

function renderInsightBars(title, counts, options = {}) {
  const entries = sortedCountEntries(counts);
  const max = Math.max(...entries.map(([, count]) => Number(count) || 0), 1);
  const labeler = options.labeler || ((value) => value);
  return `
    <article class="card insight-chart">
      <p class="eyebrow">Distribuição</p>
      <h3>${title}</h3>
      ${
        entries.length
          ? `<div class="insight-bars">
              ${entries
                .map(([key, count]) => {
                  const numeric = Number(count) || 0;
                  const width = Math.max(6, Math.round((numeric / max) * 100));
                  return `
                    <div class="insight-bar">
                      <div class="insight-bar__label">
                        <span>${labeler(key)}</span>
                        <strong>${formatNumber(numeric)}</strong>
                      </div>
                      <div class="insight-bar__track"><i style="width:${width}%"></i></div>
                    </div>
                  `;
                })
                .join("")}
            </div>`
          : `<p class="muted">${options.empty || "Sem dados registrados."}</p>`
      }
    </article>
  `;
}

function renderInsightTable(counts, labeler = (value) => value, empty = "Sem dados registrados.") {
  const entries = sortedCountEntries(counts);
  const total = entries.reduce((sum, [, count]) => sum + Number(count || 0), 0);
  if (!entries.length) return `<p class="muted">${empty}</p>`;
  return `
    <div class="table insight-table">
      ${entries
        .map(([key, count]) => {
          const numeric = Number(count) || 0;
          const percent = total ? Math.round((numeric / total) * 100) : 0;
          return `<div class="table-row"><span>${labeler(key)}</span><strong>${formatNumber(numeric)} · ${percent}%</strong></div>`;
        })
        .join("")}
    </div>
  `;
}

function renderChannelCards(sourceCounts, totalAccesses) {
  const channels = [
    ["qr", "QR Code", "Mesa e material impresso"],
    ["instagram", "Instagram", "Bio, stories e perfil"],
    ["whatsapp", "WhatsApp", "Compartilhamentos"],
    ["google", "Google", "Pesquisa na internet"],
    ["internet", "Internet", "Sites e links externos"],
    ["direct", "Direto", "Sem referrer"],
  ];
  return `
    <div class="channel-grid">
      ${channels
        .map(([key, label, hint]) => {
          const count = Number(sourceCounts[key] || 0);
          const percent = Number(totalAccesses) ? Math.round((count / Number(totalAccesses)) * 100) : 0;
          return `
            <div class="channel-card">
              <span>${label}</span>
              <strong>${formatNumber(count)}</strong>
              <small>${percent}% · ${hint}</small>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderConversionFunnel(periodAccesses, whatsappClicks, mapsClicks) {
  const accesses = Number(periodAccesses || 0);
  const whatsapp = Number(whatsappClicks || 0);
  const maps = Number(mapsClicks || 0);
  const intent = whatsapp + maps;
  return `
    <article class="card insight-chart">
      <p class="eyebrow">Conversão</p>
      <h3>Funil de intenção</h3>
      <div class="funnel">
        ${funnelStep("Acessou o cardápio", accesses, accesses || 1)}
        ${funnelStep("Chamou no WhatsApp", whatsapp, accesses || 1)}
        ${funnelStep("Pediu rota", maps, accesses || 1)}
      </div>
      <p class="muted">${accesses ? `${Math.round((intent / accesses) * 100)}% dos acessos viraram ação de intenção.` : "Sem acessos no período para calcular intenção."}</p>
    </article>
  `;
}

function funnelStep(label, value, max) {
  const width = Math.max(8, Math.round((Number(value || 0) / Number(max || 1)) * 100));
  return `
    <div class="funnel-step">
      <div><span>${label}</span><strong>${formatNumber(value)}</strong></div>
      <i style="width:${width}%"></i>
    </div>
  `;
}

function renderRecentEvents(events = []) {
  if (!events.length) return `<p class="muted">Ainda não há eventos recentes no recorte atual.</p>`;
  return `
    <div class="table insight-table">
      ${events
        .map((event) => `
          <div class="table-row">
            <span>${formatEventLabel(event.event_type)} · ${formatSourceLabel(event.source)} · ${formatDeviceLabel(event.device_type)}</span>
            <strong>${event.created_at ? formatDateTime(event.created_at) : ""}</strong>
          </div>
        `)
        .join("")}
    </div>
  `;
}

function sortedCountEntries(counts = {}) {
  return Object.entries(counts)
    .filter(([, count]) => Number(count) > 0)
    .sort((a, b) => Number(b[1]) - Number(a[1]));
}

function normalizeCountKeys(counts = {}, normalizer = (value) => value) {
  return Object.entries(counts).reduce((acc, [key, count]) => {
    const normalized = normalizer(key) || key || "direct";
    acc[normalized] = (acc[normalized] || 0) + Number(count || 0);
    return acc;
  }, {});
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("pt-BR");
}

function formatSourceLabel(source = "") {
  const labels = {
    direct: "Direto",
    instagram: "Instagram",
    whatsapp: "WhatsApp",
    google: "Google",
    qr: "QR Code",
    search: "Busca",
    facebook: "Facebook",
    tiktok: "TikTok",
    platform: "QrStack",
    hq: "Central QrStack",
    cliente: "Portal do restaurante",
    internet: "Internet",
  };
  const key = String(source || "direct").toLowerCase();
  return labels[key] || String(source || "Direto");
}

function formatDeviceLabel(device = "") {
  const labels = {
    mobile: "Mobile",
    desktop: "Desktop",
    tablet: "Tablet",
    desconhecido: "Não identificado",
  };
  const key = String(device || "desconhecido").toLowerCase();
  return labels[key] || String(device || "Não identificado");
}

function formatHourLabel(hour = "") {
  const clean = String(hour || "").padStart(2, "0").slice(0, 2);
  return /^\d{2}$/.test(clean) ? `${clean}h` : String(hour || "");
}

function formatDateShort(value = "") {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return String(value || "");
  return new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function formatEventLabel(type = "") {
  const labels = {
    page_view: "Acesso ao cardápio",
    whatsapp_click: "Clique no WhatsApp",
    maps_click: "Clique em Como chegar",
    instagram_click: "Clique no Instagram",
    menu_open: "Abertura de cardápio",
    story_click: "Clique no Story",
  };
  const key = String(type || "").toLowerCase();
  return labels[key] || String(type || "Evento");
}

function insightSummary(periodAccesses, sourceCounts, whatsappClicks, mapsClicks) {
  const topSource = sortedCountEntries(sourceCounts)[0];
  const sourceText = topSource ? `${formatSourceLabel(topSource[0])} lidera as entradas com ${formatNumber(topSource[1])} acesso(s)` : "ainda não há origem dominante registrada";
  const actionCount = Number(whatsappClicks || 0) + Number(mapsClicks || 0);
  if (!Number(periodAccesses)) return "Sem acessos no recorte atual. Use um período maior ou confira se o link publicado já está registrando eventos.";
  if (!actionCount) return `${sourceText}. Ainda não houve clique em WhatsApp ou rota neste recorte.`;
  return `${sourceText}. O período gerou ${formatNumber(actionCount)} ação(ões) de intenção, somando WhatsApp e rota.`;
}

function groupBy(list, key) {
  return list.reduce((acc, item) => {
    const group = item[key] || "Geral";
    acc[group] = acc[group] || [];
    acc[group].push(item);
    return acc;
  }, {});
}

function isToday(value) {
  return new Date(value).toDateString() === new Date().toDateString();
}

function lastDaysEvents(days) {
  const min = Date.now() - days * 24 * 60 * 60 * 1000;
  return state.events.filter((event) => new Date(event.createdAt).getTime() >= min);
}

function peakHour() {
  const hours = groupBy(
    state.events.map((event) => ({ hour: new Date(event.createdAt).getHours() })),
    "hour"
  );
  const [hour, events] = Object.entries(hours).sort((a, b) => b[1].length - a[1].length)[0] || ["--", []];
  return hour === "--" ? "Sem dados ainda." : `${hour.padStart(2, "0")}h, com ${events.length} eventos registrados.`;
}

function formatDate(value) {
  if (!value) return "";
  return new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
}

function formatDateTime(value) {
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function escapeAttr(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
}

function toast(message) {
  const old = document.querySelector(".toast");
  if (old) old.remove();
  const element = document.createElement("div");
  element.className = "toast";
  element.textContent = message;
  document.body.appendChild(element);
  setTimeout(() => element.remove(), 2800);
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 3) {
  const words = String(text).split(" ");
  let line = "";
  let lineCount = 0;
  for (let index = 0; index < words.length; index += 1) {
    const testLine = `${line}${words[index]} `;
    if (ctx.measureText(testLine).width > maxWidth && index > 0) {
      ctx.fillText(line.trim(), x, y);
      line = `${words[index]} `;
      y += lineHeight;
      lineCount += 1;
      if (lineCount >= maxLines - 1) break;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line.trim(), x, y);
}

window.addEventListener("hashchange", router);
document.addEventListener("submit", (event) => {
  const insightsFilter = event.target.closest("[data-insights-filter]");
  if (insightsFilter) {
    event.preventDefault();
    hydrateInsights(getRestaurant(ACTIVE_CLIENT_SLUG));
    return;
  }

  const ownerAccessForm = event.target.closest("[data-owner-access]");
  if (ownerAccessForm) {
    event.preventDefault();
    const rawAccess = new FormData(ownerAccessForm).get("ownerAccessKey");
    const key = extractAccessParam(rawAccess, "key");
    if (key === OWNER_ACCESS_TOKEN) {
      rememberAccess(OWNER_SESSION_KEY);
      window.location.hash = ownerLink("overview");
      return;
    }
    toast("Chave da Central inválida.");
    return;
  }

  const clientAccessForm = event.target.closest("[data-client-access]");
  if (clientAccessForm) {
    event.preventDefault();
    const restaurant = getRestaurant(clientAccessForm.dataset.slug || ACTIVE_CLIENT_SLUG);
    const rawAccess = new FormData(clientAccessForm).get("clientAccessToken");
    const token = extractAccessParam(rawAccess, "token");
    const expectedToken = restaurant.adminToken || ACTIVE_CLIENT_TOKEN;
    if (token === expectedToken) {
      rememberAccess(clientSessionKey(restaurant));
      window.location.hash = clientPortalLink(restaurant);
      return;
    }
    toast("Token do restaurante inválido.");
  }
});

document.addEventListener("click", async (event) => {
  const backButton = event.target.closest("[data-history-back]");
  if (backButton) {
    event.preventDefault();
    if (history.length > 1) history.back();
    else window.location.hash = "#/home";
    return;
  }
  const insightsPreset = event.target.closest("[data-insights-preset]");
  if (insightsPreset) {
    event.preventDefault();
    setInsightsPreset(insightsPreset.dataset.insightsPreset);
    hydrateInsights(getRestaurant(ACTIVE_CLIENT_SLUG));
    return;
  }
  const copyButton = event.target.closest("[data-copy], [data-copy-input]");
  if (!copyButton) return;
  const inputName = copyButton.dataset.copyInput;
  const input = inputName ? document.querySelector(`[name="${inputName}"]`) : null;
  const value = input ? input.value : copyButton.dataset.copy;
  if (!value) return;
  await copyToClipboard(value);
  toast("Link copiado.");
});
router();

function extractAccessParam(value, paramName) {
  const rawValue = String(value || "").trim();
  if (!rawValue) return "";
  try {
    const url = new URL(rawValue);
    const hashQuery = url.hash.includes("?") ? url.hash.split("?")[1] : "";
    return new URLSearchParams(hashQuery || url.search).get(paramName) || rawValue;
  } catch {
    const query = rawValue.includes("?") ? rawValue.split("?").pop() : "";
    const queryValue = new URLSearchParams(query).get(paramName);
    return queryValue || rawValue;
  }
}

async function copyToClipboard(value) {
  try {
    await navigator.clipboard.writeText(value);
    return;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }
}
