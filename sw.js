const VERSION='111';
const CACHE='peermatch-v'+VERSION;
const SCRIPTS=[
  'whatsapp-enhance.js','peermatch-v11.js','ui-v18.js','peermatch-v19.js','audio-v24.js','send-match-v27.js','make-match-v32.js','match-text-required-v33.js','match-photo-option-v34.js','make-match-v35-ui.js','backup-v28.js','history-delete-v30.js','history-composer-v36.js','sender-fields-v39.js','profile-contact-v40.js','profile-required-v44.js','feature-request-v46.js','profile-display-v48.js','email-photo-v51.js','final-fixes-v107.js','profile-share-v52.js','shadchan-share-v55.js','selection-layout-v54.js','contact-actions-v56.js','make-match-v60-ui.js','whatsapp-import-v61.js','profile-tools-v62.js','profile-pdf-ocr-v63.js','phone-links-v64.js','ux-v65.js','ux-v65-fix.js','forms-v65.js','link-recovery-v65.js','translate-v65.js','make-match-v65-fix.js','waiting-v65.js','attachment-v66.js','tags-v68.js','phone-ui-v69.js','link-context-v71.js','ui-fixes-v73.js','profile-contact-v74.js','linked-shadchan-v75.js','shadchan-layout-v76.js','edit-buttons-v77.js','contact-inline-v79.js','reverse-links-v80.js','girl-photo-v83.js','attachment-choice-v84.js','profile-under-layout-v85.js','form-order-v86.js','selection-sms-fix-v87.js','profile-waiting-list-v89.js','detail-controls-v91.js','inline-phone-actions-v92.js','stable-details-v93.js','shadchan-referral-v95.js','profile-contacts-v96.js','history-recipient-v96.js','referred-group-style-v98.js','referred-group-style-v99.js','dual-share-history-v100.js','referred-group-style-v101.js','workflow-v103.js','contact-phone-fix-v105.js','added-date-v109.js'
];
const SHELL=['./','./index.html','./manifest.webmanifest','./icon.svg',...SCRIPTS.map(x=>'./'+x)];

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate',e=>{
  e.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)));
    await self.clients.claim();
    const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    await Promise.all(clients.map(c=>{
      try{
        const u=new URL(c.url);
        u.searchParams.set('pmv',VERSION);
        return c.navigate(u.href).catch(()=>{});
      }catch(err){return c.navigate(c.url).catch(()=>{});}
    }));
  })());
});

function openDB(){
  return new Promise((resolve,reject)=>{
    const r=indexedDB.open('PeerMatchDB',2);
    r.onupgradeneeded=()=>{
      const d=r.result;
      if(!d.objectStoreNames.contains('kv'))d.createObjectStore('kv');
      if(!d.objectStoreNames.contains('inbox'))d.createObjectStore('inbox');
    };
    r.onsuccess=()=>resolve(r.result);
    r.onerror=()=>reject(r.error);
  });
}

async function saveShare(req){
  const f=await req.formData();
  const files=f.getAll('files').filter(Boolean);
  const d=await openDB();
  await new Promise((resolve,reject)=>{
    const tx=d.transaction('inbox','readwrite');
    tx.objectStore('inbox').put({title:String(f.get('title')||''),text:String(f.get('text')||''),url:String(f.get('url')||''),files,ts:Date.now()},'pending');
    tx.oncomplete=resolve;
    tx.onerror=()=>reject(tx.error);
  });
}

async function withEnhancer(response){
  const text=await response.text();let html=text;
  for(const name of SCRIPTS){if(!html.includes(name))html=html.replace('</body>',`<script src="./${name}?v=${VERSION}"></script></body>`);}
  const headers=new Headers(response.headers);headers.set('content-type','text/html; charset=utf-8');headers.delete('content-length');
  return new Response(html,{status:response.status,statusText:response.statusText,headers});
}

self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(e.request.method==='POST'&&u.pathname.endsWith('/share-target')){
    e.respondWith((async()=>{try{await saveShare(e.request);return Response.redirect(`./?pmv=${VERSION}&shared=1`,303);}catch(err){return new Response('Import failed',{status:500});}})());return;
  }
  if(e.request.method!=='GET')return;
  if(e.request.mode==='navigate'){
    e.respondWith((async()=>{let r;try{r=await fetch(e.request,{cache:'no-store'});if(r.ok){const c=await caches.open(CACHE);c.put('./index.html',r.clone());}}catch(err){r=await caches.match('./index.html')||await caches.match('./');}return r?withEnhancer(r):new Response('PeerMatch is unavailable offline.',{status:503});})());return;
  }
  e.respondWith((async()=>{try{const r=await fetch(e.request,{cache:'no-store'});if(r.ok){const c=await caches.open(CACHE);c.put(e.request,r.clone());}return r;}catch(err){return(await caches.match(e.request))||new Response('',{status:504});}})());
});