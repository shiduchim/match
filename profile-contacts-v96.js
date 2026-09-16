/* PeerMatch v96: profile person + Contact 1 + Contact 2 for Guy/Girl profiles. */
(function(){
  document.documentElement.dataset.peerMatchVersion='96';
  let active=null,queued=false;

  const style=document.createElement('style');
  style.textContent=`
    #sheet .pmV74ContactSummary,
    #sheet .pmProfileContact,
    #sheet .pmContactLabel[data-pm-contact-for="person"]{display:none!important}
    #sheet .v39SenderTitle,
    #sheet .v19Source.v39SenderGrid,
    #sheet .pmV65SecondPhone{display:none!important}

    #sheet .pmV96ContactForm,
    #sheet .pmV96Contacts{background:#fff;border:1px solid var(--line);border-radius:13px;padding:10px;margin:8px 0 11px}
    #sheet .pmV96ContactFormTitle,#sheet .pmV96ContactsTitle{font-size:13px;font-weight:900;color:var(--text);margin-bottom:6px}
    #sheet .pmV96ContactFormRow,#sheet .pmV96ContactRow{padding:8px 0;border-top:1px solid var(--line)}
    #sheet .pmV96ContactFormRow:first-of-type,#sheet .pmV96ContactRow:first-of-type{border-top:0;padding-top:2px}
    #sheet .pmV96ContactFormLabel,#sheet .pmV96ContactKind{font-size:11px;font-weight:850;color:var(--muted)}
    #sheet .pmV96MainName,#sheet .pmV96ContactName{font-size:13px;font-weight:850;color:var(--text);overflow-wrap:anywhere}
    #sheet .pmV96MainName{margin:2px 0 6px}
    #sheet .pmV96ContactFormGrid{display:grid;grid-template-columns:minmax(0,1fr) minmax(120px,.85fr);gap:7px}
    #sheet .pmV96ContactFormGrid label,#sheet .pmV96ContactFormRow>label{margin:0!important;min-width:0}
    #sheet .pmV96ContactForm input{min-width:0;width:100%}
    #sheet .pmV96ContactHead{display:flex;align-items:baseline;gap:6px;flex-wrap:wrap}
    #sheet .pmV96ContactPhone{font-size:12px;font-weight:800;color:#315b78;margin-top:3px;overflow-wrap:anywhere}
    #sheet .pmV96ContactEmpty{font-size:11px;color:var(--muted);font-style:italic;margin-top:2px}
    #sheet .pmV96ContactActions{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px;margin-top:7px}
    #sheet .pmV96ContactActions button{width:100%!important;min-width:0!important;padding:7px 3px!important;border-radius:9px!important;background:#dfeef9!important;color:#19324a!important;font-size:10px!important;font-weight:850!important}
    @media(max-width:430px){#sheet .pmV96ContactFormGrid{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);

  const rec=(k,id)=>(data[k]||[]).find(x=>String(x.id)===String(id))||null;
  const current=()=>active?rec(active.k,active.id):null;
  const trim=v=>String(v||'').trim();
  const nowStamp=()=>typeof stamp==='function'?stamp():new Date().toLocaleString();

  function waPhone(p){
    let d=String(p||'').replace(/\D/g,'');
    if(d.startsWith('00'))d=d.slice(2);
    if(d.startsWith('0'))d='972'+d.slice(1);
    else if(d.length===9&&d.startsWith('5'))d='972'+d;
    return d;
  }

  function migrate(x){
    if(!x)return false;
    let changed=false;
    if(x.contact1Name==null&&trim(x.sourceName||x.source)){x.contact1Name=trim(x.sourceName||x.source);changed=true;}
    if(x.contact1Phone==null&&trim(x.sourcePhone)){x.contact1Phone=trim(x.sourcePhone);changed=true;}
    if(x.contact2Phone==null&&trim(x.sourcePhone2)){x.contact2Phone=trim(x.sourcePhone2);changed=true;}
    if(x.contact2Name==null){x.contact2Name='';changed=true;}
    if(x.profilePhone==null){x.profilePhone='';changed=true;}
    return changed;
  }

  function saveQuiet(){try{const p=save();if(p?.catch)p.catch(e=>console.warn('PeerMatch v96 contacts save',e));}catch(e){console.warn('PeerMatch v96 contacts save',e);}}

  async function logOpen(x,kind,name,phone,channel){
    if(!x||!phone)return false;
    x.activities=x.activities||[];
    x.activities.push({id:Date.now(),type:'action',action:`${channel} • ${kind}`,text:`${channel} opened to ${name||kind} (${phone}).`,ts:nowStamp(),recipient:name||kind,recipientPhone:phone,recipientSide:kind});
    try{await save();return true;}catch(e){console.warn('PeerMatch v96 contact history',e);alert('PeerMatch could not save this action. Nothing was opened.');return false;}
  }

  async function openChannel(kind,name,phone,channel){
    const x=current();phone=trim(phone);if(!x||!phone)return alert('Add a phone number in Edit Profile first.');
    const ok=await logOpen(x,kind,name,phone,channel);if(!ok)return;
    if(channel==='Call')location.href='tel:'+phone;
    else if(channel==='SMS')location.href='sms:'+phone;
    else{const d=waPhone(phone);if(!d)return alert('Check the phone number.');location.href='https://wa.me/'+d;}
  }

  function rowsFor(x){
    migrate(x);
    return[
      {kind:'Profile',name:trim(x.name)||'Unnamed profile',phone:trim(x.profilePhone)},
      {kind:'Contact 1',name:trim(x.contact1Name),phone:trim(x.contact1Phone)},
      {kind:'Contact 2',name:trim(x.contact2Name),phone:trim(x.contact2Phone)}
    ];
  }

  function renderDetail(){
    const sheet=document.getElementById('sheet'),x=current();
    const detail=sheet&&active&&['guys','girls'].includes(active.k)&&sheet.querySelector('.v19Head')&&!sheet.querySelector('.v19ShadHead')&&!document.getElementById('v19Profile');
    if(!detail||!x){sheet?.querySelector('.pmV96Contacts')?.remove();return;}
    if(migrate(x))saveQuiet();

    const rows=rowsFor(x),sig=JSON.stringify(rows.map(r=>[r.kind,r.name,r.phone]));
    let box=sheet.querySelector('.pmV96Contacts');if(box?.dataset.sig===sig)return;box?.remove();
    box=document.createElement('div');box.className='pmV96Contacts';box.dataset.sig=sig;
    const title=document.createElement('div');title.className='pmV96ContactsTitle';title.textContent='Contacts';box.appendChild(title);

    for(const c of rows){
      const row=document.createElement('div');row.className='pmV96ContactRow';
      const head=document.createElement('div');head.className='pmV96ContactHead';
      const kind=document.createElement('span');kind.className='pmV96ContactKind';kind.textContent=c.kind+':';
      const name=document.createElement('span');name.className='pmV96ContactName';name.textContent=c.name||'Not added';head.append(kind,name);row.appendChild(head);
      if(c.phone){
        const phone=document.createElement('div');phone.className='pmV96ContactPhone';phone.textContent=c.phone;row.appendChild(phone);
        const actions=document.createElement('div');actions.className='pmV96ContactActions';
        for(const channel of ['Call','SMS','WhatsApp']){const b=document.createElement('button');b.type='button';b.textContent=channel;b.onclick=e=>{e.preventDefault();e.stopPropagation();openChannel(c.kind,c.name,c.phone,channel);};actions.appendChild(b);}row.appendChild(actions);
      }else{const empty=document.createElement('div');empty.className='pmV96ContactEmpty';empty.textContent='No phone number';row.appendChild(empty);}
      box.appendChild(row);
    }

    /* Contacts is the single source of truth for its own placement — directly after Attachment
       (or after the profile text/audio when there is no attachment), never above the profile.
       Do not add a second script that repositions this element after the fact. */
    const profileCard=[...sheet.querySelectorAll('.card')].find(c=>c.querySelector('.profileText'));
    const attachment=sheet.querySelector('.pmV63Attachment:not(.pmV67ShadAttachment)');
    const audioCard=sheet.querySelector('.v19ProfileAudio');
    const anchor=attachment||audioCard||profileCard;
    if(anchor)anchor.insertAdjacentElement('afterend',box);else sheet.querySelector('.v19Head')?.insertAdjacentElement('afterend',box);
  }

  function formKind(){const h=String(document.querySelector('#sheet h2')?.textContent||'');return /Guy/i.test(h)?'guys':/Girl/i.test(h)?'girls':'';}
  function editForm(){return /^Edit\b/i.test(String(document.querySelector('#sheet h2')?.textContent||'').trim());}

  function decorateForm(){
    const sheet=document.getElementById('sheet'),nameInput=document.getElementById('v19Name'),profile=document.getElementById('v19Profile');
    if(!sheet||!nameInput||!profile||sheet.querySelector('.pmV96ContactForm'))return;
    const k=formKind();if(!k)return;
    const isEdit=editForm(),x=isEdit&&active?.k===k?rec(k,active.id):null;if(x)migrate(x);

    const block=document.createElement('div');block.className='pmV96ContactForm';
    block.innerHTML=`<div class="pmV96ContactFormTitle">Contacts</div>
      <div class="pmV96ContactFormRow"><div class="pmV96ContactFormLabel">Profile</div><div class="pmV96MainName"></div><label>Phone<input id="pmV96ProfilePhone" type="tel" inputmode="tel" placeholder="Phone (optional)"></label></div>
      <div class="pmV96ContactFormRow"><div class="pmV96ContactFormLabel">Contact 1</div><div class="pmV96ContactFormGrid"><label>Name<input id="pmV96Contact1Name" placeholder="Name (optional)"></label><label>Phone<input id="pmV96Contact1Phone" type="tel" inputmode="tel" placeholder="Phone (optional)"></label></div></div>
      <div class="pmV96ContactFormRow"><div class="pmV96ContactFormLabel">Contact 2</div><div class="pmV96ContactFormGrid"><label>Name<input id="pmV96Contact2Name" placeholder="Name (optional)"></label><label>Phone<input id="pmV96Contact2Phone" type="tel" inputmode="tel" placeholder="Phone (optional)"></label></div></div>`;
    const oldGrid=document.getElementById('v19Sender')?.closest('.v19Source');
    if(oldGrid)oldGrid.insertAdjacentElement('beforebegin',block);else profile.closest('label')?.insertAdjacentElement('afterend',block);

    const mainName=block.querySelector('.pmV96MainName');const syncName=()=>mainName.textContent=trim(nameInput.value)||'Profile name';syncName();nameInput.addEventListener('input',syncName);
    const pp=block.querySelector('#pmV96ProfilePhone'),n1=block.querySelector('#pmV96Contact1Name'),p1=block.querySelector('#pmV96Contact1Phone'),n2=block.querySelector('#pmV96Contact2Name'),p2=block.querySelector('#pmV96Contact2Phone');
    if(x){pp.value=trim(x.profilePhone);n1.value=trim(x.contact1Name||x.sourceName||x.source);p1.value=trim(x.contact1Phone||x.sourcePhone);n2.value=trim(x.contact2Name);p2.value=trim(x.contact2Phone||x.sourcePhone2);}

    const oldName=document.getElementById('v19Sender'),oldPhone=document.getElementById('v19SenderPhone');
    let c1Touched=!!trim(n1.value)||!!trim(p1.value);
    n1.addEventListener('input',()=>{c1Touched=true;});p1.addEventListener('input',()=>{c1Touched=true;});
    const pullLegacy=()=>{if(c1Touched)return;if(oldName&&trim(oldName.value))n1.value=trim(oldName.value);if(oldPhone&&trim(oldPhone.value))p1.value=trim(oldPhone.value);};
    oldName?.addEventListener('input',pullLegacy);oldPhone?.addEventListener('input',pullLegacy);

    const saveBtn=document.getElementById('v19Save');if(!saveBtn)return;
    const beforeIds=new Set((data[k]||[]).map(z=>String(z.id)));
    saveBtn.addEventListener('click',()=>{
      const values={profilePhone:trim(pp.value),contact1Name:trim(n1.value),contact1Phone:trim(p1.value),contact2Name:trim(n2.value),contact2Phone:trim(p2.value)};
      if(oldName)oldName.value=values.contact1Name;if(oldPhone)oldPhone.value=values.contact1Phone;
      const apply=r=>{if(!r)return;r.profilePhone=values.profilePhone;r.contact1Name=values.contact1Name;r.contact1Phone=values.contact1Phone;r.contact2Name=values.contact2Name;r.contact2Phone=values.contact2Phone;r.sourceName=values.contact1Name;r.source=values.contact1Name;r.sourcePhone=values.contact1Phone;r.sourcePhone2=values.contact2Phone;};
      if(isEdit&&x){apply(x);setTimeout(()=>{apply(x);saveQuiet();},180);}
      else setTimeout(()=>{const r=(data[k]||[]).find(z=>!beforeIds.has(String(z.id)));if(r){apply(r);saveQuiet();}},260);
    },true);
  }

  const priorP=window.openP;
  if(typeof priorP==='function')window.openP=function(k,id){active={k,id};const r=priorP(k,id);setTimeout(()=>{renderDetail();decorateForm();},80);return r;};
  const priorS=window.openS;
  if(typeof priorS==='function')window.openS=function(id){active=null;const r=priorS(id);setTimeout(renderDetail,0);return r;};

  function polish(){decorateForm();renderDetail();}
  function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;polish();});}
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
  schedule();
})();
