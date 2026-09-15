/* PeerMatch v75: explicit linked Shadchan control directly under Edit Profile. */
(function(){
  document.documentElement.dataset.peerMatchVersion='75';
  let active=null,queued=false;

  const css=document.createElement('style');
  css.textContent=`
    /* Older auto-link boxes are replaced by the explicit v75 control. */
    #sheet .pmV64ProfileLink,#sheet .pmV65ProfileLinks{display:none!important}
    #sheet .pmV75LinkedShadchan{margin:7px 0 11px;padding:9px 10px;border:1px solid #d7e2e9;border-radius:11px;background:#f7fafc}
    #sheet .pmV75LinkedTitle{font-size:11px;font-weight:850;color:var(--muted);margin-bottom:6px}
    #sheet .pmV75LinkedRow{display:flex;align-items:center;gap:7px;min-width:0}
    #sheet .pmV75LinkedName{flex:1;min-width:0;text-align:left;padding:8px 9px!important;border-radius:9px!important;background:#e8f1f7!important;color:#274b64!important;font-size:12px!important;font-weight:850!important;overflow-wrap:anywhere}
    #sheet .pmV75LinkedChange,#sheet .pmV75AddLinked{width:auto!important;padding:8px 9px!important;border-radius:9px!important;font-size:11px!important;font-weight:850!important}
    #sheet .pmV75AddLinked{background:#e8f1f7!important;color:#274b64!important}
    .pmV75Picker{position:fixed;inset:0;z-index:15000;background:rgba(0,0,0,.38);display:flex;align-items:flex-end;justify-content:center;padding:14px}
    .pmV75PickerCard{width:min(560px,100%);max-height:min(78vh,680px);display:flex;flex-direction:column;background:#fff;border-radius:18px;padding:14px;box-shadow:0 8px 28px rgba(0,0,0,.22)}
    .pmV75PickerHead{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:9px}
    .pmV75PickerHead b{font-size:17px}.pmV75PickerClose{width:auto!important;padding:7px 10px!important;border-radius:9px!important}
    .pmV75PickerSearch{width:100%;margin:0 0 9px!important;padding:10px 11px!important;border:1px solid #ccd9e2!important;border-radius:10px!important;font-size:14px!important}
    .pmV75PickerList{overflow:auto;display:grid;gap:6px;padding-bottom:max(2px,env(safe-area-inset-bottom))}
    .pmV75Pick{display:block!important;width:100%!important;text-align:left!important;padding:10px 11px!important;border:1px solid #d7e2e9!important;border-radius:10px!important;background:#fff!important;color:var(--text)!important}
    .pmV75PickName{display:block;font-size:13px;font-weight:850}.pmV75PickMeta{display:block;margin-top:2px;font-size:10.5px;color:var(--muted);overflow-wrap:anywhere}
    .pmV75PickerEmpty{padding:14px 5px;color:var(--muted);font-size:12px;text-align:center}
  `;
  document.head.appendChild(css);

  const rec=(k,id)=>(data[k]||[]).find(x=>String(x.id)===String(id))||null;
  const norm=s=>String(s||'').trim().toLocaleLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
  const phoneKey=p=>typeof window.pmPhoneKey==='function'?window.pmPhoneKey(p):String(p||'').replace(/\D/g,'');

  function profile(){return active?rec(active.k,active.id):null;}
  function explicitShad(x){
    if(!x)return null;
    for(const id of [x.sourceShadchanId,x.importedFromShadchanId,x.sourceShadchanId2]){
      if(id!=null){const s=rec('shadchanim',id);if(s)return s;}
    }
    return null;
  }
  function inferredShad(x){
    if(!x)return null;
    const phones=[x.sourcePhone,x.sourcePhone2].map(phoneKey).filter(Boolean);
    for(const p of phones){const s=(data.shadchanim||[]).find(z=>phoneKey(z.phone)===p);if(s)return s;}
    const names=[x.sourceName,x.source,x.importedFromShadchan].map(norm).filter(Boolean);
    for(const n of names){const s=(data.shadchanim||[]).find(z=>norm(z.name)===n);if(s)return s;}
    return null;
  }
  function linkedShad(x){return explicitShad(x)||inferredShad(x);}

  async function saveLink(shad){
    const x=profile();if(!x||!shad)return;
    x.sourceShadchanId=shad.id;
    try{await save();}
    catch(e){console.warn('PeerMatch v75 linked Shadchan save',e);alert('Could not save the linked Shadchan.');return;}
    closePicker();renderLink();
  }

  function closePicker(){document.querySelector('.pmV75Picker')?.remove();}
  function picker(){
    const arr=[...(data.shadchanim||[])].sort((a,b)=>String(a.name||'').localeCompare(String(b.name||'')));
    if(!arr.length){alert('There are no Shadchanim yet. Add a Shadchan first, then link this profile.');return;}
    closePicker();
    const overlay=document.createElement('div');overlay.className='pmV75Picker';
    const card=document.createElement('div');card.className='pmV75PickerCard';
    const head=document.createElement('div');head.className='pmV75PickerHead';
    const title=document.createElement('b');title.textContent='Choose linked Shadchan';
    const close=document.createElement('button');close.type='button';close.className='secondary pmV75PickerClose';close.textContent='Close';close.onclick=closePicker;
    head.append(title,close);
    const search=document.createElement('input');search.className='pmV75PickerSearch';search.placeholder='Search Shadchanim';search.autocomplete='off';
    const list=document.createElement('div');list.className='pmV75PickerList';
    card.append(head,search,list);overlay.appendChild(card);document.body.appendChild(overlay);
    overlay.addEventListener('click',e=>{if(e.target===overlay)closePicker();});

    const draw=()=>{
      const q=norm(search.value);list.innerHTML='';
      const matches=arr.filter(s=>!q||norm(`${s.name||''} ${s.phone||''} ${s.email||''} ${s.tags||''}`).includes(q));
      if(!matches.length){const d=document.createElement('div');d.className='pmV75PickerEmpty';d.textContent='No matching Shadchanim.';list.appendChild(d);return;}
      for(const s of matches){
        const b=document.createElement('button');b.type='button';b.className='pmV75Pick';
        const n=document.createElement('span');n.className='pmV75PickName';n.textContent=String(s.name||'Unnamed Shadchan');
        const m=document.createElement('span');m.className='pmV75PickMeta';m.textContent=[s.phone,s.email].filter(Boolean).join(' • ');
        b.append(n,m);b.onclick=()=>saveLink(s);list.appendChild(b);
      }
    };
    search.addEventListener('input',draw);draw();setTimeout(()=>search.focus(),30);
  }

  function renderLink(){
    const sheet=document.getElementById('sheet'),x=profile(),edit=sheet?.querySelector('#v19EditProfile');
    if(!sheet||!x||!edit||!['guys','girls'].includes(active?.k))return;
    sheet.querySelectorAll('.pmV64ProfileLink,.pmV65ProfileLinks').forEach(el=>el.remove());
    let box=sheet.querySelector('.pmV75LinkedShadchan');if(box)box.remove();
    box=document.createElement('div');box.className='pmV75LinkedShadchan';
    const s=linkedShad(x);
    if(s){
      const title=document.createElement('div');title.className='pmV75LinkedTitle';title.textContent='Linked Shadchan';
      const row=document.createElement('div');row.className='pmV75LinkedRow';
      const openBtn=document.createElement('button');openBtn.type='button';openBtn.className='pmV75LinkedName';openBtn.textContent=String(s.name||'Unnamed Shadchan');openBtn.onclick=()=>openS(s.id);
      const change=document.createElement('button');change.type='button';change.className='secondary pmV75LinkedChange';change.textContent='Change';change.onclick=picker;
      row.append(openBtn,change);box.append(title,row);
    }else{
      const add=document.createElement('button');add.type='button';add.className='pmV75AddLinked';add.textContent='Add linked Shadchan';add.onclick=picker;box.appendChild(add);
    }
    edit.insertAdjacentElement('afterend',box);
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
  if(typeof priorOpenS==='function')window.openS=function(id){active=null;closePicker();return priorOpenS(id);};

  function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;polish();});}
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
  schedule();
})();
