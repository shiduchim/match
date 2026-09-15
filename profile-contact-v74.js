/* PeerMatch v74: one compact profile contact summary. */
(function(){
  document.documentElement.dataset.peerMatchVersion='74';
  let active=null,queued=false;

  const css=document.createElement('style');
  css.textContent=`
    /* Hide all older profile-contact detail renderings. */
    #sheet .pmV67ContactPeople,
    #sheet .pmV73ContactHeading,
    #sheet .pmContactLabel[data-pm-contact-for="person"],
    #sheet .pmV65Phone2Pill{display:none!important}

    #sheet .pmV74ContactSummary{
      margin:10px 0 7px!important;
      font-size:13px!important;
      line-height:1.35!important;
      color:var(--text)!important
    }
    #sheet .pmV74ContactTop{display:flex;flex-wrap:wrap;gap:5px;align-items:baseline}
    #sheet .pmV74ContactLabel{font-weight:850}
    #sheet .pmV74ContactName{font-weight:750}
    #sheet .pmV74ContactPhone{
      display:block!important;
      width:max-content!important;
      max-width:100%!important;
      margin-top:2px!important;
      color:#315b78!important;
      font-weight:800!important;
      text-decoration:none!important;
      cursor:pointer!important
    }
    #sheet .pmV74ContactPhone:active{text-decoration:underline!important}
  `;
  document.head.appendChild(css);

  const digits=s=>String(s||'').replace(/\D/g,'');
  const phoneHref=p=>'tel:'+String(p||'').replace(/\s+/g,'');
  const current=()=>active?(data[active.k]||[]).find(x=>String(x.id)===String(active.id))||null:null;

  function cleanMeta(x){
    const sheet=document.getElementById('sheet'),meta=sheet?.querySelector('.pmMeta');
    if(!sheet||!meta||!x)return;
    const phones=[digits(x.sourcePhone),digits(x.sourcePhone2)].filter(Boolean);
    for(const pill of [...meta.querySelectorAll('.pmPill')]){
      const t=String(pill.textContent||'').trim();
      if(/^Sent by\b/i.test(t)){pill.remove();continue;}
      const d=digits(t);if(d&&phones.includes(d))pill.remove();
    }
    sheet.querySelectorAll('.pmV65Phone2Pill').forEach(el=>el.remove());
    if(!meta.children.length)meta.remove();
  }

  async function logCall(x,name,phone){
    if(!x)return;
    x.activities=x.activities||[];
    x.activities.push({
      id:Date.now(),
      type:'action',
      action:'Call • Contact person',
      text:`Call opened to ${name||'Contact person'}${phone?' ('+phone+')':''}.`,
      ts:typeof stamp==='function'?stamp():new Date().toLocaleString(),
      recipient:name||'Contact person',
      recipientPhone:phone||'',
      recipientSide:'Contact person'
    });
    try{await save();}catch(e){console.warn('PeerMatch v74 call history save',e);}
  }

  function contactSummary(){
    const sheet=document.getElementById('sheet'),buttons=sheet?.querySelector('.pmProfileContact'),x=current();
    if(!sheet||!buttons||!x||!active||!['guys','girls'].includes(active.k))return;

    cleanMeta(x);

    // Older contact renderers remain hidden in the DOM so their observers do not recreate them continuously.

    const name=String(x.sourceName||x.source||'').trim();
    const phone=String(x.sourcePhone||'').trim();
    let box=sheet.querySelector('.pmV74ContactSummary');
    const sig=JSON.stringify([name,phone]);
    if(box?.dataset.sig!==sig){box?.remove();box=null;}
    if(!box){
      box=document.createElement('div');box.className='pmV74ContactSummary';box.dataset.sig=sig;
      const top=document.createElement('div');top.className='pmV74ContactTop';
      const label=document.createElement('span');label.className='pmV74ContactLabel';label.textContent='Contact person:';top.appendChild(label);
      if(name){const n=document.createElement('span');n.className='pmV74ContactName';n.textContent=name;top.appendChild(n);}
      box.appendChild(top);
      if(phone){
        const a=document.createElement('a');a.className='pmV74ContactPhone';a.href=phoneHref(phone);a.textContent=phone;
        a.addEventListener('click',async e=>{e.preventDefault();e.stopPropagation();await logCall(x,name,phone);location.href=phoneHref(phone);});
        box.appendChild(a);
      }
    }
    // Give later layout scripts ownership after the summary has been inserted once.
    if(!box.isConnected)buttons.insertAdjacentElement('beforebegin',box);
  }

  function polish(){contactSummary();}

  const prevP=window.openP;
  if(typeof prevP==='function')window.openP=function(k,id){active={k,id};const r=prevP(k,id);setTimeout(polish,30);return r;};
  const prevS=window.openS;
  if(typeof prevS==='function')window.openS=function(id){active=null;return prevS(id);};

  function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;polish();});}
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
  schedule();
})();
