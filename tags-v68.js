/* PeerMatch v68: make all Tags inputs reliably editable. */
(function(){
  document.documentElement.dataset.peerMatchVersion='68';

  const css=document.createElement('style');
  css.textContent=`
    #sheet #pmV62InlineTags,
    #sheet #pmV62FormTags,
    #sheet #st,
    #sheet #v19STags,
    #sheet #esTags{
      pointer-events:auto!important;
      touch-action:manipulation!important;
      user-select:text!important;
      -webkit-user-select:text!important;
      position:relative!important;
      z-index:4!important;
      background:#fff!important;
      color:var(--text)!important;
      opacity:1!important;
      cursor:text!important;
    }
  `;
  document.head.appendChild(css);

  function fixTags(){
    const selectors='#pmV62InlineTags,#pmV62FormTags,#st,#v19STags,#esTags';
    document.querySelectorAll('#sheet '+selectors.split(',').join(',#sheet ')).forEach(el=>{
      el.disabled=false;
      el.readOnly=false;
      if(el.dataset.pmV68Tags==='1')return;
      el.dataset.pmV68Tags='1';
      el.autocomplete='off';
      el.addEventListener('pointerdown',e=>e.stopPropagation());
      el.addEventListener('click',e=>{e.stopPropagation();el.focus();});
      el.addEventListener('keydown',e=>e.stopPropagation());
    });
  }

  let queued=false;
  function schedule(){
    if(queued)return;
    queued=true;
    requestAnimationFrame(()=>{queued=false;fixTags();});
  }
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
  schedule();
})();
