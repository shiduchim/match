/* PeerMatch v84: choose whether PDF/screenshot attachments are parsed or only stored. */
(function(){
  document.documentElement.dataset.peerMatchVersion='84';

  const style=document.createElement('style');
  style.textContent=`
    #pmV63Scan .pmV63ScanActions{
      display:grid!important;
      grid-template-columns:minmax(0,1fr) minmax(0,1fr) auto!important;
      gap:6px!important;
      margin-top:6px!important;
    }
    #pmV63Scan .pmV63ScanActions button{
      width:auto!important;
      min-width:0!important;
      padding:8px 7px!important;
      font-size:10.5px!important;
      line-height:1.15!important;
      white-space:normal!important;
    }
    #pmV63Scan .pmV84AttachParse{background:#e8f1f7!important;color:#274b64!important}
    #pmV63Scan .pmV84AttachOnly{background:#f3f5f6!important;color:var(--text)!important}
    @media(max-width:390px){
      #pmV63Scan .pmV63ScanActions{grid-template-columns:1fr 1fr!important}
      #pmV63Scan #pmV63Remove{grid-column:1 / -1!important}
    }
  `;
  document.head.appendChild(style);

  async function callOriginal(fn,input,event){
    if(typeof fn!=='function')return;
    const result=fn.call(input,event);
    if(result&&typeof result.then==='function')await result;
  }

  function enhance(){
    const box=document.getElementById('pmV63Scan');
    const input=box?.querySelector('#pmV63Input');
    const actions=box?.querySelector('.pmV63ScanActions');
    if(!box||!input||!actions||box.dataset.pmV84Choice==='1')return;

    const originalChange=input.onchange;
    if(typeof originalChange!=='function')return;

    box.dataset.pmV84Choice='1';

    // The old single attach button may have been moved into the top tools area by an older UI layer.
    // Hide it so the user has one clear attachment control with two explicit choices.
    document.querySelectorAll('#pmV63Attach').forEach(b=>{b.style.display='none';});

    const remove=box.querySelector('#pmV63Remove');
    actions.innerHTML='';

    const attachOnly=document.createElement('button');
    attachOnly.type='button';
    attachOnly.className='secondary pmV84AttachOnly';
    attachOnly.textContent='Attach only';

    const attachParse=document.createElement('button');
    attachParse.type='button';
    attachParse.className='secondary pmV84AttachParse';
    attachParse.textContent='Attach + parse text';

    actions.append(attachOnly,attachParse);
    if(remove)actions.appendChild(remove);

    attachOnly.onclick=()=>{input.dataset.pmV84Mode='attach-only';input.click();};
    attachParse.onclick=()=>{input.dataset.pmV84Mode='parse';input.click();};

    input.onchange=async function(event){
      const mode=input.dataset.pmV84Mode||'parse';
      delete input.dataset.pmV84Mode;
      const target=document.getElementById('v19Profile')||document.getElementById('pmV63ShadProfile');
      const status=box.querySelector('#pmV63Status');

      if(mode==='attach-only'){
        // The v63 handler skips parsing when profile text is non-empty. Use a temporary marker
        // so the exact same storage path runs without OCR/text extraction.
        const previous=target?String(target.value||''):'';
        const marker='__PEERMATCH_ATTACH_ONLY_V84__';
        const seeded=!!target&&!previous.trim();
        if(seeded)target.value=marker;
        try{
          await callOriginal(originalChange,input,event);
          if(status)status.textContent='Attached without parsing text.';
        }finally{
          if(seeded&&target&&target.value===marker)target.value='';
        }
        return;
      }

      // Explicit parse should actually parse even when profile text already exists.
      // Temporarily clear existing text so the old parser runs, then restore the user's text.
      const previous=target?String(target.value||''):'';
      const preserve=!!target&&!!previous.trim();
      if(preserve)target.value='';
      try{
        await callOriginal(originalChange,input,event);
      }finally{
        if(preserve&&target)target.value=previous;
      }
    };
  }

  let queued=false;
  function schedule(){
    if(queued)return;
    queued=true;
    requestAnimationFrame(()=>{queued=false;enhance();});
  }
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
  schedule();
})();
