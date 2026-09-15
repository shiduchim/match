/* PeerMatch v70: reliable conversation info editing. */
(function(){
  document.documentElement.dataset.peerMatchVersion='70';
  let active=null,saveTimer=null,queued=false;

  const css=document.createElement('style');
  css.textContent=`
    #sheet .pmV70ConversationWrap{margin-top:6px}
    #sheet .pmV70ConversationLabel{display:block;margin:0 0 4px;font-size:11px;font-weight:800;color:var(--muted)}
    #sheet .pmV65TalkNote{
      display:block;pointer-events:auto!important;touch-action:auto!important;user-select:text!important;
      -webkit-user-select:text!important;position:relative!important;z-index:5!important;
      width:100%!important;min-height:72px!important;background:#fff!important;color:var(--text)!important;
      opacity:1!important;cursor:text!important
    }
    #sheet .pmV65TalkNote:not(.show){display:none!important}
    #sheet .pmV70ConversationWrap:not(.show){display:none!important}
  `;
  document.head.appendChild(css);

  function currentRecord(){
    if(!active)return null;
    return (data[active.k]||[]).find(x=>String(x.id)===String(active.id))||null;
  }
  function saveQuiet(){
    clearTimeout(saveTimer);
    saveTimer=setTimeout(()=>{
      try{const p=save();if(p?.catch)p.catch(e=>console.warn('PeerMatch v70 save',e));}
      catch(e){console.warn('PeerMatch v70 save',e);}
    },250);
  }

  function wrapNote(note,labelText,kind){
    if(!note||note.dataset.pmV70Ready==='1')return;
    note.dataset.pmV70Ready='1';
    note.disabled=false;note.readOnly=false;
    note.placeholder='Write conversation info…';

    const wrap=document.createElement('div');
    wrap.className='pmV70ConversationWrap '+(note.classList.contains('show')?'show':'');
    wrap.dataset.kind=kind;
    const label=document.createElement('div');label.className='pmV70ConversationLabel';label.textContent=labelText;
    note.parentNode.insertBefore(wrap,note);wrap.appendChild(label);wrap.appendChild(note);

    // Capture input before the older parent-level handlers can redraw/reset the detail screen.
    note.addEventListener('input',e=>{
      e.stopPropagation();
      const x=currentRecord();if(!x)return;
      if(kind==='phone')x.phoneConversationNote=note.value;
      else x.inPersonConversationNote=note.value;
      wrap.classList.add('show');note.classList.add('show');saveQuiet();
    },true);
    note.addEventListener('change',e=>e.stopPropagation(),true);
    note.addEventListener('keydown',e=>e.stopPropagation(),true);
    note.addEventListener('pointerdown',e=>e.stopPropagation(),true);
  }

  function syncVisibility(){
    const sheet=document.getElementById('sheet');if(!sheet)return;
    const phone=sheet.querySelector('#pmV62Phone'),person=sheet.querySelector('#pmV62Person');
    const pn=sheet.querySelector('.pmV65PhoneNote'),ip=sheet.querySelector('.pmV65PersonNote');
    const pw=pn?.closest('.pmV70ConversationWrap'),iw=ip?.closest('.pmV70ConversationWrap');
    if(pn&&pw){const show=!!phone?.checked||!!pn.value.trim();pn.classList.toggle('show',show);pw.classList.toggle('show',show);}
    if(ip&&iw){const show=!!person?.checked||!!ip.value.trim();ip.classList.toggle('show',show);iw.classList.toggle('show',show);}
  }

  function decorate(){
    const sheet=document.getElementById('sheet');if(!sheet||!active)return;
    wrapNote(sheet.querySelector('.pmV65PhoneNote'),'Conversation info','phone');
    wrapNote(sheet.querySelector('.pmV65PersonNote'),'Conversation info','person');
    const phone=sheet.querySelector('#pmV62Phone'),person=sheet.querySelector('#pmV62Person');
    for(const box of [phone,person]){
      if(!box||box.dataset.pmV70Bound==='1')continue;
      box.dataset.pmV70Bound='1';
      box.addEventListener('change',()=>{const x=currentRecord();if(x){x.talkedPhone=!!phone?.checked;x.talkedInPerson=!!person?.checked;saveQuiet();}syncVisibility();});
    }
    syncVisibility();
  }

  const prevP=window.openP;
  if(typeof prevP==='function')window.openP=function(k,id){active={k,id};const r=prevP(k,id);setTimeout(decorate,30);return r;};
  const prevS=window.openS;
  if(typeof prevS==='function')window.openS=function(id){active={k:'shadchanim',id};const r=prevS(id);setTimeout(decorate,30);return r;};

  function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;decorate();});}
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
  schedule();
})();
