/* PeerMatch v81: matching compact Edit buttons in the top profile headers. */
(function(){
  document.documentElement.dataset.peerMatchVersion='81';

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
      margin:0!important;
      padding:8px 12px!important;
      border-radius:9px!important;
      border:0!important;
      background:#eef3f6!important;
      color:var(--text)!important;
      font-size:11px!important;
      font-weight:850!important;
      line-height:1!important;
      box-shadow:none!important;
      flex:0 0 auto!important
    }
    #sheet .v19Head,#sheet .v19ShadHead{align-items:flex-start!important}
    #sheet .v19Head #v19EditProfile{align-self:flex-start!important}
  `;
  document.head.appendChild(style);

  function polish(){
    const sheet=document.getElementById('sheet');if(!sheet)return;

    const editProfile=sheet.querySelector('#v19EditProfile');
    const profileHead=sheet.querySelector('.v19Head');
    if(editProfile&&profileHead&&!sheet.querySelector('.v19ShadHead')){
      editProfile.textContent='Edit';
      editProfile.classList.remove('full');
      /* Put Edit on the same top row as the profile name/photo, like the Shadchan header. */
      if(editProfile.parentElement!==profileHead)profileHead.appendChild(editProfile);
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
