/* PeerMatch v76: place Shadchan profile / notes directly under Tags. */
(function(){
  document.documentElement.dataset.peerMatchVersion='76';
  let queued=false;

  function moveShadchanNotes(){
    const sheet=document.getElementById('sheet');
    if(!sheet||!sheet.querySelector('.v19ShadHead'))return;
    const tags=sheet.querySelector('.pmInlineTools .pmInlineTags');
    const notes=sheet.querySelector('.pmV63ProfileCard');
    if(!tags||!notes)return;
    if(tags.nextElementSibling!==notes)tags.insertAdjacentElement('afterend',notes);
  }

  function schedule(){
    if(queued)return;
    queued=true;
    requestAnimationFrame(()=>{queued=false;moveShadchanNotes();});
  }

  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
  schedule();
})();
