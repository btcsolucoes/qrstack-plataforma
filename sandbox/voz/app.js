const $ = id => document.getElementById(id);
const catalog = window.VOICE_CATALOG;
let groups = [], recognition = null, tick = null, watchdog = null, pauseTimer = null, editTimer = null, active = false, generation = 0;
const choices = new Map();
const money = value => {const n=Number(String(value).replace(/R\$|\s/g,'').replace(',','.'));return Number.isFinite(n)?n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):value;};
function update() {const ids=groups.map(g=>g.selected).filter(id=>id && id!=='ignore');$('count').textContent=`${new Set(ids).size} pratos`;$('simulate').disabled=active || !ids.length || groups.some(g=>!g.selected);$('receipt').replaceChildren();}
function render() {
  $('review').replaceChildren();
  groups.forEach((group,index)=>{
    const row=document.createElement('div');row.className='dish';
    const label=document.createElement('label');label.htmlFor='dish-'+index;label.textContent=group.phrase;
    const select=document.createElement('select');select.id=label.htmlFor;
    select.add(new Option('Confira e escolha um prato',''));
    const ordered=[...catalog].sort((a,b)=>Number(group.candidates.includes(b.id))-Number(group.candidates.includes(a.id)));
    for(const item of ordered) select.add(new Option(`${item.name} · ${money(item.price)}`,item.id));
    select.add(new Option('Descartar este trecho','ignore'));select.value=group.selected;
    const detail=document.createElement('small');detail.textContent=group.selected?'Sugestão encontrada no catálogo. Confira antes de simular.':group.candidates.length>1?'Mais de um prato possível. Escolha o correto.':'Sem correspondência exata. Escolha ou descarte este trecho.';
    select.onchange=()=>{group.selected=select.value;choices.set(group.phrase,select.value);update();};row.append(label,select,detail);$('review').append(row);
  });update();
}
function analyze(){const result=VoiceMatcher.identify($('transcript').value,catalog);groups=result.groups.map(group=>({...group,selected:choices.get(group.phrase) ?? group.selected}));render();$('review-status').textContent=result.blocked?'Há uma negação ou correção na fala. Edite a transcrição para deixar somente a lista final de pratos.':active?'Montando a lista enquanto você fala...':groups.length?'Confira todas as sugestões. Trechos em dúvida precisam ser resolvidos.':'Informe os nomes dos pratos por áudio ou texto.';}
$('transcript').oninput=()=>{clearTimeout(editTimer);$('simulate').disabled=true;$('receipt').replaceChildren();editTimer=setTimeout(analyze,250);};
$('simulate').onclick=()=>{if($('simulate').disabled)return;const ids=[...new Set(groups.map(g=>g.selected).filter(id=>id!=='ignore'))];const heading=document.createElement('strong');heading.textContent='Simulação concluída. Nada foi publicado.';const list=document.createElement('ul');for(const id of ids){const item=catalog.find(i=>i.id===id);const li=document.createElement('li');li.textContent=`${item.name} — ${money(item.price)}`;list.append(li);}$('receipt').replaceChildren(heading,list);};
function endUI(){active=false;clearInterval(tick);clearTimeout(watchdog);clearTimeout(pauseTimer);$('record').disabled=!(window.SpeechRecognition || window.webkitSpeechRecognition);$('record').textContent='Começar áudio';$('record').setAttribute('aria-pressed','false');$('transcript').disabled=false;analyze();}
function abort(){generation++;if(recognition)recognition.abort();recognition=null;endUI();}
$('clear').onclick=()=>{clearTimeout(editTimer);choices.clear();abort();$('transcript').value='';analyze();$('speech-status').textContent='Microfone desligado.';$('timer').textContent='00:00 / 01:00';};
const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
if(!Speech){$('record').disabled=true;$('speech-status').textContent='Este navegador não oferece transcrição por voz. Teste em outro navegador ou digite a lista.';}
$('record').onclick=()=>{
  if(!Speech || active)return;
  clearTimeout(editTimer); const current=++generation; const base=$('transcript').value.trim();const r=new Speech();recognition=r;r.lang='pt-BR';r.continuous=true;r.interimResults=true;
  active=true;$('record').disabled=true;$('record').textContent='Ouvindo...';$('record').setAttribute('aria-pressed','true');$('transcript').disabled=true;update();
  let stopping=false;
  const stopAfterPause=()=>{clearTimeout(pauseTimer);pauseTimer=setTimeout(()=>{if(current!==generation || !active || stopping)return;stopping=true;$('speech-status').textContent='Finalizando sua lista...';r.stop();},3500);};
  r.onspeechstart=()=>{if(current===generation)clearTimeout(pauseTimer);};
  r.onspeechend=()=>{if(current===generation)stopAfterPause();};
  let failed=false;const start=Date.now();$('speech-status').textContent='Aguardando permissão do microfone...';
  tick=setInterval(()=>{const seconds=Math.min(60,Math.floor((Date.now()-start)/1000));$('timer').textContent=`${seconds===60?'01:00':'00:'+String(seconds).padStart(2,'0')} / 01:00`;if(seconds>=60){clearInterval(tick);r.stop();}},250);
  watchdog=setTimeout(()=>{if(current!==generation)return;abort();$('speech-status').textContent='Limite de gravação atingido. Confira o texto recebido ou tente novamente.';},65000);
  r.onstart=()=>{if(current===generation)$('speech-status').textContent='Ouvindo...';};
  r.onresult=event=>{if(current!==generation)return;let text='';for(let i=0;i<event.results.length;i++)text+=event.results[i][0].transcript+' ';$('transcript').value=(base+' '+text).trim().slice(0,2500);analyze();stopAfterPause();};
  r.onerror=event=>{if(current!==generation)return;failed=true;const messages={'not-allowed':'Permissão do microfone negada. Libere nas configurações do navegador ou use texto.','audio-capture':'Microfone indisponível. Confira se outro aplicativo está usando o áudio.','network':'O serviço de voz não respondeu. Confira a conexão ou use texto.','no-speech':'Nenhuma fala reconhecida. Tente novamente mais perto do microfone.','service-not-allowed':'Transcrição indisponível neste navegador. Tente outro ou use texto.'};$('speech-status').textContent=messages[event.error]||'Não foi possível transcrever. Tente novamente ou use texto.';endUI();};
  r.onend=()=>{if(current!==generation)return;endUI();if(!failed)$('speech-status').textContent='Áudio encerrado. Sua lista está pronta para conferência.';};
  try{r.start();}catch{failed=true;endUI();$('speech-status').textContent='Não foi possível iniciar o microfone. Tente novamente ou use texto.';}
};
document.addEventListener('visibilitychange',()=>{if(document.hidden && active){abort();$('speech-status').textContent='Microfone desligado ao sair da página.';}});
window.addEventListener('pagehide',abort);
for(const item of catalog){const li=document.createElement('li');li.textContent=`${item.name} · ${money(item.price)}`;$('catalog').append(li);}
