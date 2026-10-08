const ASSETS = {
  qrstackMark: "assets/qrstack-mark.png",
  qrstackWordmark: "assets/qrstack-wordmark.png",
  pointDownEmoji: "assets/story/emoji-point-down-apple.png",
};

const QRSTACK_D1_API_URL = "https://qrstack-api.qrstack.workers.dev";
const QRSTACK_API_URL = QRSTACK_D1_API_URL;
const ACTIVE_CLIENT_SLUG = "amaro";
let OWNER_SESSION_TOKEN = "";
let ownerVerified = false;
let ownerAccessError = "";
let ownerResetToken = "";
const clientTokens = new Map();
const privateInsightsCache = new Map();
try {
  sessionStorage.removeItem("qrstack:owner-credential");
  OWNER_SESSION_TOKEN = sessionStorage.getItem("qrstack:owner-session") || "";
} catch {}
const STORY_AUTOMATION_ENABLED = true;
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
      originalLogoUrl: `${AMARO_ASSETS_BASE_URL}assets/amaro/amaro-logo-original.jpg`,
      storyLogoUrl: "assets/amaro/amaro-story-logo-original.png",
      storyBackgroundColor: "#bf8836",
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
const INSIGHTS_CACHE_KEY = "qrstack-insights-html-cache-v5-workspace";
const MENU_SUBMISSION_PREFIX = "qrstack:menu-submission:";
const insightsOpenedThisSession = new Set();
const app = document.getElementById("app");
let state = loadState();
let storyComposer = null;
const STORY_UPLOAD_MAX_BYTES = 15 * 1024 * 1024;
const STORY_MEDIA_MAX_BYTES = 6 * 1024 * 1024;
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
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Recife",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
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
  return publicPersistedState(parsedState);
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

function publicPersistedState(value) {
  const scrub = (entry) => {
    if (Array.isArray(entry)) return entry.map(scrub);
    if (!entry || typeof entry !== "object") return entry;
    return Object.fromEntries(Object.entries(entry).filter(([key]) => !/token|password|credential|secret|session|planAccess|admin|notes|messageTemplate|reminder/i.test(key)).map(([key, item]) => [key, scrub(item)]));
  };
  const menus = (value.menuDays || []).filter(menu => menu.isPublished);
  const ids = new Set(menus.map(menu => menu.id));
  return { restaurants: scrub(value.restaurants || []), menuDays: scrub(menus), menuItems: scrub((value.menuItems || []).filter(item => ids.has(item.menuDayId))), storyAssets: [], events: [] };
}

function saveState() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(publicPersistedState(state)));
    localStorage.removeItem(INSIGHTS_CACHE_KEY);
    for (let index = localStorage.length - 1; index >= 0; index--) {
      const key = localStorage.key(index);
      if ((key.startsWith("qrstack-platform-") && key !== STORE_KEY) || key.startsWith("qrstack-insights-") || /^qrstack:owner-(credential|session|access)$/.test(key)) localStorage.removeItem(key);
    }
  } catch {}
}

function insightsCacheId(restaurant, filters = {}) {
  return [
    restaurant?.slug || "restaurant",
    filters.startDate || "all",
    filters.endDate || "all",
  ].join(":");
}

function readInsightsCache() { return Object.fromEntries(privateInsightsCache); }

function getCachedInsightsHtml(restaurant, filters = {}) {
  if (isClientWorkspace() || !ownerVerified) return null;
  return privateInsightsCache.get(insightsCacheId(restaurant, filters)) || null;
}

function saveCachedInsightsHtml(restaurant, filters = {}, html = "") {
  if (isClientWorkspace() || !ownerVerified || !html) return;
  privateInsightsCache.set(insightsCacheId(restaurant, filters), { html, savedAt: new Date().toISOString() });
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

function apiCredentials(params = {}) {
  const headers = {};
  const client = params.token || "";
  const owner = params.key || params.owner_key || (!client && ownerVerified ? OWNER_SESSION_TOKEN : "");
  if (owner) headers["X-Owner-Session"] = owner;
  else if (client) headers["X-Client-Token"] = client;
  return headers;
}

async function apiResult(response) {
  let data;
  try { data = await response.json(); } catch { throw new Error("api_invalid_response"); }
  if (!response.ok || data.ok === false) {
    const error = new Error(data.error || "api_request_failed");
    error.retryAfter = Number(response.headers?.get?.("Retry-After") || data.retry_after || 0);
    if (response.status === 429) error.message = "too_many_attempts";
    if (response.status === 401 && OWNER_SESSION_TOKEN && !["invalid_password", "invalid_reset_token"].includes(data.error)) clearOwnerSession();
    throw error;
  }
  return data;
}

async function apiGet(action, params = {}) {
  if (!QRSTACK_API_URL) throw new Error("missing_api_url");
  const url = new URL(QRSTACK_API_URL);
  url.searchParams.set("action", action);
  Object.entries(params).forEach(([key, value]) => {
    if (["key", "owner_key", "token"].includes(key)) return;
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, value);
  });
  return apiResult(await fetchWithRetry(url.toString(), { cache: "no-store", referrerPolicy: "no-referrer", headers: apiCredentials(params) }, { timeoutMs: 15000, attempts: 1 }));
}

async function endpointGet(endpoint, action, params = {}) {
  if (!endpoint) throw new Error("missing_endpoint");
  const url = new URL(endpoint);
  const isProtected = params.key || params.owner_key || params.token || action === "getInsights";
  if (isProtected) {
    if (url.origin !== new URL(QRSTACK_API_URL).origin || url.pathname !== new URL(QRSTACK_API_URL).pathname) throw new Error("authenticated_endpoint_not_allowed");
    return apiGet(action, params);
  }
  url.searchParams.set("action", action);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, value);
  });
  return apiResult(await fetchWithRetry(url.toString(), { cache: "no-store", referrerPolicy: "no-referrer" }, { timeoutMs: 15000, attempts: 1 }));
}

async function apiPost(payload) {
  if (!QRSTACK_API_URL) throw new Error("missing_api_url");
  const { owner_key, key, ...data } = payload;
  const token = data.slug ? data.token : "";
  if (data.slug) delete data.token;
  const body = JSON.stringify(data);
  return apiResult(await fetchWithRetry(QRSTACK_API_URL, {
    method: "POST", cache: "no-store", referrerPolicy: "no-referrer",
    headers: { "Content-Type": "application/json", ...apiCredentials({ owner_key, key, token }) }, body,
  }, { timeoutMs: 20000, attempts: 1 }));
}

async function uploadCatalogImage(file, restaurant) {
  if (!QRSTACK_API_URL) throw new Error("missing_api_url");
  const optimized = await optimizeCatalogImage(file);
  const body = new FormData();
  body.set("slug", restaurant.slug);
  body.set("file", optimized, optimized.name);
  const url = new URL(QRSTACK_API_URL);
  url.searchParams.set("action", "uploadCatalogImage");
  const response = await fetchWithRetry(
    url.toString(),
    { method: "POST", body, referrerPolicy: "no-referrer", headers: apiCredentials({token: clientToken(restaurant)}) },
    { timeoutMs: 45000, attempts: 2 }
  );
  const text = await response.text();
  if (!text.trim().startsWith("{")) throw new Error("catalog_image_upload_invalid_response");
  const data = JSON.parse(text);
  if (!response.ok || data.ok === false || !data.image_url) {
    throw new Error(data.error || "catalog_image_upload_failed");
  }
  return data;
}

async function optimizeCatalogImage(file) {
  const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
  if (!file || !allowed.has(String(file.type || "").toLowerCase())) {
    throw new Error("catalog_image_type_not_allowed");
  }
  if (file.size > 15 * 1024 * 1024) throw new Error("catalog_image_source_too_large");
  if (typeof createImageBitmap !== "function") {
    if (file.size > 8 * 1024 * 1024) throw new Error("catalog_image_too_large");
    return file;
  }

  const bitmap = await createImageBitmap(file);
  try {
    const maxSide = 1600;
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: false });
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", 0.86));
    if (!blob) throw new Error("catalog_image_optimization_failed");
    const baseName = String(file.name || "foto-do-prato").replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 80);
    return new File([blob], `${baseName || "foto-do-prato"}.webp`, { type: "image/webp" });
  } finally {
    bitmap.close();
  }
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
    originalLogoUrl: row.original_logo_url || defaults.originalLogoUrl || "",
    storyLogoUrl: row.story_logo_url || defaults.storyLogoUrl || "",
    storyBackgroundColor: row.story_background_color || defaults.storyBackgroundColor || "",
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
  document.body.classList.toggle("public-mode", parts[0] === "r");
  document.getElementById("public-styles").disabled = parts[0] !== "r";
  document.body.classList.remove("navigation-open");
  window.scrollTo(0, 0);
  const params = new URLSearchParams(hashQuery || window.location.search);
  const source = resolveTrafficSource(params).source;

  if (parts[0] === "recuperar") return renderOwnerRecovery();
  if (parts[0] === "redefinir") {
    if (params.get("token")) { ownerResetToken = params.get("token"); removeAccessFromUrl("token"); }
    return renderOwnerReset();
  }
  ownerResetToken = "";
  if (!hash || parts[0] === "home") return renderHome();
  if (parts[0] === "hq" || parts[0] === "central") return renderOwnerRoute(parts[1] || "overview", params);
  if (parts[0] === "cliente" || parts[0] === "admin") return renderClientRoute(parts[1] || ACTIVE_CLIENT_SLUG, params, currentRouteVersion);
  if (parts[0] === "r") return renderPublicMenu(parts[1] || ACTIVE_CLIENT_SLUG, source, currentRouteVersion);
  renderHome();
}

function isCurrentRoute(version) {
  return version === routeVersion;
}

async function renderOwnerRoute(tab, params) {
  const version = routeVersion;
  if (!await hasOwnerAccess(params)) { if (isCurrentRoute(version)) renderOwnerGate(); return; }
  if (!isCurrentRoute(version)) return;
  return renderHq(tab);
}

async function renderClientRoute(slug, params, version) {
  const restaurant = await syncRestaurantFromApi(slug);
  if (!isCurrentRoute(version)) return;
  workspaceClientView = params.get("view") || "formulario";
  if (!await hasClientAccess(restaurant, params)) { if (isCurrentRoute(version)) renderClientGate(restaurant); return; }
  if (!isCurrentRoute(version)) return;
  return renderClientPortal(slug, version);
}

function clearOwnerSession() {
  OWNER_SESSION_TOKEN = "";
  ownerVerified = false;
  privateInsightsCache.clear();
  try { sessionStorage.removeItem("qrstack:owner-session"); sessionStorage.removeItem(OWNER_SESSION_KEY); } catch {}
}

function acceptOwnerSession(data) {
  if (!data.session_token || typeof data.session_token !== "string") throw new Error("invalid_owner_session");
  OWNER_SESSION_TOKEN = data.session_token;
  ownerVerified = true;
  try { sessionStorage.setItem("qrstack:owner-session", data.session_token); } catch {}
  rememberAccess(OWNER_SESSION_KEY);
}

function removeAccessFromUrl(param) {
  if (typeof history === "undefined") return;
  const clean = new URLSearchParams(location.hash.split("?")[1] || "");
  const search = new URLSearchParams(location.search || "");
  clean.delete(param);
  search.delete(param);
  history.replaceState(null, "", location.pathname + (search.size ? "?" + search : "") + location.hash.split("?")[0] + (clean.size ? "?" + clean : ""));
}

async function hasOwnerAccess(params = new URLSearchParams()) {
  const password = params.get("key");
  if (password) removeAccessFromUrl("key");
  if (!password && !OWNER_SESSION_TOKEN) return false;
  try {
    if (password) acceptOwnerSession(await apiPost({ action: "loginOwner", password }));
    else { await apiPost({ action: "verifyOwnerAccess", owner_key: OWNER_SESSION_TOKEN }); ownerVerified = true; }
    ownerAccessError = "";
    return true;
  } catch (error) {
    clearOwnerSession();
    ownerAccessError = error.message === "too_many_attempts" ? authRetryMessage(error) : "Não foi possível entrar. Confira a senha e tente novamente.";
    return false;
  }
}

function clientToken(restaurant) {
  const slug = restaurant?.slug;
  if (!slug) return "";
  if (clientTokens.has(slug)) return clientTokens.get(slug);
  try { return sessionStorage.getItem("qrstack:client-token:" + slug) || ""; } catch { return ""; }
}

async function hasClientAccess(restaurant, params = new URLSearchParams()) {
  const token = params.get("token") || clientToken(restaurant);
  if (params.get("token")) removeAccessFromUrl("token");
  if (!token && !OWNER_SESSION_TOKEN) return false;
  try {
    await apiPost({ action: "verifyClientAccess", slug: restaurant.slug, token, ...(!token && OWNER_SESSION_TOKEN ? {owner_key: OWNER_SESSION_TOKEN} : {}) });
    if (!token && OWNER_SESSION_TOKEN) ownerVerified = true;
    if (token) {
      clientTokens.set(restaurant.slug, token);
      try { sessionStorage.setItem("qrstack:client-token:" + restaurant.slug, token); } catch {}
    }
    rememberAccess(clientSessionKey(restaurant));
    return true;
  } catch {
    clientTokens.delete(restaurant.slug);
    try { sessionStorage.removeItem("qrstack:client-token:" + restaurant.slug); sessionStorage.removeItem(clientSessionKey(restaurant)); } catch {}
    return false;
  }
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
  return `#/hq/${tab}`;
}

function clientPortalLink(restaurant) {
  return `#/cliente/${encodeURIComponent(restaurant.slug)}?portal=1`;
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

async function syncCatalogForRestaurant(restaurant, { fresh = false } = {}) {
  let catalog = [];
  try {
    const endpoint = restaurant.analyticsEndpoint || QRSTACK_D1_API_URL;
    const data = await endpointGet(endpoint, "getCatalog", {
      slug: restaurant.slug,
      ...(fresh ? { fresh: Date.now() } : {}),
    });
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
  const eventId = crypto.randomUUID();
  state.events.push({
    id: eventId,
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
    id: eventId,
    slug: restaurant.slug,
    menu_day_id: menuDayId || "",
    event_type: eventType,
    ...traffic,
  }).catch((error) => console.warn("QrStack event API unavailable:", error.message));
}

function renderHome() {
  setSystemTheme();
  const restaurant = getRestaurant(ACTIVE_CLIENT_SLUG);
  const owner = hasRememberedAccess(OWNER_SESSION_KEY);
  const client = hasRememberedAccess(clientSessionKey(restaurant));
  app.innerHTML = `
    <div class="access-screen">
      <header>${workspaceBrand()}<span>Seu negócio. Mais conectado.</span></header>
      <main class="access-content">
        <p class="eyebrow">Bem-vindo à QrStack</p>
        <h1>Seu próximo passo<br>começa aqui.</h1>
        <p class="muted">Escolha o seu espaço de trabalho.</p>
        <div class="access-options">
          <a href="${owner ? ownerLink() : "#/hq"}">${uiIcon("chart-no-axes-combined")}<span><strong>Central QrStack</strong><small>Gestão e resultados dos restaurantes</small></span>${uiIcon("arrow-up-right")}</a>
          <a href="${client ? clientPortalLink(restaurant) : "#/cliente/" + restaurant.slug}">${uiIcon("store")}<span><strong>Sou restaurante</strong><small>Cardápio do dia e catálogo de pratos</small></span>${uiIcon("arrow-up-right")}</a>
          <a href="${publicMenuHash(restaurant, "platform")}">${uiIcon("utensils")}<span><strong>Ver o cardápio</strong><small>${escapeHtml(restaurant.name)}</small></span>${uiIcon("arrow-up-right")}</a>
        </div>
      </main>
      <footer>QrStack Workspace <span>Cardápios. Conexões. Resultados.</span></footer>
    </div>`;
}

function renderPasswordInput(id, name, label, { autocomplete = "new-password", purpose = "", describedBy = "", placeholder = "" } = {}) {
  const visibilityLabel = label === "Confirmar nova senha" ? "confirmação da nova senha" : label.toLowerCase();
  return `<label for="${id}">${label}</label><div class="password-input">
    <input id="${id}" name="${name}" type="password" autocomplete="${autocomplete}" maxlength="128" required data-password-input
      ${purpose ? `data-password-${purpose} minlength="8"` : ""} ${describedBy ? `aria-describedby="${describedBy}"` : ""} ${placeholder ? `placeholder="${placeholder}"` : ""} />
    <button type="button" class="password-toggle" data-password-toggle aria-controls="${id}" aria-label="Mostrar ${visibilityLabel}" aria-pressed="false">Mostrar</button>
  </div>`;
}

function passwordFeedback(password, confirmation) {
  const valid = password.length >= 8 && password.length <= 128 && password === password.trim();
  return { valid, matches: valid && confirmation === password,
    error: !valid ? "Use de 8 a 128 caracteres, sem espaços no início ou no fim." : confirmation !== password ? "A confirmação precisa ser igual à nova senha." : "" };
}

function updatePasswordFeedback(form) {
  const password = form?.querySelector("[data-password-new]");
  const confirmation = form?.querySelector("[data-password-confirm]");
  if (!password || !confirmation) return true;
  const result = passwordFeedback(password.value, confirmation.value);
  const rules = form.querySelector("[data-password-rules]");
  const match = form.querySelector("[data-password-match]");
  rules.dataset.state = !password.value ? "idle" : result.valid ? "valid" : "invalid";
  rules.textContent = !password.value ? "Mínimo de 8 caracteres. Caracteres especiais são opcionais." : result.valid ? "Comprimento válido. Caracteres especiais são opcionais." : "Use de 8 a 128 caracteres, sem espaços no início ou no fim.";
  match.dataset.state = !confirmation.value ? "idle" : result.matches ? "valid" : "invalid";
  match.textContent = !confirmation.value ? "Repita a nova senha para confirmar." : result.matches ? "As senhas coincidem." : "As senhas ainda não coincidem.";
  password.setAttribute("aria-invalid", String(Boolean(password.value) && !result.valid));
  confirmation.setAttribute("aria-invalid", String(Boolean(confirmation.value) && !result.matches));
  password.setCustomValidity(password.value && !result.valid ? "Use de 8 a 128 caracteres, sem espaços no início ou no fim." : "");
  confirmation.setCustomValidity(confirmation.value && !result.matches ? "A confirmação precisa ser igual à nova senha." : "");
  return result.matches;
}

function setPasswordVisibility(input, visible) {
  input.type = visible ? "text" : "password";
  const button = input.closest(".password-input").querySelector("[data-password-toggle]");
  button.textContent = visible ? "Ocultar" : "Mostrar";
  button.setAttribute("aria-pressed", String(visible));
  button.setAttribute("aria-label", button.getAttribute("aria-label").replace(/^(Mostrar|Ocultar)/, visible ? "Ocultar" : "Mostrar"));
}

function hidePasswords(root = document) {
  root.querySelectorAll("[data-password-input]").forEach(input => setPasswordVisibility(input, false));
}

document.addEventListener("input", event => {
  if (event.target.matches("[data-password-new], [data-password-confirm]")) updatePasswordFeedback(event.target.form);
});
document.addEventListener("change", event => {
  if (event.target.matches("[data-password-new], [data-password-confirm]")) updatePasswordFeedback(event.target.form);
});
document.addEventListener("keydown", event => { if (event.key === "Escape") hidePasswords(); });
document.addEventListener("visibilitychange", () => { if (document.hidden) hidePasswords(); });
window.addEventListener("blur", () => hidePasswords());

function renderOwnerGate() {
  setSystemTheme();
  app.innerHTML = `
    <section class="entry-screen entry-screen--gate">
      <div class="access-panel">
        <img class="access-panel__logo" src="${ASSETS.qrstackWordmark}" alt="QrStack" />
        <p class="eyebrow">Acesso interno</p>
        <h1>Central QrStack</h1>
        <p>Informe sua senha para abrir o ambiente de gestão.</p>
        <form class="access-form" data-owner-access>
          ${renderPasswordInput("owner-access-key", "ownerAccessKey", "Senha da gestão", { autocomplete: "current-password", placeholder: "Digite sua senha" })}
          <div class="actions">
            <button type="submit">Entrar na Central</button>
            <a class="button secondary" href="#/home">Voltar ao início</a>
            <a href="#/recuperar">Esqueci minha senha</a>
          </div>
        </form>
      </div>
    </section>
  `;
}

function renderOwnerRecovery() {
  setSystemTheme();
  app.innerHTML = `<section class="entry-screen entry-screen--gate"><div class="access-panel">
    <img class="access-panel__logo" src="${ASSETS.qrstackWordmark}" alt="QrStack" />
    <h1>Recuperar acesso</h1><p>Informe o e-mail cadastrado para receber as instruções de redefinição.</p>
    <form class="access-form" data-owner-recovery><label for="recovery-email">E-mail</label>
      <input id="recovery-email" name="email" type="email" autocomplete="email" maxlength="254" required />
      <button type="submit">Enviar instruções</button><p data-auth-status role="status" aria-live="polite"></p>
    </form><a href="#/hq">Voltar ao acesso da gestão</a>
  </div></section>`;
}

function renderOwnerReset() {
  setSystemTheme();
  const content = ownerResetToken ? `<p>Escolha uma nova senha exclusiva para sua gestão.</p>
    <form class="access-form" data-owner-reset>
      ${renderPasswordInput("reset-password", "password", "Nova senha", { purpose: "new", describedBy: "reset-guidance" })}
      <p id="reset-guidance" class="password-feedback" data-password-rules data-state="idle" aria-live="polite">Mínimo de 8 caracteres. Caracteres especiais são opcionais.</p>
      ${renderPasswordInput("reset-confirmation", "confirmation", "Confirmar nova senha", { purpose: "confirm", describedBy: "reset-match" })}
      <p id="reset-match" class="password-feedback" data-password-match data-state="idle" role="status" aria-live="polite">Repita a nova senha para confirmar.</p>
      <button type="submit">Salvar nova senha</button><p data-auth-status role="status" aria-live="polite"></p>
    </form>` : `<p>Abra o link recebido por e-mail. Se ele expirou, solicite novas instruções.</p><a class="button" href="#/recuperar">Solicitar novo link</a>`;
  app.innerHTML = `<section class="entry-screen entry-screen--gate"><div class="access-panel"><img class="access-panel__logo" src="${ASSETS.qrstackWordmark}" alt="QrStack" /><h1>Redefinir senha</h1>${content}<a href="#/hq">Voltar ao acesso da gestão</a></div></section>`;
}

async function requestOwnerRecovery(email) {
  return apiPost({ action: "requestOwnerPasswordReset", email });
}

async function completeOwnerRecovery(password) {
  if (!ownerResetToken) throw new Error("invalid_reset_token");
  const result = await apiPost({ action: "resetOwnerPassword", token: ownerResetToken, new_password: password });
  ownerResetToken = "";
  clearOwnerSession();
  return result;
}

function authRetryMessage(error) {
  const seconds = Number(error?.retryAfter || 0);
  return seconds > 0 ? `Muitas tentativas. Aguarde ${Math.max(1, Math.ceil(seconds / 60))} minuto(s) antes de tentar novamente.` : "Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.";
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
          <input id="client-access-token" name="clientAccessToken" type="password" autocomplete="off" placeholder="Cole o token ou link do restaurante" />
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
  const titles = { overview: "Visão geral", clientes: "Restaurantes", respostas: "Respostas", banco: "Pratos e marca", cardapios: "Cardápios e links", insights: "Insights", stories: "Stories", senha: "Minha senha" };
  if (!titles[tab] || (tab === "stories" && !STORY_AUTOMATION_ENABLED)) tab = "overview";
  const restaurant = state.restaurants[0];
  const content = {
    overview: renderHqOverview,
    clientes: () => renderHqClients(state.restaurants),
    respostas: renderHqResponses,
    banco: renderHqCatalogBank,
    cardapios: renderHqPublicMenus,
    insights: renderHqInsights,
    stories: renderHqStories,
    senha: renderOwnerPassword,
  }[tab]();
  app.innerHTML = renderWorkspace({
    active: tab, title: titles[tab], restaurant, content,
    subtitle: { overview: "Bem-vindo de volta. Vamos acompanhar o que importa.", insights: "Entenda cada acesso. Encontre a próxima oportunidade.", banco: "O catálogo e a identidade de cada restaurante.", respostas: "Publicações recebidas pela plataforma e pelo Google Forms." }[tab] || "",
    actions: tab === "insights" ? `<a class="button secondary" href="${publicMenuHash(restaurant, "hq")}">${uiIcon("external-link")}Ver cardápio</a>` : "",
  });
  if (tab === "insights") {
    setWorkspaceInsightsView();
    const refreshAfterLoad = !insightsOpenedThisSession.has(restaurant.slug);
    insightsOpenedThisSession.add(restaurant.slug);
    hydrateInsights(restaurant, { refreshAfterLoad });
  }
  if (tab === "overview") hydrateWorkspaceOverview();
  if (tab === "respostas") hydrateMenuResponses();
  if (tab === "banco") hydrateWorkspaceCatalog();
  if (tab === "stories") attachStoryAccountHandlers();
  if (tab === "clientes") hydrateClientPlans();
  if (tab === "senha") attachOwnerPasswordHandler();
}

function renderOwnerPassword() {
  return `<section class="owner-password-card"><h2>Alterar senha da gestão</h2>
    <p>Escolha uma senha exclusiva para seu acesso à Central QrStack.</p>
    <form data-owner-password class="owner-password-form">
      ${renderPasswordInput("current-password", "currentPassword", "Senha atual", { autocomplete: "current-password" })}
      ${renderPasswordInput("new-password", "newPassword", "Nova senha", { purpose: "new", describedBy: "password-guidance" })}
      <p id="password-guidance" class="password-feedback" data-password-rules data-state="idle" aria-live="polite">Mínimo de 8 caracteres. Caracteres especiais são opcionais.</p>
      ${renderPasswordInput("confirm-password", "confirmPassword", "Confirmar nova senha", { purpose: "confirm", describedBy: "password-match" })}
      <p id="password-match" class="password-feedback" data-password-match data-state="idle" role="status" aria-live="polite">Repita a nova senha para confirmar.</p>
      <button type="submit">Salvar nova senha</button>
      <p data-password-status role="status" aria-live="polite"></p>
    </form>
    <p>A senha anterior e os links que a contêm deixarão de funcionar. Nos outros dispositivos, entre novamente com a nova senha.</p>
    <p>O acesso dos restaurantes permanece igual.</p>
  </section>`;
}

async function updateOwnerPassword(currentPassword, newPassword) {
  // Never automatically replay a credential mutation after an ambiguous network failure.
  const response = await fetchWithRetry(QRSTACK_API_URL, {
    method: "POST", cache: "no-store", referrerPolicy: "no-referrer", headers: { "Content-Type": "application/json", "X-Owner-Session": OWNER_SESSION_TOKEN },
    body: JSON.stringify({ action: "changeOwnerPassword", current_password: currentPassword, new_password: newPassword }),
  }, { timeoutMs: 20000, attempts: 1 });
  const result = await apiResult(response);
  acceptOwnerSession(result);
  return result;
}

function attachOwnerPasswordHandler() {
  const form = document.querySelector("[data-owner-password]");
  if (!form) return;
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const current = form.elements.currentPassword.value;
    const next = form.elements.newPassword.value;
    const status = form.querySelector("[data-password-status]");
    if (!updatePasswordFeedback(form)) { status.textContent = passwordFeedback(next, form.elements.confirmPassword.value).error; form.reportValidity(); return; }
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    hidePasswords(form);
    status.textContent = "Salvando sua nova senha...";
    try {
      await updateOwnerPassword(current, next);
      form.reset();
      updatePasswordFeedback(form);
      status.textContent = "Senha alterada. Você continua conectado aqui. Use a nova senha nos próximos acessos.";
    } catch (error) {
      const messages = {
        unauthorized: "A senha atual está incorreta. Confira e tente novamente.",
        invalid_new_password: "Use de 8 a 128 caracteres, sem espaços no início ou no fim. Caracteres especiais são opcionais.",
        password_unchanged: "Escolha uma senha diferente da atual.",
        credential_changed: "A senha foi alterada em outro acesso. Entre novamente com a senha mais recente.",
        too_many_attempts: "Muitas tentativas. Aguarde cinco minutos antes de tentar novamente.",
      };
      status.textContent = messages[error.message] || "Não foi possível confirmar a troca. Tente entrar com a nova senha antes de repetir a alteração.";
    } finally { button.disabled = false; }
  });
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
  return renderWorkspaceOverview();
}

function renderHqClients(restaurants) {
  return `<section class="workspace-restaurants"><div class="section-title-row"><h2>Restaurantes cadastrados</h2><span>${restaurants.length} ${restaurants.length === 1 ? "restaurante" : "restaurantes"}</span></div><div id="client-plans">Carregando planos...</div></section>`;
}

const CLIENT_PLANS = {
  cardapio: { name: "RSTACK CARDÁPIO", description: "Cardápio digital com atualização diária, QR Code e link compartilhável." },
  divulgacao: { name: "QRSTACK DIVULGAÇÃO", description: "Tudo do Cardápio + Story com a identidade do restaurante para baixar e link para copiar no Instagram." },
  performance: { name: "QRSTACK PERFORMANCE", description: "Tudo do Divulgação + postagem automática de Story e dashboard de acessos do cardápio." },
};
function isClientWorkspace() { return /^#\/(cliente|admin)\//.test(location.hash || ""); }
function currentWorkspaceRestaurant() { return isClientWorkspace() ? workspacePortalRestaurant : getRestaurant(ACTIVE_CLIENT_SLUG); }
function clientFeature(restaurant, feature) { return restaurant?.planAccess?.features?.[feature] === true; }
function renderPlanLock(feature, plan) {
  return `<div class="plan-lock"><span class="status-pill">Disponível no ${escapeHtml(CLIENT_PLANS[plan].name)}</span><h3>${escapeHtml(feature)}</h3><p>${escapeHtml(CLIENT_PLANS[plan].description)}</p><p>Fale com a QrStack para alterar seu plano.</p></div>`;
}
async function syncClientPlan(restaurant) {
  restaurant.planAccess = null;
  try {
    const data = await apiGet("getRestaurantPlan", { slug: restaurant.slug, token: clientToken(restaurant) });
    restaurant.planAccess = data.entitlement;
  } catch { /* Fail closed for paid features; the menu remains available. */ }
  return restaurant.planAccess;
}
async function hydrateClientPlans() {
  const target = document.getElementById("client-plans");
  if (!target) return;
  try {
    const data = await apiGet("listRestaurantPlans", { key: OWNER_SESSION_TOKEN });
    if (!target.isConnected) return;
    const count = target.parentElement.querySelector(".section-title-row span");
    if (count) count.textContent = `${data.restaurants.length} ${data.restaurants.length === 1 ? "restaurante" : "restaurantes"}`;
    target.innerHTML = data.restaurants.map(row => {
      const restaurant = fromSheetRestaurant(row);
      upsertById(state.restaurants, restaurant);
      const plan = Object.hasOwn(CLIENT_PLANS, row.plan) ? row.plan : "cardapio";
      return `<article class="client-plan-card">${renderRestaurantRow(restaurant)}<form data-client-plan="${escapeAttr(row.slug)}"><label for="plan-${escapeAttr(row.slug)}">Plano do cliente</label><div class="actions"><select id="plan-${escapeAttr(row.slug)}" name="plan">${Object.entries(CLIENT_PLANS).map(([key, value]) => `<option value="${key}" ${key === plan ? "selected" : ""}>${value.name}</option>`).join("")}</select><button type="submit">Salvar plano</button></div><p data-plan-description>${CLIENT_PLANS[plan].description}</p><p data-plan-status role="status">Plano atual: ${CLIENT_PLANS[plan].name}</p></form></article>`;
    }).join("");
    target.querySelectorAll("[data-client-plan]").forEach(form => {
      form.elements.plan.addEventListener("change", () => { form.querySelector("[data-plan-description]").textContent = CLIENT_PLANS[form.elements.plan.value].description; });
      form.addEventListener("submit", async event => {
        event.preventDefault();
        const button = form.querySelector("button");
        const status = form.querySelector("[data-plan-status]");
        button.disabled = true;
        try {
          const response = await apiPost({ action: "setRestaurantPlan", owner_key: OWNER_SESSION_TOKEN, slug: form.dataset.clientPlan, plan: form.elements.plan.value });
          status.textContent = `Plano salvo: ${response.entitlement.name}. Os acessos do cliente foram atualizados.`;
        } catch { status.textContent = "Não foi possível confirmar a alteração. Reabra a lista para conferir o plano salvo."; }
        finally { button.disabled = false; }
      });
    });
  } catch { if (target.isConnected) target.textContent = "Não foi possível consultar os planos. Reabra a gestão para tentar novamente."; }
}

function renderHqResponses() {
  return `
    <section class="section">
      <div class="section__head">
        <p class="eyebrow">Formulários</p>
        <h2>Respostas recebidas</h2>
        <p>Envios da plataforma e do Google Forms aparecem em uma única linha do tempo, sem duplicar datas já registradas no D1.</p>
      </div>
      <div class="response-list" id="responses-live"><p class="muted">Sincronizando respostas reais...</p></div>
    </section>
  `;
}

function responseSourceLabel(source) {
  if (source === "google_forms") return "Google Forms";
  if (source === "platform") return "Plataforma QrStack";
  if (source === "d1") return "D1";
  return "Origem registrada";
}

function renderMenuResponseRows(records) {
  const restaurant = getRestaurant(ACTIVE_CLIENT_SLUG);
  if (!records.length) return "<p class='muted'>Nenhuma resposta registrada.</p>";
  return records.map((record) => {
    const menu = record.menu || {};
    const items = Array.isArray(record.items) ? record.items : [];
    return `
      <article class="response-card">
        <div>
          <p class="eyebrow">${escapeHtml(responseSourceLabel(record.response_source))}</p>
          <h3>${escapeHtml(menu.title || "Almoço de Hoje")}</h3>
          <p class="muted">${formatDate(menu.date)} • ${escapeHtml(menu.service_hours || "Horário não informado")} • ${items.length} itens</p>
        </div>
        <div class="response-card__items">
          ${items.map((item) => `<span>${escapeHtml(item.name)}${item.price ? ` • ${escapeHtml(item.price)}` : ""}</span>`).join("")}
        </div>
        ${menu.notes ? `<p class="muted">${escapeHtml(menu.notes)}</p>` : ""}
        <div class="actions">
          <a class="button secondary" href="${clientPortalLink(restaurant)}">Abrir formulário</a>
          <a class="button ghost" href="${publicMenuHash(restaurant, "hq")}">Ver cardápio</a>
        </div>
      </article>
    `;
  }).join("");
}

function localMenuResponseRecords() {
  return state.menuDays.map((menu) => ({
    menu: {
      ...menu,
      restaurant_id: menu.restaurantId,
      service_hours: menu.serviceHours,
      story_link: menu.storyLink,
      updated_at: menu.updatedAt,
    },
    items: getMenuItems(menu.id),
    response_source: "local",
  }));
}

async function hydrateMenuResponses() {
  const target = document.getElementById("responses-live");
  if (!target) return;
  try {
    const data = await apiGet("getMenuResponses", { slug: ACTIVE_CLIENT_SLUG, key: OWNER_SESSION_TOKEN, fresh: Date.now() });
    target.innerHTML = renderMenuResponseRows(Array.isArray(data.responses) ? data.responses : []);
  } catch (error) {
    console.warn("QrStack response history unavailable:", error.message);
    target.innerHTML = renderMenuResponseRows(localMenuResponseRecords());
    target.insertAdjacentHTML("afterbegin", "<p class='muted'>Mostrando o cache local enquanto a sincronização é retomada.</p>");
  }
}

function renderHqStories() {
  const stories = state.storyAssets
    .slice()
    .reverse()
    .map((story) => {
      const restaurant = state.restaurants.find((rest) => rest.id === story.restaurantId);
      return `
        <div class="table-row">
          <span><strong>${escapeHtml(restaurant?.name || "Cliente")}</strong><br><span class="muted">${formatDateTime(story.createdAt)}</span></span>
          <span>${escapeHtml(story.templateName)}</span>
        </div>
      `;
    })
    .join("");
  return `
    <section class="section">
      <div class="section__head">
        <p class="eyebrow">Stories</p>
        <h2>Stories dos restaurantes</h2>
        <p>Prepare uma imagem enviada ou gere uma arte com a identidade do restaurante. A publicação é feita pelo publicador QrStack na conta vinculada.</p>
      </div>
      <div class="grid">
        ${state.restaurants
          .map(
            (restaurant) => `
              <article class="card story-brand-card" data-story-account-card="${escapeAttr(restaurant.slug)}">
                <div class="brand-swatch">
                  <span style="background:${restaurant.primaryColor}"></span>
                  <span style="background:${restaurant.secondaryColor}"></span>
                  <img src="${restaurant.logoUrl}" alt="${restaurant.name}" />
                </div>
                <h3>${escapeHtml(restaurant.name)}</h3>
                <p class="muted">Use logo e cores do restaurante ou envie sua própria imagem.</p>
                <div class="actions">
                  <a class="button" href="${clientPortalLink(restaurant)}&view=story-panel">Preparar Story</a>
                </div>
                <p class="story-account-summary" data-story-account-summary role="status">Consultando a conta vinculada...</p>
                <details class="story-account-settings"><summary>Configurar conta de publicação</summary>
                  <form class="form-grid" data-story-account-form="${escapeAttr(restaurant.slug)}">
                    <div class="field field--full"><label>Identificador do publicador<input name="publisher_id" required maxlength="160" autocomplete="off" /></label></div>
                    <div class="field"><label>Usuário do Instagram<input name="instagram_username" required maxlength="30" placeholder="restaurante" autocomplete="off" /></label></div>
                    <div class="field"><label>ID da conta Instagram<input name="instagram_user_id" required inputmode="numeric" pattern="[0-9]+" autocomplete="off" /></label></div>
                    <label class="story-checkbox field--full"><input type="checkbox" name="enabled" /> Habilitar publicação nesta conta</label>
                    <p class="muted field--full">Use os dados da conta já conectada no publicador. Credenciais de login são configuradas no servidor.</p>
                    <div class="actions field--full"><button type="submit" disabled>Salvar vínculo</button></div>
                  </form>
                </details>
              </article>
            `
          )
          .join("")}
      </div>
      <div class="card table">${stories || "<p class='muted'>Nenhuma arte preparada neste navegador ainda.</p>"}</div>
    </section>
  `;
}

function renderHqCatalogBank() {
  return renderWorkspaceCatalog();
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
  return renderWorkspaceLinks();
}

function renderHqInsights() {
  return `
    <section class="insights-page">
      <form class="insights-filter" data-insights-filter>
        <div class="insights-filter__presets" aria-label="Períodos">
          ${[["today", "Hoje"], ["7", "7 dias"], ["30", "30 dias"], ["all", "Todos"]].map(([value, label]) => `<button type="button" data-insights-preset="${value}" class="${value === "all" ? "is-active" : ""}" aria-pressed="${value === "all"}">${label}</button>`).join("")}
        </div>
        <div class="insights-filter__dates">
          <label><span>De</span><input type="date" name="startDate" aria-label="Data inicial" /></label>
          <label><span>Até</span><input type="date" name="endDate" aria-label="Data final" /></label>
          <button type="submit">${uiIcon("refresh-cw")}Aplicar</button>
        </div>
      </form>
      <div class="insights-tabs" role="tablist" aria-label="Análises">
        ${[["overview", "Visão geral"], ["audience", "Público e origens"], ["dishes", "Pratos"], ["technical", "Diagnóstico"]].map(([id, label]) => `<button type="button" role="tab" id="tab-${id}" aria-controls="panel-${id}" data-insight-view="${id}">${label}</button>`).join("")}
      </div>
      <div id="insights-live" class="insights-dashboard" aria-live="polite">${renderWorkspaceLoading("Carregando os dados do restaurante...")}</div>
    </section>`;
}

function renderStoryComposer(restaurant, storyLink) {
  if (!clientFeature(restaurant, "story")) return `<section class="section client-step" id="story-panel">${renderPlanLock("Stories com a identidade do restaurante", "divulgacao")}</section>`;
  return `<section class="section client-step" id="story-panel">
    <div class="section__head"><p class="eyebrow">Instagram Stories</p><h2>Prepare sua publicação</h2><p class="muted">${clientFeature(restaurant, "autopublish") ? "Escolha a imagem, confira a prévia e publique na conta do restaurante." : "Prepare a arte, baixe a imagem e copie o link para compartilhar no Instagram."}</p></div>
    <div class="story-workbench">
      <div class="story-controls">
        <div class="story-account-summary" id="story-publishing-account" role="status">Consultando a conta vinculada...</div>
        <fieldset class="story-source-options"><legend>Imagem do Story</legend>
          <label><input type="radio" name="storyImageSource" value="auto" checked /><span><strong>Gerar automaticamente</strong><small>Logo e cores de ${escapeHtml(restaurant.name)}.</small></span></label>
          <label><input type="radio" name="storyImageSource" value="upload" /><span><strong>Enviar imagem</strong><small>Escolha uma arte ou foto do seu dispositivo.</small></span></label>
        </fieldset>
        <div class="field" id="story-upload-field" hidden><label for="story-image-file">Imagem</label><input id="story-image-file" type="file" name="storyImageFile" accept="image/jpeg,image/png,image/webp" /><small class="muted">JPG, PNG ou WebP, até 15 MB. A imagem inteira será ajustada a 1080 × 1920, com fundo da marca quando necessário.</small></div>
        <div class="field"><label for="storyLink">Link do sticker</label><input id="storyLink" name="storyLink" type="url" value="${escapeAttr(storyLink)}" placeholder="https://seu-cardapio.com" required /><small class="muted">${clientFeature(restaurant, "autopublish") ? "O publicador adiciona o sticker clicável com este endereço HTTPS." : "Copie este endereço e cole no sticker de link ao criar seu Story no Instagram."}</small></div>
        <p id="story-image-status" class="story-image-status" role="status">Preparando a imagem...</p>
        <div class="actions"><button type="button" id="publish-story" ${clientFeature(restaurant, "autopublish") ? "" : "hidden"} disabled>Publicar Story</button><button type="button" class="secondary" id="download-story" disabled>Baixar imagem</button><button type="button" class="secondary" data-copy-input="storyLink">Copiar link para Instagram</button><button type="button" class="ghost" id="refresh-story-publishing" ${clientFeature(restaurant, "autopublish") ? "" : "hidden"}>Atualizar conta</button></div>
        <p id="story-publish-hint" class="muted">Aguarde a imagem e a verificação da conta.</p>
        <div class="story-automation-status" id="story-automation-status" aria-live="polite"><span class="status-pill">Prévia</span><p>Seu Story será enviado quando você clicar em Publicar Story.</p></div>
      </div>
      <figure class="story-preview"><div class="story-frame"><canvas id="story-canvas" width="1080" height="1920" aria-label="Prévia da imagem do Story"></canvas></div><figcaption>Prévia 9:16 · O sticker será adicionado pelo Instagram.</figcaption></figure>
    </div>
  </section>`;
}

function storyPublishingReady(publishing) {
  return publishing?.provider === "private_api" && publishing.enabled === true && publishing.state === "ready"
    && Boolean(publishing.publisher_id && publishing.instagram_username && publishing.instagram_user_id);
}

function storyPublishingDescription(publishing) {
  if (publishing?.state === "plan_required") return "Postagem automática disponível no QRSTACK PERFORMANCE.";
  const account = publishing?.instagram_username ? `@${publishing.instagram_username}` : "Nenhuma conta vinculada";
  const states = { unconfigured: "Configure a conta na central QrStack.", disabled: "Publicação desabilitada.", ready: "Pronta para publicar.", outcome_unknown: "Há uma publicação com resultado incerto. Confira o Instagram e resolva no publicador antes de continuar.", publisher_inactive: "Publicador indisponível." };
  return `${account} — ${states[publishing?.state] || "Não foi possível verificar a conta. Atualize para tentar novamente."}`;
}

function storyComposerIsCurrent(draft) {
  return Boolean(draft && storyComposer === draft && draft.panel.isConnected && document.getElementById("story-panel") === draft.panel);
}

function validateStoryLink(value) {
  let url;
  try { url = new URL(String(value || "").trim()); } catch { throw new Error("invalid_story_link"); }
  if (url.protocol !== "https:" || !url.hostname || url.username || url.password) throw new Error("invalid_story_link");
  return url.toString();
}

function validateStoryUpload(file) {
  if (!file || !["image/jpeg", "image/png", "image/webp"].includes(String(file.type || "").toLowerCase())) throw new Error("story_upload_type");
  if (!file.size || file.size > STORY_UPLOAD_MAX_BYTES) throw new Error("story_upload_size");
}

function storyContainRect(width, height) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1 || width * height > 40000000) throw new Error("story_upload_dimensions");
  const scale = Math.min(1080 / width, 1920 / height);
  return { x: (1080 - width * scale) / 2, y: (1920 - height * scale) / 2, width: width * scale, height: height * scale };
}

async function storyPublicationKey(slug, menuId, dataUrl, storyLink) {
  const value = JSON.stringify([String(slug), String(menuId), String(dataUrl), validateStoryLink(storyLink)]);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return `story:${[...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function updateStoryControls(draft) {
  if (!storyComposerIsCurrent(draft)) return;
  let linkValid = true;
  try { validateStoryLink(draft.panel.querySelector('[name="storyLink"]').value); } catch { linkValid = false; }
  const ready = clientFeature(draft.restaurant, "autopublish") && storyPublishingReady(draft.publishing);
  const canPublish = ready && draft.media && linkValid && !draft.busy && !draft.locked && !draft.rendering;
  draft.panel.querySelector("#publish-story").disabled = !canPublish;
  draft.panel.querySelector("#download-story").disabled = !draft.media || draft.rendering;
  draft.panel.querySelector("#refresh-story-publishing").disabled = draft.busy;
  draft.panel.querySelectorAll('[name="storyImageSource"], #story-image-file, [name="storyLink"]').forEach((input) => { input.disabled = draft.busy; });
  draft.panel.querySelector("#story-publish-hint").textContent = draft.busy ? "Enviando esta publicação..."
    : draft.locked ? "Aguarde a conclusão ou resolva a publicação anterior antes de enviar outra."
    : !clientFeature(draft.restaurant, "autopublish") ? "Seu plano inclui baixar a imagem e copiar o link. A postagem automática está disponível no QRSTACK PERFORMANCE."
    : !ready ? "Você pode preparar e baixar a imagem. A publicação aguarda uma conta habilitada na central QrStack."
    : !linkValid ? "Informe um link HTTPS válido para o sticker."
    : !draft.media || draft.rendering ? "Prepare uma imagem antes de publicar."
    : `Ao publicar, este Story será enviado para @${draft.publishing.instagram_username}.`;
}

function initializeStoryComposer(restaurant, menu) {
  const panel = document.getElementById("story-panel");
  if (!panel || !clientFeature(restaurant, "story")) return;
  const draft = { panel, restaurant, menu, mode: "auto", file: null, media: null, publishing: null, renderVersion: 0, pollVersion: 0, busy: false, locked: false, rendering: false };
  storyComposer = draft;
  panel.querySelectorAll('[name="storyImageSource"]').forEach((input) => input.addEventListener("change", () => {
    draft.mode = input.value;
    panel.querySelector("#story-upload-field").hidden = draft.mode !== "upload";
    prepareStoryImage(draft);
  }));
  panel.querySelector("#story-image-file").addEventListener("change", (event) => {
    draft.file = event.currentTarget.files?.[0] || null;
    prepareStoryImage(draft);
  });
  panel.querySelector('[name="storyLink"]').addEventListener("input", () => prepareStoryImage(draft));
  panel.querySelector("#refresh-story-publishing").addEventListener("click", () => refreshStoryPublishing(draft));
  panel.querySelector("#download-story").addEventListener("click", () => {
    if (!draft.media || !storyComposerIsCurrent(draft)) return;
    const link = document.createElement("a");
    link.href = draft.media.dataUrl;
    link.download = `story-${restaurant.slug}-${todayIso()}.jpg`;
    link.click();
    trackEvent(restaurant, "story_downloaded", "admin", draft.menu.id);
  });
  panel.querySelector("#publish-story").addEventListener("click", () => publishPreparedStory(draft));
  prepareStoryImage(draft);
  refreshStoryPublishing(draft);
}

async function prepareStoryImage(draft) {
  if (!storyComposerIsCurrent(draft)) return;
  const version = ++draft.renderVersion;
  draft.media = null;
  draft.rendering = true;
  draft.panel.querySelector("#story-canvas").getContext("2d").clearRect(0, 0, 1080, 1920);
  const status = draft.panel.querySelector("#story-image-status");
  status.textContent = draft.mode === "upload" && !draft.file ? "Escolha uma imagem para continuar." : "Preparando a imagem...";
  updateStoryControls(draft);
  try {
    if (draft.mode === "upload" && !draft.file) return;
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1920;
    const menu = { ...draft.menu, storyLink: draft.panel.querySelector('[name="storyLink"]').value.trim() };
    if (draft.mode === "upload") {
      validateStoryUpload(draft.file);
      const objectUrl = URL.createObjectURL(draft.file);
      try {
        const image = await loadCanvasImage(objectUrl);
        if (!image) throw new Error("story_upload_decode");
        const rect = storyContainRect(image.naturalWidth, image.naturalHeight);
        const context = canvas.getContext("2d");
        context.fillStyle = draft.restaurant.storyBackgroundColor || draft.restaurant.primaryColor || "#182f28";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, rect.x, rect.y, rect.width, rect.height);
      } finally { URL.revokeObjectURL(objectUrl); }
    } else {
      if (document.fonts?.ready) await Promise.race([document.fonts.ready, new Promise((resolve) => setTimeout(resolve, 2000))]);
      await drawStory(draft.restaurant, menu, getMenuItems(menu.id), canvas);
    }
    if (!storyComposerIsCurrent(draft) || draft.renderVersion !== version) return;
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    const base64 = dataUrl.split(",")[1] || "";
    if (!base64 || Math.ceil(base64.length * 3 / 4) > STORY_MEDIA_MAX_BYTES) throw new Error("invalid_story_media_size");
    const preview = draft.panel.querySelector("#story-canvas");
    preview.getContext("2d").drawImage(canvas, 0, 0);
    draft.media = { dataUrl, contentType: "image/jpeg", source: draft.mode };
    status.textContent = draft.mode === "upload" ? "Imagem pronta. Confira a composição na prévia." : `Arte pronta com a identidade de ${draft.restaurant.name}.`;
  } catch (error) {
    if (storyComposerIsCurrent(draft) && draft.renderVersion === version) {
      status.textContent = storyQueueErrorMessage(error);
      draft.panel.querySelector("#story-canvas").getContext("2d").clearRect(0, 0, 1080, 1920);
    }
  } finally {
    if (storyComposerIsCurrent(draft) && draft.renderVersion === version) {
      draft.rendering = false;
      updateStoryControls(draft);
    }
  }
}

async function refreshStoryPublishing(draft) {
  if (!clientFeature(draft.restaurant, "autopublish")) {
    if (storyComposerIsCurrent(draft)) {
      draft.panel.querySelector("#story-publishing-account").textContent = "Story para compartilhar manualmente no Instagram.";
      setStoryAutomationStatus("preview", "Baixe a imagem, copie o link e adicione-o como sticker no Instagram.");
      updateStoryControls(draft);
    }
    return;
  }
  if (!storyComposerIsCurrent(draft)) return;
  const version = (draft.configVersion || 0) + 1;
  draft.configVersion = version;
  draft.pollVersion += 1;
  draft.publishing = null;
  draft.panel.querySelector("#story-publishing-account").textContent = "Consultando a conta vinculada...";
  updateStoryControls(draft);
  try {
    const params = { slug: draft.restaurant.slug, token: clientToken(draft.restaurant), fresh: Date.now() };
    const [config, latest] = await Promise.all([apiGet("getStoryPublishingConfig", params), apiGet("getStoryJob", params)]);
    if (!storyComposerIsCurrent(draft) || draft.configVersion !== version) return;
    draft.publishing = config.publishing;
    draft.locked = config.publishing?.state === "outcome_unknown" || Boolean(latest.job && ["pending", "claimed", "preparing", "publishing", "outcome_unknown"].includes(latest.job.status));
    draft.panel.querySelector("#story-publishing-account").textContent = storyPublishingDescription(draft.publishing);
    if (latest.job) {
      setStoryAutomationStatus(latest.job.status, storyJobMessage(latest.job));
      if (["pending", "claimed", "preparing", "publishing"].includes(latest.job.status)) pollStoryPublication(draft.restaurant, latest.job.id, 0, draft, ++draft.pollVersion);
    }
  } catch {
    if (!storyComposerIsCurrent(draft) || draft.configVersion !== version) return;
    draft.publishing = null;
    draft.panel.querySelector("#story-publishing-account").textContent = "Conta indisponível. Prepare ou baixe a imagem e tente atualizar a conta novamente.";
  }
  updateStoryControls(draft);
}

async function publishPreparedStory(draft) {
  if (!clientFeature(draft.restaurant, "autopublish")) return;
  if (!storyComposerIsCurrent(draft) || draft.busy || draft.locked || draft.rendering || !draft.media || !storyPublishingReady(draft.publishing)) return;
  const media = draft.media;
  const menu = { ...draft.menu };
  draft.busy = true;
  updateStoryControls(draft);
  try {
    menu.storyLink = validateStoryLink(draft.panel.querySelector('[name="storyLink"]').value);
    await refreshStoryPublishing(draft);
    if (!storyComposerIsCurrent(draft)) return;
    if (!storyPublishingReady(draft.publishing) || draft.locked) throw new Error("story_account_unavailable");
    const requestId = await storyPublicationKey(draft.restaurant.slug, menu.id, media.dataUrl, menu.storyLink);
    if (!storyComposerIsCurrent(draft) || draft.media !== media) return;
    const job = await queueStoryPublication(draft.restaurant, menu, requestId, media, draft);
    if (!storyComposerIsCurrent(draft)) return;
    draft.locked = ["pending", "claimed", "preparing", "publishing", "outcome_unknown"].includes(job.status);
    saveStoryPreview(draft.restaurant, menu, media.source);
    trackEvent(draft.restaurant, "story_queued", "admin", menu.id);
    toast(job.duplicate ? "Esta publicação já foi registrada." : "Story enviado ao publicador QrStack.");
  } catch (error) {
    if (storyComposerIsCurrent(draft)) setStoryAutomationStatus("failed_attention", `${storyQueueErrorMessage(error)} A imagem foi mantida. Atualize a conta para consultar a publicação.`);
  } finally {
    draft.busy = false;
    updateStoryControls(draft);
  }
}

function attachStoryAccountHandlers() {
  document.querySelectorAll("[data-story-account-form]").forEach(async (form) => {
    const restaurant = getRestaurant(form.dataset.storyAccountForm);
    const summary = form.closest("[data-story-account-card]").querySelector("[data-story-account-summary]");
    const button = form.querySelector('button[type="submit"]');
    try {
      const response = await apiGet("getStoryPublishingConfig", { slug: restaurant.slug, token: clientToken(restaurant), fresh: Date.now() });
      if (!form.isConnected) return;
      const publishing = response.publishing || {};
      for (const field of ["publisher_id", "instagram_username", "instagram_user_id"]) form.elements[field].value = publishing[field] || "";
      form.elements.enabled.checked = publishing.enabled === true;
      summary.textContent = storyPublishingDescription(publishing);
    } catch { if (form.isConnected) summary.textContent = "Não foi possível consultar o vínculo. Informe os dados do publicador para configurar."; }
    if (!form.isConnected) return;
    button.disabled = false;
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (form.dataset.submitting === "true") return;
      form.dataset.submitting = "true";
      button.disabled = true;
      try {
        const response = await apiPost({ action: "bindInstagramAccount", owner_key: OWNER_SESSION_TOKEN, slug: restaurant.slug,
          publisher_id: form.elements.publisher_id.value.trim(), instagram_username: form.elements.instagram_username.value.trim().replace(/^@/, ""),
          instagram_user_id: form.elements.instagram_user_id.value.trim(), enabled: form.elements.enabled.checked });
        if (form.isConnected) summary.textContent = storyPublishingDescription(response.publishing);
      } catch (error) {
        if (form.isConnected) summary.textContent = `Vínculo não alterado. ${storyQueueErrorMessage(error)}`;
      } finally { delete form.dataset.submitting; if (form.isConnected) button.disabled = false; }
    });
  });
}

async function renderClientPortal(slug, version, { skipCatalogSync = false } = {}) {
  const localRestaurant = getRestaurant(slug);
  const [remote] = await Promise.all([
    syncMenuFromApi(slug),
    skipCatalogSync ? Promise.resolve(getCatalogForRestaurant(localRestaurant)) : syncCatalogForRestaurant(localRestaurant),
  ]);
  if (!isCurrentRoute(version)) return;
  const currentHash = window.location.hash.replace(/^#\/?/, "");
  if (!currentHash.startsWith(`cliente/${slug}`) && !currentHash.startsWith(`admin/${slug}`)) return;
  const restaurant = remote.restaurant || (await syncRestaurantFromApi(slug));
  await syncClientPlan(restaurant);
  if (!isCurrentRoute(version)) return;
  workspacePortalRestaurant = restaurant;
  const menu = remote.menu || createBlankMenu(restaurant.id);
  const menuItems = remote.items.length ? remote.items : getMenuItems(menu.id);
  const storyLink = menu.storyLink || restaurantStoryLink(restaurant);
  setSystemTheme();
  const content = `
    <div class="client-form-page">
        <p class="client-plan-summary">${escapeHtml(restaurant.planAccess?.name || "Plano indisponível — recursos adicionais aguardam verificação")}</p>
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
            ${restaurant.slug === "amaro" ? renderAmaroOriginalForm(restaurant) : renderGenericItemsTextarea()}
            <div class="field field--full">
              <label for="notes">Observações</label>
              <textarea id="notes" name="notes" placeholder="Observações do dia"></textarea>
            </div>
            <div class="actions field--full">
              <button type="submit">Enviar e publicar cardápio</button>
            </div>
          </form>
        </section>

        <section class="section client-step" id="catalog-manager">
          <div class="section__head">
            <p class="eyebrow">Pratos</p>
            <h2>Catálogo do restaurante</h2>
            <p class="muted">Cadastre pratos novos ou atualize nome, categoria, descrição e preço dos já existentes.</p>
          </div>
          ${renderCatalogManager(restaurant)}
        </section>

        ${STORY_AUTOMATION_ENABLED ? renderStoryComposer(restaurant, storyLink) : ""}
        <section class="section client-step" id="client-insights">${clientFeature(restaurant, "analytics") ? renderHqInsights() : renderPlanLock("Dashboard de acessos do cardápio", "performance")}</section>
    </div>
  `;
  app.innerHTML = renderWorkspace({ client: true, active: workspaceClientView, title: "Cardápio do dia", restaurant, content, actions: `<a class="button secondary" href="${publicMenuHash(restaurant, "cliente")}">${uiIcon("external-link")}Ver cardápio</a>` });
  attachClientHandlers(restaurant, menu);
  setWorkspaceClientView(workspaceClientView);
  const requestedDish = new URLSearchParams(location.hash.split("?")[1] || "").get("dish");
  if (requestedDish) {
    document.querySelector(`[data-catalog-id="${CSS.escape(requestedDish)}"]`)?.click();
    const routeParams = new URLSearchParams(location.hash.split("?")[1] || "");
    routeParams.delete("dish");
    history.replaceState(null, "", location.hash.split("?")[0] + "?" + routeParams);
  }
  if (STORY_AUTOMATION_ENABLED) initializeStoryComposer(restaurant, menu);
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
        <button type="button" class="nav-link" data-scroll-target="catalog-manager">Pratos</button>
        ${STORY_AUTOMATION_ENABLED ? '<button type="button" class="nav-link" data-scroll-target="story-panel">Story</button>' : ""}
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

function renderGenericItemsTextarea() {
  return `
    <div class="field field--full">
      <label for="items">Itens do cardápio</label>
      <textarea id="items" name="items" placeholder="Categoria: Item | Preço"></textarea>
    </div>
  `;
}

function renderAmaroOriginalForm(restaurant) {
  const configuredFields = getAmaroFormFields().filter((field) => field.title.toLowerCase().startsWith("prato"));
  const fields = configuredFields.length
    ? configuredFields
    : Array.from({ length: 7 }, (_, index) => ({ title: `Prato ${index + 1}:` }));
  const activeExecutives = getCatalogForRestaurant(restaurant)
    .filter((item) => item.section_id === "executivos" && isCatalogItemActive(item))
    .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0))
    .map((item) => item.name);
  return `
    <div class="field field--full">
      <label>Formulário original Amaro</label>
      <div class="select-grid">
        ${fields
          .map((field, index) => {
            return `
              <div class="field">
                <label for="amaro-prato-${index + 1}">${field.title.replace(":", "")}</label>
                <select id="amaro-prato-${index + 1}" name="prato_${index + 1}" required>
                  <option value="">Selecione</option>
                  ${activeExecutives
                    .map(
                      (option) =>
                        `<option value="${escapeAttr(option)}">${option}</option>`
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

function renderCatalogManager(restaurant) {
  const catalog = getCatalogForRestaurant(restaurant)
    .filter(isCatalogItemActive)
    .sort((a, b) => {
      const section = String(a.section_title || "").localeCompare(String(b.section_title || ""), "pt-BR");
      return section || Number(a.sort_order || 0) - Number(b.sort_order || 0) || String(a.name).localeCompare(String(b.name), "pt-BR");
    });
  const sections = [...new Map(catalog.map((item) => [item.section_id, item.section_title || item.category || "Catálogo"])).entries()];
  return `
    <div class="catalog-manager-layout">
      <dialog id="catalog-dialog" class="catalog-dialog">
      <div class="dialog-header"><div><p class="eyebrow">Catálogo</p><h2 id="catalog-dialog-title">Novo prato</h2></div><button class="icon-button" type="button" data-close-catalog aria-label="Fechar edição">${uiIcon("x")}</button></div>
      <form id="catalog-item-form" class="form-grid catalog-editor">
        <input type="hidden" name="catalogItemId" value="" />
        <div class="field field--full">
          <label for="catalog-name">Nome do prato</label>
          <input id="catalog-name" name="catalogName" required maxlength="140" placeholder="Ex.: Maminha grelhada" />
        </div>
        <div class="field">
          <label for="catalog-section">Categoria</label>
          <select id="catalog-section" name="catalogSection" required>
            ${sections.map(([id, title]) => `<option value="${escapeAttr(id)}" data-title="${escapeAttr(title)}">${escapeHtml(title)}</option>`).join("")}
            <option value="__new__">Nova categoria</option>
          </select>
        </div>
        <div class="field" id="catalog-new-section-field" hidden>
          <label for="catalog-new-section">Nome da nova categoria</label>
          <input id="catalog-new-section" name="catalogNewSection" maxlength="100" placeholder="Ex.: Executivos" />
        </div>
        <div class="field">
          <label for="catalog-price">Preço</label>
          <input id="catalog-price" name="catalogPrice" maxlength="40" placeholder="R$ 38,00" />
        </div>
        <div class="field field--full">
          <label for="catalog-description">Descrição</label>
          <textarea id="catalog-description" name="catalogDescription" maxlength="1200" placeholder="Ingredientes e acompanhamentos"></textarea>
        </div>
        <div class="field field--full">
          <label for="catalog-image">Foto do prato</label>
          <input type="hidden" name="catalogImageExisting" value="" />
          <input id="catalog-image" type="file" name="catalogImageFile" accept="image/jpeg,image/png,image/webp" />
        </div>
        <div class="actions field--full">
          <button type="submit">Salvar prato</button>
          <button type="reset" class="secondary">Limpar</button>
        </div>
      </form>
      </dialog>
      <div class="catalog-library">
        <div class="section-title-row"><span>${catalog.length} pratos no catálogo</span><button type="button" data-catalog-create>${uiIcon("plus")}Novo prato</button></div>
        <div class="field">
          <label for="catalog-search">Buscar no catálogo</label>
          <input id="catalog-search" type="search" placeholder="Digite o nome do prato" />
        </div>
        <div class="catalog-list" id="catalog-list">
          ${catalog.map((item) => `
            <article class="catalog-row" data-catalog-search="${escapeAttr(normalizeKey(`${item.name} ${item.section_title || item.category || ""}`))}">
              <div>
                <span class="catalog-row__section">${escapeHtml(item.section_title || item.category || "Catálogo")}</span>
                <strong>${escapeHtml(item.name)}</strong>
                <small>${escapeHtml(item.price || "Sem preço informado")}</small>
              </div>
              <button type="button" class="icon-button catalog-edit" data-catalog-id="${escapeAttr(item.id)}" aria-label="Editar ${escapeAttr(item.name)}" title="Editar prato">${uiIcon("pencil")}</button>
            </article>
          `).join("")}
        </div>
      </div>
    </div>
  `;
}

function attachClientHandlers(restaurant, menu) {
  const menuForm = document.getElementById("menu-form");
  if (restaurant.slug === "amaro") {
    syncUniqueMenuSelections(menuForm);
    menuForm.addEventListener("change", (event) => {
      if (event.target.matches('select[name^="prato_"]')) syncUniqueMenuSelections(menuForm);
    });
  }
  menuForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (form.dataset.submitting === "true") return;
    form.dataset.submitting = "true";
    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Preparando publicação...";
    }
    if (restaurant.slug === "amaro" && hasRepeatedMenuSelections(event.currentTarget)) {
      delete form.dataset.submitting;
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = "Enviar e publicar cardápio";
      }
      toast("Cada prato pode ser escolhido apenas uma vez.");
      return;
    }
    const formData = new FormData(event.currentTarget);
    const storyLinkInput = document.querySelector('[name="storyLink"]');
    formData.set("storyLink", storyLinkInput?.value || restaurantStoryLink(restaurant));
    const submission = getMenuSubmission(restaurant, formData);
    try {
      if (!submission.isRepeated) {
        rememberMenuSubmission(submission.storageKey, submission.signature, "pending");
        const saveResult = await saveMenuForm(restaurant, menu.id, formData);
        if (!saveResult?.ok) {
          forgetMenuSubmission(submission.storageKey, submission.signature);
          throw new Error("menu_save_failed");
        }
        rememberMenuSubmission(submission.storageKey, submission.signature, "saved");
      } else {
        toast("Esta resposta já foi salva e não será duplicada.");
      }

      toast("Cardápio publicado com sucesso. O Story pode ser preparado na aba Stories.");
      if (storyComposerIsCurrent(storyComposer) && storyComposer.restaurant.slug === restaurant.slug && !storyComposer.busy) {
        storyComposer.menu = getLatestMenu(restaurant.id);
        prepareStoryImage(storyComposer);
      }
    } catch (error) {
      console.warn("QrStack menu publication unavailable:", error);
      toast("Não foi possível confirmar a publicação. Suas escolhas foram mantidas; tente enviar novamente.");
    } finally {
      delete form.dataset.submitting;
      if (!submitButton || !document.body.contains(submitButton)) return;
      submitButton.disabled = false;
      submitButton.textContent = "Enviar e publicar cardápio";
    }
  });

  attachCatalogManagerHandlers(restaurant);
}

function attachCatalogManagerHandlers(restaurant) {
  const form = document.getElementById("catalog-item-form");
  const sectionSelect = document.getElementById("catalog-section");
  const newSectionField = document.getElementById("catalog-new-section-field");
  const search = document.getElementById("catalog-search");
  if (!form || !sectionSelect || !newSectionField) return;

  const syncNewSectionField = () => {
    const isNew = sectionSelect.value === "__new__";
    newSectionField.hidden = !isNew;
    form.elements.catalogNewSection.required = isNew;
    if (isNew) form.elements.catalogNewSection.focus();
  };
  sectionSelect.addEventListener("change", syncNewSectionField);

  document.querySelectorAll(".catalog-edit").forEach((button) => {
    button.addEventListener("click", () => {
      const catalogItem = getCatalogForRestaurant(restaurant).find((item) => item.id === button.dataset.catalogId);
      if (!catalogItem) return;
      form.elements.catalogItemId.value = catalogItem.id;
      form.elements.catalogName.value = catalogItem.name || "";
      form.elements.catalogPrice.value = catalogItem.price || "";
      form.elements.catalogDescription.value = catalogItem.description || "";
      form.elements.catalogImageExisting.value = catalogItem.image_url || "";
      form.elements.catalogImageFile.value = "";
      const existingOption = [...sectionSelect.options].find((option) => option.value === catalogItem.section_id);
      if (existingOption) {
        sectionSelect.value = catalogItem.section_id;
        form.elements.catalogNewSection.value = "";
      } else {
        sectionSelect.value = "__new__";
        form.elements.catalogNewSection.value = catalogItem.section_title || catalogItem.category || "";
      }
      syncNewSectionField();
      document.getElementById("catalog-dialog-title").textContent = "Editar prato";
      document.getElementById("catalog-dialog").showModal();
      form.scrollIntoView({ behavior: "smooth", block: "start" });
      form.elements.catalogName.focus({ preventScroll: true });
    });
  });

  search?.addEventListener("input", () => {
    const query = normalizeKey(search.value);
    document.querySelectorAll(".catalog-row").forEach((row) => {
      row.hidden = Boolean(query && !String(row.dataset.catalogSearch || "").includes(query));
    });
  });

  form.addEventListener("reset", () => {
    window.setTimeout(() => {
      form.elements.catalogItemId.value = "";
      form.elements.catalogImageExisting.value = "";
      syncNewSectionField();
    }, 0);
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (form.dataset.submitting === "true") return;
    const submitButton = form.querySelector('button[type="submit"]');
    const selectedOption = sectionSelect.selectedOptions[0];
    const newSectionTitle = form.elements.catalogNewSection.value.trim();
    const sectionTitle = sectionSelect.value === "__new__"
      ? newSectionTitle
      : selectedOption?.dataset.title || selectedOption?.textContent?.trim() || "Catálogo";
    if (!sectionTitle) {
      toast("Informe o nome da categoria.");
      return;
    }

    form.dataset.submitting = "true";
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Salvando...";
    }
    try {
      let imageUrl = form.elements.catalogImageExisting.value.trim();
      const imageFile = form.elements.catalogImageFile.files?.[0];
      if (imageFile) {
        if (submitButton) submitButton.textContent = "Enviando foto...";
        const upload = await uploadCatalogImage(imageFile, restaurant);
        imageUrl = upload.image_url;
        if (submitButton) submitButton.textContent = "Salvando...";
      }
      const data = await apiPost({
        action: "saveCatalogItem",
        slug: restaurant.slug,
        token: clientToken(restaurant),
        id: form.elements.catalogItemId.value,
        name: form.elements.catalogName.value.trim(),
        section_id: sectionSelect.value === "__new__" ? normalizeKey(sectionTitle).replace(/\s+/g, "-") : sectionSelect.value,
        section_title: sectionTitle,
        category: sectionTitle,
        description: form.elements.catalogDescription.value.trim(),
        price: form.elements.catalogPrice.value.trim(),
        image_url: imageUrl,
      });
      const savedItem = normalizeCatalogItem(data.item, restaurant);
      const nextCatalog = getCatalogForRestaurant(restaurant).filter((item) => item.id !== savedItem.id);
      nextCatalog.push(savedItem);
      runtimeCatalogs.set(restaurant.id, nextCatalog);
      toast(form.elements.catalogItemId.value ? "Prato atualizado no cardápio." : "Prato adicionado ao cardápio.");
      await renderClientPortal(restaurant.slug, routeVersion, { skipCatalogSync: true });
      setWorkspaceClientView("catalog-manager");
    } catch (error) {
      console.warn("QrStack catalog save unavailable:", error);
      toast("Não foi possível salvar o prato. Tente novamente.");
    } finally {
      delete form.dataset.submitting;
      if (submitButton && document.body.contains(submitButton)) {
        submitButton.disabled = false;
        submitButton.textContent = "Salvar prato";
      }
    }
  });
}

function storyQueueErrorMessage(error) {
  const code = String(error?.message || "").trim();
  const messages = {
    story_canvas_not_ready: "a arte ainda não terminou de carregar",
    invalid_story_media_size: "a arte ultrapassou o limite de tamanho",
    invalid_story_media: "a arte gerada ficou inválida",
    invalid_story_link: "Informe um endereço HTTPS válido, sem usuário ou senha, para o sticker.",
    story_upload_type: "Escolha uma imagem JPG, PNG ou WebP.",
    story_upload_size: "Escolha uma imagem de até 15 MB.",
    story_upload_dimensions: "A imagem excede 40 megapixels ou possui dimensões inválidas.",
    story_upload_decode: "Não foi possível abrir a imagem. Escolha outro arquivo JPG, PNG ou WebP.",
    story_account_unavailable: "A conta ainda não está habilitada ou tem uma publicação aguardando conclusão.",
    instagram_publisher_not_found: "O publicador precisa ser registrado antes de vincular a conta.",
    story_publishing_disabled: "A publicação está desabilitada para esta conta.",
    story_outcome_unknown: "Confira o resultado anterior no Instagram e resolva no publicador antes de continuar.",
    invalid_restaurant_token: "o acesso do restaurante expirou",
    api_timeout: "a conexão demorou além do limite",
  };
  return messages[code] || "falha temporária de conexão";
}

function syncUniqueMenuSelections(form) {
  const selects = [...form.querySelectorAll('select[name^="prato_"]')];
  const selected = new Set(selects.map((select) => select.value).filter(Boolean));
  selects.forEach((select) => {
    [...select.options].forEach((option) => {
      option.disabled = Boolean(option.value && option.value !== select.value && selected.has(option.value));
    });
  });
}

function hasRepeatedMenuSelections(form) {
  const values = [...form.querySelectorAll('select[name^="prato_"]')]
    .map((select) => select.value)
    .filter(Boolean);
  return new Set(values).size !== values.length;
}

function getMenuSubmission(restaurant, formData) {
  const date = String(formData.get("date") || todayIso()).slice(0, 10);
  const storageKey = `${MENU_SUBMISSION_PREFIX}${restaurant.slug}:${date}`;
  const values = [...formData.entries()]
    .map(([key, value]) => [String(key), String(value || "").trim()])
    .sort(([keyA], [keyB]) => keyA.localeCompare(keyB));
  const signature = simpleHash(JSON.stringify(values));
  let previous = null;
  try {
    previous = JSON.parse(localStorage.getItem(storageKey) || "null");
  } catch {
    previous = null;
  }
  const pendingIsCurrent = previous?.status !== "pending" || Date.now() - Number(previous.savedAt || 0) < 120000;
  return {
    storageKey,
    signature,
    isRepeated: previous?.signature === signature && pendingIsCurrent,
  };
}

function rememberMenuSubmission(storageKey, signature, status) {
  localStorage.setItem(storageKey, JSON.stringify({ signature, status, savedAt: Date.now() }));
}

function forgetMenuSubmission(storageKey, signature) {
  try {
    const current = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (current?.signature === signature) localStorage.removeItem(storageKey);
  } catch {
    localStorage.removeItem(storageKey);
  }
}

function simpleHash(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function saveStoryPreview(restaurant, menu, source = "auto") {
  const templateName = source === "upload" ? "Imagem enviada" : "Identidade do restaurante";
  state.storyAssets.push({
    id: crypto.randomUUID(),
    restaurantId: restaurant.id,
    menuDayId: menu.id,
    imageUrl: "local-canvas-preview",
    templateName,
    createdAt: new Date().toISOString(),
  });
  apiPost({
    action: "saveStoryAsset",
    slug: restaurant.slug,
    token: clientToken(restaurant),
    menu_day_id: menu.id,
    image_url: "local-canvas-preview",
    template_name: templateName,
  }).catch((error) => console.warn("QrStack story API unavailable:", error.message));
  trackEvent(restaurant, "story_generated", "admin", menu.id);
  saveState();
}

async function queueStoryPublication(restaurant, menu, requestId, media, draft) {
  const imageBase64 = String(media?.dataUrl || "").split(",")[1] || "";
  if (!imageBase64) throw new Error("story_canvas_not_ready");
  setStoryAutomationStatus("pending", "Enviando a arte para o publicador QrStack...");
  const response = await apiPost({
    action: "createStoryJob",
    slug: restaurant.slug,
    token: clientToken(restaurant),
    menu_day_id: menu.id,
    story_link: menu.storyLink || restaurantStoryLink(restaurant),
    content_type: media.contentType,
    image_base64: imageBase64,
    client_request_id: requestId,
    image_source: media.source,
  });
  const job = response.job;
  if (!job?.id) throw new Error("story_job_missing");
  if (storyComposerIsCurrent(draft)) {
    setStoryAutomationStatus(job.status, storyJobMessage(job));
    if (["pending", "claimed", "preparing", "publishing"].includes(job.status)) pollStoryPublication(restaurant, job.id, 0, draft, ++draft.pollVersion);
  }
  return {
    ...job,
    duplicate: response.duplicate === true,
    retriedFrom: response.retried_from || "",
    historical: response.historical === true,
  };
}

function pollStoryPublication(restaurant, jobId, attempt = 0, draft = storyComposer, pollVersion = draft?.pollVersion) {
  window.setTimeout(async () => {
    if (!storyComposerIsCurrent(draft) || draft.pollVersion !== pollVersion) return;
    try {
      const data = await apiGet("getStoryJob", {
        slug: restaurant.slug,
        token: clientToken(restaurant),
        job: jobId,
      });
      const job = data.job;
      if (!job) throw new Error("story_job_not_found");
      if (!storyComposerIsCurrent(draft) || draft.pollVersion !== pollVersion) return;
      setStoryAutomationStatus(job.status, storyJobMessage(job));
      draft.locked = !["completed", "failed_attention", "cancelled"].includes(job.status);
      updateStoryControls(draft);
      if (job.status === "completed") {
        trackEvent(restaurant, "story_published", "publisher", job.menu_day_id);
        toast("Story publicado e confirmado no Instagram.");
        return;
      }
      if (["failed_attention", "outcome_unknown", "cancelled"].includes(job.status)) return;
      pollStoryPublication(restaurant, jobId, 0, draft, pollVersion);
    } catch (error) {
      if (!storyComposerIsCurrent(draft) || draft.pollVersion !== pollVersion) return;
      const nextAttempt = attempt + 1;
      setStoryAutomationStatus("syncing", nextAttempt < 20 ? "Reconectando ao acompanhamento da publicação..." : "Acompanhamento indisponível. Use Atualizar conta para consultar o resultado antes de enviar novamente.");
      if (nextAttempt < 20) pollStoryPublication(restaurant, jobId, nextAttempt, draft, pollVersion);
    }
  }, attempt ? Math.min(15000, 2500 + attempt * 800) : 2500);
}

function setStoryAutomationStatus(status, message) {
  const target = document.getElementById("story-automation-status");
  if (!target) return;
  const labels = {
    preview: "Prévia",
    pending: "Na fila",
    claimed: "Publicador conectado",
    preparing: "Preparando",
    publishing: "Publicando",
    completed: "Publicado",
    failed_attention: "Conferência necessária",
    outcome_unknown: "Resultado incerto",
    cancelled: "Cancelado",
    syncing: "Sincronizando",
  };
  target.dataset.status = status || "pending";
  target.innerHTML = `
    <span class="status-pill">${escapeHtml(labels[status] || "Publicação")}</span>
    <p>${escapeHtml(message || "Aguardando atualização do publicador QrStack.")}</p>
  `;
}

function storyJobMessage(job) {
  const checkpoint = String(job?.checkpoint || "").replaceAll("_", " ");
  const updatedAt = job?.updated_at ? new Date(job.updated_at) : null;
  const historySuffix = updatedAt && !Number.isNaN(updatedAt.getTime())
    ? ` Tentativa registrada em ${updatedAt.toLocaleDateString("pt-BR")} às ${updatedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}.`
    : "";
  const messages = {
    pending: "Arte recebida. Aguardando o publicador QrStack.",
    claimed: "O publicador recebeu a solicitação e vai verificar a conta vinculada.",
    preparing: "Preparando a imagem para publicação.",
    publishing: `Instagram em operação${checkpoint ? `: ${checkpoint}` : ""}.`,
    completed: "Publicação confirmada pelo Instagram. Confira a aparência e o link no aplicativo.",
    failed_attention: `${job?.last_error || "A publicação foi interrompida e precisa de conferência no publicador."}${historySuffix}`,
    outcome_unknown: "O resultado da publicação ainda não foi confirmado. Confira o Instagram e resolva no publicador antes de enviar novamente.",
    cancelled: "Esta publicação foi cancelada.",
  };
  return messages[job?.status] || "Acompanhando a publicação no publicador QrStack.";
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
    restaurant.slug === "amaro" ? selectedAmaroRows(restaurant, formData) : selectedGenericRows(formData);
  selectedRows.forEach((parsed, index) => {
    state.menuItems.push(item(menuId, parsed.name, parsed.category, parsed.isHighlight, index + 1, parsed.description, parsed.price));
  });
  trackEvent(restaurant, "menu_published", "admin", menuId);
  saveState();

  try {
    const response = await apiPost({
      action: "saveMenuDay",
      slug: restaurant.slug,
      token: clientToken(restaurant),
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
    return { ok: true, duplicate: response.duplicate === true };
  } catch (error) {
    console.warn("QrStack save API unavailable:", error.message);
    return { ok: false, error };
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

function selectedAmaroRows(restaurant, formData) {
  const catalog = getCatalogForRestaurant(restaurant).reduce((acc, catalogItem) => {
    acc[normalizeKey(catalogItem.name)] = catalogItem;
    return acc;
  }, {});
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
  const clientView = isClientWorkspace();
  if (clientView) {
    await syncClientPlan(restaurant);
    if (!target.isConnected || !isClientWorkspace()) return;
    if (!clientFeature(restaurant, "analytics")) { target.innerHTML = renderPlanLock("Dashboard de acessos do cardápio", "performance"); return; }
  }
  const requestId = String(Number(target.dataset.requestId || 0) + 1);
  target.dataset.requestId = requestId;
  const forceRefresh = options.forceRefresh === true;
  const refreshAfterLoad = options.refreshAfterLoad === true;
  const silentRefresh = options.silentRefresh === true;
  const filters = getInsightsFilters();
  const cachedBeforeFetch = getCachedInsightsHtml(restaurant, filters);
  if (cachedBeforeFetch?.html && !forceRefresh) {
    target.innerHTML = cachedBeforeFetch.html;
    setWorkspaceInsightsView();
  }
  const applyButton = document.querySelector('[data-insights-filter] button[type="submit"]');
  if (forceRefresh && !silentRefresh && applyButton) {
    applyButton.disabled = true;
    applyButton.dataset.originalLabel = applyButton.textContent;
    applyButton.textContent = "Atualizando...";
  }
  try {
    const endpoint = clientView ? QRSTACK_API_URL : restaurant.analyticsEndpoint || restaurant.liveMenuEndpoint || QRSTACK_API_URL;
    const data = await endpointGet(endpoint, "getInsights", {
      slug: restaurant.slug,
      ...(clientView ? { token: clientToken(restaurant) } : { key: OWNER_SESSION_TOKEN }),
      startDate: filters.startDate,
      endDate: filters.endDate,
      refresh: forceRefresh ? "1" : "",
      refresh_nonce: forceRefresh ? Date.now() : "",
    });
    if (!target.isConnected || target.dataset.requestId !== requestId) return;
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
    const uniqueVisitors = insights.unique_visitors_period ?? uniqueSessions;
    const uniqueVisitorsTotal = insights.unique_visitors_total ?? uniqueSessionsTotal;
    const returningVisitors = Number(insights.returning_visitors_period || 0);
    const returningVisitorsTotal = Number(insights.returning_visitors_total || 0);
    const returningSessions = Number(insights.returning_sessions_period || 0);
    const returningSessionsTotal = Number(insights.returning_sessions_total || 0);
    const trackedDays = Number(insights.tracked_days || 0);
    const returnRate = uniqueVisitors ? (returningVisitors / uniqueVisitors) * 100 : 0;
    const visitorMix = {
      "Uma única sessão": Math.max(0, Number(uniqueVisitors) - returningVisitors),
      "Visitantes recorrentes": returningVisitors,
    };
    const whatsappClicks = eventTypeCounts.whatsapp_click || eventTypeCounts.whatsapp || 0;
    const mapsClicks = eventTypeCounts.maps_click || eventTypeCounts.maps || 0;
    const conversionBase = Number(periodAccesses) || 0;
    const whatsappRate = conversionBase ? `${Math.round((Number(whatsappClicks) / conversionBase) * 100)}%` : "0%";
    const mapsRate = conversionBase ? `${Math.round((Number(mapsClicks) / conversionBase) * 100)}%` : "0%";
    const peak = insights.peak_hour || "Sem dados suficientes no período.";
    const dailyAccesses = insights.daily_accesses || {};
    const hourCounts = insights.hour_counts || {};
    const deviceCounts = normalizeCountKeys(insights.device_counts || {}, (value) => String(value || "desconhecido").toLowerCase());
    const browserCounts = insights.browser_counts || {};
    const osCounts = insights.os_counts || {};
    const sourceDetailCounts = insights.source_detail_counts || {};
    const webviewPlatformCounts = insights.webview_banner_platform_counts || {};
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
    const storageHealth = data.analytics_storage || {};
    const fallbackActive = storageHealth.ingestion_status === "fallback_active";
    const cachedDashboard = storageHealth.dashboard_status === "cached_snapshot";
    const collectionLabel = fallbackActive
      ? "Coleta preservada no fallback"
      : cachedDashboard
        ? "Coleta ativa · leitura salva"
        : "Coleta ativa no D1";
    const collectionDetail = fallbackActive
      ? "Novos eventos estão seguros na planilha e na fila de retorno ao D1."
      : cachedDashboard
        ? "A cota de leitura está protegida; os eventos continuam sendo recebidos."
        : "D1 e consolidação diária operando normalmente.";
    const topSource = sortedCountEntries(sourceCounts)[0];
    const topDish = sortedCountEntries(dishAttentionScores)[0];
    const topObservedDish = sortedCountEntries(dishObserveSeconds)[0];
    const topCategory = sortedCountEntries(dishCategoryCounts)[0];
    const topDevice = sortedCountEntries(deviceCounts)[0];
    target.innerHTML = `
      <div class="dashboard-status">
        <div><strong>${escapeHtml(restaurant.name)}</strong><span>${periodLabel}</span></div>
        <div class="dashboard-status__sync"><span class="status-pill ${fallbackActive || cachedDashboard ? "status-pill--pending" : ""}" title="${escapeAttr(collectionDetail)}">${fallbackActive ? "Contingência ativa" : cachedDashboard ? "Leitura salva" : "Coleta ativa"}</span><small>Atualizado: ${collectedAt}</small></div>
      </div>
      <section id="panel-overview" data-insight-panel="overview" role="tabpanel" aria-labelledby="tab-overview">
        <div class="kpi-strip">
          ${workspaceKpi("Acessos ao cardápio", periodAccesses, "Aberturas no período", "scan-line", true)}
          ${workspaceKpi("Visitantes únicos", uniqueVisitors, `${formatNumber(uniqueSessions)} sessões no período`, "users")}
          ${workspaceKpi("Visitantes recorrentes", returningVisitors, `${formatPercentNumber(returnRate)} dos visitantes`, "refresh-cw")}
          ${workspaceKpi("Instagram → Direto", instagramToDirectVisitors, `${formatNumber(instagramToDirectSessions)} sessões posteriores`, "arrow-up-right")}
        </div>
        <div class="dashboard-grid dashboard-grid--main">
          ${renderAreaChart("Acessos ao longo do tempo", dailyAccesses, { empty: "Nenhum acesso registrado no período.", labeler: formatDateShort })}
          ${renderDonutChart("De onde vêm os acessos", sourceCounts, { labeler: formatSourceLabel })}
        </div>
        <div class="dashboard-grid dashboard-grid--two">
          ${renderColumnChart("Horários de acesso", hourCounts, { labeler: formatHourLabel })}
          <article class="insight-chart"><div class="chart-heading"><span class="eyebrow">Em destaque</span><h3>O que movimenta o cardápio</h3></div>${renderInsightHighlights([
            ["Origem principal", topSource ? formatSourceLabel(topSource[0]) : "Sem dados", topSource ? formatNumber(topSource[1]) + " acessos" : ""],
            ["Prato com maior atenção", topDish ? topDish[0] : "Sem dados", topDish ? formatScore(topDish[1]) + " pontos" : ""],
            ["Mais observado", topObservedDish ? topObservedDish[0] : "Sem dados", topObservedDish ? formatDurationShort(topObservedDish[1]) : ""],
          ])}</article>
        </div>
        <details class="history-overview"><summary><span>${uiIcon("layers")}Histórico completo</span><small>${formatNumber(trackedDays)} dias consolidados</small>${uiIcon("chevron-down")}</summary><div class="history-metrics">
          ${insightKpi("Todos os acessos", totalAccesses ?? periodAccesses, "Aberturas do cardápio")}
          ${insightKpi("Visitantes únicos", uniqueVisitorsTotal, "IDs de visitante ou sessão")}
          ${insightKpi("Visitantes recorrentes", returningVisitorsTotal, "Duas ou mais sessões")}
          ${insightKpi("Sessões de retorno", returningSessionsTotal, "Além da primeira sessão")}
          ${insightKpi("Todas as sessões", uniqueSessionsTotal, "Sessões identificadas")}
          ${insightKpi("Todas as interações", totalEvents, "Eventos registrados")}
        </div></details>
      </section>
      <section id="panel-audience" data-insight-panel="audience" role="tabpanel" aria-labelledby="tab-audience" hidden>
        <div class="section-title-row"><h2>Origens dos acessos</h2><span>${formatNumber(periodAccesses)} acessos no período</span></div>
        ${renderChannelCards(sourceCounts, periodAccesses)}
        <div class="dashboard-grid dashboard-grid--two">
          ${renderInstagramDirectConversion(instagramToDirect)}
          ${renderDonutChart("Visitantes novos e recorrentes", visitorMix)}
        </div>
        <div class="dashboard-grid dashboard-grid--two">
          ${renderInsightBars("Detalhamento das origens", sourceDetailCounts, { labeler: formatSourceDetailLabel, limit: 10 })}
          ${renderConversionFunnel(periodAccesses, whatsappClicks, mapsClicks)}
        </div>
        <div class="dashboard-grid dashboard-grid--two">
          ${renderDonutChart("Dispositivos", deviceCounts, { labeler: formatDeviceLabel })}
          <article class="insight-chart"><p class="eyebrow">Contexto</p><h3>Sobre a atribuição</h3><div class="definition-list"><p><strong>Direto não significa visita presencial.</strong>Também inclui links salvos e acessos sem origem identificável.</p><p><strong>Instagram → Direto</strong> conta identidades rastreáveis que acessaram pelo Instagram e voltaram em sessões diretas posteriores. Não é uma confirmação de compra.</p><p><strong>Visitantes</strong> são identificados pelo navegador. Uma pessoa pode usar mais de um dispositivo.</p></div></article>
        </div>
      </section>
      <section id="panel-dishes" data-insight-panel="dishes" role="tabpanel" aria-labelledby="tab-dishes" hidden>
        <div class="kpi-strip">${workspaceKpi("Visualizações de pratos", totalDishViews, "Permanência mínima no cardápio", "utensils")}${workspaceKpi("Toques", totalDishTouches, "Interações nos pratos", "smartphone")}${workspaceKpi("Tempo observado", formatDurationShort(totalDishObserveSeconds), "Soma do período", "activity")}${workspaceKpi("Interações totais", periodEvents, "Eventos do período", "layers")}</div>
        <div class="dashboard-grid dashboard-grid--two">
          ${renderInsightBars("Pratos com maior atenção", dishAttentionScores, { valueFormatter: formatScore, limit: 8 })}
          ${renderInsightBars("Tempo observado por prato", dishObserveSeconds, { valueFormatter: formatDurationShort, limit: 8 })}
        </div>
        <div class="dashboard-grid dashboard-grid--two">
          ${renderInsightBars("Visualizações por prato", dishViewCounts, { limit: 8 })}
          ${renderInsightBars("Toques por prato", dishTouchCounts, { limit: 8 })}
        </div>
        <details class="history-overview"><summary><span>${uiIcon("utensils")}Rankings completos</span>${uiIcon("chevron-down")}</summary><div class="dashboard-grid dashboard-grid--two"><article class="insight-chart"><h3>Visualizações</h3>${renderInsightTable(dishViewCounts)}</article><article class="insight-chart"><h3>Toques</h3>${renderInsightTable(dishTouchCounts)}</article>${renderInsightBars("Atenção", dishAttentionScores, { valueFormatter: formatScore, limit: Number.MAX_SAFE_INTEGER })}${renderInsightBars("Tempo observado", dishObserveSeconds, { valueFormatter: formatDurationShort, limit: Number.MAX_SAFE_INTEGER })}</div></details>
        <div class="section-title-row"><h2>Interesse por categoria</h2></div>
        <div class="dashboard-grid dashboard-grid--three">
          ${renderInsightBars("Visualizações", dishCategoryCounts)}
          ${renderInsightBars("Tempo observado", dishObserveCategorySeconds, { valueFormatter: formatDurationShort })}
          ${renderInsightBars("Toques", dishTouchCategoryCounts)}
        </div>
      </section>
      <section id="panel-technical" data-insight-panel="technical" role="tabpanel" aria-labelledby="tab-technical" hidden>
        <div class="technical-status"><h2>Estado da coleta</h2><p>${collectionDetail}</p><small>${formatNumber(testEvents)} eventos de teste excluídos da contagem.</small></div>
        <div class="dashboard-grid dashboard-grid--three">
          ${renderDonutChart("Navegadores", browserCounts)}
          ${renderDonutChart("Sistemas operacionais", osCounts)}
          ${renderInsightBars("Avisos no Instagram", webviewPlatformCounts, { labeler: formatDeviceLabel })}
        </div>
        <div class="dashboard-grid dashboard-grid--two">
          ${renderInsightBars("Tipos de evento", eventTypeCounts, { labeler: formatEventLabel })}
          <article class="insight-chart"><p class="eyebrow">Auditoria</p><h3>Movimentações recentes</h3>${renderRecentEvents(recentEvents)}</article>
        </div>
        <details class="history-overview"><summary><span>${uiIcon("smartphone")}Diagnóstico deste navegador</span><small>${formatNumber(state.events.length)} eventos locais</small>${uiIcon("chevron-down")}</summary><p class="muted">Registros locais para diagnóstico, separados dos dados consolidados.</p>${renderInsightBars("Origens locais", Object.fromEntries(Object.entries(groupBy(state.events, "source")).map(([source, events]) => [source, events.length])))}</details>
      </section>
    `;
    setWorkspaceInsightsView();
    saveCachedInsightsHtml(restaurant, filters, target.innerHTML);
    clearInsightsRetry(restaurant);
    if (refreshAfterLoad && !forceRefresh && document.getElementById("insights-live")) {
      scheduleInsightsRefresh(restaurant);
    }
  } catch (error) {
    if (!target.isConnected || target.dataset.requestId !== requestId) return;
    if (clientView) {
      target.innerHTML = '<div class="plan-lock"><h3>Analytics indisponível</h3><p>Confira seu plano ou tente novamente mais tarde.</p></div>';
      return;
    }
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
      setWorkspaceInsightsView();
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

function drawStory(restaurant, menu, menuItems, canvas = document.getElementById("story-canvas")) {
  if (!canvas) return;
  if (restaurant.slug === "amaro") return drawAmaroStory(canvas, restaurant);
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  const highlights = menuItems.filter((menuItem) => menuItem.isHighlight).slice(0, 5);
  const storyLink = menu.storyLink || restaurantStoryLink(restaurant);
  const storyLinkLabel = formatStoryLink(storyLink);
  return Promise.all([loadCanvasImage(restaurant.logoUrl), loadCanvasImage(restaurant.symbolUrl)]).then(([logo, mark]) => {
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
    } else {
      ctx.textAlign = "center";
      ctx.fillStyle = primary;
      ctx.font = "800 58px Sora";
      wrapCanvasText(ctx, restaurant.name, w / 2, 265, w - 280, 72, 2);
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
  });
}

function drawAmaroStory(canvas, restaurant) {
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  const background = restaurant.storyBackgroundColor || "#bf8836";
  const ink = restaurant.primaryColor || "#0b3422";

  return Promise.all([
    loadCanvasImage(restaurant.storyLogoUrl),
    loadCanvasImage(restaurant.originalLogoUrl),
    loadCanvasImage(restaurant.logoUrl),
    loadCanvasImage(ASSETS.qrstackMark),
    loadCanvasImage(ASSETS.qrstackWordmark),
    loadCanvasImage(ASSETS.pointDownEmoji),
  ]).then(([storyLogo, originalLogo, transparentLogo, qrstackMark, qrstackWordmark, pointDownEmoji]) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = "rgba(11, 52, 34, 0.26)";
    ctx.lineWidth = 3;
    roundRect(ctx, 70, 70, w - 140, h - 140, 24);
    ctx.stroke();

    if (storyLogo) {
      const smoothLogo = createAmaroLogoMask(storyLogo, ink);
      const sourceX = Math.round(smoothLogo.width * 0.035);
      const sourceY = Math.round(smoothLogo.height * 0.38);
      const sourceWidth = Math.round(smoothLogo.width * 0.93);
      const sourceHeight = Math.round(smoothLogo.height * 0.23);
      ctx.drawImage(smoothLogo, sourceX, sourceY, sourceWidth, sourceHeight, 90, 460, w - 180, 225);
    } else if (originalLogo) {
      const smoothLogo = createAmaroLogoMask(originalLogo, ink);
      const sourceX = Math.round(smoothLogo.width * 0.13);
      const sourceY = Math.round(smoothLogo.height * 0.32);
      const sourceWidth = Math.round(smoothLogo.width * 0.74);
      const sourceHeight = Math.round(smoothLogo.height * 0.36);
      ctx.drawImage(smoothLogo, sourceX, sourceY, sourceWidth, sourceHeight, 100, 460, w - 200, 250);
    } else if (transparentLogo) {
      drawImageContain(ctx, transparentLogo, 100, 475, w - 200, 310);
    } else {
      ctx.textAlign = "center";
      ctx.fillStyle = ink;
      ctx.font = "400 150px Georgia";
      ctx.fillText("AMARO", w / 2, 690);
    }

    ctx.textAlign = "center";
    ctx.fillStyle = ink;
    ctx.font = "600 55px 'Bodoni Moda', Georgia, serif";
    ctx.fillText("Confira o cardápio do dia", w / 2, 995);
    ctx.font = "500 52px 'Bodoni Moda', Georgia, serif";
    const ctaLine = "clicando no link abaixo!";
    const emojiSize = 60;
    const emojiGap = 14;
    const ctaWidth = ctx.measureText(ctaLine).width;
    const ctaStart = (w - ctaWidth - emojiGap - emojiSize) / 2;
    ctx.textAlign = "left";
    ctx.fillText(ctaLine, ctaStart, 1065);
    if (pointDownEmoji) drawImageContain(ctx, pointDownEmoji, ctaStart + ctaWidth + emojiGap, 1014, emojiSize, emojiSize);
    ctx.textAlign = "center";

    ctx.strokeStyle = "rgba(11, 52, 34, 0.58)";
    ctx.lineWidth = 4;
    ctx.setLineDash([14, 12]);
    roundRect(ctx, 150, 1240, w - 300, 300, 28);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = ink;
    ctx.font = "700 14px Sora";
    ctx.fillText("UM PRODUTO", w / 2, 1742);
    ctx.globalAlpha = 0.82;
    if (qrstackMark) drawImageContain(ctx, qrstackMark, 408, 1758, 64, 64);
    if (qrstackWordmark) drawImageContain(ctx, qrstackWordmark, 484, 1768, 190, 44);
    ctx.globalAlpha = 1;
  });
}

function createAmaroLogoMask(image, ink) {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(image, 0, 0);

  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = pixels.data;
  const fallback = hexToRgb(ink) || { r: 11, g: 52, b: 34 };
  const sampled = { r: 0, g: 0, b: 0, count: 0 };
  for (let index = 0; index < data.length; index += 4) {
    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];
    if (g > r + 5 && g > b + 5 && (r + g + b) / 3 < 120) {
      sampled.r += r;
      sampled.g += g;
      sampled.b += b;
      sampled.count += 1;
    }
  }
  const foreground = sampled.count
    ? {
        r: Math.round(sampled.r / sampled.count),
        g: Math.round(sampled.g / sampled.count),
        b: Math.round(sampled.b / sampled.count),
      }
    : fallback;

  for (let index = 0; index < data.length; index += 4) {
    const dominance = data[index + 1] - Math.max(data[index], data[index + 2]);
    const alpha = Math.max(0, Math.min(1, (dominance - 1) / 16));
    data[index] = foreground.r;
    data[index + 1] = foreground.g;
    data[index + 2] = foreground.b;
    data[index + 3] = Math.round(alpha * 255);
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.putImageData(pixels, 0, 0);
  return canvas;
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
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      image.onload = null;
      image.onerror = null;
      resolve(value);
    };
    const timeout = setTimeout(() => finish(null), 12000);
    image.crossOrigin = "anonymous";
    image.onload = () => finish(image);
    image.onerror = () => finish(null);
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
      <output class="chart-tooltip" data-chart-tooltip aria-live="polite"></output>
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
  const width = 640;
  const height = 250;
  const left = 40;
  const right = 16;
  const top = 22;
  const bottom = 30;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const points = entries.map(([, value], index) => {
    const x = left + (entries.length === 1 ? plotWidth / 2 : (index / (entries.length - 1)) * plotWidth);
    const y = top + plotHeight - ((Number(value) || 0) / max) * plotHeight;
    return { x, y, value: Number(value) || 0 };
  });
  const line = points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const area = `${left},${height - bottom} ${line} ${width - right},${height - bottom}`;
  return chartShell(title, `
    <div class="chart-figure chart-figure--area">
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${title}">
        ${[0, 0.5, 1].map((fraction) => `<line x1="${left}" x2="${width - right}" y1="${top + plotHeight * fraction}" y2="${top + plotHeight * fraction}" class="chart-gridline"/><text x="${left - 10}" y="${top + plotHeight * fraction + 4}" text-anchor="end">${formatNumber(Math.round(max * (1 - fraction)))}</text>`).join("")}
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
  const allEntries = sortedCountEntries(counts);
  const entries = allEntries.slice(0, options.limit || 5);
  const remaining = allEntries.slice(entries.length).reduce((sum, [, value]) => sum + Number(value || 0), 0);
  if (remaining) entries.push(["Outros", remaining]);
  const labeler = options.labeler || ((value) => value);
  const total = entries.reduce((sum, [, value]) => sum + Number(value || 0), 0);
  if (!entries.length || !total) {
    return chartShell(title, `<p class="muted">${options.empty || "Sem dados registrados."}</p>`);
  }
  const colors = ["#2a7466", "#91c6b3", "#b88a3c", "#3e647e", "#a5aba8", "#726c81"];
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
      <output class="chart-tooltip" data-chart-tooltip aria-live="polite"></output>
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
  const instagramClickIdentities = Number(conversion.instagram_click_identities || instagramVisitors);
  const webviewOnlyVisitors = Number(conversion.webview_only_visitors || 0);
  const convertedVisitors = Number(conversion.instagram_to_direct_visitors || 0);
  const directSessions = Number(conversion.direct_sessions_after_instagram || 0);
  const rate = Number(conversion.instagram_to_direct_rate || 0);
  return `
    <article class="insight-chart conversion-chart">
      <p class="eyebrow">Instagram → Direto</p><h3>Retornos rastreáveis</h3>
      <div class="conversion-total"><strong>${formatNumber(convertedVisitors)}</strong><span>identidades retornaram<br>em acessos diretos</span><small>${formatPercentNumber(rate)}</small></div>
      <div class="conversion-journey"><div><strong>${formatNumber(instagramVisitors)}</strong><span>Instagram no navegador</span></div>${uiIcon("arrow-right")}<div><strong>${formatNumber(convertedVisitors)}</strong><span>Voltaram como direto</span></div></div>
      <p class="conversion-sessions">Essas <strong>${formatNumber(convertedVisitors)} identidades</strong> geraram <strong>${formatNumber(directSessions)} sessões diretas</strong> depois do Instagram. São pessoas identificadas e suas sessões, não duas contagens para somar.</p>
      <details class="conversion-method"><summary>Cobertura da medição</summary><p>${formatPercentNumber(conversion.tracking_coverage_rate || 0)} das ${formatNumber(instagramClickIdentities)} identidades antigas do Instagram. ${formatNumber(webviewOnlyVisitors)} ficaram somente no navegador interno e não entram na taxa principal. O retorno direto não confirma uma visita presencial ou compra.</p></details>
    </article>`;
}

function funnelStep(label, value, max) {
  const width = Math.min(100, Math.max(0, Math.round((Number(value || 0) / Number(max || 1)) * 100)));
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

function formatSourceDetailLabel(detail = "") {
  const key = String(detail || "sem_detalhe").trim().toLowerCase();
  const labels = {
    sem_detalhe: "Sem detalhe técnico",
    sem_referrer: "Sem referência enviada",
    ig: "Instagram identificado",
    instagram: "Instagram identificado",
    qr: "QR Code identificado",
    qrcode: "QR Code identificado",
    whatsapp: "WhatsApp identificado",
    google: "Pesquisa Google",
  };
  return labels[key] || String(detail || "Sem detalhe técnico");
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

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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
document.addEventListener("submit", async (event) => {
  const insightsFilter = event.target.closest("[data-insights-filter]");
  if (insightsFilter) {
    event.preventDefault();
    const filters = getInsightsFilters();
    if (filters.startDate && filters.endDate && filters.startDate > filters.endDate) {
      toast("A data inicial precisa ser anterior à data final.");
      return;
    }
    insightsFilter.querySelectorAll("[data-insights-preset]").forEach((button) => {
      button.classList.remove("is-active");
      button.setAttribute("aria-pressed", "false");
    });
    hydrateInsights(currentWorkspaceRestaurant(), { refreshAfterLoad: true });
    return;
  }

  const recoveryForm = event.target.closest("[data-owner-recovery]");
  const resetForm = event.target.closest("[data-owner-reset]");
  if (recoveryForm || resetForm) {
    event.preventDefault();
    const form = recoveryForm || resetForm;
    const button = form.querySelector('button[type="submit"]');
    if (button.disabled) return;
    const status = form.querySelector("[data-auth-status]");
    if (resetForm && !updatePasswordFeedback(form)) {
      status.textContent = passwordFeedback(form.elements.password.value, form.elements.confirmation.value).error; form.reportValidity(); return;
    }
    button.disabled = true;
    hidePasswords(form);
    status.textContent = "Aguarde...";
    try {
      if (recoveryForm) {
        await requestOwnerRecovery(form.elements.email.value.trim());
        form.reset();
        status.textContent = "Se o endereço estiver cadastrado, você receberá as instruções. Confira também a pasta de spam.";
      } else {
        await completeOwnerRecovery(form.elements.password.value);
        form.reset();
        window.location.hash = "#/hq";
        toast("Senha redefinida. Entre com a nova senha.");
      }
    } catch (error) {
      status.textContent = error.message === "too_many_attempts" ? authRetryMessage(error) : error.message === "recovery_unavailable"
        ? "A recuperação por e-mail está temporariamente indisponível. Tente novamente mais tarde."
        : recoveryForm ? "Se o endereço estiver cadastrado, você receberá as instruções. Aguarde antes de solicitar novamente."
        : "Não foi possível redefinir a senha. O link pode ter expirado ou já ter sido usado. Solicite um novo link.";
      if (error.message === "too_many_attempts") {
        const wait = Math.max(1, Number(error.retryAfter || 60));
        button.dataset.retryAt = String(Date.now() + wait * 1000);
        window.setTimeout(() => { delete button.dataset.retryAt; button.disabled = false; }, wait * 1000);
      }
    } finally { if (!button.dataset.retryAt) button.disabled = false; }
    return;
  }

  const ownerAccessForm = event.target.closest("[data-owner-access]");
  if (ownerAccessForm) {
    event.preventDefault();
    const submit = ownerAccessForm.querySelector('button[type="submit"]');
    if (submit.disabled) return;
    submit.disabled = true;
    const rawAccess = new FormData(ownerAccessForm).get("ownerAccessKey");
    const key = /^https?:\/\//i.test(String(rawAccess)) ? extractAccessParam(rawAccess, "key") : String(rawAccess || "");
    if (await hasOwnerAccess(new URLSearchParams({ key }))) {
      window.location.hash = ownerLink("overview");
      return;
    }
    submit.disabled = false;
    toast(ownerAccessError || "Não foi possível entrar. Tente novamente mais tarde.");
    return;
  }

  const clientAccessForm = event.target.closest("[data-client-access]");
  if (clientAccessForm) {
    event.preventDefault();
    const restaurant = getRestaurant(clientAccessForm.dataset.slug || ACTIVE_CLIENT_SLUG);
    const rawAccess = new FormData(clientAccessForm).get("clientAccessToken");
    const token = extractAccessParam(rawAccess, "token");
    if (await hasClientAccess(restaurant, new URLSearchParams({token}))) {
      window.location.hash = clientPortalLink(restaurant);
      return;
    }
    toast("Token do restaurante inválido.");
  }
});

document.addEventListener("click", async (event) => {
  const passwordToggle = event.target.closest("[data-password-toggle]");
  if (passwordToggle) {
    const input = document.getElementById(passwordToggle.getAttribute("aria-controls"));
    if (input) setPasswordVisibility(input, input.type === "password");
    return;
  }
  if (event.target.closest("[data-owner-logout]")) {
    event.preventDefault();
    try { await apiPost({action:"logoutOwner", owner_key: OWNER_SESSION_TOKEN}); }
    catch { toast("A saída local foi concluída. A sessão remota será encerrada ao expirar."); }
    clearOwnerSession();
    window.location.hash = "#/hq";
    renderOwnerGate();
    return;
  }
  const accessCopy = event.target.closest("[data-copy-client-access]");
  if (accessCopy) {
    event.preventDefault();
    if (accessCopy.disabled) return;
    accessCopy.disabled = true;
    try {
      const data = await apiGet("getRestaurantAccess", {slug: accessCopy.dataset.copyClientAccess, key: OWNER_SESSION_TOKEN});
      if (!data.token) throw new Error("missing_client_access");
      await copyToClipboard(absoluteAppUrl(`#/cliente/${encodeURIComponent(accessCopy.dataset.copyClientAccess)}?token=${encodeURIComponent(data.token)}`));
      toast("Link privado copiado. Compartilhe somente com os responsáveis do restaurante.");
    } catch (error) { toast(error.message === "too_many_attempts" ? authRetryMessage(error) : "Não foi possível obter o link privado. Entre novamente na gestão."); }
    finally { accessCopy.disabled = false; }
    return;
  }
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
    hydrateInsights(currentWorkspaceRestaurant());
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

// Remove the old offline shell; private screens and credentials must never be cached by it.
if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.getRegistrations().then(registrations => registrations.forEach(registration => registration.unregister())).catch(() => {});
    if ("caches" in window) caches.keys().then(keys => keys.forEach(key => caches.delete(key))).catch(() => {});
  });
}
