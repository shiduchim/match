/* PeerMatch v122: keep the v116 queue label clean without fighting newer UI owners.
   v119 now owns the Yes / No photo buttons. This helper only strips markdown asterisks
   from the older v116 queue label, avoiding the old v117 symbol-vs-No observer loop. */
(function(){
  document.documentElement.dataset.peerMatchVersion='122';

  function clean(){
    const label=document.getElementById('pmWaQueueLabel');
    if(!label)return;
    const t=String(label.textContent||'');
    const cleaned=t.replace(/\*/g,'');
    if(cleaned!==t)label.textContent=cleaned;
  }

  let queued=false;
  function schedule(){
    if(queued)return;
    queued=true;
    requestAnimationFrame(()=>{queued=false;clean();});
  }

  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true,characterData:true});
  schedule();
  setTimeout(clean,250);
})();
