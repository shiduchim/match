/* PeerMatch v122: audio-only profiles remain valid for fast entry; normal Profile text
   is required only before sending/sharing a match. Selection now comes from the same
   ID-based source used by the rest of the current app, with the old DOM mapping only as
   a compatibility fallback. */
(function(){
  document.documentElement.dataset.peerMatchVersion='122';

  function senderName(x){return String(x?.sourceName||x?.source||'').trim();}
  function senderPhone(x){return String(x?.sourcePhone||'').trim();}

  function visibleFor(k){
    const searchId=k==='shadchanim'?'shadchanSearch':k+'Search';
    const q=(document.getElementById(searchId)?.value||'').toLowerCase();
    return (data[k]||[]).filter(x=>{
      const hay=k==='shadchanim'
        ?`${x.name||''} ${x.phone||''} ${x.email||''} ${x.tags||''} ${(x.activities||[]).map(a=>a.text||a.action||'').join(' ')}`
        :`${x.name||''} ${x.age||''} ${x.text||''} ${senderName(x)} ${senderPhone(x)} ${(x.activities||[]).map(a=>a.text||a.action||'').join(' ')}`;
      return hay.toLowerCase().includes(q);
    });
  }

  function checkedRecords(k){
    if(typeof window.pmGetSelected==='function'){
      try{return window.pmGetSelected(k)||[];}catch(e){}
    }
    const listId=k==='shadchanim'?'shadchanList':k+'List';
    const list=document.getElementById(listId);
    if(!list)return[];
    const arr=visibleFor(k);
    const boxes=[...list.querySelectorAll('.pmListCheck')];
    const out=[];
    boxes.forEach((box,i)=>{if(box.checked&&arr[i])out.push(arr[i]);});
    return out;
  }

  function missingTextMessage(){
    const guys=checkedRecords('guys');
    const girls=checkedRecords('girls');
    if(guys.length!==1||girls.length!==1)return'';

    const guyMissing=!String(guys[0]?.text||'').trim();
    const girlMissing=!String(girls[0]?.text||'').trim();
    if(!guyMissing&&!girlMissing)return'';

    if(guyMissing&&girlMissing){
      return 'Add some Profile text for both the selected Guy and Girl before sending or sharing this match. Audio-only profiles can still be saved for fast entry.';
    }
    if(guyMissing){
      return 'Add some Profile text for the selected Guy before sending or sharing this match. His Audio Profile can stay saved.';
    }
    return 'Add some Profile text for the selected Girl before sending or sharing this match. Her Audio Profile can stay saved.';
  }

  const guardedIds=new Set(['pmMatchSMS','pmMatchWA','pmMatchEmail','pmMatchSharePhoto']);
  document.addEventListener('click',function(e){
    const btn=e.target?.closest?.('button');
    if(!btn||!guardedIds.has(btn.id))return;
    const msg=missingTextMessage();
    if(!msg)return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    alert(msg);
  },true);
})();
