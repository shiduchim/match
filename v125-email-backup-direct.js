/* PeerMatch v125: make Email Backup a single PeerMatch tap.
   v124 needed two PeerMatch taps because the backup ZIP was built on the first tap and
   the native file-share dialog needed a fresh user gesture on the second. v125 prepares
   that exact same restore-compatible ZIP quietly when the Backup screen opens. Once it
   is ready, tapping Email backup immediately opens the phone's native share sheet with
   the ZIP attached. A web/PWA cannot force a particular mail app while attaching a file,
   so the Android/iOS share sheet is still required; there is no extra PeerMatch step. */
(function(){
  document.documentElement.dataset.peerMatchVersion='125';
  let scheduled=false;
  const states=new WeakMap();

  function fmt(iso){
    const d=new Date(iso);
    if(Number.isNaN(d.getTime()))return 'Never';
    return d.toLocaleString([],{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
  }

  async function prepare(email,state){
    if(!email||!state||state.preparing||state.ready||!document.body.contains(email))return;
    state.preparing=true;
    const progress=document.getElementById('pmBackupProgress');
    const saveBtn=document.getElementById('pmBackupEverything');
    const restoreBtn=document.getElementById('pmRestoreBackup');
    const lastEl=document.getElementById('pmLastBackup');
    const previousLast=localStorage.getItem('pmLastBackupAt');
    const previousLastText=lastEl?.textContent||'';
    const oldSaveText=saveBtn?.textContent||'';
    const oldSaveDisabled=!!saveBtn?.disabled;
    const oldRestoreDisabled=!!restoreBtn?.disabled;

    email.disabled=true;
    email.textContent='Preparing email backup…';
    if(progress)progress.textContent='Preparing the backup for email…';

    try{
      const p=state.original.call(email);
      /* v124 internally presses the normal backup button to build/capture the ZIP.
         Keep that button visually stable while the background preparation runs. */
      if(saveBtn){saveBtn.textContent=oldSaveText;saveBtn.disabled=true;}
      if(restoreBtn)restoreBtn.disabled=true;
      if(p&&typeof p.then==='function')await p;

      /* Preparing is not itself a completed backup. Restore the old Last backup value;
         we update it only after the user actually hands the ZIP to the share sheet. */
      if(previousLast==null)localStorage.removeItem('pmLastBackupAt');
      else localStorage.setItem('pmLastBackupAt',previousLast);
      if(lastEl)lastEl.textContent=previousLastText;

      if(String(email.textContent||'').toLowerCase().includes('choose email')){
        state.ready=true;
        email.textContent='Email backup';
        if(progress)progress.textContent='Email backup is ready.';
      }else{
        state.ready=false;
        email.textContent='Email backup';
        if(progress)progress.textContent='';
      }
    }catch(e){
      state.ready=false;
      email.textContent='Email backup';
      if(progress)progress.textContent='';
      console.warn('PeerMatch v125 email backup preparation',e);
    }finally{
      state.preparing=false;
      email.disabled=false;
      if(saveBtn){saveBtn.textContent=oldSaveText;saveBtn.disabled=oldSaveDisabled;}
      if(restoreBtn)restoreBtn.disabled=oldRestoreDisabled;
    }
  }

  function bind(){
    const email=document.getElementById('pmV124EmailBackup');
    if(!email||email.dataset.pmV125Direct==='1'||typeof email.onclick!=='function')return;

    const state={original:email.onclick,preparing:false,ready:false,sharing:false};
    states.set(email,state);
    email.dataset.pmV125Direct='1';

    email.onclick=async e=>{
      e?.preventDefault?.();
      e?.stopPropagation?.();
      if(state.preparing||state.sharing)return;
      if(!state.ready){
        await prepare(email,state);
        return;
      }

      state.sharing=true;
      const progress=document.getElementById('pmBackupProgress');
      try{
        await state.original.call(email,e);
        const p=String(progress?.textContent||'');
        const completed=/handed to your email|downloaded\. attach/i.test(p);
        if(completed){
          state.ready=false;
          const iso=new Date().toISOString();
          localStorage.setItem('pmLastBackupAt',iso);
          const last=document.getElementById('pmLastBackup');
          if(last)last.textContent=fmt(iso);
          email.textContent='Email backup';
        }else{
          /* Cancelled native share keeps v124's prepared ZIP in memory, so the next tap
             can try again immediately without rebuilding it. */
          state.ready=true;
          email.textContent='Email backup';
        }
      }finally{
        state.sharing=false;
      }
    };

    /* Build the ZIP as soon as the Backup screen appears. This removes the old
       "Choose email app" PeerMatch step while preserving a fresh user gesture for the
       actual native file-share dialog. */
    setTimeout(()=>prepare(email,state),0);
  }

  function schedule(){
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(()=>{scheduled=false;bind();});
  }
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
  schedule();
})();
