/* PeerMatch v79: compact Contact person name and phone onto one line. */
(function(){
  document.documentElement.dataset.peerMatchVersion='79';

  const style=document.createElement('style');
  style.textContent=`
    #sheet .pmV74ContactTop{display:flex!important;flex-wrap:wrap!important;align-items:baseline!important;gap:5px!important}
    #sheet .pmV74ContactPhone{display:inline!important;width:auto!important;margin:0!important;white-space:nowrap!important}
    #sheet .pmV79ContactSep{color:var(--muted);font-weight:700}
  `;
  document.head.appendChild(style);

  function polish(){
    const box=document.querySelector('#sheet .pmV74ContactSummary');
    const top=box?.querySelector('.pmV74ContactTop');
    const phone=box?.querySelector('.pmV74ContactPhone');
    if(!box||!top||!phone)return;

    if(phone.parentElement!==top){
      let sep=top.querySelector('.pmV79ContactSep');
      if(!sep&&top.querySelector('.pmV74ContactName')){
        sep=document.createElement('span');
        sep.className='pmV79ContactSep';
        sep.textContent='•';
        top.appendChild(sep);
      }
      top.appendChild(phone);
    }
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
