const CACHE='peermatch-v48';
const SHELL=['./','./index.html','./manifest.webmanifest','./icon.svg','./whatsapp-enhance.js','./peermatch-v11.js','./ui-v18.js','./peermatch-v19.js','./audio-v24.js','./send-match-v27.js','./make-match-v32.js','./match-text-required-v33.js','./match-photo-option-v34.js','./make-match-v35-ui.js','./backup-v28.js','./history-delete-v30.js','./history-composer-v36.js','./sender-fields-v39.js','./profile-contact-v40.js','./profile-required-v44.js','./feature-request-v46.js','./profile-display-v48.js'];

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
        u.searchParams.set('pmv','48');
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
    tx.objectStore('inbox').put({
      title:String(f.get('title')||''),
      text:String(f.get('text')||''),
      url:String(f.get('url')||''),
      files,
      ts:Date.now()
    },'pending');
    tx.oncomplete=resolve;
    tx.onerror=()=>reject(tx.error);
  });
}

async function withEnhancer(response){
  const text=await response.text();
  let html=text;
  if(!html.includes('whatsapp-enhance.js')) html=html.replace('</body>','<script src="./whatsapp-enhance.js?v=48"></script></body>');
  if(!html.includes('peermatch-v11.js')) html=html.replace('</body>','<script src="./peermatch-v11.js?v=48"></script></body>');
  if(!html.includes('ui-v18.js')) html=html.replace('</body>','<script src="./ui-v18.js?v=48"></script></body>');
  if(!html.includes('peermatch-v19.js')) html=html.replace('</body>','<script src="./peermatch-v19.js?v=48"></script></body>');
  if(!html.includes('audio-v24.js')) html=html.replace('</body>','<script src="./audio-v24.js?v=48"></script></body>');
  if(!html.includes('send-match-v27.js')) html=html.replace('</body>','<script src="./send-match-v27.js?v=48"></script></body>');
  if(!html.includes('make-match-v32.js')) html=html.replace('</body>','<script src="./make-match-v32.js?v=48"></script></body>');
  if(!html.includes('match-text-required-v33.js')) html=html.replace('</body>','<script src="./match-text-required-v33.js?v=48"></script></body>');
  if(!html.includes('match-photo-option-v34.js')) html=html.replace('</body>','<script src="./match-photo-option-v34.js?v=48"></script></body>');
  if(!html.includes('make-match-v35-ui.js')) html=html.replace('</body>','<script src="./make-match-v35-ui.js?v=48"></script></body>');
  if(!html.includes('backup-v28.js')) html=html.replace('</body>','<script src="./backup-v28.js?v=48"></script></body>');
  if(!html.includes('history-delete-v30.js')) html=html.replace('</body>','<script src="./history-delete-v30.js?v=48"></script></body>');
  if(!html.includes('history-composer-v36.js')) html=html.replace('</body>','<script src="./history-composer-v36.js?v=48"></script></body>');
  if(!html.includes('sender-fields-v39.js')) html=html.replace('</body>','<script src="./sender-fields-v39.js?v=48"></script></body>');
  if(!html.includes('profile-contact-v40.js')) html=html.replace('</body>','<script src="./profile-contact-v40.js?v=48"></script></body>');
  if(!html.includes('profile-required-v44.js')) html=html.replace('</body>','<script src="./profile-required-v44.js?v=48"></script></body>');
  if(!html.includes('feature-request-v46.js')) html=html.replace('</body>','<script src="./feature-request-v46.js?v=48"></script></body>');
  if(!html.includes('profile-display-v48.js')) html=html.replace('</body>','<script src="./profile-display-v48.js?v=48"></script></body>');
  const headers=new Headers(response.headers);
  headers.set('content-type','text/html; charset=utf-8');
  headers.delete('content-length');
  return new Response(html,{status:response.status,statusText:response.statusText,headers});
}

self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(e.request.method==='POST'&&u.pathname.endsWith('/share-target')){
    e.respondWith((async()=>{
      try{
        await saveShare(e.request);
        return Response.redirect('./?pmv=48&shared=1',303);
      }catch(err){
        return new Response('Import failed',{status:500});
      }
    })());
    return;
  }

  if(e.request.method!=='GET')return;

  if(e.request.mode==='navigate'){
    e.respondWith((async()=>{
      let r;
      try{
        r=await fetch(e.request,{cache:'no-store'});
        if(r.ok){const c=await caches.open(CACHE);c.put('./index.html',r.clone());}
      }catch(err){
        r=await caches.match('./index.html')||await caches.match('./');
      }
      return r?withEnhancer(r):new Response('PeerMatch is unavailable offline.',{status:503});
    })());
    return;
  }

  e.respondWith((async()=>{
    try{
      const r=await fetch(e.request,{cache:'no-store'});
      if(r.ok){const c=await caches.open(CACHE);c.put(e.request,r.clone());}
      return r;
    }catch(err){
      return (await caches.match(e.request))||new Response('',{status:504});
    }
  })());
});
