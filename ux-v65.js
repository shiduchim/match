/* PeerMatch v65: compact details, referral grouping, reliable SMS, second profile phone, click-only girl photos. */
(function(){
  document.documentElement.dataset.peerMatchVersion='65';
  let activeProfile=null,activeShad=null,queued=false;

  const css=document.createElement('style');
  css.textContent=`
    .pmChatDetail .v19Head,.pmChatDetail .v19ShadHead{position:sticky!important;top:-18px!important;z-index:55!important;background:var(--bg)!important;padding:18px 0 8px!important;margin-top:-18px!important}
    .pmInlineTools{padding:7px 8px!important;margin:7px 0 9px!important;border-radius:11px!important}
    .pmInlineToolsTitle{display:none!important}
    .pmInlineTags{grid-template-columns:42px minmax(0,1fr)!important;gap:6px!important}
    .pmInlineTags input{padding:7px 8px!important;border-radius:9px!important;min-height:34px!important}
    .pmInlineTools>.pmLangChecks{display:none!important}
    .pmV65Rel{display:grid;grid-template-columns:92px 74px;gap:7px;align-items:center;margin-top:6px}
    .pmV65Rel span{font-size:11px;font-weight:800;color:var(--text)}
    .pmV65Rel input{padding:6px 7px!important;min-height:32px!important;border-radius:9px!important}
    .pmStatusChecks{margin-top:7px!important;padding-top:7px!important;gap:6px 10px!important}
    .pmV65TalkNote{display:none;margin-top:6px!important;min-height:58px!important;padding:8px 9px!important;border-radius:9px!important;font-size:12px!important}
    .pmV65TalkNote.show{display:block!important}
    .pmV65PhoneCopy{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:7px 0 9px;padding:8px 10px;border:1px solid #d7e2e9;background:#fff;border-radius:11px;font-size:12px}
    .pmV65PhoneCopy button{padding:5px 8px!important;border-radius:8px!important;font-size:10px!important;background:#e8f1f7!important;color:#274b64!important}
    .pmV65RefToggle{display:flex;align-items:center;gap:7px;margin:-2px 5px 3px 26px;padding:5px 8px;border-left:3px solid #c9dce8;color:#315b78;font-size:11px;font-weight:850;cursor:pointer}
    .pmV65RefToggle .arrow{font-size:14px;line-height:1}
    #shadchanList .pmV65RefChild{margin:5px 0 5px 24px!important;padding:9px 10px!important;border-radius:13px!important;border-left:3px solid #c9dce8!important;background:#fbfcfd!important}
    #shadchanList .pmV65RefChild .avatar{width:40px!important;height:40px!important;border-radius:10px!important}
    #shadchanList .pmV65RefChild .name{font-size:13px!important}
    #shadchanList .pmV65RefChild .small{font-size:11px!important}
    .pmV65RefHidden{display:none!important}
    .pmV65ProfileLinks,.pmV65ReverseLinks{margin:7px 0 10px;padding:8px 10px;border:1px solid #d7e2e9;border-radius:11px;background:#f7fafc;font-size:12px}
    .pmV65LinkBtn{display:inline-block!important;width:auto!important;margin:5px 5px 0 0!important;padding:6px 8px!important;border-radius:8px!important;background:#dfeef9!important;color:#19324a!important;font-size:10px!important;font-weight:850!important}
    .pmV65Phone2Pill{display:inline-block;margin-left:5px;padding:4px 8px;border-radius:999px;background:#eef3f6;font-size:10px;color:#315b78}
    .pmV65AttachTop{width:72px!important;min-height:66px!important;padding:6px 4px!important;border-radius:12px!important;background:#eef3f6!important;color:var(--text)!important;font-size:9px!important;line-height:1.15!important}
    #pmV63Scan .pmV63ScanTop,#pmV63Scan .pmV63ScanHint{display:none!important}
    #pmV63Scan{padding:6px 8px!important;margin:6px 0 8px!important}
    #pmV63Scan .pmV63ScanActions{display:block!important;margin:0!important}
    #pmV63Scan .pmV63ScanActions #pmV63Remove{width:auto!important;padding:5px 7px!important;font-size:10px!important}
    #pmV63Scan .pmV63FileName{margin-top:4px!important;padding:5px 7px!important;font-size:10px!important}
    #pmV63Scan .pmV63Status{font-size:10px!important;margin-top:3px!important}
    .pmV65GirlPhoto{padding:7px 10px!important;border-radius:9px!important;background:#e8f1f7!important;color:#274b64!important;font-size:11px!important}
    #girlsList .photo,#girlsList .pmFaceCrop{display:none!important}
    .pmV65SecondPhone label{margin:4px 0 8px!important}
    @media(max-width:430px){.pmV65Rel{grid-template-columns:84px 70px}.pmV65RefToggle{margin-left:18px}#shadchanList .pmV65RefChild{margin-left:18px!important}.pmV65AttachTop{width:66px!important;min-height:60px!important}}
  `;
  document.head.appendChild(css);

  const safe=s=>typeof esc==='function'?esc(s):String(s??'');
  const norm=s=>String(s||'').toLocaleLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
  const phoneKey=p=>typeof window.pmPhoneKey==='function'?window.pmPhoneKey(p):String(p||'').replace(/\D/g,'');
  const localPhone=p=>typeof window.pmNormalizePhone==='function'?window.pmNormalizePhone(p):String(p||'').trim();
  function record(k,id){return(data[k]||[]).find(x=>String(x.id)===String(id))||null;}
  function heading(){return String(document.querySelector('#sheet h2')?.textContent||'').trim();}
  function formKind(){const h=heading();return/Guy/i.test(h)?'guys':/Girl/i.test(h)?'girls':'';}

  function saveQuiet(){try{const p=save();if(p?.catch)p.catch(e=>console.warn('PeerMatch v65 save',e));}catch(e){console.warn('PeerMatch v65 save',e);}}

  function decorateQuick(k,id){
    const x=record(k,id),sheet=document.getElementById('sheet'),box=sheet?.querySelector('.pmInlineTools');if(!x||!sheet||!box)return;
    const tag=box.querySelector('#pmV62InlineTags');if(tag){tag.placeholder='';const s=tag.previousElementSibling;if(s)s.textContent='Tags';}
    let rel=box.querySelector('.pmV65Rel');
    if(!rel){rel=document.createElement('div');rel.className='pmV65Rel';rel.innerHTML='<span>Religious level</span><input class="pmV65RelInput" type="number" min="0" max="10" inputmode="numeric" placeholder="0-10">';box.querySelector('.pmInlineTags')?.insertAdjacentElement('afterend',rel);}
    rel.querySelector('.pmV65RelInput').value=x.religiousLevel??'';
    const status=box.querySelector('.pmStatusChecks');
    if(status){
      const p=status.querySelector('#pmV62Phone'),q=status.querySelector('#pmV62Person');
      let pn=box.querySelector('.pmV65PhoneNote'),ip=box.querySelector('.pmV65PersonNote');
      if(!pn){pn=document.createElement('textarea');pn.className='pmV65TalkNote pmV65PhoneNote';pn.rows=2;pn.placeholder='Phone conversation: length, importance, what it was like…';status.insertAdjacentElement('afterend',pn);}
      if(!ip){ip=document.createElement('textarea');ip.className='pmV65TalkNote pmV65PersonNote';ip.rows=2;ip.placeholder='In-person conversation: length, importance, what it was like…';pn.insertAdjacentElement('afterend',ip);}
      pn.value=x.phoneConversationNote||'';ip.value=x.inPersonConversationNote||'';
      const draw=()=>{pn.classList.toggle('show',!!p?.checked||!!pn.value.trim());ip.classList.toggle('show',!!q?.checked||!!ip.value.trim());};draw();p?.addEventListener('change',draw);q?.addEventListener('change',draw);
    }
    if(box.dataset.pmV65Bound!=='1'){
      box.dataset.pmV65Bound='1';let t=null;
      const persist=()=>{clearTimeout(t);t=setTimeout(()=>{x.religiousLevel=String(box.querySelector('.pmV65RelInput')?.value||'').trim();x.phoneConversationNote=String(box.querySelector('.pmV65PhoneNote')?.value||'').trim();x.inPersonConversationNote=String(box.querySelector('.pmV65PersonNote')?.value||'').trim();saveQuiet();},220);};
      box.addEventListener('input',persist);box.addEventListener('change',persist);
    }
    const history=[...sheet.querySelectorAll('.sectionTitle')].find(e=>/History|Conversation|What I did/i.test(e.textContent||''));
    if(k==='shadchanim'){if(history&&box.nextElementSibling!==history)history.insertAdjacentElement('beforebegin',box);}
    else{
      const profileCard=sheet.querySelector('.card');
      if(profileCard&&profileCard.nextElementSibling!==box)profileCard.insertAdjacentElement('afterend',box);
      else if(!profileCard&&history)history.insertAdjacentElement('beforebegin',box);
    }
  }

  async function copyText(text){
    try{await navigator.clipboard.writeText(text);return true;}catch(_){
      try{const ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();const ok=document.execCommand('copy');ta.remove();return ok;}catch(__){return false;}
    }
  }
  function shadPhone(id){
    const x=record('shadchanim',id),sheet=document.getElementById('sheet');if(!x||!sheet||!x.phone)return;
    sheet.querySelector('.pmV65PhoneCopy')?.remove();const d=document.createElement('div');d.className='pmV65PhoneCopy';d.innerHTML=`<span><b>Phone:</b> ${safe(x.phone)}</span><button type="button">Copy</button>`;
    const head=sheet.querySelector('.v19ShadHead')||sheet.querySelector('h2');head?.insertAdjacentElement('afterend',d);
    d.onclick=async e=>{if(!e.target.closest('button')&&!e.target.closest('span'))return;const ok=await copyText(String(x.phone));const b=d.querySelector('button');b.textContent=ok?'Copied':'Copy';setTimeout(()=>b.textContent='Copy',1200);};
  }

  function parentOf(x,arr){
    if(!x)return null;if(x.referredById!=null){const p=arr.find(z=>String(z.id)===String(x.referredById));if(p&&p!==x)return p;}
    const n=norm(x.referredBy);if(!n)return null;return arr.find(z=>z!==x&&norm(z.name)===n)||null;
  }
  function reorderShad(){
    const arr=data.shadchanim||[],children=new Map(),childIds=new Set();
    for(const x of arr){const p=parentOf(x,arr);if(!p)continue;const k=String(p.id);if(!children.has(k))children.set(k,[]);children.get(k).push(x);childIds.add(String(x.id));}
    const out=[],seen=new Set();
    const add=x=>{const k=String(x.id);if(seen.has(k))return;seen.add(k);out.push(x);for(const c of children.get(k)||[])add(c);};
    for(const x of arr)if(!childIds.has(String(x.id)))add(x);for(const x of arr)add(x);
    if(out.length===arr.length)data.shadchanim=out;
  }
  function visibleShads(){const q=String(document.getElementById('shadchanSearch')?.value||'').toLowerCase();return(data.shadchanim||[]).filter(x=>`${x.name||''} ${x.phone||''} ${x.email||''} ${x.tags||''} ${x.referredBy||''}`.toLowerCase().includes(q));}
  function organizeShads(){
    const list=document.getElementById('shadchanList');if(!list)return;
    list.querySelectorAll('.pmRefGroup,.pmV65RefToggle').forEach(e=>e.remove());
    list.querySelectorAll('.card').forEach(c=>{c.classList.remove('pmRefCollapsed','pmV65RefChild','pmV65RefHidden');});
    const arr=visibleShads(),cards=[...list.children].filter(e=>e.classList?.contains('card'));if(cards.length!==arr.length)return;
    const index=new Map(arr.map((x,i)=>[String(x.id),i]));
    for(let i=0;i<arr.length;i++){
      const parent=arr[i],desc=[];
      for(let j=0;j<arr.length;j++){let p=parentOf(arr[j],data.shadchanim||[]),guard=0;while(p&&guard++<20){if(String(p.id)===String(parent.id)){desc.push(j);break;}p=parentOf(p,data.shadchanim||[]);}}
      if(!desc.length)continue;
      const key='pmV65Ref:'+parent.id,open=sessionStorage.getItem(key)==='1';
      const t=document.createElement('div');t.className='pmV65RefToggle';t.innerHTML=`<span class="arrow">${open?'▴':'▾'}</span><span>${desc.length} referred shadchan${desc.length===1?'':'im'}</span>`;cards[i].insertAdjacentElement('afterend',t);
      desc.forEach(j=>{cards[j].classList.add('pmV65RefChild');cards[j].classList.toggle('pmV65RefHidden',!open);});
      t.onclick=()=>{const now=sessionStorage.getItem(key)==='1';sessionStorage.setItem(key,now?'0':'1');desc.forEach(j=>cards[j].classList.toggle('pmV65RefHidden',now));t.querySelector('.arrow').textContent=now?'▾':'▴';};
    }
  }

  function shadMatchesPhone(p){const k=phoneKey(p);if(!k)return null;return(data.shadchanim||[]).find(s=>phoneKey(s.phone)===k)||null;}
  function linkedShads(x){
    if(!x)return[];const out=[];const add=s=>{if(s&&!out.some(z=>String(z.id)===String(s.id)))out.push(s);};
    add(shadMatchesPhone(x.sourcePhone));add(shadMatchesPhone(x.sourcePhone2));
    for(const id of [x.sourceShadchanId,x.sourceShadchanId2,x.importedFromShadchanId])if(id!=null)add(record('shadchanim',id));
    const n=norm(x.sourceName||x.source||x.importedFromShadchan);if(n)add((data.shadchanim||[]).find(s=>norm(s.name)===n));return out;
  }
  function profileLinks(k,id){
    const x=record(k,id),sheet=document.getElementById('sheet');if(!x||!sheet)return;
    sheet.querySelectorAll('.pmV64ProfileLink,.pmV65ProfileLinks,.pmV65Phone2Pill').forEach(e=>e.remove());
    const links=linkedShads(x),meta=sheet.querySelector('.pmMeta');if(x.sourcePhone2&&meta){const p=document.createElement('span');p.className='pmV65Phone2Pill';p.textContent='Phone 2: '+x.sourcePhone2;meta.appendChild(p);}
    if(!links.length)return;const d=document.createElement('div');d.className='pmV65ProfileLinks';d.innerHTML='<b>Linked shadchanim</b><div></div>';const h=d.lastElementChild;
    links.forEach(s=>{const b=document.createElement('button');b.type='button';b.className='pmV65LinkBtn';b.textContent=s.name||'Unnamed shadchan';b.onclick=()=>openS(s.id);h.appendChild(b);});
    (sheet.querySelector('.pmContactLabel')||sheet.querySelector('.pmProfileContact')||sheet.querySelector('.pmInlineTools')||sheet.querySelector('.sectionTitle'))?.insertAdjacentElement('beforebegin',d);
  }
  function reverseLinks(id){
    const sh=record('shadchanim',id),sheet=document.getElementById('sheet');if(!sh||!sheet)return;
    sheet.querySelectorAll('.pmV64ReverseLinks,.pmV65ReverseLinks').forEach(e=>e.remove());const a=[];
    for(const k of ['guys','girls'])for(const x of data[k]||[])if(linkedShads(x).some(s=>String(s.id)===String(id)))a.push({k,x});
    if(!a.length)return;const d=document.createElement('div');d.className='pmV65ReverseLinks';d.innerHTML=`<b>Linked profiles (${a.length})</b><div></div>`;const h=d.lastElementChild;a.forEach(p=>{const b=document.createElement('button');b.type='button';b.className='pmV65LinkBtn';b.textContent=(p.k==='guys'?'Guy: ':'Girl: ')+(p.x.name||'Unnamed');b.onclick=()=>openP(p.k,p.x.id);h.appendChild(b);});
    const hist=[...sheet.querySelectorAll('.sectionTitle')].find(e=>/History|Conversation/i.test(e.textContent||''));(hist||sheet.querySelector('.v19Contact'))?.insertAdjacentElement('beforebegin',d);
  }

  function secondPhoneForm(){
    const first=document.getElementById('v19SenderPhone');if(!first||document.getElementById('pmV65SenderPhone2'))return;const k=formKind();if(!k)return;
    const lab=document.createElement('label');lab.appendChild(document.createTextNode('Phone 2'));const inp=document.createElement('input');inp.id='pmV65SenderPhone2';inp.type='tel';inp.inputMode='tel';inp.placeholder='Second contact phone';lab.appendChild(inp);
    first.closest('label')?.insertAdjacentElement('afterend',lab);const isEdit=/^Edit\b/i.test(heading()),x=isEdit&&activeProfile?.k===k?record(k,activeProfile.id):null;if(x)inp.value=x.sourcePhone2||'';
    const before=new Set((data[k]||[]).map(z=>String(z.id))),saveBtn=document.getElementById('v19Save');if(!saveBtn)return;
    saveBtn.addEventListener('click',()=>{const v=localPhone(inp.value);inp.value=v;if(isEdit&&x){x.sourcePhone2=v;x.sourceShadchanId2=shadMatchesPhone(v)?.id||null;return;}setTimeout(()=>{const n=(data[k]||[]).find(z=>!before.has(String(z.id)));if(n){n.sourcePhone2=v;n.sourceShadchanId2=shadMatchesPhone(v)?.id||null;saveQuiet();}},180);},true);
  }

  function topAttachmentButton(){
    const tools=document.querySelector('#sheet .v19Tools'),media=document.getElementById('v19Media'),attach=document.getElementById('pmV63Attach'),photoInput=document.getElementById('v19MediaInput');if(!tools||!media)return;
    if(photoInput)photoInput.id='v19PhotoInput65';if(!media.querySelector('img'))media.textContent='Photo';media.setAttribute('aria-label','Photo');
    if(attach){attach.textContent='PDF / screenshot';attach.classList.add('pmV65AttachTop');if(attach.parentElement!==tools)media.insertAdjacentElement('afterend',attach);}
  }

  function girlPhoto(k){
    if(k!=='girls')return;const sheet=document.getElementById('sheet'),tile=document.getElementById('v19DetailMedia'),head=sheet?.querySelector('.v19Head');if(!sheet||!tile||!head)return;
    tile.style.display='none';if(head.querySelector('.pmV65GirlPhoto'))return;const b=document.createElement('button');b.type='button';b.className='pmV65GirlPhoto';b.textContent='Photo';b.onclick=()=>tile.click();head.appendChild(b);
  }

  function profileSelected(k){
    const q=String(document.getElementById(k+'Search')?.value||'').toLowerCase(),arr=(data[k]||[]).filter(x=>`${x.name||''} ${x.age||''} ${x.text||''} ${x.tags||''} ${x.sourceName||x.source||''} ${x.sourcePhone||''}`.toLowerCase().includes(q));
    const cards=[...document.querySelectorAll('#'+k+'List > .card')],out=[];cards.forEach((c,i)=>{if(c.querySelector('.pmListCheck:checked')&&arr[i])out.push(arr[i]);});return out;
  }
  function scripts(s){s=String(s||'');return{en:/[A-Za-z]/.test(s),he:/[\u0590-\u05FF]/.test(s),ru:/[\u0400-\u04FF]/.test(s)};}
  function filterLang(text,f){return String(text||'').split(/\r?\n/).filter(line=>{const s=scripts(line);if(!s.en&&!s.he&&!s.ru)return true;return(s.en&&f.en)||(s.he&&f.he)||(s.ru&&f.ru);}).join('\n').replace(/\n{3,}/g,'\n\n').trim();}
  function smsOpen(x,f){const t=filterLang(x.text||'',f).replace(/\*+/g,'');if(!t)return alert('There is no profile text in that language.');x.activities=x.activities||[];x.activities.push({id:Date.now(),type:'action',action:'Profile shared • SMS',text:'Profile sharing opened via SMS.',ts:typeof stamp==='function'?stamp():new Date().toLocaleString()});saveQuiet();location.href='sms:?body='+encodeURIComponent(t);}
  function smsLanguages(items,go){const p=scripts(items.map(x=>x.text||'').join('\n'));const d=document.createElement('div');d.id='pmV65SmsDialog';d.style.cssText='position:fixed;inset:0;z-index:13000;background:rgba(0,0,0,.38);display:flex;align-items:flex-end;justify-content:center;padding:14px';d.innerHTML=`<div style="width:min(560px,100%);background:#fff;border-radius:18px;padding:16px"><div style="font-weight:900;font-size:17px">Include in SMS</div><div style="font-size:12px;color:#667;margin:5px 0 10px">Only the profile text will be sent.</div><div style="display:flex;gap:13px;flex-wrap:wrap;margin-bottom:12px">${p.en?'<label style="margin:0"><input data-l="en" type="checkbox" checked style="width:auto"> English</label>':''}${p.he?'<label style="margin:0"><input data-l="he" type="checkbox" checked style="width:auto"> Hebrew</label>':''}${p.ru?'<label style="margin:0"><input data-l="ru" type="checkbox" checked style="width:auto"> Russian</label>':''}</div><button id="pmV65SmsGo" class="primary full">Continue to SMS</button><button id="pmV65SmsCancel" class="secondary full" style="margin-top:8px">Cancel</button></div>`;document.body.appendChild(d);d.querySelector('#pmV65SmsCancel').onclick=()=>d.remove();d.querySelector('#pmV65SmsGo').onclick=()=>{const f={en:!!d.querySelector('[data-l="en"]')?.checked,he:!!d.querySelector('[data-l="he"]')?.checked,ru:!!d.querySelector('[data-l="ru"]')?.checked};if(!f.en&&!f.he&&!f.ru)return alert('Keep at least one language checked.');d.remove();go(f);};}
  function smsQueue(items,f){let i=0;const draw=()=>{document.getElementById('pmV65SmsQueue')?.remove();if(i>=items.length)return;const x=items[i],d=document.createElement('div');d.id='pmV65SmsQueue';d.style.cssText='position:fixed;inset:0;z-index:13000;background:rgba(0,0,0,.36);display:flex;align-items:flex-end;justify-content:center;padding:14px';d.innerHTML=`<div style="width:min(560px,100%);background:#fff;border-radius:18px;padding:16px"><b>SMS profiles separately</b><div style="font-size:13px;color:#667;margin:6px 0 12px">${i+1} of ${items.length}: ${safe(x.name||'Unnamed profile')}</div><button id="pmV65SmsNext" class="primary full">Open this SMS</button><button id="pmV65SmsStop" class="secondary full" style="margin-top:8px">Cancel</button></div>`;document.body.appendChild(d);d.querySelector('#pmV65SmsStop').onclick=()=>d.remove();d.querySelector('#pmV65SmsNext').onclick=()=>{i++;d.remove();smsOpen(x,f);setTimeout(draw,80);};};draw();}
  function ownSmsButtons(){for(const k of ['guys','girls']){const b=document.getElementById('pmSms-'+k);if(!b||b.dataset.pmV65Sms==='1')continue;b.id='pmSms65-'+k;b.dataset.pmV65Sms='1';b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();const items=profileSelected(k);if(!items.length)return;smsLanguages(items,f=>items.length===1?smsOpen(items[0],f):smsQueue(items,f));},true);}}

  const priorRenderS=window.renderS;if(typeof priorRenderS==='function')window.renderS=function(){reorderShad();const r=priorRenderS();requestAnimationFrame(organizeShads);return r;};
  const priorOpenP=window.openP;if(typeof priorOpenP==='function')window.openP=function(k,id){activeProfile={k,id};const r=priorOpenP(k,id);setTimeout(()=>{decorateQuick(k,id);profileLinks(k,id);girlPhoto(k);},70);return r;};
  const priorOpenS=window.openS;if(typeof priorOpenS==='function')window.openS=function(id){activeShad=id;const r=priorOpenS(id);setTimeout(()=>{decorateQuick('shadchanim',id);shadPhone(id);reverseLinks(id);},70);return r;};

  function polish(){secondPhoneForm();topAttachmentButton();ownSmsButtons();if(activeProfile&&document.getElementById('sheet')&&!document.getElementById('v19Name')){decorateQuick(activeProfile.k,activeProfile.id);profileLinks(activeProfile.k,activeProfile.id);girlPhoto(activeProfile.k);}if(activeShad!=null&&document.getElementById('sheet')&&!document.getElementById('v19SName')&&!document.getElementById('sn')){decorateQuick('shadchanim',activeShad);shadPhone(activeShad);reverseLinks(activeShad);}}
  function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;polish();});}
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
  setTimeout(()=>{try{renderS();}catch(_){}polish();organizeShads();},800);
})();
