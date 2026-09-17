/* PeerMatch v128: backup destination UI owner only.
   Keep backup file creation/restoration in backup-v28.js and emailed TXT handling in
   v125-email-backup-direct.js. This file only exposes the two backup destinations so
   old v124 ZIP-email/PDF wrapper code no longer needs to stay live. */
(function(){
  document.documentElement.dataset.peerMatchVersion='128';
  let scheduled=false;

  function decorate(){
    const save=document.getElementById('pmBackupEverything');
    if(!save)return;
    save.textContent='Save backup to phone / computer';
    if(!document.getElementById('pmV124EmailBackup')){
      const email=document.createElement('button');
      email.id='pmV124EmailBackup';
      email.className='secondary';
      email.type='button';
      email.textContent='Email backup';
      save.insertAdjacentElement('afterend',email);
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
