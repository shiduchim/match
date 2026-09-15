/* PeerMatch v65: manual Waiting for reply tracking for shadchanim. */
(function(){
  let activeShad=null,queued=false;
  const css=document.createElement('style');
  css.textContent=`
    #shadchanimSection h1{display:flex;align-items:center;gap:9px;flex-wrap:wrap}
    .pmV65WaitingCount{display:inline-flex;align-items:center;gap:5px;padding:6px 9px!important;border-radius:999px!important;background:#fff1cf!important;color:#76551c!important;border:1px solid #ead79d!important;font-size:10.5px!important;font-weight:850!important}
    .pmV65WaitingCount.zero{background:#eef3f6!important;color:#71808a!important;border-color:#dce4e8!important}
    .pmV65WaitToggle{width:100%;margin:6px 0 9px;padding:8px 10px!important;border-radius:10px!important;background:#fff1cf!important;color:#76551c!important;border:1px solid #ead79d!important;font-size:11px!important;font-weight:850!important}
    .pmV65WaitToggle.active{background:#e7f2e8!important;color:#275c35!important;border-color:#cbe0cf!important}
    .pmV65WaitingList{position:fixed;inset:0;z-index:14000;background:rgba(0,0,0,.38);display:flex;align-items:flex-end;justify-content:center;padding:14px}
    .pmV65WaitingSheet{width:min(560px,100%);max-height:75vh;overflow:auto;background:#fff;border-radius:18px;padding:15px;box-shadow:0 12px 36px rgba(0,0,0,.28)}
    .pmV65WaitingRow{width:100%;text-align:left;margin:6px 0;padding:10px 11px!important;border-radius:11px!important;background:#f7fafc!important;color:var(--text)!important;border:1px solid #dbe5ea!important}
    .pmV65WaitingRow b{display:block;font-size:13px}.pmV65WaitingRow span{display:block;font-size:10px;color:var(--muted);margin-top:2px}
  `;
  document.head.appendChild(css);

  const find=id=>(data.shadchanim||[]).find(x=>String(x.id)===String(id))||null;
  const waiters=()=> (data.shadchanim||[]).filter(x=>x.waitingForReply===true);
  function stampNow(){return typeof stamp==='function'?stamp():new Date().toLocaleString();}

  function titleBadge(){
    const sec=document.getElementById('shadchanimSection'),h=sec?.querySelector('h1');if(!h)return;
    let b=document.getElementById('pmV65WaitingCount');if(!b){b=document.createElement('button');b.type='button';b.id='pmV65WaitingCount';b.className='pmV65WaitingCount';h.appendChild(b);b.onclick=openWaiting;}
    const n=waiters().length;b.textContent='Waiting for reply '+n;b.classList.toggle('zero',n===0);
  }

  function openWaiting(){
    document.getElementById('pmV65WaitingList')?.remove();const items=waiters();
    if(items.length===1){openS(items[0].id);return;}
    const shade=document.createElement('div');shade.id='pmV65WaitingList';shade.className='pmV65WaitingList';const box=document.createElement('div');box.className='pmV65WaitingSheet';
    box.innerHTML=`<div style="font-weight:900;font-size:17px;margin-bottom:8px">Waiting for reply (${items.length})</div>${items.length?'':'<div style="font-size:13px;color:#73818b;padding:12px 0">Nobody is marked waiting.</div>'}<div id="pmV65WaitingRows"></div><button id="pmV65WaitingClose" class="secondary full" style="margin-top:9px">Close</button>`;
    shade.appendChild(box);document.body.appendChild(shade);const rows=box.querySelector('#pmV65WaitingRows');
    items.forEach(x=>{const b=document.createElement('button');b.type='button';b.className='pmV65WaitingRow';b.innerHTML=`<b>${String(x.name||'Unnamed shadchan').replace(/[<>]/g,'')}</b><span>${String(x.waitingForReplySince||'').replace(/[<>]/g,'')}</span>`;b.onclick=()=>{shade.remove();openS(x.id);};rows.appendChild(b);});
    box.querySelector('#pmV65WaitingClose').onclick=()=>shade.remove();shade.onclick=e=>{if(e.target===shade)shade.remove();};
  }

  function detail(id){
    const x=find(id),sheet=document.getElementById('sheet');if(!x||!sheet)return;
    let b=document.getElementById('pmV65WaitToggle');if(!b){b=document.createElement('button');b.type='button';b.id='pmV65WaitToggle';b.className='pmV65WaitToggle';const contact=sheet.querySelector('.v19Contact');contact?.insertAdjacentElement('afterend',b);}
    const draw=()=>{b.textContent=x.waitingForReply?'Reply received — clear waiting':'Waiting for reply';b.classList.toggle('active',!!x.waitingForReply);};draw();
    b.onclick=async()=>{x.waitingForReply=!x.waitingForReply;if(x.waitingForReply){x.waitingForReplySince=stampNow();x.activities=x.activities||[];x.activities.push({id:Date.now(),type:'action',action:'Waiting for reply',text:'Marked waiting for reply.',ts:stampNow()});}else{x.waitingForReplySince='';x.activities=x.activities||[];x.activities.push({id:Date.now(),type:'action',action:'Reply received',text:'Cleared waiting for reply.',ts:stampNow()});}try{await save();renderS();}catch(e){console.warn('PeerMatch waiting save',e);}titleBadge();draw();};
  }

  const oldS=window.openS;if(typeof oldS==='function')window.openS=function(id){activeShad=id;const r=oldS(id);setTimeout(()=>detail(id),50);return r;};
  const oldRender=window.renderS;if(typeof oldRender==='function')window.renderS=function(){const r=oldRender();requestAnimationFrame(titleBadge);return r;};
  function polish(){titleBadge();if(activeShad!=null&&document.getElementById('sheet')&&!document.getElementById('v19SName'))detail(activeShad);}
  function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;polish();});}
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
  setTimeout(polish,300);
})();
