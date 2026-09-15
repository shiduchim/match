/* PeerMatch v72: clean contact layout, clickable phones, reliable conversation info. */
(function(){
  document.documentElement.dataset.peerMatchVersion='72';
  let active=null,saveTimer=null;

  const css=document.createElement('style');
  css.textContent=`
    #sheet .pmV69PhoneLink{color:#315b78!important;font-weight:800!important;text-decoration:none!important;cursor:pointer!important;white-space:normal!important}
    #sheet .pmV69PhoneLink:active{text-decoration:underline!important}

    /* Contact person display: Name, phone, gap, Name, phone. */
    #sheet .pmV67ContactPeople{display:block!important;margin:7px 0 10px!important}
    #sheet .pmV67ContactLine{display:block!important;grid-template-columns:none!important;padding:4px 2px!important;border:0!important;border-radius:0!important;background:transparent!important;min-width:0!important}
    #sheet .pmV67ContactLine + .pmV67ContactLine{margin-top:14px!important}
    #sheet .pmV67ContactName{display:block!important;width:100%!important;font-weight:800!important;line-height:1.3!important;overflow-wrap:anywhere!important}
    #sheet .pmV67ContactPhone,#sheet a.pmV67ContactPhone{display:block!important;width:max-content!important;max-width:100%!important;margin-top:3px!important;line-height:1.35!important;white-space:normal!important}

    /* Add/Edit profile contact fields: Name, Phone, gap, Name, Phone. */
    #sheet .v19Source.v39SenderGrid{display:block!important;grid-template-columns:none!important}
    #sheet .v19Source.v39SenderGrid>label{display:block!important;width:100%!important;margin:6px 0 8px!important}
    #sheet .pmV67ContactFormRow{display:block!important;grid-template-columns:none!important;margin:14px 0 2px!important}
    #sheet .pmV67ContactFormRow label{display:block!important;width:100%!important;margin:6px 0 8px!important}
    #sheet .pmV67ContactFormRow input,#sheet .v19Source.v39SenderGrid input{width:100%!important}

    /* Conversation info under Talked by phone / Talked in person. */
    #sheet .pmV70ConversationWrap{margin-top:6px!important}
    #sheet .pmV70ConversationWrap:not(.show){display:none!important}
    #sheet .pmV70ConversationLabel{display:block;margin:0 0 4px;font-size:11px;font-weight:800;color:var(--muted)}
    #sheet .pmV65TalkNote{pointer-events:auto!important;touch-action:auto!important;user-select:text!important;-webkit-user-select:text!important;position:relative!important;z-index:6!important;width:100%!important;min-height:76px!important;background:#fff!important;color:var(--text)!important;opacity:1!important;cursor:text!important}
  `;
  document.head.appendChild(css);

  const norm=s=>String(s||'').trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
  const phoneHref=p=>'tel:'+String(p||'').replace(/\s+/g,'');
  const currentRecord=()=>active?(data[active.k]||[]).find(x=>String(x.id)===String(active.id))||null:null;

  function saveQuiet(){
    clearTimeout(saveTimer);
    saveTimer=setTimeout(()=>{try{const p=save();if(p?.catch)p.catch(e=>console.warn('PeerMatch v72 save',e));}catch(e){console.warn('PeerMatch v72 save',e);}},220);
  }

  /* Shadchan detail already has the four contact buttons. Remove the extra phone/copy strip completely. */
  function removeShadchanPhoneStrip(){
    const sheet=document.getElementById('sheet');if(!sheet)return;
    sheet.querySelectorAll('.pmV65PhoneCopy,.pmV69ShadPhone').forEach(el=>el.remove());
  }

  async function logPhoneCall(phone,name){
    if(!active||!['guys','girls'].includes(active.k))return true;
    const x=currentRecord();if(!x)return true;
    x.activities=x.activities||[];
    x.activities.push({
      id:Date.now(),
      type:'action',
      action:'Call • Contact person',
      text:`Call opened to ${name||'Contact person'}${phone?' ('+phone+')':''}.`,
      ts:typeof stamp==='function'?stamp():new Date().toLocaleString(),
      recipient:name||'Contact person',
      recipientPhone:phone||'',
      recipientSide:'Contact person'
    });
    try{await save();return true;}catch(e){console.warn('PeerMatch v72 call history save',e);return false;}
  }

  function clickableProfilePhones(){
    const sheet=document.getElementById('sheet');if(!sheet)return;
    for(const el of sheet.querySelectorAll('.pmV67ContactPhone')){
      let a=el;
      if(el.tagName!=='A'){
        const p=String(el.textContent||'').trim();if(!p)continue;
        a=document.createElement('a');a.className='pmV67ContactPhone pmV69PhoneLink';a.href=phoneHref(p);a.textContent=p;el.replaceWith(a);
      }
      if(a.dataset.pmV72Call==='1')continue;
      a.dataset.pmV72Call='1';
      a.addEventListener('click',async e=>{
        const phone=String(a.textContent||'').trim();
        if(!phone)return;
        e.preventDefault();e.stopPropagation();
        const line=a.closest('.pmV67ContactLine');
        const name=String(line?.querySelector('.pmV67ContactName')?.textContent||'Contact person').trim();
        await logPhoneCall(phone,name);
        location.href=phoneHref(phone);
      });
    }
  }

  function positionProfileContacts(){
    const sheet=document.getElementById('sheet'),buttons=sheet?.querySelector('.pmProfileContact'),people=sheet?.querySelector('.pmV67ContactPeople');
    if(!sheet||!buttons||!people)return;
    if(people.nextElementSibling!==buttons)buttons.insertAdjacentElement('beforebegin',people);
  }

  function shadchanNameFromDetail(){return String(document.querySelector('#sheet .v19ShadHead h2')?.textContent||'').trim();}
  function removeObviousSelfLinks(){
    const sheet=document.getElementById('sheet');if(!sheet)return;
    const shName=norm(shadchanNameFromDetail());
    if(shName){for(const box of sheet.querySelectorAll('.pmV64ReverseLinks')){for(const b of box.querySelectorAll('.pmV64LinkBtn')){const raw=String(b.textContent||'').replace(/^Guy:\s*|^Girl:\s*/i,'').trim();if(norm(raw)===shName)b.remove();}const left=box.querySelectorAll('.pmV64LinkBtn').length;if(!left)box.remove();else{const title=box.querySelector('b');if(title)title.textContent=`Linked profiles (${left})`;}}}
    const profileName=norm(document.querySelector('#sheet .v19Head h2')?.textContent||'');
    if(profileName){for(const box of sheet.querySelectorAll('.pmV64ProfileLink')){const txt=String(box.textContent||''),m=txt.match(/Linked shadchan:\s*([^\n]+)/i);if(m&&norm(m[1].replace(/Open shadchan.*$/i,''))===profileName)box.remove();}}
  }

  function bindConversationNote(note,kind){
    if(!note||note.dataset.pmV70Ready==='1')return;
    note.dataset.pmV70Ready='1';note.disabled=false;note.readOnly=false;note.placeholder='Write conversation info…';
    const wrap=document.createElement('div');wrap.className='pmV70ConversationWrap';wrap.dataset.kind=kind;
    const label=document.createElement('div');label.className='pmV70ConversationLabel';label.textContent='Conversation info';
    note.parentNode.insertBefore(wrap,note);wrap.appendChild(label);wrap.appendChild(note);
    note.addEventListener('input',e=>{e.stopPropagation();const x=currentRecord();if(!x)return;if(kind==='phone')x.phoneConversationNote=note.value;else x.inPersonConversationNote=note.value;wrap.classList.add('show');note.classList.add('show');saveQuiet();},true);
    note.addEventListener('change',e=>e.stopPropagation(),true);
    note.addEventListener('keydown',e=>e.stopPropagation(),true);
    note.addEventListener('pointerdown',e=>e.stopPropagation(),true);
  }

  function conversationInfo(){
    const sheet=document.getElementById('sheet');if(!sheet||!active)return;
    const phone=sheet.querySelector('#pmV62Phone'),person=sheet.querySelector('#pmV62Person');
    const pn=sheet.querySelector('.pmV65PhoneNote'),ip=sheet.querySelector('.pmV65PersonNote');
    bindConversationNote(pn,'phone');bindConversationNote(ip,'person');
    const pw=pn?.closest('.pmV70ConversationWrap'),iw=ip?.closest('.pmV70ConversationWrap');
    const draw=()=>{
      if(pn&&pw){const show=!!phone?.checked||!!pn.value.trim();pn.classList.toggle('show',show);pw.classList.toggle('show',show);}
      if(ip&&iw){const show=!!person?.checked||!!ip.value.trim();ip.classList.toggle('show',show);iw.classList.toggle('show',show);}
    };
    for(const box of [phone,person]){if(!box||box.dataset.pmV70Bound==='1')continue;box.dataset.pmV70Bound='1';box.addEventListener('change',()=>{const x=currentRecord();if(x){x.talkedPhone=!!phone?.checked;x.talkedInPerson=!!person?.checked;saveQuiet();}draw();});}
    draw();
  }

  function polish(){removeShadchanPhoneStrip();clickableProfilePhones();positionProfileContacts();removeObviousSelfLinks();conversationInfo();}

  const prevP=window.openP;if(typeof prevP==='function')window.openP=function(k,id){active={k,id};const r=prevP(k,id);setTimeout(polish,30);return r;};
  const prevS=window.openS;if(typeof prevS==='function')window.openS=function(id){active={k:'shadchanim',id};const r=prevS(id);setTimeout(polish,30);return r;};

  let queued=false;function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;polish();});}
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});schedule();
})();
