/* PeerMatch v96: stable detail editor that is never reparented while typing. */
(function(){
  document.documentElement.dataset.peerMatchVersion='96';
  let active=null,queued=false;

  const style=document.createElement('style');
  style.textContent=`
    #sheet.pmV93StableDetail .pmInlineTags,
    #sheet.pmV93StableDetail .pmV65Rel,
    #sheet.pmV93StableDetail .pmV91ProfileFlags{display:none!important}
    #sheet .pmV93StableFields{
      position:relative!important;
      z-index:30!important;
      pointer-events:auto!important;
      background:#fff;
      border:1px solid var(--line);
      border-radius:11px;
      padding:9px 10px;
      margin:7px 0 10px;
    }
    #sheet .pmV93Flags{display:flex;flex-wrap:wrap;gap:7px 12px;align-items:center;margin:0 0 9px;padding:0 0 9px;border-bottom:1px solid var(--line)}
    #sheet .pmV93Flags label{display:inline-flex!important;align-items:center!important;gap:5px!important;margin:0!important;width:auto!important;font-size:11px!important;font-weight:750!important;cursor:pointer!important;pointer-events:auto!important}
    #sheet .pmV93Flags input{width:16px!important;height:16px!important;min-width:16px!important;margin:0!important;padding:0!important;pointer-events:auto!important;accent-color:var(--accent)}
    #sheet .pmV93Field{display:grid;grid-template-columns:92px minmax(0,1fr);gap:8px;align-items:center;margin:6px 0}
    #sheet .pmV93Field span{font-size:11px;font-weight:800;color:var(--text)}
    #sheet .pmV93Field input{
      min-width:0!important;
      width:100%!important;
      min-height:36px!important;
      padding:8px 9px!important;
      border:1px solid var(--line)!important;
      border-radius:9px!important;
      background:#fff!important;
      color:var(--text)!important;
      font:inherit!important;
      opacity:1!important;
      pointer-events:auto!important;
      touch-action:manipulation!important;
      user-select:text!important;
      -webkit-user-select:text!important;
      position:relative!important;
      z-index:31!important;
    }
    @media(max-width:430px){#sheet .pmV93Field{grid-template-columns:82px minmax(0,1fr)}}
  `;
  document.head.appendChild(style);

  const rec=(k,id)=>(data[k]||[]).find(x=>String(x.id)===String(id))||null;
  const current=()=>active?rec(active.k,active.id):null;

  function saveQuiet(){
    try{const p=save();if(p?.catch)p.catch(e=>console.warn('PeerMatch v96 save',e));}
    catch(e){console.warn('PeerMatch v96 save',e);}
  }

  function isDetail(sheet){
    if(!sheet||!active)return false;
    if(active.k==='shadchanim')return !!sheet.querySelector('.v19ShadHead')&&!document.getElementById('v19SName')&&!document.getElementById('esName')&&!document.getElementById('sn');
    return ['guys','girls'].includes(active.k)&&!!sheet.querySelector('.v19Head')&&!sheet.querySelector('.v19ShadHead')&&!document.getElementById('v19Profile');
  }

  function stop(el){
    if(!el)return;
    for(const type of ['pointerdown','mousedown','click','keydown'])el.addEventListener(type,e=>e.stopPropagation());
    el.addEventListener('touchstart',e=>e.stopPropagation(),{passive:true});
  }

  function addField(box,label,value,placeholder,key){
    const row=document.createElement('label');row.className='pmV93Field';
    const lab=document.createElement('span');lab.textContent=label;
    const inp=document.createElement('input');inp.type='text';inp.autocomplete='off';inp.value=value==null?'':String(value);inp.placeholder=placeholder||'';
    row.append(lab,inp);box.appendChild(row);stop(inp);
    let timer=null;
    inp.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(()=>{const r=current();if(!r)return;r[key]=String(inp.value||'').trim();saveQuiet();},250);});
    return inp;
  }

  function mount(){
    const sheet=document.getElementById('sheet'),x=current();
    if(!isDetail(sheet)||!x){
      document.querySelectorAll('.pmV93StableFields').forEach(e=>e.remove());
      sheet?.classList.remove('pmV93StableDetail');
      return;
    }

    sheet.classList.add('pmV93StableDetail');
    const key=active.k+':'+String(active.id);
    let box=sheet.querySelector('.pmV93StableFields');
    if(box&&box.dataset.key===key)return;
    box?.remove();

    box=document.createElement('div');
    box.className='pmV93StableFields';
    box.dataset.key=key;

    if(active.k==='guys'||active.k==='girls'){
      const flags=document.createElement('div');flags.className='pmV93Flags';
      flags.innerHTML=`<label><input type="checkbox" data-flag="divorced">Divorced</label><label><input type="checkbox" data-flag="withKids">With kids</label><label><input type="checkbox" data-flag="kosherForKohen">Kosher for Kohen</label>`;
      for(const cb of flags.querySelectorAll('input')){
        cb.checked=!!x[cb.dataset.flag];stop(cb);
        cb.addEventListener('change',()=>{const r=current();if(!r)return;r[cb.dataset.flag]=!!cb.checked;saveQuiet();});
      }
      box.appendChild(flags);
    }

    addField(box,'Tags',x.tags,'Add tags','tags');
    addField(box,'Religious level',x.religiousLevel,'e.g. strong, moderate, light','religiousLevel');
    addField(box,'Religious details',x.religiousDetails,'e.g. Chabad, Breslev, Yeshivish, tzniut, long skirt','religiousDetails');

    const quick=sheet.querySelector('.pmInlineTools');
    if(quick)quick.insertAdjacentElement('afterend',box);
    else{
      const card=sheet.querySelector('.card');
      if(card)card.insertAdjacentElement('afterend',box);
      else sheet.appendChild(box);
    }
  }

  const priorP=window.openP;
  if(typeof priorP==='function')window.openP=function(k,id){active={k,id};const r=priorP(k,id);setTimeout(mount,140);return r;};
  const priorS=window.openS;
  if(typeof priorS==='function')window.openS=function(id){active={k:'shadchanim',id};const r=priorS(id);setTimeout(mount,140);return r;};

  function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;mount();});}
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
  schedule();
})();
