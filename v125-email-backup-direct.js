/* PeerMatch v127: email backup as a share-safe text attachment.
   Android Chrome can reject ZIP files in Web Share even though image/text attachments work.
   PeerMatch wraps the exact restore ZIP as base64 inside a text/plain file, which Gmail
   accepts as a real attachment. Restore Backup accepts that emailed .txt wrapper and
   transparently converts it back to the original ZIP before restore.
   v127 fixes Base64 chunk boundaries so large backups decode bit-for-bit correctly. */
(function(){
  document.documentElement.dataset.peerMatchVersion='127';
  const HEADER='PEERMATCH-BACKUP-TEXT-V1\n';
  let scheduled=false;
  const states=new WeakMap();

  const fmt=iso=>{const d=new Date(iso);return Number.isNaN(d.getTime())?'Never':d.toLocaleString([],{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});};
  /* Each non-final input chunk MUST be divisible by 3; otherwise btoa() inserts "="
     padding in the middle of the concatenated Base64 stream and a later restore can fail. */
  function bytesToB64(bytes){let out='';const size=0x6000;for(let i=0;i<bytes.length;i+=size){const part=bytes.subarray(i,Math.min(i+size,bytes.length));let s='';for(let j=0;j<part.length;j++)s+=String.fromCharCode(part[j]);out+=btoa(s);}return out;}
  /* 0x100000 is divisible by 4, so every non-final atob() chunk ends on a Base64 quartet. */
  function b64ToBytes(s){const chunks=[],size=0x100000;let total=0;for(let i=0;i<s.length;i+=size){const bin=atob(s.slice(i,i+size)),a=new Uint8Array(bin.length);for(let j=0;j<bin.length;j++)a[j]=bin.charCodeAt(j);chunks.push(a);total+=a.length;}const out=new Uint8Array(total);let p=0;for(const a of chunks){out.set(a,p);p+=a.length;}return out;}

  function captureZip(run){
    return new Promise(async(resolve,reject)=>{
      const proto=HTMLAnchorElement.prototype,old=proto.click;let captured=null,name='PeerMatch_Backup.zip';
      proto.click=function(){try{const dl=String(this.download||''),href=String(this.href||'');if(/^PeerMatch_Backup_.*\.zip$/i.test(dl)&&href.startsWith('blob:')){name=dl||name;captured=fetch(href).then(r=>r.blob());return;}}catch(e){}return old.call(this);};
      try{const r=run();if(r&&typeof r.then==='function')await r;if(!captured)throw new Error('PeerMatch did not produce a backup ZIP.');resolve({blob:await captured,name});}catch(e){reject(e);}finally{proto.click=old;}
    });
  }

  async function makeEmailFile(zipBlob,zipName){
    const bytes=new Uint8Array(await zipBlob.arrayBuffer());
    const base=String(zipName||'PeerMatch_Backup.zip').replace(/\.zip$/i,'');
    return new File([HEADER,bytesToB64(bytes)],base+'.txt',{type:'text/plain',lastModified:Date.now()});
  }

  async function prepare(email,state){
    if(!email||!state||state.preparing||state.file||!document.body.contains(email))return;
    const saveBtn=document.getElementById('pmBackupEverything'),restoreBtn=document.getElementById('pmRestoreBackup'),progress=document.getElementById('pmBackupProgress'),last=document.getElementById('pmLastBackup');
    if(!saveBtn||typeof saveBtn.onclick!=='function')return;
    state.preparing=true;const oldSaveText=saveBtn.textContent,oldSaveDisabled=saveBtn.disabled,oldRestoreDisabled=!!restoreBtn?.disabled,oldLast=localStorage.getItem('pmLastBackupAt'),oldLastText=last?.textContent||'';
    email.disabled=true;email.textContent='Preparing email backup…';if(progress)progress.textContent='Preparing backup for email…';
    try{const z=await captureZip(()=>saveBtn.onclick.call(saveBtn));state.file=await makeEmailFile(z.blob,z.name);if(oldLast==null)localStorage.removeItem('pmLastBackupAt');else localStorage.setItem('pmLastBackupAt',oldLast);if(last)last.textContent=oldLastText;email.textContent='Email backup';if(progress)progress.textContent='Email backup is ready.';}
    catch(e){state.file=null;email.textContent='Email backup';if(progress)progress.textContent='';console.warn('PeerMatch v127 email backup preparation',e);}
    finally{state.preparing=false;email.disabled=false;saveBtn.textContent=oldSaveText;saveBtn.disabled=oldSaveDisabled;if(restoreBtn)restoreBtn.disabled=oldRestoreDisabled;}
  }

  function bindEmail(){
    const email=document.getElementById('pmV124EmailBackup');if(!email||email.dataset.pmV127Email==='1')return;
    const state={file:null,preparing:false,sharing:false};states.set(email,state);email.dataset.pmV127Email='1';email.textContent='Email backup';
    email.onclick=async e=>{
      e?.preventDefault?.();e?.stopPropagation?.();if(state.preparing||state.sharing)return;if(!state.file){await prepare(email,state);if(!state.file)return;}
      const file=state.file,can=typeof navigator.share==='function'&&(!navigator.canShare||(()=>{try{return navigator.canShare({files:[file]});}catch(_){return false;}})());
      if(!can){alert('This browser cannot attach the backup automatically. Use “Save backup to phone / computer” instead.');return;}
      state.sharing=true;const progress=document.getElementById('pmBackupProgress');
      try{await navigator.share({files:[file]});const iso=new Date().toISOString();localStorage.setItem('pmLastBackupAt',iso);const last=document.getElementById('pmLastBackup');if(last)last.textContent=fmt(iso);if(progress)progress.textContent='Backup attached to the app you chose.';state.file=null;setTimeout(()=>prepare(email,state),250);}
      catch(err){if(err?.name!=='AbortError'){console.warn('PeerMatch v127 email backup share',err);alert('PeerMatch could not attach the email backup. Try again.');}}
      finally{state.sharing=false;}
    };
    setTimeout(()=>prepare(email,state),0);
  }

  function bindRestore(){
    const input=document.getElementById('pmRestoreFile');if(!input||input.dataset.pmV127Restore==='1'||typeof input.onchange!=='function')return;
    input.dataset.pmV127Restore='1';input.accept='.zip,.txt,application/zip,text/plain';const original=input.onchange;
    input.onchange=async e=>{
      const f=input.files?.[0];if(!f)return;
      if(!/\.txt$/i.test(f.name||''))return original.call(input,e);
      try{
        const text=await f.text();if(!text.startsWith(HEADER))return original.call(input,e);
        const b64=text.slice(HEADER.length).replace(/\s+/g,''),bytes=b64ToBytes(b64),zipName=(f.name||'PeerMatch_Backup.txt').replace(/\.txt$/i,'.zip'),zip=new File([bytes],zipName,{type:'application/zip'});
        if(typeof DataTransfer!=='function')throw new Error('This browser cannot pass the decoded ZIP to Restore Backup.');
        const dt=new DataTransfer();dt.items.add(zip);input.files=dt.files;return original.call(input,e);
      }catch(err){console.warn('PeerMatch v127 emailed backup restore',err);alert('PeerMatch could not read this emailed backup file.');}
    };
  }

  function polish(){bindEmail();bindRestore();}
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;polish();});}
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});schedule();
})();
