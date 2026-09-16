/* PeerMatch v62: profile tools, compact shadchan grouping and mobile overflow fixes. */
(function(){
  document.documentElement.dataset.peerMatchVersion='62';
  let activeProfile=null,activeShad=null,groupQueued=false,decorateQueued=false;

  const css=document.createElement('style');
  css.textContent=`
    html,body,.app,main,.modal,.sheet{max-width:100%;overflow-x:hidden}
    .card,.cardRow,.left,.left>div,.name,.small,.profileText,.event,.eventTop,.pmChatDetail,.pmWaCard,.pmWaItem,.pmWaText,.pmRefByDetail{min-width:0;max-width:100%}
    .name,.small,.profileText,.event,.eventTop,.pmWaText,.pmRefByDetail,a{overflow-wrap:anywhere;word-break:break-word}
    .profileText{white-space:pre-wrap}
    .pmInlineTools{background:#fff;border:1px solid var(--line);border-radius:13px;padding:10px;margin:9px 0 11px}
    .pmInlineToolsTitle{font-size:11px;font-weight:900;color:var(--muted);text-transform:uppercase;letter-spacing:.25px;margin-bottom:7px}
    .pmInlineTags{display:grid;grid-template-columns:60px 1fr;gap:8px;align-items:center}
    .pmInlineTags span{font-size:12px;font-weight:800;color:var(--text)}
    .pmInlineTags input{min-width:0;padding:9px 10px;border-radius:10px}
    .pmStatusChecks,.pmLangChecks{display:flex;flex-wrap:wrap;gap:7px 13px;margin-top:9px;padding-top:9px;border-top:1px solid var(--line)}
    .pmStatusChecks label,.pmLangChecks label{display:flex!important;align-items:center;gap:6px;margin:0!important;color:var(--text)!important;font-size:12px!important;cursor:pointer}
    .pmStatusChecks input,.pmLangChecks input{width:17px!important;height:17px!important;margin:0!important;accent-color:var(--accent)}
    .pmLangLabel{width:100%;font-size:11px;font-weight:850;color:var(--muted)}
    .pmRefGroup{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:10px 1px 5px;padding:9px 10px;background:#eaf1f6;border:1px solid #d3e0e8;border-radius:12px;color:#264b64}
    .pmRefGroupText{min-width:0;font-size:12px;font-weight:850;overflow-wrap:anywhere}
    .pmRefGroup button{flex:0 0 auto;padding:7px 9px;border-radius:9px;background:#fff;color:#264b64;font-size:10px}
    .pmRefCollapsed{display:none!important}
    .pmV62FormTags{margin:8px 0 10px!important}
    .v19Fixed.form,#pmFixedForm{z-index:350!important;pointer-events:auto!important}
    .v19Fixed.form button,#pmFixedForm button,#v19Save,#pmFormSave{pointer-events:auto!important;touch-action:manipulation}
    @media(max-width:430px){.pmInlineTags{grid-template-columns:48px 1fr}.pmStatusChecks,.pmLangChecks{gap:7px 10px}}
  `;
  document.head.appendChild(css);

  const safe=s=>typeof esc==='function'?esc(s):String(s??'');
  function norm(s){return String(s||'').toLocaleLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim();}
  function cleanEdge(s){return String(s||'').replace(/^[\s*•\-–—:]+|[\s*•\-–—:]+$/g,'').trim();}
  function senderName(x){return String(x?.sourceName||x?.source||'').trim();}
  function senderPhone(x){return String(x?.sourcePhone||'').trim();}
  function senderEmail(x){return String(x?.sourceEmail||'').trim();}

  function nameAge(text){
    const s=String(text||''),lines=s.split(/\r?\n/).map(x=>x.trim()).filter(Boolean),top=lines.slice(0,14);let name='',age='';
    const names=[/^(?:name|full name)\s*[:\-–]\s*(.+)$/i,/^(?:שם|שם מלא)\s*[:\-–]\s*(.+)$/,/^(?:имя|фио|ф\.?\s*и\.?\s*о\.?)\s*[:\-–]\s*(.+)$/i];
    for(const line of top){for(const re of names){const m=line.match(re);if(m){name=cleanEdge(m[1]);break;}}if(name)break;}
    const sample=top.join('\n');
    const ages=[/\bage\s*(?:is|:|-|–)?\s*(\d{2})\b/i,/\b(\d{2})\s*(?:years?\s*old|yo)\b/i,/(?:גיל\s*[:\-–]?\s*|בן\s+|בת\s+)(\d{2})\b/,/(?:возраст\s*[:\-–]?\s*)(\d{2})\b/i,/\b(\d{2})\s*(?:лет|года)\b/i];
    for(const re of ages){const m=sample.match(re)||s.match(re);if(m&&+m[1]>=18&&+m[1]<=99){age=m[1];break;}}
    if(!name&&top.length){
      let first=cleanEdge(top[0].replace(/[*_~]/g,''));
      const bad=/^(?:shidduch|profile|resume|bio|פרופיל|כרטיס|שידוך|анкета|резюме)\b/i;
      if(first.length<=70&&!bad.test(first)&&!/@/.test(first)&&!/(?:\+?\d[\d\s().-]{7,}\d)/.test(first)&&first.split(/\s+/).length<=7){
        name=first.replace(/\s*[,|]\s*(?:age\s*)?\d{2}\b.*$/i,'').replace(/\s+(?:בן|בת)\s+\d{2}\b.*$/,'').replace(/\s+\d{2}\s*(?:лет|года)\b.*$/i,'').trim();
      }
    }
    return{name:name.slice(0,80),age};
  }

  function bottomContact(text){
    const lines=String(text||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean),b=lines.slice(-16),joined=b.join('\n');
    const phone=(joined.match(/(?:\+?\d[\d\s().-]{7,}\d)/)||[])[0]||'';
    const email=(joined.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)||[])[0]||'';
    let name='';
    const labels=[/(?:contact(?:\s+person)?|for (?:more )?info(?:rmation)?|contact info)\s*[:\-–]?\s*(.*)/i,/(?:לפרטים|איש קשר|ליצירת קשר)\s*[:\-–]?\s*(.*)/,/(?:контакт(?:ное лицо)?|для связи|по вопросам)\s*[:\-–]?\s*(.*)/i];
    for(let i=b.length-1;i>=0&&!name;i--){for(const re of labels){const m=b[i].match(re);if(m){name=String(m[1]||'').replace(/(?:\+?\d[\d\s().-]{7,}\d)/g,'').replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig,'').replace(/[•|,;]+$/g,'').trim();break;}}}
    return{name:name.length<=70?name:'',phone:phone.trim(),email:email.trim()};
  }

  function fillIfEmpty(id,value){const el=document.getElementById(id);if(el&&!String(el.value||'').trim()&&value){el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));}}
  function extractForm(){
    const p=document.getElementById('v19Profile');if(!p)return;
    const na=nameAge(p.value),ct=bottomContact(p.value);
    fillIfEmpty('v19Name',na.name);fillIfEmpty('v19Age',na.age);fillIfEmpty('v19Sender',ct.name);fillIfEmpty('v19SenderPhone',ct.phone);fillIfEmpty('v19SenderEmail',ct.email);
  }
  function bindExtractor(){
    const p=document.getElementById('v19Profile');if(!p||p.dataset.pmV62Extract==='1')return;
    p.dataset.pmV62Extract='1';
    const run=()=>{extractForm();setTimeout(extractForm,70);};
    p.addEventListener('paste',()=>setTimeout(run,0));
    p.addEventListener('input',run);
    if(String(p.value||'').trim())run();
  }

  function currentFormKind(){
    const h=String(document.querySelector('#sheet h2')?.textContent||'');
    if(/Guy/i.test(h))return'guys';if(/Girl/i.test(h))return'girls';return'';
  }
  function addTagsToProfileForm(){
    const p=document.getElementById('v19Profile'),name=document.getElementById('v19Name');if(!p||!name||document.getElementById('pmV62FormTags'))return;
    const k=currentFormKind();if(!k)return;
    const h=String(document.querySelector('#sheet h2')?.textContent||''),isEdit=/^Edit\b/i.test(h),x=isEdit&&activeProfile?.k===k?(data[k]||[]).find(z=>String(z.id)===String(activeProfile.id)):null;
    const lab=document.createElement('label');lab.className='pmV62FormTags';lab.appendChild(document.createTextNode('Tags'));
    const input=document.createElement('input');input.id='pmV62FormTags';input.placeholder='e.g. Chabad, Israel, 35+';input.value=String(x?.tags||'');lab.appendChild(input);
    p.closest('label')?.insertAdjacentElement('afterend',lab);
    const saveBtn=document.getElementById('v19Save');if(!saveBtn||saveBtn.dataset.pmV62Tags==='1')return;saveBtn.dataset.pmV62Tags='1';
    const before=new Set((data[k]||[]).map(z=>String(z.id)));
    saveBtn.addEventListener('click',()=>{
      const value=String(document.getElementById('pmV62FormTags')?.value||'').trim();
      if(isEdit&&activeProfile?.k===k){const r=(data[k]||[]).find(z=>String(z.id)===String(activeProfile.id));if(r)r.tags=value;return;}
      setTimeout(async()=>{const r=(data[k]||[]).find(z=>!before.has(String(z.id)));if(r){r.tags=value;try{await save();renderP(k);}catch(e){console.warn('PeerMatch tags save',e);}}},220);
    },true);
  }

  function langFlags(x){return{en:x?.shareEnglish!==false,he:x?.shareHebrew!==false,ru:x?.shareRussian!==false};}
  function scriptsIn(s){return{en:/[A-Za-z]/.test(s),he:/[\u0590-\u05FF]/.test(s),ru:/[\u0400-\u04FF]/.test(s)};}
  window.pmShareFilteredText=function(x){
    const text=String(x?.text||''),f=langFlags(x);if(f.en&&f.he&&f.ru)return text;
    return text.split(/\r?\n/).filter(line=>{const sc=scriptsIn(line);if(!sc.en&&!sc.he&&!sc.ru)return true;return(sc.en&&f.en)||(sc.he&&f.he)||(sc.ru&&f.ru);}).join('\n').replace(/\n{3,}/g,'\n\n').trim();
  };

  function inlineTools(k,id){
    const x=(data[k]||[]).find(z=>String(z.id)===String(id)),sheet=document.getElementById('sheet');if(!x||!sheet)return;
    sheet.querySelectorAll('.pmInlineTools').forEach(e=>e.remove());
    const flags=langFlags(x),hasRu=/[\u0400-\u04FF]/.test(String(x.text||''));
    const box=document.createElement('div');box.className='pmInlineTools';
    box.innerHTML=`<div class="pmInlineToolsTitle">Quick details</div>
      <div class="pmInlineTags"><span>Tags</span><input id="pmV62InlineTags" value="${safe(x.tags||'')}" placeholder="Add tags anytime"></div>
      <div class="pmStatusChecks">
        <label><input id="pmV62Phone" type="checkbox" ${x.talkedPhone?'checked':''}>Talked by phone</label>
        <label><input id="pmV62Person" type="checkbox" ${x.talkedInPerson?'checked':''}>Talked in person</label>
      </div>
      ${k==='guys'||k==='girls'?`<div class="pmLangChecks"><div class="pmLangLabel">Include when sharing</div>
        <label><input data-lang="en" type="checkbox" ${flags.en?'checked':''}>English</label>
        <label><input data-lang="he" type="checkbox" ${flags.he?'checked':''}>Hebrew</label>
        ${hasRu?`<label><input data-lang="ru" type="checkbox" ${flags.ru?'checked':''}>Russian</label>`:''}
      </div>`:''}`;
    const anchor=sheet.querySelector('.pmContactLabel')||sheet.querySelector('.pmProfileContact')||sheet.querySelector('.v19Contact')||sheet.querySelector('.pmMeta')||sheet.querySelector('.v19ShadHead')||sheet.querySelector('.v19Head')||sheet.querySelector('h2');
    anchor?.insertAdjacentElement('afterend',box);
    let timer=null;const persist=()=>{clearTimeout(timer);timer=setTimeout(async()=>{x.tags=String(box.querySelector('#pmV62InlineTags')?.value||'').trim();x.talkedPhone=!!box.querySelector('#pmV62Phone')?.checked;x.talkedInPerson=!!box.querySelector('#pmV62Person')?.checked;if(k==='guys'||k==='girls'){const boxes=[...box.querySelectorAll('[data-lang]')];if(boxes.length&&!boxes.some(c=>c.checked)){boxes[0].checked=true;}x.shareEnglish=!!box.querySelector('[data-lang="en"]')?.checked;x.shareHebrew=!!box.querySelector('[data-lang="he"]')?.checked;if(box.querySelector('[data-lang="ru"]'))x.shareRussian=!!box.querySelector('[data-lang="ru"]')?.checked;}try{await save();if(k==='shadchanim')renderS();else renderP(k);}catch(e){console.warn('PeerMatch quick details save',e);}},220);};
    box.addEventListener('input',persist);box.addEventListener('change',persist);
  }

  const priorOpenP=window.openP;
  if(typeof priorOpenP==='function')window.openP=function(k,id){activeProfile={k,id};const r=priorOpenP(k,id);setTimeout(()=>inlineTools(k,id),0);return r;};
  const priorOpenS=window.openS;
  if(typeof priorOpenS==='function')window.openS=function(id){activeShad=id;const r=priorOpenS(id);setTimeout(()=>inlineTools('shadchanim',id),0);return r;};

  function visibleShad(){
    const q=String(document.getElementById('shadchanSearch')?.value||'').toLowerCase();
    return (data.shadchanim||[]).filter(x=>`${x.name||''} ${x.phone||''} ${x.email||''} ${x.tags||''} ${(x.activities||[]).map(a=>a.text||a.action||'').join(' ')}`.toLowerCase().includes(q));
  }
  function groupShadchanim(){
    const list=document.getElementById('shadchanList');if(!list)return;
    list.querySelectorAll('.pmRefGroup').forEach(e=>e.remove());
    list.querySelectorAll('.card').forEach(c=>c.classList.remove('pmRefCollapsed'));
    const cards=Array.from(list.children).filter(e=>e.classList?.contains('card')),arr=visibleShad();if(cards.length!==arr.length)return;
    let i=0;
    while(i<arr.length){
      const ref=String(arr[i]?.referredBy||'').trim();let j=i+1;
      if(ref)while(j<arr.length&&String(arr[j]?.referredBy||'').trim()===ref)j++;
      const count=j-i;
      if(ref&&count>=3){
        const start=i,end=j,key='pmRefOpen:'+norm(ref),openState=sessionStorage.getItem(key)==='1';
        const head=document.createElement('div');head.className='pmRefGroup';head.innerHTML=`<div class="pmRefGroupText">Referred by ${safe(ref)} • ${count} shadchanim</div><button type="button">${openState?'Hide':'Show'}</button>`;
        cards[start].insertAdjacentElement('beforebegin',head);
        for(let n=start;n<end;n++)cards[n].classList.toggle('pmRefCollapsed',!openState);
        head.querySelector('button').onclick=()=>{const now=sessionStorage.getItem(key)==='1';sessionStorage.setItem(key,now?'0':'1');for(let n=start;n<end;n++)cards[n].classList.toggle('pmRefCollapsed',now);head.querySelector('button').textContent=now?'Show':'Hide';};
      }
      i=ref?j:i+1;
    }
  }
  const priorRenderS=window.renderS;
  if(typeof priorRenderS==='function')window.renderS=function(){const r=priorRenderS();requestAnimationFrame(groupShadchanim);return r;};

  function profileVisible(k){
    const q=String(document.getElementById(k+'Search')?.value||'').toLowerCase();
    return (data[k]||[]).filter(x=>`${x.name||''} ${x.age||''} ${x.text||''} ${x.tags||''} ${senderName(x)} ${senderPhone(x)} ${(x.activities||[]).map(a=>a.text||a.action||'').join(' ')}`.toLowerCase().includes(q));
  }
  function selectedProfiles(k){
    const list=document.getElementById(k+'List');if(!list)return[];
    const arr=profileVisible(k),cards=Array.from(list.children).filter(el=>el.classList?.contains('card')),out=[];
    cards.forEach((card,i)=>{if(card.querySelector('.pmListCheck:checked')&&arr[i])out.push(arr[i]);});
    return out;
  }
  function fullPhoto(x){return x?.profileMediaFull||x?.profileMedia||x?.profileImage||x?.photo||null;}
  function safeFileName(s){return String(s||'profile').replace(/[\\/:*?\"<>|]+/g,' ').replace(/\s+/g,' ').trim().slice(0,60)||'profile';}
  function photoFile(blob,x,index){if(!(blob instanceof Blob))return null;const type=blob.type||'image/jpeg',ex=type.includes('png')?'png':type.includes('webp')?'webp':type.includes('gif')?'gif':'jpg';try{return new File([blob],safeFileName(x?.name||('profile-'+(index+1)))+'.'+ex,{type});}catch(_){return null;}}
  function filterWithFlags(text,flags){
    const f=flags||{en:true,he:true,ru:true};
    return String(text||'').split(/\r?\n/).filter(line=>{const sc=scriptsIn(line);if(!sc.en&&!sc.he&&!sc.ru)return true;return(sc.en&&f.en)||(sc.he&&f.he)||(sc.ru&&f.ru);}).join('\n').replace(/\n{3,}/g,'\n\n').trim();
  }
  function profileShareText(x,flags){return [x?.name||'Unnamed profile',x?.age?'Age: '+x.age:'',filterWithFlags(x?.text||'',flags),senderName(x)?'Sent by: '+senderName(x):'',senderPhone(x)?'Sender phone: '+senderPhone(x):''].filter(Boolean).join('\n');}
  let shareHistSeq=0;
  async function logShare(x,channel){x.activities=x.activities||[];x.activities.push({id:Date.now()*1000+(shareHistSeq++%1000),type:'action',action:'Profile shared • '+channel,text:'Profile sharing opened via '+channel+'.',ts:typeof stamp==='function'?stamp():new Date().toLocaleString()});try{await save();}catch(e){console.warn('PeerMatch share history',e);}}
  function closeLangDialog(){document.getElementById('pmV62LangDialog')?.remove();}
  function languagePresence(items){const all=(items||[]).map(x=>String(x.text||'')).join('\n');return{en:/[A-Za-z]/.test(all),he:/[\u0590-\u05FF]/.test(all),ru:/[\u0400-\u04FF]/.test(all)};}
  function initialShareFlags(items,pres){
    const first=items?.[0]||null;
    return{en:pres.en&&(first?.shareEnglish!==false),he:pres.he&&(first?.shareHebrew!==false),ru:pres.ru&&(first?.shareRussian!==false)};
  }
  function askShareLanguages(items,channel,onGo){
    closeLangDialog();const pres=languagePresence(items),f=initialShareFlags(items,pres);
    if(!pres.en&&!pres.he&&!pres.ru){onGo({en:true,he:true,ru:true});return;}
    const shade=document.createElement('div');shade.id='pmV62LangDialog';shade.style.cssText='position:fixed;inset:0;z-index:12000;background:rgba(0,0,0,.38);display:flex;align-items:flex-end;justify-content:center;padding:14px';
    const box=document.createElement('div');box.style.cssText='width:min(560px,100%);background:#fff;border-radius:18px;padding:16px;box-shadow:0 12px 36px rgba(0,0,0,.28)';
    box.innerHTML=`<div style="font-weight:900;font-size:17px;margin-bottom:5px">What language should be included?</div><div style="font-size:12px;color:#667;margin-bottom:10px">PeerMatch detects the alphabet in each line. It does not translate the profile.</div><div class="pmLangChecks" style="border-top:0;padding-top:0;margin:0 0 12px">${pres.en?`<label><input data-l="en" type="checkbox" ${f.en?'checked':''}>English</label>`:''}${pres.he?`<label><input data-l="he" type="checkbox" ${f.he?'checked':''}>Hebrew</label>`:''}${pres.ru?`<label><input data-l="ru" type="checkbox" ${f.ru?'checked':''}>Russian</label>`:''}</div><button id="pmV62LangGo" class="primary" style="width:100%">Continue to ${safe(channel)}</button><button id="pmV62LangCancel" class="secondary" style="width:100%;margin-top:8px">Cancel</button>`;
    shade.appendChild(box);document.body.appendChild(shade);
    box.querySelector('#pmV62LangCancel').onclick=closeLangDialog;
    box.querySelector('#pmV62LangGo').onclick=()=>{const flags={en:!!box.querySelector('[data-l="en"]')?.checked,he:!!box.querySelector('[data-l="he"]')?.checked,ru:!!box.querySelector('[data-l="ru"]')?.checked};if(!flags.en&&!flags.he&&!flags.ru)return alert('Keep at least one language checked.');closeLangDialog();onGo(flags);};
  }
  async function shareProfileOne(channel,x,index,flags){
    let text=profileShareText(x,flags);if(channel==='SMS')text=text.replace(/\*+/g,'');
    const f=photoFile(fullPhoto(x),x,index);
    if((channel==='WhatsApp'||channel==='SMS')&&f&&typeof navigator.share==='function'&&(!navigator.canShare||navigator.canShare({files:[f]}))){
      try{await navigator.share({title:x?.name||'PeerMatch profile',text,files:[f]});await logShare(x,channel);return'shared';}catch(e){if(e?.name==='AbortError')return'cancelled';}
    }
    await logShare(x,channel);
    if(channel==='WhatsApp')location.href='https://wa.me/?text='+encodeURIComponent(text);
    else if(channel==='SMS')location.href='sms:?body='+encodeURIComponent(text);
    return'fallback';
  }
  let v62Queue=null;
  function closeV62Queue(){document.getElementById('pmV62ShareQueue')?.remove();v62Queue=null;}
  function drawV62Queue(){
    document.getElementById('pmV62ShareQueue')?.remove();if(!v62Queue||v62Queue.i>=v62Queue.items.length){closeV62Queue();return;}
    const x=v62Queue.items[v62Queue.i],shade=document.createElement('div');shade.id='pmV62ShareQueue';shade.style.cssText='position:fixed;inset:0;z-index:12000;background:rgba(0,0,0,.36);display:flex;align-items:flex-end;justify-content:center;padding:14px';
    const box=document.createElement('div');box.style.cssText='width:min(560px,100%);background:#fff;border-radius:18px;padding:16px;box-shadow:0 12px 36px rgba(0,0,0,.28)';
    box.innerHTML=`<div style="font-weight:900;font-size:17px">${safe(v62Queue.channel)} profiles separately</div><div style="font-size:13px;color:#667;margin:6px 0 12px">Profile ${v62Queue.i+1} of ${v62Queue.items.length}: <b>${safe(x?.name||'Unnamed profile')}</b></div><button id="pmV62ShareNext" class="primary" style="width:100%">Open this profile</button><button id="pmV62ShareCancel" class="secondary" style="width:100%;margin-top:8px">Cancel</button>`;
    shade.appendChild(box);document.body.appendChild(shade);box.querySelector('#pmV62ShareCancel').onclick=closeV62Queue;box.querySelector('#pmV62ShareNext').onclick=async()=>{const b=box.querySelector('#pmV62ShareNext');b.disabled=true;b.textContent='Opening…';const r=await shareProfileOne(v62Queue.channel,x,v62Queue.i,v62Queue.flags);if(r==='cancelled'){b.disabled=false;b.textContent='Open this profile';return;}v62Queue.i++;drawV62Queue();};
  }
  async function sendSelectedProfiles(k,channel,flags){
    const items=selectedProfiles(k);if(!items.length)return;
    if(channel==='Email'){
      const subject='PeerMatch selected profiles',body=items.map(x=>profileShareText(x,flags)).join('\n\n--------------------\n\n'),files=items.map((x,i)=>photoFile(fullPhoto(x),x,i)).filter(Boolean);
      if(files.length&&typeof navigator.share==='function'&&(!navigator.canShare||navigator.canShare({files}))){try{await navigator.share({title:subject,text:body,files});for(const x of items)await logShare(x,'Email');return;}catch(e){if(e?.name==='AbortError')return;}}
      for(const x of items)await logShare(x,'Email');let u='mailto:?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(body);if(u.length>16000){try{await navigator.clipboard.writeText(body);}catch(_){}u='mailto:?subject='+encodeURIComponent(subject);}location.href=u;return;
    }
    if(items.length===1){await shareProfileOne(channel,items[0],0,flags);return;}
    v62Queue={items:items.slice(),i:0,channel,flags};drawV62Queue();
  }
  /* v115: WhatsApp removed from this match/selector. This was a window-level capture
     listener — it fires before ANY handler on the button itself, including the direct
     .onclick bound at creation time in profile-share-v52.js's polishBar(), so it always
     won and always called stopImmediatePropagation(), making every WhatsApp fix in
     profile-share-v52.js/final-fixes-v107.js since v107 unreachable for the Guy/Girl
     selection bar — the true root cause of the selected-Shadchan WhatsApp send never
     firing. Email/SMS behavior here (language-flag filtering via askShareLanguages) is
     unaffected and intentionally left in place. */
  window.addEventListener('click',e=>{
    const b=e.target?.closest?.('button[id^="pmEmail-"],button[id^="pmSms-"]');if(!b)return;
    const m=b.id.match(/^pm(Email|Sms)-(guys|girls)$/);if(!m)return;
    e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();const channel=m[1]==='Sms'?'SMS':m[1],k=m[2],items=selectedProfiles(k);if(!items.length)return;askShareLanguages(items,channel,flags=>sendSelectedProfiles(k,channel,flags));
  },true);

  function selectedOne(k){const a=selectedProfiles(k);return a.length===1?a[0]:null;}
  function decorateMakeMatch(){
    const form=document.querySelector('.pmV60Form'),msg=document.getElementById('pmMatchMessage'),sel=document.getElementById('pmV60Recipient');if(!form||!msg||form.dataset.pmV62Lang==='1')return;
    const guy=selectedOne('guys'),girl=selectedOne('girls');if(!guy||!girl)return;form.dataset.pmV62Lang='1';
    const pres=languagePresence([guy,girl]);if(!pres.en&&!pres.he&&!pres.ru)return;
    const box=document.createElement('div');box.className='pmLangChecks';box.innerHTML=`<div class="pmLangLabel">Include in this match message</div>${pres.en?'<label><input data-mm="en" type="checkbox" checked>English</label>':''}${pres.he?'<label><input data-mm="he" type="checkbox" checked>Hebrew</label>':''}${pres.ru?'<label><input data-mm="ru" type="checkbox" checked>Russian</label>':''}`;
    (form.querySelector('.pmV60Photos')||form.querySelector('.pmV60Actions'))?.insertAdjacentElement('beforebegin',box);
    const captureBase=()=>{msg.dataset.pmV62Base=msg.value;};
    const apply=()=>{const flags={en:!!box.querySelector('[data-mm="en"]')?.checked,he:!!box.querySelector('[data-mm="he"]')?.checked,ru:!!box.querySelector('[data-mm="ru"]')?.checked};if(!flags.en&&!flags.he&&!flags.ru)return;let t=String(msg.dataset.pmV62Base||msg.value||'');const gt=String(guy.text||'').trim(),lt=String(girl.text||'').trim();if(gt)t=t.replace(gt,filterWithFlags(gt,flags));if(lt)t=t.replace(lt,filterWithFlags(lt,flags));msg.value=t;};
    setTimeout(()=>{captureBase();apply();},0);box.addEventListener('change',apply);sel?.addEventListener('change',()=>setTimeout(()=>{captureBase();apply();},0));
  }

  function scheduleDecorate(){if(decorateQueued)return;decorateQueued=true;requestAnimationFrame(()=>{decorateQueued=false;bindExtractor();addTagsToProfileForm();decorateMakeMatch();});}
  new MutationObserver(scheduleDecorate).observe(document.body,{childList:true,subtree:true});
  setTimeout(()=>{scheduleDecorate();groupShadchanim();},500);
})();
