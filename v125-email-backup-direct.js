/* PeerMatch v125: one-tap Email Backup with the ZIP as the actual shared file.
   The backup ZIP is prepared quietly when the Backup screen opens. The later user tap
   calls navigator.share({files:[zip]}) only — the same file-only pattern that reliably
   attaches photos on Android. No mailto/text-only fallback is used because that would
   open Gmail without the restore ZIP attached. */
(function(){
  document.documentElement.dataset.peerMatchVersion='125';
  let scheduled=false;
  const states=new WeakMap();

  function fmt(iso){
    const d=new Date(iso);
    if(Number.isNaN(d.getTime()))return'Never';
    return d.toLocaleString([],{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
  }

  function captureBackup(run){
    return new Promise(async(resolve,reject)=>{
      const proto=HTMLAnchorElement.prototype,oldClick=proto.click;
      let captured=null,name='PeerMatch_Backup.zip';
      proto.click=function(){
        try{
          const dl=String(this.download||''),href=String(this.href||'');
          if(/^PeerMatch_Backup_.*\.zip$/i.test(dl)&&href.startsWith('blob:')){
            name=dl||name;
            captured=fetch(href).then(r=>r.blob());
            return;
          }
        }catch(e){}
        return oldClick.call(this);
      };
      try{
        const r=run();if(r&&typeof r.then==='function')await r;
        if(!captured)throw new Error('PeerMatch did not produce a backup ZIP.');
        const blob=await captured;
        let file;
        try{file=new File([blob],name,{type:'application/zip',lastModified:Date.now()});}
        catch(e){file=blob;try{Object.defineProperty(file,'name',{value:name});}catch(_){} }
        resolve(file);
      }catch(e){reject(e);}
      finally{proto.click=oldClick;}
    });
  }

  async function prepare(email,state){
    if(!email||!state||state.preparing||state.file||!document.body.contains(email))return;
    const saveBtn=document.getElementById('pmBackupEverything');
    const restoreBtn=document.getElementById('pmRestoreBackup');
    const progress=document.getElementById('pmBackupProgress');
    const last=document.getElementById('pmLastBackup');
    if(!saveBtn||typeof saveBtn.onclick!=='function')return;

    state.preparing=true;
    const oldSaveText=saveBtn.textContent,oldSaveDisabled=saveBtn.disabled;
    const oldRestoreDisabled=!!restoreBtn?.disabled;
    const oldLast=localStorage.getItem('pmLastBackupAt'),oldLastText=last?.textContent||'';
    email.disabled=true;email.textContent='Preparing email backup…';
    if(progress)progress.textContent='Preparing the backup ZIP…';

    try{
      state.file=await captureBackup(()=>saveBtn.onclick.call(saveBtn));
      /* Background preparation is not yet a completed backup. */
      if(oldLast==null)localStorage.removeItem('pmLastBackupAt');else localStorage.setItem('pmLastBackupAt',oldLast);
      if(last)last.textContent=oldLastText;
      email.textContent='Email backup';
      if(progress)progress.textContent='Email backup is ready.';
    }catch(e){
      state.file=null;email.textContent='Email backup';if(progress)progress.textContent='';
      console.warn('PeerMatch v125 email backup preparation',e);
    }finally{
      state.preparing=false;email.disabled=false;
      saveBtn.textContent=oldSaveText;saveBtn.disabled=oldSaveDisabled;
      if(restoreBtn)restoreBtn.disabled=oldRestoreDisabled;
    }
  }

  function bind(){
    const email=document.getElementById('pmV124EmailBackup');
    if(!email||email.dataset.pmV125Direct==='1')return;
    const state={file:null,preparing:false,sharing:false};states.set(email,state);
    email.dataset.pmV125Direct='1';

    email.onclick=async e=>{
      e?.preventDefault?.();e?.stopPropagation?.();
      if(state.preparing||state.sharing)return;
      if(!state.file){await prepare(email,state);if(!state.file)return;}

      const file=state.file;
      const can=typeof navigator.share==='function'&&(!navigator.canShare||(()=>{try{return navigator.canShare({files:[file]});}catch(_){return false;}})());
      if(!can){
        alert('This browser cannot attach the PeerMatch ZIP automatically. Use “Save backup to phone / computer” instead.');
        return;
      }

      state.sharing=true;
      const progress=document.getElementById('pmBackupProgress');
      try{
        /* File-only payload is intentional. Mixed text+file shares opened Gmail on the
           tested Android device but dropped the ZIP attachment. */
        await navigator.share({files:[file]});
        const iso=new Date().toISOString();
        localStorage.setItem('pmLastBackupAt',iso);
        const last=document.getElementById('pmLastBackup');if(last)last.textContent=fmt(iso);
        if(progress)progress.textContent='Backup attached to the app you chose.';
        state.file=null;
        setTimeout(()=>prepare(email,state),250);
      }catch(err){
        if(err?.name!=='AbortError'){
          console.warn('PeerMatch v125 email backup share',err);
          alert('PeerMatch could not attach the backup ZIP. Try Email backup again.');
        }
      }finally{state.sharing=false;}
    };

    setTimeout(()=>prepare(email,state),0);
  }

  function schedule(){
    if(scheduled)return;scheduled=true;
    requestAnimationFrame(()=>{scheduled=false;bind();});
  }
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
  schedule();
})();
