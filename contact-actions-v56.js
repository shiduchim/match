/* PeerMatch v57: clear direct-contact actions inside profile and shadchan details.
   - Guy/Girl profile: Contact person.
   - Shadchan detail: Contact shadchan.
   - Call | Email | SMS | WhatsApp all use the same blue button style.
*/
(function(){
  const style=document.createElement('style');
  style.textContent=`
    .pmContactLabel{
      font-size:14px;
      font-weight:850;
      color:var(--text);
      margin:10px 0 6px;
    }
    .pmUnifiedContact{
      display:grid!important;
      grid-template-columns:repeat(4,minmax(0,1fr))!important;
      gap:6px!important;
      margin:0 0 11px!important;
    }
    .pmUnifiedContact button{
      width:100%!important;
      min-width:0;
      min-height:39px!important;
      padding:8px 3px!important;
      border-radius:10px!important;
      font-size:10.5px!important;
      font-weight:800!important;
      color:#19324a!important;
      border:0!important;
      background:#dfeef9!important;
    }
    .pmChannelCall,.pmChannelEmail,.pmChannelSms,.pmChannelWhatsApp{background:#dfeef9!important}
    @media(max-width:380px){
      .pmUnifiedContact{gap:4px!important}
      .pmUnifiedContact button{font-size:9.5px!important;padding:8px 2px!important;min-height:38px!important}
    }
  `;
  document.head.appendChild(style);

  function labelBefore(row,text,key){
    let label=row.previousElementSibling;
    if(!label||!label.classList.contains('pmContactLabel')||label.dataset.pmContactFor!==key){
      label=document.createElement('div');
      label.className='pmContactLabel';
      label.dataset.pmContactFor=key;
      row.insertAdjacentElement('beforebegin',label);
    }
    if(label.textContent!==text)label.textContent=text;
  }

  function addChannelClass(button,channel){
    if(!button)return;
    button.classList.add('pmChannel'+channel);
  }

  function ensureOrder(row,buttons){
    const wanted=buttons.filter(Boolean);
    const current=Array.from(row.children).filter(el=>wanted.includes(el));
    if(current.length===wanted.length&&current.every((el,i)=>el===wanted[i]))return;
    wanted.forEach(el=>row.appendChild(el));
  }

  function polishProfileContact(){
    const row=document.querySelector('#sheet .pmProfileContact');
    if(!row)return;
    const call=row.querySelector('[data-act="call"]');
    const email=row.querySelector('[data-act="email"]');
    const sms=row.querySelector('[data-act="sms"]');
    const wa=row.querySelector('[data-act="wa"]');
    if(!call||!email||!sms||!wa)return;

    labelBefore(row,'Contact person','person');
    row.classList.add('pmUnifiedContact');
    addChannelClass(call,'Call');
    addChannelClass(email,'Email');
    addChannelClass(sms,'Sms');
    addChannelClass(wa,'WhatsApp');
    ensureOrder(row,[call,email,sms,wa]);
  }

  function polishShadchanContact(){
    const row=document.querySelector('#sheet .v19Contact');
    if(!row)return;
    const call=row.querySelector('#v19Call');
    const email=row.querySelector('#v19Email');
    const sms=row.querySelector('#v19Sms');
    const wa=row.querySelector('#v19Wa');
    if(!call||!email||!sms||!wa)return;

    labelBefore(row,'Contact shadchan','shadchan');
    row.classList.add('pmUnifiedContact');
    addChannelClass(call,'Call');
    addChannelClass(email,'Email');
    addChannelClass(sms,'Sms');
    addChannelClass(wa,'WhatsApp');
    ensureOrder(row,[call,email,sms,wa]);
  }

  function polish(){
    polishProfileContact();
    polishShadchanContact();
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
