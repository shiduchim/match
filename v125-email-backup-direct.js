/* PeerMatch v127: email-safe full backup attachment.
   Historical filename kept for load-order stability.
   - Normal device backup remains the original .zip from backup-v28.js.
   - Email backup wraps that exact ZIP as Base64 in a plain .txt attachment because
     Android Chrome/Gmail rejected the ZIP through Web Share on the user's phone.
   - Restore accepts the emailed .txt wrapper and reconstructs the original ZIP first.
   - The Base64 encoder deliberately uses chunks divisible by 3; concatenating separately
     padded Base64 chunks corrupts large backups, which was a real v126 bug. */
(function(){
  document.documentElement.dataset.peerMatchVersion='127';
  const HEADER='PEERMATCH-BACKUP-TEXT-V1\n';
  let scheduled=false;
  const states=new WeakMap();

  const fmt=iso=>{const d=new Date(iso);return Number.isNaN(d.getTime())?'Never':d.toLocaleString([],{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});};

  function bytesToB64(bytes){
    let out='';
    /* Every non-final chunk MUST be divisible by 3 so only the final chunk can contain
       Base64 '=' padding. v126 used 0x8000 (not divisible by 3), producing invalid
       concatenated Base64 for backups larger than one chunk. */
    const size=0x6000;
    for(let i=0;i<bytes.length;i+=size){
      const part=bytes.subarray(i,Math.min(i+size,bytes.length));
      let s='';for(let j=0;j<part.length;j++)s+=String.fromCharCode(part[j]);
      out+=btoa(s);
    }
    return out;
  }

  function b64ToBytes(s){
    s=String(s||'').replace(/\s+/g,'');
    const chunks=[],size=0x40000;let total=0;
    for(let i=0;i<s.length;i+=size){
      const bin=atob(s.slice(i,i+size)),a=new Uint8Array(bin.length);
      for(let j=0;j<bin.length;j++)a[j]=bin.charCodeAt(j);
      chunks.push(a);total+=a.length;
    }
    const out=new Uint8Array(total);let p=0;
    for(const a of chunks){out.set(a,p);p+=a.length;}
    return out;
  }

  function captureZip(run){
    return new Promise(async(resolve,reject)=>{
      const proto=HTMLAnchorElement.prototype,old=proto.click;let captured=null,name='PeerMatch_Backup.zip';
      proto.click=function(){
        try{
          const dl=String(this.download||''),href=String(this.href||'');
          if(/^PeerMatch_Backup_.*\.zip$/i.test(dl)&&href.startsWith('blob:')){
            name=dl||name;captured=fetch(href).then(r=>r.blob());return;
          }
        }catch(e){}
        return old.call(this);
      };
      try{
        const r=run();if(r&&typeof r.then==='function')await r;
        if(!captured)throw new Error('PeerMatch did not produce a backup ZIP.');
        resolve({blob:await captured,name});
      }catch(e){reject(e);}finally{proto.click=old;}
    });
  }

  async function makeEmailFile(zipBlob,zipName){
    const bytes=new Uint8Array(await zipBlob.arrayBuffer());
    if(bytes.length<4||bytes[0]!==0x50||bytes[1]!==0x4b)throw new Error('The generated backup is not a valid ZIP payload.');
    const base=String(zipName||'PeerMatch_Backup.zip').replace(/\.zip$/i,'');
    return new File([HEADER,bytesToB64(bytes)],base+'.txt',{type:'text/plain',lastModified:Date.now()});
  }

  async function decodeEmailBackup(file){
    if(!file||!/\.txt$/i.test(file.name||''))return file;
    const text=await file.text();
    if(!text.startsWith(HEADER))return file;
    const bytes=b64ToBytes(text.slice(HEADER.length));
    if(bytes.length<4||bytes[0]!==0x50||bytes[1]!==0x4b)throw new Error('The emailed PeerMatch backup is damaged.');
    const zipName=(file.name||'PeerMatch_Backup.txt').replace(/\.txt$/i,'.zip');
    return new File([bytes],zipName,{type:'application/zip',lastModified:file.lastModified||Date.now()});
  }
  window.pmDecodeEmailBackupFile=decodeEmailBackup;

  async function prepare(email,state){
    if(!email||!state||state.preparing||state.file||!document.body.contains(email))return;
    const saveBtn=document.getElementById('pmBackupEverything'),restoreBtn=document.getElementById('pmRestoreBackup'),progress=document.getElementById('pmBackupProgress'),last=document.getElementById('pmLastBackup');
    if(!saveBtn||typeof saveBtn.onclick!=='function')return;
    state.preparing=true;
    const oldSaveText=saveBtn.textContent,oldSaveDisabled=saveBtn.disabled,oldRestoreDisabled=!!restoreBtn?.disabled,oldLast=localStorage.getItem('pmLastBackupAt'),oldLastText=last?.textContent||'';
    email.disabled=true;email.textContent='Preparing email backup…';if(progress)progress.textContent='Preparing backup for email…';
    try{
      const z=await captureZip(()=>saveBtn.onclick.call(saveBtn));
      state.file=await makeEmailFile(z.blob,z.name);
      /* Quiet preparation is not a completed backup. */
      if(oldLast==null)localStorage.removeItem('pmLastBackupAt');else localStorage.setItem('pmLastBackupAt',oldLast);
      if(last)last.textContent=oldLastText;
      email.textContent='Email backup';if(progress)progress.textContent='Email backup is ready.';
    }catch(e){
      state.file=null;email.textContent='Email backup';if(progress)progress.textContent='';
      console.warn('PeerMatch v127 email backup preparation',e);
    }finally{
      state.preparing=false;email.disabled=false;saveBtn.textContent=oldSaveText;saveBtn.disabled=oldSaveDisabled;if(restoreBtn)restoreBtn.disabled=oldRestoreDisabled;
    }
  }

  function bindEmail(){
    const email=document.getElementById('pmV124EmailBackup');if(!email||email.dataset.pmV127Email==='1')return;
    const state={file:null,preparing:false,sharing:false};states.set(email,state);email.dataset.pmV127Email='1';email.textContent='Email backup';
    email.onclick=async e=>{
      e?.preventDefault?.();e?.stopPropagation?.();if(state.preparing||state.sharing)return;
      if(!state.file){await prepare(email,state);if(!state.file)return;}
      const file=state.file;
      const can=typeof navigator.share==='function'&&(!navigator.canShare||(()=>{try{return navigator.canShare({files:[file]});}catch(_){return false;}})());
      if(!can){alert('This browser cannot attach the backup automatically. Use “Save backup to phone / computer” instead.');return;}
      state.sharing=true;const progress=document.getElementById('pmBackupProgress');
      try{
        await navigator.share({files:[file]});
        const iso=new Date().toISOString();localStorage.setItem('pmLastBackupAt',iso);
        const last=document.getElementById('pmLastBackup');if(last)last.textContent=fmt(iso);
        if(progress)progress.textContent='Backup attached to the app you chose.';
        state.file=null;setTimeout(()=>prepare(email,state),250);
      }catch(err){
        if(err?.name!=='AbortError'){
          console.warn('PeerMatch v127 email backup share',err);
          alert('PeerMatch could not attach the email backup. Try again.');
        }
      }finally{state.sharing=false;}
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
        const zip=await decodeEmailBackup(f);
        if(zip===f)return original.call(input,e);
        if(typeof DataTransfer!=='function')throw new Error('This browser cannot hand the decoded ZIP to Restore Backup.');
        const dt=new DataTransfer();dt.items.add(zip);input.files=dt.files;return original.call(input,e);
      }catch(err){console.warn('PeerMatch v127 emailed backup restore',err);alert('PeerMatch could not read this emailed backup file.\n\n'+(err.message||err));}
    };
  }

  function polish(){bindEmail();bindRestore();}
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;polish();});}
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});schedule();
})();
