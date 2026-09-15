/* PeerMatch v57: compact, consistent forwarding layout for selected items.
   - Guys/Girls heading: Share this profile.
   - Shadchanim heading: Share this shadchan.
   - Email | SMS | WhatsApp use the same blue button style and slightly shorter height.
   - Selected count | Select all | Delete | Clear always stay together on one bottom row.
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
      gap:7px;
    }
    .pmSelShare button{
      width:100%!important;
      min-width:0;
      min-height:39px!important;
      margin:0!important;
      padding:8px 5px!important;
      border-radius:10px!important;
      font-size:11.5px!important;
      font-weight:800!important;
      color:#19324a!important;
      background:#dfeef9!important;
    }
    .pmChannelEmail,.pmChannelSms,.pmChannelWhatsApp{background:#dfeef9!important}
    .pmSelManage{
      display:flex!important;
      flex-wrap:nowrap!important;
      align-items:center!important;
      gap:5px!important;
      margin-top:8px;
      padding-top:8px;
      border-top:1px solid var(--line);
      min-width:0;
    }
    .pmSelManage .pmCount{
      margin:0!important;
      padding:0 2px 0 0!important;
      flex:0 0 auto!important;
      font-size:10px!important;
      font-weight:800;
      color:var(--muted);
      white-space:nowrap!important;
    }
    .pmSelManage button{
      flex:1 1 0!important;
      width:auto!important;
      min-width:0!important;
      margin:0!important;
      padding:7px 2px!important;
      min-height:32px!important;
      border-radius:9px!important;
      font-size:9.5px!important;
      line-height:1.05!important;
      font-weight:800!important;
      white-space:nowrap!important;
    }
    .pmSelManage .pmSelectAllBtn{background:#e8f1f7!important;color:#274b64!important}
    .pmSelManage .pmDanger{background:#fbe7e7!important;color:#8a2929!important}
    @media(max-width:390px){
      .pmSelShare{gap:5px}
      .pmSelShare button{font-size:11px!important;padding:8px 3px!important;min-height:38px!important}
      .pmSelManage{gap:3px!important}
      .pmSelManage .pmCount{font-size:9px!important}
      .pmSelManage button{font-size:8.8px!important;padding:7px 1px!important}
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
