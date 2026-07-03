const SPREADSHEET_ID = '1v4dr2zVOuvcPJJ02Ah6V-AXsK0d8I6DVGIpMcSe8NmU';
const OWNER_ACCESS_TOKEN = 'qrstack-berna-2026';

const SHEETS = {
  restaurants: 'restaurants',
  menuDays: 'menu_days',
  menuItems: 'menu_items',
  storyAssets: 'story_assets',
  events: 'events',
  settings: 'settings',
  catalogItems: 'catalog_items',
  formFields: 'form_fields',
  formOptions: 'form_options',
};

function doGet(e) {
  try {
    const params = e && e.parameter ? e.parameter : {};
    const action = params.action || 'health';

    if (action === 'health') {
      return json({ ok: true, environment: 'sandbox', version: 'qrstack-sheets-v1' });
    }

    if (action === 'getRestaurant') {
      return json({ ok: true, restaurant: getRestaurantBySlug(params.slug) });
    }

    if (action === 'getMenu') {
      const restaurant = getRestaurantBySlug(params.slug);
      const menu = getMenuForDate(restaurant.id, params.date || todayIso());
      return json({
        ok: true,
        restaurant,
        menu,
        items: menu ? getItemsByMenuDay(menu.id) : [],
      });
    }

    if (action === 'getCatalog') {
      const restaurant = getRestaurantBySlug(params.slug);
      return json({ ok: true, restaurant, catalog: getCatalogByRestaurant(restaurant.id) });
    }

    if (action === 'getRestaurantDatabase') {
      const restaurant = getRestaurantBySlug(params.slug);
      return json({ ok: true, ...getRestaurantDatabase(restaurant) });
    }

    if (action === 'getFormSchema') {
      const restaurant = getRestaurantBySlug(params.slug);
      return json({ ok: true, restaurant, fields: getFormSchemaByRestaurant(restaurant.id) });
    }

    if (action === 'getInsights') {
      assertOwner(params.owner_key || params.key);
      const restaurant = getRestaurantBySlug(params.slug);
      return json({
        ok: true,
        restaurant,
        insights: getInsights(restaurant.id, {
          startDate: params.startDate || params.start_date || params.start,
          endDate: params.endDate || params.end_date || params.end,
        }),
      }, params.callback);
    }

    if (action === 'listRestaurants') {
      assertOwner(params.owner_key || params.key);
      return json({ ok: true, restaurants: readObjects(SHEETS.restaurants) });
    }

    return json({ ok: false, error: 'unknown_action', action }, 400);
  } catch (error) {
    return json({ ok: false, error: String(error && error.message ? error.message : error) }, 500);
  }
}

function doPost(e) {
  try {
    const payload = parsePayload(e);
    const action = payload.action;

    if (action === 'saveMenuDay') {
      const result = saveMenuDay(payload);
      return json({ ok: true, ...result });
    }

    if (action === 'trackEvent') {
      const event = trackEvent(payload);
      return json({ ok: true, event });
    }

    if (action === 'saveStoryAsset') {
      const story = saveStoryAsset(payload);
      return json({ ok: true, story });
    }

    return json({ ok: false, error: 'unknown_action', action }, 400);
  } catch (error) {
    return json({ ok: false, error: String(error && error.message ? error.message : error) }, 500);
  }
}

function saveMenuDay(payload) {
  const restaurant = getRestaurantBySlug(payload.slug);
  assertToken(restaurant, payload.token);

  const now = new Date().toISOString();
  const date = payload.date || todayIso();
  const existingMenu = getMenuForDate(restaurant.id, date);
  const menuId = existingMenu ? existingMenu.id : uuid('menu');

  const menu = {
    id: menuId,
    restaurant_id: restaurant.id,
    date,
    title: payload.title || 'Cardápio de hoje',
    price: payload.price || '',
    service_hours: payload.service_hours || '',
    story_link: payload.story_link || '',
    notes: payload.notes || '',
    is_published: 'TRUE',
    published_at: now,
    created_at: existingMenu ? existingMenu.created_at : now,
    updated_at: now,
  };

  upsertObject(SHEETS.menuDays, 'id', menu);
  deleteWhere(SHEETS.menuItems, 'menu_day_id', menuId);

  const items = normalizeItems(payload.items || []).map((item, index) => ({
    id: uuid('item'),
    menu_day_id: menuId,
    name: item.name,
    category: item.category || 'Geral',
    description: item.description || '',
    price: item.price || '',
    is_highlight: item.is_highlight ? 'TRUE' : 'FALSE',
    sort_order: Number(item.sort_order || index + 1),
    created_at: now,
  }));

  appendObjects(SHEETS.menuItems, items);
  return { menu, items };
}

function trackEvent(payload) {
  const restaurant = getRestaurantBySlug(payload.slug);
  const now = new Date().toISOString();
  const event = {
    id: uuid('event'),
    restaurant_id: restaurant.id,
    menu_day_id: payload.menu_day_id || '',
    event_type: payload.event_type || 'page_view',
    source: payload.source || 'direct',
    user_agent: payload.user_agent || '',
    referrer: payload.referrer || '',
    ip_hash: payload.ip_hash || '',
    created_at: now,
  };
  appendObjects(SHEETS.events, [event]);
  return event;
}

function saveStoryAsset(payload) {
  const restaurant = getRestaurantBySlug(payload.slug);
  assertToken(restaurant, payload.token);
  const story = {
    id: uuid('story'),
    restaurant_id: restaurant.id,
    menu_day_id: payload.menu_day_id || '',
    image_url: payload.image_url || '',
    template_name: payload.template_name || 'daily-menu-v1',
    created_at: new Date().toISOString(),
  };
  appendObjects(SHEETS.storyAssets, [story]);
  return story;
}

function getRestaurantBySlug(slug) {
  if (!slug) throw new Error('missing_slug');
  const restaurant = readObjects(SHEETS.restaurants).find((row) => row.slug === slug);
  if (!restaurant) throw new Error('restaurant_not_found');
  return restaurant;
}

function getMenuForDate(restaurantId, date) {
  return readObjects(SHEETS.menuDays)
    .filter((row) => row.restaurant_id === restaurantId && row.date === date && String(row.is_published).toUpperCase() === 'TRUE')
    .sort((a, b) => String(b.published_at || '').localeCompare(String(a.published_at || '')))[0] || null;
}

function getItemsByMenuDay(menuDayId) {
  return readObjects(SHEETS.menuItems)
    .filter((row) => row.menu_day_id === menuDayId)
    .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
}

function getCatalogByRestaurant(restaurantId) {
  return readObjects(SHEETS.catalogItems)
    .filter((row) => row.restaurant_id === restaurantId && String(row.is_active).toUpperCase() !== 'FALSE')
    .sort((a, b) => {
      const sectionSort = String(a.section_id || '').localeCompare(String(b.section_id || ''));
      return sectionSort || Number(a.sort_order || 0) - Number(b.sort_order || 0);
    });
}

function getRestaurantDatabase(restaurant) {
  const catalog = getCatalogByRestaurant(restaurant.id);
  const assets = [];
  if (restaurant.logo_url) {
    assets.push({
      id: `logo_${restaurant.id}`,
      restaurant_id: restaurant.id,
      asset_type: 'logo',
      label: `${restaurant.name} - logo`,
      url: restaurant.logo_url,
      source_url: restaurant.logo_url,
    });
  }
  if (restaurant.symbol_url && restaurant.symbol_url !== restaurant.logo_url) {
    assets.push({
      id: `symbol_${restaurant.id}`,
      restaurant_id: restaurant.id,
      asset_type: 'symbol',
      label: `${restaurant.name} - símbolo`,
      url: restaurant.symbol_url,
      source_url: restaurant.symbol_url,
    });
  }
  catalog
    .filter((item) => item.image_url)
    .forEach((item) => {
      assets.push({
        id: `photo_${item.id}`,
        restaurant_id: restaurant.id,
        catalog_item_id: item.id,
        asset_type: 'dish_photo',
        label: item.name,
        url: resolveAssetUrl(item.image_url, restaurant.assets_base_url),
        source_url: item.image_url,
      });
    });
  return { restaurant, catalog, assets };
}

function resolveAssetUrl(imageUrl, baseUrl) {
  if (!imageUrl) return '';
  if (/^(https?:|data:)/.test(imageUrl)) return imageUrl;
  if (!baseUrl) return imageUrl;
  return `${String(baseUrl).replace(/\/$/, '')}/${String(imageUrl).replace(/^\//, '')}`;
}

function getFormSchemaByRestaurant(restaurantId) {
  const fieldRows = readObjects(SHEETS.formFields)
    .filter((row) => !row.restaurant_id || row.restaurant_id === restaurantId)
    .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
  const options = readObjects(SHEETS.formOptions);
  return fieldRows.map((field) => ({
    ...field,
    options: options
      .filter((option) => option.field_id === field.id)
      .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0))
      .map((option) => option.option_label),
  }));
}

function getInsights(restaurantId, filters = {}) {
  const events = readObjects(SHEETS.events).filter((row) => row.restaurant_id === restaurantId);
  const now = new Date();
  const today = todayIso();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const last7 = events.filter((event) => new Date(event.created_at) >= sevenDaysAgo);
  const periodEvents = filterEventsByPeriod(events, filters.startDate, filters.endDate);
  const sourceCounts = countBy(periodEvents, 'source');
  const typeCounts = countBy(periodEvents, 'event_type');
  const allTypeCounts = countBy(events, 'event_type');

  return {
    total_events: events.length,
    total_accesses: events.filter((event) => event.event_type === 'page_view').length,
    period_events: periodEvents.length,
    period_accesses: periodEvents.filter((event) => event.event_type === 'page_view').length,
    accesses_today: events.filter((event) => String(event.created_at).slice(0, 10) === today && event.event_type === 'page_view').length,
    accesses_7_days: last7.filter((event) => event.event_type === 'page_view').length,
    source_counts: sourceCounts,
    event_type_counts: typeCounts,
    event_type_counts_all: allTypeCounts,
    period_start: filters.startDate || '',
    period_end: filters.endDate || '',
    period_label: periodLabel(filters.startDate, filters.endDate),
    peak_hour: peakHour(periodEvents),
  };
}

function filterEventsByPeriod(events, startDate, endDate) {
  if (!startDate && !endDate) return events;
  return events.filter((event) => {
    const eventDate = eventDateOnly(event.created_at);
    if (!eventDate) return false;
    if (startDate && eventDate < startDate) return false;
    if (endDate && eventDate > endDate) return false;
    return true;
  });
}

function eventDateOnly(value) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]' && !Number.isNaN(value.getTime())) {
    return Utilities.formatDate(value, 'America/Sao_Paulo', 'yyyy-MM-dd');
  }
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return '';
  return Utilities.formatDate(parsed, 'America/Sao_Paulo', 'yyyy-MM-dd');
}

function periodLabel(startDate, endDate) {
  if (!startDate && !endDate) return 'Todos os tempos';
  if (startDate && endDate && startDate === endDate) return startDate;
  return `${startDate || 'inicio'} ate ${endDate || todayIso()}`;
}

function readObjects(sheetName) {
  const sheet = getSheet(sheetName);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map(String);
  return values.slice(1)
    .filter((row) => row.some((cell) => cell !== ''))
    .map((row) => rowToObject(headers, row));
}

function appendObjects(sheetName, objects) {
  if (!objects.length) return;
  const sheet = getSheet(sheetName);
  const headers = getHeaders(sheet);
  const rows = objects.map((object) => headers.map((header) => object[header] ?? ''));
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, headers.length).setValues(rows);
}

function upsertObject(sheetName, key, object) {
  const sheet = getSheet(sheetName);
  const headers = getHeaders(sheet);
  const keyIndex = headers.indexOf(key);
  if (keyIndex === -1) throw new Error(`missing_key_header_${key}`);

  const values = sheet.getDataRange().getValues();
  const targetRow = values.findIndex((row, index) => index > 0 && row[keyIndex] === object[key]);
  const rowValues = headers.map((header) => object[header] ?? '');

  if (targetRow === -1) {
    sheet.appendRow(rowValues);
  } else {
    sheet.getRange(targetRow + 1, 1, 1, headers.length).setValues([rowValues]);
  }
}

function deleteWhere(sheetName, key, value) {
  const sheet = getSheet(sheetName);
  const headers = getHeaders(sheet);
  const keyIndex = headers.indexOf(key);
  if (keyIndex === -1) return;

  for (let row = sheet.getLastRow(); row >= 2; row -= 1) {
    if (sheet.getRange(row, keyIndex + 1).getValue() === value) {
      sheet.deleteRow(row);
    }
  }
}

function getSheet(name) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(name);
  if (!sheet) throw new Error(`missing_sheet_${name}`);
  return sheet;
}

function getHeaders(sheet) {
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
}

function rowToObject(headers, row) {
  return headers.reduce((object, header, index) => {
    object[header] = row[index] instanceof Date ? row[index].toISOString().slice(0, 10) : row[index];
    return object;
  }, {});
}

function normalizeItems(items) {
  if (Array.isArray(items)) return items;
  if (typeof items !== 'string') return [];
  return items.split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const isHighlight = line.endsWith('*');
      const clean = line.replace(/\*$/, '').trim();
      const priceParts = clean.split('|');
      const itemText = priceParts.shift().trim();
      const price = priceParts.join('|').trim();
      const parts = itemText.split(':');
      return {
        category: parts.length > 1 ? parts.shift().trim() : 'Geral',
        name: parts.join(':').trim() || clean,
        price,
        is_highlight: isHighlight || index < 6,
        sort_order: index + 1,
      };
    });
}

function parsePayload(e) {
  if (e && e.postData && e.postData.contents) {
    try {
      return JSON.parse(e.postData.contents);
    } catch (error) {
      return e.parameter || {};
    }
  }
  return e && e.parameter ? e.parameter : {};
}

function assertToken(restaurant, token) {
  if (!token || token !== restaurant.admin_token) {
    throw new Error('invalid_admin_token');
  }
}

function assertOwner(token) {
  if (!token || token !== OWNER_ACCESS_TOKEN) {
    throw new Error('invalid_owner_token');
  }
}

function json(payload, callback) {
  const body = callback ? `${callback}(${JSON.stringify(payload)});` : JSON.stringify(payload);
  return ContentService
    .createTextOutput(body)
    .setMimeType(callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
}

function uuid(prefix) {
  return `${prefix}_${Utilities.getUuid()}`;
}

function todayIso() {
  return Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'yyyy-MM-dd');
}

function countBy(rows, key) {
  return rows.reduce((acc, row) => {
    const value = row[key] || 'direct';
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function peakHour(events) {
  const counts = events.reduce((acc, event) => {
    const date = new Date(event.created_at);
    if (Number.isNaN(date.getTime())) return acc;
    const hour = Utilities.formatDate(date, 'America/Sao_Paulo', 'HH');
    acc[hour] = (acc[hour] || 0) + 1;
    return acc;
  }, {});
  const top = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
  return top ? `${top}:00` : '';
}
