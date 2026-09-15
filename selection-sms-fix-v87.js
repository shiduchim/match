/* PeerMatch v87: keep one stable SMS button in Guys/Girls selection bars. */
(function(){
  document.documentElement.dataset.peerMatchVersion='87';

  function isSmsButton(b,k){
    if(!b)return false;
    const id=String(b.id||'');
    const text=String(b.textContent||'').trim().toLowerCase();
    return id==='pmSms-'+k||id==='pmSms65-'+k||text==='sms';
  }

  function stabilize(k){
    const bar=document.getElementById('pmSelected-'+k);
    if(!bar||bar.classList.contains('hidden'))return;

    const all=[...bar.querySelectorAll('button')].filter(b=>isSmsButton(b,k));
    let keep=all.find(b=>b.id==='pmSms-'+k)||all[0]||null;

    if(!keep){
      const email=bar.querySelector('#pmEmail-'+k);
      if(!email)return;
      keep=document.createElement('button');
      keep.type='button';
      keep.className='secondary';
      keep.textContent='SMS';
      keep.id='pmSms-'+k;
      keep.dataset.pmV65Sms='1';
      email.insertAdjacentElement('beforebegin',keep);
    }else{
      keep.id='pmSms-'+k;
      keep.type='button';
      keep.textContent='SMS';
      keep.dataset.pmV65Sms='1';
    }

    for(const b of all){
      if(b!==keep)b.remove();
    }

    const share=bar.querySelector('.pmSelShare');
    const email=bar.querySelector('#pmEmail-'+k);
    const wa=bar.querySelector('#pmWhatsApp-'+k);
    if(share){
      if(email&&email.parentElement!==share)share.appendChild(email);
      if(keep.parentElement!==share)share.appendChild(keep);
      if(wa&&wa.parentElement!==share)share.appendChild(wa);
      if(email&&keep.previousElementSibling!==email)email.insertAdjacentElement('afterend',keep);
      if(wa&&keep.nextElementSibling!==wa)keep.insertAdjacentElement('afterend',wa);
    }
  }

  let queued=false;
  function schedule(){
    if(queued)return;
    queued=true;
    requestAnimationFrame(()=>{
      queued=false;
      stabilize('guys');
      stabilize('girls');
    });
  }

  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
  schedule();
})();
