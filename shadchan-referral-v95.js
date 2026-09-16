/* PeerMatch v95: reliable Shadchan referral grouping by existing ID, name, or phone. */
(function(){
  document.documentElement.dataset.peerMatchVersion='95';
  let activeShad=null,queued=false;

  const style=document.createElement('style');
  style.textContent=`
    #sheet .pmV95RefPicker{
      margin:-5px 0 10px;
      padding:8px 9px;
      border:1px solid #d7e2e9;
      border-radius:11px;
      background:#f7fafc;
      position:relative;
      z-index:40;
    }
    #sheet .pmV95RefPickerTitle{font-size:10.5px;font-weight:850;color:var(--muted);margin-bottom:5px}
    #sheet .pmV95RefSelect{
      width:100%!important;
      min-height:38px!important;
      padding:8px 9px!important;
      border:1px solid #ccd9e2!important;
      border-radius:9px!important;
      background:#fff!important;
      color:var(--text)!important;
      font:inherit!important;
      font-size:12px!important;
      pointer-events:auto!important;
      touch-action:manipulation!important;
    }
    #sheet .pmV95RefStatus{font-size:10px;color:#526c7d;margin-top:5px;min-height:12px}
  `;
  document.head.appendChild(style);

  const arr=()=>data.shadchanim||[];
  const byId=id=>arr().find(x=>String(x.id)===String(id))||null;
  const norm=s=>String(s||'').trim().toLocaleLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
  const digits=s=>String(s||'').replace(/\D/g,'');

  function phoneKeys(value){
    let d=digits(value);
    const out=new Set();
    if(d.length<7)return out;
    if(d.startsWith('00'))d=d.slice(2);
    if(!d)return out;
    out.add(d);

    /* Israeli international -> Israeli national/local forms. */
    if(d.startsWith('972')){
      let n=d.slice(3);
      if(n.startsWith('0'))n=n.slice(1);
      if(n.length>=8){out.add(n);out.add('0'+n);}
    }else{
      /* Accept a missing Israeli trunk 0, e.g. 521234567 == 0521234567. */
      if(d.startsWith('0')&&d.length>=9&&d.length<=10)out.add(d.slice(1));
      else if(!d.startsWith('0')&&d.length===9){out.add('0'+d);}
    }
    return out;
  }

  function samePhone(a,b){
    const ka=phoneKeys(a),kb=phoneKeys(b);
    if(!ka.size||!kb.size)return false;
    for(const k of ka)if(kb.has(k))return true;
    return false;
  }

  function resolveRef(value,self){
    const text=String(value||'').trim();
    if(!text)return null;
    const candidates=arr().filter(x=>x!==self);

    /* Phone wins when a phone was typed, including +972, 00972 or missing leading 0. */
    if(digits(text).length>=7){
      const matches=candidates.filter(x=>samePhone(text,x.phone));
      if(matches.length===1)return matches[0];
    }

    const n=norm(text);
    if(n){
      const matches=candidates.filter(x=>norm(x.name)===n);
      if(matches.length===1)return matches[0];
    }
    return null;
  }

  function resolveInMemory(){
    let changed=false;
    for(const x of arr()){
      const existing=x.referredById==null?null:byId(x.referredById);
      if(existing&&existing!==x)continue;
      const p=resolveRef(x.referredBy,x);
      if(p){
        if(String(x.referredById??'')!==String(p.id)){x.referredById=p.id;changed=true;}
      }else if(x.referredById!=null){
        delete x.referredById;changed=true;
      }
    }
    return changed;
  }

  function saveQuiet(){
    try{const p=save();if(p?.catch)p.catch(e=>console.warn('PeerMatch v95 referral save',e));}
    catch(e){console.warn('PeerMatch v95 referral save',e);}
  }

  function isShadForm(sheet){
    if(!sheet)return false;
    const h=String(sheet.querySelector('h2')?.textContent||'');
    return /(?:Add|Edit)\s+Shadchan/i.test(h)||!!sheet.querySelector('#v19SName,#esName,#sn');
  }

  function isAddForm(sheet){
    return /^\s*Add\s+Shadchan/i.test(String(sheet?.querySelector('h2')?.textContent||''));
  }

  function referredInput(sheet){
    if(!sheet)return null;
    const direct=sheet.querySelector('input[id*="refer" i],textarea[id*="refer" i],input[name*="refer" i],textarea[name*="refer" i]');
    if(direct)return direct;
    for(const label of sheet.querySelectorAll('label')){
      if(label.closest('.pmV95RefPicker'))continue;
      const text=String(label.childNodes[0]?.textContent||label.textContent||'').trim();
      if(/referred\s*by/i.test(text)){
        const el=label.querySelector('input,textarea');
        if(el)return el;
      }
    }
    return null;
  }

  function findSaveButton(sheet){
    const direct=sheet?.querySelector('#v19Save,#esSave,#ss');
    if(direct)return direct;
    return [...(sheet?.querySelectorAll('button')||[])].find(b=>/^\s*Save\b/i.test(String(b.textContent||'')))||null;
  }

  function selectedRecordForForm(sheet,input){
    if(isAddForm(sheet))return null;
    if(activeShad!=null){const x=byId(activeShad);if(x)return x;}
    const match=resolveRef(input?.value||'',null);
    return match&&String(match.referredBy||'')===String(input?.value||'')?match:null;
  }

  function finaliseReferral(pending,attempt){
    const sheet=document.getElementById('sheet');
    if(isShadForm(sheet)){
      if(attempt<7)setTimeout(()=>finaliseReferral(pending,attempt+1),180);
      return;
    }

    let target=pending.editId!=null?byId(pending.editId):null;
    if(!target){
      target=arr().find(x=>!pending.beforeIds.has(String(x.id)))||null;
    }
    if(!target)return;

    target.referredBy=pending.manual;
    const chosen=pending.selectedId?byId(pending.selectedId):resolveRef(pending.manual,target);
    if(chosen&&chosen!==target)target.referredById=chosen.id;
    else delete target.referredById;

    saveQuiet();
    try{renderS();}catch(e){console.warn('PeerMatch v95 render',e);}
  }

  function decorateForm(){
    const sheet=document.getElementById('sheet');
    if(!isShadForm(sheet))return;
    if(isAddForm(sheet))activeShad=null;

    const input=referredInput(sheet);
    if(!input)return;
    input.placeholder='Type a name or phone number, or choose below';

    let picker=sheet.querySelector('.pmV95RefPicker');
    if(!picker){
      picker=document.createElement('div');
      picker.className='pmV95RefPicker';
      picker.innerHTML='<div class="pmV95RefPickerTitle">Choose an existing Shadchan (optional)</div><select class="pmV95RefSelect"><option value="">Choose existing Shadchan…</option></select><div class="pmV95RefStatus"></div>';
      const label=input.closest('label');
      (label||input).insertAdjacentElement('afterend',picker);
    }

    const select=picker.querySelector('.pmV95RefSelect');
    const status=picker.querySelector('.pmV95RefStatus');
    const current=activeShad==null?null:byId(activeShad);
    const options=[...arr()].filter(x=>!current||String(x.id)!==String(current.id)).sort((a,b)=>String(a.name||'').localeCompare(String(b.name||'')));
    const sig=JSON.stringify(options.map(x=>[String(x.id),String(x.name||''),String(x.phone||'')]));
    if(select.dataset.sig!==sig){
      const previous=select.value;
      select.innerHTML='<option value="">Choose existing Shadchan…</option>';
      for(const x of options){
        const o=document.createElement('option');o.value=String(x.id);
        o.textContent=String(x.name||'Unnamed Shadchan')+(x.phone?' • '+x.phone:'');
        select.appendChild(o);
      }
      select.dataset.sig=sig;
      if([...select.options].some(o=>o.value===previous))select.value=previous;
    }

    const existing=current?.referredById!=null?byId(current.referredById):resolveRef(input.value,current);
    if(existing&&[...select.options].some(o=>o.value===String(existing.id))){
      select.value=String(existing.id);
      input.dataset.pmV95RefId=String(existing.id);
      status.textContent='Linked to '+String(existing.name||'this Shadchan')+(existing.phone?' • '+existing.phone:'');
    }

    if(input.dataset.pmV95Bound!=='1'){
      input.dataset.pmV95Bound='1';
      let applying=false;
      input.addEventListener('input',()=>{
        if(applying)return;
        const hit=resolveRef(input.value,current);
        if(hit&&[...select.options].some(o=>o.value===String(hit.id))){
          input.dataset.pmV95RefId=String(hit.id);
          select.value=String(hit.id);
          status.textContent='Matched '+String(hit.name||'existing Shadchan')+(hit.phone?' • '+hit.phone:'');
        }else{
          delete input.dataset.pmV95RefId;
          select.value='';
          status.textContent=input.value.trim()?'New/manual referrer':' ';
        }
      });
      select.addEventListener('change',()=>{
        const s=select.value?byId(select.value):null;
        if(!s){delete input.dataset.pmV95RefId;status.textContent=input.value.trim()?'New/manual referrer':' ';return;}
        applying=true;
        input.dataset.pmV95RefId=String(s.id);
        input.value=String(s.name||s.phone||'');
        input.dispatchEvent(new Event('input',{bubbles:true}));
        input.dispatchEvent(new Event('change',{bubbles:true}));
        applying=false;
        status.textContent='Selected '+String(s.name||'Shadchan')+(s.phone?' • '+s.phone:'');
      });
      for(const el of [input,select]){
        el.addEventListener('pointerdown',e=>e.stopPropagation());
        el.addEventListener('click',e=>e.stopPropagation());
      }
    }

    const saveBtn=findSaveButton(sheet);
    if(saveBtn&&saveBtn.dataset.pmV95RefSave!=='1'){
      saveBtn.dataset.pmV95RefSave='1';
      saveBtn.addEventListener('click',()=>{
        const pending={
          manual:String(input.value||'').trim(),
          selectedId:String(input.dataset.pmV95RefId||select.value||''),
          editId:isAddForm(sheet)?null:activeShad,
          beforeIds:new Set(arr().map(x=>String(x.id)))
        };
        setTimeout(()=>finaliseReferral(pending,0),120);
      });
    }
  }

  const priorOpenS=window.openS;
  if(typeof priorOpenS==='function')window.openS=function(id){activeShad=id;return priorOpenS(id);};

  const priorRenderS=window.renderS;
  if(typeof priorRenderS==='function')window.renderS=function(){
    const changed=resolveInMemory();
    if(changed)saveQuiet();
    return priorRenderS.apply(this,arguments);
  };

  document.getElementById('addShadchan')?.addEventListener('click',()=>{activeShad=null;},true);

  function polish(){decorateForm();}
  function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;polish();});}
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
  schedule();

  setTimeout(()=>{
    const changed=resolveInMemory();
    if(changed)saveQuiet();
    try{renderS();}catch(_){}
    polish();
  },450);
})();
