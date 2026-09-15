/* PeerMatch v77: matching compact Edit buttons. */
(function(){
  document.documentElement.dataset.peerMatchVersion='77';

  const style=document.createElement('style');
  style.textContent=`
    #sheet #v19EditProfile,
    #sheet #v19EditShad{
      display:inline-flex!important;
      align-items:center!important;
      justify-content:center!important;
      width:auto!important;
      min-width:58px!important;
      min-height:36px!important;
      margin:7px 0 9px!important;
      padding:8px 12px!important;
      border-radius:9px!important;
      border:0!important;
      background:#eef3f6!important;
      color:var(--text)!important;
      font-size:11px!important;
      font-weight:850!important;
      line-height:1!important;
      box-shadow:none!important;
    }
    #sheet .v19ShadHead #v19EditShad{
      flex:0 0 auto!important;
      margin:0!important;
    }
  `;
  document.head.appendChild(style);

  function polish(){
    const sheet=document.getElementById('sheet');if(!sheet)return;

    const editProfile=sheet.querySelector('#v19EditProfile');
    if(editProfile){
      editProfile.textContent='Edit';
      editProfile.classList.remove('full');
      const card=sheet.querySelector('.card');
      if(card&&card.nextElementSibling!==editProfile){
        card.insertAdjacentElement('afterend',editProfile);
      }
    }

    const editShad=sheet.querySelector('#v19EditShad');
    if(editShad)editShad.textContent='Edit';
  }

  let queued=false;
  function schedule(){
    if(queued)return;
    queued=true;
    requestAnimationFrame(()=>{queued=false;polish();});
  }

  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
  schedule();
})();
