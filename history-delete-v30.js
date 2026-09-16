/* PeerMatch v122: delete individual conversation/history entries permanently.
   WhatsApp profile-share history can exist on both the profile and Shadchan sides.
   Deleting one side now removes only the selected entry and its true linked/mirrored
   partner; unrelated activities with a coincidentally identical timestamp/id are kept. */
(function(){
  document.documentElement.dataset.peerMatchVersion='122';

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

  function removeLinkedEntries(recordKind,recordId,target){
    const link=String(target?.shareLinkId||'');
    const targetId=idKey(target?.id);
    const sourceProfileId=idKey(target?.mirroredFromProfileActivityId);
    const sourceShadId=idKey(target?.mirroredFromShadchanActivityId);
    let removed=0;

    for(const k of ['shadchanim','guys','girls']){
      for(const record of (data[k]||[])){
        if(!Array.isArray(record.activities))continue;
        const selectedRecord=k===recordKind&&String(record.id)===String(recordId);
        for(let i=record.activities.length-1;i>=0;i--){
          const a=record.activities[i],aId=idKey(a?.id);
          const fromProfile=idKey(a?.mirroredFromProfileActivityId);
          const fromShad=idKey(a?.mirroredFromShadchanActivityId);
          const sameSelected=selectedRecord&&(a===target||(targetId&&aId===targetId));
          const sameLink=!!link&&String(a?.shareLinkId||'')===link;
          const sourceOfSelected=(!!sourceProfileId&&k!=='shadchanim'&&aId===sourceProfileId)||
            (!!sourceShadId&&k==='shadchanim'&&aId===sourceShadId);
          const mirrorsSelected=!!targetId&&(fromProfile===targetId||fromShad===targetId);
          if(sameSelected||sameLink||sourceOfSelected||mirrorsSelected){record.activities.splice(i,1);removed++;}
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

    removeLinkedEntries(k,x.id,a);
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
