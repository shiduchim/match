/* PeerMatch UI usability patch.
   - Makes multi-select/delete obvious on Guys and Girls.
   - Adds a fixed Text note / Audio note / Close bar to profiles and shadchanim.
   - Removes Add received reply / Copy draft from the WhatsApp composer UI. */
(function(){
  const style=document.createElement('style');
  style.textContent=`
    .pmSelectRow{margin:9px 0 3px}
    .pmSelectRow button{width:100%;padding:11px 14px;border:1px solid #d8e1e7;background:#f3f7fa;color:var(--text)}
    .pmSelectRow button.pmSelecting{background:#e7eef3;border-color:#c8d7e1}
    .pmFixedActions{position:fixed;left:50%;bottom:max(10px,env(safe-area-inset-bottom));transform:translateX(-50%);width:min(590px,calc(100% - 24px));z-index:90;display:grid;grid-template-columns:1fr 1fr .72fr;gap:7px;padding:8px;background:rgba(255,255,255,.96);border:1px solid var(--line);border-radius:16px;box-shadow:0 4px 18px rgba(0,0,0,.16);backdrop-filter:blur(10px)}
    .pmFixedActions button{padding:9px 8px;border-radius:11px;font-size:13px;font-weight:800;min-height:38px}
    .pmFixedText,.pmFixedAudio{background:#eef3f6;color:var(--text)}
    .pmFixedClose{background:#315b78;color:#fff}
    .sheet.pmHasFixedActions{padding-bottom:82px}
    @media(max-width:430px){.pmFixedActions{width:calc(100% - 18px);gap:6px;padding:7px}.pmFixedActions button{font-size:12px;padding:9px 5px}}
  `;
  document.head.appendChild(style);

  function improveBulk(k){
    const section=document.getElementById(k+'Section');
    const toolbar=section?.querySelector('.toolbar');
    const btn=document.getElementById('pmSelect-'+k);
    if(!section||!toolbar||!btn)return;

    let row=document.getElementById('pmSelectRow-'+k);
    if(!row){
      row=document.createElement('div');
      row.id='pmSelectRow-'+k;
      row.className='pmSelectRow';
      toolbar.insertAdjacentElement('afterend',row);
    }
    if(btn.parentElement!==row)row.appendChild(btn);

    const selecting=/cancel/i.test(btn.textContent||'');
    btn.textContent=selecting?'Cancel selection':'☑ Select multiple';
    btn.classList.toggle('pmSelecting',selecting);

    const bulk=document.getElementById('pmBulk-'+k);
    if(bulk && bulk.previousElementSibling!==row)row.insertAdjacentElement('afterend',bulk);
    if(bulk && !bulk.classList.contains('hidden')){
      const delBtn=document.getElementById('pmDelete-'+k);
      if(delBtn)delBtn.textContent=(delBtn.textContent||'').replace(/^Delete\s*/,'Delete selected ');
    }
  }

  function hideExtraWhatsAppButtons(){
    const reply=document.getElementById('waReply');
    const copy=document.getElementById('waCopy');
    if(reply)reply.style.display='none';
    if(copy)copy.style.display='none';
    const mini=reply?.parentElement||copy?.parentElement;
    if(mini && mini.classList.contains('waMini'))mini.style.display='none';
  }

  function removeFixedBar(){
    document.getElementById('pmFixedActions')?.remove();
    document.getElementById('sheet')?.classList.remove('pmHasFixedActions');
  }

  function makeFixedBar(){
    const sheet=document.getElementById('sheet');
    if(!sheet)return;

    const pText=document.getElementById('pn');
    const pAudio=document.getElementById('pa');
    const pClose=document.getElementById('px');
    const sText=document.getElementById('tn');
    const sAudio=document.getElementById('an');
    const sClose=document.getElementById('cl');

    const textBtn=pText||sText;
    const audioBtn=pAudio||sAudio;
    const closeBtn=pClose||sClose;
    if(!textBtn||!audioBtn||!closeBtn){removeFixedBar();return;}

    textBtn.style.display='none';
    audioBtn.style.display='none';
    closeBtn.style.display='none';

    let bar=document.getElementById('pmFixedActions');
    if(!bar){
      bar=document.createElement('div');
      bar.id='pmFixedActions';
      bar.className='pmFixedActions';
      sheet.appendChild(bar);
    }
    sheet.classList.add('pmHasFixedActions');

    const recording=/recording/i.test(audioBtn.textContent||'');
    bar.innerHTML=`<button id="pmFixedText" class="pmFixedText">Text note</button><button id="pmFixedAudio" class="pmFixedAudio">${recording?'Stop audio':'Audio note'}</button><button id="pmFixedClose" class="pmFixedClose">Close</button>`;
    document.getElementById('pmFixedText').onclick=()=>textBtn.click();
    document.getElementById('pmFixedAudio').onclick=()=>audioBtn.click();
    document.getElementById('pmFixedClose').onclick=()=>closeBtn.click();
  }

  function decorate(){
    try{
      improveBulk('guys');
      improveBulk('girls');
      hideExtraWhatsAppButtons();
      makeFixedBar();
    }catch(e){console.warn('PeerMatch UI fixes',e);}
  }

  let scheduled=false;
  const schedule=()=>{
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(()=>{scheduled=false;decorate();});
  };

  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true,characterData:true});
  setTimeout(decorate,950);
})();
