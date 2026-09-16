/* PeerMatch v109: show when Guys, Girls, and Shadchanim were added, at the bottom of detail pages. */
(function(){
  document.documentElement.dataset.peerMatchVersion='109';

  let active=null;
  let queued=false;
  const knownAtLoad={
    guys:new Set((data.guys||[]).map(x=>String(x.id))),
    girls:new Set((data.girls||[]).map(x=>String(x.id))),
    shadchanim:new Set((data.shadchanim||[]).map(x=>String(x.id)))
  };

  const style=document.createElement('style');
  style.textContent=`
    #sheet .pmAddedDate{
      margin:18px 2px 88px!important;
      padding-top:9px!important;
      border-top:1px solid var(--line)!important;
      color:var(--muted)!important;
      font-size:10.5px!important;
      line-height:1.35!important;
      text-align:left!important;
    }
  `;
  document.head.appendChild(style);

  const rec=(k,id)=>(data[k]||[]).find(x=>String(x.id)===String(id))||null;

  function timestampFromId(id){
    const n=Number(id);
    if(!Number.isFinite(n))return 0;
    const min=Date.UTC(2020,0,1),max=Date.now()+86400000;
    return n>=min&&n<=max?n:0;
  }

  function ensureCreated(k,x){
    if(!x)return false;
    let t=Number(x.createdAt||0);
    if(Number.isFinite(t)&&t>0)return false;

    const fromId=timestampFromId(x.id);
    if(fromId){x.createdAt=fromId;return true;}

    /* For records genuinely created after this script loaded, save the current time.
       Do not invent a date for older records whose IDs contain no recoverable timestamp. */
    if(!knownAtLoad[k]?.has(String(x.id))){x.createdAt=Date.now();return true;}
    return false;
  }

  function formatAdded(t){
    const d=new Date(Number(t));
    if(!Number.isFinite(d.getTime()))return'';
    try{
      return d.toLocaleString(undefined,{year:'numeric',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
    }catch(_){return d.toLocaleString();}
  }

  function saveQuiet(){
    try{const p=save();if(p?.catch)p.catch(e=>console.warn('PeerMatch added-date save',e));}
    catch(e){console.warn('PeerMatch added-date save',e);}
  }

  function renderAdded(){
    const sheet=document.getElementById('sheet');
    if(!sheet||!active){sheet?.querySelector('.pmAddedDate')?.remove();return;}
    const x=rec(active.k,active.id);
    if(!x){sheet.querySelector('.pmAddedDate')?.remove();return;}

    const changed=ensureCreated(active.k,x);
    if(changed)saveQuiet();

    const text=formatAdded(x.createdAt);
    let el=sheet.querySelector('.pmAddedDate');
    if(!text){el?.remove();return;}
    if(!el){el=document.createElement('div');el.className='pmAddedDate';}
    el.textContent='Added to PeerMatch: '+text;

    const fixed=sheet.querySelector('#v19Fixed,#pmFixedDetail,.v19Fixed,.pmFixedDetail');
    if(fixed){
      if(el.nextElementSibling!==fixed)fixed.insertAdjacentElement('beforebegin',el);
    }else if(el.parentElement!==sheet||el!==sheet.lastElementChild){
      sheet.appendChild(el);
    }
  }

  function migrateRecoverable(){
    let changed=false;
    for(const k of ['guys','girls','shadchanim']){
      for(const x of data[k]||[])if(ensureCreated(k,x))changed=true;
    }
    if(changed)saveQuiet();
  }

  const priorP=window.openP;
  if(typeof priorP==='function')window.openP=function(k,id){
    active={k,id};
    const r=priorP(k,id);
    setTimeout(renderAdded,100);
    return r;
  };

  const priorS=window.openS;
  if(typeof priorS==='function')window.openS=function(id){
    active={k:'shadchanim',id};
    const r=priorS(id);
    setTimeout(renderAdded,100);
    return r;
  };

  const priorClose=window.close;
  if(typeof priorClose==='function')window.close=function(){active=null;return priorClose.apply(this,arguments);};

  function schedule(){
    if(queued)return;
    queued=true;
    requestAnimationFrame(()=>{queued=false;renderAdded();});
  }

  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
  migrateRecoverable();
})();
