/* PeerMatch v107: profile text first, then attachment and contacts; Edit stays in top-right header. */
(function(){
  document.documentElement.dataset.peerMatchVersion='107';

  const style=document.createElement('style');
  style.textContent=`
    #sheet .pmV85ProfileAttachment{
      margin:8px 0 7px!important;
      padding:9px 10px!important;
      border:1px solid var(--line)!important;
      border-radius:12px!important;
      background:#fff!important
    }
    #sheet .pmV85ProfileAttachment>div:first-child{display:block!important;font-size:11px!important;color:var(--muted)!important;margin-bottom:4px!important}
    #sheet .pmV85ProfileAttachment>div:nth-child(2){display:block!important;font-size:12px!important;font-weight:800!important;overflow-wrap:anywhere!important}
    #sheet .pmV85ProfileAttachment>button{
      display:inline-flex!important;
      width:auto!important;
      margin:7px 0 0!important;
      padding:8px 10px!important;
      border-radius:9px!important;
      background:#eef3f6!important;
      color:#274b64!important;
      font-size:11px!important;
      font-weight:850!important
    }
    #sheet .pmV96Contacts{margin:8px 0 7px!important}
  `;
  document.head.appendChild(style);

  function profileDetail(){
    const sheet=document.getElementById('sheet');
    if(!sheet||!sheet.querySelector('.v19Head')||sheet.querySelector('.v19ShadHead')||document.getElementById('v19Profile'))return;

    const profileText=sheet.querySelector('.card > .profileText');
    const profileCard=profileText?.closest('.card');
    if(!profileCard)return;

    const attachment=sheet.querySelector('.pmV63Attachment:not(.pmV67ShadAttachment)');
    const contacts=sheet.querySelector('.pmV96Contacts');

    let anchor=profileCard;
    if(attachment){
      attachment.classList.add('pmV85ProfileAttachment');
      if(anchor.nextElementSibling!==attachment)anchor.insertAdjacentElement('afterend',attachment);
      anchor=attachment;
    }
    if(contacts){
      if(anchor.nextElementSibling!==contacts)anchor.insertAdjacentElement('afterend',contacts);
    }

    /* Do not move #v19EditProfile here. edit-buttons-v77.js owns it in the top-right header. */
  }

  let queued=false;
  function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;profileDetail();});}
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
  schedule();
})();