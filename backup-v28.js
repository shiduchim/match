/* PeerMatch v28: one-ZIP full backup/restore with preview. */
(function(){
  const BACKUP_FORMAT='PeerMatchBackup';
  const BACKUP_VERSION=2;
  const LAST_BACKUP_KEY='pmLastBackupAt';
  const te=new TextEncoder();
  const td=new TextDecoder();

  const style=document.createElement('style');
  style.textContent=`
    header.pmMatchHeader{min-height:82px!important;padding:14px 92px 12px!important;text-align:center}
    header.pmMatchHeader .brand{position:absolute;left:50%;top:11px;transform:translateX(-50%);margin:0;white-space:nowrap;text-align:center}
    header.pmMatchHeader .sub{position:absolute;left:50%;top:48px;transform:translateX(-50%);width:calc(100% - 180px);text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .pmBackupTop{position:absolute;left:11px;top:22px;border:0;background:transparent;color:var(--accent);padding:5px 3px;font-size:12px;font-weight:800;line-height:1;cursor:pointer}
    .pmSendMatchTop{right:10px!important;top:22px!important}
    .pmBH{right:12px!important;top:3px!important}
    .pmBackupCard{background:#fff;border:1px solid var(--line);border-radius:16px;padding:13px;margin:10px 0}
    .pmBackupCard button{width:100%;margin:5px 0}
    .pmBackupDate{font-size:13px;color:var(--muted);line-height:1.45;margin-top:10px}
    .pmRestoreSummary{background:#fff;border:1px solid var(--line);border-radius:16px;padding:14px;margin:10px 0;line-height:1.65}
    .pmRestoreSummary b{font-size:16px}
    .pmRestoreWarn{font-size:12px;color:#8a3c2c;line-height:1.45;margin:10px 0}
    .pmBackupProgress{font-size:12px;color:var(--muted);margin-top:8px;min-height:18px}
    @media(max-width:390px){
      header.pmMatchHeader{padding-left:78px!important;padding-right:88px!important}
      header.pmMatchHeader .brand{font-size:25px}
      header.pmMatchHeader .sub{width:calc(100% - 155px);font-size:11px}
      .pmBackupTop{left:7px;font-size:11px}.pmSendMatchTop{right:6px!important;font-size:10px!important}
    }
  `;
  document.head.appendChild(style);

  function u16(n){return new Uint8Array([n&255,(n>>>8)&255]);}
  function u32(n){return new Uint8Array([n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255]);}
  function dv16(v,o){return v.getUint16(o,true);}
  function dv32(v,o){return v.getUint32(o,true);}

  let crcTable=null;
  function makeCrcTable(){
    const t=new Uint32Array(256);
    for(let n=0;n<256;n++){
      let c=n;
      for(let k=0;k<8;k++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);
      t[n]=c>>>0;
    }
    return t;
  }
  function crc32(bytes){
    if(!crcTable)crcTable=makeCrcTable();
    let c=0xffffffff;
    for(let i=0;i<bytes.length;i++)c=crcTable[(c^bytes[i])&255]^(c>>>8);
    return (c^0xffffffff)>>>0;
  }

  function dosDateTime(date){
    const d=date||new Date();
    const year=Math.max(1980,d.getFullYear());
    const time=((d.getHours()&31)<<11)|((d.getMinutes()&63)<<5)|((Math.floor(d.getSeconds()/2))&31);
    const day=((year-1980)&127)<<9|((d.getMonth()+1)&15)<<5|(d.getDate()&31);
    return {time,date:day};
  }

  function localHeader(nameBytes,bytes,crc,when){
    const dt=dosDateTime(when);
    return new Uint8Array([
      ...u32(0x04034b50),...u16(20),...u16(0x0800),...u16(0),...u16(dt.time),...u16(dt.date),
      ...u32(crc),...u32(bytes.length),...u32(bytes.length),...u16(nameBytes.length),...u16(0),...nameBytes
    ]);
  }
  function centralHeader(nameBytes,bytes,crc,offset,when){
    const dt=dosDateTime(when);
    return new Uint8Array([
      ...u32(0x02014b50),...u16(20),...u16(20),...u16(0x0800),...u16(0),...u16(dt.time),...u16(dt.date),
      ...u32(crc),...u32(bytes.length),...u32(bytes.length),...u16(nameBytes.length),...u16(0),...u16(0),...u16(0),...u16(0),
      ...u32(0),...u32(offset),...nameBytes
    ]);
  }

  function makeZip(entries){
    const localParts=[],centralParts=[];
    let offset=0;
    const when=new Date();
    for(const e of entries){
      const nameBytes=te.encode(e.name);
      const bytes=e.bytes instanceof Uint8Array?e.bytes:new Uint8Array(e.bytes||0);
      if(bytes.length>0xffffffff)throw new Error('A backup file is too large for this ZIP format.');
      const crc=crc32(bytes);
      const local=localHeader(nameBytes,bytes,crc,when);
      localParts.push(local,bytes);
      centralParts.push(centralHeader(nameBytes,bytes,crc,offset,when));
      offset+=local.length+bytes.length;
      if(offset>0xffffffff)throw new Error('The backup is larger than 4 GB and cannot be created on this device.');
    }
    const centralOffset=offset;
    let centralSize=0;
    for(const p of centralParts)centralSize+=p.length;
    const eocd=new Uint8Array([
      ...u32(0x06054b50),...u16(0),...u16(0),...u16(entries.length),...u16(entries.length),
      ...u32(centralSize),...u32(centralOffset),...u16(0)
    ]);
    return new Blob([...localParts,...centralParts,eocd],{type:'application/zip'});
  }

  function parseZip(arrayBuffer){
    const bytes=new Uint8Array(arrayBuffer),view=new DataView(arrayBuffer);
    let eocd=-1;
    const min=Math.max(0,bytes.length-65557);
    for(let i=bytes.length-22;i>=min;i--){if(dv32(view,i)===0x06054b50){eocd=i;break;}}
    if(eocd<0)throw new Error('This does not look like a valid PeerMatch ZIP backup.');
    const count=dv16(view,eocd+10),centralOffset=dv32(view,eocd+16);
    let pos=centralOffset;
    const files=new Map();
    for(let n=0;n<count;n++){
      if(pos+46>bytes.length||dv32(view,pos)!==0x02014b50)throw new Error('The ZIP directory is damaged.');
      const method=dv16(view,pos+10),expectedCrc=dv32(view,pos+16),size=dv32(view,pos+20);
      const nameLen=dv16(view,pos+28),extraLen=dv16(view,pos+30),commentLen=dv16(view,pos+32),localOffset=dv32(view,pos+42);
      const name=td.decode(bytes.slice(pos+46,pos+46+nameLen));
      if(method!==0)throw new Error('This backup uses an unsupported ZIP compression method. Use the original PeerMatch backup file.');
      if(localOffset+30>bytes.length||dv32(view,localOffset)!==0x04034b50)throw new Error('The ZIP contains a damaged file entry.');
      const localNameLen=dv16(view,localOffset+26),localExtraLen=dv16(view,localOffset+28);
      const start=localOffset+30+localNameLen+localExtraLen,end=start+size;
      if(end>bytes.length)throw new Error('A file inside the ZIP is incomplete.');
      const fileBytes=bytes.slice(start,end);
      if(crc32(fileBytes)!==expectedCrc)throw new Error('A file inside the ZIP failed its integrity check.');
      files.set(name,fileBytes);
      pos+=46+nameLen+extraLen+commentLen;
    }
    return files;
  }

  function readStore(d,storeName){
    return new Promise((resolve,reject)=>{
      const tx=d.transaction(storeName,'readonly'),store=tx.objectStore(storeName);
      const kr=store.getAllKeys(),vr=store.getAll();
      tx.oncomplete=()=>resolve({keys:kr.result||[],values:vr.result||[]});
      tx.onerror=()=>reject(tx.error||new Error('Could not read '+storeName));
      tx.onabort=()=>reject(tx.error||new Error('Could not read '+storeName));
    });
  }

  function extFor(blob,name){
    const n=String(name||'');
    const m=n.match(/\.([a-z0-9]{1,8})$/i);if(m)return'.'+m[1].toLowerCase();
    const t=String(blob?.type||'').toLowerCase();
    const map={'image/jpeg':'.jpg','image/png':'.png','image/webp':'.webp','image/gif':'.gif','audio/webm':'.webm','audio/mpeg':'.mp3','audio/mp4':'.m4a','audio/ogg':'.ogg','audio/wav':'.wav','application/pdf':'.pdf','text/plain':'.txt'};
    return map[t]||'';
  }
  function cleanFileName(s){return String(s||'').replace(/[^a-z0-9._-]+/gi,'_').replace(/^_+|_+$/g,'').slice(0,80);}

  async function buildBackup(){
    const d=await db(),media=new Map(),seen=new WeakMap();
    let seq=0;
    async function encode(v,path){
      if(v==null||typeof v==='string'||typeof v==='number'||typeof v==='boolean')return v;
      if(v instanceof Blob){
        if(seen.has(v))return seen.get(v);
        const original=(typeof File!=='undefined'&&v instanceof File)?v.name:'';
        const type=String(v.type||'application/octet-stream');
        const folder=type.startsWith('image/')?'photos':type.startsWith('audio/')?'audio':'attachments';
        const base=cleanFileName(original.replace(/\.[^.]+$/,''))||String(++seq).padStart(6,'0');
        if(original)seq++;
        const zipPath=folder+'/'+String(seq).padStart(6,'0')+'_'+base+extFor(v,original);
        const ref={__peerMatchFile:1,path:zipPath,type,name:original,lastModified:(typeof File!=='undefined'&&v instanceof File)?v.lastModified:0};
        seen.set(v,ref);
        media.set(zipPath,new Uint8Array(await v.arrayBuffer()));
        return ref;
      }
      if(v instanceof Date)return{__peerMatchDate:1,value:v.toISOString()};
      if(Array.isArray(v)){
        const a=[];for(let i=0;i<v.length;i++)a.push(await encode(v[i],path+'['+i+']'));return a;
      }
      if(typeof v==='object'){
        const out={};for(const [k,val] of Object.entries(v))out[k]=await encode(val,path+'.'+k);return out;
      }
      return null;
    }

    const stores={};
    for(const name of Array.from(d.objectStoreNames)){
      const raw=await readStore(d,name),entries=[];
      for(let i=0;i<raw.keys.length;i++)entries.push({key:await encode(raw.keys[i],name+'.key'),value:await encode(raw.values[i],name+'.value')});
      stores[name]=entries;
    }
    const state=(data&&typeof data==='object')?data:{shadchanim:[],guys:[],girls:[]};
    const counts={
      shadchanim:(state.shadchanim||[]).length,
      guys:(state.guys||[]).length,
      girls:(state.girls||[]).length,
      notes:[...(state.shadchanim||[]),...(state.guys||[]),...(state.girls||[])].reduce((n,x)=>n+(x.activities||[]).length,0)
    };
    const manifest={format:BACKUP_FORMAT,version:BACKUP_VERSION,createdAt:new Date().toISOString(),appVersion:document.documentElement.dataset.peerMatchVersion||'',database:'PeerMatchDB',databaseVersion:2,counts,stores};
    const files=[
      {name:'data.json',bytes:te.encode(JSON.stringify(manifest,null,2))},
      {name:'photos/.keep',bytes:new Uint8Array(0)},
      {name:'audio/.keep',bytes:new Uint8Array(0)},
      {name:'attachments/.keep',bytes:new Uint8Array(0)}
    ];
    for(const [name,bytes] of media)files.push({name,bytes});
    return {zip:makeZip(files),manifest};
  }

  function dateName(d){const p=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;}
  function backupFilename(){return 'PeerMatch_Backup_'+dateName(new Date())+'.zip';}
  function formatDate(iso){
    if(!iso)return'Never';
    const d=new Date(iso);if(Number.isNaN(d.getTime()))return'Never';
    return d.toLocaleString([],{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
  }

  async function decode(v,files){
    if(v==null||typeof v==='string'||typeof v==='number'||typeof v==='boolean')return v;
    if(Array.isArray(v)){const a=[];for(const x of v)a.push(await decode(x,files));return a;}
    if(typeof v==='object'&&v.__peerMatchFile){
      const bytes=files.get(v.path);if(!bytes)throw new Error('The backup is missing '+v.path+'.');
      const opts={type:v.type||'application/octet-stream'};
      if(v.name&&typeof File!=='undefined'){
        try{return new File([bytes],v.name,{...opts,lastModified:v.lastModified||Date.now()});}catch(e){}
      }
      return new Blob([bytes],opts);
    }
    if(typeof v==='object'&&v.__peerMatchDate)return new Date(v.value);
    if(typeof v==='object'){
      const out={};for(const [k,val] of Object.entries(v))out[k]=await decode(val,files);return out;
    }
    return v;
  }

  async function restoreManifest(manifest,files,button){
    button.disabled=true;button.textContent='Restoring…';
    try{
      const d=await db(),existing=Array.from(d.objectStoreNames),backupStores=Object.keys(manifest.stores||{});
      const missing=backupStores.filter(n=>!existing.includes(n));
      if(missing.length)throw new Error('This backup needs a newer PeerMatch database: '+missing.join(', '));
      const decoded={};
      for(const name of backupStores){
        decoded[name]=[];
        for(const entry of manifest.stores[name]||[])decoded[name].push({key:await decode(entry.key,files),value:await decode(entry.value,files)});
      }
      await new Promise((resolve,reject)=>{
        const tx=d.transaction(existing,'readwrite');
        for(const name of existing)tx.objectStore(name).clear();
        for(const name of backupStores){
          const s=tx.objectStore(name);
          for(const e of decoded[name])s.put(e.value,e.key);
        }
        tx.oncomplete=resolve;
        tx.onerror=()=>reject(tx.error||new Error('Restore failed'));
        tx.onabort=()=>reject(tx.error||new Error('Restore failed'));
      });
      alert('PeerMatch backup restored successfully. The app will reload now.');
      location.reload();
    }catch(e){
      console.warn('PeerMatch restore failed',e);
      button.disabled=false;button.textContent='Restore';
      alert('Restore was not completed. Your existing PeerMatch data was left unchanged.\n\n'+(e.message||e));
    }
  }

  function showRestorePreview(manifest,files){
    const c=manifest.counts||{};
    open(`<h2>Restore Backup</h2>
      <div class="pmRestoreSummary"><b>Backup from ${esc(formatDate(manifest.createdAt))}</b><br><br>
      ${Number(c.shadchanim||0)} shadchanim<br>
      ${Number(c.guys||0)} guys<br>
      ${Number(c.girls||0)} girls<br>
      ${Number(c.notes||0)} notes
      </div>
      <div class="pmRestoreWarn">Restoring will replace the current PeerMatch database on this device with the contents of this backup.</div>
      <button id="pmRestoreConfirm" class="primary full">Restore</button><div class="gap"></div>
      <button id="pmRestoreCancel" class="secondary full">Cancel</button>`);
    document.getElementById('pmRestoreConfirm').onclick=e=>restoreManifest(manifest,files,e.currentTarget);
    document.getElementById('pmRestoreCancel').onclick=close;
  }

  async function inspectBackup(file){
    const files=parseZip(await file.arrayBuffer());
    const raw=files.get('data.json');if(!raw)throw new Error('data.json is missing from this ZIP.');
    let manifest;try{manifest=JSON.parse(td.decode(raw));}catch(e){throw new Error('data.json is not valid.');}
    if(manifest?.format!==BACKUP_FORMAT)throw new Error('This is not a PeerMatch backup.');
    if(Number(manifest.version)!==BACKUP_VERSION)throw new Error('This PeerMatch backup version is not supported by this app version.');
    if(!manifest.stores||typeof manifest.stores!=='object')throw new Error('The backup database information is missing.');
    return {manifest,files};
  }

  function openBackupScreen(){
    const last=localStorage.getItem(LAST_BACKUP_KEY)||'';
    open(`<h2>Backup</h2><div class="pmBackupCard">
      <button id="pmBackupEverything" class="primary">Backup Everything</button>
      <button id="pmRestoreBackup" class="secondary">Restore Backup</button>
      <input id="pmRestoreFile" type="file" accept=".zip,application/zip" class="hidden">
      <div class="pmBackupDate"><b>Last backup date</b><br><span id="pmLastBackup">${esc(formatDate(last))}</span></div>
      <div id="pmBackupProgress" class="pmBackupProgress"></div>
    </div><button id="pmBackupClose" class="secondary full">Close</button>`);
    const backupBtn=document.getElementById('pmBackupEverything'),restoreBtn=document.getElementById('pmRestoreBackup'),fileInput=document.getElementById('pmRestoreFile'),progress=document.getElementById('pmBackupProgress');
    backupBtn.onclick=async()=>{
      const old=backupBtn.textContent;backupBtn.disabled=true;restoreBtn.disabled=true;backupBtn.textContent='Preparing…';progress.textContent='Collecting profiles, photos, audio and attachments…';
      try{
        const result=await buildBackup();
        const u=URL.createObjectURL(result.zip),a=document.createElement('a');
        a.href=u;a.download=backupFilename();a.style.display='none';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),30000);
        localStorage.setItem(LAST_BACKUP_KEY,result.manifest.createdAt);
        document.getElementById('pmLastBackup').textContent=formatDate(result.manifest.createdAt);
        progress.textContent='Backup created: '+backupFilename();
        backupBtn.textContent='Backup saved';
        setTimeout(()=>{backupBtn.textContent=old;backupBtn.disabled=false;restoreBtn.disabled=false;},1600);
      }catch(e){
        console.warn('PeerMatch ZIP backup failed',e);backupBtn.textContent=old;backupBtn.disabled=false;restoreBtn.disabled=false;progress.textContent='';
        alert('PeerMatch could not create the backup. Your existing data was not changed.\n\n'+(e.message||e));
      }
    };
    restoreBtn.onclick=()=>fileInput.click();
    fileInput.onchange=async()=>{
      const f=fileInput.files?.[0];if(!f)return;
      restoreBtn.disabled=true;backupBtn.disabled=true;progress.textContent='Checking backup…';
      try{const r=await inspectBackup(f);showRestorePreview(r.manifest,r.files);}catch(e){restoreBtn.disabled=false;backupBtn.disabled=false;progress.textContent='';alert('PeerMatch could not read this backup.\n\n'+(e.message||e));}
    };
    document.getElementById('pmBackupClose').onclick=close;
  }

  function installHeader(){
    const header=document.querySelector('.app>header');if(!header)return;
    header.classList.add('pmMatchHeader');
    header.querySelectorAll('.pmBackupTop').forEach(x=>x.remove());
    const b=document.createElement('button');b.type='button';b.className='pmBackupTop';b.textContent='Backup';b.onclick=openBackupScreen;header.appendChild(b);
  }

  installHeader();
})();
