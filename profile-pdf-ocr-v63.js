/* PeerMatch v63: local PDF/screenshot attachment parsing for profiles and shadchanim.
   - PDF text is extracted locally with PDF.js; image-only PDFs fall back to local OCR.
   - Screenshots/photos can be OCR'd locally in English, Hebrew and Russian.
   - Existing typed fields are never overwritten by extracted text.
   - Attachments are kept even when text extraction/OCR fails.
   - This file also owns opening saved attachments (openPmAttachment): images render
     directly, PDFs render in-app via the same PDF.js loader used for parsing. No
     other live file may bind a click handler to a saved-attachment button.
*/
(function(){
  document.documentElement.dataset.peerMatchVersion='63';
  const PDF_JS='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  const PDF_WORKER='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const TESS_JS='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
  const ONLY_SENTINEL='__PEERMATCH_ATTACHMENT_ONLY__';
  let activeProfile=null,activeShad=null,current=null,decorateQueued=false;
  const loaded=new Map();

  const css=document.createElement('style');
  css.textContent=`
    .pmV63Scan{background:#fff;border:1px solid var(--line);border-radius:13px;padding:10px;margin:9px 0 11px}
    .pmV63ScanTop{display:flex;align-items:center;justify-content:space-between;gap:8px}
    .pmV63ScanTitle{font-size:12px;font-weight:900;color:var(--text)}
    .pmV63ScanHint,.pmV63Status{font-size:11px;line-height:1.4;color:var(--muted);margin-top:5px;overflow-wrap:anywhere}
    .pmV63ScanActions{display:grid;grid-template-columns:1fr auto;gap:7px;margin-top:8px}
    .pmV63ScanActions button{min-width:0;padding:9px 8px;border-radius:10px;font-size:11px;font-weight:850}
    .pmV63FileName{margin-top:7px;padding:7px 8px;border-radius:9px;background:#f7fafc;border:1px solid #dbe3e7;font-size:11px;overflow-wrap:anywhere}
    .pmV63ShadProfile{min-height:130px!important}
    .pmV63ProfileCard{background:#fff;border:1px solid var(--line);border-radius:13px;padding:10px;margin:9px 0;white-space:pre-wrap;overflow-wrap:anywhere}
    .pmV63ProfileCard .small{margin-bottom:5px}
    .pmV63Attachment{margin:9px 0;padding:9px;background:#fff;border:1px solid var(--line);border-radius:12px;overflow-wrap:anywhere}
    .pmV63Attachment button{width:100%;margin-top:6px}
    @media(max-width:430px){.pmV63ScanActions{grid-template-columns:1fr}.pmV63ScanActions button{width:100%}}
  `;
  document.head.appendChild(css);

  const safe=s=>typeof esc==='function'?esc(s):String(s??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  function loadScript(src,globalName){
    if(globalName&&window[globalName])return Promise.resolve(window[globalName]);
    if(loaded.has(src))return loaded.get(src);
    const p=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.async=true;s.crossOrigin='anonymous';s.onload=()=>resolve(globalName?window[globalName]:true);s.onerror=()=>reject(new Error('Could not load the local parsing engine. Check your internet connection and try again.'));document.head.appendChild(s);});
    loaded.set(src,p);return p;
  }
  async function pdfLib(){const lib=await loadScript(PDF_JS,'pdfjsLib');if(!lib)throw new Error('PDF parser did not load.');lib.GlobalWorkerOptions.workerSrc=PDF_WORKER;return lib;}
  async function tess(){const t=await loadScript(TESS_JS,'Tesseract');if(!t)throw new Error('OCR engine did not load.');return t;}

  function setStatus(text){const el=document.getElementById('pmV63Status');if(el)el.textContent=text||'';}
  function updateFileUi(){const name=document.getElementById('pmV63FileName'),remove=document.getElementById('pmV63Remove');if(name)name.textContent=current?.file?(current.name||'Attached file'):(current?.existingName||'No PDF or screenshot attached');if(remove)remove.style.display=(current?.file||current?.existingBlob)?'':'none';}
  function kindFromForm(){
    if(document.getElementById('v19Profile'))return'profile';
    if(document.getElementById('sn')||document.getElementById('v19SName')||document.getElementById('esName'))return'shadchan';
    return'';
  }
  function profileKind(){const h=String(document.querySelector('#sheet h2')?.textContent||'');return/Guy/i.test(h)?'guys':/Girl/i.test(h)?'girls':'';}
  function isEditForm(){return/^Edit\b/i.test(String(document.querySelector('#sheet h2')?.textContent||'').trim());}
  function getActiveRecord(type,k){
    if(!isEditForm())return null;
    if(type==='profile'&&activeProfile?.k===k)return(data[k]||[]).find(x=>String(x.id)===String(activeProfile.id))||null;
    if(type==='shadchan'&&activeShad!=null)return(data.shadchanim||[]).find(x=>String(x.id)===String(activeShad))||null;
    return null;
  }

  function cleanEdge(s){return String(s||'').replace(/^[\s*•\-–—:]+|[\s*•\-–—:]+$/g,'').trim();}
  function extractNameAge(text){
    const s=String(text||''),lines=s.split(/\r?\n/).map(x=>x.trim()).filter(Boolean),top=lines.slice(0,16);let name='',age='';
    const names=[/^(?:name|full name)\s*[:\-–]\s*(.+)$/i,/^(?:שם|שם מלא)\s*[:\-–]\s*(.+)$/,/^(?:имя|фио|ф\.?\s*и\.?\s*о\.?)\s*[:\-–]\s*(.+)$/i];
    for(const line of top){for(const re of names){const m=line.match(re);if(m){name=cleanEdge(m[1]);break;}}if(name)break;}
    const joined=top.join('\n'),ages=[/\bage\s*(?:is|:|-|–)?\s*(\d{2})\b/i,/\b(\d{2})\s*(?:years?\s*old|yo)\b/i,/(?:גיל\s*[:\-–]?\s*|בן\s+|בת\s+)(\d{2})\b/,/(?:возраст\s*[:\-–]?\s*)(\d{2})\b/i,/\b(\d{2})\s*(?:лет|года)\b/i];
    for(const re of ages){const m=joined.match(re)||s.match(re);if(m&&+m[1]>=18&&+m[1]<=99){age=m[1];break;}}
    if(!name&&top.length){let first=cleanEdge(top[0].replace(/[*_~]/g,''));const bad=/^(?:shidduch|profile|resume|bio|פרופיל|כרטיס|שידוך|анкета|резюме)\b/i;if(first.length<=70&&!bad.test(first)&&!/@/.test(first)&&!/(?:\+?\d[\d\s().-]{7,}\d)/.test(first)&&first.split(/\s+/).length<=7)name=first.replace(/\s*[,|]\s*(?:age\s*)?\d{2}\b.*$/i,'').replace(/\s+(?:בן|בת)\s+\d{2}\b.*$/,'').replace(/\s+\d{2}\s*(?:лет|года)\b.*$/i,'').trim();}
    return{name:name.slice(0,80),age};
  }
  function extractContact(text){
    const lines=String(text||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean),bottom=lines.slice(-18),joined=bottom.join('\n');
    const phone=(joined.match(/(?:\+?\d[\d\s().-]{7,}\d)/)||String(text||'').match(/(?:\+?\d[\d\s().-]{7,}\d)/)||[])[0]||'';
    const email=(joined.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)||String(text||'').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)||[])[0]||'';
    let name='';const labels=[/(?:contact(?:\s+person)?|for (?:more )?info(?:rmation)?|contact info)\s*[:\-–]?\s*(.*)/i,/(?:לפרטים|איש קשר|ליצירת קשר)\s*[:\-–]?\s*(.*)/,/(?:контакт(?:ное лицо)?|для связи|по вопросам)\s*[:\-–]?\s*(.*)/i];
    for(let i=bottom.length-1;i>=0&&!name;i--){for(const re of labels){const m=bottom[i].match(re);if(m){name=String(m[1]||'').replace(/(?:\+?\d[\d\s().-]{7,}\d)/g,'').replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig,'').replace(/[•|,;]+$/g,'').trim();break;}}}
    return{name:name.length<=70?name:'',phone:phone.trim(),email:email.trim()};
  }
  function fillIfEmpty(id,value){const el=document.getElementById(id);if(el&&!String(el.value||'').trim()&&value){el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));}}
  function applyExtracted(text,type){
    text=String(text||'').replace(/\u0000/g,'').replace(/[ \t]+\n/g,'\n').replace(/\n{4,}/g,'\n\n').trim();if(!text)return false;
    if(type==='profile'){
      const p=document.getElementById('v19Profile');if(p&&!p.value.trim()){p.value=text;p.dispatchEvent(new Event('input',{bubbles:true}));}
      const na=extractNameAge(text),ct=extractContact(text);fillIfEmpty('v19Name',na.name);fillIfEmpty('v19Age',na.age);fillIfEmpty('v19Sender',ct.name);fillIfEmpty('v19SenderPhone',ct.phone);fillIfEmpty('v19SenderEmail',ct.email);
    }else{
      const p=document.getElementById('pmV63ShadProfile');if(p&&!p.value.trim())p.value=text;
      const na=extractNameAge(text),ct=extractContact(text);fillIfEmpty('sn',na.name);fillIfEmpty('v19SName',na.name);fillIfEmpty('esName',na.name);fillIfEmpty('sp',ct.phone);fillIfEmpty('v19SPhone',ct.phone);fillIfEmpty('esPhone',ct.phone);fillIfEmpty('se',ct.email);fillIfEmpty('v19SEmail',ct.email);fillIfEmpty('esEmail',ct.email);
    }
    return true;
  }

  async function ocrSource(source,label){
    const T=await tess(),langs=['eng+heb+rus','eng+heb','eng'];let lastErr=null;
    for(const lang of langs){
      try{
        const r=await T.recognize(source,lang,{logger:m=>{if(m?.status){const pct=typeof m.progress==='number'?(' '+Math.round(m.progress*100)+'%'):'';setStatus((label||'Reading screenshot')+': '+m.status+pct);}}});
        return String(r?.data?.text||'').trim();
      }catch(e){lastErr=e;}
    }
    throw lastErr||new Error('OCR failed.');
  }
  async function ocrImage(file,label){const u=URL.createObjectURL(file);try{return await ocrSource(u,label||'Reading screenshot');}finally{URL.revokeObjectURL(u);}}
  async function pdfText(file){
    const lib=await pdfLib(),bytes=new Uint8Array(await file.arrayBuffer());setStatus('Reading PDF text…');
    const pdf=await lib.getDocument({data:bytes}).promise;let text='';
    for(let i=1;i<=pdf.numPages;i++){setStatus(`Reading PDF page ${i} of ${pdf.numPages}…`);const page=await pdf.getPage(i),tc=await page.getTextContent();text+=tc.items.map(x=>String(x.str||'')+(x.hasEOL?'\n':' ')).join('').trim()+'\n\n';}
    text=text.trim();if(text.replace(/\s/g,'').length>=35)return text;
    let ocr='';const max=Math.min(pdf.numPages,4);
    for(let i=1;i<=max;i++){
      setStatus(`PDF has little selectable text. OCR page ${i} of ${max}…`);const page=await pdf.getPage(i),vp=page.getViewport({scale:1.7}),canvas=document.createElement('canvas');canvas.width=Math.ceil(vp.width);canvas.height=Math.ceil(vp.height);const ctx=canvas.getContext('2d',{alpha:false});await page.render({canvasContext:ctx,viewport:vp}).promise;ocr+=(await ocrSource(canvas,`OCR PDF page ${i}`))+'\n\n';canvas.width=canvas.height=1;
    }
    return ocr.trim();
  }
  async function parseFile(file,type){
    if(!file)return'';const isPdf=/pdf/i.test(file.type||'')||/\.pdf$/i.test(file.name||''),isImg=String(file.type||'').startsWith('image/')||/\.(?:jpe?g|png|webp|gif|heic)$/i.test(file.name||'');
    try{
      let text='';if(isPdf)text=await pdfText(file);else if(isImg)text=await ocrImage(file,'Reading screenshot');else return'';
      current.parsedText=text;if(text){applyExtracted(text,type);setStatus('Text found. PeerMatch filled only fields that were empty. Review them before saving.');}else setStatus('No readable text was found. The attachment will still be kept.');return text;
    }catch(e){console.warn('PeerMatch local parse',e);setStatus('Could not read the text. The attachment will still be kept.');return'';}
  }

  function scanBox(type,k,record){
    const old=document.getElementById('pmV63Scan');if(old)return;
    current={type,k,isEdit:isEditForm(),recordId:record?.id||null,file:null,name:'',mime:'',parsedText:'',existingBlob:record?.profileAttachment||null,existingName:record?.profileAttachmentName||'',remove:false,beforeIds:new Set(((type==='profile'?data[k]:data.shadchanim)||[]).map(x=>String(x.id)))};
    const box=document.createElement('div');box.id='pmV63Scan';box.className='pmV63Scan';box.innerHTML=`<div class="pmV63ScanTop"><div class="pmV63ScanTitle">PDF / screenshot</div></div><div class="pmV63ScanHint">Attach a profile PDF or a screenshot from your phone. PeerMatch tries to read English, Hebrew or Russian locally on this device and fills only empty fields.</div><div class="pmV63ScanActions"><button id="pmV63Attach" type="button" class="secondary">Attach PDF / screenshot</button><button id="pmV63Remove" type="button" class="secondary">Remove</button></div><input id="pmV63Input" class="hidden" type="file" accept="application/pdf,image/*,.pdf"><div id="pmV63FileName" class="pmV63FileName"></div><div id="pmV63Status" class="pmV63Status"></div>`;
    const anchor=type==='profile'?document.getElementById('v19Profile')?.closest('label'):(document.getElementById('pmV63ShadProfile')?.closest('label')||document.getElementById('st')?.closest('label')||document.getElementById('v19STags')?.closest('label')||document.getElementById('esTags')?.closest('label'));
    anchor?.insertAdjacentElement('afterend',box);updateFileUi();
    box.querySelector('#pmV63Attach').onclick=()=>box.querySelector('#pmV63Input').click();
    box.querySelector('#pmV63Remove').onclick=()=>{current.file=null;current.name='';current.mime='';current.existingBlob=null;current.existingName='';current.remove=true;current.parsedText='';setStatus('Attachment will be removed when you save.');updateFileUi();};
    box.querySelector('#pmV63Input').onchange=async()=>{const f=box.querySelector('#pmV63Input').files?.[0];box.querySelector('#pmV63Input').value='';if(!f)return;current.file=f;current.name=f.name||'profile attachment';current.mime=f.type||'';current.remove=false;updateFileUi();const targetText=type==='profile'?document.getElementById('v19Profile'):document.getElementById('pmV63ShadProfile');if(targetText&&!String(targetText.value||'').trim())await parseFile(f,type);else setStatus('Attachment saved for this profile. Existing profile text was left unchanged.');};
  }

  function addShadProfileField(){
    const name=document.getElementById('sn')||document.getElementById('v19SName')||document.getElementById('esName');if(!name||document.getElementById('pmV63ShadProfile'))return;
    const x=getActiveRecord('shadchan'),lab=document.createElement('label');lab.appendChild(document.createTextNode('Profile / notes'));
    const ta=document.createElement('textarea');ta.id='pmV63ShadProfile';ta.className='pmV63ShadProfile';ta.placeholder='Paste shadchan information here, or attach a PDF/screenshot below';ta.value=String(x?.profileText||'');lab.appendChild(ta);
    const tags=document.getElementById('st')||document.getElementById('v19STags')||document.getElementById('esTags');(tags?.closest('label')||name.closest('label'))?.insertAdjacentElement('beforebegin',lab);
  }

  function decorateForm(){
    const type=kindFromForm();if(!type)return;
    if(type==='shadchan')addShadProfileField();
    if(document.getElementById('pmV63Scan'))return;
    const k=type==='profile'?profileKind():'shadchanim';if(type==='profile'&&!k)return;const x=getActiveRecord(type,k);scanBox(type,k,x);
  }

  async function persistPending(snapshot){
    if(!snapshot)return;let x=null;
    if(snapshot.isEdit&&snapshot.recordId!=null)x=(snapshot.type==='profile'?(data[snapshot.k]||[]):data.shadchanim||[]).find(z=>String(z.id)===String(snapshot.recordId))||null;
    else{
      const arr=snapshot.type==='profile'?(data[snapshot.k]||[]):(data.shadchanim||[]);for(let i=0;i<120;i++){x=arr.find(z=>!snapshot.beforeIds.has(String(z.id)))||null;if(x)break;await sleep(80);}
    }
    if(!x)return;
    if(snapshot.remove){x.profileAttachment=null;x.profileAttachmentName='';x.profileAttachmentType='';}
    else if(snapshot.file){x.profileAttachment=snapshot.file;x.profileAttachmentName=snapshot.name||snapshot.file.name||'profile attachment';x.profileAttachmentType=snapshot.mime||snapshot.file.type||'application/octet-stream';}
    if(snapshot.type==='profile'&&x.text===ONLY_SENTINEL){x.text='';if(String(x.name||'').trim()===ONLY_SENTINEL)x.name=(snapshot.k==='guys'?'Guy':'Girl')+' profile';}
    if(snapshot.type==='shadchan')x.profileText=snapshot.shadText||'';
    try{await save();if(snapshot.type==='profile')renderP(snapshot.k);else renderS();}catch(e){console.warn('PeerMatch attachment save',e);}
  }

  window.pmV63HasPendingAttachment=()=>!!(current&&(current.file||current.existingBlob)&&!current.remove&&document.getElementById('pmV63Scan'));
  window.addEventListener('click',e=>{
    const b=e.target?.closest?.('#v19Save,#pmFormSave');if(!b||!current||!document.getElementById('pmV63Scan'))return;
    const type=current.type,k=current.k,isEdit=current.isEdit,recordId=current.recordId;
    if(type==='profile'){
      const p=document.getElementById('v19Profile');if(p&&!p.value.trim()&&(current.file||current.existingBlob)&&!current.remove)p.value=ONLY_SENTINEL;
    }
    const snap={type,k,isEdit,recordId,file:current.file,name:current.name,mime:current.mime,existingBlob:current.existingBlob,remove:current.remove,beforeIds:new Set(current.beforeIds),shadText:String(document.getElementById('pmV63ShadProfile')?.value||'').trim()};
    setTimeout(()=>persistPending(snap),40);
  },true);

  window.addEventListener('change',e=>{
    const inp=e.target;if(inp?.id!=='v19MediaInput')return;const f=inp.files?.[0];if(!f)return;
    const p=document.getElementById('v19Profile');if(!p||p.value.trim())return;
    const copy=f;setTimeout(async()=>{setStatus('Reading screenshot…');try{const t=await ocrImage(copy,'Reading screenshot');if(t){applyExtracted(t,'profile');setStatus('Screenshot text found. Empty fields were filled; review before saving.');}else setStatus('No readable text found in the screenshot.');}catch(err){console.warn('PeerMatch screenshot OCR',err);setStatus('Could not read screenshot text. The screenshot can still be saved.');}},0);
  },true);

  function typeOf(x){
    const n=String(x?.profileAttachmentName||'').toLowerCase(),t=String(x?.profileAttachmentType||x?.profileAttachment?.type||'').toLowerCase();
    if(t.includes('pdf')||n.endsWith('.pdf'))return'application/pdf';
    if(t.startsWith('image/'))return t;
    if(/\.png$/i.test(n))return'image/png';if(/\.jpe?g$/i.test(n))return'image/jpeg';if(/\.webp$/i.test(n))return'image/webp';if(/\.gif$/i.test(n))return'image/gif';
    return t||'application/octet-stream';
  }
  function blobOf(x){const b=x?.profileAttachment;if(!(b instanceof Blob))return null;const t=typeOf(x);try{return String(b.type||'').toLowerCase()===t?b:new Blob([b],{type:t});}catch(_){return b;}}
  let viewerImageUrl=null;
  function closeAttachmentViewer(){document.getElementById('pmAttachmentViewer')?.remove();if(viewerImageUrl){URL.revokeObjectURL(viewerImageUrl);viewerImageUrl=null;}}

  /* Hand the attachment to the OS: Web Share (with the real file, so Android offers
     PDF-capable apps) first, a named download as fallback. Never window.open a blob:
     URL or navigate the tab to one — that is the behavior that fails on-device. */
  async function shareOrDownloadAttachment(x,blob,type){
    const name=x.profileAttachmentName||'profile-attachment';
    let f=null;try{f=new File([blob],name,{type});}catch(_){ }
    if(f&&navigator.share&&(!navigator.canShare||navigator.canShare({files:[f]}))){
      try{await navigator.share({files:[f],title:name});return;}
      catch(e){if(e?.name==='AbortError')return;}
    }
    try{
      const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),60000);
    }catch(e){console.warn('PeerMatch attachment handoff',e);alert('Could not open or download this attachment on this device.');}
  }

  async function openPmAttachment(x){
    const blob=blobOf(x);if(!blob)return alert('This attachment is no longer available.');
    closeAttachmentViewer();
    const type=typeOf(x);
    if(!type.startsWith('image/')){
      /* PDFs (and any other non-image attachment): no in-app renderer. An in-app PDF.js
         viewer previously failed on the user's Android/PWA setup. PDF.js remains in this
         file only for text extraction when a PDF is attached, not for opening one. */
      await shareOrDownloadAttachment(x,blob,type);
      return;
    }
    const d=document.createElement('div');d.id='pmAttachmentViewer';d.style.cssText='position:fixed;inset:0;z-index:60000;background:#eef1f3;display:flex;flex-direction:column';
    d.innerHTML='<div style="display:flex;gap:7px;align-items:center;padding:9px;background:#fff;border-bottom:1px solid #d9e0e4"><div id="pmAttachmentViewerTitle" style="flex:1;min-width:0;font-size:12px;font-weight:850;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"></div><button id="pmAttachmentViewerSave" class="secondary" type="button">Share / save</button><button id="pmAttachmentViewerClose" class="primary" type="button">Close</button></div><div id="pmAttachmentViewerBody" style="flex:1;min-height:0;overflow:auto;padding:9px"></div>';
    d.querySelector('#pmAttachmentViewerTitle').textContent=x.profileAttachmentName||'Profile attachment';
    document.body.appendChild(d);
    d.querySelector('#pmAttachmentViewerClose').onclick=closeAttachmentViewer;
    d.querySelector('#pmAttachmentViewerSave').onclick=()=>shareOrDownloadAttachment(x,blob,type);
    const body=d.querySelector('#pmAttachmentViewerBody');
    const u=URL.createObjectURL(blob);viewerImageUrl=u;const img=document.createElement('img');img.src=u;img.style.cssText='display:block;max-width:100%;max-height:100%;margin:auto;object-fit:contain';body.appendChild(img);
  }

  function detailAttachment(x,isShad){
    const sheet=document.getElementById('sheet');if(!sheet||!x?.profileAttachment)return;if(sheet.querySelector('.pmAttachmentBox,.pmV63Attachment'))return;
    const label=typeOf(x)==='application/pdf'?'Open PDF':'Open attachment';
    const d=document.createElement('div');d.className='pmV63Attachment';d.innerHTML=`<div class="small">Profile attachment</div><div>${safe(x.profileAttachmentName||'Attached profile')}</div><button type="button" class="secondary">${safe(label)}</button>`;
    d.querySelector('button').onclick=e=>{e.preventDefault();openPmAttachment(x);};
    if(isShad){
      const anchor=sheet.querySelector('.sectionTitle')||sheet.querySelector('#v19EditProfile')||sheet.querySelector('.v19Contact');
      anchor?.insertAdjacentElement('beforebegin',d);
      return;
    }
    /* Guy/Girl detail: attachment is the single source of truth for its own placement — directly
       after the profile text (or the audio profile, when present), never near the header/Edit
       button. Do not add a second script that repositions this element after the fact. */
    const anchor=sheet.querySelector('.v19ProfileAudio')||sheet.querySelector('.card > .profileText')?.closest('.card')||sheet.querySelector('.v19Head');
    anchor?.insertAdjacentElement('afterend',d);
  }
  function shadDetail(id){
    const x=(data.shadchanim||[]).find(z=>String(z.id)===String(id)),sheet=document.getElementById('sheet');if(!x||!sheet)return;
    if(x.profileText&&!sheet.querySelector('.pmV63ProfileCard')){const d=document.createElement('div');d.className='pmV63ProfileCard';d.innerHTML=`<div class="small">Shadchan profile / notes</div>${safe(x.profileText)}`;(sheet.querySelector('.pmInlineTools')||sheet.querySelector('.v19Contact')||sheet.querySelector('.v19ShadHead'))?.insertAdjacentElement('afterend',d);}
    detailAttachment(x,true);
  }
  function profileDetail(k,id){const x=(data[k]||[]).find(z=>String(z.id)===String(id));if(x)detailAttachment(x,false);}

  const priorOpenP=window.openP;if(typeof priorOpenP==='function')window.openP=function(k,id){activeProfile={k,id};const r=priorOpenP(k,id);setTimeout(()=>profileDetail(k,id),30);return r;};
  const priorOpenS=window.openS;if(typeof priorOpenS==='function')window.openS=function(id){activeShad=id;const r=priorOpenS(id);setTimeout(()=>shadDetail(id),30);return r;};

  function schedule(){if(decorateQueued)return;decorateQueued=true;requestAnimationFrame(()=>{decorateQueued=false;decorateForm();});}
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
  schedule();
})();
