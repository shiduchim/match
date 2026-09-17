/* PeerMatch v128 runtime hardening.
   Narrow purpose: persisted WhatsApp send queues must never overlap.

   Live queue owners currently use four different localStorage keys. Starting one flow
   now clears the other queue keys before storing the new one. This prevents two bottom
   bars / two pending send flows from surviving at the same time after a selection change,
   app focus change, or an interrupted prior send.

   A one-time v128 cleanup also clears queue state left behind by older versions. Queue
   state is ephemeral UI state only; profile/history data is never touched here. */
(function(){
  document.documentElement.dataset.peerMatchVersion='128';

  const KEYS=[
    'pmWaSendQueue',
    'pmMultiShadWaQueue',
    'pmGeneralWaQueueV120',
    'pmV124PdfSendQueue'
  ];
  const BAR_IDS=[
    'pmWaQueueBar',
    'pmV119QueueBar',
    'pmV120QueueBar',
    'pmV124HardQueue'
  ];
  const RESET_KEY='pmWaQueueResetV128';

  const nativeSet=Storage.prototype.setItem;
  const nativeRemove=Storage.prototype.removeItem;

  function removeBarsExcept(key){
    const keepId=key==='pmWaSendQueue'?'pmWaQueueBar'
      :key==='pmMultiShadWaQueue'?'pmV119QueueBar'
      :key==='pmGeneralWaQueueV120'?'pmV120QueueBar'
      :key==='pmV124PdfSendQueue'?'pmV124HardQueue':'';
    for(const id of BAR_IDS){if(id!==keepId)document.getElementById(id)?.remove();}
  }

  function clearOtherQueues(keep){
    for(const key of KEYS){if(key!==keep)nativeRemove.call(localStorage,key);}
    removeBarsExcept(keep);
  }

  /* Expose a non-invasive helper for future consolidation work. */
  window.pmClearOtherWhatsAppQueues=clearOtherQueues;

  /* Old releases could leave more than one queue persisted. On the first v128 load,
     discard those stale send prompts rather than guessing which interrupted flow wins. */
  try{
    if(localStorage.getItem(RESET_KEY)!=='1'){
      clearOtherQueues('');
      nativeSet.call(localStorage,RESET_KEY,'1');
    }
  }catch(e){console.warn('PeerMatch v128 queue reset',e);}

  /* Existing owners already call localStorage.setItem when beginning/updating a queue.
     Intercept only those four exact keys; all other localStorage behavior is untouched. */
  if(!window.__pmV128QueueIsolationInstalled){
    window.__pmV128QueueIsolationInstalled=true;
    Storage.prototype.setItem=function(key,value){
      const k=String(key);
      if(this===localStorage&&KEYS.includes(k)){
        try{clearOtherQueues(k);}catch(e){console.warn('PeerMatch v128 queue isolation',e);}
      }
      return nativeSet.call(this,key,value);
    };
  }
})();
