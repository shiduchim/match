/* PeerMatch screenshot profile import.
   Lets the user choose a screenshot from SMS, email, WhatsApp, etc.,
   extracts English/Hebrew text in the browser, previews it, then sends
   it into the normal Guy/Girl profile form. */
(function(){
  const TESSERACT_URL='https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
  let workerPromise=null;

  const style=document.createElement('style');
  style.textContent=`
    .pmImportShotRow{margin:7px 0 3px}
    .pmImportShot{width:100%;padding:11px 14px;background:#f7f8f9;color:var(--text);border:1px solid #dde2e5}
    .pmOcrStatus{font-size:13px;color:var(--muted);margin:9px 0;line-height:1.4}
    .pmShotPreview{display:block;max-width:100%;max-height:250px;object-fit:contain;margin:9px auto;border-radius:12px;border:1px solid var(--line);background:#f5f5f5}
    .pmOcrText{min-height:190px}
    .pmOcrActions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}
  `;
  document.head.appendChild(style);

  function loadTesseract(){
    if(window.Tesseract)return Promise.resolve(window.Tesseract);
    return new Promise((resolve,reject)=>{
      const existing=document.querySelector('script[data-peermatch-tesseract]');
      if(existing){
        const wait=()=>window.Tesseract?resolve(window.Tesseract):setTimeout(wait,80);
        wait();return;
      }
      const s=document.createElement('script');
      s.src=TESSERACT_URL;s.async=true;s.dataset.peermatchTesseract='1';
      s.onload=()=>window.Tesseract?resolve(window.Tesseract):reject(new Error('OCR library did not load'));
      s.onerror=()=>reject(new Error('Could not load OCR library. Check your internet connection.'));
      document.head.appendChild(s);
    });
  }

  async function getWorker(status){
    if(!workerPromise){
      workerPromise=(async()=>{
        status('Preparing text reader… The first screenshot can take a little longer.');
        const T=await loadTesseract();
        return await T.createWorker('eng+heb');
      })().catch(err=>{workerPromise=null;throw err;});
    }
    return workerPromise;
  }

  async function nativeOCR(file){
    if(!('TextDetector' in window))return '';
    try{
      const bitmap=await createImageBitmap(file);
      const blocks=await new TextDetector().detect(bitmap);
      bitmap.close?.();
      return (blocks||[]).map(b=>b.rawValue||'').filter(Boolean).join('\n').trim();
    }catch(e){return '';}
  }

  async function readScreenshot(file,status){
    const native=await nativeOCR(file);
    if(native)return native;
    const worker=await getWorker(status);
    status('Reading screenshot…');
    const result=await worker.recognize(file);
    return String(result?.data?.text||'').trim();
  }

  function previewImport(k,file,text){
    const who=k==='guys'?'Guy':'Girl';
    const imgUrl=URL.createObjectURL(file);
    open(`<h2>Import ${who} from screenshot</h2>
      <div class="small">Check the text below. You can fix anything before continuing.</div>
      <img class="pmShotPreview" id="pmShotPreview" src="${imgUrl}" alt="Selected screenshot">
      <label>Profile text<textarea id="pmOcrText" class="pmOcrText">${esc(text)}</textarea></label>
      <button id="pmOcrUse" class="primary full">Use this profile</button><div class="gap"></div>
      <button id="pmOcrCancel" class="secondary full">Cancel</button>`);
    $('pmOcrUse').onclick=()=>{
      const t=$('pmOcrText').value.trim();
      if(!t)return alert('No profile text was found. Type or paste the profile text first.');
      URL.revokeObjectURL(imgUrl);
      addP(k,{text:t,photo:file});
    };
    $('pmOcrCancel').onclick=()=>{URL.revokeObjectURL(imgUrl);close();};
  }

  function chooseScreenshot(k){
    const input=document.createElement('input');
    input.type='file';input.accept='image/*';
    input.onchange=async()=>{
      const file=input.files?.[0];if(!file)return;
      open(`<h2>Reading screenshot</h2><div id="pmOcrStatus" class="pmOcrStatus">Opening image…</div><div class="card"><div class="small">The screenshot is processed in your browser. PeerMatch does not upload the profile image to its own server.</div></div><button id="pmOcrStop" class="secondary full">Cancel</button>`);
      let cancelled=false;
      $('pmOcrStop').onclick=()=>{cancelled=true;close();};
      const status=t=>{const el=document.getElementById('pmOcrStatus');if(el)el.textContent=t;};
      try{
        const text=await readScreenshot(file,status);
        if(cancelled)return;
        if(!text){
          status('I could not read text from this screenshot. Try a clearer crop, or continue by typing/pasting the profile.');
          const btn=document.getElementById('pmOcrStop');if(btn)btn.textContent='Close';
          return;
        }
        previewImport(k,file,text);
      }catch(err){
        if(cancelled)return;
        status('Could not read the screenshot: '+(err?.message||'OCR failed'));
        const btn=document.getElementById('pmOcrStop');if(btn)btn.textContent='Close';
      }
    };
    input.click();
  }

  function addButton(k){
    const section=document.getElementById(k+'Section');
    const search=document.getElementById(k+'Search');
    if(!section||!search||document.getElementById('pmImportShot-'+k))return;
    const row=document.createElement('div');
    row.id='pmImportShotRow-'+k;row.className='pmImportShotRow';
    row.innerHTML=`<button id="pmImportShot-${k}" class="pmImportShot">📷 Import screenshot</button>`;
    search.insertAdjacentElement('afterend',row);
    document.getElementById('pmImportShot-'+k).onclick=()=>chooseScreenshot(k);
  }

  function init(){
    try{addButton('guys');addButton('girls');}catch(e){console.warn('Screenshot import init',e);}
  }

  new MutationObserver(init).observe(document.body,{childList:true,subtree:true});
  setTimeout(init,1000);
})();
