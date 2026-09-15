/* PeerMatch: one Contact person section with optional name, phone and email for Guy/Girl profiles. */
(function(){
  document.documentElement.dataset.peerMatchVersion='43';

  let activeProfile=null;

  const style=document.createElement('style');
  style.textContent=`
    .v39SenderTitle{margin:10px 1px 2px;font-size:13px;font-weight:850;color:var(--text)}
    .v39SenderTitle span{font-size:10px;font-weight:650;color:var(--muted)}
    .v19Source.v39SenderGrid{grid-template-columns:minmax(0,1fr) minmax(112px,.78fr) minmax(0,1.18fr)!important;gap:7px!important;align-items:end}
    .v19Source.v39SenderGrid label{margin:4px 0 8px!important}
    @media(max-width:520px){
      .v19Source.v39SenderGrid{grid-template-columns:1fr 1fr!important}
      .v19Source.v39SenderGrid label:first-child{grid-column:1/-1}
    }
  `;
  document.head.appendChild(style);

  function record(k,id){return (data[k]||[]).find(x=>String(x.id)===String(id))||null;}
  function heading(){return String(document.querySelector('#sheet h2')?.textContent||'').trim();}
  function kindFromHeading(h){if(/Guy/i.test(h))return'guys';if(/Girl/i.test(h))return'girls';return null;}
  function setLabelText(label,text){
    if(!label)return;
    [...label.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE).forEach(n=>n.remove());
    label.insertBefore(document.createTextNode(text),label.firstChild);
  }
  function sleep(ms){return new Promise(r=>setTimeout(r,ms));}

  function addEmailPill(k,id){
    const x=record(k,id);if(!x)return;
    const email=String(x.sourceEmail||'').trim();
    document.querySelectorAll('.v39SenderEmailPill').forEach(el=>el.remove());
    if(!email)return;
    const sheet=document.getElementById('sheet');if(!sheet)return;
    let meta=sheet.querySelector('.pmMeta');
    if(!meta){
      const head=sheet.querySelector('.v19Head');if(!head)return;
      meta=document.createElement('div');meta.className='pmMeta';meta.style.margin='6px 0 9px';head.insertAdjacentElement('afterend',meta);
    }
    const pill=document.createElement('span');pill.className='pmPill v39SenderEmailPill';pill.textContent=email;meta.appendChild(pill);
  }

  async function persistAfterBaseSave(mode,k,id,email,beforeIds){
    for(let i=0;i<120;i++){
      await sleep(80);
      const formStillHere=!!document.getElementById('v19SenderEmail');
      if(mode==='add'){
        const x=(data[k]||[]).find(z=>!beforeIds.has(String(z.id)));
        if(x&&!formStillHere){
          x.sourceEmail=email;
          try{await save();renderP(k);}catch(e){console.warn('PeerMatch contact email save',e);}
          return;
        }
      }else{
        const x=record(k,id);
        if(x&&!formStillHere){
          x.sourceEmail=email;
          try{await save();renderP(k);}catch(e){console.warn('PeerMatch contact email save',e);}
          addEmailPill(k,id);
          return;
        }
      }
    }
  }

  function decorateSenderForm(){
    const name=document.getElementById('v19Sender');
    const phone=document.getElementById('v19SenderPhone');
    if(!name||!phone)return;
    const grid=name.closest('.v19Source');if(!grid||grid.dataset.v39Ready==='1')return;
    grid.dataset.v39Ready='1';grid.classList.add('v39SenderGrid');

    setLabelText(name.closest('label'),'Name');
    setLabelText(phone.closest('label'),'Phone');
    name.placeholder='Name';
    phone.placeholder='Phone';

    const title=document.createElement('div');
    title.className='v39SenderTitle';
    title.textContent='Contact person';
    grid.insertAdjacentElement('beforebegin',title);

    const emailLabel=document.createElement('label');
    emailLabel.appendChild(document.createTextNode('Email'));
    const email=document.createElement('input');
    email.id='v19SenderEmail';email.type='email';email.inputMode='email';email.autocomplete='email';email.placeholder='Email';
    emailLabel.appendChild(email);grid.appendChild(emailLabel);

    const h=heading(),k=kindFromHeading(h),isEdit=/^Edit\b/i.test(h);
    if(isEdit&&activeProfile&&activeProfile.k===k){
      const x=record(k,activeProfile.id);if(x)email.value=String(x.sourceEmail||'');
    }

    const saveBtn=document.getElementById('v19Save');
    if(!saveBtn||saveBtn.dataset.v39Bound==='1')return;
    saveBtn.dataset.v39Bound='1';
    const beforeIds=new Set((k&&data[k]||[]).map(x=>String(x.id)));
    saveBtn.addEventListener('click',()=>{
      const value=String(document.getElementById('v19SenderEmail')?.value||'').trim();
      if(!k)return;
      if(isEdit&&activeProfile?.k===k)persistAfterBaseSave('edit',k,activeProfile.id,value,beforeIds);
      else persistAfterBaseSave('add',k,null,value,beforeIds);
    });
  }

  const priorOpenP=window.openP;
  if(typeof priorOpenP==='function')window.openP=openP=function(k,id){
    activeProfile={k,id};
    const r=priorOpenP(k,id);
    setTimeout(()=>addEmailPill(k,id),0);
    return r;
  };

  const observer=new MutationObserver(()=>decorateSenderForm());
  observer.observe(document.body,{childList:true,subtree:true});
  decorateSenderForm();
})();
