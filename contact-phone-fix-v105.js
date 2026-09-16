/* PeerMatch v105: force Israeli contact phones to local 0-prefix form.
   Also backfills Contact 1/2 names when the saved phone matches a Shadchan.
*/
(function(){
  document.documentElement.dataset.peerMatchVersion='105';
  let queued=false,migrating=false;

  const trim=v=>String(v||'').trim();
  function digits(v){return String(v||'').replace(/\D/g,'');}
  function localPhone(v){
    const raw=trim(v);if(!raw)return'';
    let d=digits(raw);if(!d)return raw;
    // Israel international -> domestic. Be deliberately permissive here;
    // pasted WhatsApp/profile text may contain spaces, punctuation or bidi marks.
    if(d.startsWith('00972'))d=d.slice(5);
    else if(d.startsWith('972'))d=d.slice(3);
    else return typeof window.pmNormalizePhone==='function'?trim(window.pmNormalizePhone(raw)):raw;
    while(d.startsWith('0'))d=d.slice(1);
    if(d.length>=8&&d.length<=10)return'0'+d;
    return'0'+d;
  }
  function phoneKey(v){
    let d=digits(v);if(d.startsWith('00972'))d=d.slice(5);else if(d.startsWith('972'))d=d.slice(3);while(d.startsWith('0'))d=d.slice(1);return d;
  }
  function shadByPhone(v){const k=phoneKey(v);return k?(data.shadchanim||[]).find(s=>phoneKey(s.phone)===k)||null:null;}

  function normalizeInput(el){
    if(!el)return;
    const n=localPhone(el.value);
    if(n&&n!==trim(el.value)){el.value=n;el.dispatchEvent(new Event('input',{bubbles:true}));}
  }
  function fillName(phoneId,nameId){
    const p=document.getElementById(phoneId),n=document.getElementById(nameId);if(!p||!n)return;
    normalizeInput(p);
    const s=shadByPhone(p.value);if(s&&!trim(n.value)){n.value=trim(s.name);n.dispatchEvent(new Event('input',{bubbles:true}));}
  }
  function normalizeForm(){
    const ids=['pmV96ProfilePhone','pmV96Contact1Phone','pmV96Contact2Phone','v19SenderPhone','pmV65SenderPhone2'];
    ids.forEach(id=>normalizeInput(document.getElementById(id)));
    fillName('pmV96Contact1Phone','pmV96Contact1Name');
    fillName('pmV96Contact2Phone','pmV96Contact2Name');
  }

  async function migrateSaved(){
    if(migrating)return;migrating=true;let changed=false;
    try{
      for(const k of ['guys','girls'])for(const x of (data[k]||[])){
        for(const field of ['profilePhone','contact1Phone','contact2Phone','sourcePhone','sourcePhone2']){
          if(!trim(x[field]))continue;const n=localPhone(x[field]);if(n&&n!==x[field]){x[field]=n;changed=true;}
        }
        if(!trim(x.contact1Name)&&trim(x.contact1Phone)){const s=shadByPhone(x.contact1Phone);if(s){x.contact1Name=trim(s.name);x.sourceName=x.contact1Name;x.source=x.contact1Name;changed=true;}}
        if(!trim(x.contact2Name)&&trim(x.contact2Phone)){const s=shadByPhone(x.contact2Phone);if(s){x.contact2Name=trim(s.name);changed=true;}}
        if(trim(x.contact1Phone)&&x.sourcePhone!==x.contact1Phone){x.sourcePhone=x.contact1Phone;changed=true;}
        if(trim(x.contact2Phone)&&x.sourcePhone2!==x.contact2Phone){x.sourcePhone2=x.contact2Phone;changed=true;}
      }
      if(changed){try{await save();}catch(e){console.warn('PeerMatch v105 phone migration save',e);}}
    }finally{migrating=false;}
  }

  document.addEventListener('input',e=>{
    if(e.target?.matches?.('#pmV96ProfilePhone,#pmV96Contact1Phone,#pmV96Contact2Phone,#v19SenderPhone,#pmV65SenderPhone2'))setTimeout(normalizeForm,30);
  },true);
  document.addEventListener('paste',e=>{
    if(e.target?.matches?.('#pmV96ProfilePhone,#pmV96Contact1Phone,#pmV96Contact2Phone,#v19SenderPhone,#pmV65SenderPhone2'))setTimeout(normalizeForm,80);
  },true);
  document.addEventListener('click',e=>{
    if(e.target?.closest?.('#v19Save,#pmFormSave')){normalizeForm();setTimeout(migrateSaved,260);}
  },true);

  function polish(){normalizeForm();migrateSaved();}
  function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;polish();});}
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
  setTimeout(polish,300);
})();
