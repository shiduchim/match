/* PeerMatch v106: stop legacy blob-tab PDF opening and render saved attachments inside PeerMatch. */
(function(){
  document.documentElement.dataset.peerMatchVersion='106';
  const PDF_JS='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  const PDF_WORKER='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  let activeProfile=null,activeShad=null,pdfLoad=null,queued=false;

  const style=document.createElement('style');
  style.textContent=`
    .pmV106Viewer{position:fixed;inset:0;z-index:50000;background:#eef1f3;display:flex;flex-direction:column}
    .pmV106ViewerTop{display:flex;align-items:center;gap:7px;padding:max(8px,env(safe-area-inset-top)) 9px 8px;background:#fff;border-bottom:1px solid #d9e0e4}
    .pmV106ViewerTitle{flex:1;min-width:0;font-size:12px;font-weight:850;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#19324a}
    .pmV106ViewerTop button{padding:8px 10px!important;border-radius:9px!important;font-size:10.5px!important}
    .pmV106ViewerBody{flex:1;min-height:0;overflow:auto;padding:9px}
    .pmV106ViewerBody canvas{display:block;max-width:100%;height:auto;margin:0 auto 10px;background:#fff;box-shadow:0 1px 6px rgba(0,0,0,.14)}
    .pmV106ViewerMsg{text-align:center;color:#73818b;font-size:12px;padding:24px 10px}
    .pmV106ViewerBody img{display:block;max-width:100%;max-height:100%;margin:auto;object-fit:contain}
  `;
  document.head.appendChild(style);

  const rec=(k,id)=>(data[k]||[]).find(x=>String(x.id)===String(id))||null;
  function current(){if(activeProfile)return rec(activeProfile.k,activeProfile.id);if(activeShad!=null)return rec('shadchanim',activeShad);return null;}
  function typeOf(x){
    const n=String(x?.profileAttachmentName||'').toLowerCase(),t=String(x?.profileAttachmentType||x?.profileAttachment?.type||'').toLowerCase();
    if(t.includes('pdf')||n.endsWith('.pdf'))return'application/pdf';
    if(t.startsWith('image/'))return t;
    if(/\.png$/i.test(n))return'image/png';if(/\.jpe?g$/i.test(n))return'image/jpeg';if(/\.webp$/i.test(n))return'image/webp';if(/\.gif$/i.test(n))return'image/gif';
    return t||'application/octet-stream';
  }
  function blobOf(x){
    const b=x?.profileAttachment;if(!(b instanceof Blob))return null;const t=typeOf(x);
    if(String(b.type||'').toLowerCase()===t)return b;
    try{return new Blob([b],{type:t});}catch(_){return b;}
  }
  function closeViewer(){const d=document.getElementById('pmV106Viewer');if(!d)return;const u=d.dataset.objectUrl;if(u)try{URL.revokeObjectURL(u);}catch(_){ }d.remove();}
  function shell(x){
    closeViewer();const d=document.createElement('div');d.id='pmV106Viewer';d.className='pmV106Viewer';
    d.innerHTML='<div class="pmV106ViewerTop"><div class="pmV106ViewerTitle"></div><button id="pmV106Share" class="secondary" type="button">Share / save</button><button id="pmV106Close" class="primary" type="button">Close</button></div><div class="pmV106ViewerBody"><div class="pmV106ViewerMsg">Opening attachment…</div></div>';
    d.querySelector('.pmV106ViewerTitle').textContent=x.profileAttachmentName||'Profile attachment';d.querySelector('#pmV106Close').onclick=closeViewer;document.body.appendChild(d);return d;
  }
  async function pdfLib(){
    if(window.pdfjsLib){window.pdfjsLib.GlobalWorkerOptions.workerSrc=PDF_WORKER;return window.pdfjsLib;}
    if(pdfLoad)return pdfLoad;
    pdfLoad=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=PDF_JS;s.async=true;s.crossOrigin='anonymous';s.onload=()=>{if(!window.pdfjsLib)return reject(new Error('PDF viewer did not load'));window.pdfjsLib.GlobalWorkerOptions.workerSrc=PDF_WORKER;resolve(window.pdfjsLib);};s.onerror=()=>reject(new Error('PDF viewer did not load'));document.head.appendChild(s);});
    return pdfLoad;
  }
  async function shareOrSave(blob,x){
    const name=x.profileAttachmentName||'profile.pdf',type=typeOf(x);let f=null;try{f=new File([blob],name,{type});}catch(_){ }
    if(f&&navigator.share&&(!navigator.canShare||navigator.canShare({files:[f]}))){try{await navigator.share({files:[f],title:name});return;}catch(e){if(e?.name==='AbortError')return;}}
    const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),60000);
  }
  async function openAttachment(x){
    const blob=blobOf(x);if(!blob)return alert('This attachment is no longer available.');
    const d=shell(x),body=d.querySelector('.pmV106ViewerBody');d.querySelector('#pmV106Share').onclick=()=>shareOrSave(blob,x);const type=typeOf(x);
    if(type.startsWith('image/')){const u=URL.createObjectURL(blob);d.dataset.objectUrl=u;body.innerHTML='';const img=document.createElement('img');img.src=u;img.alt=x.profileAttachmentName||'Profile image';body.appendChild(img);return;}
    if(type!=='application/pdf'){body.innerHTML='<div class="pmV106ViewerMsg">This file cannot be previewed here. Use Share / save.</div>';return;}
    try{
      const P=await pdfLib(),bytes=new Uint8Array(await blob.arrayBuffer()),pdf=await P.getDocument({data:bytes}).promise;body.innerHTML='';
      const max=Math.max(280,Math.min(window.innerWidth-18,900));
      for(let i=1;i<=pdf.numPages;i++){
        const page=await pdf.getPage(i),base=page.getViewport({scale:1}),scale=Math.max(.55,Math.min(1.8,max/base.width)),vp=page.getViewport({scale});
        const c=document.createElement('canvas');c.width=Math.ceil(vp.width);c.height=Math.ceil(vp.height);c.style.width=Math.ceil(vp.width)+'px';c.style.height=Math.ceil(vp.height)+'px';body.appendChild(c);await page.render({canvasContext:c.getContext('2d',{alpha:false}),viewport:vp}).promise;
      }
    }catch(e){console.warn('PeerMatch v106 PDF viewer',e);body.innerHTML='<div class="pmV106ViewerMsg">PeerMatch could not display this PDF. Use Share / save to open it with another app.</div>';}
  }

  function polish(){
    const x=current(),box=document.querySelector('#sheet .pmV63Attachment');if(!x?.profileAttachment||!box)return;const b=box.querySelector('button');if(b)b.textContent=typeOf(x)==='application/pdf'?'Open PDF':'Open attachment';
  }
  document.addEventListener('click',e=>{
    const b=e.target.closest?.('#sheet .pmV63Attachment button');if(!b)return;const x=current();if(!x?.profileAttachment)return;
    e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();openAttachment(x);
  },true);

  const priorP=window.openP;if(typeof priorP==='function')window.openP=function(k,id){activeProfile={k,id};activeShad=null;const r=priorP(k,id);setTimeout(polish,80);return r;};
  const priorS=window.openS;if(typeof priorS==='function')window.openS=function(id){activeShad=id;activeProfile=null;const r=priorS(id);setTimeout(polish,80);return r;};
  function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;polish();});}
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});schedule();
})();