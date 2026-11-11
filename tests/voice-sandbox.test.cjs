const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const base=path.join(__dirname,'../sandbox/voz');
const context={window:{}};vm.runInNewContext(fs.readFileSync(path.join(base,'catalog.js'),'utf8'),context);
const catalog=context.window.VOICE_CATALOG;
const {identify}=require('../sandbox/voz/matcher.js');
test('voice uses known executive IDs and preserves compound names',()=>{
 const result=identify('Hoje vai ter cupim da guia, bobó e maminha com piamontese',catalog);
 assert.equal(result.groups.length,3);assert.equal(result.blocked,false);
 assert.deepEqual(result.groups.map(g=>catalog.find(i=>i.id===g.selected).name),['Cupim da Guia','Bobó de Camarão','Maminha Grelhada e Arroz à Piamontese']);
 for(const item of catalog){const result=identify(item.name,catalog);assert.equal(result.groups.length,1,item.name);assert.equal(result.groups[0].selected,item.id,item.name);}
});
test('ambiguous, unknown and negated speech never silently publishes guesses',()=>{
 const result=identify('cupim e camarão e sushi',catalog);
 assert.equal(result.groups.length,3);assert.ok(result.groups[0].candidates.length>1);
 assert.ok(result.groups[1].candidates.length>1);assert.equal(result.groups[2].candidates.length,0);
 assert.ok(result.groups.every(g=>!g.selected));
 assert.equal(identify('cupim da guia não tira o bobó',catalog).blocked,true);
 assert.equal(identify('sem cupim',catalog).blocked,true);
 assert.equal(identify('',catalog).groups.length,0);
});
test('duplicates collapse and sandbox contains no production transport or persistence',()=>{
 assert.equal(identify('bobó, bobó de camarão',catalog).groups.length,1);
 const app=fs.readFileSync(path.join(base,'app.js'),'utf8');
 assert.doesNotMatch(app,/fetch\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage|apiPost|saveMenuDay/);
 const html=fs.readFileSync(path.join(base,'index.html'),'utf8');
 assert.match(html,/connect-src 'none'/);assert.match(html,/form-action 'none'/);
 assert.doesNotMatch(html,/src=".*(?:workspace|script)\.js/);
});

test('spoken introductions and isolated C are noise, not dishes',()=>{
 for(const text of ['hoje vai ser bobó de camarão, c, cupim da guia','hoje vai C bobó de camarão e cupim da guia','hoje vai ser bobó de camarão, tal, tal, cupim da guia']) {
  const result=identify(text,catalog);assert.equal(result.groups.length,2,text);assert.ok(result.groups.every(g=>g.selected));
 }
 assert.equal(identify('sushi',catalog).groups[0].selected,'');
 const html=fs.readFileSync(path.join(base,'index.html'),'utf8');
 assert.doesNotMatch(html,/id="(?:stop|analyze)"/);
});

test('screen recording: natural four-dish sentence produces exactly four suggestions',()=>{
 const result=identify('Hoje vai ter Bobó parmegiana aquele franguinho da moeda e vai ter maminha piamontese também',catalog);
 assert.deepEqual(result.groups.map(g=>catalog.find(i=>i.id===g.selected)?.name),['Bobó de Camarão','Frango à Parmegiana','Franguinho da Moeda','Maminha Grelhada e Arroz à Piamontese']);
 assert.equal(result.groups.length,4);
});

test('shorthand remains unresolved when there are multiple catalog matches',()=>{
 const expanded=[...catalog,{id:'other-parmegiana',name:'Carne à Parmegiana'}];
 const result=identify('parmegiana',expanded);
 assert.equal(result.groups[0].selected,'');assert.equal(result.groups[0].candidates.length,2);
 assert.equal(identify('maminha',catalog).groups[0].selected,'');
 assert.equal(identify('bobó e sushi também',catalog).groups[1].phrase,'sushi');
});
