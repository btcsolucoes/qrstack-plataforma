const ASSETS = {
  qrstackMark: "assets/qrstack-mark.png",
  qrstackWordmark: "assets/qrstack-wordmark.png",
};

const QRSTACK_D1_API_URL = "https://qrstack-api.qrstack.workers.dev";
const QRSTACK_API_URL = QRSTACK_D1_API_URL;
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
      liveMenuEndpoint: "https://script.google.com/macros/s/AKfycbzm64OAl5G59pLyzl_bEPt64NwFohyhdBFTI_44Zu2UDF4gTpwaSuGcPAV-I3U57nHy/exec",
      analyticsEndpoint: QRSTACK_D1_API_URL || "https://script.google.com/macros/s/AKfycbzm64OAl5G59pLyzl_bEPt64NwFohyhdBFTI_44Zu2UDF4gTpwaSuGcPAV-I3U57nHy/exec",
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
const INSIGHTS_CACHE_KEY = "qrstack-insights-html-cache-v2";
const insightsOpenedThisSession = new Set();
const app = document.getElementById("app");
let state = loadState();
let lastStoryDataUrl = "";
let routeVersion = 0;
const runtimeCatalogs = new Map();
const insightsRetryTimers = new Map();
const insightsRefreshJobs = new Map();
persistRuntimeStateMigrations();

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
    const analyticsEndpoint = normalizedAnalyticsEndpoint(restaurant, defaults);
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
      analyticsEndpoint,
    };
  });
  return parsedState;
}

function normalizedAnalyticsEndpoint(restaurant, defaults = {}) {
  if (restaurant.slug === ACTIVE_CLIENT_SLUG && QRSTACK_D1_API_URL) return QRSTACK_D1_API_URL;
  return restaurant.analyticsEndpoint || defaults.analyticsEndpoint || restaurant.liveMenuEndpoint || defaults.liveMenuEndpoint || "";
}

function persistRuntimeStateMigrations() {
  state.restaurants = state.restaurants.map((restaurant) => {
    const defaults = DEFAULT_STATE.restaurants.find((item) => item.slug === restaurant.slug) || {};
    return { ...restaurant, analyticsEndpoint: normalizedAnalyticsEndpoint(restaurant, defaults) };
  });
  saveState();
}

function saveState() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

function insightsCacheId(restaurant, filters = {}) {
  return [
    restaurant?.slug || "restaurant",
    filters.startDate || "all",
    filters.endDate || "all",
  ].join(":");
}

function readInsightsCache() {
  try {
    return JSON.parse(localStorage.getItem(INSIGHTS_CACHE_KEY) || "{}");
  } catch {
    return {};
  }
}

function getCachedInsightsHtml(restaurant, filters = {}) {
  const cache = readInsightsCache();
  return cache[insightsCacheId(restaurant, filters)] || null;
}

function saveCachedInsightsHtml(restaurant, filters = {}, html = "") {
  if (!html) return;
  try {
    const cache = readInsightsCache();
    cache[insightsCacheId(restaurant, filters)] = {
      html,
      savedAt: new Date().toISOString(),
    };
    const entries = Object.entries(cache).slice(-12);
    localStorage.setItem(INSIGHTS_CACHE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // Cache is only a resilience layer; the dashboard must keep working without it.
  }
}

function clearInsightsRetry(restaurant) {
  const key = restaurant?.slug || "restaurant";
  const timer = insightsRetryTimers.get(key);
  if (timer) clearTimeout(timer);
  insightsRetryTimers.delete(key);
}

function scheduleInsightsRetry(restaurant, delayMs = 18000) {
  if (!restaurant) return;
  const key = restaurant.slug || "restaurant";
  clearInsightsRetry(restaurant);
  insightsRetryTimers.set(
    key,
    setTimeout(() => {
      insightsRetryTimers.delete(key);
      if (document.getElementById("insights-live")) hydrateInsights(restaurant);
    }, delayMs)
  );
}

async function apiGet(action, params = {}) {
  if (!QRSTACK_API_URL) throw new Error("missing_api_url");
  const url = new URL(QRSTACK_API_URL);
  url.searchParams.set("action", action);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, value);
  });
  const response = await fetchWithRetry(url.toString(), { cache: "no-store" }, { timeoutMs: 15000, attempts: 2 });
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
  const corsEndpoint = supportsCorsEndpoint(endpoint);
  if (action === "getInsights" && !corsEndpoint) return endpointJsonp(url, 15000);
  try {
    const response = await fetchWithRetry(
      url.toString(),
      { cache: "no-store" },
      { timeoutMs: action === "getInsights" ? 30000 : 15000, attempts: 2 }
    );
    const text = await response.text();
    if (!text.trim().startsWith("{")) throw new Error("endpoint_not_public_or_not_json");
    const data = JSON.parse(text);
    if (!response.ok || data.ok === false) throw new Error(data.error || "endpoint_request_failed");
    return data;
  } catch (error) {
    if (action === "getInsights") return endpointJsonp(url, 30000);
    throw error;
  }
}

function supportsCorsEndpoint(endpoint = "") {
  const text = String(endpoint || "").toLowerCase();
  return text.includes("workers.dev") || text.includes("pages.dev") || text.includes("cloudflare");
}

function endpointJsonp(url, timeoutMs = 90000) {
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
      cleanup(true);
      reject(new Error("endpoint_jsonp_timeout"));
    }, timeoutMs);
    const cleanup = (keepLateCallback = false) => {
      clearTimeout(timeout);
      if (keepLateCallback) {
        window[callbackName] = () => {};
        setTimeout(() => {
          delete window[callbackName];
        }, 120000);
      } else {
        delete window[callbackName];
      }
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
  const response = await fetchWithRetry(
    QRSTACK_API_URL,
    {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body: JSON.stringify(payload),
    },
    { timeoutMs: 20000, attempts: 2 }
  );
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

async function fetchWithRetry(url, options = {}, settings = {}) {
  const attempts = Math.max(1, Number(settings.attempts || 1));
  const timeoutMs = Math.max(1000, Number(settings.timeoutMs || 10000));
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetchWithTimeout(url, options, timeoutMs);
      if (response.status >= 500 && attempt < attempts) throw new Error(`server_${response.status}`);
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }
  }
  throw lastError || new Error("network_request_failed");
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
  const liveCatalog = runtimeCatalogs.get("rest_amaro");
  if (liveCatalog?.length) return liveCatalog;
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
  const liveCatalog = runtimeCatalogs.get(restaurant.id);
  if (liveCatalog?.length) return liveCatalog;
  return getAllCatalogItems().filter((item) => item.restaurant_id === restaurant.id);
}

function isCatalogItemActive(item) {
  const value = item?.is_active;
  return value !== false && value !== 0 && String(value ?? "TRUE").toUpperCase() !== "FALSE";
}

function normalizeCatalogItem(item, restaurant) {
  return {
    ...item,
    id: item.id || `catalog_${normalizeKey(item.name)}`,
    restaurant_id: item.restaurant_id || restaurant.id,
    section_id: item.section_id || normalizeKey(item.section_title || item.category || "catalogo"),
    section_title: item.section_title || item.category || "Catálogo",
    name: item.name || "",
    category: item.category || item.section_title || "Catálogo",
    description: item.description || "",
    price: item.price || "",
    image_url: item.image_url || "",
    sort_order: Number(item.sort_order || 0),
    is_active: isCatalogItemActive(item) ? "TRUE" : "FALSE",
  };
}

async function syncCatalogForRestaurant(restaurant) {
  let catalog = [];
  try {
    const endpoint = restaurant.analyticsEndpoint || QRSTACK_D1_API_URL;
    const data = await endpointGet(endpoint, "getCatalog", { slug: restaurant.slug });
    catalog = Array.isArray(data.items) ? data.items : Array.isArray(data.catalog) ? data.catalog : [];
  } catch (error) {
    console.warn("QrStack catalog API unavailable:", error.message);
  }

  if (!catalog.length && restaurant.catalogUrl) {
    try {
      const response = await fetchWithTimeout(`${restaurant.catalogUrl}?v=${Date.now()}`, { cache: "no-store" }, 6000);
      let data = JSON.parse((await response.text()).replace(/^\uFEFF/, ""));
      if (typeof data === "string") data = JSON.parse(data.replace(/^\uFEFF/, ""));
      catalog = Array.isArray(data) ? data : Array.isArray(data.items) ? data.items : [];
    } catch (error) {
      console.warn("QrStack published catalog unavailable:", error.message);
    }
  }

  const activeCatalog = catalog
    .filter((item) => item?.name && isCatalogItemActive(item))
    .map((item) => normalizeCatalogItem(item, restaurant));
  if (activeCatalog.length) runtimeCatalogs.set(restaurant.id, activeCatalog);
  return activeCatalog.length ? activeCatalog : getCatalogForRestaurant(restaurant);
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
    <section class="entry-screen">
      <div class="entry-shell">
        <header class="entry-header">
          <img src="${ASSETS.qrstackWordmark}" alt="QrStack" />
          <div>
            <p class="eyebrow">Plataforma QrStack</p>
            <h1>Escolha seu acesso</h1>
            <p>Três destinos, cada um com uma função clara.</p>
          </div>
        </header>
        <div class="entry-grid">
          <a class="entry-card entry-card--owner" href="${ownerHasSession ? ownerLink("overview") : "#/hq"}">
            <span class="entry-card__index">01</span>
            <h2>Central QrStack</h2>
            <p>Clientes, respostas, banco de pratos, Stories e Insights.</p>
            <strong>${ownerHasSession ? "Continuar na Central" : "Acesso interno"}</strong>
          </a>
          <a class="entry-card entry-card--restaurant" href="${clientHasSession ? clientPortalLink(restaurant) : `#/cliente/${restaurant.slug}`}">
            <span class="entry-card__index">02</span>
            <h2>Portal do restaurante</h2>
            <p>Formulário diário e geração da arte para o Story.</p>
            <strong>${clientHasSession ? `Continuar como ${restaurant.name}` : "Acesso privado"}</strong>
          </a>
          <a class="entry-card entry-card--menu" href="${publicMenuHash(restaurant, "platform")}">
            <span class="entry-card__index">03</span>
            <h2>Cardápio público</h2>
            <p>Visualização fiel do cardápio que o cliente acessa.</p>
            <strong>Abrir cardápio</strong>
          </a>
        </div>
      </div>
    </section>
  `;
}

function renderOwnerGate() {
  setSystemTheme();
  app.innerHTML = `
    <section class="entry-screen entry-screen--gate">
      <div class="access-panel">
        <img class="access-panel__logo" src="${ASSETS.qrstackWordmark}" alt="QrStack" />
        <p class="eyebrow">Acesso interno</p>
        <h1>Central QrStack</h1>
        <p>Insira sua chave para abrir o ambiente de gestão.</p>
        <form class="access-form" data-owner-access>
          <label for="owner-access-key">Chave ou link de acesso</label>
          <input id="owner-access-key" name="ownerAccessKey" autocomplete="off" placeholder="Cole sua chave ou o link da Central" />
          <div class="actions">
            <button type="submit">Entrar na Central</button>
            <a class="button secondary" href="#/home">Voltar ao início</a>
          </div>
        </form>
      </div>
    </section>
  `;
}

function renderClientGate(restaurant) {
  setTheme(restaurant);
  app.innerHTML = `
    <section class="entry-screen entry-screen--gate entry-screen--restaurant">
      <div class="access-panel">
        <img class="access-panel__logo access-panel__logo--restaurant" src="${restaurant.logoUrl}" alt="${restaurant.name}" />
        <p class="eyebrow">Acesso do restaurante</p>
        <h1>${restaurant.name}</h1>
        <p>Use o link privado enviado pela QrStack para abrir o formulário.</p>
        <form class="access-form" data-client-access data-slug="${restaurant.slug}">
          <label for="client-access-token">Token ou link privado</label>
          <input id="client-access-token" name="clientAccessToken" autocomplete="off" placeholder="Cole o token ou link do restaurante" />
          <div class="actions">
            <button type="submit">Abrir formulário</button>
            <a class="button secondary" href="${publicMenuHash(restaurant, "platform")}">Ver cardápio público</a>
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
  if (tab === "insights") {
    const restaurant = restaurants[0];
    const shouldRefreshOnOpen = !insightsOpenedThisSession.has(restaurant.slug);
    insightsOpenedThisSession.add(restaurant.slug);
    hydrateInsights(restaurant, { refreshAfterLoad: shouldRefreshOnOpen });
  }
}

function renderAdminHero(title, subtitle, logoUrl) {
  return `
    <header class="admin-hero">
      <div class="admin-hero__inner">
        <div class="admin-title">
          <img src="${logoUrl}" alt="" />
          <div class="admin-title__copy">
            <p class="eyebrow">QrStack Workspace</p>
            <h2>${title}</h2>
            <p>${subtitle}</p>
          </div>
          <span class="admin-title__status"><i></i> Operação online</span>
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
        <p class="muted">No Amaro, o cardápio público busca um endpoint do Google Apps Script, filtra as respostas da planilha pela data de hoje e renderiza o almoço automaticamente. Na QrStack, os dados gerenciais e os analytics ficam no Cloudflare D1, enquanto o GitHub segue só para código/deploy.</p>
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
                  <a class="button secondary" href="${publicMenuHash(restaurant, "hq")}">Cardápio público</a>
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
          <button type="button" class="secondary" data-insights-preset="today" aria-pressed="false">Hoje</button>
          <button type="button" class="secondary" data-insights-preset="7" aria-pressed="false">7 dias</button>
          <button type="button" class="secondary" data-insights-preset="30" aria-pressed="false">30 dias</button>
          <button type="button" class="secondary" data-insights-preset="all" aria-pressed="false">Todos</button>
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
            <p class="muted">A plataforma está carregando o consolidado salvo na base analítica QrStack.</p>
          </div>
          <span class="status-pill status-pill--pending">Sincronizando</span>
        </article>
      </div>
      <details class="local-insights card">
        <summary>
          <span>
            <span class="eyebrow">Diagnóstico</span>
            <strong>Eventos deste navegador</strong>
          </span>
          <small>${formatNumber(state.events.length)} evento(s) local(is)</small>
        </summary>
        <div class="local-insights__content">
          <p class="muted">Área técnica para testes. Estes números ficam separados dos analytics reais da base QrStack.</p>
          <div class="compact-kpis">
            ${insightKpi("Eventos locais", state.events.length)}
            ${insightKpi("WhatsApp", clicksWhats)}
            ${insightKpi("Como chegar", clicksMaps)}
            ${insightKpi("7 dias locais", lastDaysEvents(7).length)}
          </div>
          <div class="dashboard-grid dashboard-grid--two">
            ${renderInsightBars("Origem local", localSourceCounts, { empty: "Sem eventos locais registrados ainda." })}
            <article class="insight-card local-peak">
              <p class="eyebrow">Pico local</p>
              <h3>Horário de pico</h3>
              <p class="muted">${peakHour()}</p>
            </article>
          </div>
        </div>
      </details>
    </section>
  `;
}

async function renderClientPortal(slug, version) {
  const localRestaurant = getRestaurant(slug);
  const [remote] = await Promise.all([syncMenuFromApi(slug), syncCatalogForRestaurant(localRestaurant)]);
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
      ${renderClientTopbar(restaurant)}
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

function renderClientTopbar(restaurant) {
  const ownerReturn = hasRememberedAccess(OWNER_SESSION_KEY)
    ? `<a class="nav-link" href="${ownerLink("overview")}">Voltar à Central</a>`
    : "";
  return `
    <nav class="topbar client-topbar" aria-label="Navegação do portal">
      <div class="topbar__inner">
        <a class="brand-chip" href="${clientPortalLink(restaurant)}">
          <img src="${restaurant.logoUrl}" alt="" />
          <span>${restaurant.name}</span>
        </a>
        <button type="button" class="nav-link active" data-scroll-target="formulario">Formulário</button>
        <button type="button" class="nav-link" data-scroll-target="story-panel">Story</button>
        <a class="nav-link" href="${publicMenuHash(restaurant, "cliente")}">Cardápio público</a>
        ${ownerReturn}
      </div>
    </nav>
  `;
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
  const configuredFields = getAmaroFormFields().filter((field) => field.title.toLowerCase().startsWith("prato"));
  const fields = configuredFields.length
    ? configuredFields
    : Array.from({ length: 7 }, (_, index) => ({ title: `Prato ${index + 1}:` }));
  const activeExecutives = getAmaroCatalog()
    .filter((item) => item.section_id === "executivos" && isCatalogItemActive(item))
    .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0))
    .map((item) => item.name);
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
                  ${activeExecutives
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

async function hydrateInsights(restaurant, options = {}) {
  const target = document.getElementById("insights-live");
  if (!target || !restaurant) return;
  const forceRefresh = options.forceRefresh === true;
  const refreshAfterLoad = options.refreshAfterLoad === true;
  const silentRefresh = options.silentRefresh === true;
  const filters = getInsightsFilters();
  const cachedBeforeFetch = getCachedInsightsHtml(restaurant, filters);
  if (cachedBeforeFetch?.html && !forceRefresh) {
    target.innerHTML = cachedBeforeFetch.html;
  }
  const applyButton = document.querySelector('[data-insights-filter] button[type="submit"]');
  if (forceRefresh && !silentRefresh && applyButton) {
    applyButton.disabled = true;
    applyButton.dataset.originalLabel = applyButton.textContent;
    applyButton.textContent = "Atualizando...";
  }
  try {
    const endpoint = restaurant.analyticsEndpoint || restaurant.liveMenuEndpoint || QRSTACK_API_URL;
    const data = await endpointGet(endpoint, "getInsights", {
      slug: restaurant.slug,
      key: OWNER_ACCESS_TOKEN,
      startDate: filters.startDate,
      endDate: filters.endDate,
      refresh: forceRefresh ? "1" : "",
      refresh_nonce: forceRefresh ? Date.now() : "",
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
    const dishViewCounts = insights.dish_view_counts || {};
    const dishTouchCounts = insights.dish_touch_counts || {};
    const dishObserveSeconds = insights.dish_observe_seconds || {};
    const dishAttentionScores = insights.dish_attention_scores || {};
    const dishCategoryCounts = insights.dish_view_category_counts || {};
    const dishTouchCategoryCounts = insights.dish_touch_category_counts || {};
    const dishObserveCategorySeconds = insights.dish_observe_category_seconds || {};
    const totalDishViews = insights.total_dish_views ?? eventTypeCounts.dish_view ?? 0;
    const totalDishTouches = insights.total_dish_touches ?? eventTypeCounts.dish_touch ?? 0;
    const totalDishObserveSeconds = insights.total_dish_observe_seconds ?? 0;
    const webviewBannerShown = insights.webview_banner_shown || 0;
    const instagramToDirect = insights.instagram_to_direct || {};
    const instagramVisitors = Number(instagramToDirect.instagram_visitors || 0);
    const instagramToDirectVisitors = Number(instagramToDirect.instagram_to_direct_visitors || 0);
    const instagramToDirectSessions = Number(instagramToDirect.direct_sessions_after_instagram || 0);
    const instagramToDirectRate = Number(instagramToDirect.instagram_to_direct_rate || 0);
    const recentEvents = insights.recent_events || [];
    const testEvents = Number(insights.test_events || 0);
    const collectedAt = insights.collected_at ? formatDateTime(insights.collected_at) : "Agora";
    const topSource = sortedCountEntries(sourceCounts)[0];
    const topDish = sortedCountEntries(dishAttentionScores)[0];
    const topObservedDish = sortedCountEntries(dishObserveSeconds)[0];
    const topCategory = sortedCountEntries(dishCategoryCounts)[0];
    const topDevice = sortedCountEntries(deviceCounts)[0];
    target.innerHTML = `
      <article class="card dashboard-hero">
        <div>
          <p class="eyebrow">Analytics reais</p>
          <h3>${restaurant.name} · ${periodLabel}</h3>
          <p class="muted">Dados carregados da base analítica QrStack. A leitura abaixo separa origem, volume, visitantes únicos, dispositivos e ações de intenção.</p>
        </div>
        <div class="dashboard-hero__status">
          <span class="status-pill">Coleta ativa</span>
          <small>Atualizado: ${collectedAt}</small>
          ${testEvents ? `<small>${formatNumber(testEvents)} evento(s) de teste filtrado(s)</small>` : ""}
        </div>
      </article>
      <section class="control-room">
        <article class="card command-panel">
          <div class="command-panel__copy">
            <p class="eyebrow">Leitura executiva</p>
            <h3>${formatNumber(periodAccesses)} acessos reais</h3>
            <p class="muted">Acessos são aberturas do cardápio. As ${formatNumber(periodEvents)} interações abaixo mostram o que aconteceu depois que a pessoa entrou.</p>
          </div>
          <div class="command-metrics">
            ${insightKpi("Visitantes únicos", uniqueSessions, uniqueSessionsTotal ? `${formatNumber(uniqueSessionsTotal)} no histórico` : "por sessão")}
            ${insightKpi("Hoje", accessesToday, "acessos no dia")}
            ${insightKpi("7 dias", accesses7Days, "janela recente")}
            ${insightKpi("Webview IG", webviewBannerShown, "avisos/redirects")}
            ${insightKpi("Pessoas que retornaram", instagramToDirectVisitors, `${formatPercentNumber(instagramToDirectRate)} dos visitantes do Instagram`)}
            ${insightKpi("Pico", peak || "Sem dados", "maior horário")}
          </div>
        </article>
        <article class="card decision-panel">
          <p class="eyebrow">O que merece atenção</p>
          ${renderInsightHighlights([
            ["Origem líder", topSource ? formatSourceLabel(topSource[0]) : "Sem origem", topSource ? `${formatNumber(topSource[1])} acessos` : "sem dados"],
            ["Prato líder", topDish ? topDish[0] : "Sem ranking", topDish ? `${formatScore(topDish[1])} pontos` : "sem dados"],
            ["Mais observado", topObservedDish ? topObservedDish[0] : "Sem tempo", topObservedDish ? formatDurationShort(topObservedDish[1]) : "sem dados"],
            ["Categoria quente", topCategory ? topCategory[0] : "Sem categoria", topCategory ? `${formatNumber(topCategory[1])} visualizações` : "sem dados"],
            ["Conversão Instagram -> Direto", `${formatNumber(instagramToDirectVisitors)} pessoa(s) retornaram`, `${formatNumber(instagramToDirectSessions)} acesso(s) direto(s) feito(s) por elas`],
          ])}
          <p class="muted decision-panel__note">${insightSummary(periodAccesses, sourceCounts, whatsappClicks, mapsClicks)}</p>
        </article>
      </section>
      <section class="insight-section insight-section--traffic">
        <div class="section-title-row">
          <div>
            <p class="eyebrow">Entrada</p>
            <h3>Canais que trazem gente para o cardápio</h3>
          </div>
          <span>${topDevice ? `${formatDeviceLabel(topDevice[0])} domina o acesso` : "Sem dispositivo dominante"}</span>
        </div>
        ${renderChannelCards(sourceCounts, periodAccesses)}
        <div class="dashboard-grid dashboard-grid--split">
          ${renderDonutChart("Composição dos acessos", sourceCounts, { empty: "Sem origem registrada neste período.", labeler: formatSourceLabel })}
          ${renderInstagramDirectConversion(instagramToDirect)}
        </div>
      </section>
      <section class="insight-section insight-section--menu">
        <div class="section-title-row">
          <div>
            <p class="eyebrow">Cardápio</p>
            <h3>Pratos com mais força comercial</h3>
          </div>
          <span>Score = visualização + toque + tempo</span>
        </div>
        <div class="menu-command-grid">
          ${renderInsightBars("Ranking principal", dishAttentionScores, { empty: "Sem score de interesse suficiente neste período.", labeler: (value) => value, valueFormatter: formatScore, limit: 8 })}
          <div class="menu-side-stack">
            ${renderInsightBars("Tempo observado", dishObserveSeconds, { empty: "Ainda não há tempo observado por prato neste período.", labeler: (value) => value, valueFormatter: formatDurationShort, limit: 6 })}
            ${renderInsightBars("Toques nos pratos", dishTouchCounts, { empty: "Ainda não houve toque nos cards de pratos neste período.", labeler: (value) => value, limit: 6 })}
          </div>
        </div>
        <div class="dashboard-kpis dashboard-kpis--engagement">
          ${insightKpi("Pratos vistos", totalDishViews, "cards com permanência mínima")}
          ${insightKpi("Toques", totalDishTouches, "interações nos cards")}
          ${insightKpi("Tempo observado", formatDurationShort(totalDishObserveSeconds), "soma do período")}
          ${insightKpi("Interações", periodEvents, "eventos no período")}
        </div>
      </section>
      <section class="insight-section insight-section--patterns">
        <div class="section-title-row">
          <div>
            <p class="eyebrow">Padrões</p>
            <h3>Quando e como o cliente navega</h3>
          </div>
          <span>Separado de acesso real para evitar leitura inflada</span>
        </div>
        <div class="dashboard-grid dashboard-grid--three">
          ${renderAreaChart("Evolução diária", dailyAccesses, { empty: "Sem série diária neste período.", labeler: formatDateShort })}
          ${renderColumnChart("Horários de acesso", hourCounts, { empty: "Sem horário suficiente neste período.", labeler: formatHourLabel })}
          ${renderDonutChart("Dispositivos", deviceCounts, { empty: "Sem dispositivo registrado neste período.", labeler: formatDeviceLabel })}
        </div>
      </section>
      <section class="insight-section insight-section--categories">
        <div class="section-title-row">
          <div>
            <p class="eyebrow">Categorias</p>
            <h3>Onde o usuário passa mais tempo</h3>
          </div>
        </div>
        <div class="dashboard-grid dashboard-grid--three">
          ${renderInsightBars("Categorias vistas", dishCategoryCounts, { empty: "Sem categorias visualizadas neste período.", labeler: (value) => value, limit: 8 })}
          ${renderInsightBars("Tempo por categoria", dishObserveCategorySeconds, { empty: "Sem tempo por categoria neste período.", labeler: (value) => value, valueFormatter: formatDurationShort, limit: 8 })}
          ${renderInsightBars("Categorias tocadas", dishTouchCategoryCounts, { empty: "Sem toques por categoria neste período.", labeler: (value) => value, limit: 8 })}
        </div>
      </section>
      <section class="insight-section insight-section--audit">
        <div class="section-title-row">
          <div>
            <p class="eyebrow">Auditoria</p>
            <h3>Base bruta para conferir os dados</h3>
          </div>
          <span>${totalAccesses !== undefined ? `${formatNumber(totalAccesses)} acessos totais · ` : ""}${formatNumber(totalEvents)} interações totais</span>
        </div>
        <div class="dashboard-grid dashboard-grid--two">
          ${renderInsightBars("Tipos de evento", eventTypeCounts, { empty: "Sem eventos registrados neste período.", labeler: formatEventLabel })}
          <article class="card insight-table-card">
            <p class="eyebrow">Eventos recentes</p>
            <h3>Últimas movimentações</h3>
            ${renderRecentEvents(recentEvents)}
          </article>
        </div>
      </section>
    `;
    saveCachedInsightsHtml(restaurant, filters, target.innerHTML);
    clearInsightsRetry(restaurant);
    if (refreshAfterLoad && !forceRefresh && document.getElementById("insights-live")) {
      scheduleInsightsRefresh(restaurant);
    }
  } catch (error) {
    console.warn("QrStack insights unavailable:", error);
    const cached = getCachedInsightsHtml(restaurant, filters);
    scheduleInsightsRetry(restaurant);
    if (cached?.html) {
      target.innerHTML = `
        <article class="card dashboard-hero dashboard-hero--sync">
          <div>
            <p class="eyebrow">Analytics reais</p>
            <h3>${restaurant.name} · última leitura salva</h3>
            <p class="muted">A conexão com a base analítica está oscilando, então a plataforma manteve o último dashboard válido enquanto tenta atualizar sozinha.</p>
          </div>
          <div class="dashboard-hero__status">
            <span class="status-pill status-pill--pending">Sincronizando</span>
            <small>Última leitura: ${formatDateTime(cached.savedAt)}</small>
          </div>
        </article>
        ${cached.html}
      `;
      return;
    }
    target.innerHTML = `
      <article class="card dashboard-hero dashboard-hero--sync">
        <div>
          <p class="eyebrow">Analytics reais</p>
          <h3>Sincronizando dados do ${restaurant.name}</h3>
          <p class="muted">A base real de analytics está sendo carregada. A plataforma vai tentar novamente em segundo plano e preencher o dashboard assim que a resposta chegar.</p>
        </div>
        <div class="dashboard-hero__status">
          <span class="status-pill status-pill--pending">Carregando</span>
          <small>Sem usar número inventado</small>
        </div>
      </article>
      <div class="dashboard-kpis dashboard-kpis--loading">
        ${insightKpi("Coleta", "ativa", "aguardando leitura")}
        ${insightKpi("Eventos locais", state.events.length, "capturados neste navegador")}
        ${insightKpi("Retry", "auto", "sem rua sem saída")}
      </div>
    `;
  } finally {
    if (forceRefresh && !silentRefresh && applyButton) {
      applyButton.disabled = false;
      applyButton.textContent = applyButton.dataset.originalLabel || "Aplicar";
      delete applyButton.dataset.originalLabel;
    }
  }
}

function scheduleInsightsRefresh(restaurant, delay = 180) {
  if (!restaurant) return;
  const filters = getInsightsFilters();
  const jobKey = `${restaurant.slug}|${filters.startDate}|${filters.endDate}`;
  if (insightsRefreshJobs.has(jobKey)) return;

  const timer = window.setTimeout(() => {
    const job = hydrateInsights(restaurant, { forceRefresh: true, silentRefresh: true });
    insightsRefreshJobs.set(jobKey, job);
    Promise.resolve(job).finally(() => insightsRefreshJobs.delete(jobKey));
  }, delay);
  insightsRefreshJobs.set(jobKey, timer);
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
  form.querySelectorAll("[data-insights-preset]").forEach((button) => {
    const isActive = button.dataset.insightsPreset === preset;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
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
  const returnTarget = source === "cliente"
    ? { href: clientPortalLink(restaurant), label: "Voltar ao portal" }
    : source === "hq"
      ? { href: ownerLink("cardapios"), label: "Voltar à Central" }
      : source === "platform"
        ? { href: "#/home", label: "Voltar ao início" }
        : null;
  return `
    <div class="original-menu-shell">
      ${returnTarget ? `
        <nav class="topbar">
          <div class="topbar__inner">
            <span class="brand-chip"><img src="${restaurant.logoUrl}" alt="" /><span>${restaurant.name}</span></span>
            <a class="nav-link" href="${returnTarget.href}">${returnTarget.label}</a>
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
      ctx.save();
      ctx.globalAlpha = 0.075;
      drawImageContain(ctx, logo, 118, 500, w - 236, 700);
      drawImageContain(ctx, logo, 180, 1280, w - 360, 310);
      ctx.restore();
    }

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
    <article class="insight-kpi">
      <span class="eyebrow">${label}</span>
      <strong>${formatNumber(value)}</strong>
      ${detail ? `<small>${detail}</small>` : ""}
    </article>
  `;
}

function renderInsightBars(title, counts, options = {}) {
  const entries = sortedCountEntries(counts).slice(0, options.limit || 8);
  const max = Math.max(...entries.map(([, count]) => Number(count) || 0), 1);
  const labeler = options.labeler || ((value) => value);
  const valueFormatter = options.valueFormatter || formatNumber;
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
                    <button class="insight-bar" type="button" data-chart-point data-chart-label="${escapeAttr(labeler(key))}" data-chart-value="${escapeAttr(valueFormatter(numeric))}">
                      <div class="insight-bar__label">
                        <span>${labeler(key)}</span>
                        <strong>${valueFormatter(numeric)}</strong>
                      </div>
                      <div class="insight-bar__track"><i style="width:${width}%"></i></div>
                    </button>
                  `;
                })
                .join("")}
            </div>`
          : `<p class="muted">${options.empty || "Sem dados registrados."}</p>`
      }
    </article>
  `;
}

function renderAreaChart(title, counts, options = {}) {
  const entries = orderedChartEntries(counts, options.order || "date");
  const max = Math.max(...entries.map(([, value]) => Number(value) || 0), 1);
  const labeler = options.labeler || ((value) => value);
  if (!entries.length) {
    return chartShell(title, `<p class="muted">${options.empty || "Sem dados registrados."}</p>`);
  }
  const width = 320;
  const height = 150;
  const left = 18;
  const right = 18;
  const top = 16;
  const bottom = 24;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const points = entries.map(([, value], index) => {
    const x = left + (entries.length === 1 ? plotWidth / 2 : (index / (entries.length - 1)) * plotWidth);
    const y = top + plotHeight - ((Number(value) || 0) / max) * plotHeight;
    return { x, y, value: Number(value) || 0 };
  });
  const line = points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const area = `${left},${height - bottom} ${line} ${width - right},${height - bottom}`;
  const last = points[points.length - 1];
  return chartShell(title, `
    <div class="chart-figure chart-figure--area">
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${title}">
        <polygon points="${area}" class="area-fill"></polygon>
        <polyline points="${line}" class="area-line"></polyline>
        ${points.map((point, index) => `
          <g class="chart-point" tabindex="0" role="button" data-chart-point data-chart-label="${escapeAttr(labeler(entries[index][0]))}" data-chart-value="${escapeAttr(formatNumber(point.value))}" aria-label="${escapeAttr(`${labeler(entries[index][0])}: ${formatNumber(point.value)}`)}">
            <circle class="chart-point__hit" cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="10"></circle>
            <circle class="chart-point__dot" cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="3.6"></circle>
          </g>
        `).join("")}
        <text x="${left}" y="${height - 5}">${labeler(entries[0][0])}</text>
        <text x="${width - right}" y="${height - 5}" text-anchor="end">${labeler(entries[entries.length - 1][0])}</text>
        <text x="${Math.min(width - right, last.x + 8)}" y="${Math.max(14, last.y - 8)}" text-anchor="${last.x > width - 78 ? "end" : "start"}">${formatNumber(last.value)}</text>
      </svg>
    </div>
  `);
}

function renderColumnChart(title, counts, options = {}) {
  const entries = orderedChartEntries(counts, options.order || "hour");
  const max = Math.max(...entries.map(([, value]) => Number(value) || 0), 1);
  const labeler = options.labeler || ((value) => value);
  if (!entries.length) {
    return chartShell(title, `<p class="muted">${options.empty || "Sem dados registrados."}</p>`);
  }
  return chartShell(title, `
    <div class="column-chart" style="--columns:${entries.length}">
      ${entries.map(([key, value], index) => {
        const numeric = Number(value) || 0;
        const height = Math.max(4, Math.round((numeric / max) * 100));
        const showLabel = entries.length <= 12 || index % 4 === 0 || index === entries.length - 1;
        return `
          <button class="column-bar" type="button" data-chart-point data-chart-label="${escapeAttr(labeler(key))}" data-chart-value="${escapeAttr(formatNumber(numeric))}" aria-label="${escapeAttr(`${labeler(key)}: ${formatNumber(numeric)}`)}">
            <i style="height:${height}%"></i>
            <span>${showLabel ? labeler(key).replace("h", "") : ""}</span>
          </button>
        `;
      }).join("")}
    </div>
  `);
}

function renderDonutChart(title, counts, options = {}) {
  const entries = sortedCountEntries(counts).slice(0, options.limit || 5);
  const labeler = options.labeler || ((value) => value);
  const total = entries.reduce((sum, [, value]) => sum + Number(value || 0), 0);
  if (!entries.length || !total) {
    return chartShell(title, `<p class="muted">${options.empty || "Sem dados registrados."}</p>`);
  }
  const colors = ["var(--primary)", "var(--secondary)", "#153f2e", "#d9a441", "#6b7280"];
  let cursor = 0;
  const gradient = entries.map(([, value], index) => {
    const percent = (Number(value || 0) / total) * 100;
    const start = cursor;
    cursor += percent;
    return `${colors[index % colors.length]} ${start.toFixed(2)}% ${cursor.toFixed(2)}%`;
  }).join(", ");
  return chartShell(title, `
    <div class="donut-layout">
      <div class="donut-chart" data-donut-chart style="background:conic-gradient(${gradient});">
        <div class="donut-chart__value">
          <span data-donut-total>${formatNumber(total)}</span>
          <small data-donut-caption>Total</small>
        </div>
      </div>
      <div class="donut-legend">
        ${entries.map(([key, value], index) => {
          const numeric = Number(value) || 0;
          const percent = Math.round((numeric / total) * 100);
          return `
            <button type="button" class="donut-legend__item" data-donut-segment data-chart-point data-chart-label="${escapeAttr(labeler(key))}" data-chart-value="${escapeAttr(`${formatNumber(numeric)} · ${percent}%`)}" data-donut-value="${numeric}" data-donut-color="${colors[index % colors.length]}" aria-pressed="true">
              <i style="background:${colors[index % colors.length]}"></i>
              <span>${labeler(key)}</span>
              <strong>${percent}%</strong>
            </button>
          `;
        }).join("")}
      </div>
    </div>
  `);
}

function chartShell(title, body) {
  return `
    <article class="card insight-chart insight-chart--visual">
      <p class="eyebrow">Gráfico</p>
      <h3>${title}</h3>
      ${body}
      <output class="chart-tooltip" data-chart-tooltip aria-live="polite">Toque ou passe sobre o gráfico para ver os valores.</output>
    </article>
  `;
}

function showChartPointDetails(point) {
  const chart = point?.closest(".insight-chart");
  const tooltip = chart?.querySelector("[data-chart-tooltip]");
  if (!tooltip) return;
  chart.querySelectorAll("[data-chart-point].is-active").forEach((entry) => entry.classList.remove("is-active"));
  point.classList.add("is-active");
  tooltip.textContent = `${point.dataset.chartLabel || "Valor"}: ${point.dataset.chartValue || "0"}`;
  tooltip.classList.add("is-visible");
}

function toggleDonutSegment(segment) {
  const layout = segment.closest(".donut-layout");
  const donut = layout?.querySelector("[data-donut-chart]");
  const segments = [...(layout?.querySelectorAll("[data-donut-segment]") || [])];
  if (!donut || !segments.length) return;

  const isPressed = segment.getAttribute("aria-pressed") === "true";
  const activeCount = segments.filter((entry) => entry.getAttribute("aria-pressed") === "true").length;
  if (!(isPressed && activeCount === 1)) {
    segment.setAttribute("aria-pressed", String(!isPressed));
  }

  const active = segments.filter((entry) => entry.getAttribute("aria-pressed") === "true");
  const total = active.reduce((sum, entry) => sum + Number(entry.dataset.donutValue || 0), 0);
  let cursor = 0;
  const gradient = active.map((entry) => {
    const percent = total ? (Number(entry.dataset.donutValue || 0) / total) * 100 : 0;
    const start = cursor;
    cursor += percent;
    return `${entry.dataset.donutColor} ${start.toFixed(2)}% ${cursor.toFixed(2)}%`;
  }).join(", ");

  donut.style.background = gradient ? `conic-gradient(${gradient})` : "var(--line)";
  const totalNode = donut.querySelector("[data-donut-total]");
  const captionNode = donut.querySelector("[data-donut-caption]");
  if (totalNode) totalNode.textContent = formatNumber(total);
  if (captionNode) captionNode.textContent = active.length === segments.length ? "Total" : "Selecionado";
}

function orderedChartEntries(counts, order) {
  const entries = Object.entries(counts || {})
    .map(([key, value]) => [key, Number(value) || 0])
    .filter(([, value]) => value > 0);
  if (order === "hour") {
    return entries.sort((a, b) => Number(a[0]) - Number(b[0]));
  }
  if (order === "date") {
    return entries.sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  }
  return entries;
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

function renderInsightHighlights(items) {
  return `
    <div class="highlight-list">
      ${items
        .map(([label, value, detail]) => `
          <div class="highlight-item">
            <span>${label}</span>
            <strong>${value}</strong>
            <small>${detail}</small>
          </div>
        `)
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

function renderInstagramDirectConversion(conversion = {}) {
  const instagramVisitors = Number(conversion.instagram_visitors || 0);
  const convertedVisitors = Number(conversion.instagram_to_direct_visitors || 0);
  const directSessions = Number(conversion.direct_sessions_after_instagram || 0);
  const rate = Number(conversion.instagram_to_direct_rate || 0);
  return `
    <article class="card insight-chart">
      <p class="eyebrow">Conversão Instagram -> Direct</p>
      <h3>Jornada até o restaurante</h3>
      <div class="funnel">
        ${funnelStep("Pessoas que vieram do Instagram", instagramVisitors, instagramVisitors || 1)}
        ${funnelStep("Pessoas que voltaram via direto/QR", convertedVisitors, instagramVisitors || 1)}
        ${funnelStep("Acessos diretos feitos por essas pessoas", directSessions, instagramVisitors || 1)}
      </div>
      <p class="muted conversion-explainer">${instagramVisitors ? `<strong>${formatNumber(convertedVisitors)} pessoas únicas retornaram.</strong> Juntas, elas abriram o cardápio ${formatNumber(directSessions)} vezes de forma direta/QR. A taxa de retorno foi ${formatPercentNumber(rate)}.` : "Ainda não há visitantes de Instagram suficientes para calcular essa jornada."}</p>
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
        .map((event) => {
          const dishText = event.dish_name ? ` · ${event.dish_name}` : "";
          const durationText = event.observe_seconds ? ` · ${formatDurationShort(event.observe_seconds)}` : "";
          return `
          <div class="table-row">
            <span>${formatEventLabel(event.event_type)}${dishText}${durationText} · ${formatSourceLabel(event.source)} · ${formatDeviceLabel(event.device_type)}</span>
            <strong>${event.created_at ? formatDateTime(event.created_at) : ""}</strong>
          </div>
        `;
        })
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
  const number = Number(value || 0);
  return Number.isFinite(number) ? number.toLocaleString("pt-BR") : String(value || "0");
}

function formatPercentNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number)
    ? `${number.toLocaleString("pt-BR", { minimumFractionDigits: number % 1 ? 2 : 0, maximumFractionDigits: 2 })}%`
    : "0%";
}

function formatDurationShort(value) {
  const seconds = Math.round(Number(value || 0));
  if (!Number.isFinite(seconds) || seconds <= 0) return "0s";
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes < 60) return rest ? `${minutes}m ${rest}s` : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const minuteRest = minutes % 60;
  return minuteRest ? `${hours}h ${minuteRest}m` : `${hours}h`;
}

function formatScore(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : "0";
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
    dish_view: "Prato visualizado",
    dish_touch: "Toque em prato",
    dish_observe: "Tempo observando prato",
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
    insightsFilter.querySelectorAll("[data-insights-preset]").forEach((button) => {
      button.classList.remove("is-active");
      button.setAttribute("aria-pressed", "false");
    });
    hydrateInsights(getRestaurant(ACTIVE_CLIENT_SLUG), { refreshAfterLoad: true });
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
  const chartPoint = event.target.closest("[data-chart-point]");
  if (chartPoint) {
    showChartPointDetails(chartPoint);
    if (chartPoint.matches("[data-donut-segment]")) toggleDonutSegment(chartPoint);
    return;
  }
  const scrollButton = event.target.closest("[data-scroll-target]");
  if (scrollButton) {
    event.preventDefault();
    const target = document.getElementById(scrollButton.dataset.scrollTarget);
    if (!target) return;
    document.querySelectorAll("[data-scroll-target]").forEach((button) => button.classList.remove("active"));
    scrollButton.classList.add("active");
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
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

document.addEventListener("pointerover", (event) => {
  const chartPoint = event.target.closest("[data-chart-point]");
  if (chartPoint) showChartPointDetails(chartPoint);
});

document.addEventListener("focusin", (event) => {
  const chartPoint = event.target.closest("[data-chart-point]");
  if (chartPoint) showChartPointDetails(chartPoint);
});

document.addEventListener("keydown", (event) => {
  const chartPoint = event.target.closest(".chart-point[data-chart-point]");
  if (!chartPoint || !["Enter", " "].includes(event.key)) return;
  event.preventDefault();
  showChartPointDetails(chartPoint);
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
