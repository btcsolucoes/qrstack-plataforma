# Migração QrStack para Cloudflare D1

Esta pasta prepara a QrStack para usar Cloudflare D1 como banco da plataforma e dos analytics.

O fluxo do cardápio do Amaro não precisa mudar:

`Google Forms -> Google Sheets -> Apps Script -> cardápio publicado`

O que muda é a base da plataforma:

`Cardápio/Plataforma -> Cloudflare Worker -> Cloudflare D1 -> Dashboard QrStack`

## 1. Criar banco D1

No terminal, dentro de `C:\Users\berna\qrstack-plataforma`:

```powershell
cloudflare\qrstack-wrangler.cmd login
cloudflare\qrstack-wrangler.cmd d1 create qrstack-db
```

Copie o `database_id` que o Wrangler mostrar.

## 2. Criar o wrangler.toml

Duplique `cloudflare/wrangler.toml.example` para `wrangler.toml` e preencha:

```toml
database_id = "id-real-do-seu-d1"
OWNER_ACCESS_TOKEN = "qrstack-berna-2026"
```

## 3. Rodar migrations

```powershell
cloudflare\qrstack-wrangler.cmd d1 migrations apply qrstack-db --remote
```

## 4. Publicar a API

```powershell
cloudflare\qrstack-wrangler.cmd deploy
```

O resultado será uma URL parecida com:

`https://qrstack-api.seu-subdominio.workers.dev`

## 5. Trocar só analytics

Depois do deploy, altere a plataforma e os cardápios para usarem a URL do Worker apenas nos analytics:

- `analyticsEndpoint`: URL do Worker D1.
- `liveMenuEndpoint`: continua no Apps Script do Google.

Isso preserva a automação do cardápio e tira o dashboard da planilha pesada.

## 6. Importar eventos antigos

Exporte a aba `qrstack_events` do Google Sheets como CSV e rode:

```powershell
node cloudflare/import/events-csv-to-sql.mjs C:\caminho\qrstack_events.csv cloudflare/import/events-import.sql
cloudflare\qrstack-wrangler.cmd d1 execute qrstack-db --remote --file cloudflare/import/events-import.sql
```

Depois confira:

```powershell
cloudflare\qrstack-wrangler.cmd d1 execute qrstack-db --remote --command "SELECT restaurant_slug, event_type, COUNT(*) total FROM analytics_events GROUP BY restaurant_slug, event_type;"
```

## 7. Importar banco de pratos e fotos

Para o Amaro, os JSONs já estão no repo `carda-pio`:

```powershell
node cloudflare/import/catalog-json-to-sql.mjs C:\Users\berna\carda-pio\qrstack\amaro-catalog.json C:\Users\berna\carda-pio\qrstack\amaro-assets.json cloudflare/import/catalog-import.sql
cloudflare\qrstack-wrangler.cmd d1 execute qrstack-db --remote --file cloudflare/import/catalog-import.sql
```

## 8. Testes rápidos

Health:

```powershell
Invoke-RestMethod "https://qrstack-api.seu-subdominio.workers.dev?action=health"
```

Evento:

```powershell
Invoke-RestMethod "https://qrstack-api.seu-subdominio.workers.dev" -Method Post -Body '{"action":"trackEvent","slug":"amaro","event_type":"page_view","source":"codex_check"}'
```

Insights:

```powershell
Invoke-RestMethod "https://qrstack-api.seu-subdominio.workers.dev?action=getInsights&slug=amaro&key=qrstack-berna-2026"
```
