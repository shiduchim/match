/* PeerMatch v67: stable detail-screen cleanup and input fixes. */
(function(){
  document.documentElement.dataset.peerMatchVersion='67';
  let activeProfile=null,activeShad=null,queued=false;

  const css=document.createElement('style');
  css.textContent=`
    #sheet.pmChatDetail{padding-top:0!important}
    #sheet.pmChatDetail .v19Head,#sheet.pmChatDetail .v19ShadHead{position:sticky!important;top:0!important;z-index:160!important;background:var(--bg)!important;margin:0 -18px 8px!important;padding:10px 18px 8px!important;min-height:62px!important;box-shadow:0 1px 0 rgba(25,50,74,.06)}
    #sheet.pmChatDetail .pmChatBack{margin-top:0!important}
    #sheet .pmV65RelInput,#sheet #pmV65RelForm input,#sheet #pmV65ShadRel input{pointer-events:auto!important;touch-action:manipulation!important;user-select:text!important;-webkit-user-select:text!important;position:relative!important;z-index:3!important;background:#fff!important;color:var(--text)!important;opacity:1!important}
    #sheet .pmV65TalkNote{pointer-events:auto!important;touch-action:auto!important;user-select:text!important;-webkit-user-select:text!important;position:relative!important;z-index:3!important;background:#fff!important;color:var(--text)!important;opacity:1!important;cursor:text!important}
    #sheet .v19ShadHead .pmV67ShadAttachment{flex:0 0 72px!important;width:72px!important;height:66px!important;min-height:66px!important;margin:0 0 0 6px!important;padding:0!important;border:1px solid #cbd6dc!important;border-radius:12px!important;background:#f7fafc!important;overflow:hidden!important;display:block!important}
    #sheet .v19ShadHead .pmV67ShadAttachment>div{display:none!important}
    #sheet .v19ShadHead .pmV67ShadAttachment button{width:100%!important;height:100%!important;margin:0!important;padding:6px 4px!important;border-radius:0!important;background:#eef3f6!important;color:#536b7a!important;font-size:9px!important;font-weight:850!important;line-height:1.18!important}
    .pmV67PhoneBelow{margin:5px 0 10px!important}
    .pmV67ContactPeople{display:grid;gap:5px;margin:6px 0 11px}
    .pmV67ContactLine{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;padding:7px 9px;border:1px solid #d7e2e9;border-radius:10px;background:#fff;font-size:12px;min-width:0}
    .pmV67ContactName{font-weight:800;min-width:0;overflow-wrap:anywhere}.pmV67ContactPhone{color:#315b78;font-weight:750;white-space:nowrap}
    .pmV67ContactFormRow{display:grid;grid-template-columns:1fr 1fr;gap:7px;align-items:end;margin:0 0 2px}.pmV67ContactFormRow label{margin:4px 0 8px!important;min-width:0}
    .pmV67TranslateBar{display:flex;flex-wrap:wrap;gap:6px;margin:5px 0 8px}.pmV67TranslateBar button{padding:7px 9px!important;border-radius:9px!important;background:#e8f1f7!important;color:#274b64!important;font-size:10.5px!important;font-weight:850!important}
    .pmV67TranslateStatus{font-size:11px;color:var(--muted);margin:4px 0 7px}.pmV67Translated{margin:6px 0 9px;padding:10px;border:1px solid #d7e2e9;border-radius:11px;background:#fff;white-space:pre-wrap;line-height:1.45;font-size:13px}
    @media(max-width:430px){#sheet.pmChatDetail .v19Head,#sheet.pmChatDetail .v19ShadHead{margin-left:-18px!important;margin-right:-18px!important;padding:9px 18px 7px!important}#sheet .v19ShadHead .pmV67ShadAttachment{width:66px!important;flex-basis:66px!important;height:60px!important;min-height:60px!important}.pmV67ContactLine{grid-template-columns:minmax(0,1fr) auto;font-size:11.5px}}
  `;
  document.head.appendChild(css);

  const rec=(k,id)=>(data[k]||[]).find(x=>String(x.id)===String(id))||null;
  const safe=s=>typeof esc==='function'?esc(s):String(s??'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
  const heading=()=>String(document.querySelector('#sheet h2')?.textContent||'').trim();
  const formKind=()=>/Guy/i.test(heading())?'guys':/Girl/i.test(heading())?'girls':'';
  const phoneKey=p=>typeof window.pmPhoneKey==='function'?window.pmPhoneKey(p):String(p||'').replace(/\D/g,'');
  function saveQuiet(){try{const p=save();if(p?.catch)p.catch(e=>console.warn('PeerMatch v67 save',e));}catch(e){console.warn('PeerMatch v67 save',e);}}

  function fixReligiousInputs(){
    for(const el of document.querySelectorAll('#sheet .pmV65RelInput,#sheet #pmV65RelForm input,#sheet #pmV65ShadRel input')){
      if(el.dataset.pmV67Rel==='1')continue;el.dataset.pmV67Rel='1';
      try{el.type='text';}catch(_){ }el.inputMode='numeric';el.pattern='[0-9]*';el.maxLength=2;el.autocomplete='off';el.disabled=false;el.readOnly=false;
      el.addEventListener('keydown',e=>e.stopPropagation());el.addEventListener('click',e=>e.stopPropagation());
      el.addEventListener('input',()=>{const v=String(el.value||'').replace(/\D/g,'').slice(0,2);if(el.value!==v)el.value=v;});
      el.addEventListener('blur',()=>{if(el.value==='')return;let n=Number(el.value);el.value=Number.isFinite(n)?String(Math.max(0,Math.min(10,n))):'';el.dispatchEvent(new Event('change',{bubbles:true}));});
    }
  }

  function fixTalkNotes(){
    for(const el of document.querySelectorAll('#sheet .pmV65TalkNote')){
      el.disabled=false;el.readOnly=false;if(el.dataset.pmV67Talk==='1')continue;el.dataset.pmV67Talk='1';
      el.addEventListener('pointerdown',e=>e.stopPropagation());el.addEventListener('click',e=>{e.stopPropagation();el.focus();});el.addEventListener('keydown',e=>e.stopPropagation());
    }
  }

  function onlyOneShadchanHeading(){
    const sheet=document.getElementById('sheet'),row=sheet?.querySelector('.v19Contact');if(!sheet||!row)return;
    let labels=[...sheet.querySelectorAll('.pmContactLabel')].filter(el=>String(el.textContent||'').trim()==='Contact shadchan');
    let label=labels.shift()||null;labels.forEach(el=>el.remove());
    if(!label){label=document.createElement('div');label.className='pmContactLabel';label.dataset.pmContactFor='shadchan';label.textContent='Contact shadchan';}
    if(row.previousElementSibling!==label)row.insertAdjacentElement('beforebegin',label);
  }

  function moveShadPhone(id){
    const sheet=document.getElementById('sheet'),x=rec('shadchanim',id),row=sheet?.querySelector('.v19Contact');if(!sheet||!x||!row)return;
    let box=sheet.querySelector('.pmV65PhoneCopy');
    if(!box&&x.phone){box=document.createElement('div');box.className='pmV65PhoneCopy';box.innerHTML=`<span><b>Phone:</b> ${safe(x.phone)}</span><button type="button">Copy</button>`;box.querySelector('button').onclick=async()=>{try{await navigator.clipboard.writeText(String(x.phone));const b=box.querySelector('button');b.textContent='Copied';setTimeout(()=>b.textContent='Copy',1000);}catch(_){ }};}
    if(box){box.classList.add('pmV67PhoneBelow');if(row.nextElementSibling!==box)row.insertAdjacentElement('afterend',box);}
  }

  function moveShadAttachment(id){
    const sheet=document.getElementById('sheet'),x=rec('shadchanim',id),head=sheet?.querySelector('.v19ShadHead');if(!sheet||!x||!head)return;
    const box=sheet.querySelector('.pmV63Attachment');if(!box)return;box.classList.add('pmV67ShadAttachment');
    /* Label only, for the compact header tile. Click handling for the saved
       attachment is owned entirely by profile-pdf-ocr-v63.js (openPmAttachment). */
    const btn=box.querySelector('button');if(btn&&btn.dataset.pmV67Attach!=='1'){btn.dataset.pmV67Attach='1';btn.textContent='PDF / screenshot';}
    if(box.parentElement!==head)head.appendChild(box);
  }

  function contactNameForPhone(phone){const k=phoneKey(phone);if(!k)return'';const s=(data.shadchanim||[]).find(x=>phoneKey(x.phone)===k);return String(s?.name||'').trim();}
  function contactRows(k,id){
    const sheet=document.getElementById('sheet'),x=rec(k,id),buttons=sheet?.querySelector('.pmProfileContact');if(!sheet||!x||!buttons)return;
    const contacts=[{name:String(x.sourceName||x.source||'').trim(),phone:String(x.sourcePhone||'').trim()},{name:String(x.sourceName2||contactNameForPhone(x.sourcePhone2)||'').trim(),phone:String(x.sourcePhone2||'').trim()}].filter(c=>c.name||c.phone);
    const sig=JSON.stringify(contacts),old=sheet.querySelector('.pmV67ContactPeople');if(old?.dataset.sig===sig&&buttons.nextElementSibling===old)return;if(old)old.remove();if(!contacts.length)return;
    const box=document.createElement('div');box.className='pmV67ContactPeople';box.dataset.sig=sig;
    for(const c of contacts){const line=document.createElement('div');line.className='pmV67ContactLine';line.innerHTML=`<span class="pmV67ContactName">${safe(c.name||'Contact person')}</span><span class="pmV67ContactPhone">${safe(c.phone||'')}</span>`;box.appendChild(line);}buttons.insertAdjacentElement('afterend',box);
  }

  function secondContactNameForm(){
    const p2=document.getElementById('pmV65SenderPhone2');if(!p2||document.getElementById('pmV67SenderName2'))return;const k=formKind();if(!k)return;
    const isEdit=/^Edit\b/i.test(heading()),x=isEdit&&activeProfile?.k===k?rec(k,activeProfile.id):null,phoneLabel=p2.closest('label');if(!phoneLabel)return;
    [...phoneLabel.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE).forEach(n=>n.remove());phoneLabel.insertBefore(document.createTextNode('Phone'),phoneLabel.firstChild);
    const nameLabel=document.createElement('label');nameLabel.appendChild(document.createTextNode('Name'));const inp=document.createElement('input');inp.id='pmV67SenderName2';inp.placeholder='Second contact name';inp.value=String(x?.sourceName2||contactNameForPhone(x?.sourcePhone2)||'');nameLabel.appendChild(inp);
    const row=document.createElement('div');row.className='pmV67ContactFormRow';phoneLabel.insertAdjacentElement('beforebegin',row);row.appendChild(nameLabel);row.appendChild(phoneLabel);
    const saveBtn=document.getElementById('v19Save');if(!saveBtn)return;const before=new Set((data[k]||[]).map(z=>String(z.id)));
    saveBtn.addEventListener('click',()=>{const value=String(inp.value||'').trim();if(isEdit&&x){x.sourceName2=value;setTimeout(()=>{x.sourceName2=value;saveQuiet();},190);return;}setTimeout(()=>{const n=(data[k]||[]).find(z=>!before.has(String(z.id)));if(n){n.sourceName2=value;saveQuiet();}},240);},true);
  }

  function sourceLanguage(text){if(/[\u0590-\u05FF]/.test(text))return'he';if(/[\u0400-\u04FF]/.test(text))return'ru';return'en';}
  function textChunks(text,max=2600){const out=[];let rest=String(text||'');while(rest.length>max){let cut=rest.lastIndexOf('\n',max);if(cut<max*.55)cut=rest.lastIndexOf(' ',max);if(cut<max*.55)cut=max;out.push(rest.slice(0,cut));rest=rest.slice(cut).replace(/^\s+/,'');}if(rest)out.push(rest);return out;}
  async function browserTranslate(text,target){if(!window.Translator||typeof window.Translator.create!=='function')return null;const source=sourceLanguage(text);if(source===target)return text;try{const tr=await window.Translator.create({sourceLanguage:source,targetLanguage:target});return await tr.translate(text);}catch(_){return null;}}
  async function webTranslate(text,target){const parts=[];for(const part of textChunks(text)){const u='https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl='+encodeURIComponent(target)+'&dt=t&q='+encodeURIComponent(part);const r=await fetch(u,{cache:'no-store'});if(!r.ok)throw new Error('translate '+r.status);const j=await r.json();parts.push((j?.[0]||[]).map(a=>a?.[0]||'').join(''));}return parts.join('\n');}
  async function translateInApp(raw,target,status,out){status.textContent='Translating…';try{let t=await browserTranslate(raw,target);if(t==null)t=await webTranslate(raw,target);out.textContent=t;out.classList.remove('hidden');status.textContent='';}catch(e){console.warn('PeerMatch translation',e);status.textContent='Translation is temporarily unavailable. Please try again.';}}
  function translation(k,id){
    if(k!=='guys'&&k!=='girls')return;const sheet=document.getElementById('sheet'),x=rec(k,id),text=sheet?.querySelector('.card > .profileText');if(!sheet||!x||!text)return;const raw=String(x.text||text.textContent||'').trim();if(!raw)return;
    let trigger=sheet.querySelector('.pmV65Translate');if(!trigger){trigger=document.createElement('button');trigger.type='button';trigger.className='pmV65Translate';text.closest('.card').insertAdjacentElement('beforebegin',trigger);}if(trigger.dataset.pmV67Translate==='1')return;
    const clean=trigger.cloneNode(false);clean.type='button';clean.className='pmV65Translate';clean.textContent='Translate';clean.dataset.pmV67Translate='1';trigger.replaceWith(clean);
    clean.onclick=()=>{
      let bar=sheet.querySelector('.pmV67TranslateBar');if(bar){bar.classList.toggle('hidden');return;}
      bar=document.createElement('div');bar.className='pmV67TranslateBar';bar.innerHTML='<button type="button" data-lang="en">English</button><button type="button" data-lang="he">Hebrew</button><button type="button" data-lang="ru">Russian</button>';
      const status=document.createElement('div');status.className='pmV67TranslateStatus';const out=document.createElement('div');out.className='pmV67Translated hidden';clean.insertAdjacentElement('afterend',bar);bar.insertAdjacentElement('afterend',status);status.insertAdjacentElement('afterend',out);
      bar.onclick=e=>{const b=e.target.closest('button[data-lang]');if(b)translateInApp(raw,b.dataset.lang,status,out);};
    };
  }

  function polish(){
    fixReligiousInputs();fixTalkNotes();secondContactNameForm();
    if(activeShad!=null&&document.getElementById('sheet')&&!document.getElementById('v19SName')&&!document.getElementById('esName')&&!document.getElementById('sn')){onlyOneShadchanHeading();moveShadPhone(activeShad);moveShadAttachment(activeShad);}
    if(activeProfile&&document.getElementById('sheet')&&!document.getElementById('v19Profile')){contactRows(activeProfile.k,activeProfile.id);translation(activeProfile.k,activeProfile.id);}
  }
  function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;polish();});}

  const priorOpenP=window.openP;if(typeof priorOpenP==='function')window.openP=function(k,id){activeProfile={k,id};activeShad=null;const r=priorOpenP(k,id);setTimeout(polish,60);return r;};
  const priorOpenS=window.openS;if(typeof priorOpenS==='function')window.openS=function(id){activeShad=id;activeProfile=null;const r=priorOpenS(id);setTimeout(polish,60);return r;};
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});schedule();
})();
