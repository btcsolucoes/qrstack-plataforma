const ASSETS = {
  qrstackMark: "assets/qrstack-mark.png",
  qrstackWordmark: "assets/qrstack-wordmark.png",
};

const QRSTACK_API_URL =
  "https://script.google.com/macros/s/AKfycbxb7McfZcNZ1FwpJ1WXKS1NURWjE8AQdK5X7CYAL0zNQIH2UQdtnKCKQjlzmyyuQwrcuQ/exec";
const ACTIVE_CLIENT_SLUG = "amaro";
const ACTIVE_CLIENT_TOKEN = "qrstack-amaro-2026";
const OWNER_ACCESS_TOKEN = "qrstack-berna-2026";
const AMARO_ASSETS_BASE_URL = "https://btcsolucoes.github.io/carda-pio/";

const DEFAULT_STATE = {
  restaurants: [
    {
      id: "rest_amaro",
      name: "Amaro Café",
      slug: "amaro",
      logoUrl: `${AMARO_ASSETS_BASE_URL}assets/amaro/amaro-logo.svg`,
      symbolUrl: `${AMARO_ASSETS_BASE_URL}assets/amaro/amaro-mark.svg`,
      primaryColor: "#1a2118",
      secondaryColor: "#b8973a",
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
      liveMenuEndpoint: "https://script.google.com/macros/s/AKfycbyB808ZoNNsP3c4QlTJU_Ny7bF2_8jPjuoLPU2_mgOs1BpXSNyKcIno6AtQgApTGyss/exec",
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
      storyLink: "",
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
  events: seedEvents(),
};

const STORE_KEY = "qrstack-platform-v2-amaro";
const app = document.getElementById("app");
let state = loadState();
let lastStoryDataUrl = "";

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

function seedEvents() {
  const now = Date.now();
  const source = ["qr", "instagram", "whatsapp", "bio", "direct"];
  const type = ["page_view", "page_view", "page_view", "whatsapp_click", "maps_click"];
  return Array.from({ length: 38 }, (_, index) => ({
    id: `event-${index}`,
    restaurantId: "rest_amaro",
    menuDayId: "menu_amaro_today",
    eventType: type[index % type.length],
    source: source[index % source.length],
    userAgent: "seed",
    referrer: "",
    ipHash: "",
    createdAt: new Date(now - index * 1000 * 60 * 60 * 5).toISOString(),
  }));
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
  const response = await fetch(url.toString(), { cache: "no-store" });
  const text = await response.text();
  if (!text.trim().startsWith("{")) throw new Error("api_not_public_or_not_json");
  const data = JSON.parse(text);
  if (!response.ok || data.ok === false) throw new Error(data.error || "api_request_failed");
  return data;
}

async function apiPost(payload) {
  if (!QRSTACK_API_URL) throw new Error("missing_api_url");
  const response = await fetch(QRSTACK_API_URL, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  if (!text.trim().startsWith("{")) throw new Error("api_not_public_or_not_json");
  const data = JSON.parse(text);
  if (!response.ok || data.ok === false) throw new Error(data.error || "api_request_failed");
  return data;
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
    symbolUrl: row.symbol_url || defaults.symbolUrl || ASSETS.qrstackMark,
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
  const hash = window.location.hash.replace(/^#\/?/, "");
  const [path, hashQuery = ""] = hash.split("?");
  const parts = path.split("/").filter(Boolean);
  const params = new URLSearchParams(hashQuery || window.location.search);
  const source = params.get("src") || "direct";

  if (!hash || parts[0] === "home") return renderHome();
  if (parts[0] === "hq" || parts[0] === "central") return renderOwnerRoute(parts[1] || "overview", params);
  if (parts[0] === "cliente" || parts[0] === "admin") return renderClientRoute(parts[1] || ACTIVE_CLIENT_SLUG, params);
  if (parts[0] === "r") return renderPublicMenu(parts[1] || ACTIVE_CLIENT_SLUG, source);
  renderHome();
}

function renderOwnerRoute(tab, params) {
  if (!hasOwnerAccess(params)) return renderOwnerGate();
  return renderHq(tab);
}

async function renderClientRoute(slug, params) {
  const restaurant = await syncRestaurantFromApi(slug);
  if (!hasClientAccess(restaurant, params)) return renderClientGate(restaurant);
  return renderClientPortal(slug);
}

function hasOwnerAccess(params) {
  return params.get("key") === OWNER_ACCESS_TOKEN;
}

function hasClientAccess(restaurant, params) {
  const token = params.get("token");
  const expectedToken = restaurant.adminToken || ACTIVE_CLIENT_TOKEN;
  return token === expectedToken;
}

function ownerLink(tab = "overview") {
  return `#/hq/${tab}?key=${encodeURIComponent(OWNER_ACCESS_TOKEN)}`;
}

function clientPortalLink(restaurant) {
  return `#/cliente/${restaurant.slug}?token=${encodeURIComponent(restaurant.adminToken || ACTIVE_CLIENT_TOKEN)}`;
}

function publicMenuHash(restaurant, source = "qr") {
  return `#/r/${restaurant.slug}?src=${source}`;
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

function setTheme(restaurant) {
  document.documentElement.style.setProperty("--primary", restaurant.primaryColor);
  document.documentElement.style.setProperty("--secondary", restaurant.secondaryColor);
  document.documentElement.style.setProperty("--accent", "#f4b740");
  document.documentElement.style.setProperty("--hero-mark", `url("${restaurant.symbolUrl}")`);
  document.documentElement.style.setProperty("--brand-pattern", `url("${restaurant.symbolUrl}")`);
}

function setSystemTheme() {
  document.documentElement.style.setProperty("--primary", "#0b2239");
  document.documentElement.style.setProperty("--secondary", "#27d39f");
  document.documentElement.style.setProperty("--accent", "#f4b740");
  document.documentElement.style.setProperty("--hero-mark", `url("${ASSETS.qrstackMark}")`);
  document.documentElement.style.setProperty("--brand-pattern", `url("${ASSETS.qrstackMark}")`);
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

function trackEvent(restaurant, eventType, source = "direct", menuDayId = null) {
  state.events.push({
    id: crypto.randomUUID(),
    restaurantId: restaurant.id,
    menuDayId,
    eventType,
    source,
    userAgent: navigator.userAgent,
    referrer: document.referrer,
    ipHash: "",
    createdAt: new Date().toISOString(),
  });
  saveState();
  apiPost({
    action: "trackEvent",
    slug: restaurant.slug,
    menu_day_id: menuDayId || "",
    event_type: eventType,
    source,
    user_agent: navigator.userAgent,
    referrer: document.referrer,
  }).catch((error) => console.warn("QrStack event API unavailable:", error.message));
}

function renderHome() {
  setSystemTheme();
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
          <a class="button" href="#/hq">Central QrStack</a>
          <a class="button secondary" href="#/cliente/${ACTIVE_CLIENT_SLUG}">Portal do restaurante</a>
          <a class="button ghost" href="${publicMenuHash(getRestaurant(ACTIVE_CLIENT_SLUG))}">Cardápio público</a>
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
        <div class="actions">
          <a class="button ghost" href="#/home">Voltar</a>
        </div>
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
        <div class="actions">
          <a class="button ghost" href="${publicMenuHash(restaurant)}">Ver cardápio público</a>
        </div>
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

function renderTopbar(links, restaurant = null) {
  const chip = restaurant
    ? `<a class="brand-chip" href="#/r/${restaurant.slug}"><img src="${restaurant.symbolUrl}" alt="" /><span>${restaurant.name}</span></a>`
    : `<a class="brand-chip" href="#/home"><img src="${ASSETS.qrstackMark}" alt="" /><span>QrStack</span></a>`;
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
          <p class="copy-url">${privateUrl}</p>
              <div class="actions">
            <a class="button" href="${publicMenuHash(restaurant, "hq")}">Abrir cardápio</a>
            <a class="button secondary" href="${clientPortalLink(restaurant)}">Atualizar</a>
            <button type="button" class="secondary" data-copy="${escapeAttr(privateUrl)}">Copiar acesso</button>
            <button type="button" class="ghost" data-copy="${escapeAttr(publicUrl)}">Copiar público</button>
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
  return `
    <section class="section">
      <div class="section__head">
        <p class="eyebrow">Insights internos</p>
        <h2>Acesso e conversão</h2>
        <p>Essa área fica só para você na QrStack, não aparece no acesso simplificado do restaurante.</p>
      </div>
      <div class="grid grid--three">
        ${metric("Últimos 7 dias", lastDaysEvents(7).length)}
        ${metric("WhatsApp", clicksWhats)}
        ${metric("Como chegar", clicksMaps)}
      </div>
      <div class="grid">
        <div class="card">
          <h3>Origem dos acessos</h3>
          <div class="table">
            ${Object.entries(grouped)
              .map(([source, events]) => `<div class="table-row"><span>${source}</span><strong>${events.length}</strong></div>`)
              .join("")}
          </div>
        </div>
        <div class="card">
          <h3>Horário de pico</h3>
          <p class="muted">${peakHour()}</p>
        </div>
      </div>
    </section>
  `;
}

async function renderClientPortal(slug) {
  const remote = await syncMenuFromApi(slug);
  const currentHash = window.location.hash.replace(/^#\/?/, "");
  if (!currentHash.startsWith(`cliente/${slug}`) && !currentHash.startsWith(`admin/${slug}`)) return;
  const restaurant = remote.restaurant || (await syncRestaurantFromApi(slug));
  const menu = remote.menu || createBlankMenu(restaurant.id);
  const menuItems = remote.items.length ? remote.items : getMenuItems(menu.id);
  const storyLink = menu.storyLink || restaurantPublicUrl(restaurant);
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
      <main class="client-form-page">
        <section class="section client-step">
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
              <button type="submit">Enviar</button>
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
    formData.set("storyLink", storyLinkInput?.value || restaurantPublicUrl(restaurant));
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

async function renderPublicMenu(slug, source = "direct") {
  const remote = await syncMenuFromApi(slug);
  if (!window.location.hash.replace(/^#\/?/, "").startsWith(`r/${slug}`)) return;
  const restaurant = remote.restaurant;
  const menu = remote.menu;
  const menuItems = remote.items;
  const groups = groupBy(menuItems, "category");
  const useCanonicalCatalog = restaurant.slug === "amaro";
  const liveLunchItems = useCanonicalCatalog ? await fetchLiveLunchItems(restaurant) : [];
  setTheme(restaurant);
  if (menu) trackEvent(restaurant, "page_view", source, menu.id);
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

function drawStory(restaurant, menu, menuItems) {
  const canvas = document.getElementById("story-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  const highlights = menuItems.filter((menuItem) => menuItem.isHighlight).slice(0, 6);
  const storyLink = menu.storyLink || restaurantPublicUrl(restaurant);
  const storyLinkLabel = formatStoryLink(storyLink);
  Promise.all([loadCanvasImage(restaurant.logoUrl), loadCanvasImage(restaurant.symbolUrl)]).then(([logo, mark]) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, restaurant.primaryColor);
    gradient.addColorStop(0.58, colorMix(restaurant.secondaryColor, "#ffffff", 0.72));
    gradient.addColorStop(1, colorMix(restaurant.secondaryColor, "#ffffff", 0.45));
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

    ctx.fillStyle = "rgba(255,255,255,0.88)";
    roundRect(ctx, 84, 110, w - 168, h - 220, 28);
    ctx.fill();

    if (logo) {
      drawImageContain(ctx, logo, 250, 172, w - 500, 220);
    } else if (mark) {
      drawImageContain(ctx, mark, w / 2 - 110, 180, 220, 220);
    }
    ctx.textAlign = "center";
    ctx.fillStyle = restaurant.secondaryColor;
    ctx.font = "800 42px Manrope";
    ctx.fillText("CARDÁPIO DO DIA", w / 2, 495);

    ctx.fillStyle = restaurant.primaryColor;
    ctx.font = "800 94px Sora";
    wrapCanvasText(ctx, menu.title || "Buffet de hoje", w / 2, 630, w - 220, 104, 2);

    ctx.fillStyle = "#6f416c";
    ctx.font = "700 38px Manrope";
    ctx.fillText(formatDate(menu.date), w / 2, 820);

    ctx.textAlign = "left";
    let y = 940;
    highlights.forEach((entry) => {
      ctx.fillStyle = restaurant.primaryColor;
      ctx.font = "800 44px Manrope";
      ctx.fillText("•", 178, y);
      ctx.fillStyle = "#42213e";
      ctx.font = "800 44px Manrope";
      wrapCanvasText(ctx, entry.name, 222, y, w - 350, 52, 1);
      y += 92;
    });

    ctx.textAlign = "center";
    ctx.fillStyle = restaurant.primaryColor;
    roundRect(ctx, 210, 1430, w - 420, 118, 22);
    ctx.fill();
    ctx.fillStyle = "white";
    ctx.font = "900 48px Manrope";
    ctx.fillText(priceSummary(menu, menuItems), w / 2, 1504);

    ctx.fillStyle = "#6f416c";
    ctx.font = "700 34px Manrope";
    ctx.fillText(menu.serviceHours || "Confira o horário no cardápio", w / 2, 1618);
    ctx.fillStyle = restaurant.primaryColor;
    ctx.font = "900 38px Manrope";
    ctx.fillText("TOQUE NO LINK DO STORY", w / 2, 1718);
    ctx.fillStyle = "#42213e";
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
  const storyLink = menu?.storyLink || document.querySelector('[name="storyLink"]')?.value || restaurantPublicUrl(restaurant);
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
document.addEventListener("click", async (event) => {
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
