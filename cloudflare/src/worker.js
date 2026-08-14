const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

const READ_CACHE_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "public, max-age=20, stale-while-revalidate=240",
};

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type, authorization",
};

const EVENT_COLUMNS = [
  "id", "restaurant_id", "restaurant_slug", "menu_day_id", "event_type", "source",
  "source_detail", "url", "path", "referrer", "user_agent", "language",
  "session_id", "visitor_id", "dish_name", "dish_key", "dish_category",
  "duration_ms", "observe_seconds", "device_type", "browser", "os", "screen",
  "viewport", "timezone_offset", "banner_shown", "banner_platform", "created_at",
];

export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

    try {
      const url = new URL(request.url);
      const payload = request.method === "POST" ? await readPayload(request) : {};
      const action = request.method === "POST"
        ? payload.action || url.searchParams.get("action") || "trackEvent"
        : url.searchParams.get("action") || "health";

      if (action === "health") {
        return jsonp(url, { ok: true, service: "qrstack-d1", version: "d1-v1" });
      }

      if (action === "trackEvent") {
        const eventPayload = request.method === "POST" ? payload : Object.fromEntries(url.searchParams);
        const event = await trackEvent(env.DB, eventPayload, request);
        return json({ ok: true, event }, 201);
      }

      if (action === "getInsights") {
        assertOwner(url.searchParams, request, env);
        const cacheRequest = insightsCacheRequest(request);
        const cachedResponse = cacheRequest ? await caches.default.match(cacheRequest) : null;
        if (cachedResponse) return cachedResponse;
        const slug = url.searchParams.get("slug") || "amaro";
        const insights = await getInsights(env.DB, {
          slug,
          startDate: normalizeDate(url.searchParams.get("startDate") || url.searchParams.get("start_date")),
          endDate: normalizeDate(url.searchParams.get("endDate") || url.searchParams.get("end_date")),
        });
        const response = jsonp(url, {
          ok: true,
          restaurant: { slug, name: insights.restaurant_name || slug },
          insights,
        }, 200, READ_CACHE_HEADERS);
        if (cacheRequest && request.method === "GET" && !url.searchParams.get("callback")) {
          ctx.waitUntil(caches.default.put(cacheRequest, response.clone()));
        }
        return response;
      }

      if (action === "getRestaurant") {
        const slug = url.searchParams.get("slug") || "amaro";
        return jsonp(url, { ok: true, restaurant: await getRestaurant(env.DB, slug) });
      }

      if (action === "getCatalog") {
        const slug = url.searchParams.get("slug") || "amaro";
        return jsonp(url, { ok: true, ...(await getCatalog(env.DB, slug)) }, 200, READ_CACHE_HEADERS);
      }

      if (action === "getMenu") {
        const slug = url.searchParams.get("slug") || "amaro";
        const date = normalizeDate(url.searchParams.get("date"));
        return jsonp(url, { ok: true, ...(await getMenu(env.DB, slug, date)) }, 200, READ_CACHE_HEADERS);
      }

      if (action === "saveMenuDay") {
        if (request.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);
        return json({ ok: true, ...(await saveMenuDay(env.DB, payload)) });
      }

      return jsonp(url, { ok: false, error: "unknown_action", action }, 404);
    } catch (error) {
      return json({ ok: false, error: error.message || String(error) }, error.status || 500);
    }
  },
};

async function readPayload(request) {
  const text = await request.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return Object.fromEntries(new URLSearchParams(text));
  }
}

function assertOwner(params, request, env) {
  const expected = env.OWNER_ACCESS_TOKEN || "qrstack-berna-2026";
  const received = params.get("key") || params.get("owner_key") || request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!received || received !== expected) {
    const error = new Error("unauthorized");
    error.status = 401;
    throw error;
  }
}

function insightsCacheRequest(request) {
  if (request.method !== "GET") return null;
  const url = new URL(request.url);
  if (url.searchParams.get("callback")) return null;
  const action = url.searchParams.get("action") || "health";
  if (action !== "getInsights") return null;
  const cacheUrl = new URL(url.origin + url.pathname);
  cacheUrl.searchParams.set("action", "getInsights");
  cacheUrl.searchParams.set("slug", normalizeSlug(url.searchParams.get("slug") || "amaro"));
  const startDate = normalizeDate(url.searchParams.get("startDate") || url.searchParams.get("start_date"));
  const endDate = normalizeDate(url.searchParams.get("endDate") || url.searchParams.get("end_date"));
  if (startDate) cacheUrl.searchParams.set("startDate", startDate);
  if (endDate) cacheUrl.searchParams.set("endDate", endDate);
  return new Request(cacheUrl.toString(), { method: "GET" });
}

async function getRestaurant(db, slug) {
  return db.prepare("SELECT * FROM restaurants WHERE slug = ? LIMIT 1").bind(slug).first();
}

async function requireRestaurant(db, slug) {
  const restaurant = await getRestaurant(db, slug);
  if (restaurant) return restaurant;
  const id = `rest_${slug}`;
  await db.prepare("INSERT INTO restaurants (id, slug, name) VALUES (?, ?, ?)").bind(id, slug, titleize(slug)).run();
  return getRestaurant(db, slug);
}

async function trackEvent(db, payload, request) {
  const slug = normalizeSlug(payload.slug || payload.cliente || payload.restaurant_slug || "amaro");
  const restaurant = await requireRestaurant(db, slug);
  const userAgent = payload.user_agent || payload.userAgent || request.headers.get("user-agent") || "";
  const device = detectDevice(userAgent);
  const dishName = payload.dish_name || payload.item_name || payload.prato || "";
  const event = {
    id: payload.id || crypto.randomUUID(),
    restaurant_id: restaurant.id,
    restaurant_slug: restaurant.slug,
    menu_day_id: payload.menu_day_id || payload.menuDayId || "",
    event_type: normalizeEventType(payload.event_type || payload.tipo || "page_view"),
    source: normalizeSource(payload.source || payload.origem || payload.utm_source || "direct"),
    source_detail: payload.source_detail || payload.sourceDetail || payload.referrer || "",
    url: payload.url || "",
    path: payload.path || "",
    referrer: payload.referrer || "",
    user_agent: userAgent,
    language: payload.language || payload.idioma || "",
    session_id: payload.session_id || payload.sessionId || "",
    visitor_id: payload.visitor_id || payload.visitorId || "",
    dish_name: dishName,
    dish_key: payload.dish_key || normalizeKey(dishName),
    dish_category: payload.dish_category || payload.item_category || payload.categoria || "",
    duration_ms: toInteger(payload.duration_ms || payload.durationMs),
    observe_seconds: toInteger(payload.observe_seconds || payload.observeSeconds),
    device_type: payload.device_type || payload.deviceType || device.type,
    browser: payload.browser || device.browser,
    os: payload.os || device.os,
    screen: payload.screen || "",
    viewport: payload.viewport || "",
    timezone_offset: payload.timezone_offset || payload.timezoneOffset || "",
    banner_shown: toBooleanInteger(payload.banner_shown ?? payload.bannerShown),
    banner_platform: payload.banner_platform || payload.bannerPlatform || "",
    created_at: normalizeTimestamp(payload.timestamp || payload.created_at) || new Date().toISOString(),
  };

  await db.prepare(
    `INSERT OR IGNORE INTO analytics_events (${EVENT_COLUMNS.join(", ")}) VALUES (${EVENT_COLUMNS.map(() => "?").join(", ")})`
  ).bind(...EVENT_COLUMNS.map((column) => event[column] ?? "")).run();

  return event;
}

async function getInsights(db, filters) {
  const restaurant = await requireRestaurant(db, normalizeSlug(filters.slug));
  const bounds = buildDateBounds(filters);
  const period = eventWhere(restaurant.slug, bounds);
  const all = eventWhere(restaurant.slug);
  const periodPageViews = eventWhere(restaurant.slug, bounds, "event_type = 'page_view'");
  const allPageViews = eventWhere(restaurant.slug, null, "event_type = 'page_view'");
  const todayPageViews = eventWhere(restaurant.slug, { start: `${todayIso()}T00:00:00.000Z`, endExclusive: `${addDays(todayIso(), 1)}T00:00:00.000Z` }, "event_type = 'page_view'");
  const sevenDaysPageViews = eventWhere(restaurant.slug, { start: `${daysAgoIso(6)}T00:00:00.000Z` }, "event_type = 'page_view'");
  const dishViews = eventWhere(restaurant.slug, bounds, "event_type = 'dish_view' AND COALESCE(dish_name, '') <> ''");
  const dishTouches = eventWhere(restaurant.slug, bounds, "event_type = 'dish_touch' AND COALESCE(dish_name, '') <> ''");
  const dishObserves = eventWhere(restaurant.slug, bounds, "event_type = 'dish_observe' AND COALESCE(dish_name, '') <> ''");
  const webviewBanner = eventWhere(restaurant.slug, bounds, "banner_shown = 1");

  const [
    totalEvents, periodEvents, totalAccesses, periodAccesses, accessesToday, accesses7Days,
    uniqueSessionsPeriod, uniqueSessionsTotal, sourceCounts, eventTypeCounts, eventTypeCountsAll,
    dailyAccesses, hourCounts, deviceCounts, browserCounts, osCounts, dishViewCounts,
    dishTouchCounts, dishObserveSeconds, dishCategoryCounts, dishTouchCategoryCounts,
    dishObserveCategorySeconds, totalDishObserveSeconds, webviewBannerShown,
    webviewBannerPlatformCounts, instagramToDirect, recentEvents,
  ] = await Promise.all([
    scalarCount(db, all),
    scalarCount(db, period),
    scalarCount(db, allPageViews),
    scalarCount(db, periodPageViews),
    scalarCount(db, todayPageViews),
    scalarCount(db, sevenDaysPageViews),
    scalarDistinctCount(db, period, "session_id"),
    scalarDistinctCount(db, all, "session_id"),
    groupedCounts(db, periodPageViews, "source"),
    groupedCounts(db, period, "event_type"),
    groupedCounts(db, all, "event_type"),
    groupedCounts(db, periodPageViews, "substr(created_at, 1, 10)"),
    groupedCounts(db, periodPageViews, "substr(created_at, 12, 2)"),
    groupedCounts(db, periodPageViews, "device_type"),
    groupedCounts(db, periodPageViews, "browser"),
    groupedCounts(db, periodPageViews, "os"),
    groupedCounts(db, dishViews, "dish_name"),
    groupedCounts(db, dishTouches, "dish_name"),
    groupedSums(db, dishObserves, "dish_name", "observe_seconds"),
    groupedCounts(db, dishViews, "dish_category"),
    groupedCounts(db, dishTouches, "dish_category"),
    groupedSums(db, dishObserves, "dish_category", "observe_seconds"),
    scalarSum(db, dishObserves, "observe_seconds"),
    scalarCount(db, webviewBanner),
    groupedCounts(db, webviewBanner, "banner_platform"),
    instagramToDirectQuery(db, restaurant.slug, bounds),
    recentEventsQuery(db, period, 15),
  ]);

  const dishAttentionScores = {};
  mergeScore(dishAttentionScores, dishViewCounts, 1);
  mergeScore(dishAttentionScores, dishTouchCounts, 3);
  mergeScore(dishAttentionScores, dishObserveSeconds, 0.2);

  return {
    restaurant_name: restaurant.name,
    provider: "cloudflare_d1",
    period_label: periodLabel(filters.startDate, filters.endDate),
    collected_at: new Date().toISOString(),
    total_events: totalEvents,
    period_events: periodEvents,
    total_accesses: totalAccesses,
    total_page_views: totalAccesses,
    period_accesses: periodAccesses,
    filtered_accesses: periodAccesses,
    accesses_today: accessesToday,
    accesses_7_days: accesses7Days,
    unique_sessions_period: uniqueSessionsPeriod,
    unique_sessions_total: uniqueSessionsTotal,
    source_counts: sourceCounts,
    event_type_counts: eventTypeCounts,
    event_type_counts_all: eventTypeCountsAll,
    daily_accesses: dailyAccesses,
    hour_counts: hourCounts,
    peak_hour: peakHourFromCounts(hourCounts),
    device_counts: deviceCounts,
    browser_counts: browserCounts,
    os_counts: osCounts,
    dish_view_counts: dishViewCounts,
    dish_touch_counts: dishTouchCounts,
    dish_observe_seconds: dishObserveSeconds,
    dish_attention_scores: dishAttentionScores,
    dish_view_category_counts: dishCategoryCounts,
    dish_touch_category_counts: dishTouchCategoryCounts,
    dish_observe_category_seconds: dishObserveCategorySeconds,
    webview_banner_shown: webviewBannerShown,
    webview_banner_platform_counts: webviewBannerPlatformCounts,
    instagram_to_direct: instagramToDirect,
    total_dish_views: sumObjectValues(dishViewCounts),
    total_dish_touches: sumObjectValues(dishTouchCounts),
    total_dish_observe_seconds: totalDishObserveSeconds,
    recent_events: recentEvents,
  };
}

async function getCatalog(db, slug) {
  const restaurant = await requireRestaurant(db, normalizeSlug(slug));
  const items = await db.prepare(`
    SELECT * FROM catalog_items
    WHERE restaurant_id = ? AND is_active = 1
    ORDER BY section_id, sort_order, name
  `).bind(restaurant.id).all();
  const assets = await db.prepare(`
    SELECT * FROM restaurant_assets
    WHERE restaurant_id = ?
    ORDER BY asset_type, label
  `).bind(restaurant.id).all();
  return { restaurant, items: items.results || [], assets: assets.results || [] };
}

async function getMenu(db, slug, date = "") {
  const restaurant = await requireRestaurant(db, normalizeSlug(slug));
  const menu = date
    ? await db.prepare("SELECT * FROM menu_days WHERE restaurant_id = ? AND date = ? ORDER BY updated_at DESC LIMIT 1")
      .bind(restaurant.id, date).first()
    : await db.prepare("SELECT * FROM menu_days WHERE restaurant_id = ? ORDER BY date DESC, updated_at DESC LIMIT 1")
      .bind(restaurant.id).first();
  if (!menu) return { restaurant, menu: null, items: [] };
  const items = await db.prepare("SELECT * FROM menu_items WHERE menu_day_id = ? ORDER BY sort_order, name")
    .bind(menu.id).all();
  return { restaurant, menu, items: items.results || [] };
}

async function saveMenuDay(db, payload) {
  const slug = normalizeSlug(payload.slug || "amaro");
  const restaurant = await requireRestaurant(db, slug);
  assertRestaurantToken(restaurant, payload.token);
  const date = normalizeDate(payload.date) || todayIso();
  const menuId = payload.menu_id || payload.menuId || `menu_${slug}_${date}`;
  const now = new Date().toISOString();
  const rawItems = Array.isArray(payload.items) ? payload.items : [];
  const items = rawItems.slice(0, 30).filter((item) => item && String(item.name || "").trim());
  const incomingMenu = {
    title: String(payload.title || "Cardápio de hoje"),
    price: String(payload.price || ""),
    service_hours: String(payload.service_hours || payload.serviceHours || ""),
    story_link: String(payload.story_link || payload.storyLink || restaurant.story_link || ""),
    notes: String(payload.notes || ""),
  };
  const incomingItems = items.map((item, index) => ({
    name: String(item.name),
    category: String(item.category || "Executivo"),
    description: String(item.description || ""),
    price: String(item.price || ""),
    image_url: String(item.image_url || item.imageUrl || ""),
    is_highlight: toBooleanInteger(item.is_highlight ?? item.isHighlight),
    sort_order: Number(item.sort_order || item.sortOrder || index + 1),
  }));
  const existingMenu = await db.prepare("SELECT * FROM menu_days WHERE id = ? AND restaurant_id = ? LIMIT 1")
    .bind(menuId, restaurant.id).first();
  if (existingMenu) {
    const existingItemsResult = await db.prepare("SELECT * FROM menu_items WHERE menu_day_id = ? ORDER BY sort_order, name")
      .bind(menuId).all();
    const existingItems = existingItemsResult.results || [];
    if (menuContentFingerprint(existingMenu, existingItems) === menuContentFingerprint(incomingMenu, incomingItems)) {
      return { ...(await getMenu(db, slug, date)), duplicate: true };
    }
  }

  const statements = [
    db.prepare(`
      INSERT INTO menu_days (
        id, restaurant_id, date, title, price, service_hours, story_link, notes,
        is_published, published_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        date = excluded.date,
        title = excluded.title,
        price = excluded.price,
        service_hours = excluded.service_hours,
        story_link = excluded.story_link,
        notes = excluded.notes,
        is_published = 1,
        published_at = excluded.published_at,
        updated_at = excluded.updated_at
    `).bind(
      menuId,
      restaurant.id,
      date,
      incomingMenu.title,
      incomingMenu.price,
      incomingMenu.service_hours,
      incomingMenu.story_link,
      incomingMenu.notes,
      now,
      now,
      now
    ),
    db.prepare("DELETE FROM menu_items WHERE menu_day_id = ?").bind(menuId),
    ...incomingItems.map((item, index) => db.prepare(`
      INSERT INTO menu_items (
        id, menu_day_id, name, category, description, price, image_url,
        is_highlight, sort_order, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      `item_${menuId}_${index + 1}_${normalizeKey(item.name).slice(0, 40)}`,
      menuId,
      item.name,
      item.category,
      item.description,
      item.price,
      item.image_url,
      item.is_highlight,
      item.sort_order,
      now
    )),
  ];
  await db.batch(statements);
  return { ...(await getMenu(db, slug, date)), duplicate: false };
}

function menuContentFingerprint(menu, items) {
  const clean = (value) => String(value || "").trim();
  return JSON.stringify({
    title: clean(menu.title),
    price: clean(menu.price),
    service_hours: clean(menu.service_hours),
    story_link: clean(menu.story_link),
    notes: clean(menu.notes),
    items: (items || []).map((item, index) => ({
      name: clean(item.name),
      category: clean(item.category || "Executivo"),
      description: clean(item.description),
      price: clean(item.price),
      image_url: clean(item.image_url),
      is_highlight: toBooleanInteger(item.is_highlight),
      sort_order: Number(item.sort_order || index + 1),
    })),
  });
}

function assertRestaurantToken(restaurant, receivedToken) {
  const expected = String(restaurant.admin_token || "");
  if (!expected || String(receivedToken || "") !== expected) {
    const error = new Error("unauthorized");
    error.status = 401;
    throw error;
  }
}

function eventWhere(slug, bounds = null, extraSql = "") {
  const normalizedBounds = bounds || {};
  const clauses = ["restaurant_slug = ?", "is_test_event = 0"];
  const params = [slug];
  if (normalizedBounds.start) {
    clauses.push("created_at >= ?");
    params.push(normalizedBounds.start);
  }
  if (normalizedBounds.endExclusive) {
    clauses.push("created_at < ?");
    params.push(normalizedBounds.endExclusive);
  }
  if (extraSql) clauses.push(extraSql);
  return { sql: clauses.join(" AND "), params };
}

async function scalarCount(db, where) {
  const row = await db.prepare(`SELECT COUNT(*) AS total FROM analytics_events_normalized WHERE ${where.sql}`).bind(...where.params).first();
  return Number(row?.total || 0);
}

async function scalarDistinctCount(db, where, column) {
  const row = await db.prepare(`SELECT COUNT(DISTINCT ${column}) AS total FROM analytics_events_normalized WHERE ${where.sql} AND COALESCE(${column}, '') <> ''`).bind(...where.params).first();
  return Number(row?.total || 0);
}

async function scalarSum(db, where, column) {
  const row = await db.prepare(`SELECT COALESCE(SUM(CAST(${column} AS INTEGER)), 0) AS total FROM analytics_events_normalized WHERE ${where.sql}`).bind(...where.params).first();
  return Number(row?.total || 0);
}

async function groupedCounts(db, where, columnExpression) {
  const rows = await db.prepare(`
    SELECT COALESCE(NULLIF(${columnExpression}, ''), 'Não identificado') AS key, COUNT(*) AS value
    FROM analytics_events_normalized
    WHERE ${where.sql}
    GROUP BY key
    ORDER BY value DESC
    LIMIT 100
  `).bind(...where.params).all();
  return rowsToObject(rows.results || []);
}

async function groupedSums(db, where, groupExpression, sumColumn) {
  const rows = await db.prepare(`
    SELECT COALESCE(NULLIF(${groupExpression}, ''), 'Não identificado') AS key, COALESCE(SUM(CAST(${sumColumn} AS INTEGER)), 0) AS value
    FROM analytics_events_normalized
    WHERE ${where.sql}
    GROUP BY key
    ORDER BY value DESC
    LIMIT 100
  `).bind(...where.params).all();
  return rowsToObject(rows.results || []);
}

async function recentEventsQuery(db, where, limit) {
  const rows = await db.prepare(`
    SELECT created_at, event_type, source, source_detail, dish_name, dish_category, observe_seconds, device_type
    FROM analytics_events_normalized
    WHERE ${where.sql}
    ORDER BY created_at DESC
    LIMIT ?
  `).bind(...where.params, limit).all();
  return rows.results || [];
}

async function instagramToDirectQuery(db, slug, bounds) {
  const pageViews = eventWhere(slug, bounds, "event_type = 'page_view' AND COALESCE(visitor_id, '') <> ''");
  const row = await db.prepare(`
    WITH pageviews AS (
      SELECT visitor_id, session_id, source, created_at
      FROM analytics_events_normalized
      WHERE ${pageViews.sql}
    ),
    instagram_visitors AS (
      SELECT visitor_id, MIN(created_at) AS first_instagram_at
      FROM pageviews
      WHERE source = 'instagram'
      GROUP BY visitor_id
    ),
    direct_after_instagram AS (
      SELECT p.visitor_id,
             MIN(p.created_at) AS first_direct_after_instagram_at,
             COUNT(DISTINCT p.session_id) AS direct_sessions_after_instagram
      FROM pageviews p
      JOIN instagram_visitors i ON i.visitor_id = p.visitor_id
      WHERE p.source = 'direct'
        AND p.created_at > i.first_instagram_at
      GROUP BY p.visitor_id
    )
    SELECT
      (SELECT COUNT(*) FROM instagram_visitors) AS instagram_visitors,
      (SELECT COUNT(*) FROM direct_after_instagram) AS instagram_to_direct_visitors,
      (SELECT COALESCE(SUM(direct_sessions_after_instagram), 0) FROM direct_after_instagram) AS direct_sessions_after_instagram
  `).bind(...pageViews.params).first();
  const instagramVisitors = Number(row?.instagram_visitors || 0);
  const convertedVisitors = Number(row?.instagram_to_direct_visitors || 0);
  return {
    instagram_visitors: instagramVisitors,
    instagram_to_direct_visitors: convertedVisitors,
    direct_sessions_after_instagram: Number(row?.direct_sessions_after_instagram || 0),
    instagram_to_direct_rate: instagramVisitors ? Number(((convertedVisitors / instagramVisitors) * 100).toFixed(2)) : 0,
  };
}

function json(payload, status = 200, headers = JSON_HEADERS) {
  return new Response(JSON.stringify(payload), { status, headers: { ...headers, ...CORS_HEADERS } });
}

function jsonp(url, payload, status = 200, headers = JSON_HEADERS) {
  const callback = url.searchParams.get("callback");
  if (!callback) return json(payload, status, headers);
  const safeCallback = callback.replace(/[^\w.$]/g, "");
  return new Response(`${safeCallback}(${JSON.stringify(payload)});`, {
    status,
    headers: { ...headers, ...CORS_HEADERS, "content-type": "application/javascript; charset=utf-8" },
  });
}

function buildDateBounds(filters) {
  const start = normalizeDate(filters.startDate);
  const end = normalizeDate(filters.endDate);
  return {
    start: start ? `${start}T00:00:00.000Z` : "",
    endExclusive: end ? `${addDays(end, 1)}T00:00:00.000Z` : "",
  };
}

function normalizeDate(value) {
  const text = String(value || "").trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : "";
}

function normalizeTimestamp(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function normalizeSlug(value) {
  return normalizeKey(value).replace(/\s+/g, "-") || "amaro";
}

function normalizeEventType(value) {
  const text = normalizeKey(value);
  if (text === "pageview" || text === "page view" || text === "access" || text === "acesso") return "page_view";
  return text.replace(/\s+/g, "_") || "page_view";
}

function normalizeSource(value) {
  const text = normalizeKey(value);
  if (!text || text === "direto" || text === "direct") return "direct";
  if (/\b(qr|qrcode|qr code|mesa|table)\b/.test(text)) return "qr";
  if (text.includes("whatsapp") || text === "wa" || text.includes("wpp") || text.includes("wa me")) return "whatsapp";
  if (text.includes("instagram") || text.includes("instagr") || text === "ig" || text.includes("stories")) return "instagram";
  if (text.includes("google") || text.includes("pesquisa") || text.includes("search") || text.includes("organic")) return "google";
  if (text.includes("bing") || text.includes("yahoo") || text.includes("duckduckgo")) return "search";
  if (text.includes("facebook") || text === "fb") return "facebook";
  if (text.includes("tiktok")) return "tiktok";
  if (text.includes("codex") || text.includes("teste") || text.includes("test")) return text.replace(/\s+/g, "_");
  return "internet";
}

function normalizeKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function detectDevice(userAgent) {
  const ua = userAgent || "";
  const isTablet = /iPad|Tablet/i.test(ua);
  const isMobile = /Mobile|Android|iPhone|iPod/i.test(ua);
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : /Firefox\//.test(ua) ? "Firefox" : "Outro";
  const os = /Android/i.test(ua) ? "Android" : /iPhone|iPad|iPod/i.test(ua) ? "iOS" : /Windows/i.test(ua) ? "Windows" : /Mac OS/i.test(ua) ? "macOS" : /Linux/i.test(ua) ? "Linux" : "Outro";
  return { type: isTablet ? "tablet" : isMobile ? "mobile" : "desktop", browser, os };
}

function rowsToObject(rows) {
  return rows.reduce((acc, row) => {
    acc[row.key] = Number(row.value || 0);
    return acc;
  }, {});
}

function mergeScore(target, values, weight) {
  Object.entries(values).forEach(([key, value]) => {
    const current = Number(target[key] || 0);
    target[key] = Number((current + Number(value || 0) * weight).toFixed(1));
  });
}

function sumObjectValues(values) {
  return Object.values(values || {}).reduce((total, value) => total + Number(value || 0), 0);
}

function peakHourFromCounts(counts) {
  const entries = Object.entries(counts || {}).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return "";
  const [hour, count] = entries[0];
  return `${hour}h com ${count} acesso${count === 1 ? "" : "s"}`;
}

function periodLabel(startDate, endDate) {
  if (!startDate && !endDate) return "Todos os tempos";
  if (startDate && endDate && startDate === endDate) return startDate;
  return `${startDate || "início"} até ${endDate || todayIso()}`;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIso(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - Number(days || 0));
  return date.toISOString().slice(0, 10);
}

function addDays(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + Number(days || 0));
  return date.toISOString().slice(0, 10);
}

function toInteger(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? Math.round(number) : 0;
}

function toBooleanInteger(value) {
  if (value === true || value === 1 || value === "1") return 1;
  if (typeof value === "string" && value.toLowerCase() === "true") return 1;
  return 0;
}

function titleize(value) {
  return String(value || "").replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
