# QrStack Plataforma

Plataforma QrStack para gerenciar clientes, formulários, cardápios dinâmicos, Stories e insights.

## Rotas do MVP

- `#/hq/overview` - central interna QrStack, com chave privada validada no servidor.
- `#/hq/clientes` - clientes cadastrados.
- `#/hq/respostas` - respostas dos formulários.
- `#/hq/stories` - Stories gerados.
- `#/hq/insights` - insights internos.
- `#/cliente/amaro?token=qrstack-amaro-2026` - formulário simplificado do restaurante.
- `#/r/amaro?src=qr` - cardápio público com tracking de origem. Para o Amaro, a rota carrega o cardápio original do repositório `carda-pio`.

## Escopo atual

Na gestão **Restaurantes**, cada cliente possui um seletor de plano persistido no KV e espelhado no D1:

| Recurso | RSTACK CARDÁPIO | QRSTACK DIVULGAÇÃO | QRSTACK PERFORMANCE |
|---|---|---|---|
| Cardápio diário, QR Code e link | Sim | Sim | Sim |
| Arte do Story e link para copiar | Não | Sim | Sim |
| Publicador automático Instagram | Não | Não | Sim |
| Dashboard de acessos para o cliente | Não | Não | Sim |

Cadastros sem plano começam em Cardápio. A gestão QrStack mantém acesso aos
analytics de todos; o portal do cliente segue o plano atribuído. A chave da
gestão é validada no Worker e não fica embutida no JavaScript público.
Migração de planos: `cloudflare/migrations/0011_restaurant_plans.sql`.
O KV mantém a gestão dos planos disponível quando a cota diária do D1 se esgota;
o espelhamento é retomado nas próximas consultas. Alterações podem levar cerca
de 60 segundos para propagar entre regiões. A fila de publicação continua
dependendo do D1, mesmo quando a escolha do plano está disponível.
Ao reduzir o plano, jobs pendentes de publicação são cancelados; trabalhos em
andamento são barrados antes da próxima etapa, sem repetir publicações.

- Cliente real Amaro cadastrado como base inicial.
- Dados gerenciais e analytics persistidos no Cloudflare D1, com fallback preservado para Google Sheets.
- Formulário próprio para cardápio do dia.
- Publicação automática do cardápio público.
- Story 1080x1920 por upload ou gerado com logo, cores e conteúdo do restaurante.
- Fila transacional e idempotente para publicacao de Story.
- Publicador Python no Windows, conectado à fila Cloudflare; agente Android aposentado.
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

## Publicação de Story

Salvar o formulário atualiza apenas o cardápio. Na tela Stories, o usuário escolhe **Gerar automaticamente** ou **Enviar imagem**, confere a prévia e o link HTTPS e clica em **Publicar Story**. A conta vinculada aparece antes do envio. Sem conta configurada, é possível preparar e baixar a arte, mas publicar fica bloqueado.

- `instagram_publishers`: serviços Windows autorizados, com token armazenado somente como hash.
- `instagram_account_bindings`: restaurante, publicador e identidade Instagram exclusivos.
- `instagram_story_jobs` e `instagram_story_job_events`: fila e histórico transacional.
- `cloudflare/migrations/0010_instagram_python_publisher.sql`: tabelas novas e desativação dos agentes antigos, sem apagar histórico.
- Arte temporária no KV por 48 horas; sessão Instagram e senha não passam pelo navegador ou D1.

O publicador roda em `qrstack-instagram` neste Windows e consome a fila por HTTPS. Precisa de uma sessão conectada explicitamente e do mapa local restaurante/conta. Não há login nem repetição de publicação automáticos. Um resultado incerto bloqueia a conta para conferência; uma confirmação perdida pode ser recuperada sem republicar.

As rotas Android retornam HTTP 410. A fila Android não é copiada para a fila nova. No aparelho antigo, usar **Parar agente** e desativar a acessibilidade: um trabalho já salvo offline no telefone não pode ser interrompido apenas pelo servidor.

Operação e implantação: [STORIES_WINDOWS.md](STORIES_WINDOWS.md). A validação real desta integração continua restrita à conta interna; clientes não são habilitados automaticamente.

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
