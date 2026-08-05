import fs from "node:fs";
import path from "node:path";

const [, , catalogPath, assetsPath = "", outPath = "cloudflare/import/catalog-import.sql"] = process.argv;

if (!catalogPath) {
  console.error("Uso: node cloudflare/import/catalog-json-to-sql.mjs caminho/amaro-catalog.json [amaro-assets.json] [saida.sql]");
  process.exit(1);
}

const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8").replace(/^\uFEFF/, ""));
const assets = assetsPath && fs.existsSync(assetsPath)
  ? JSON.parse(fs.readFileSync(assetsPath, "utf8").replace(/^\uFEFF/, "")).assets || []
  : [];

const catalogRows = Array.isArray(catalog) ? catalog : catalog.items || [];
const restaurantId = catalogRows[0]?.restaurant_id || "rest_amaro";

const sql = [
  ...catalogRows.map((item, index) => `
INSERT OR REPLACE INTO catalog_items (
  id, restaurant_id, section_id, section_title, name, category, description, price,
  image_url, source_repo, source_path, source_url, sort_order, is_active, updated_at
) VALUES (
  ${sqlValue(item.id || `catalog_${normalizeKey(item.name).replace(/\s+/g, "-")}`)},
  ${sqlValue(item.restaurant_id || restaurantId)},
  ${sqlValue(item.section_id || "cardapio")},
  ${sqlValue(item.section_title || item.category || "Cardápio")},
  ${sqlValue(item.name || "")},
  ${sqlValue(item.category || "")},
  ${sqlValue(item.description || "")},
  ${sqlValue(item.price || "")},
  ${sqlValue(item.image_url || "")},
  ${sqlValue(item.source_repo || "")},
  ${sqlValue(item.source_path || "")},
  ${sqlValue(item.source_url || "")},
  ${Number(item.sort_order || index + 1)},
  ${String(item.is_active).toLowerCase() === "false" ? 0 : 1},
  ${sqlValue(new Date().toISOString())}
);`.trim()),
  ...assets.map((asset, index) => `
INSERT OR REPLACE INTO restaurant_assets (
  id, restaurant_id, catalog_item_id, asset_type, label, url, source_repo, source_path, source_url, updated_at
) VALUES (
  ${sqlValue(asset.id || `asset_${normalizeKey(asset.type || "asset").replace(/\s+/g, "-")}_${normalizeKey(asset.label || asset.fileName || index).replace(/\s+/g, "-")}`)},
  ${sqlValue(restaurantId)},
  NULL,
  ${sqlValue(asset.type || "asset")},
  ${sqlValue(asset.label || asset.fileName || "")},
  ${sqlValue(asset.url || "")},
  ${sqlValue(asset.source_repo || "")},
  ${sqlValue(asset.path || asset.source_path || "")},
  ${sqlValue(asset.source_url || asset.url || "")},
  ${sqlValue(new Date().toISOString())}
);`.trim()),
  "",
].join("\n");

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, sql, "utf8");
console.log(`Gerado ${outPath} com ${catalogRows.length} item(ns) e ${assets.length} asset(s).`);

function sqlValue(value) {
  if (value === null || value === undefined || value === "") return "NULL";
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
