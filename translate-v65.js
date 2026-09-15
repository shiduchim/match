/* PeerMatch v65: translate helper on profile detail. */
(function(){
  let queued=false;
  const css=document.createElement('style');
  css.textContent='.pmV65Translate{display:inline-flex;align-items:center;gap:5px;margin:6px 0 8px;padding:6px 9px;border-radius:9px;background:#e8f1f7;color:#274b64;font-size:10.5px;font-weight:850}.pmV65Translated{margin:6px 0 9px;padding:9px 10px;border:1px solid #d7e2e9;border-radius:11px;background:#fff;white-space:pre-wrap;line-height:1.45;font-size:13px}';
  document.head.appendChild(css);

  async function localTranslate(text){
    if(!window.Translator||typeof window.Translator.create!=='function')return null;
    try{
      const tr=await window.Translator.create({sourceLanguage:'he',targetLanguage:'en'});
      return await tr.translate(text);
    }catch(_){return null;}
  }
  async function copyText(text){
    try{await navigator.clipboard.writeText(text);return true;}catch(_){return false;}
  }
  function add(){
    const sheet=document.getElementById('sheet');if(!sheet||sheet.querySelector('.pmV65Translate'))return;
    const text=sheet.querySelector('.card > .profileText');if(!text)return;
    const raw=String(text.textContent||'').trim();if(!raw)return;
    const b=document.createElement('button');b.type='button';b.className='pmV65Translate';b.textContent='Translate to English';
    b.onclick=async()=>{
      b.disabled=true;b.textContent='Translating…';
      const translated=await localTranslate(raw);
      if(translated){
        sheet.querySelector('.pmV65Translated')?.remove();
        const d=document.createElement('div');d.className='pmV65Translated';d.textContent=translated;text.closest('.card')?.insertAdjacentElement('beforebegin',d);
        b.textContent='Translated';b.disabled=false;return;
      }
      const copied=await copyText(raw);
      window.open('https://translate.google.com/','_blank','noopener');
      b.textContent=copied?'Copied — paste in Translate':'Open Translate';b.disabled=false;
    };
    text.closest('.card')?.insertAdjacentElement('beforebegin',b);
  }
  function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;add();});}
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
  schedule();
})();
