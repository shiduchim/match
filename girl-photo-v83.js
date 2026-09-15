/* PeerMatch v90: place the Girl profile Photo button immediately left of Edit. */
(function(){
  document.documentElement.dataset.peerMatchVersion='90';

  const style=document.createElement('style');
  style.textContent=`
    #sheet .v19Head .pmV90GirlHeaderActions{
      display:flex!important;
      align-items:flex-end!important;
      gap:6px!important;
      flex:0 0 auto!important;
      margin-left:auto!important;
    }
    #sheet .v19Head .pmV90GirlHeaderActions .pmV65GirlPhoto{
      margin:0!important;
      align-self:flex-end!important;
      min-height:36px!important;
    }
    #sheet .v19Head .pmV90GirlHeaderActions .pmV82EditStack{
      margin:0!important;
    }
  `;
  document.head.appendChild(style);

  function polish(){
    const sheet=document.getElementById('sheet');
    if(!sheet||document.getElementById('v19Profile')||sheet.querySelector('.v19ShadHead'))return;
    const head=sheet.querySelector('.v19Head');
    const photo=head?.querySelector('.pmV65GirlPhoto');
    const editStack=head?.querySelector('.pmV82EditStack');
    if(!head||!photo||!editStack)return;

    let actions=head.querySelector('.pmV90GirlHeaderActions');
    if(!actions){
      actions=document.createElement('div');
      actions.className='pmV90GirlHeaderActions';
      head.appendChild(actions);
    }

    if(photo.parentElement!==actions)actions.appendChild(photo);
    if(editStack.parentElement!==actions)actions.appendChild(editStack);
    if(actions.firstElementChild!==photo)actions.insertBefore(photo,actions.firstElementChild);
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
