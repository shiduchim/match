/* PeerMatch v89: waiting counters and yellow rows for Guys/Girls. */
(function(){
  document.documentElement.dataset.peerMatchVersion='89';

  const style=document.createElement('style');
  style.textContent=`
    #guysSection h1,#girlsSection h1{display:flex;align-items:center;gap:9px;flex-wrap:wrap}
    .pmV89WaitingCount{display:inline-flex!important;align-items:center!important;gap:5px!important;padding:6px 9px!important;border-radius:999px!important;background:#fff1cf!important;color:#76551c!important;border:1px solid #ead79d!important;font-size:10.5px!important;font-weight:850!important;width:auto!important}
    .pmV89WaitingCount.zero{background:#eef3f6!important;color:#71808a!important;border-color:#dce4e8!important}
    #guysList .pmV89WaitingRow,#girlsList .pmV89WaitingRow{background:#fff7dd!important;border-color:#ead79d!important}
    .pmV89WaitingList{position:fixed;inset:0;z-index:14000;background:rgba(0,0,0,.38);display:flex;align-items:flex-end;justify-content:center;padding:14px}
    .pmV89WaitingSheet{width:min(560px,100%);max-height:75vh;overflow:auto;background:#fff;border-radius:18px;padding:15px;box-shadow:0 12px 36px rgba(0,0,0,.28)}
    .pmV89WaitingRowBtn{width:100%!important;text-align:left!important;margin:6px 0!important;padding:10px 11px!important;border-radius:11px!important;background:#fff7dd!important;color:var(--text)!important;border:1px solid #ead79d!important}
    .pmV89WaitingRowBtn b{display:block;font-size:13px}.pmV89WaitingRowBtn span{display:block;font-size:10px;color:var(--muted);margin-top:2px}
  `;
  document.head.appendChild(style);

  const senderName=x=>String(x?.sourceName||x?.source||'').trim();
  const senderPhone=x=>String(x?.sourcePhone||'').trim();
  const waiters=k=>(data[k]||[]).filter(x=>x.waitingForReply===true);

  function visible(k){
    const q=String(document.getElementById(k+'Search')?.value||'').toLowerCase();
    return (data[k]||[]).filter(x=>{
      const hay=`${x.name||''} ${x.age||''} ${x.text||''} ${senderName(x)} ${senderPhone(x)} ${(x.activities||[]).map(a=>a.text||a.action||'').join(' ')}`;
      return hay.toLowerCase().includes(q);
    });
  }

  function markRows(k){
    const list=document.getElementById(k+'List');if(!list)return;
    const cards=[...list.children].filter(el=>el.classList?.contains('card'));
    const arr=visible(k);
    if(cards.length===arr.length){
      cards.forEach((card,i)=>card.classList.toggle('pmV89WaitingRow',arr[i]?.waitingForReply===true));
      return;
    }
    for(const card of cards){
      const name=String(card.querySelector('.name')?.textContent||'').trim();
      const matches=(data[k]||[]).filter(x=>String(x.name||'').trim()===name);
      card.classList.toggle('pmV89WaitingRow',matches.length===1&&matches[0].waitingForReply===true);
    }
  }

  function openWaiting(k){
    document.querySelector('.pmV89WaitingList')?.remove();
    const items=waiters(k);
    if(items.length===1){openP(k,items[0].id);return;}
    const shade=document.createElement('div');shade.className='pmV89WaitingList';
    const box=document.createElement('div');box.className='pmV89WaitingSheet';
    box.innerHTML=`<div style="font-weight:900;font-size:17px;margin-bottom:8px">Waiting for reply (${items.length})</div>${items.length?'':'<div style="font-size:13px;color:#73818b;padding:12px 0">Nobody is marked waiting.</div>'}<div class="pmV89WaitingRows"></div><button type="button" class="secondary full pmV89WaitingClose" style="margin-top:9px">Close</button>`;
    shade.appendChild(box);document.body.appendChild(shade);
    const rows=box.querySelector('.pmV89WaitingRows');
    items.forEach(x=>{
      const b=document.createElement('button');b.type='button';b.className='pmV89WaitingRowBtn';
      const safeName=String(x.name||'Unnamed profile').replace(/[<>]/g,'');
      const safeSince=String(x.waitingForReplySince||'').replace(/[<>]/g,'');
      b.innerHTML=`<b>${safeName}</b><span>${safeSince}</span>`;
      b.onclick=()=>{shade.remove();openP(k,x.id);};rows.appendChild(b);
    });
    box.querySelector('.pmV89WaitingClose').onclick=()=>shade.remove();
    shade.onclick=e=>{if(e.target===shade)shade.remove();};
  }

  function badge(k){
    const sec=document.getElementById(k+'Section'),h=sec?.querySelector('h1');if(!h)return;
    const id='pmV89WaitingCount-'+k;
    let b=document.getElementById(id);
    if(!b){b=document.createElement('button');b.type='button';b.id=id;b.className='pmV89WaitingCount';h.appendChild(b);b.onclick=()=>openWaiting(k);}
    const n=waiters(k).length;b.textContent='Waiting for reply '+n;b.classList.toggle('zero',n===0);
  }

  function refresh(k){badge(k);markRows(k);}
  const priorRenderP=window.renderP;
  if(typeof priorRenderP==='function')window.renderP=function(k){const r=priorRenderP(k);if(k==='guys'||k==='girls')requestAnimationFrame(()=>refresh(k));return r;};

  let queued=false;
  function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;refresh('guys');refresh('girls');});}
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
  setTimeout(schedule,250);
})();