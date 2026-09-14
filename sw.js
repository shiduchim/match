const CACHE='peermatch-v8';
const SHELL=['./','./index.html','./manifest.webmanifest','./icon.svg','./whatsapp-enhance.js','./profile-tools.js','./guided-voice.js'];

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
    await Promise.all(clients.map(c=>c.navigate(c.url).catch(()=>{})));
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
  if(!html.includes('whatsapp-enhance.js')) html=html.replace('</body>','<script src="./whatsapp-enhance.js?v=8"></script></body>');
  if(!html.includes('profile-tools.js')) html=html.replace('</body>','<script src="./profile-tools.js?v=8"></script></body>');
  if(!html.includes('guided-voice.js')) html=html.replace('</body>','<script src="./guided-voice.js?v=8"></script></body>');
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
        return Response.redirect('./?shared=1',303);
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
