/* PeerMatch v73: one Contact person heading + robust in-app translation. */
(function(){
  document.documentElement.dataset.peerMatchVersion='73';
  let queued=false;

  const css=document.createElement('style');
  css.textContent=`
    /* Old contact-actions keeps creating its own label because contact info sits between the label and buttons.
       Hide that implementation label and render one stable heading of our own. */
    #sheet .pmContactLabel[data-pm-contact-for="person"]{display:none!important}
    #sheet .pmV73ContactHeading{display:block!important;margin:10px 0 6px!important;font-size:14px!important;font-weight:850!important;color:var(--text)!important}
    #sheet .pmV73TranslateBar{display:flex;flex-wrap:wrap;gap:6px;margin:5px 0 8px}
    #sheet .pmV73TranslateBar button{padding:7px 9px!important;border-radius:9px!important;background:#e8f1f7!important;color:#274b64!important;font-size:10.5px!important;font-weight:850!important}
    #sheet .pmV73TranslateStatus{font-size:11px;color:var(--muted);margin:4px 0 7px}
    #sheet .pmV73Translated{margin:6px 0 9px;padding:10px;border:1px solid #d7e2e9;border-radius:11px;background:#fff;white-space:pre-wrap;line-height:1.45;font-size:13px}
  `;
  document.head.appendChild(css);

  function contactHeading(){
    const sheet=document.getElementById('sheet'),buttons=sheet?.querySelector('.pmProfileContact');
    if(!sheet||!buttons)return;
    const people=sheet.querySelector('.pmV67ContactPeople');
    let h=sheet.querySelector('.pmV73ContactHeading');
    if(!h){h=document.createElement('div');h.className='pmV73ContactHeading';h.textContent='Contact person';}
    const anchor=people||buttons;
    if(h.nextElementSibling!==anchor)anchor.insertAdjacentElement('beforebegin',h);
    // Remove any accidental visible legacy duplicates without disturbing our own heading.
    for(const el of sheet.querySelectorAll('.pmContactLabel')){
      if(String(el.textContent||'').trim()==='Contact person'&&el.dataset.pmContactFor!=='person')el.remove();
    }
  }

  function detectLanguage(text){
    const s=String(text||'');
    const he=(s.match(/[\u0590-\u05FF]/g)||[]).length;
    const ru=(s.match(/[\u0400-\u04FF]/g)||[]).length;
    const en=(s.match(/[A-Za-z]/g)||[]).length;
    if(he>=ru&&he>=en&&he>0)return'he';
    if(ru>=he&&ru>=en&&ru>0)return'ru';
    return'en';
  }

  function chunks(text,max=1400){
    const out=[];let rest=String(text||'').trim();
    while(rest.length>max){
      let cut=rest.lastIndexOf('\n',max);
      if(cut<max*.55)cut=rest.lastIndexOf(' ',max);
      if(cut<max*.55)cut=max;
      out.push(rest.slice(0,cut));
      rest=rest.slice(cut).replace(/^\s+/,'');
    }
    if(rest)out.push(rest);
    return out;
  }

  async function chromeTranslate(text,source,target,status){
    if(!('Translator' in self)||typeof Translator.create!=='function')return null;
    if(source===target)return text;
    try{
      if(typeof Translator.availability==='function'){
        const a=await Translator.availability({sourceLanguage:source,targetLanguage:target});
        if(a==='unavailable')return null;
        if(a==='downloadable'||a==='downloading')status.textContent='Preparing '+source.toUpperCase()+' → '+target.toUpperCase()+' translation…';
      }
      const tr=await Translator.create({
        sourceLanguage:source,
        targetLanguage:target,
        monitor(m){
          try{m.addEventListener('downloadprogress',e=>{status.textContent='Downloading translation language pack… '+Math.round((e.loaded||0)*100)+'%';});}catch(_){ }
        }
      });
      const out=[];
      const parts=chunks(text);
      for(let i=0;i<parts.length;i++){
        status.textContent=parts.length>1?`Translating ${i+1} of ${parts.length}…`:'Translating…';
        out.push(await tr.translate(parts[i]));
      }
      try{tr.destroy?.();}catch(_){ }
      return out.join('\n\n');
    }catch(e){
      console.warn('PeerMatch Chrome translation pair failed',source,target,e);
      return null;
    }
  }

  async function webTranslate(text,source,target,status){
    const out=[],parts=chunks(text,1200);
    for(let i=0;i<parts.length;i++){
      status.textContent=parts.length>1?`Translating ${i+1} of ${parts.length}…`:'Translating…';
      const u='https://translate.googleapis.com/translate_a/single?client=gtx&sl='+encodeURIComponent(source)+'&tl='+encodeURIComponent(target)+'&dt=t&q='+encodeURIComponent(parts[i]);
      const r=await fetch(u,{method:'GET',cache:'no-store'});
      if(!r.ok)throw new Error('Translation service '+r.status);
      const j=await r.json();
      out.push((j?.[0]||[]).map(a=>a?.[0]||'').join(''));
    }
    return out.join('\n\n');
  }

  async function translate(raw,target,status,out){
    const source=detectLanguage(raw);
    if(source===target){out.textContent=raw;out.classList.remove('hidden');status.textContent='Already '+({en:'English',he:'Hebrew',ru:'Russian'}[target]||target)+'.';return;}
    status.textContent='Translating…';
    try{
      let t=await chromeTranslate(raw,source,target,status);
      if(!t)t=await webTranslate(raw,source,target,status);
      out.textContent=t;out.classList.remove('hidden');status.textContent='';
    }catch(e){
      console.warn('PeerMatch translation failed',e);
      status.textContent='Translation is temporarily unavailable. Please try again.';
    }
  }

  function translation(){
    const sheet=document.getElementById('sheet'),text=sheet?.querySelector('.card > .profileText');
    if(!sheet||!text)return;
    const raw=String(text.textContent||'').trim();if(!raw)return;

    // Remove prior translation UI from older patches so only this implementation responds.
    sheet.querySelectorAll('.pmV67TranslateBar,.pmV67TranslateStatus,.pmV67Translated,.pmV65Translated').forEach(el=>el.remove());
    let b=sheet.querySelector('.pmV65Translate');
    if(!b){b=document.createElement('button');b.type='button';b.className='pmV65Translate';text.closest('.card')?.insertAdjacentElement('beforebegin',b);}
    if(b.dataset.pmV73Translate==='1')return;
    const fresh=b.cloneNode(false);fresh.type='button';fresh.className='pmV65Translate';fresh.textContent='Translate';fresh.dataset.pmV73Translate='1';b.replaceWith(fresh);
    fresh.onclick=()=>{
      let bar=sheet.querySelector('.pmV73TranslateBar');
      if(bar){bar.classList.toggle('hidden');return;}
      bar=document.createElement('div');bar.className='pmV73TranslateBar';
      bar.innerHTML='<button type="button" data-lang="en">English</button><button type="button" data-lang="he">Hebrew</button><button type="button" data-lang="ru">Russian</button>';
      const status=document.createElement('div');status.className='pmV73TranslateStatus';
      const out=document.createElement('div');out.className='pmV73Translated hidden';
      fresh.insertAdjacentElement('afterend',bar);bar.insertAdjacentElement('afterend',status);status.insertAdjacentElement('afterend',out);
      bar.addEventListener('click',e=>{const x=e.target.closest('button[data-lang]');if(x)translate(raw,x.dataset.lang,status,out);});
    };
  }

  function polish(){contactHeading();translation();}
  function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;polish();});}
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
  schedule();
})();
