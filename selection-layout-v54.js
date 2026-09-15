/* PeerMatch v54: cleaner selected-profile action layout.
   Row 1: selected count + Select all
   Row 2: Email | SMS | WhatsApp
   Row 3: Delete | Clear, visually separated from sharing actions.
*/
(function(){
  const style=document.createElement('style');
  style.textContent=`
    .pmSelectionBar.pmOrganizedSelection{
      display:block!important;
      padding:11px!important;
    }
    .pmSelHeader{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:10px;
      margin-bottom:9px;
    }
    .pmSelHeader .pmCount{
      margin:0!important;
      font-size:13px;
      white-space:nowrap;
    }
    .pmSelHeader button{
      margin:0!important;
      width:auto!important;
      flex:0 0 auto;
    }
    .pmSelShare{
      display:grid;
      grid-template-columns:repeat(3,minmax(0,1fr));
      gap:8px;
    }
    .pmSelManage{
      display:grid;
      grid-template-columns:repeat(2,minmax(0,1fr));
      gap:8px;
      margin-top:10px;
      padding-top:10px;
      border-top:1px solid var(--line);
    }
    .pmSelShare button,.pmSelManage button{
      width:100%!important;
      margin:0!important;
      min-width:0;
    }
    @media(max-width:390px){
      .pmSelShare{gap:6px}
      .pmSelShare button,.pmSelManage button{font-size:11.5px!important;padding:8px 5px!important}
    }
  `;
  document.head.appendChild(style);

  function findSelectAll(bar){
    return Array.from(bar.querySelectorAll('button')).find(b=>b.textContent.trim().toLowerCase()==='select all')||null;
  }

  function organize(k){
    const bar=document.getElementById('pmSelected-'+k);
    if(!bar||bar.classList.contains('hidden'))return;

    const count=bar.querySelector('.pmCount');
    const email=bar.querySelector('#pmEmail-'+k);
    const sms=bar.querySelector('#pmSms-'+k);
    const wa=bar.querySelector('#pmWhatsApp-'+k);
    const del=bar.querySelector('#pmDelete-'+k);
    const clear=bar.querySelector('#pmClear-'+k);
    if(!count||!email||!sms||!wa||!del||!clear)return;

    let header=bar.querySelector('.pmSelHeader');
    let share=bar.querySelector('.pmSelShare');
    let manage=bar.querySelector('.pmSelManage');
    if(!header){header=document.createElement('div');header.className='pmSelHeader';}
    if(!share){share=document.createElement('div');share.className='pmSelShare';}
    if(!manage){manage=document.createElement('div');manage.className='pmSelManage';}

    const selectAll=findSelectAll(bar);
    header.appendChild(count);
    if(selectAll)header.appendChild(selectAll);

    // User-facing order: Email, SMS, WhatsApp.
    share.appendChild(email);
    share.appendChild(sms);
    share.appendChild(wa);

    // Management actions stay visually separate below sharing actions.
    manage.appendChild(del);
    manage.appendChild(clear);

    if(!header.parentNode)bar.appendChild(header);
    if(!share.parentNode)bar.appendChild(share);
    if(!manage.parentNode)bar.appendChild(manage);
    bar.classList.add('pmOrganizedSelection');
  }

  function organizeAll(){organize('guys');organize('girls');}

  let queued=false;
  function schedule(){
    if(queued)return;
    queued=true;
    requestAnimationFrame(()=>{queued=false;organizeAll();});
  }

  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
  schedule();
})();
