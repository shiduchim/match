/* PeerMatch v86: profile form order = Contact person -> attachment -> Tags -> Religious level. */
(function(){
  document.documentElement.dataset.peerMatchVersion='86';

  function isProfileForm(){
    const sheet=document.getElementById('sheet');
    if(!sheet||!document.getElementById('v19Profile'))return false;
    const h=String(sheet.querySelector('h2')?.textContent||'');
    return /Guy|Girl/i.test(h);
  }

  function moveFormFields(){
    if(!isProfileForm())return;
    const sheet=document.getElementById('sheet');
    const contactGrid=sheet.querySelector('.v19Source.v39SenderGrid')||document.getElementById('v19Sender')?.closest('.v19Source');
    if(!contactGrid)return;

    let anchor=contactGrid;

    const scan=document.getElementById('pmV63Scan');
    if(scan){
      if(anchor.nextElementSibling!==scan)anchor.insertAdjacentElement('afterend',scan);
      anchor=scan;
    }

    const tagsInput=document.getElementById('pmV62FormTags');
    const tags=tagsInput?.closest('label');
    if(tags){
      if(anchor.nextElementSibling!==tags)anchor.insertAdjacentElement('afterend',tags);
      anchor=tags;
    }

    const rel=document.getElementById('pmV65RelForm');
    if(rel&&anchor.nextElementSibling!==rel)anchor.insertAdjacentElement('afterend',rel);
  }

  let queued=false;
  function schedule(){
    if(queued)return;
    queued=true;
    requestAnimationFrame(()=>{queued=false;moveFormFields();});
  }

  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
  schedule();
})();
