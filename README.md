# QrStack Plataforma

Plataforma QrStack para gerenciar clientes, formulários, cardápios dinâmicos, Stories e insights.

## Rotas do MVP

- `#/hq/overview` - central interna QrStack, com chave privada validada no servidor.
- `#/hq/clientes` - clientes cadastrados.
- `#/hq/respostas` - respostas dos formulários.
- `#/hq/stories` - Stories gerados.
- `#/hq/insights` - insights internos.
- `#/cliente/amaro` - formulário do restaurante; o link privado é obtido em **Restaurantes → Copiar link privado**.
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
O login troca a senha por uma sessão aleatória com validade de quatro horas.
O navegador guarda apenas essa sessão, não a senha. Logout, troca ou redefinição
revogam as sessões correspondentes. Links de recuperação são enviados somente
ao e-mail configurado no servidor, expiram em quinze minutos e têm uso único.
Solicitações e tentativas têm limites persistentes por IP; o envio também tem
limite por conta, com resposta genérica para não revelar endereços cadastrados.
O remetente precisa estar autorizado: o relay de Gmail está em
`apps-script-recovery/`, como alternativa ao binding Cloudflare Email.
Sem remetente configurado, a interface informa indisponibilidade, sem simular envio.
Em 2026-10-08, o envio pelo Gmail foi ativado e a entrega de um link solicitado
pela plataforma foi confirmada na caixa de entrada da gestão. Senhas e tokens
de recuperação continuam sob controle do Worker; o Apps Script apenas envia o e-mail
após validar a assinatura do servidor.

### Isolamento e dados públicos

O D1 não implementa as políticas RLS do PostgreSQL. O equivalente obrigatório
neste projeto é a autorização por restaurante no Worker e as restrições
`restaurant_id` nas consultas e gravações. Testes negativos cobrem tentativas
de acessar ou substituir registros de outro restaurante. Respostas públicas
usam listas de campos permitidos, inclusive para snapshots antigos. Credenciais,
notas internas, fontes privadas e mensagens de erro de infraestrutura não são
expostas. O frontend não tem acesso direto ao banco, token estático de cliente,
JSONP autenticado ou cache persistente de analytics. Em 2026-10-08, o acesso
compartilhado anterior do Amaro foi restabelecido no D1 e nos caches privados
por solicitação explícita do gestor, para preservar o link já distribuído.
Esse link funciona como credencial do restaurante: seus portadores podem alterar
o cardápio. Ele não autentica a gestão QrStack e continua sujeito ao plano do cliente.
O token não deve ser novamente embutido no frontend nem tratado como segredo
forte, pois já esteve no histórico público.

### Senha e recuperação

Em **Minha senha**, o gestor informa a senha atual e define outra com 8 a 128
caracteres. A alteração vale imediatamente para as próximas requisições da gestão;
os acessos dos restaurantes e a credencial do Apps Script não são alterados.
A senha fica armazenada como hash PBKDF2 com salt exclusivo no Durable Object
`OwnerCredentials`, independente do D1. O secret `OWNER_ACCESS_TOKEN` só é aceito
antes da primeira troca e não funciona como senha alternativa depois dela.
O deploy usa `cloudflare/src/entry.js` e exige o binding `OWNER_AUTH` e a migração
`owner-credentials-v1` do exemplo de configuração. Se a autenticação estiver
indisponível, a gestão bloqueia o acesso; não retorna à senha inicial.
Links e atalhos com a senha anterior param de funcionar depois da troca: abra
`#/hq/senha` ou `#/hq/overview` sem chave e entre com a senha nova. As ferramentas
locais que guardaram a antiga chave da gestão precisam ser atualizadas para
futuras operações administrativas; o token do publicador Windows não muda.
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
- Arte temporária no KV por 48 horas; a sessão Instagram permanece criptografada no Windows. A senha digitada na gestão tem entrega única, temporariamente criptografada no D1, sem consulta posterior pelo navegador.

O publicador roda em `qrstack-instagram` neste Windows e consome a fila por HTTPS. Precisa de uma sessão conectada explicitamente. O mapa local recebe as contas aprovadas pela gestão após conferir usuário e ID imutável. Não há reconexão nem repetição de publicação automáticas. Um resultado incerto bloqueia a conta para conferência; uma confirmação perdida pode ser recuperada sem republicar.

As rotas Android retornam HTTP 410. A fila Android não é copiada para a fila nova. No aparelho antigo, usar **Parar agente** e desativar a acessibilidade: um trabalho já salvo offline no telefone não pode ser interrompido apenas pelo servidor.

Operação e implantação: [STORIES_WINDOWS.md](STORIES_WINDOWS.md). A validação real desta integração continua restrita à conta interna; clientes não são habilitados automaticamente.

### Senha e sessão pela gestão

Em **Stories → Configurar conta de publicação**, salve o publicador, o usuário e
o ID imutável da conta. Digite a senha no campo protegido e clique em **Conectar
sessão**. Mostrar/ocultar afeta apenas o valor que está sendo digitado; senhas
anteriores nunca são retornadas. O campo é limpo ao enviar. Esta ação não habilita
publicação, não altera o plano e não publica um Story.

A migração `0012_instagram_sessions.sql` acrescenta pedidos de conexão e status.
O Worker exige o secret `INSTAGRAM_CREDENTIAL_KEY` (32 bytes aleatórios em hex).
Somente a gestão autenticada solicita conexão; apenas o publicador vinculado
recebe a senha por HTTPS, uma única vez. AES-GCM protege o valor temporário no
D1. O pedido expira em cinco minutos e o ciphertext é apagado ao ser retirado;
a limpeza de expirados também roda no cron. A chave fica fora do código/D1.
Há limite de três solicitações por IP em 15 minutos e intervalo mínimo de dois
minutos por restaurante. Cookies e tokens Instagram nunca retornam ao frontend.

O Windows mantém a sessão e o registro de processamento criptografados, sem
guardar a senha. Um login interrompido exige revisão: não é repetido. O painel
consulta o status a cada 15 segundos e distingue a última confirmação da sessão
do sinal de disponibilidade do Windows. Essa consulta não acessa o Instagram.
Challenge, 2FA e restrições exigem ação no aplicativo oficial; não são resolvidos
automaticamente. O processo Windows precisa permanecer ligado.

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
