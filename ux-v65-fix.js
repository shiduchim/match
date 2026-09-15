/* PeerMatch v65 finishing touches. */
(function(){
  const s=document.createElement('style');
  s.textContent=`
    .pmRefGroup{display:none!important}
    #shadchanList .pmV65RefChild.pmRefCollapsed{display:block!important}
    #shadchanList .pmV65RefChild.pmV65RefHidden{display:none!important}
  `;
  document.head.appendChild(s);

  let queued=false;
  function polish(){
    const sheet=document.getElementById('sheet');if(!sheet)return;
    const shad=sheet.querySelector('.v19ShadHead');
    if(shad){
      const box=sheet.querySelector('.pmInlineTools');
      const history=[...sheet.querySelectorAll('.sectionTitle')].find(e=>/History|Conversation/i.test(e.textContent||''));
      if(box&&history&&box.nextElementSibling!==history)history.insertAdjacentElement('beforebegin',box);
    }
  }
  function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;polish();});}
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
  schedule();
})();
