# QrStack Plataforma

Plataforma QrStack para gerenciar clientes, formulários, cardápios dinâmicos, Stories e insights.

## Rotas do MVP

- `#/hq` - central interna QrStack.
- `#/hq/clientes` - clientes cadastrados.
- `#/hq/respostas` - respostas dos formulários.
- `#/hq/stories` - Stories gerados.
- `#/hq/insights` - insights internos.
- `#/cliente/amaro?token=qrstack-amaro-2026` - acesso simplificado do restaurante.
- `#/r/amaro?src=qr` - cardápio público com tracking de origem.

## Escopo atual

- Cliente real Amaro cadastrado como base inicial.
- Dados persistidos em `localStorage` enquanto a camada definitiva de banco/API evolui.
- Formulário próprio para cardápio do dia.
- Publicação automática do cardápio público.
- Geração de Story 1080x1920 em canvas.
- Download e compartilhamento nativo do Story.
- Tentativa de abertura do Instagram após compartilhamento.
- Eventos e insights internos para a central QrStack.
- Schema Supabase em `supabase/schema.sql`.
- Central QrStack com identidade própria do sistema.
- Portal do cliente com tema herdado do restaurante.

## Modelo de automação

O fluxo atual do Amaro usa Google Forms, Google Sheets e um endpoint de Google Apps Script. O site busca esse endpoint, filtra os itens pela data do dia e renderiza o cardápio automaticamente.

No produto QrStack, o Google Forms sai do fluxo:

1. Restaurante recebe link do painel.
2. Preenche formulário próprio da QrStack.
3. Supabase salva cardápio e itens.
4. Página pública busca por `slug` e data.
5. Story é gerado a partir da mesma publicação.
6. Insights ficam na central QrStack.

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
- Conectar Supabase/Postgres.
- Salvar imagens no Supabase Storage.
- Criar autenticação/token por restaurante.
- Preparar automação WhatsApp para lembretes.
