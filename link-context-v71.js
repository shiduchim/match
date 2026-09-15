/* PeerMatch v71: keep linked-profile/shadchan UI on the correct detail screen only. */
(function(){
  document.documentElement.dataset.peerMatchVersion='71';

  const css=document.createElement('style');
  css.textContent=`
    /* A Shadchan detail must never show the Guy/Girl "Linked shadchanim" box. */
    #sheet:has(.v19ShadHead) .pmV64ProfileLink,
    #sheet:has(.v19ShadHead) .pmV65ProfileLinks,
    #sheet:has(.v19ShadHead) .pmV65Phone2Pill{
      display:none!important;
    }

    /* A Guy/Girl detail must never show Shadchan reverse-link boxes. */
    #sheet:has(.v19Head):not(:has(.v19ShadHead)) .pmV64ReverseLinks,
    #sheet:has(.v19Head):not(:has(.v19ShadHead)) .pmV65ReverseLinks{
      display:none!important;
    }
  `;
  document.head.appendChild(css);

  function norm(s){
    return String(s||'').trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
  }
  function phoneKey(v){
    if(typeof window.pmPhoneKey==='function')return window.pmPhoneKey(v);
    return String(v||'').replace(/\D/g,'');
  }

  function cleanWrongContext(){
    const sheet=document.getElementById('sheet');if(!sheet)return;
    const isShad=!!sheet.querySelector('.v19ShadHead');
    const isProfile=!isShad&&!!sheet.querySelector('.v19Head');

    if(isShad){
      // These belong only to Guy/Girl profile details.
      sheet.querySelectorAll('.pmV64ProfileLink,.pmV65ProfileLinks,.pmV65Phone2Pill').forEach(el=>el.remove());

      // Extra safety: if any old linked-shadchan box survives, reject a link to the current Shadchan by name or phone.
      const currentName=norm(sheet.querySelector('.v19ShadHead h2')?.textContent||'');
      const currentPhone=phoneKey((sheet.querySelector('.pmV69ShadPhone a')||sheet.querySelector('.pmV69ShadPhone'))?.textContent||'');
      for(const box of sheet.querySelectorAll('.pmV65ProfileLinks,.pmV64ProfileLink')){
        for(const b of box.querySelectorAll('button,.pmV65LinkBtn,.pmV64LinkBtn')){
          const linkedName=norm(b.textContent||'');
          if(currentName&&linkedName===currentName)b.remove();
        }
        if(!box.querySelector('button,.pmV65LinkBtn,.pmV64LinkBtn'))box.remove();
      }
      return;
    }

    if(isProfile){
      // These belong only to Shadchan details.
      sheet.querySelectorAll('.pmV64ReverseLinks,.pmV65ReverseLinks').forEach(el=>el.remove());
    }
  }

  let queued=false;
  function schedule(){
    if(queued)return;
    queued=true;
    requestAnimationFrame(()=>{queued=false;cleanWrongContext();});
  }
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
  schedule();
})();
