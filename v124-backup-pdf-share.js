/* PeerMatch v128: backup-screen UI shim only.
   PDF sharing is owned by v124-pdf-share-fix.js.
   Email-backup behavior is owned by v125-email-backup-direct.js.

   Older versions of this file also bound PDF share buttons and implemented a ZIP email
   flow. Those handlers were superseded, but leaving them live meant later scripts had to
   fight/rebind them. v128 keeps only the tiny UI responsibility that later owners need:
   rename the normal backup button and provide the Email backup button placeholder. */
(function(){
  document.documentElement.dataset.peerMatchVersion='128';
  let scheduled=false;

  function decorate(){
    const saveBtn=document.getElementById('pmBackupEverything');
    if(!saveBtn)return;

    if(saveBtn.textContent!=='Save backup to phone / computer'){
      saveBtn.textContent='Save backup to phone / computer';
    }

    if(!document.getElementById('pmV124EmailBackup')){
      const email=document.createElement('button');
      email.id='pmV124EmailBackup';
      email.className='secondary';
      email.type='button';
      email.textContent='Email backup';
      saveBtn.insertAdjacentElement('afterend',email);
    }
  }

  function schedule(){
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(()=>{scheduled=false;decorate();});
  }

  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
  schedule();
})();
