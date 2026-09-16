/* PeerMatch v117: small UI cleanup for the v116 WhatsApp follow-up bar.
   - Strip markdown asterisks from names shown in the bottom queue label only.
   - Replace the photo-skip cross with a skip symbol (no X/cross icon).
*/
(function(){
  document.documentElement.dataset.peerMatchVersion='117';

  function clean(){
    const label=document.getElementById('pmWaQueueLabel');
    if(label){
      const t=String(label.textContent||'');
      const cleaned=t.replace(/\*/g,'');
      if(cleaned!==t)label.textContent=cleaned;
    }

    const skip=document.getElementById('pmWaPhotoSkip');
    if(skip){
      if(skip.textContent!=='⏭')skip.textContent='⏭';
      if(skip.title!=='Skip photo')skip.title='Skip photo';
      if(skip.getAttribute('aria-label')!=='Skip photo')skip.setAttribute('aria-label','Skip photo');
      skip.style.minWidth='42px';
      skip.style.fontSize='18px';
      skip.style.lineHeight='1';
    }
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
