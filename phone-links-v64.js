/* PeerMatch v64: Israeli phone normalization + profile/shadchan links.
   - Israeli +972 / 00972 numbers are stored and displayed in domestic 0-prefix form.
   - Geographic landlines are marked and SMS is disabled for them.
   - 07x nationwide/VoIP ranges are marked.
   - Guy/Girl contact-person phones auto-link to a matching Shadchan record.
   - Reverse links show profiles connected to a Shadchan.
*/
(function(){
  document.documentElement.dataset.peerMatchVersion='64';

  const IL_LANDLINE=['02','03','04','08','09'];
  const IL_MOBILE=['050','051','052','053','054','055','058'];
  const IL_VOIP=['072','073','074','076','077','078'];
  const IL_ALL3=[...IL_MOBILE,...IL_VOIP];
  let activeProfile=null,activeShad=null,queued=false,migrating=false,lastMigration=0;

  const css=document.createElement('style');
  css.textContent=`
    .pmV64LinkBox{margin:8px 0 11px;padding:9px 10px;border:1px solid #d7e2e9;border-radius:12px;background:#f7fafc;font-size:12px;line-height:1.4;overflow-wrap:anywhere}
    .pmV64LinkBox b{color:var(--text)}
    .pmV64LinkBtn{display:inline-block!important;width:auto!important;margin:5px 5px 0 0!important;padding:6px 9px!important;border-radius:9px!important;background:#dfeef9!important;color:#19324a!important;font-size:11px!important;font-weight:850!important}
    .pmV64Type{display:inline-block;margin-left:5px;padding:2px 7px;border-radius:999px;background:#eef3f6;color:#315b78;font-size:10px;font-weight:850;vertical-align:middle}
    .pmV64Type.landline{background:#f5eadf;color:#774a25}
    .pmV64Type.voip{background:#edeaf7;color:#554276}
    .pmV64SmsDisabled{opacity:.48!important;cursor:not-allowed!important}
    .pmV64MatchHint{display:block;margin-top:4px;font-size:10.5px;line-height:1.35;color:#315b78;font-weight:750;overflow-wrap:anywhere}
    .pmV64Profiles{display:flex;flex-wrap:wrap;gap:5px;margin-top:6px}
  `;
  document.head.appendChild(css);

  function digits(v){return String(v||'').replace(/\D/g,'');}
  function localDigits(v){
    let d=digits(v);if(!d)return'';
    let fromIntl=false;
    if(d.startsWith('00972')){d=d.slice(5);fromIntl=true;}
    else if(d.startsWith('972')){d=d.slice(3);fromIntl=true;}
    if(fromIntl&&d.startsWith('0'))d=d.slice(1);
    if(fromIntl){
      if(d.length===8&&['2','3','4','8','9'].includes(d[0]))d='0'+d;
      else if(d.length===9&&IL_ALL3.includes('0'+d.slice(0,2)))d='0'+d;
      else return'';
    }
    if(IL_LANDLINE.includes(d.slice(0,2))&&d.length===9)return d;
    if(IL_ALL3.includes(d.slice(0,3))&&d.length===10)return d;
    return'';
  }
  function formatLocalDigits(d){
    if(!d)return'';
    if(IL_LANDLINE.includes(d.slice(0,2))&&d.length===9)return d.slice(0,2)+'-'+d.slice(2,5)+'-'+d.slice(5);
    if(IL_ALL3.includes(d.slice(0,3))&&d.length===10)return d.slice(0,3)+'-'+d.slice(3,6)+'-'+d.slice(6);
    return d;
  }
  function localize(v){
    const raw=String(v||'').trim();if(!raw)return'';
    const d=localDigits(raw);return d?formatLocalDigits(d):raw;
  }
  function phoneKey(v){
    const ld=localDigits(v);if(ld)return ld;
    let d=digits(v);if(d.startsWith('00'))d=d.slice(2);return d;
  }
  function classify(v){
    const d=localDigits(v);if(!d)return'unknown';
    if(IL_LANDLINE.includes(d.slice(0,2)))return'landline';
    if(IL_MOBILE.includes(d.slice(0,3)))return'mobile';
    if(IL_VOIP.includes(d.slice(0,3)))return'voip';
    return'unknown';
  }
  function whatsAppDigits(v){
    const d=localDigits(v);if(d)return'972'+d.slice(1);
    let x=digits(v);if(x.startsWith('00'))x=x.slice(2);return x;
  }
  window.pmNormalizePhone=localize;
  window.pmPhoneKey=phoneKey;
  window.pmPhoneType=classify;
  window.pmWhatsAppDigits=whatsAppDigits;

  function findShadchanByPhone(phone){
    const k=phoneKey(phone);if(!k)return null;
    return (data.shadchanim||[]).find(x=>phoneKey(x.phone)===k)||null;
  }
  function profileArrays(){return[['guys',data.guys||[]],['girls',data.girls||[]]];}
  function linkedShadchan(x){
    if(!x)return null;
    const byPhone=findShadchanByPhone(x.sourcePhone);
    if(byPhone)return byPhone;
    const id=x.sourceShadchanId||x.importedFromShadchanId;
    return id!=null?(data.shadchanim||[]).find(s=>String(s.id)===String(id))||null:null;
  }
  function normalizeRecordPhones(){
    let changed=false;
    for(const s of data.shadchanim||[]){
      const p=localize(s.phone);if(p!==String(s.phone||'')){s.phone=p;changed=true;}
      for(const a of s.activities||[]){if(a.recipientPhone){const q=localize(a.recipientPhone);if(q!==a.recipientPhone){a.recipientPhone=q;changed=true;}}}
    }
    for(const [k,arr] of profileArrays())for(const x of arr){
      const p=localize(x.sourcePhone);if(p!==String(x.sourcePhone||'')){x.sourcePhone=p;changed=true;}
      for(const a of x.activities||[]){if(a.recipientPhone){const q=localize(a.recipientPhone);if(q!==a.recipientPhone){a.recipientPhone=q;changed=true;}}}
      const sh=findShadchanByPhone(x.sourcePhone);
      if(sh){
        if(String(x.sourceShadchanId||'')!==String(sh.id)){x.sourceShadchanId=sh.id;changed=true;}
        if(x.sourceShadchanName!==sh.name){x.sourceShadchanName=sh.name||'';changed=true;}
        if(!String(x.sourceName||x.source||'').trim()&&sh.name){x.sourceName=sh.name;x.source=sh.name;changed=true;}
      }else if(x.sourceShadchanId!=null){
        const old=(data.shadchanim||[]).find(s=>String(s.id)===String(x.sourceShadchanId));
        if(old&&phoneKey(old.phone)!==phoneKey(x.sourcePhone)){delete x.sourceShadchanId;delete x.sourceShadchanName;changed=true;}
      }
    }
    return changed;
  }
  async function migrate(force){
    const now=Date.now();if(migrating||(!force&&now-lastMigration<500))return;migrating=true;lastMigration=now;
    try{
      const changed=normalizeRecordPhones();
      if(changed){await save();try{renderS();renderP('guys');renderP('girls');}catch(_){try{render();}catch(__){}}}
    }catch(e){console.warn('PeerMatch phone migration',e);}finally{migrating=false;}
  }

  function phoneInputs(){
    return [...document.querySelectorAll('input[type="tel"],input.pmWaCPhone,input.pmWaPContactPhone,#sp,#v19SPhone,#esPhone,#v19SenderPhone')];
  }
  function normalizeInput(el){
    if(!el)return;const n=localize(el.value);if(n&&n!==el.value)el.value=n;
  }
  function hintFor(el){
    if(!el)return;
    let hint=el.parentElement?.querySelector(':scope > .pmV64MatchHint');
    const sh=el.id==='v19SenderPhone'?findShadchanByPhone(el.value):null;
    const type=classify(el.value);
    let text='';
    if(sh)text='Matches Shadchan: '+(sh.name||'Unnamed shadchan');
    else if(type==='landline')text='Israeli landline — SMS unavailable';
    else if(type==='voip')text='Israeli nationwide / VoIP number';
    if(!text){hint?.remove();return;}
    if(!hint){hint=document.createElement('span');hint.className='pmV64MatchHint';el.parentElement?.appendChild(hint);}
    hint.textContent=text;
  }
  function bindPhoneInputs(){
    for(const el of phoneInputs()){
      if(el.dataset.pmV64Phone==='1'){hintFor(el);continue;}
      el.dataset.pmV64Phone='1';normalizeInput(el);hintFor(el);
      const finish=()=>{normalizeInput(el);hintFor(el);};
      el.addEventListener('blur',finish);el.addEventListener('change',finish);el.addEventListener('paste',()=>setTimeout(finish,0));el.addEventListener('input',()=>setTimeout(()=>hintFor(el),0));
    }
  }
  function normalizeAllFormPhones(){for(const el of phoneInputs())normalizeInput(el);}

  function typeBadge(phone){
    const t=classify(phone);if(t==='landline')return'<span class="pmV64Type landline">Landline</span>';
    if(t==='voip')return'<span class="pmV64Type voip">VoIP / nationwide</span>';
    return'';
  }
  function disableSmsIfLandline(button,phone){
    if(!button)return;const land=classify(phone)==='landline';
    button.disabled=land;button.classList.toggle('pmV64SmsDisabled',land);button.title=land?'SMS unavailable for Israeli landline':'';
  }

  function decorateProfile(k,id){
    const x=(data[k]||[]).find(z=>String(z.id)===String(id)),sheet=document.getElementById('sheet');if(!x||!sheet)return;
    sheet.querySelectorAll('.pmV64ProfileLink,.pmV64ProfileType').forEach(e=>e.remove());
    const sh=linkedShadchan(x),phone=x.sourcePhone||'';
    const meta=sheet.querySelector('.pmMeta');
    const t=typeBadge(phone);if(t&&meta){const span=document.createElement('span');span.className='pmV64ProfileType';span.innerHTML=t;meta.appendChild(span.firstElementChild);}
    const sms=sheet.querySelector('.pmProfileContact [data-act="sms"]');disableSmsIfLandline(sms,phone);
    if(sh){
      const d=document.createElement('div');d.className='pmV64LinkBox pmV64ProfileLink';
      d.innerHTML=`<b>Linked shadchan:</b> ${String(sh.name||'Unnamed shadchan').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}<br><button type="button" class="pmV64LinkBtn">Open shadchan</button>`;
      const anchor=sheet.querySelector('.pmContactLabel')||sheet.querySelector('.pmProfileContact')||sheet.querySelector('.sectionTitle')||sheet.querySelector('#v19EditProfile');
      anchor?.insertAdjacentElement('beforebegin',d);d.querySelector('button').onclick=()=>openS(sh.id);
    }
  }

  function linkedProfilesFor(sh){
    const out=[];for(const [k,arr] of profileArrays())for(const x of arr){const s=linkedShadchan(x);if(s&&String(s.id)===String(sh.id))out.push({k,x});}return out;
  }
  function decorateShadchan(id){
    const x=(data.shadchanim||[]).find(z=>String(z.id)===String(id)),sheet=document.getElementById('sheet');if(!x||!sheet)return;
    sheet.querySelectorAll('.pmV64ShadType,.pmV64ReverseLinks').forEach(e=>e.remove());
    const row=sheet.querySelector('.v19Contact'),sms=sheet.querySelector('#v19Sms');disableSmsIfLandline(sms,x.phone);
    const t=typeBadge(x.phone);if(t){const d=document.createElement('div');d.className='pmV64ShadType';d.innerHTML=t;(sheet.querySelector('.pmRefByDetail')||sheet.querySelector('.v19ShadHead')||sheet.querySelector('h2'))?.insertAdjacentElement('afterend',d);}
    const links=linkedProfilesFor(x);if(links.length){
      const d=document.createElement('div');d.className='pmV64LinkBox pmV64ReverseLinks';d.innerHTML=`<b>Linked profiles (${links.length})</b><div class="pmV64Profiles"></div>`;
      const holder=d.querySelector('.pmV64Profiles');for(const p of links){const b=document.createElement('button');b.type='button';b.className='pmV64LinkBtn';b.textContent=(p.k==='guys'?'Guy: ':'Girl: ')+(p.x.name||'Unnamed profile');b.onclick=()=>openP(p.k,p.x.id);holder.appendChild(b);}
      (row||sheet.querySelector('.sectionTitle')||sheet.querySelector('.v19ShadHead'))?.insertAdjacentElement('afterend',d);
    }
  }

  const prevOpenP=window.openP;
  if(typeof prevOpenP==='function')window.openP=function(k,id){activeProfile={k,id};const r=prevOpenP(k,id);setTimeout(()=>{migrate();decorateProfile(k,id);},40);return r;};
  const prevOpenS=window.openS;
  if(typeof prevOpenS==='function')window.openS=function(id){activeShad=id;const r=prevOpenS(id);setTimeout(()=>{migrate();decorateShadchan(id);},40);return r;};

  window.addEventListener('click',e=>{
    const saveBtn=e.target?.closest?.('#v19Save,#pmFormSave,#pmWaImportNow');if(saveBtn){normalizeAllFormPhones();setTimeout(()=>migrate(true),260);}
    const sms=e.target?.closest?.('#v19Sms,.pmProfileContact [data-act="sms"]');if(!sms)return;
    let phone='';if(activeProfile)phone=((data[activeProfile.k]||[]).find(x=>String(x.id)===String(activeProfile.id))||{}).sourcePhone||'';else if(activeShad!=null)phone=((data.shadchanim||[]).find(x=>String(x.id)===String(activeShad))||{}).phone||'';
    if(classify(phone)==='landline'){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();alert('This is an Israeli landline, so SMS is unavailable.');}
  },true);

  function polish(){
    bindPhoneInputs();
    if(activeProfile&&document.getElementById('sheet')&&!document.getElementById('v19Profile'))decorateProfile(activeProfile.k,activeProfile.id);
    if(activeShad!=null&&document.getElementById('sheet')&&!document.getElementById('v19SName')&&!document.getElementById('esName')&&!document.getElementById('sn'))decorateShadchan(activeShad);
  }
  function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;polish();});}
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
  setTimeout(()=>{migrate(true);polish();},850);
})();
