/* PeerMatch v127: Backup-screen destination UI only.
   Historical filename retained for stable script ordering.

   Ownership after v127:
   - backup-v28.js owns creation/download/restore of the canonical ZIP backup.
   - v125-email-backup-direct.js owns Email backup preparation/share and .txt restore.
   - v124-pdf-share-fix.js owns PDF-first profile sharing.

   The old v124 file also contained earlier PDF/Email share handlers. Those were already
   superseded by later files and caused needless competing observers/onclick wrappers. */
(function(){
  document.documentElement.dataset.peerMatchVersion='127';
  let scheduled=false;

  function decorate(){
    const saveBtn=document.getElementById('pmBackupEverything');
    if(!saveBtn||saveBtn.dataset.pmV127BackupUi==='1')return;
    saveBtn.dataset.pmV127BackupUi='1';
    saveBtn.textContent='Save backup to phone / computer';

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
