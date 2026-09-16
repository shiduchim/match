/* PeerMatch v97: stable custom linked-Shadchan picker for Guy/Girl details. */
(function(){
  document.documentElement.dataset.peerMatchVersion='97';
  let active=null,queued=false;

  const css=document.createElement('style');
  css.textContent=`
    #sheet .pmV64ProfileLink,#sheet .pmV65ProfileLinks{display:none!important}
    #sheet .pmV75LinkedShadchan{margin:7px 0 11px;padding:9px 10px;border:1px solid #d7e2e9;border-radius:11px;background:#f7fafc;position:relative!important;z-index:35!important;pointer-events:auto!important}
    #sheet .pmV75LinkedTitle{font-size:11px;font-weight:850;color:var(--muted);margin-bottom:6px}
    #sheet .pmV97LinkedRow{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:7px;align-items:center;position:relative!important;z-index:36!important}
    #sheet .pmV97LinkedPicker{width:100%!important;min-width:0!important;text-align:left!important;padding:9px 10px!important;border:1px solid #ccd9e2!important;border-radius:10px!important;background:#fff!important;color:var(--text)!important;font:inherit!important;font-size:12px!important;font-weight:750!important;pointer-events:auto!important;touch-action:manipulation!important;position:relative!important;z-index:37!important}
    #sheet .pmV97LinkedPicker:after{content:' ▾';float:right;color:var(--muted)}
    #sheet .pmV78OpenLinked{width:auto!important;padding:8px 10px!important;border-radius:9px!important;font-size:11px!important;font-weight:850!important;pointer-events:auto!important;touch-action:manipulation!important;position:relative!important;z-index:37!important}
    #sheet .pmV97LinkedMenu{display:none;margin-top:7px;border:1px solid #ccd9e2;border-radius:10px;background:#fff;max-height:260px;overflow:auto;position:relative!important;z-index:50!important;pointer-events:auto!important}
    #sheet .pmV97LinkedMenu.open{display:block!important}
    #sheet .pmV97LinkedOption{display:block!important;width:100%!important;text-align:left!important;padding:10px 11px!important;margin:0!important;border-radius:0!important;border-bottom:1px solid #edf1f3!important;background:#fff!important;color:var(--text)!important;font-size:12px!important;font-weight:750!important;pointer-events:auto!important;touch-action:manipulation!important}
    #sheet .pmV97LinkedOption:last-child{border-bottom:0!important}
    #sheet .pmV97LinkedOption.current{background:#eaf1f6!important;color:#19324a!important;font-weight:900!important}
    #sheet .pmV78LinkedStatus{margin-top:5px;font-size:10.5px;color:var(--muted)}
  `;
  document.head.appendChild(css);

  const rec=(k,id)=>(data[k]||[]).find(x=>String(x.id)===String(id))||null;
  const norm=s=>String(s||'').trim().toLocaleLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
  const phoneKey=p=>typeof window.pmPhoneKey==='function'?window.pmPhoneKey(p):String(p||'').replace(/\D/g,'');
  const profile=()=>active?rec(active.k,active.id):null;

  function legacyLinked(x){
    if(!x)return null;
    for(const id of [x.sourceShadchanId,x.importedFromShadchanId,x.sourceShadchanId2]){
      if(id!=null){const s=rec('shadchanim',id);if(s)return s;}
    }
    const phones=[x.sourcePhone,x.sourcePhone2].map(phoneKey).filter(Boolean);
    for(const p of phones){const s=(data.shadchanim||[]).find(z=>phoneKey(z.phone)===p);if(s)return s;}
    const names=[x.sourceName,x.source,x.importedFromShadchan].map(norm).filter(Boolean);
    for(const n of names){const s=(data.shadchanim||[]).find(z=>norm(z.name)===n);if(s)return s;}
    return null;
  }

  function linkedShad(x){
    if(!x)return null;
    if(x.linkedShadchanManual===true)return x.linkedShadchanId==null?null:rec('shadchanim',x.linkedShadchanId);
    if(x.linkedShadchanId!=null){const s=rec('shadchanim',x.linkedShadchanId);if(s)return s;}
    return legacyLinked(x);
  }

  async function persistSelection(value,status){
    const x=profile();if(!x)return false;
    const s=value==null||value===''?null:(data.shadchanim||[]).find(z=>String(z.id)===String(value))||null;
    if(value!==''&&value!=null&&!s){status.textContent='That Shadchan could not be found.';return false;}
    x.linkedShadchanManual=true;
    x.linkedShadchanId=s?s.id:null;
    x.sourceShadchanId=s?s.id:null;
    status.textContent='Saving…';
    try{
      await save();
      if(typeof get==='function'){
        const saved=await get('kv','state');
        const row=(saved?.[active.k]||[]).find(z=>String(z.id)===String(active.id));
        const expected=s?String(s.id):'',actual=row?.linkedShadchanId==null?'':String(row.linkedShadchanId);
        if(actual!==expected&&typeof put==='function')await put('kv','state',data);
      }
      status.textContent=s?'Saved.':'Link removed.';
      setTimeout(()=>{if(status.isConnected)status.textContent='';},1100);
      return true;
    }catch(e){console.warn('PeerMatch v97 linked Shadchan save',e);status.textContent='Could not save. Try again.';return false;}
  }

  function placeBox(sheet,box){
    /* Put it after the stable Tags/Religious block when present. Never compete
       for the same sibling position while the picker is open. */
    const stable=sheet.querySelector('.pmV93StableFields');
    if(stable){if(stable.nextElementSibling!==box)stable.insertAdjacentElement('afterend',box);return;}
    const tools=sheet.querySelector('.pmInlineTools');
    if(tools){if(tools.nextElementSibling!==box)tools.insertAdjacentElement('afterend',box);return;}
    const card=[...sheet.querySelectorAll('.card')].find(c=>c.querySelector('.profileText'))||sheet.querySelector('.card');
    if(card){if(card.nextElementSibling!==box)card.insertAdjacentElement('afterend',box);return;}
    const head=sheet.querySelector('.v19Head');if(head&&!box.isConnected)head.insertAdjacentElement('afterend',box);
  }

  function stop(el){
    if(!el)return;
    ['pointerdown','mousedown','click'].forEach(t=>el.addEventListener(t,e=>e.stopPropagation()));
    el.addEventListener('touchstart',e=>e.stopPropagation(),{passive:true});
  }

  function populateMenu(box){
    const menu=box.querySelector('.pmV97LinkedMenu'),picker=box.querySelector('.pmV97LinkedPicker'),openBtn=box.querySelector('.pmV78OpenLinked'),status=box.querySelector('.pmV78LinkedStatus'),x=profile();
    if(!menu||!picker||!x)return;
    const current=linkedShad(x),arr=[...(data.shadchanim||[])].sort((a,b)=>String(a.name||'').localeCompare(String(b.name||'')));
    picker.textContent=current?String(current.name||'Unnamed Shadchan'):'Add linked Shadchan…';
    openBtn.hidden=!current;
    menu.innerHTML='';
    const addOption=(value,label,isCurrent)=>{
      const b=document.createElement('button');b.type='button';b.className='pmV97LinkedOption'+(isCurrent?' current':'');b.textContent=label;stop(b);
      b.addEventListener('click',async e=>{
        e.preventDefault();e.stopPropagation();
        menu.classList.remove('open');picker.disabled=true;openBtn.disabled=true;
        const ok=await persistSelection(value,status);
        picker.disabled=false;openBtn.disabled=false;
        if(ok)populateMenu(box);
      });
      menu.appendChild(b);
    };
    addOption('',current?'No linked Shadchan':'No linked Shadchan',!current);
    for(const s of arr)addOption(String(s.id),String(s.name||'Unnamed Shadchan')+(s.phone?' • '+String(s.phone):''),!!current&&String(current.id)===String(s.id));
  }

  function buildBox(sheet){
    const box=document.createElement('div');box.className='pmV75LinkedShadchan';box.dataset.key=active.k+':'+String(active.id);
    const title=document.createElement('div');title.className='pmV75LinkedTitle';title.textContent='Linked Shadchan';
    const row=document.createElement('div');row.className='pmV97LinkedRow';
    const picker=document.createElement('button');picker.type='button';picker.className='pmV97LinkedPicker';
    const openBtn=document.createElement('button');openBtn.type='button';openBtn.className='secondary pmV78OpenLinked';openBtn.textContent='Open';
    const menu=document.createElement('div');menu.className='pmV97LinkedMenu';
    const status=document.createElement('div');status.className='pmV78LinkedStatus';
    stop(picker);stop(openBtn);
    picker.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();populateMenu(box);menu.classList.toggle('open');});
    openBtn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();const s=linkedShad(profile());if(s)openS(s.id);});
    row.append(picker,openBtn);box.append(title,row,menu,status);populateMenu(box);placeBox(sheet,box);return box;
  }

  function renderLink(){
    const sheet=document.getElementById('sheet'),x=profile();
    if(!sheet||!x||!['guys','girls'].includes(active?.k))return;
    sheet.querySelectorAll('.pmV64ProfileLink,.pmV65ProfileLinks').forEach(el=>el.remove());
    const key=active.k+':'+String(active.id);
    let box=sheet.querySelector('.pmV75LinkedShadchan');
    if(box&&box.dataset.key===key){
      /* Never rebuild or reparent while the custom menu is open. */
      if(!box.querySelector('.pmV97LinkedMenu.open')){placeBox(sheet,box);populateMenu(box);}
      return;
    }
    box?.remove();buildBox(sheet);
  }

  function polish(){
    const sheet=document.getElementById('sheet');if(!sheet)return;
    const isProfile=!!sheet.querySelector('.v19Head')&&!sheet.querySelector('.v19ShadHead')&&!document.getElementById('v19Profile');
    if(!isProfile){sheet.querySelector('.pmV75LinkedShadchan')?.remove();return;}
    if(active&&['guys','girls'].includes(active.k))renderLink();
  }

  const priorOpenP=window.openP;
  if(typeof priorOpenP==='function')window.openP=function(k,id){active={k,id};const r=priorOpenP(k,id);setTimeout(polish,160);return r;};
  const priorOpenS=window.openS;
  if(typeof priorOpenS==='function')window.openS=function(id){active=null;return priorOpenS(id);};

  function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;polish();});}
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
  schedule();
})();
