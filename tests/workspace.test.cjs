const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function runtime(overrides = {}) {
  const root = path.resolve(__dirname, '..');
  const storage = () => {
    const values = new Map();
    return { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  };
  const context = vm.createContext({
    console, URL, URLSearchParams, Intl, Date, Math, JSON, Map, Set, structuredClone, TextEncoder, Blob, setTimeout, clearTimeout,
    crypto: require('node:crypto').webcrypto,
    localStorage: storage(), sessionStorage: storage(),
    window: { addEventListener() {} },
    location: { origin: 'http://localhost', pathname: '/', hash: '' },
    document: { addEventListener() {}, getElementById: () => ({ innerHTML: '' }), querySelectorAll: () => [], querySelector: () => null },
    ...overrides,
  });
  for (const file of ['data/amaro-catalog.js', 'workspace.js', 'script.js']) {
    const source = fs.readFileSync(path.join(root, file), 'utf8').replace(/\nrouter\(\);\r?\n/, '\n');
    vm.runInContext(source, context, { filename: file });
  }
  return expression => vm.runInContext(expression, context);
}

test('central has persistent navigation and an explicit Stories workspace', () => {
  const html = runtime()('renderWorkspace({title: "Insights", active:"insights", content:""})');
  assert.match(html, /mobile-navigation/);
  assert.match(html, /workspace-sidebar/);
  assert.match(html, /aria-current="page"/);
  assert.match(html, /href="[^\"]*stories/);
});

test('owner password screen is private and keeps passwords masked', () => {
  const run = runtime();
  const owner = run('renderWorkspace({title:"Minha senha",active:"senha",content:renderOwnerPassword()})');
  assert.match(owner, /href="#\/hq\/senha"/);
  assert.equal((owner.match(/type="password"/g) || []).length, 3);
  assert.match(owner, /autocomplete="current-password"/);
  assert.match(owner, /minlength="8"/);
  assert.equal((owner.match(/data-password-toggle/g) || []).length, 3);
  assert.match(owner, /Caracteres especiais são opcionais/);
  const client = run('renderWorkspace({client:true,title:"Restaurante",content:""})');
  assert.doesNotMatch(client, /href="#\/hq\/senha"/);
});

test('password confirmation validates length and equality without composition requirements', () => {
  const run = runtime();
  for (const value of ['abcdefgh', '12345678', 'palavra simples']) {
    assert.equal(run(`passwordFeedback(${JSON.stringify(value)}, ${JSON.stringify(value)}).matches`), true);
  }
  assert.equal(run('passwordFeedback("abcdefg", "abcdefg").valid'), false);
  assert.equal(run('passwordFeedback("abcdefgh", "abcdefgi").matches'), false);
  assert.equal(run('passwordFeedback(" abcdefgh", " abcdefgh").valid'), false);
});

test('password preview preserves the value and updates accessible toggle state in both directions', () => {
  const run = runtime();
  run(`var attributes = {'aria-label':'Mostrar nova senha'};
    var toggle = {textContent:'Mostrar', getAttribute:key=>attributes[key],setAttribute:(key,value)=>attributes[key]=value};
    var field = {type:'password',value:'abcdefgh',closest:()=>({querySelector:()=>toggle})};
    setPasswordVisibility(field,true);`);
  assert.equal(run('field.type'), 'text');
  assert.equal(run('attributes["aria-pressed"]'), 'true');
  assert.equal(run('attributes["aria-label"]'), 'Ocultar nova senha');
  run('setPasswordVisibility(field,false)');
  assert.equal(run('field.type'), 'password');
  assert.equal(run('field.value'), 'abcdefgh');
  assert.equal(run('toggle.textContent'), 'Mostrar');
  assert.equal(run('attributes["aria-pressed"]'), 'false');
});

test('password mutation is sent once and updates the current session only after confirmed success', async () => {
  const run = runtime();
  run('var sent, retryOptions; fetchWithRetry=async(url,options,retry)=>{sent=JSON.parse(options.body);retryOptions=retry;return {ok:true,json:async()=>({ok:true,session_token:"new-session",expires_at:"2026-10-08T00:00:00Z"})}}');
  await run('updateOwnerPassword("old-password", "new-long-password")');
  assert.equal(run('retryOptions.attempts'), 1);
  assert.equal(run('sent.action'), 'changeOwnerPassword');
  assert.equal(run('sessionStorage.getItem("qrstack:owner-session")'), 'new-session');
  run('fetchWithRetry=async()=>({ok:false,json:async()=>({ok:false,error:"unauthorized"})})');
  await assert.rejects(run('updateOwnerPassword("wrong-password", "unconfirmed-password")'), /unauthorized/);
  assert.equal(run('OWNER_SESSION_TOKEN'), 'new-session');
  assert.equal(run('sessionStorage.getItem("qrstack:owner-credential")'), null);
});

test('basic and unverified plans lock Stories; Divulgação offers download and copied link without publishing', () => {
  const run = runtime();
  const locked = run('renderStoryComposer(getRestaurant("amaro"),"https://example.com")');
  assert.match(locked, /Disponível no QRSTACK DIVULGAÇÃO/);
  assert.doesNotMatch(locked, /<canvas/);
  const manual = run('renderStoryComposer({...getRestaurant("amaro"),planAccess:{features:{story:true,autopublish:false}}},"https://example.com")');
  assert.match(manual, /id="publish-story" hidden disabled/);
  assert.match(manual, /Copiar link para Instagram/);
  assert.match(manual, /Baixar imagem/);
});

test('public frontend contains no embedded owner key and verifies owner access with the backend', async () => {
  const run = runtime();
  assert.equal(run('OWNER_SESSION_TOKEN'), '');
  run('var credentials; apiPost=async data=>{credentials=data; throw new Error("unauthorized")};');
  assert.equal(await run('hasOwnerAccess(new URLSearchParams({key:"wrong"}))'), false);
  assert.equal(run('ownerVerified'), false);
  run('apiPost=async data=>{credentials=data;return {ok:true,session_token:"test-owner-session"}}');
  assert.equal(await run('hasOwnerAccess(new URLSearchParams({key:"owner-test"}))'), true);
  assert.equal(run('credentials.action'), 'loginOwner');
  assert.equal(run('sessionStorage.getItem("qrstack:owner-session")'), 'test-owner-session');
  assert.equal(run('sessionStorage.getItem("qrstack:owner-credential")'), null);
  assert.equal(run('ownerLink("clientes")'), '#/hq/clientes');
});

test('restaurant form starts blank and contains the executive catalog', () => {
  const html = runtime()('renderAmaroOriginalForm(getRestaurant("amaro"))');
  assert.equal((html.match(/<select /g) || []).length, 7);
  assert.equal((html.match(/<option value="">Selecione<\/option>/g) || []).length, 7);
  assert.doesNotMatch(html, /selected/);
  assert.match(html, /Cupim da Guia/);
  assert.match(html, /Bobó de Camarão/);
});

test('catalog preserves item information and produces valid photo URLs', () => {
  const html = runtime()('renderWorkspaceCatalog()');
  assert.match(html, /data-workspace-search/);
  assert.match(html, /data-workspace-category/);
  assert.match(html, /Cupim da Guia/);
  assert.doesNotMatch(html, /\[object Object\]/);
});

test('catalog editor uses authenticated photo upload and preserves the current image', () => {
  const html = runtime()('renderCatalogManager(getRestaurant("amaro"))');
  assert.match(html, /type="file" name="catalogImageFile"/);
  assert.match(html, /accept="image\/jpeg,image\/png,image\/webp"/);
  assert.match(html, /type="hidden" name="catalogImageExisting"/);
  assert.doesNotMatch(html, /Foto \(URL ou caminho publicado\)/);
});

test('donut includes all categories in its total', () => {
  const html = runtime()('renderDonutChart("Origins", {a:50,b:40,c:30,d:20,e:10,f:5,g:1})');
  assert.match(html, /data-donut-total>156</);
  assert.match(html, /data-donut-value="6"/);
});

test('funnel never overflows or displays a positive bar for zero', () => {
  const run = runtime();
  assert.match(run('funnelStep("Sessions", 30, 14)'), /width:100%/);
  assert.match(run('funnelStep("Sessions", 0, 14)'), /width:0%/);
});

test('conversion explanation distinguishes identities from sessions', () => {
  const html = runtime()('renderInstagramDirectConversion({instagram_visitors:100, instagram_to_direct_visitors:14, direct_sessions_after_instagram:30})');
  assert.match(html, /14 identidades/);
  assert.match(html, /30 sessões diretas/);
  assert.match(html, /não duas contagens para somar/);
  assert.match(html, /não confirma uma visita presencial/);
});

test('insights render separate accessible views and date controls', () => {
  const html = runtime()('renderHqInsights()');
  assert.equal((html.match(/role="tab"/g) || []).length, 4);
  assert.match(html, /name="startDate"/);
  assert.match(html, /name="endDate"/);
});

test('public menu remains an iframe of the original restaurant menu', () => {
  const html = runtime()('renderOriginalPublicMenu(getRestaurant("amaro"), "hq")');
  assert.match(html, /<iframe/);
  assert.match(html, /src="https:\/\/btcsolucoes.github.io\/carda-pio\/\?src=hq"/);
  assert.match(html, /Voltar à Central/);
});

test('Story composer offers branded generation or upload and starts with publishing blocked', () => {
  const html = runtime()('renderStoryComposer({...getRestaurant("amaro"),planAccess:{features:{story:true,autopublish:true}}}, "https://example.com/menu")');
  assert.match(html, /name="storyImageSource" value="auto" checked/);
  assert.match(html, /name="storyImageSource" value="upload"/);
  assert.match(html, /accept="image\/jpeg,image\/png,image\/webp"/);
  assert.match(html, /id="publish-story"\s+disabled/);
  assert.match(html, /width="1080" height="1920"/);
  assert.doesNotMatch(html, /telefone|Android|APK|type="password"/i);
});

test('owner account configuration includes a masked one-time password and session status', () => {
  const html = runtime()('renderHqStories()');
  assert.match(html, /name="publisher_id"/);
  assert.match(html, /name="instagram_username"/);
  assert.match(html, /name="instagram_user_id"/);
  assert.match(html, /view=story-panel/);
  assert.match(html, /name="password" type="password"/);
  assert.match(html, /data-instagram-session-status/);
  assert.match(html, /data-password-toggle/);
  assert.match(html, /Conectar sessão/);
  assert.match(html, /<section class="story-account-settings"/);
  assert.doesNotMatch(html, /<details|<summary/);
  assert.doesNotMatch(html, /name="service_token"|APK|Android/);
});

test('restaurant management links directly to Instagram configuration, separate from the client portal', () => {
  const run = runtime();
  const row = run('renderRestaurantRow(getRestaurant("amaro"))');
  assert.match(row, /href="#\/hq\/stories\?restaurante=amaro">Conta do Instagram/);
  assert.match(row, /Abrir portal do cliente/);
  const client = run('renderWorkspace({client:true,title:"Restaurante",content:""})');
  assert.doesNotMatch(client, /Conta do Instagram|Stories e Instagram/);
  run('state.restaurants.push({...state.restaurants[0],id:"test-other",slug:"other"}); location.hash="#/hq/stories?restaurante=other"');
  const stories = run('renderHqStories()');
  assert.ok(stories.indexOf('data-story-account-card="other"') < stories.indexOf('data-story-account-card="amaro"'));
});

test('session presentation separates cached verification, pending login and runner availability', () => {
  const run = runtime();
  assert.match(run('instagramSessionDescription({configured:false})'), /não vinculada/);
  assert.match(run('instagramSessionDescription({configured:true,state:"connected",publisher_online:false,verified_at:"2026-10-08T12:00:00Z"})'), /última confirmação.*offline.*Última confirmação/);
  assert.match(run('instagramSessionDescription({configured:true,state:"connected",request_status:"processing",publisher_online:true})'), /Conectando.*online/);
  assert.match(run('instagramSessionDescription({configured:true,state:"verification_required"})'), /aplicativo oficial/);
});

test('publication requires an enabled ready private publisher with a complete account identity', () => {
  const run = runtime();
  run('var readyPublishing = {provider:"private_api",enabled:true,state:"ready",publisher_id:"pub",instagram_username:"test",instagram_user_id:"123"}');
  assert.equal(run('storyPublishingReady(readyPublishing)'), true);
  for (const expression of ['null', '{...readyPublishing, enabled:false}', '{...readyPublishing, state:"outcome_unknown"}', '{...readyPublishing,state:"publisher_inactive"}', '{...readyPublishing,instagram_user_id:""}', '{...readyPublishing,provider:"android"}']) {
    assert.equal(run(`storyPublishingReady(${expression})`), false);
  }
});

test('Story validation rejects unsafe URLs, unsupported files and excessive dimensions', () => {
  const run = runtime();
  assert.equal(run('validateStoryLink("https://example.com/menu")'), 'https://example.com/menu');
  for (const value of ['http://example.com', 'javascript:alert(1)', 'https://user:secret@example.com', 'not a link']) {
    assert.throws(() => run(`validateStoryLink(${JSON.stringify(value)})`), /invalid_story_link/);
  }
  assert.doesNotThrow(() => run('validateStoryUpload({type:"image/webp",size:1000})'));
  assert.throws(() => run('validateStoryUpload({type:"image/svg+xml",size:1000})'), /story_upload_type/);
  assert.throws(() => run('validateStoryUpload({type:"image/png",size:0})'), /story_upload_size/);
  assert.throws(() => run('validateStoryUpload({type:"image/png",size:16*1024*1024})'), /story_upload_size/);
  assert.throws(() => run('storyContainRect(10000,10000)'), /story_upload_dimensions/);
  assert.throws(() => run('storyContainRect(0,100)'), /story_upload_dimensions/);
  assert.deepEqual(JSON.parse(run('JSON.stringify(storyContainRect(1600,900))')), { x: 0, y: 656.25, width: 1080, height: 607.5 });
});

test('idempotency is stable for a retry and changes with media, URL, restaurant or menu', async () => {
  const run = runtime();
  const key = await run('storyPublicationKey("a","m1","data:image/jpeg;base64,a","https://example.com")');
  assert.equal(key, await run('storyPublicationKey("a","m1","data:image/jpeg;base64,a","https://example.com/")'));
  assert.match(key, /^story:[a-f0-9]{64}$/);
  const alternatives = await Promise.all([
    run('storyPublicationKey("b","m1","data:image/jpeg;base64,a","https://example.com")'),
    run('storyPublicationKey("a","m2","data:image/jpeg;base64,a","https://example.com")'),
    run('storyPublicationKey("a","m1","data:image/jpeg;base64,b","https://example.com")'),
    run('storyPublicationKey("a","m1","data:image/jpeg;base64,a","https://example.com/other")'),
  ]);
  assert.equal(new Set([key, ...alternatives]).size, 5);
});

test('remote Story errors are rendered as text and unknown outcomes require reconciliation', () => {
  const target = { dataset: {}, innerHTML: '' };
  const run = runtime({ document: { addEventListener() {}, getElementById: () => target } });
  run('setStoryAutomationStatus("failed_attention", \'<img src=x onerror="alert(1)">\')');
  assert.doesNotMatch(target.innerHTML, /<img/);
  assert.match(target.innerHTML, /&lt;img/);
  assert.match(run('storyJobMessage({status:"outcome_unknown"})'), /resolva no publicador/);
  assert.doesNotMatch(run('storyJobMessage({status:"completed"})'), /visualmente/);
});

test('submitting a menu saves the menu without publishing an Instagram Story', async () => {
  const button = {};
  const form = { dataset: {}, querySelector: () => button, addEventListener(type, handler) { this[type] = handler; } };
  class Fields extends Map {
    constructor() { super([['date', '2026-10-05'], ['title', 'Menu']]); }
  }
  const run = runtime({
    FormData: Fields, testForm: form,
    document: { addEventListener() {}, getElementById: id => id === 'menu-form' ? form : null, querySelector: () => null, body: { contains: () => true } },
  });
  run('var savedMenuCalls=0; saveMenuForm=async()=>{savedMenuCalls++;return {ok:true}}; queueStoryPublication=async()=>{throw new Error("unexpected_publication")}; toast=()=>{}; attachClientHandlers({id:"restaurant",slug:"other"},{id:"menu"})');
  await form.submit({ preventDefault() {}, currentTarget: form });
  assert.equal(run('savedMenuCalls'), 1);
  assert.equal(button.disabled, false);
  assert.equal(button.textContent, 'Enviar e publicar cardápio');
});

test('an older asynchronous image render cannot overwrite the latest Story preview', async () => {
  const nodes = new Map();
  const previewDraws = [];
  const preview = { getContext: () => ({ drawImage: canvas => previewDraws.push(canvas.id), clearRect() {} }) };
  nodes.set('#story-canvas', preview);
  nodes.set('[name="storyLink"]', { value: 'https://example.com' });
  const panel = { isConnected: true, querySelector: key => { if (!nodes.has(key)) nodes.set(key, {}); return nodes.get(key); }, querySelectorAll: () => [] };
  let sequence = 0;
  const run = runtime({ testPanel: panel, document: { addEventListener() {}, getElementById: id => id === 'story-panel' ? panel : {}, createElement: () => ({ id: ++sequence, toDataURL() { return `data:image/jpeg;base64,${this.id}`; } }) } });
  run('var releaseFirst; var renderCount=0; drawStory=async()=>{if(++renderCount===1) await new Promise(resolve=>{releaseFirst=resolve})}; storyComposer={panel:testPanel,restaurant:{slug:"amaro",name:"Amaro"},menu:{id:"menu"},mode:"auto",renderVersion:0}; var first=prepareStoryImage(storyComposer)');
  await run('prepareStoryImage(storyComposer)');
  run('releaseFirst()');
  await run('first');
  assert.deepEqual(previewDraws, [2]);
  assert.equal(run('storyComposer.media.dataUrl'), 'data:image/jpeg;base64,2');
});

test('publication queue preserves the supplied media identity and never requests automatic retries', async () => {
  const run = runtime();
  run('var queuedPayload; apiPost=async payload=>{queuedPayload=payload;return {job:{id:"j",status:"pending"},duplicate:false}}; setStoryAutomationStatus=()=>{}');
  await run('queueStoryPublication({slug:"test",adminToken:"local-test"},{id:"m",storyLink:"https://example.com"},"story:stable",{dataUrl:"data:image/jpeg;base64,abc",contentType:"image/jpeg",source:"upload"},null)');
  const payload = JSON.parse(run('JSON.stringify(queuedPayload)'));
  assert.equal(payload.client_request_id, 'story:stable');
  assert.equal(payload.content_type, 'image/jpeg');
  assert.equal(payload.image_source, 'upload');
  assert.equal(payload.retry_failed, undefined);
});

test('an unavailable publishing configuration allows downloading but blocks publication', async () => {
  const nodes = new Map([['[name="storyLink"]', { value: 'https://example.com' }]]);
  const panel = { isConnected: true, querySelector: key => { if (!nodes.has(key)) nodes.set(key, {}); return nodes.get(key); }, querySelectorAll: () => [] };
  const run = runtime({ testPanel: panel, document: { addEventListener() {}, getElementById: () => panel } });
  run('apiGet=async()=>{throw new Error("offline")}; storyComposer={panel:testPanel,restaurant:{slug:"test",adminToken:"test",planAccess:{features:{story:true,autopublish:true}}},media:{dataUrl:"data:image/jpeg;base64,a"},pollVersion:0,rendering:false,busy:false,locked:false}');
  await run('refreshStoryPublishing(storyComposer)');
  assert.equal(nodes.get('#publish-story').disabled, true);
  assert.equal(nodes.get('#download-story').disabled, false);
  assert.match(nodes.get('#story-publishing-account').textContent, /indisponível/);
});

test('an unknown publication outcome ends polling and locks further publication', async () => {
  const panel = { isConnected: true };
  const run = runtime({ testPanel: panel, document: { addEventListener() {}, getElementById: () => panel } });
  run('var timers=[]; window.setTimeout=callback=>timers.push(callback); updateStoryControls=()=>{}; setStoryAutomationStatus=()=>{}; apiGet=async()=>({job:{id:"j",status:"outcome_unknown"}}); storyComposer={panel:testPanel,pollVersion:1}; pollStoryPublication({slug:"test",adminToken:"test"},"j",0,storyComposer,1)');
  await run('timers.shift()()');
  assert.equal(run('storyComposer.locked'), true);
  assert.equal(run('timers.length'), 0);
});

test('a polling response from the previous route cannot change the current Story panel', async () => {
  const panel = { isConnected: true };
  const run = runtime({ testPanel: panel, document: { addEventListener() {}, getElementById: () => panel } });
  run('var timers=[],statusChanges=0,releasePoll; window.setTimeout=callback=>timers.push(callback); updateStoryControls=()=>{}; setStoryAutomationStatus=()=>{statusChanges++}; apiGet=()=>new Promise(resolve=>{releasePoll=resolve}); storyComposer={panel:testPanel,pollVersion:1}; pollStoryPublication({slug:"test",adminToken:"test"},"j",0,storyComposer,1); var polling=timers.shift()()');
  run('storyComposer={panel:testPanel,pollVersion:1}; releasePoll({job:{id:"j",status:"publishing"}})');
  await run('polling');
  assert.equal(run('statusChanges'), 0);
  assert.equal(run('timers.length'), 0);
});


test('public restaurant normalization and persisted state discard credentials and private analytics', () => {
  const run = runtime();
  assert.equal(run('fromSheetRestaurant({slug:"amaro",admin_token:"server-should-not-return-this"}).adminToken'), undefined);
  run('state.restaurants[0].adminToken="legacy-token"; state.restaurants[0].nested={password:"old-password",session_token:"session"}; state.events=[{id:"private"}]; saveState()');
  const stored = run('localStorage.getItem(STORE_KEY)');
  assert.doesNotMatch(stored, /legacy-token|old-password|session_token|"private"/);
  run('ownerVerified=true; saveCachedInsightsHtml({slug:"amaro"},{},"private-metrics")');
  assert.equal(run('localStorage.getItem(INSIGHTS_CACHE_KEY)'), null);
  assert.equal(run('getCachedInsightsHtml({slug:"amaro"}).html'), 'private-metrics');
  run('clearOwnerSession()');
  assert.equal(run('getCachedInsightsHtml({slug:"amaro"})'), null);
});

test('private API credentials only travel in headers to the fixed Worker endpoint', async () => {
  const run = runtime();
  run('var requests=[]; fetchWithRetry=async(url,options)=>{requests.push({url,options});return {ok:true,json:async()=>({ok:true})}}');
  await run('apiGet("getRestaurantPlan",{slug:"amaro",token:"private-client-token"})');
  assert.doesNotMatch(run('requests[0].url'), /private-client-token|token=/);
  assert.equal(run('requests[0].options.headers["X-Client-Token"]'), 'private-client-token');
  await run('apiPost({action:"saveMenu",slug:"amaro",token:"private-client-token"})');
  assert.doesNotMatch(run('requests[1].options.body'), /private-client-token/);
  assert.equal(run('requests[1].options.headers["X-Client-Token"]'), 'private-client-token');
  await assert.rejects(run('endpointGet("https://untrusted.example/", "getInsights", {token:"private-client-token"})'), /authenticated_endpoint_not_allowed/);
  assert.equal(run('requests.length'), 2);
});

test('restaurant access is validated by the server rather than stored public restaurant metadata', async () => {
  const run = runtime();
  run('var checked; apiPost=async data=>{checked=data;throw new Error("unauthorized")}; sessionStorage.setItem("qrstack:client-access:amaro","1")');
  assert.equal(await run('hasClientAccess({slug:"amaro",adminToken:"known-public-value"},new URLSearchParams({token:"known-public-value"}))'), false);
  assert.equal(run('clientToken({slug:"amaro"})'), '');
  run('apiPost=async data=>{checked=data;return {ok:true}}');
  assert.equal(await run('hasClientAccess({slug:"amaro"},new URLSearchParams({token:"valid-client-secret"}))'), true);
  assert.equal(run('checked.action'), 'verifyClientAccess');
  assert.equal(run('clientToken({slug:"amaro"})'), 'valid-client-secret');
  assert.doesNotMatch(run('clientPortalLink({slug:"amaro"})'), /valid-client-secret|token=/);
  assert.doesNotMatch(run('localStorage.getItem(STORE_KEY)'), /valid-client-secret/);
});

test('password recovery token is sent once, stays out of storage, and does not log the user in', async () => {
  const run = runtime();
  run('var sent,settings; ownerResetToken="one-time-reset"; fetchWithRetry=async(url,options,retry)=>{sent=JSON.parse(options.body);settings=retry;return {ok:true,json:async()=>({ok:true})}}');
  await run('completeOwnerRecovery("new-password-long")');
  assert.equal(run('sent.token'), 'one-time-reset');
  assert.equal(run('sent.action'), 'resetOwnerPassword');
  assert.equal(run('settings.attempts'), 1);
  assert.equal(run('ownerResetToken'), '');
  assert.equal(run('OWNER_SESSION_TOKEN'), '');
  assert.equal(run('ownerVerified'), false);
  assert.doesNotMatch(run('localStorage.getItem(STORE_KEY)'), /one-time-reset|new-password-long/);
});

test('rate-limit responses preserve server retry guidance and are never automatically replayed', async () => {
  const run = runtime();
  run('var calls=0; fetchWithRetry=async()=>{calls++;return {ok:false,status:429,headers:{get:()=>"120"},json:async()=>({ok:false,error:"rate_limited"})}}');
  await assert.rejects(run('requestOwnerRecovery("test@example.com")'), error => error.message === 'too_many_attempts' && error.retryAfter === 120);
  assert.equal(run('calls'), 1);
  assert.match(run('authRetryMessage({retryAfter:120})'), /2 minuto/);
});


test('reset and access secrets are removed from both query and fragment without removing harmless view state', () => {
  let replacement;
  const run = runtime({location: {origin:'https://example.test',pathname:'/app/',search:'?token=secret&v=1',hash:'#/redefinir?token=secret&view=reset'}, history:{replaceState:(_state,_title,url)=>{replacement=url}}});
  run('removeAccessFromUrl("token")');
  assert.equal(replacement, '/app/?v=1#/redefinir?view=reset');
  assert.doesNotMatch(replacement, /secret|token=/);
});
