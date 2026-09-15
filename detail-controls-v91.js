/* PeerMatch v91: stable detail controls + profile flags above Tags. */
(function(){
  document.documentElement.dataset.peerMatchVersion='91';
  let active=null,queued=false;

  const css=document.createElement('style');
  css.textContent=`
    #sheet .pmInlineTools,
    #sheet .pmInlineTags,
    #sheet .pmV65Rel,
    #sheet .pmV75LinkedShadchan{
      position:relative!important;
      pointer-events:auto!important;
    }
    #sheet #pmV62InlineTags,
    #sheet #pmV62FormTags,
    #sheet .pmV65RelInput,
    #sheet #pmV65RelForm input,
    #sheet #st,
    #sheet #v19STags,
    #sheet #esTags,
    #sheet .pmV78LinkedSelect,
    #sheet .pmV78OpenLinked{
      position:relative!important;
      z-index:12!important;
      pointer-events:auto!important;
      touch-action:manipulation!important;
      opacity:1!important;
    }
    #sheet .pmV91ProfileFlags{
      display:flex;
      flex-wrap:wrap;
      align-items:center;
      gap:6px 12px;
      margin:1px 0 8px;
      padding:0 0 8px;
      border-bottom:1px solid var(--line);
      position:relative;
      z-index:11;
      pointer-events:auto;
    }
    #sheet .pmV91ProfileFlags label{
      display:inline-flex!important;
      align-items:center!important;
      gap:5px!important;
      margin:0!important;
      padding:0!important;
      width:auto!important;
      color:var(--text)!important;
      font-size:11px!important;
      font-weight:750!important;
      cursor:pointer!important;
      pointer-events:auto!important;
      white-space:nowrap;
    }
    #sheet .pmV91ProfileFlags input{
      width:16px!important;
      height:16px!important;
      min-width:16px!important;
      margin:0!important;
      padding:0!important;
      accent-color:var(--accent);
      pointer-events:auto!important;
      cursor:pointer!important;
    }
  `;
  document.head.appendChild(css);

  const rec=(k,id)=>(data[k]||[]).find(x=>String(x.id)===String(id))||null;
  const current=()=>active?rec(active.k,active.id):null;

  function saveQuiet(){
    try{const p=save();if(p?.catch)p.catch(e=>console.warn('PeerMatch v91 save',e));}
    catch(e){console.warn('PeerMatch v91 save',e);}
  }

  function stopControl(el){
    if(!el||el.dataset.pmV91Control==='1')return;
    el.dataset.pmV91Control='1';
    if('readOnly' in el)el.readOnly=false;
    el.addEventListener('pointerdown',e=>e.stopPropagation());
    el.addEventListener('mousedown',e=>e.stopPropagation());
    el.addEventListener('touchstart',e=>e.stopPropagation(),{passive:true});
    el.addEventListener('click',e=>e.stopPropagation());
    el.addEventListener('keydown',e=>e.stopPropagation());
  }

  function bindQuickFields(){
    const sheet=document.getElementById('sheet');
    if(!sheet)return;

    sheet.querySelectorAll('#pmV62InlineTags,#pmV62FormTags,.pmV65RelInput,#pmV65RelForm input,#st,#v19STags,#esTags,.pmV78LinkedSelect,.pmV78OpenLinked').forEach(stopControl);

    const x=current();
    if(!x)return;

    const tag=sheet.querySelector('#pmV62InlineTags');
    if(tag&&tag.dataset.pmV91Save!=='1'){
      tag.dataset.pmV91Save='1';let timer=null;
      tag.addEventListener('input',()=>{
        clearTimeout(timer);
        timer=setTimeout(()=>{
          const r=current();if(!r)return;
          r.tags=String(tag.value||'').trim();
          saveQuiet();
        },220);
      });
    }

    const rel=sheet.querySelector('.pmV65RelInput');
    if(rel&&rel.dataset.pmV91Save!=='1'){
      rel.dataset.pmV91Save='1';let timer=null;
      rel.addEventListener('input',()=>{
        clearTimeout(timer);
        timer=setTimeout(()=>{
          const r=current();if(!r)return;
          r.religiousLevel=String(rel.value||'').trim();
          saveQuiet();
        },220);
      });
    }
  }

  function ensureProfileFlags(){
    if(!active||!['guys','girls'].includes(active.k))return;
    const x=current(),sheet=document.getElementById('sheet'),box=sheet?.querySelector('.pmInlineTools'),tags=box?.querySelector('.pmInlineTags');
    if(!x||!box||!tags||document.getElementById('v19Profile'))return;

    let flags=box.querySelector('.pmV91ProfileFlags');
    if(!flags){
      flags=document.createElement('div');
      flags.className='pmV91ProfileFlags';
      flags.innerHTML=`
        <label><input type="checkbox" data-pm-v91="divorced">Divorced</label>
        <label><input type="checkbox" data-pm-v91="withKids">With kids</label>
        <label><input type="checkbox" data-pm-v91="kosherForKohen">Kosher for Kohen</label>`;
      tags.insertAdjacentElement('beforebegin',flags);
      flags.querySelectorAll('input').forEach(stopControl);
      flags.addEventListener('change',e=>{
        const cb=e.target.closest('input[data-pm-v91]');if(!cb)return;
        const r=current();if(!r)return;
        r[cb.dataset.pmV91]=!!cb.checked;
        saveQuiet();
      });
    }

    const values={divorced:!!x.divorced,withKids:!!x.withKids,kosherForKohen:!!x.kosherForKohen};
    for(const [key,val] of Object.entries(values)){
      const cb=flags.querySelector(`input[data-pm-v91="${key}"]`);
      if(cb&&document.activeElement!==cb)cb.checked=val;
    }
  }

  function polish(){
    bindQuickFields();
    ensureProfileFlags();
  }

  const priorP=window.openP;
  if(typeof priorP==='function')window.openP=function(k,id){
    active={k,id};
    const r=priorP(k,id);
    setTimeout(polish,100);
    return r;
  };

  const priorS=window.openS;
  if(typeof priorS==='function')window.openS=function(id){
    active={k:'shadchanim',id};
    const r=priorS(id);
    setTimeout(polish,100);
    return r;
  };

  function schedule(){
    if(queued)return;
    queued=true;
    requestAnimationFrame(()=>{queued=false;polish();});
  }
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
  schedule();
})();
