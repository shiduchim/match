/* PeerMatch v110: compact styling for the Guy/Girl saved attachment box.
   Placement of Attachment and Contacts is now owned at creation time by
   profile-pdf-ocr-v63.js and profile-contacts-v96.js respectively — this file
   no longer repositions either element and only applies cosmetic classes. */
(function(){
  document.documentElement.dataset.peerMatchVersion='110';

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

  function decorateAttachment(){
    const sheet=document.getElementById('sheet');
    if(!sheet||!sheet.querySelector('.v19Head')||sheet.querySelector('.v19ShadHead')||document.getElementById('v19Profile'))return;

    const attachment=sheet.querySelector('.pmV63Attachment:not(.pmV67ShadAttachment)');
    if(attachment)attachment.classList.add('pmV85ProfileAttachment');
  }

  let queued=false;
  function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;decorateAttachment();});}
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
  schedule();
})();