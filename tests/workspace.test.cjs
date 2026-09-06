const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function runtime() {
  const root = path.resolve(__dirname, '..');
  const storage = () => {
    const values = new Map();
    return { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
  };
  const context = vm.createContext({
    console, URL, URLSearchParams, Intl, Date, Math, JSON, Map, Set, structuredClone,
    crypto: require('node:crypto').webcrypto,
    localStorage: storage(), sessionStorage: storage(),
    window: { addEventListener() {} },
    location: { origin: 'http://localhost', pathname: '/', hash: '' },
    document: { addEventListener() {}, getElementById: () => ({ innerHTML: '' }), querySelectorAll: () => [], querySelector: () => null },
  });
  for (const file of ['data/amaro-catalog.js', 'workspace.js', 'script.js']) {
    const source = fs.readFileSync(path.join(root, file), 'utf8').replace(/\nrouter\(\);\r?\n/, '\n');
    vm.runInContext(source, context, { filename: file });
  }
  return expression => vm.runInContext(expression, context);
}

test('central has persistent navigation and keeps automatic Stories disabled', () => {
  const html = runtime()('renderWorkspace({title: "Insights", active:"insights", content:""})');
  assert.match(html, /mobile-navigation/);
  assert.match(html, /workspace-sidebar/);
  assert.match(html, /aria-current="page"/);
  assert.doesNotMatch(html, /href="[^\"]*stories/);
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
