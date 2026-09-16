/* PeerMatch v104: reliable in-app viewer for saved PDF/image attachments.
   Fixes blob/new-window failures in installed Android PWA by rendering PDFs inside PeerMatch.
*/
(function(){
  document.documentElement.dataset.peerMatchVersion='104';
  const PDF_JS='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  const PDF_WORKER='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  let activeProfile=null,activeShad=null,queued=false,pdfLoad=null;

  const css=document.createElement('style');
  css.textContent=`
    .pmV104Viewer{position:fixed;inset:0;z-index:30000;background:#f3f4f5;display:flex;flex-direction:column}
    .pmV104ViewerTop{display:flex;align-items:center;gap:8px;padding:max(8px,env(safe-area-inset-top)) 10px 8px;background:#fff;border-bottom:1px solid #dfe3e6;box-shadow:0 1px 4px rgba(0,0,0,.08)}
    .pmV104ViewerTitle{min-width:0;flex:1;font-size:13px;font-weight:850;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#19324a}
    .pmV104ViewerTop button{padding:8px 11px!important;border-radius:9px!important;font-size:11px!important}
    .pmV104ViewerBody{flex:1;min-height:0;overflow:auto;padding:10px}
    .pmV104Status{text-align:center;color:#73818b;font-size:12px;padding:18px 8px}
    .pmV104PdfPage{display:block;margin:0 auto 12px;background:#fff;box-shadow:0 1px 7px rgba(0,0,0,.14);max-width:100%;height:auto}
    .pmV104Image{display:block;max-width:100%;max-height:calc(100vh - 80px);object-fit:contain;margin:auto;background:#fff}
    .pmV104Fallback{max-width:520px;margin:20px auto;background:#fff;border:1px solid #dfe3e6;border-radius:14px;padding:14px;color:#19324a}
    .pmV104Fallback button{width:100%;margin-top:8px}
  `;
  document.head.appendChild(css);

  const rec=(k,id)=>(data[k]||[]).find(x=>String(x.id)===String(id))||null;
  function mimeFor(x){
    const name=String(x?.profileAttachmentName||'').toLowerCase();
    const stored=String(x?.profileAttachmentType||x?.profileAttachment?.type||'').toLowerCase();
    if(stored.includes('pdf')||name.endsWith('.pdf'))return'application/pdf';
    if(stored.startsWith('image/'))return stored;
    if(/\.(jpe?g)$/i.test(name))return'image/jpeg';
    if(/\.png$/i.test(name))return'image/png';
    if(/\.webp$/i.test(name))return'image/webp';
    if(/\.gif$/i.test(name))return'image/gif';
    return stored||'application/octet-stream';
  }
  function normalizedBlob(x){
    const b=x?.profileAttachment;if(!(b instanceof Blob))return null;
    const type=mimeFor(x);
    if(String(b.type||'').toLowerCase()===type)return b;
    try{return new Blob([b],{type});}catch(_){return b;}
  }

  function closeViewer(){
    const v=document.getElementById('pmV104Viewer');
    if(!v)return;
    const u=v.dataset.objectUrl;if(u)try{URL.revokeObjectURL(u);}catch(_){ }
    v.remove();
  }
  function shell(name){
    closeViewer();
    const v=document.createElement('div');v.id='pmV104Viewer';v.className='pmV104Viewer';
    v.innerHTML=`<div class="pmV104ViewerTop"><div class="pmV104ViewerTitle"></div><button class="secondary" id="pmV104External" type="button">Open / save</button><button class="primary" id="pmV104Close" type="button">Close</button></div><div class="pmV104ViewerBody"><div class="pmV104Status">Opening attachment…</div></div>`;
    v.querySelector('.pmV104ViewerTitle').textContent=name||'Profile attachment';
    document.body.appendChild(v);v.querySelector('#pmV104Close').onclick=closeViewer;
    return v;
  }
  async function pdfLib(){
    if(window.pdfjsLib){window.pdfjsLib.GlobalWorkerOptions.workerSrc=PDF_WORKER;return window.pdfjsLib;}
    if(pdfLoad)return pdfLoad;
    pdfLoad=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=PDF_JS;s.async=true;s.crossOrigin='anonymous';s.onload=()=>{if(!window.pdfjsLib)return reject(new Error('PDF viewer did not load'));window.pdfjsLib.GlobalWorkerOptions.workerSrc=PDF_WORKER;resolve(window.pdfjsLib);};s.onerror=()=>reject(new Error('PDF viewer did not load'));document.head.appendChild(s);});
    return pdfLoad;
  }
  function externalOpen(blob,name,v){
    const type=blob.type||'application/octet-stream';
    let file=null;try{file=new File([blob],name||'profile-attachment',{type});}catch(_){ }
    if(file&&navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]}))){
      navigator.share({files:[file],title:name||'Profile attachment'}).catch(err=>{if(err?.name!=='AbortError')downloadBlob(blob,name,v);});
      return;
    }
    downloadBlob(blob,name,v);
  }
  function downloadBlob(blob,name,v){
    const u=URL.createObjectURL(blob);if(v)v.dataset.objectUrl=u;
    const a=document.createElement('a');a.href=u;a.download=name||'profile-attachment';a.target='_blank';a.rel='noopener';document.body.appendChild(a);a.click();a.remove();
  }
  async function showPdf(x){
    const blob=normalizedBlob(x);if(!blob)return alert('This PDF is no longer available.');
    const name=x.profileAttachmentName||'Profile.pdf',v=shell(name),body=v.querySelector('.pmV104ViewerBody');
    v.querySelector('#pmV104External').onclick=()=>externalOpen(blob,name,v);
    try{
      const lib=await pdfLib(),bytes=new Uint8Array(await blob.arrayBuffer()),pdf=await lib.getDocument({data:bytes}).promise;
      body.innerHTML='';
      const maxWidth=Math.min(window.innerWidth-20,900);
      for(let i=1;i<=pdf.numPages;i++){
        const page=await pdf.getPage(i),base=page.getViewport({scale:1});
        const scale=Math.max(.6,Math.min(1.8,maxWidth/base.width));
        const vp=page.getViewport({scale});
        const c=document.createElement('canvas');c.className='pmV104PdfPage';c.width=Math.ceil(vp.width);c.height=Math.ceil(vp.height);c.style.width=Math.ceil(vp.width)+'px';c.style.height=Math.ceil(vp.height)+'px';body.appendChild(c);
        await page.render({canvasContext:c.getContext('2d',{alpha:false}),viewport:vp}).promise;
      }
    }catch(err){
      console.warn('PeerMatch PDF viewer',err);
      body.innerHTML='<div class="pmV104Fallback"><b>PeerMatch could not display this PDF inside the app.</b><div style="margin-top:6px;font-size:12px;color:#73818b">Tap Open / save above to open it with another app or save it.</div></div>';
    }
  }
  function showImage(x){
    const blob=normalizedBlob(x);if(!blob)return alert('This image is no longer available.');
    const name=x.profileAttachmentName||'Profile image',v=shell(name),body=v.querySelector('.pmV104ViewerBody'),u=URL.createObjectURL(blob);v.dataset.objectUrl=u;
    body.innerHTML='';const img=document.createElement('img');img.className='pmV104Image';img.src=u;img.alt=name;body.appendChild(img);
    v.querySelector('#pmV104External').onclick=()=>externalOpen(blob,name,v);
  }
  function openRecord(x){
    if(!x?.profileAttachment)return alert('This attachment is no longer available.');
    const type=mimeFor(x);if(type==='application/pdf')showPdf(x);else if(type.startsWith('image/'))showImage(x);else{const blob=normalizedBlob(x);if(!blob)return alert('This attachment is no longer available.');const v=shell(x.profileAttachmentName||'Profile attachment');v.querySelector('.pmV104ViewerBody').innerHTML='<div class="pmV104Fallback">This file type cannot be previewed inside PeerMatch. Tap Open / save.</div>';v.querySelector('#pmV104External').onclick=()=>externalOpen(blob,x.profileAttachmentName||'profile-attachment',v);}
  }

  function fixButton(){
    const sheet=document.getElementById('sheet');if(!sheet)return;
    let x=null;
    if(activeProfile&&!document.getElementById('v19Profile'))x=rec(activeProfile.k,activeProfile.id);
    else if(activeShad!=null&&!document.getElementById('v19SName')&&!document.getElementById('esName')&&!document.getElementById('sn'))x=rec('shadchanim',activeShad);
    if(!x?.profileAttachment)return;
    const box=sheet.querySelector('.pmV63Attachment');if(!box)return;
    const b=box.querySelector('button');if(!b)return;
    const type=mimeFor(x);b.textContent=type==='application/pdf'?'Open PDF':'Open attachment';
    b.onclick=e=>{e.preventDefault();e.stopPropagation();openRecord(x);};
  }

  const priorP=window.openP;if(typeof priorP==='function')window.openP=function(k,id){activeProfile={k,id};activeShad=null;const r=priorP(k,id);setTimeout(fixButton,80);return r;};
  const priorS=window.openS;if(typeof priorS==='function')window.openS=function(id){activeShad=id;activeProfile=null;const r=priorS(id);setTimeout(fixButton,80);return r;};
  function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;fixButton();});}
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});schedule();
})();
