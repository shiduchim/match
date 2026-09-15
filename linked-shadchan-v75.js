/* PeerMatch v91: reliable manual linked-Shadchan dropdown below stable profile tools. */
(function(){
  document.documentElement.dataset.peerMatchVersion='91';
  let active=null,queued=false;

  const css=document.createElement('style');
  css.textContent=`
    #sheet .pmV64ProfileLink,#sheet .pmV65ProfileLinks{display:none!important}
    #sheet .pmV75LinkedShadchan{margin:7px 0 11px;padding:9px 10px;border:1px solid #d7e2e9;border-radius:11px;background:#f7fafc;position:relative!important;z-index:8!important;pointer-events:auto!important}
    #sheet .pmV75LinkedTitle{font-size:11px;font-weight:850;color:var(--muted);margin-bottom:6px}
    #sheet .pmV78LinkedRow{display:flex;align-items:center;gap:7px;min-width:0;position:relative!important;z-index:9!important}
    #sheet .pmV78LinkedSelect{flex:1;min-width:0;width:100%;padding:9px 10px;border:1px solid #ccd9e2;border-radius:10px;background:#fff;color:var(--text);font:inherit;font-size:12px;font-weight:750;pointer-events:auto!important;touch-action:manipulation!important;position:relative!important;z-index:10!important}
    #sheet .pmV78OpenLinked{flex:0 0 auto;width:auto!important;padding:8px 10px!important;border-radius:9px!important;font-size:11px!important;font-weight:850!important;pointer-events:auto!important;touch-action:manipulation!important;position:relative!important;z-index:10!important}
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
    if(x.linkedShadchanManual===true){
      return x.linkedShadchanId==null?null:rec('shadchanim',x.linkedShadchanId);
    }
    if(x.linkedShadchanId!=null){const s=rec('shadchanim',x.linkedShadchanId);if(s)return s;}
    return legacyLinked(x);
  }

  async function persistSelection(value,status){
    const x=profile();if(!x)return false;
    const s=value===''?null:(data.shadchanim||[]).find(z=>String(z.id)===String(value))||null;
    if(value!==''&&!s){status.textContent='That Shadchan could not be found.';return false;}

    x.linkedShadchanManual=true;
    x.linkedShadchanId=s?s.id:null;
    x.sourceShadchanId=s?s.id:null;

    status.textContent='Saving…';
    try{
      await save();
      if(typeof get==='function'){
        const saved=await get('kv','state');
        const row=(saved?.[active.k]||[]).find(z=>String(z.id)===String(active.id));
        const expected=s?String(s.id):'';
        const actual=row?.linkedShadchanId==null?'':String(row.linkedShadchanId);
        if(actual!==expected&&typeof put==='function')await put('kv','state',data);
      }
      status.textContent=s?'Saved.':'Link removed.';
      setTimeout(()=>{if(status.isConnected)status.textContent='';},1100);
      return true;
    }catch(e){
      console.warn('PeerMatch v91 linked Shadchan save',e);
      status.textContent='Could not save. Try again.';
      return false;
    }
  }

  function placeBox(sheet,box){
    /* Keep this after the whole quick-details block so it no longer competes
       with Tags/Religious level for the same next-sibling position. */
    const tools=sheet.querySelector('.pmInlineTools');
    if(tools){if(tools.nextElementSibling!==box)tools.insertAdjacentElement('afterend',box);return;}
    const card=sheet.querySelector('.card');
    if(card){if(card.nextElementSibling!==box)card.insertAdjacentElement('afterend',box);return;}
    const head=sheet.querySelector('.v19Head');
    if(head&&head.nextElementSibling!==box)head.insertAdjacentElement('afterend',box);
  }

  function renderLink(){
    const sheet=document.getElementById('sheet'),x=profile();
    if(!sheet||!x||!['guys','girls'].includes(active?.k))return;
    sheet.querySelectorAll('.pmV64ProfileLink,.pmV65ProfileLinks').forEach(el=>el.remove());

    const arr=[...(data.shadchanim||[])].sort((a,b)=>String(a.name||'').localeCompare(String(b.name||'')));
    const current=linkedShad(x);
    const sig=JSON.stringify([active.k,String(active.id),current?String(current.id):'',arr.map(s=>[String(s.id),String(s.name||'')])]);
    let box=sheet.querySelector('.pmV75LinkedShadchan');
    if(box?.dataset.sig===sig){placeBox(sheet,box);return;}
    if(box)box.remove();

    box=document.createElement('div');box.className='pmV75LinkedShadchan';box.dataset.sig=sig;
    const title=document.createElement('div');title.className='pmV75LinkedTitle';title.textContent='Linked Shadchan';
    const row=document.createElement('div');row.className='pmV78LinkedRow';
    const select=document.createElement('select');select.className='pmV78LinkedSelect';
    const empty=document.createElement('option');empty.value='';empty.textContent=current?'No linked Shadchan':'Add linked Shadchan…';select.appendChild(empty);
    for(const s of arr){const o=document.createElement('option');o.value=String(s.id);o.textContent=String(s.name||'Unnamed Shadchan');select.appendChild(o);}
    select.value=current?String(current.id):'';

    const openBtn=document.createElement('button');openBtn.type='button';openBtn.className='secondary pmV78OpenLinked';openBtn.textContent='Open';openBtn.hidden=!current;
    openBtn.onclick=()=>{const s=(data.shadchanim||[]).find(z=>String(z.id)===String(select.value));if(s)openS(s.id);};
    const status=document.createElement('div');status.className='pmV78LinkedStatus';

    for(const el of [select,openBtn]){
      el.addEventListener('pointerdown',e=>e.stopPropagation());
      el.addEventListener('click',e=>e.stopPropagation());
    }

    select.addEventListener('change',async()=>{
      select.disabled=true;openBtn.disabled=true;
      const ok=await persistSelection(select.value,status);
      select.disabled=false;openBtn.disabled=false;
      if(ok){
        const s=(data.shadchanim||[]).find(z=>String(z.id)===String(select.value));
        openBtn.hidden=!s;
        box.dataset.sig='';
        setTimeout(renderLink,0);
      }
    });

    row.append(select,openBtn);box.append(title,row,status);
    placeBox(sheet,box);
  }

  function polish(){
    const sheet=document.getElementById('sheet');if(!sheet)return;
    const isProfile=!!sheet.querySelector('.v19Head')&&!sheet.querySelector('.v19ShadHead')&&!document.getElementById('v19Profile');
    if(!isProfile){sheet.querySelector('.pmV75LinkedShadchan')?.remove();return;}
    if(active&&['guys','girls'].includes(active.k))renderLink();
  }

  const priorOpenP=window.openP;
  if(typeof priorOpenP==='function')window.openP=function(k,id){active={k,id};const r=priorOpenP(k,id);setTimeout(polish,80);return r;};
  const priorOpenS=window.openS;
  if(typeof priorOpenS==='function')window.openS=function(id){active=null;return priorOpenS(id);};

  function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;polish();});}
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
  schedule();
})();
