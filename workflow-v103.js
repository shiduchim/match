/* PeerMatch v103: faster profile entry + Shadchan-only call reminders. */
(function(){
  document.documentElement.dataset.peerMatchVersion='103';
  let activeShad=null,queued=false;

  const style=document.createElement('style');
  style.textContent=`
    #sheet .pmV103PasteRow{display:flex;justify-content:flex-end;margin:-2px 0 5px}
    #sheet .pmV103PasteBtn{width:auto!important;padding:6px 10px!important;border-radius:9px!important;background:#e8f1f7!important;color:#274b64!important;font-size:10.5px!important;font-weight:850!important}
    #sheet .pmV96ContactFormRow:first-of-type>.pmV96ContactFormLabel,
    #sheet .pmV96ContactRow:first-of-type .pmV96ContactKind{display:none!important}
    #sheet .pmV103CallReminders{display:grid;grid-template-columns:1fr 1fr .78fr;gap:5px;margin:7px 0 10px}
    #sheet .pmV103CallReminders button{min-width:0!important;width:100%!important;padding:8px 4px!important;border-radius:9px!important;font-size:9.7px!important;font-weight:850!important;background:#e8f1f7!important;color:#274b64!important}
    #sheet .pmV103CallReminders button.active{background:#fff1cf!important;color:#76551c!important;border:1px solid #ead79d!important}
    #sheet .pmV103CallReminders button.clear{background:#eef3f6!important;color:#637782!important}
    #shadchanimSection #pmV103CallsBadge{display:inline-flex;align-items:center;padding:6px 9px!important;border-radius:999px!important;background:#eef3f6!important;color:#536b7a!important;border:1px solid #dce4e8!important;font-size:10.5px!important;font-weight:850!important}
    #shadchanimSection #pmV103CallsBadge.hasCalls{background:#fff1cf!important;color:#76551c!important;border-color:#ead79d!important}
    .pmV103CallList{position:fixed;inset:0;z-index:17000;background:rgba(0,0,0,.38);display:flex;align-items:flex-end;justify-content:center;padding:14px}
    .pmV103CallSheet{width:min(560px,100%);max-height:76vh;overflow:auto;background:#fff;border-radius:18px;padding:15px;box-shadow:0 12px 36px rgba(0,0,0,.28)}
    .pmV103CallRow{width:100%;text-align:left;margin:6px 0;padding:10px 11px!important;border-radius:11px!important;background:#f7fafc!important;color:var(--text)!important;border:1px solid #dbe5ea!important}
    .pmV103CallRow.today,.pmV103CallRow.overdue{background:#fff7dd!important;border-color:#ead79d!important}
    .pmV103CallRow b{display:block;font-size:13px}.pmV103CallRow span{display:block;font-size:10px;color:var(--muted);margin-top:2px}
    @media(max-width:390px){#sheet .pmV103CallReminders{gap:3px}#sheet .pmV103CallReminders button{font-size:8.8px!important;padding:8px 2px!important}}
  `;
  document.head.appendChild(style);

  const trim=v=>String(v||'').trim();
  const shads=()=>data.shadchanim||[];
  const shad=id=>shads().find(x=>String(x.id)===String(id))||null;
  const stampNow=()=>typeof stamp==='function'?stamp():new Date().toLocaleString();
  function saveQuiet(){try{const p=save();if(p?.catch)p.catch(e=>console.warn('PeerMatch v103 save',e));}catch(e){console.warn('PeerMatch v103 save',e);}}

  function stripMarks(s){
    return String(s||'')
      .replace(/[\u0591-\u05C7]/g,'')
      .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g,'');
  }
  function cleanName(s){
    let v=stripMarks(s).replace(/[*_~]/g,'').trim();
    v=v.replace(/^(?:שם(?:\s+מלא)?|name|full\s+name|имя|фио)\s*[:\-–—]?\s*/i,'');
    v=v.replace(/^[\p{P}\p{S}\s]+|[\p{P}\p{S}\s]+$/gu,'').replace(/\s+/g,' ').trim();
    return v.slice(0,80);
  }
  function labeledName(text){
    const lines=String(text||'').split(/\r?\n/).slice(0,16);
    for(const raw of lines){
      const line=stripMarks(raw).replace(/[*_~]/g,'').trim();
      const m=line.match(/^(?:שם(?:\s+מלא)?|name|full\s+name|имя|фио)\s*[:\-–—]\s*(.+)$/i);
      if(m){const n=cleanName(m[1]);if(n)return n;}
    }
    return'';
  }
  function cleanProfileName(){
    const p=document.getElementById('v19Profile'),n=document.getElementById('v19Name');if(!p||!n)return;
    const parsed=labeledName(p.value),current=trim(n.value),cleaned=cleanName(current);
    if(parsed&&(!current||/^(?:ש[\u0591-\u05C7]*ם|שם|name|full\s+name|имя|фио)\b/i.test(stripMarks(current)))){
      n.value=parsed;n.dispatchEvent(new Event('input',{bubbles:true}));return;
    }
    if(current&&cleaned&&cleaned!==current){n.value=cleaned;n.dispatchEvent(new Event('input',{bubbles:true}));}
  }

  function addPasteButton(){
    const p=document.getElementById('v19Profile');if(!p||document.getElementById('pmV103PasteBtn'))return;
    const row=document.createElement('div');row.className='pmV103PasteRow';
    const b=document.createElement('button');b.type='button';b.id='pmV103PasteBtn';b.className='pmV103PasteBtn';b.textContent='Paste profile';row.appendChild(b);
    p.insertAdjacentElement('beforebegin',row);
    b.onclick=async e=>{
      e.preventDefault();e.stopPropagation();
      try{
        if(!navigator.clipboard?.readText)throw new Error('Clipboard read is unavailable');
        const t=await navigator.clipboard.readText();
        if(!trim(t))return alert('The clipboard does not contain profile text.');
        p.value=t;p.dispatchEvent(new Event('input',{bubbles:true}));
        setTimeout(()=>{cleanProfileName();normalizePhones();autoContactNames();},120);
      }catch(err){
        console.warn('PeerMatch clipboard paste',err);
        alert('Android did not allow direct clipboard access. Tap inside Profile and use Paste once, then PeerMatch will fill the fields automatically.');
      }
    };
  }

  function localPhone(v){
    try{if(typeof window.pmNormalizePhone==='function')return trim(window.pmNormalizePhone(v));}catch(e){}
    const raw=trim(v),d=raw.replace(/\D/g,'');
    if(d.startsWith('972')&&d.length>=11)return'0'+d.slice(3);
    if(d.startsWith('00972')&&d.length>=13)return'0'+d.slice(5);
    return raw;
  }
  function normalizePhones(){
    document.querySelectorAll('input[type="tel"]').forEach(el=>{
      const n=localPhone(el.value);if(n&&n!==el.value){el.value=n;el.dispatchEvent(new Event('input',{bubbles:true}));}
    });
  }
  function key(v){
    try{if(typeof window.pmPhoneKey==='function')return String(window.pmPhoneKey(v)||'');}catch(e){}
    let d=String(v||'').replace(/\D/g,'');if(d.startsWith('00972'))d=d.slice(5);else if(d.startsWith('972'))d=d.slice(3);if(d.startsWith('0'))d=d.slice(1);return d;
  }
  function shadByPhone(phone){const k=key(phone);return k?shads().find(s=>key(s.phone)===k)||null:null;}
  function autoOne(phoneId,nameId){
    const p=document.getElementById(phoneId),n=document.getElementById(nameId);if(!p||!n)return;
    const match=shadByPhone(p.value),oldAuto=String(n.dataset.pmV103AutoName||'');
    if(match&&(!trim(n.value)||trim(n.value)===oldAuto)){
      const name=trim(match.name);if(name){n.value=name;n.dataset.pmV103AutoName=name;n.dispatchEvent(new Event('input',{bubbles:true}));}
    }else if(!match&&oldAuto&&trim(n.value)===oldAuto){n.value='';delete n.dataset.pmV103AutoName;n.dispatchEvent(new Event('input',{bubbles:true}));}
  }
  function autoContactNames(){autoOne('pmV96Contact1Phone','pmV96Contact1Name');autoOne('pmV96Contact2Phone','pmV96Contact2Name');}

  function cleanPlaceholders(){
    const tags=document.getElementById('pmV62FormTags');if(tags&&/35\+/.test(tags.placeholder||''))tags.placeholder=(tags.placeholder||'').replace(/\s*,?\s*35\+/g,'').replace(/,\s*$/,'');
    document.querySelectorAll('input').forEach(el=>{if(/long skirt/i.test(el.placeholder||''))el.placeholder=(el.placeholder||'').replace(/\s*,?\s*long skirt/ig,'').replace(/,\s*$/,'');});
  }

  function dateKey(offset){const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()+(offset||0));return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
  function dueLabel(v){if(!v)return'';const t=dateKey(0),tm=dateKey(1);if(v<t)return'Overdue';if(v===t)return'Today';if(v===tm)return'Tomorrow';const p=v.split('-');return p.length===3?`${p[2]}/${p[1]}/${p[0]}`:v;}
  function scheduled(){return shads().filter(x=>trim(x.callReminderDate)).sort((a,b)=>String(a.callReminderDate).localeCompare(String(b.callReminderDate))||String(a.name||'').localeCompare(String(b.name||'')));}
  function setCallReminder(x,offset){
    if(!x)return;const v=dateKey(offset);if(x.callReminderDate===v)return;
    x.callReminderDate=v;x.activities=x.activities||[];x.activities.push({id:Date.now(),type:'action',action:'Call reminder set',text:`Call ${x.name||'Shadchan'} ${offset===0?'today':'tomorrow'}.`,ts:stampNow()});saveQuiet();setTimeout(polish,40);
  }
  function clearCallReminder(x){if(!x||!x.callReminderDate)return;x.activities=x.activities||[];x.activities.push({id:Date.now(),type:'action',action:'Call reminder cleared',text:`Call reminder for ${x.name||'Shadchan'} cleared.`,ts:stampNow()});x.callReminderDate='';saveQuiet();setTimeout(polish,40);}

  function callButtons(){
    const x=shad(activeShad),sheet=document.getElementById('sheet');
    const detail=x&&sheet?.querySelector('.v19ShadHead')&&!document.getElementById('v19SName')&&!document.getElementById('esName')&&!document.getElementById('sn');
    if(!detail){sheet?.querySelector('.pmV103CallReminders')?.remove();return;}
    let row=sheet.querySelector('.pmV103CallReminders');if(!row){row=document.createElement('div');row.className='pmV103CallReminders';row.innerHTML='<button type="button" data-call="0">Call today</button><button type="button" data-call="1">Call tomorrow</button><button type="button" class="clear">Clear</button>';const contact=sheet.querySelector('.v19Contact');if(contact)contact.insertAdjacentElement('afterend',row);else sheet.querySelector('.v19ShadHead')?.insertAdjacentElement('afterend',row);}
    const today=dateKey(0),tomorrow=dateKey(1);const bs=row.querySelectorAll('[data-call]');bs[0]?.classList.toggle('active',x.callReminderDate===today);bs[1]?.classList.toggle('active',x.callReminderDate===tomorrow);const clear=row.querySelector('.clear');if(clear){clear.disabled=!x.callReminderDate;clear.textContent=x.callReminderDate?'Clear':'No reminder';}
    row.querySelector('[data-call="0"]').onclick=()=>setCallReminder(x,0);row.querySelector('[data-call="1"]').onclick=()=>setCallReminder(x,1);if(clear)clear.onclick=()=>clearCallReminder(x);
  }

  function openCalls(){
    document.getElementById('pmV103CallList')?.remove();const items=scheduled();
    const shade=document.createElement('div');shade.id='pmV103CallList';shade.className='pmV103CallList';const box=document.createElement('div');box.className='pmV103CallSheet';
    box.innerHTML=`<div style="font-weight:900;font-size:17px;margin-bottom:8px">Calls to make (${items.length})</div><div id="pmV103CallRows"></div><button class="secondary full" style="margin-top:9px">Close</button>`;shade.appendChild(box);document.body.appendChild(shade);const rows=box.querySelector('#pmV103CallRows');
    if(!items.length)rows.innerHTML='<div style="font-size:13px;color:#73818b;padding:12px 0">No calls scheduled.</div>';
    for(const x of items){const b=document.createElement('button');b.type='button';const lab=dueLabel(x.callReminderDate);b.className='pmV103CallRow '+(lab==='Today'?'today':lab==='Overdue'?'overdue':'');b.innerHTML=`<b>${String(x.name||'Unnamed Shadchan').replace(/[<>]/g,'')}</b><span>${lab}</span>`;b.onclick=()=>{shade.remove();openS(x.id);};rows.appendChild(b);}
    box.querySelector('.secondary').onclick=()=>shade.remove();shade.onclick=e=>{if(e.target===shade)shade.remove();};
  }
  function callsBadge(){
    const h=document.querySelector('#shadchanimSection h1');if(!h)return;let b=document.getElementById('pmV103CallsBadge');if(!b){b=document.createElement('button');b.type='button';b.id='pmV103CallsBadge';h.appendChild(b);b.onclick=openCalls;}const n=scheduled().length;b.textContent='Calls '+n;b.classList.toggle('hasCalls',n>0);
  }

  const priorS=window.openS;if(typeof priorS==='function')window.openS=function(id){activeShad=id;const r=priorS(id);setTimeout(polish,60);return r;};
  const priorP=window.openP;if(typeof priorP==='function')window.openP=function(k,id){activeShad=null;return priorP(k,id);};
  const priorRenderS=window.renderS;if(typeof priorRenderS==='function')window.renderS=function(){const r=priorRenderS();requestAnimationFrame(callsBadge);return r;};

  function polish(){addPasteButton();cleanProfileName();normalizePhones();autoContactNames();cleanPlaceholders();callButtons();callsBadge();}
  document.addEventListener('input',e=>{if(e.target?.matches?.('#v19Profile,input[type="tel"],#v19Name'))setTimeout(polish,90);},true);
  document.addEventListener('paste',e=>{if(e.target?.matches?.('#v19Profile,input[type="tel"]'))setTimeout(polish,120);},true);
  function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;polish();});}
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
  setTimeout(polish,250);
})();
