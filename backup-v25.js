/* PeerMatch v25: full local database backup, including Blob/File media. */
(function(){
  const style=document.createElement('style');
  style.textContent=`
    .pmBackupTop{position:absolute;right:11px;top:54px;border:0;background:transparent;color:var(--muted);padding:2px 3px;border-radius:5px;font-size:10px;font-weight:700;line-height:1.1;text-decoration:underline;text-underline-offset:2px}
    header.pmMatchHeader{min-height:88px}
    @media(max-width:390px){.pmBackupTop{right:9px}}
  `;
  document.head.appendChild(style);

  function readStore(db,storeName){
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(storeName,'readonly');
      const store=tx.objectStore(storeName);
      const keysReq=store.getAllKeys();
      const valsReq=store.getAll();
      tx.oncomplete=()=>resolve({keys:keysReq.result||[],values:valsReq.result||[]});
      tx.onerror=()=>reject(tx.error||new Error('Could not read '+storeName));
      tx.onabort=()=>reject(tx.error||new Error('Could not read '+storeName));
    });
  }

  function blobToDataURL(blob){
    return new Promise((resolve,reject)=>{
      const r=new FileReader();
      r.onload=()=>resolve(String(r.result||''));
      r.onerror=()=>reject(r.error||new Error('Could not read media file'));
      r.readAsDataURL(blob);
    });
  }

  async function encode(value,seen){
    if(value==null||typeof value==='string'||typeof value==='number'||typeof value==='boolean')return value;
    if(value instanceof Blob){
      return {
        __peerMatchBlob:1,
        type:value.type||'application/octet-stream',
        size:value.size||0,
        name:(typeof File!=='undefined'&&value instanceof File)?value.name:'',
        lastModified:(typeof File!=='undefined'&&value instanceof File)?value.lastModified:0,
        data:await blobToDataURL(value)
      };
    }
    if(value instanceof Date)return{__peerMatchDate:1,value:value.toISOString()};
    if(Array.isArray(value)){
      const out=[];
      for(const v of value)out.push(await encode(v,seen));
      return out;
    }
    if(typeof value==='object'){
      if(seen.has(value))return null;
      seen.add(value);
      const out={};
      for(const [k,v] of Object.entries(value))out[k]=await encode(v,seen);
      seen.delete(value);
      return out;
    }
    return null;
  }

  async function buildBackup(){
    const d=await db();
    const stores={};
    for(const name of Array.from(d.objectStoreNames)){
      const raw=await readStore(d,name);
      const entries=[];
      for(let i=0;i<raw.keys.length;i++)entries.push({key:await encode(raw.keys[i],new WeakSet()),value:await encode(raw.values[i],new WeakSet())});
      stores[name]=entries;
    }
    return {
      format:'PeerMatchBackup',
      version:1,
      appVersion:document.documentElement.dataset.peerMatchVersion||'',
      createdAt:new Date().toISOString(),
      database:'PeerMatchDB',
      databaseVersion:2,
      stores
    };
  }

  function filename(){
    const d=new Date(),p=n=>String(n).padStart(2,'0');
    return `PeerMatch-backup-${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}.json`;
  }

  async function downloadBackup(button){
    const old=button.textContent;
    button.disabled=true;
    button.textContent='Saving…';
    try{
      const backup=await buildBackup();
      const json=JSON.stringify(backup);
      const blob=new Blob([json],{type:'application/json'});
      const u=URL.createObjectURL(blob);
      const a=document.createElement('a');
      a.href=u;
      a.download=filename();
      a.style.display='none';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(()=>URL.revokeObjectURL(u),30000);
      button.textContent='Saved';
      setTimeout(()=>{button.textContent=old;button.disabled=false;},1800);
    }catch(e){
      console.warn('PeerMatch backup failed',e);
      button.textContent=old;
      button.disabled=false;
      alert('PeerMatch could not create the backup. Your existing data was not changed.');
    }
  }

  function install(){
    const header=document.querySelector('.app>header');
    if(!header||header.querySelector('.pmBackupTop'))return;
    header.classList.add('pmMatchHeader');
    const b=document.createElement('button');
    b.type='button';
    b.className='pmBackupTop';
    b.textContent='Backup';
    b.title='Save a full PeerMatch database backup';
    b.onclick=()=>downloadBackup(b);
    header.appendChild(b);
  }

  install();
  new MutationObserver(install).observe(document.body,{childList:true,subtree:true});
})();
