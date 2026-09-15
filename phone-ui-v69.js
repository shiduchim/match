/* PeerMatch v69: simpler phone UI + safer linked-profile matching. */
(function(){
  document.documentElement.dataset.peerMatchVersion='69';

  const css=document.createElement('style');
  css.textContent=`
    #sheet .pmV69PhoneLink{
      color:#315b78!important;
      font-weight:800!important;
      text-decoration:none!important;
      cursor:pointer!important;
      white-space:nowrap
    }
    #sheet .pmV69PhoneLink:active{text-decoration:underline!important}
    #sheet .pmV69ShadPhone{margin:6px 0 10px;padding:7px 9px;border:1px solid #d7e2e9;border-radius:10px;background:#fff;font-size:12px}
  `;
  document.head.appendChild(css);

  const norm=s=>String(s||'').trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ' ).trim();
  const phoneHref=p=>'tel:'+String(p||'').replace(/\s+/g,'');

  function removeCopyPhone(){
    const sheet=document.getElementById('sheet');if(!sheet)return;
    for(const box of sheet.querySelectorAll('.pmV65PhoneCopy')){
      const text=String(box.textContent||'').replace(/\bCopy\b|\bCopied\b/gi,'').replace(/^Phone:\s*/i,'').trim();
      if(!text){box.remove();continue;}
      const a=document.createElement('a');
      a.className='pmV69PhoneLink';a.href=phoneHref(text);a.textContent=text;
      box.className='pmV69ShadPhone';box.innerHTML='<b>Phone:</b> ';box.appendChild(a);
    }
  }

  function clickableProfilePhones(){
    const sheet=document.getElementById('sheet');if(!sheet)return;
    for(const el of sheet.querySelectorAll('.pmV67ContactPhone')){
      if(el.tagName==='A')continue;
      const p=String(el.textContent||'').trim();if(!p)continue;
      const a=document.createElement('a');a.className='pmV67ContactPhone pmV69PhoneLink';a.href=phoneHref(p);a.textContent=p;el.replaceWith(a);
    }
  }

  function shadchanNameFromDetail(){
    return String(document.querySelector('#sheet .v19ShadHead h2')?.textContent||'').trim();
  }

  function removeObviousSelfLinks(){
    const sheet=document.getElementById('sheet');if(!sheet)return;

    // On a Shadchan page, remove a linked Guy/Girl button when it has the same name as the Shadchan.
    const shName=norm(shadchanNameFromDetail());
    if(shName){
      for(const box of sheet.querySelectorAll('.pmV64ReverseLinks')){
        for(const b of box.querySelectorAll('.pmV64LinkBtn')){
          const raw=String(b.textContent||'').replace(/^Guy:\s*|^Girl:\s*/i,'').trim();
          if(norm(raw)===shName)b.remove();
        }
        const left=box.querySelectorAll('.pmV64LinkBtn').length;
        if(!left)box.remove();
        else{
          const title=box.querySelector('b');if(title)title.textContent=`Linked profiles (${left})`;
        }
      }
    }

    // On a Guy/Girl profile, suppress an auto-linked Shadchan when the displayed Shadchan name is the same as the profile name.
    const profileName=norm(document.querySelector('#sheet .v19Head h2')?.textContent||'');
    if(profileName){
      for(const box of sheet.querySelectorAll('.pmV64ProfileLink')){
        const txt=String(box.textContent||'');
        const m=txt.match(/Linked shadchan:\s*([^\n]+)/i);
        if(m&&norm(m[1].replace(/Open shadchan.*$/i,''))===profileName)box.remove();
      }
    }
  }

  function polish(){removeCopyPhone();clickableProfilePhones();removeObviousSelfLinks();}
  let queued=false;
  function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;polish();});}
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
  schedule();
})();
