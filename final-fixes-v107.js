/* PeerMatch v107: final fixes for attachment opening, direct selected WhatsApp send, and top-right Edit. */
(function(){
  document.documentElement.dataset.peerMatchVersion='107';
  const PDF_JS='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  const PDF_WORKER='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  let activeProfile=null,activeShad=null,pdfLoad=null,queued=false,seq=0;

  const rec=(k,id)=>(data[k]||[]).find(x=>String(x.id)===String(id))||null;
  const trim=v=>String(v||'').trim();
  function currentRecord(){if(activeProfile)return rec(activeProfile.k,activeProfile.id);if(activeShad!=null)return rec('shadchanim',activeShad);return null;}
  function senderName(x){return trim(x?.sourceName||x?.source);}
  function senderPhone(x){return trim(x?.sourcePhone);}
  function profileText(x){return [x?.name||'Unnamed profile',x?.age?'Age: '+x.age:'',x?.text||'',senderName(x)?'Sent by: '+senderName(x):'',senderPhone(x)?'Sender phone: '+senderPhone(x):''].filter(Boolean).join('\n');}
  function waPhone(v){
    if(typeof window.pmWhatsAppDigits==='function'){try{return String(window.pmWhatsAppDigits(v)||'');}catch(_){ }}
    let d=String(v||'').replace(/\D/g,'');if(d.startsWith('00972'))d=d.slice(2);if(d.startsWith('0'))d='972'+d.slice(1);else if(d.length===9&&d.startsWith('5'))d='972'+d;return d;
  }

  function visible(k){
    const q=String(document.getElementById(k+'Search')?.value||'').toLowerCase();
    if(k==='shadchanim')return(data.shadchanim||[]).filter(x=>`${x.name||''} ${x.phone||''} ${x.email||''} ${x.tags||''} ${(x.activities||[]).map(a=>a.text||a.action||'').join(' ')}`.toLowerCase().includes(q));
    return(data[k]||[]).filter(x=>`${x.name||''} ${x.age||''} ${x.text||''} ${senderName(x)} ${senderPhone(x)} ${(x.activities||[]).map(a=>a.text||a.action||'').join(' ')}`.toLowerCase().includes(q));
  }
  function stampCards(k){
    const list=document.getElementById(k+'List');if(!list)return;const arr=visible(k),cards=[...list.children].filter(x=>x.classList?.contains('card'));
    cards.forEach((card,i)=>{if(arr[i])card.dataset.pmRecordId=String(arr[i].id);});
  }
  function checked(k){
    stampCards(k);const list=document.getElementById(k+'List');if(!list)return[];
    const ids=[...list.querySelectorAll('.card .pmListCheck:checked')].map(c=>c.closest('.card')?.dataset.pmRecordId).filter(Boolean);
    return ids.map(id=>rec(k,id)).filter(Boolean);
  }

  async function saveShare(k,x,sh,text){
    const ts=typeof stamp==='function'?stamp():new Date().toLocaleString(),link=`v107-${x.id}-${sh.id}-${Date.now()}-${seq++}`;
    x.activities=x.activities||[];sh.activities=sh.activities||[];
    x.activities.push({id:Date.now()*1000+(seq++%1000),type:'action',action:'Profile sent • WhatsApp',text,ts,channel:'whatsapp',recipient:trim(sh.name)||'Shadchan',recipientPhone:trim(sh.phone),recipientShadchanId:sh.id,shadchanId:sh.id,sharedProfileId:x.id,sharedProfileName:trim(x.name)||'Unnamed profile',sharedProfileKind:k,shareLinkId:link});
    sh.activities.push({id:Date.now()*1000+(seq++%1000),type:'action',action:'Profile received • WhatsApp',text,ts,channel:'whatsapp',sharedProfileId:x.id,sharedProfileName:trim(x.name)||'Unnamed profile',sharedProfileKind:k,profileId:x.id,profileName:trim(x.name)||'Unnamed profile',shareLinkId:link});
  }
  async function directWhatsApp(k){
    const shads=checked('shadchanim'),profiles=checked(k);if(shads.length!==1||!profiles.length)return false;
    const sh=shads[0],phone=waPhone(sh.phone);if(!phone){alert('The selected Shadchan needs a phone number for WhatsApp.');return true;}
    const parts=[];for(const x of profiles){const t=profileText(x);parts.push(t);await saveShare(k,x,sh,t);}
    try{await save();}catch(e){console.warn('PeerMatch v107 share history',e);}
    location.href='https://wa.me/'+phone+'?text='+encodeURIComponent(parts.join('\n\n--------------------\n\n'));
    return true;
  }

  function typeOf(x){
    const n=String(x?.profileAttachmentName||'').toLowerCase(),t=String(x?.profileAttachmentType||x?.profileAttachment?.type||'').toLowerCase();
    if(t.includes('pdf')||n.endsWith('.pdf'))return'application/pdf';
    if(t.startsWith('image/'))return t;
    if(/\.png$/i.test(n))return'image/png';if(/\.jpe?g$/i.test(n))return'image/jpeg';if(/\.webp$/i.test(n))return'image/webp';if(/\.gif$/i.test(n))return'image/gif';
    return t||'application/octet-stream';
  }
  function blobOf(x){const b=x?.profileAttachment;if(!(b instanceof Blob))return null;const t=typeOf(x);try{return String(b.type||'').toLowerCase()===t?b:new Blob([b],{type:t});}catch(_){return b;}}
  async function pdfLib(){
    if(window.pdfjsLib){window.pdfjsLib.GlobalWorkerOptions.workerSrc=PDF_WORKER;return window.pdfjsLib;}
    if(pdfLoad)return pdfLoad;
    pdfLoad=new Promise((ok,no)=>{const s=document.createElement('script');s.src=PDF_JS;s.async=true;s.crossOrigin='anonymous';s.onload=()=>{if(!window.pdfjsLib)return no(new Error('PDF viewer unavailable'));window.pdfjsLib.GlobalWorkerOptions.workerSrc=PDF_WORKER;ok(window.pdfjsLib);};s.onerror=()=>no(new Error('PDF viewer unavailable'));document.head.appendChild(s);});
    return pdfLoad;
  }
  function closeViewer(){document.getElementById('pmV107Viewer')?.remove();}
  async function openAttachment(x){
    const blob=blobOf(x);if(!blob)return alert('This attachment is no longer available.');
    closeViewer();const d=document.createElement('div');d.id='pmV107Viewer';d.style.cssText='position:fixed;inset:0;z-index:60000;background:#eef1f3;display:flex;flex-direction:column';
    d.innerHTML='<div style="display:flex;gap:7px;align-items:center;padding:9px;background:#fff;border-bottom:1px solid #d9e0e4"><div id="pmV107Title" style="flex:1;min-width:0;font-size:12px;font-weight:850;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"></div><button id="pmV107Save" class="secondary" type="button">Share / save</button><button id="pmV107Close" class="primary" type="button">Close</button></div><div id="pmV107Body" style="flex:1;min-height:0;overflow:auto;padding:9px"><div style="text-align:center;color:#73818b;padding:24px 10px">Opening attachment…</div></div>';
    d.querySelector('#pmV107Title').textContent=x.profileAttachmentName||'Profile attachment';document.body.appendChild(d);d.querySelector('#pmV107Close').onclick=closeViewer;
    d.querySelector('#pmV107Save').onclick=async()=>{const name=x.profileAttachmentName||'profile.pdf',type=typeOf(x);let f=null;try{f=new File([blob],name,{type});}catch(_){ }if(f&&navigator.share&&(!navigator.canShare||navigator.canShare({files:[f]}))){try{await navigator.share({files:[f],title:name});return;}catch(e){if(e?.name==='AbortError')return;}}const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),60000);};
    const body=d.querySelector('#pmV107Body'),type=typeOf(x);
    if(type.startsWith('image/')){const u=URL.createObjectURL(blob);body.innerHTML='';const img=document.createElement('img');img.src=u;img.style.cssText='display:block;max-width:100%;max-height:100%;margin:auto;object-fit:contain';body.appendChild(img);return;}
    if(type!=='application/pdf'){body.innerHTML='<div style="text-align:center;color:#73818b;padding:24px 10px">Use Share / save for this file type.</div>';return;}
    try{
      const P=await pdfLib(),bytes=new Uint8Array(await blob.arrayBuffer()),pdf=await P.getDocument({data:bytes}).promise;body.innerHTML='';const max=Math.max(280,Math.min(window.innerWidth-18,900));
      for(let i=1;i<=pdf.numPages;i++){const page=await pdf.getPage(i),base=page.getViewport({scale:1}),scale=Math.max(.55,Math.min(1.8,max/base.width)),vp=page.getViewport({scale}),c=document.createElement('canvas');c.width=Math.ceil(vp.width);c.height=Math.ceil(vp.height);c.style.cssText='display:block;max-width:100%;height:auto;margin:0 auto 10px;background:#fff;box-shadow:0 1px 6px rgba(0,0,0,.14)';body.appendChild(c);await page.render({canvasContext:c.getContext('2d',{alpha:false}),viewport:vp}).promise;}
    }catch(e){console.warn('PeerMatch v107 PDF viewer',e);body.innerHTML='<div style="text-align:center;color:#73818b;padding:24px 10px">Could not preview this PDF. Use Share / save.</div>';}
  }
  window.pmOpenAttachmentV107=openAttachment;

  function keepEditTop(){
    const sheet=document.getElementById('sheet'),edit=sheet?.querySelector('#v19EditProfile'),head=sheet?.querySelector('.v19Head');if(!sheet||!edit||!head||sheet.querySelector('.v19ShadHead'))return;
    let stack=head.querySelector('.pmV82EditStack');if(!stack){stack=document.createElement('div');stack.className='pmV82EditStack';const bh=document.createElement('div');bh.className='pmV82BH';bh.textContent='ב״ה';stack.appendChild(bh);head.appendChild(stack);}if(edit.parentElement!==stack)stack.appendChild(edit);edit.textContent='Edit';
  }
  function bindAttachment(){
    const x=currentRecord(),box=document.querySelector('#sheet .pmV63Attachment');if(!x?.profileAttachment||!box)return;const old=box.querySelector('button');if(!old)return;
    if(old.dataset.pmV107Bound==='1')return;const b=old.cloneNode(true);b.dataset.pmV107Bound='1';b.textContent=typeOf(x)==='application/pdf'?'Open PDF':'Open attachment';b.onclick=e=>{e.preventDefault();e.stopPropagation();openAttachment(x);};old.replaceWith(b);
  }
  function polish(){stampCards('shadchanim');stampCards('guys');stampCards('girls');keepEditTop();bindAttachment();}

  const priorP=window.openP;if(typeof priorP==='function')window.openP=function(k,id){activeProfile={k,id};activeShad=null;const r=priorP(k,id);setTimeout(polish,70);return r;};
  const priorS=window.openS;if(typeof priorS==='function')window.openS=function(id){activeShad=id;activeProfile=null;const r=priorS(id);setTimeout(polish,70);return r;};

  document.addEventListener('click',e=>{
    const wa=e.target.closest?.('button[id^="pmWhatsApp-"]');if(wa){const k=wa.id.slice('pmWhatsApp-'.length);if((k==='guys'||k==='girls')&&checked('shadchanim').length===1&&checked(k).length){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();directWhatsApp(k);return;}}
    const b=e.target.closest?.('#sheet .pmV63Attachment button');if(b){const x=currentRecord();if(x?.profileAttachment){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();openAttachment(x);}}
  },true);

  function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;polish();});}
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});schedule();setTimeout(polish,300);
})();