# QrStack Plataforma

Plataforma QrStack para gerenciar clientes, formulários, cardápios dinâmicos, Stories e insights.

## Rotas do MVP

- `#/hq/overview?key=qrstack-berna-2026` - central interna QrStack.
- `#/hq/clientes` - clientes cadastrados.
- `#/hq/respostas` - respostas dos formulários.
- `#/hq/stories` - Stories gerados.
- `#/hq/insights` - insights internos.
- `#/cliente/amaro?token=qrstack-amaro-2026` - formulário simplificado do restaurante.
- `#/r/amaro?src=qr` - cardápio público com tracking de origem. Para o Amaro, a rota carrega o cardápio original do repositório `carda-pio`.

## Escopo atual

- Cliente real Amaro cadastrado como base inicial.
- Dados gerenciais e analytics persistidos no Cloudflare D1, com fallback preservado para Google Sheets.
- Formulário próprio para cardápio do dia.
- Publicação automática do cardápio público.
- Geração de Story 1080x1920 em canvas.
- Fila transacional e idempotente para publicacao de Story.
- Agente Android privado com retomada por checkpoint, protecao contra interrupcoes e confirmacao visual de publicacao.
- Eventos e insights internos para a central QrStack, sem dados de demonstração.
- Schema legado Supabase preservado em `supabase/schema.sql`.
- Nova migração gratuita Cloudflare D1 em `cloudflare/`.
- Central QrStack com identidade própria do sistema.
- Portal do cliente com tema herdado do restaurante.

## Modelo de automação

O fluxo atual do Amaro usa Google Forms, Google Sheets e um endpoint de Google Apps Script. O site busca esse endpoint, filtra os itens pela data do dia e renderiza o cardápio automaticamente.

No produto QrStack, esse fluxo pode continuar para clientes que já usam Forms/Sheets. A migração para D1 deve acontecer primeiro na camada gerencial e de analytics:

1. Restaurante mantém Forms/Sheets quando a automação já está em produção.
2. Apps Script continua alimentando o cardápio publicado.
3. Cloudflare D1 salva clientes, catálogo, fotos indexadas e analytics.
4. Dashboard QrStack consulta D1, não a planilha pesada.
5. Story usa a identidade, o catálogo e o link definidos na base QrStack.

## Publicacao automatica de Story

O envio do formulario cria um job unico em `story_publish_jobs`. A arte fica temporariamente no KV por 48 horas, enquanto metadados, estado e historico permanecem no D1. O agente Android pareado reivindica o job e atualiza a plataforma em cada etapa.

- `story_agents`: aparelhos pareados.
- `story_publish_jobs`: fila e estado atual.
- `story_job_events`: historico auditavel de checkpoints.
- `cloudflare/migrations/0007_story_automation.sql`: migracao aditiva, sem exclusao de analytics.
- `android-agent/`: projeto Android instalavel sem conexao USB permanente.

O agente nunca rejeita chamadas nem apaga notificacoes. Durante a publicacao ele ativa temporariamente Nao Perturbe, mantem a tela acordada e, se outro aplicativo tomar a tela, pausa e retoma do ultimo ponto seguro.

## Analytics

O front registra eventos reais de navegação local. A nova rota recomendada é gravar analytics e dados gerenciais no Cloudflare D1 via Worker, mantendo Apps Script apenas para a automação do cardápio quando o cliente ainda usa Google Forms/Sheets.

Arquivos da migração D1:

- `cloudflare/migrations/0001_qrstack_core.sql`
- `cloudflare/migrations/0002_analytics_normalized_view.sql`
- `cloudflare/src/worker.js`
- `cloudflare/wrangler.toml.example`
- `cloudflare/import/events-csv-to-sql.mjs`
- `cloudflare/import/catalog-json-to-sql.mjs`

Depois que o Worker estiver publicado, preencha `cloudflareD1WorkerUrl` em `config/qrstack.json` e atualize o `QRSTACK_D1_API_URL` em `script.js`.

## Google Sheets

Planilha nativa usada pela base atual:

`https://docs.google.com/spreadsheets/d/1v4dr2zVOuvcPJJ02Ah6V-AXsK0d8I6DVGIpMcSe8NmU/edit`

O arquivo enviado pelo usuário estava como Excel no Drive, então foi criada uma versão nativa Google Sheets para permitir leitura/escrita via API.

## Apps Script

O código do Web App fica em `apps-script/Code.gs`.

Passos para publicar:

1. Abrir a planilha nativa da base atual.
2. Ir em `Extensões > Apps Script`.
3. Colar o conteúdo de `apps-script/Code.gs`.
4. Clicar em `Implantar > Nova implantação`.
5. Tipo: `App da Web`.
6. Executar como: `Eu`.
7. Quem tem acesso: `Qualquer pessoa`.
8. Copiar a URL do Web App.
9. Colar a URL em `config/qrstack.json` no campo `appsScriptWebAppUrl`.

## Próxima fase

- Migrar para Next.js.
- Conectar Cloudflare D1 como banco gratuito da QrStack.
- Migrar analytics e dados gerenciais para D1.
- Criar autenticação/token por restaurante.
- Preparar automação WhatsApp para lembretes.
