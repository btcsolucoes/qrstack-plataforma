const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function runtime(overrides = {}) {
  const root = path.resolve(__dirname, '..');
  const storage = () => {
    const values = new Map();
    return { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
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
  assert.match(owner, /minlength="12"/);
  const client = run('renderWorkspace({client:true,title:"Restaurante",content:""})');
  assert.doesNotMatch(client, /href="#\/hq\/senha"/);
});

test('password mutation is sent once and updates the current session only after confirmed success', async () => {
  const run = runtime();
  run('var sent, retryOptions; fetchWithRetry=async(url,options,retry)=>{sent=JSON.parse(options.body);retryOptions=retry;return {ok:true,json:async()=>({ok:true})}}');
  await run('updateOwnerPassword("old-password", "new-long-password")');
  assert.equal(run('retryOptions.attempts'), 1);
  assert.equal(run('sent.action'), 'changeOwnerPassword');
  assert.equal(run('sessionStorage.getItem("qrstack:owner-credential")'), 'new-long-password');
  run('fetchWithRetry=async()=>({ok:false,json:async()=>({ok:false,error:"unauthorized"})})');
  await assert.rejects(run('updateOwnerPassword("wrong-password", "unconfirmed-password")'), /unauthorized/);
  assert.equal(run('OWNER_ACCESS_TOKEN'), 'new-long-password');
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
  assert.equal(run('OWNER_ACCESS_TOKEN'), '');
  run('var credentials; apiPost=async data=>{credentials=data; throw new Error("unauthorized")};');
  assert.equal(await run('hasOwnerAccess(new URLSearchParams({key:"wrong"}))'), false);
  assert.equal(run('ownerVerified'), false);
  run('apiPost=async data=>{credentials=data;return {ok:true}}');
  assert.equal(await run('hasOwnerAccess(new URLSearchParams({key:"owner-test"}))'), true);
  assert.equal(run('credentials.action'), 'verifyOwnerAccess');
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

test('account configuration contains only public identifiers and no Instagram login', () => {
  const html = runtime()('renderHqStories()');
  assert.match(html, /name="publisher_id"/);
  assert.match(html, /name="instagram_username"/);
  assert.match(html, /name="instagram_user_id"/);
  assert.match(html, /view=story-panel/);
  assert.doesNotMatch(html, /type="password"|name="(?:password|service_token)"|APK|Android/);
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
