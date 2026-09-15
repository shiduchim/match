/* PeerMatch v56: clear forwarding layout for selected Guys, Girls, and Shadchanim.
   - Guys/Girls heading: Share this profile.
   - Shadchanim heading: Share this shadchan.
   - Email | SMS | WhatsApp are the main, slightly taller share buttons.
   - Selected count | Select all | Delete | Clear stay together on the bottom row.
*/
(function(){
  const style=document.createElement('style');
  style.textContent=`
    .pmSelectionBar.pmOrganizedSelection{
      display:block!important;
      padding:11px!important;
    }
    .pmSelTitle{
      font-size:14px;
      font-weight:850;
      color:var(--text);
      margin:0 0 8px;
    }
    .pmSelShare{
      display:grid;
      grid-template-columns:repeat(3,minmax(0,1fr));
      gap:8px;
    }
    .pmSelShare button{
      width:100%!important;
      min-width:0;
      min-height:44px!important;
      margin:0!important;
      padding:10px 6px!important;
      border-radius:11px!important;
      font-size:12px!important;
      font-weight:800!important;
      color:#19324a!important;
    }
    .pmChannelEmail{background:#dfeef9!important}
    .pmChannelSms{background:#d2e6f4!important}
    .pmChannelWhatsApp{background:#c3dcf0!important}
    .pmSelManage{
      display:grid;
      grid-template-columns:auto repeat(3,minmax(0,1fr));
      align-items:center;
      gap:6px;
      margin-top:9px;
      padding-top:9px;
      border-top:1px solid var(--line);
    }
    .pmSelManage .pmCount{
      margin:0!important;
      padding:0 3px 0 1px;
      font-size:11px!important;
      font-weight:800;
      color:var(--muted);
      white-space:nowrap;
    }
    .pmSelManage button{
      width:100%!important;
      min-width:0;
      margin:0!important;
      padding:7px 5px!important;
      min-height:34px!important;
      border-radius:9px!important;
      font-size:10.5px!important;
      font-weight:800!important;
    }
    .pmSelManage .pmSelectAllBtn{background:#e8f1f7!important;color:#274b64!important}
    .pmSelManage .pmDanger{background:#fbe7e7!important;color:#8a2929!important}
    @media(max-width:390px){
      .pmSelShare{gap:6px}
      .pmSelShare button{font-size:11.5px!important;padding:9px 4px!important}
      .pmSelManage{gap:4px}
      .pmSelManage .pmCount{font-size:10px!important}
      .pmSelManage button{font-size:9.5px!important;padding:7px 3px!important}
    }
  `;
  document.head.appendChild(style);

  function listFor(k){
    return document.getElementById(k==='shadchanim'?'shadchanList':k+'List');
  }

  function selectAllVisible(k){
    let attempts=0;
    function next(){
      const list=listFor(k);
      if(!list)return;
      const check=Array.from(list.querySelectorAll('.pmListCheck')).find(c=>!c.checked);
      if(!check||attempts++>500)return;
      check.click();
      requestAnimationFrame(next);
    }
    next();
  }

  function ensureSelectAll(bar,k){
    let b=bar.querySelector('#pmSelectAll-'+k);
    if(!b){
      b=document.createElement('button');
      b.id='pmSelectAll-'+k;
      b.type='button';
      b.className='pmSelectAllBtn';
      b.textContent='Select all';
      b.onclick=()=>selectAllVisible(k);
    }
    return b;
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

    let title=bar.querySelector('.pmSelTitle');
    let share=bar.querySelector('.pmSelShare');
    let manage=bar.querySelector('.pmSelManage');
    if(!title){title=document.createElement('div');title.className='pmSelTitle';}
    if(!share){share=document.createElement('div');share.className='pmSelShare';}
    if(!manage){manage=document.createElement('div');manage.className='pmSelManage';}
    title.textContent=k==='shadchanim'?'Share this shadchan':'Share this profile';

    email.classList.add('pmChannelEmail');
    sms.classList.add('pmChannelSms');
    wa.classList.add('pmChannelWhatsApp');

    const selectAll=ensureSelectAll(bar,k);

    share.appendChild(email);
    share.appendChild(sms);
    share.appendChild(wa);

    manage.appendChild(count);
    manage.appendChild(selectAll);
    manage.appendChild(del);
    manage.appendChild(clear);

    // Remove the previous v54 header if it is still present after the count moved.
    const oldHeader=bar.querySelector('.pmSelHeader');
    if(oldHeader&&!oldHeader.children.length)oldHeader.remove();

    if(bar.children[0]!==title)bar.insertBefore(title,bar.firstChild);
    if(title.nextElementSibling!==share)title.insertAdjacentElement('afterend',share);
    if(share.nextElementSibling!==manage)share.insertAdjacentElement('afterend',manage);
    bar.classList.add('pmOrganizedSelection');
  }

  function organizeAll(){
    organize('guys');
    organize('girls');
    organize('shadchanim');
  }

  let queued=false;
  function schedule(){
    if(queued)return;
    queued=true;
    requestAnimationFrame(()=>{queued=false;organizeAll();});
  }

  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
  schedule();
})();
