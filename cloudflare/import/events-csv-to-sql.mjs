import fs from "node:fs";
import path from "node:path";

const [, , csvPath, outPath = "cloudflare/import/events-import.sql", chunkSizeArg = "10000", dateFilter = ""] = process.argv;

if (!csvPath) {
  console.error("Uso: node cloudflare/import/events-csv-to-sql.mjs caminho/qrstack_events.csv [saida.sql]");
  process.exit(1);
}

const csv = fs.readFileSync(csvPath, "utf8").replace(/^\uFEFF/, "");
const rows = parseCsv(csv);

if (rows.length < 2) {
  console.error("CSV vazio ou sem cabeçalho.");
  process.exit(1);
}

const headers = rows[0].map((header) => String(header || "").trim());
const records = rows
  .slice(1)
  .filter((row) => row.some((cell) => String(cell || "").trim()))
  .filter((row) => !dateFilter || rowMatchesDate(headers, row, dateFilter));
const columns = [
  "id", "restaurant_id", "restaurant_slug", "menu_day_id", "event_type", "source",
  "source_detail", "url", "path", "referrer", "user_agent", "language",
  "session_id", "visitor_id", "dish_name", "dish_key", "dish_category",
  "duration_ms", "observe_seconds", "device_type", "browser", "os", "screen",
  "viewport", "timezone_offset", "created_at",
];

const chunkSize = Math.max(1, Number.parseInt(chunkSizeArg, 10) || 10000);
const statements = records.map((row, index) => {
    const object = toObject(headers, row);
    const event = normalizeEvent(object, index);
    return `INSERT OR IGNORE INTO analytics_events (${columns.join(", ")}) VALUES (${columns.map((column) => sqlValue(event[column])).join(", ")});`;
  });

fs.mkdirSync(path.dirname(outPath), { recursive: true });

if (statements.length <= chunkSize) {
  fs.writeFileSync(outPath, `${statements.join("\n")}\n`, "utf8");
  console.log(`Gerado ${outPath} com ${records.length} evento(s).`);
} else {
  const parsed = path.parse(outPath);
  const parts = Math.ceil(statements.length / chunkSize);
  for (let part = 0; part < parts; part += 1) {
    const start = part * chunkSize;
    const end = Math.min(start + chunkSize, statements.length);
    const filePath = path.join(parsed.dir, `${parsed.name}.part-${String(part + 1).padStart(3, "0")}${parsed.ext}`);
    fs.writeFileSync(filePath, `${statements.slice(start, end).join("\n")}\n`, "utf8");
  }
  console.log(`Gerados ${parts} arquivo(s) em ${parsed.dir} com ${records.length} evento(s), ${chunkSize} por lote.`);
}

function toObject(headers, row) {
  return headers.reduce((acc, header, index) => {
    acc[header] = row[index] ?? "";
    return acc;
  }, {});
}

function rowMatchesDate(headers, row, yyyyMmDd) {
  const createdAtIndex = headers.findIndex((header) => String(header || "").trim() === "created_at");
  if (createdAtIndex < 0) return false;
  return String(row[createdAtIndex] || "").trim().slice(0, 10) === yyyyMmDd;
}

function normalizeEvent(row, index) {
  const slug = normalizeSlug(row.cliente || row.slug || row.restaurant_slug || "amaro");
  const dishName = row.dish_name || row.item_name || row.prato || "";
  const source = inferSource(row);
  return {
    id: row.id || `legacy_${Date.now()}_${index}`,
    restaurant_id: `rest_${slug}`,
    restaurant_slug: slug,
    menu_day_id: row.menu_day_id || "",
    event_type: normalizeEventType(row.event_type || row.tipo || "page_view"),
    source,
    source_detail: row.source_detail || row.sourceDetail || inferSourceDetail(row, source),
    url: row.url || "",
    path: row.path || "",
    referrer: row.referrer || "",
    user_agent: row.user_agent || row.userAgent || "",
    language: row.language || row.idioma || "",
    session_id: row.session_id || row.sessionId || "",
    visitor_id: row.visitor_id || row.visitorId || "",
    dish_name: dishName,
    dish_key: row.dish_key || normalizeKey(dishName),
    dish_category: row.dish_category || row.item_category || row.categoria || "",
    duration_ms: toInteger(row.duration_ms || row.durationMs),
    observe_seconds: toInteger(row.observe_seconds || row.observeSeconds),
    device_type: row.device_type || row.deviceType || "",
    browser: row.browser || "",
    os: row.os || "",
    screen: row.screen || "",
    viewport: row.viewport || "",
    timezone_offset: row.timezone_offset || row.timezoneOffset || "",
    created_at: normalizeTimestamp(row.created_at || row.timestamp) || new Date().toISOString(),
  };
}

function inferSource(row) {
  const explicit = row.source || row.origem || "";
  if (explicit) return normalizeSource(explicit);

  const url = safeUrl(row.url || "");
  const referrer = safeUrl(row.referrer || "");
  const utmSource = normalizeKey(url?.searchParams.get("utm_source") || "");
  const src = normalizeKey(url?.searchParams.get("src") || "");
  const host = normalizeKey(referrer?.hostname || "");

  return normalizeSource(utmSource || src || host || "direct");
}

function inferSourceDetail(row, source) {
  const url = safeUrl(row.url || "");
  const referrer = safeUrl(row.referrer || "");
  const utmSource = normalizeKey(url?.searchParams.get("utm_source") || "");
  const src = normalizeKey(url?.searchParams.get("src") || "");
  const host = normalizeKey(referrer?.hostname || "");

  if (utmSource) return utmSource;
  if (src) return src;
  if (host) return host;
  if (source === "direct") return "sem_referrer";
  return "";
}

function safeUrl(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  try {
    return new URL(text);
  } catch {
    return null;
  }
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cell.replace(/\r$/, ""));
  rows.push(row);
  return rows;
}

function sqlValue(value) {
  if (value === null || value === undefined || value === "") return "NULL";
  if (typeof value === "number") return String(value);
  return `'${String(value).replace(/'/g, "''")}'`;
}

function normalizeKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
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
  return "internet";
}

function normalizeTimestamp(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function toInteger(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? Math.round(number) : 0;
}
