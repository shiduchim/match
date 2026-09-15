/* PeerMatch v86: contact person + action buttons above profile; attachment/tags/religious level below. */
(function(){
  document.documentElement.dataset.peerMatchVersion='86';

  const style=document.createElement('style');
  style.textContent=`
    #sheet .pmV85ProfileAttachment{
      margin:7px 0!important;
      padding:0!important;
      border:0!important;
      background:transparent!important
    }
    #sheet .pmV85ProfileAttachment>div{display:none!important}
    #sheet .pmV85ProfileAttachment>button{
      display:inline-flex!important;
      width:auto!important;
      margin:0!important;
      padding:8px 10px!important;
      border-radius:9px!important;
      background:#eef3f6!important;
      color:#274b64!important;
      font-size:11px!important;
      font-weight:850!important
    }
    #sheet .pmV85ProfileTools{margin-top:5px!important}
    #sheet .pmV85ProfileContact{margin:6px 0 5px!important}
  `;
  document.head.appendChild(style);

  function profileDetail(){
    const sheet=document.getElementById('sheet');
    if(!sheet||!sheet.querySelector('.v19Head')||sheet.querySelector('.v19ShadHead')||document.getElementById('v19Profile'))return;

    const profileText=sheet.querySelector('.card > .profileText');
    const profileCard=profileText?.closest('.card');
    if(!profileCard)return;

    /* Keep contact person and the four action buttons together directly above the profile. */
    const contact=sheet.querySelector('.pmV74ContactSummary');
    const buttons=sheet.querySelector('.pmProfileContact');
    if(contact){
      contact.classList.add('pmV85ProfileContact');
      if(profileCard.previousElementSibling!==contact)profileCard.insertAdjacentElement('beforebegin',contact);
      if(buttons&&contact.nextElementSibling!==buttons)contact.insertAdjacentElement('afterend',buttons);
    }else if(buttons&&profileCard.previousElementSibling!==buttons){
      profileCard.insertAdjacentElement('beforebegin',buttons);
    }

    /* Everything below here belongs under the profile text. */
    let anchor=profileCard;

    const attachment=sheet.querySelector('.pmV63Attachment:not(.pmV67ShadAttachment)');
    if(attachment){
      attachment.classList.add('pmV85ProfileAttachment');
      const btn=attachment.querySelector('button');
      if(btn)btn.textContent='PDF / screenshot attached';
      if(anchor.nextElementSibling!==attachment)anchor.insertAdjacentElement('afterend',attachment);
      anchor=attachment;
    }

    const tools=sheet.querySelector('.pmInlineTools');
    if(tools){
      tools.classList.add('pmV85ProfileTools');
      if(anchor.nextElementSibling!==tools)anchor.insertAdjacentElement('afterend',tools);
    }
  }

  let queued=false;
  function schedule(){
    if(queued)return;
    queued=true;
    requestAnimationFrame(()=>{queued=false;profileDetail();});
  }

  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
  schedule();
})();
