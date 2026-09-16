/* PeerMatch v117: delete individual conversation/history entries permanently.
   WhatsApp profile-share history can exist on both the profile and Shadchan sides.
   Deleting only one side allowed dual-share-history-v100.js to recreate it on its next
   reconciliation pass. Deletion now removes the whole linked share pair (by shareLinkId
   or mirror ids) before saving, so deleted entries stay deleted. */
(function(){
  document.documentElement.dataset.peerMatchVersion='117';

  const style=document.createElement('style');
  style.textContent=`
    .pmEventTopRight{display:flex;align-items:center;gap:8px;white-space:nowrap;flex-shrink:0}
    .pmDeleteEvent{border:0;background:transparent;color:#9b4a42;padding:0 1px;font-size:11px;font-weight:700;line-height:1;cursor:pointer;white-space:nowrap;flex:0 0 auto;min-width:42px}
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

  function idKey(v){return v==null?'':String(v);}

  /* Remove the selected activity and any mirrored/paired copy anywhere else in PeerMatch.
     v116 direct shares give both sides the same shareLinkId. Older mirrored entries may
     instead reference each other through mirroredFromProfileActivityId /
     mirroredFromShadchanActivityId, so support both schemes. */
  function removeLinkedEntries(target){
    const link=String(target?.shareLinkId||'');
    const ids=new Set([
      idKey(target?.id),
      idKey(target?.mirroredFromProfileActivityId),
      idKey(target?.mirroredFromShadchanActivityId)
    ].filter(Boolean));
    let removed=0;

    for(const k of ['shadchanim','guys','girls']){
      for(const record of (data[k]||[])){
        if(!Array.isArray(record.activities))continue;
        for(let i=record.activities.length-1;i>=0;i--){
          const a=record.activities[i];
          const sameLink=!!link&&String(a?.shareLinkId||'')===link;
          const sameId=ids.has(idKey(a?.id));
          const mirrorsSelected=ids.has(idKey(a?.mirroredFromProfileActivityId))||ids.has(idKey(a?.mirroredFromShadchanActivityId));
          if(sameLink||sameId||mirrorsSelected){record.activities.splice(i,1);removed++;}
        }
      }
    }
    return removed;
  }

  async function deleteEntry(btn){
    const k=btn.dataset.k,id=btn.dataset.id,index=Number(btn.dataset.index);
    const arr=data[k]||[];
    const x=arr.find(z=>String(z.id)===String(id));
    if(!x||!Array.isArray(x.activities)||!Number.isInteger(index)||index<0||index>=x.activities.length)return;
    const a=x.activities[index];
    const label=eventTitle(a);
    if(!confirm('Delete this history entry?\n\n'+label+'\n'+String(a.ts||'')))return;

    removeLinkedEntries(a);
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
