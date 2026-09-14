/* PeerMatch v30: delete individual conversation/history entries. */
(function(){
  document.documentElement.dataset.peerMatchVersion='30';

  const style=document.createElement('style');
  style.textContent=`
    .pmEventTopRight{display:flex;align-items:center;gap:8px}
    .pmDeleteEvent{border:0;background:transparent;color:#9b4a42;padding:0;font-size:11px;font-weight:700;line-height:1;cursor:pointer}
    .pmDeleteEvent:hover{text-decoration:underline}
  `;
  document.head.appendChild(style);

  function locateRecord(x){
    for(const k of ['shadchanim','guys','girls']){
      const arr=data[k]||[];
      let i=arr.findIndex(z=>z===x);
      if(i<0&&x?.id!=null)i=arr.findIndex(z=>String(z.id)===String(x.id));
      if(i>=0)return{k,id:arr[i].id,record:arr[i]};
    }
    return null;
  }

  function eventTitle(a){
    if(a.type==='audio')return'Audio note';
    if(a.type==='wa-out')return'You → WhatsApp';
    if(a.type==='wa-in')return'WhatsApp → You';
    if(a.type==='sms-out')return'You → SMS';
    if(a.type==='email-out')return'You → Email';
    if(a.type==='action')return a.action||'Action';
    return'Text note';
  }

  window.acts=acts=function(x){
    if(!x.activities?.length)return'<div class="empty">No contact history yet.</div>';
    const loc=locateRecord(x);
    return x.activities.map((a,index)=>({a,index})).reverse().map(({a,index})=>{
      const right=`<span class="pmEventTopRight"><span>${esc(a.ts||'')}</span>${loc?`<button type="button" class="pmDeleteEvent" data-k="${esc(loc.k)}" data-id="${esc(loc.id)}" data-index="${index}">Delete</button>`:''}</span>`;
      let body='';
      if(a.type==='audio')body=a.audio?`<audio controls src="${url(a.audio)}"></audio>`:'<div class="small">Audio unavailable.</div>';
      else body=`<div class="profileText">${esc(a.text||'')}</div>`;
      const cls=a.type==='wa-out'?'event waOut':a.type==='wa-in'?'event waIn':'event';
      return `<div class="${cls}"><div class="eventTop"><span>${esc(eventTitle(a))}</span>${right}</div>${body}</div>`;
    }).join('');
  };

  async function deleteEntry(btn){
    const k=btn.dataset.k,id=btn.dataset.id,index=Number(btn.dataset.index);
    const arr=data[k]||[];
    const x=arr.find(z=>String(z.id)===String(id));
    if(!x||!Array.isArray(x.activities)||!Number.isInteger(index)||index<0||index>=x.activities.length)return;
    const a=x.activities[index];
    const label=eventTitle(a);
    if(!confirm('Delete this history entry?\n\n'+label+'\n'+String(a.ts||'')))return;
    x.activities.splice(index,1);
    try{
      await save();
      try{render();}catch(e){}
      if(k==='shadchanim')openS(x.id);else openP(k,x.id);
    }catch(e){
      console.warn('PeerMatch delete history failed',e);
      alert('PeerMatch could not save the deletion.');
    }
  }

  document.addEventListener('click',e=>{
    const btn=e.target.closest?.('.pmDeleteEvent');
    if(!btn)return;
    e.preventDefault();e.stopPropagation();
    deleteEntry(btn);
  },true);
})();
