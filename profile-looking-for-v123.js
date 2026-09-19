/* PeerMatch v123: Looking for + To what age fields for Guy/Girl profiles.
   This file owns only these two fields: form entry/edit, persistence, and detail display. */
(function(){
  document.documentElement.dataset.peerMatchVersion='123';
  let activeProfile=null,pendingEdit=null,addToken=0;

  const style=document.createElement('style');
  style.textContent=`
    #sheet .pmV123LookingForm{
      display:grid;
      grid-template-columns:minmax(0,1fr) 112px;
      gap:7px;
      align-items:end;
      margin:0 0 8px;
    }
    #sheet .pmV123LookingForm label{min-width:0;margin:8px 0 0!important}
    #sheet .pmV123LookingForm input,#sheet .pmV123LookingForm textarea{min-width:0;width:100%}
    #sheet .pmV123LookingForm textarea{min-height:72px!important;resize:vertical}
    #sheet .pmV123LookingDetail{
      background:#fff;
      border:1px solid var(--line);
      border-radius:12px;
      padding:9px 10px;
      margin:8px 0 10px;
      font-size:13px;
      line-height:1.4;
      overflow-wrap:anywhere;
    }
    #sheet .pmV123LookingTitle{font-size:11px;font-weight:900;color:var(--muted);margin-bottom:3px}
    #sheet .pmV123LookingText{white-space:pre-wrap}
    #sheet .pmV123LookingAge{margin-top:5px;font-size:12px;color:var(--text)}
    #sheet .pmV123LookingAge b{font-weight:850}
    @media(max-width:390px){
      #sheet .pmV123LookingForm{grid-template-columns:minmax(0,1fr) 98px;gap:6px}
    }
  `;
  document.head.appendChild(style);

  const trim=v=>String(v||'').trim();
  const record=(k,id)=>(data[k]||[]).find(x=>String(x.id)===String(id))||null;

  function formKind(){
    const h=trim(document.querySelector('#sheet h2')?.textContent);
    if(/Guy/i.test(h))return'guys';
    if(/Girl/i.test(h))return'girls';
    return'';
  }
  function isEditForm(){return /^Edit\b/i.test(trim(document.querySelector('#sheet h2')?.textContent));}

  function values(){
    return{
      lookingFor:trim(document.getElementById('pmV123LookingFor')?.value),
      maxAge:trim(document.getElementById('pmV123LookingAge')?.value)
    };
  }

  function validAge(v){
    if(!v)return true;
    const n=Number(v);
    return Number.isInteger(n)&&n>=18&&n<=99;
  }

  function applyValues(r,v){
    if(!r)return;
    r.lookingFor=v.lookingFor;
    r.lookingForMaxAge=v.maxAge;
  }

  function saveQuiet(k){
    try{
      const p=save();
      if(p?.then)p.then(()=>{try{renderP(k);}catch(e){}}).catch(e=>console.warn('PeerMatch v123 Looking for save',e));
    }catch(e){console.warn('PeerMatch v123 Looking for save',e);}
  }

  function waitForAdded(k,beforeIds,v,token,attempt){
    if(token!==addToken)return;
    const r=(data[k]||[]).find(z=>!beforeIds.has(String(z.id)));
    if(r){applyValues(r,v);saveQuiet(k);return;}
    if(attempt>=40)return;
    setTimeout(()=>waitForAdded(k,beforeIds,v,token,attempt+1),200);
  }

  function installForm(){
    const sheet=document.getElementById('sheet'),profile=document.getElementById('v19Profile');
    if(!sheet||!profile||document.getElementById('pmV123LookingForm'))return;
    const k=formKind();if(!k)return;
    const edit=isEditForm(),x=edit&&activeProfile?.k===k?record(k,activeProfile.id):null;

    const block=document.createElement('div');
    block.id='pmV123LookingForm';
    block.className='pmV123LookingForm';
    block.innerHTML=`
      <label>Looking for<textarea id="pmV123LookingFor" placeholder="What are they looking for?"></textarea></label>
      <label>To what age<input id="pmV123LookingAge" type="number" min="18" max="99" inputmode="numeric" placeholder="Age"></label>`;
    profile.closest('label')?.insertAdjacentElement('afterend',block);
    block.querySelector('#pmV123LookingFor').value=trim(x?.lookingFor);
    block.querySelector('#pmV123LookingAge').value=trim(x?.lookingForMaxAge);

    const saveBtn=document.getElementById('v19Save'),cancelBtn=document.getElementById('v19Cancel');
    if(!saveBtn||saveBtn.dataset.pmV123Looking==='1')return;
    saveBtn.dataset.pmV123Looking='1';
    const beforeIds=new Set((data[k]||[]).map(z=>String(z.id)));

    cancelBtn?.addEventListener('click',()=>{
      pendingEdit=null;
      addToken++;
    },true);

    saveBtn.addEventListener('click',e=>{
      const v=values();
      if(!validAge(v.maxAge)){
        e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
        alert('Check the To what age value. Use an age from 18 to 99.');
        return;
      }

      if(edit&&activeProfile?.k===k){
        pendingEdit={k,id:activeProfile.id,v};
        return;
      }

      const token=++addToken;
      waitForAdded(k,beforeIds,v,token,0);
    },true);
  }

  function renderDetail(k,id,sig){
    const sheet=document.getElementById('sheet'),x=record(k,id);if(!sheet||!x)return;
    sheet.querySelectorAll('.pmV123LookingDetail').forEach(el=>el.remove());
    const looking=trim(x.lookingFor),age=trim(x.lookingForMaxAge);
    if(!looking&&!age)return;

    const box=document.createElement('div');box.className='pmV123LookingDetail';
    box.dataset.sig=sig||'';
    if(looking){
      const title=document.createElement('div');title.className='pmV123LookingTitle';title.textContent='Looking for';
      const text=document.createElement('div');text.className='pmV123LookingText';text.textContent=looking;
      box.append(title,text);
    }
    if(age){
      const row=document.createElement('div');row.className='pmV123LookingAge';
      const b=document.createElement('b');b.textContent='To what age: ';
      row.append(b,document.createTextNode(age));box.appendChild(row);
    }

    const profileCard=sheet.querySelector('.card > .profileText')?.closest('.card');
    const audio=sheet.querySelector('.v19ProfileAudio');
    const anchor=audio||profileCard||sheet.querySelector('.pmMeta')||sheet.querySelector('.v19Head');
    anchor?.insertAdjacentElement('afterend',box);
  }

  /* The Guy/Girl detail sheet is assembled by several files that each add their own section
     asynchronously after openP returns. A single delayed render can therefore be dropped on a
     slower device, so the box is re-checked on every DOM change and re-inserted when missing.
     The signature guard keeps that idempotent, so it cannot loop against its own mutation. */
  function detailTarget(){
    const sheet=document.getElementById('sheet');
    if(!sheet||document.getElementById('v19Profile'))return null;
    if(!sheet.querySelector('.v19Head')||sheet.querySelector('.v19ShadHead'))return null;
    if(!activeProfile||(activeProfile.k!=='guys'&&activeProfile.k!=='girls'))return null;
    return record(activeProfile.k,activeProfile.id)?activeProfile:null;
  }

  function ensureDetail(){
    const sheet=document.getElementById('sheet'),target=detailTarget();
    if(!target){sheet?.querySelectorAll('.pmV123LookingDetail').forEach(el=>el.remove());return;}
    const x=record(target.k,target.id),looking=trim(x.lookingFor),age=trim(x.lookingForMaxAge);
    const existing=sheet.querySelector('.pmV123LookingDetail');
    if(!looking&&!age){existing?.remove();return;}
    const sig=target.k+':'+target.id+':'+looking+':'+age;
    if(existing&&existing.dataset.sig===sig)return;
    renderDetail(target.k,target.id,sig);
  }

  const priorOpenP=window.openP;
  if(typeof priorOpenP==='function')window.openP=function(k,id){
    activeProfile={k,id};
    if(pendingEdit&&pendingEdit.k===k&&String(pendingEdit.id)===String(id)){
      const r=record(k,id),v=pendingEdit.v;
      pendingEdit=null;
      if(r){applyValues(r,v);saveQuiet(k);}
    }
    const out=priorOpenP(k,id);
    setTimeout(ensureDetail,90);
    return out;
  };

  let scheduled=false;
  function schedule(){
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(()=>{scheduled=false;installForm();ensureDetail();});
  }
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
  schedule();
})();
