/* PeerMatch v65: translate helper on profile detail. */
(function(){
  let queued=false;
  const css=document.createElement('style');
  css.textContent='.pmV65Translate{display:inline-flex;align-items:center;gap:5px;margin:6px 0 8px;padding:6px 9px;border-radius:9px;background:#e8f1f7;color:#274b64;font-size:10.5px;font-weight:850}.pmV65Translated{margin:6px 0 9px;padding:9px 10px;border:1px solid #d7e2e9;border-radius:11px;background:#fff;white-space:pre-wrap;line-height:1.45;font-size:13px}';
  document.head.appendChild(css);

  function sourceLanguage(text){
    if(/[\u0590-\u05FF]/.test(text))return'he';
    if(/[\u0400-\u04FF]/.test(text))return'ru';
    return'en';
  }
  async function localTranslate(text){
    if(!window.Translator||typeof window.Translator.create!=='function')return null;
    const source=sourceLanguage(text);if(source==='en')return text;
    try{
      const tr=await window.Translator.create({sourceLanguage:source,targetLanguage:'en'});
      return await tr.translate(text);
    }catch(_){return null;}
  }
  async function copyText(text){try{await navigator.clipboard.writeText(text);return true;}catch(_){return false;}}
  function add(){
    const sheet=document.getElementById('sheet');if(!sheet||sheet.querySelector('.pmV65Translate'))return;
    const text=sheet.querySelector('.card > .profileText');if(!text)return;
    const raw=String(text.textContent||'').trim();if(!raw)return;
    const b=document.createElement('button');b.type='button';b.className='pmV65Translate';b.textContent='Translate to English';
    b.onclick=async()=>{
      if(!window.Translator||typeof window.Translator.create!=='function'){
        const tab=window.open('https://translate.google.com/','_blank','noopener');
        const copied=await copyText(raw);
        b.textContent=copied?'Copied — paste in Translate':'Open Translate';
        if(!tab)alert(copied?'Profile copied. Paste it into your translator.':'Open your translator and paste the profile text.');
        return;
      }
      b.disabled=true;b.textContent='Translating…';
      const translated=await localTranslate(raw);
      if(translated){
        sheet.querySelector('.pmV65Translated')?.remove();
        const d=document.createElement('div');d.className='pmV65Translated';d.textContent=translated;text.closest('.card')?.insertAdjacentElement('beforebegin',d);
        b.textContent=sourceLanguage(raw)==='en'?'Already English':'Translated';b.disabled=false;return;
      }
      b.disabled=false;b.textContent='Translate to English';alert('On-device translation is unavailable in this browser.');
    };
    text.closest('.card')?.insertAdjacentElement('beforebegin',b);
  }
  function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;add();});}
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
  schedule();
})();
