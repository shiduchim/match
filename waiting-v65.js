/* PeerMatch v88: Waiting for reply for shadchanim and profiles, with compact contact actions. */
(function(){
  let activeShad=null,activeProfile=null,queued=false;

  const css=document.createElement('style');
  css.textContent=`
    #shadchanimSection h1{display:flex;align-items:center;gap:9px;flex-wrap:wrap}
    .pmV65WaitingCount{display:inline-flex;align-items:center;gap:5px;padding:6px 9px!important;border-radius:999px!important;background:#fff1cf!important;color:#76551c!important;border:1px solid #ead79d!important;font-size:10.5px!important;font-weight:850!important}
    .pmV65WaitingCount.zero{background:#eef3f6!important;color:#71808a!important;border-color:#dce4e8!important}

    #sheet .pmProfileContact.pmV88ContactRow,
    #sheet .v19Contact.pmV88ContactRow{
      display:grid!important;
      grid-template-columns:repeat(5,minmax(0,1fr))!important;
      gap:4px!important;
    }
    #sheet .pmV88ContactRow button{
      min-width:0!important;
      width:100%!important;
      padding:8px 2px!important;
      font-size:9px!important;
      line-height:1.08!important;
      white-space:normal!important;
    }
    #sheet .pmV88WaitToggle{
      background:#eef3f6!important;
      color:#536b7a!important;
      border:1px solid #dce4e8!important;
      font-weight:850!important;
    }
    #sheet .pmV88WaitToggle.waiting{
      background:#fff1cf!important;
      color:#76551c!important;
      border-color:#ead79d!important;
    }
    #shadchanList .pmV88WaitingRow{
      background:#fff7dd!important;
      border-color:#ead79d!important;
    }

    .pmV65WaitingList{position:fixed;inset:0;z-index:14000;background:rgba(0,0,0,.38);display:flex;align-items:flex-end;justify-content:center;padding:14px}
    .pmV65WaitingSheet{width:min(560px,100%);max-height:75vh;overflow:auto;background:#fff;border-radius:18px;padding:15px;box-shadow:0 12px 36px rgba(0,0,0,.28)}
    .pmV65WaitingRow{width:100%;text-align:left;margin:6px 0;padding:10px 11px!important;border-radius:11px!important;background:#f7fafc!important;color:var(--text)!important;border:1px solid #dbe5ea!important}
    .pmV65WaitingRow b{display:block;font-size:13px}.pmV65WaitingRow span{display:block;font-size:10px;color:var(--muted);margin-top:2px}
    @media(max-width:390px){
      #sheet .pmV88ContactRow{gap:3px!important}
      #sheet .pmV88ContactRow button{font-size:8.4px!important;padding:8px 1px!important}
    }
  `;
  document.head.appendChild(css);

  const rec=(k,id)=>(data[k]||[]).find(x=>String(x.id)===String(id))||null;
  const shad=id=>rec('shadchanim',id);
  const shadWaiters=()=> (data.shadchanim||[]).filter(x=>x.waitingForReply===true);
  function stampNow(){return typeof stamp==='function'?stamp():new Date().toLocaleString();}

  function titleBadge(){
    const sec=document.getElementById('shadchanimSection'),h=sec?.querySelector('h1');if(!h)return;
    let b=document.getElementById('pmV65WaitingCount');
    if(!b){b=document.createElement('button');b.type='button';b.id='pmV65WaitingCount';b.className='pmV65WaitingCount';h.appendChild(b);b.onclick=openWaiting;}
    const n=shadWaiters().length;b.textContent='Waiting for reply '+n;b.classList.toggle('zero',n===0);
  }

  function openWaiting(){
    document.getElementById('pmV65WaitingList')?.remove();const items=shadWaiters();
    if(items.length===1){openS(items[0].id);return;}
    const shade=document.createElement('div');shade.id='pmV65WaitingList';shade.className='pmV65WaitingList';const box=document.createElement('div');box.className='pmV65WaitingSheet';
    box.innerHTML=`<div style="font-weight:900;font-size:17px;margin-bottom:8px">Waiting for reply (${items.length})</div>${items.length?'':'<div style="font-size:13px;color:#73818b;padding:12px 0">Nobody is marked waiting.</div>'}<div id="pmV65WaitingRows"></div><button id="pmV65WaitingClose" class="secondary full" style="margin-top:9px">Close</button>`;
    shade.appendChild(box);document.body.appendChild(shade);const rows=box.querySelector('#pmV65WaitingRows');
    items.forEach(x=>{const b=document.createElement('button');b.type='button';b.className='pmV65WaitingRow';b.innerHTML=`<b>${String(x.name||'Unnamed shadchan').replace(/[<>]/g,'')}</b><span>${String(x.waitingForReplySince||'').replace(/[<>]/g,'')}</span>`;b.onclick=()=>{shade.remove();openS(x.id);};rows.appendChild(b);});
    box.querySelector('#pmV65WaitingClose').onclick=()=>shade.remove();shade.onclick=e=>{if(e.target===shade)shade.remove();};
  }

  function historyToggle(x,on){
    x.activities=x.activities||[];
    if(on){
      x.waitingForReplySince=stampNow();
      x.activities.push({id:Date.now(),type:'action',action:'Waiting for reply',text:'Marked waiting for reply.',ts:stampNow()});
    }else{
      x.waitingForReplySince='';
      x.activities.push({id:Date.now(),type:'action',action:'Reply received',text:'Cleared waiting for reply.',ts:stampNow()});
    }
  }

  async function toggleRecord(k,x,button){
    if(!x)return;
    x.waitingForReply=!x.waitingForReply;
    historyToggle(x,!!x.waitingForReply);
    drawWait(button,x);
    try{
      await save();
      if(k==='shadchanim'){try{renderS();}catch(_){}}
      else{try{renderP(k);}catch(_){}}
    }catch(e){console.warn('PeerMatch waiting save',e);}
    titleBadge();
    setTimeout(()=>{markShadRows();if(k==='shadchanim'&&activeShad!=null)shadDetail(activeShad);else if(activeProfile)profileDetail(activeProfile.k,activeProfile.id);},40);
  }

  function drawWait(b,x){
    if(!b||!x)return;
    b.innerHTML='Waiting<br>for reply';
    b.classList.add('pmV88WaitToggle');
    b.classList.toggle('waiting',!!x.waitingForReply);
    b.title=x.waitingForReply?'Reply received? Tap to clear waiting.':'Tap to mark waiting for reply.';
  }

  function reorderProfileButtons(row){
    if(!row)return;
    const call=row.querySelector('[data-act="call"]');
    const email=row.querySelector('[data-act="email"]');
    const wa=row.querySelector('[data-act="wa"]');
    const sms=row.querySelector('[data-act="sms"]');
    for(const b of [call,email,wa,sms])if(b)row.appendChild(b);
  }

  function reorderShadButtons(row){
    if(!row)return;
    const call=row.querySelector('#v19Call');
    const email=row.querySelector('#v19Email');
    const wa=row.querySelector('#v19Wa');
    const sms=row.querySelector('#v19Sms');
    for(const b of [call,email,wa,sms])if(b)row.appendChild(b);
  }

  function profileDetail(k,id){
    if(k!=='guys'&&k!=='girls')return;
    const x=rec(k,id),sheet=document.getElementById('sheet'),row=sheet?.querySelector('.pmProfileContact');
    if(!x||!sheet||!row||document.getElementById('v19Profile'))return;
    row.classList.add('pmV88ContactRow');
    reorderProfileButtons(row);
    let b=row.querySelector('.pmV88ProfileWait');
    if(!b){b=document.createElement('button');b.type='button';b.className='pmV88ProfileWait pmV88WaitToggle';row.appendChild(b);b.onclick=()=>toggleRecord(k,x,b);}
    drawWait(b,x);
    row.appendChild(b);
  }

  function shadDetail(id){
    const x=shad(id),sheet=document.getElementById('sheet'),row=sheet?.querySelector('.v19Contact');
    if(!x||!sheet||!row||document.getElementById('v19SName')||document.getElementById('esName')||document.getElementById('sn'))return;
    row.classList.add('pmV88ContactRow');
    reorderShadButtons(row);
    const old=document.getElementById('pmV65WaitToggle');if(old&&!row.contains(old))old.remove();
    let b=row.querySelector('#pmV65WaitToggle');
    if(!b){b=document.createElement('button');b.type='button';b.id='pmV65WaitToggle';b.className='pmV88WaitToggle';row.appendChild(b);b.onclick=()=>toggleRecord('shadchanim',x,b);}
    drawWait(b,x);
    row.appendChild(b);
  }

  function visibleShads(){
    const q=String(document.getElementById('shadchanSearch')?.value||'').toLowerCase();
    return (data.shadchanim||[]).filter(x=>`${x.name||''} ${x.phone||''} ${x.email||''} ${x.tags||''} ${(x.activities||[]).map(a=>a.text||a.action||'').join(' ')}`.toLowerCase().includes(q));
  }

  function markShadRows(){
    const list=document.getElementById('shadchanList');if(!list)return;
    const cards=[...list.children].filter(e=>e.classList?.contains('card')),arr=visibleShads();
    if(cards.length===arr.length){
      cards.forEach((c,i)=>c.classList.toggle('pmV88WaitingRow',!!arr[i]?.waitingForReply));
      return;
    }
    for(const c of cards){
      const name=String(c.querySelector('.name')?.textContent||'').trim();
      const matches=(data.shadchanim||[]).filter(x=>String(x.name||'').trim()===name);
      c.classList.toggle('pmV88WaitingRow',matches.length===1&&matches[0].waitingForReply===true);
    }
  }

  const oldP=window.openP;
  if(typeof oldP==='function')window.openP=function(k,id){activeProfile={k,id};activeShad=null;const r=oldP(k,id);setTimeout(()=>profileDetail(k,id),50);return r;};
  const oldS=window.openS;
  if(typeof oldS==='function')window.openS=function(id){activeShad=id;activeProfile=null;const r=oldS(id);setTimeout(()=>shadDetail(id),50);return r;};
  const oldRender=window.renderS;
  if(typeof oldRender==='function')window.renderS=function(){const r=oldRender();requestAnimationFrame(()=>{titleBadge();markShadRows();});return r;};

  function polish(){
    titleBadge();markShadRows();
    if(activeProfile&&document.getElementById('sheet')&&!document.getElementById('v19Profile'))profileDetail(activeProfile.k,activeProfile.id);
    if(activeShad!=null&&document.getElementById('sheet')&&!document.getElementById('v19SName')&&!document.getElementById('esName')&&!document.getElementById('sn'))shadDetail(activeShad);
  }
  function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;polish();});}
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
  setTimeout(polish,300);
})();
