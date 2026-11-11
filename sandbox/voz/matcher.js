(function(root) {
  const normalize = text => String(text).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9\s,;\n]/g,' ').replace(/[ \t]+/g,' ').trim();
  function identify(text, catalog) {
    let source = normalize(text);
    if (!source) return { groups: [], blocked: false };
    if (/\b(nao|tira|tirar|retira|retirar|troca|trocar|menos|exceto|sem)\b/.test(source)) return {groups:[],blocked:true};
    const aliases = catalog.map((item,index)=>({name:normalize(item.name),index}));
    const extras = {'bobo':'bobo de camarao','maminha piamontese':'maminha grelhada e arroz a piamontese','maminha ao piamontese':'maminha grelhada e arroz a piamontese','maminha com piamontese':'maminha grelhada e arroz a piamontese','maminha com arroz piamontese':'maminha grelhada e arroz a piamontese','piamontese':'maminha grelhada e arroz a piamontese'};
    // Only expand a preparation shorthand when the current catalog has one match.
    for(const word of ['parmegiana','galinhada','picadinho']) {
      const matches=catalog.map((item,index)=>({item,index})).filter(({item})=>normalize(item.name).split(' ').includes(word));
      if(matches.length===1)aliases.push({name:word,index:matches[0].index});
    }
    for(const [name,target] of Object.entries(extras)) { const index=catalog.findIndex(item=>normalize(item.name)===target); if(index>=0) aliases.push({name,index}); }
    for(const alias of aliases.sort((a,b)=>b.name.length-a.name.length)) {
      source=source.replace(new RegExp('(^|\\s|[,;])'+alias.name+'(?=$|\\s|[,;])','g'),(_,prefix)=>prefix+' dishmarker'+alias.index+' ');
    }
    source=source.replace(/\b(hoje|vai|vamos|ser|ter|tem|coloca|colocar|quero|servir|pratos|prato|cardapio|sera|serao|por favor|tal|hum|aham|tambem|aquele|aquela|esse|essa|entao)\b/g,' ');
    const chunks=source.split(/[,;\n]+|\be\b/).flatMap(part=>part.split(/(dishmarker\d+)/)).map(s=>s.trim()).filter(s=>s && !/^(?:[a-z]|os|as|de|do|da)$/.test(s));
    const groups=chunks.map(chunk=>{
      const marker=/^dishmarker(\d+)$/.exec(chunk);
      if(marker) {const item=catalog[Number(marker[1])];return {phrase:item.name,candidates:[item.id],selected:item.id};}
      const tokens=chunk.split(/\s+/).filter(t=>!['o','a','os','as','de','do','da','com','ao','na','no'].includes(t));
      const candidates=catalog.filter(item=>tokens.length && tokens.every(t=>normalize(item.name).split(' ').includes(t))).map(item=>item.id);
      return {phrase:chunk,candidates,selected:''};
    });
    const seen=new Set();
    return {blocked:false,groups:groups.filter(g=>{if(!g.selected)return true;if(seen.has(g.selected))return false;seen.add(g.selected);return true;})};
  }
  root.VoiceMatcher={normalize,identify};
  if(typeof module!=='undefined')module.exports=root.VoiceMatcher;
})(globalThis);
