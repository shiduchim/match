/* PeerMatch v127: delete individual conversation/history entries permanently.
   Modern WhatsApp profile shares are paired by shareLinkId. Older shares may have no
   explicit link, so v127 also derives a conservative legacy-pair fingerprint from the
   profile, Shadchan, exact message and displayed timestamp. Deleting either side removes
   the matching partner and records a small tombstone so legacy reconciliation cannot
   silently recreate the deleted entry later. */
(function(){
  document.documentElement.dataset.peerMatchVersion='127';
  const TOMBSTONE_KEY='pmDeletedShareHistoryV127';
  const MAX_TOMBSTONES=500;

  const style=document.createElement('style');
  style.textContent=`
    .pmEventTopRight{display:flex;align-items:center;gap:8px;white-space:nowrap;flex-shrink:0}
    .pmDeleteEvent{border:0;background:transparent;color:#9b4a42;padding:0 1px;font-size:11px;font-weight:700;line-height:1;cursor:pointer;white-space:nowrap;flex:0 0 auto;min-width:42px}
    .pmDeleteEvent:hover{text-decoration:underline}
  `;
  document.head.appendChild(style);

  const norm=s=>String(s||'').trim().toLocaleLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
  function phoneKey(p){
    if(typeof window.pmPhoneKey==='function'){try{return String(window.pmPhoneKey(p)||'');}catch(e){}}
    let d=String(p||'').replace(/\D/g,'');if(d.startsWith('00'))d=d.slice(2);if(d.startsWith('972'))d=d.slice(3);if(d.startsWith('0'))d=d.slice(1);return d;
  }
  function hash(s){let h=2166136261>>>0;for(const c of String(s||'')){h^=c.charCodeAt(0);h=Math.imul(h,16777619)>>>0;}return h.toString(36);}
  function firstTextName(a){return norm((String(a?.text||'').split(/\r?\n/).find(x=>String(x||'').trim())||''));}
  function isProfileWhatsApp(a){
    if(!a)return false;const action=String(a.action||'').toLowerCase(),channel=String(a.channel||'').toLowerCase();
    if(action.includes('match'))return false;
    if(action.includes('profile')&&action.includes('whatsapp'))return true;
    return channel==='whatsapp'&&(a.sharedProfileId!=null||a.profileId!=null||a.recipientSide==='Profile share');
  }
  function legacyKey(kind,record,a){
    if(!record||!a||!isProfileWhatsApp(a))return'';
    let p='',s='';
    if(kind==='guys'||kind==='girls')p='id:'+String(record.id);
    else if(a.sharedProfileId!=null||a.profileId!=null)p='id:'+String(a.sharedProfileId??a.profileId);
    else{const n=norm(a.sharedProfileName||a.profileName)||firstTextName(a);if(n)p='name:'+n;}

    if(kind==='shadchanim')s='id:'+String(record.id);
    else if(a.recipientShadchanId!=null||a.shadchanId!=null||a.linkedShadchanId!=null)s='id:'+String(a.recipientShadchanId??a.shadchanId??a.linkedShadchanId);
    else{const ph=phoneKey(a.recipientPhone);if(ph)s='phone:'+ph;else{const n=norm(a.recipient);if(n)s='name:'+n;}}
    if(!p||!s)return'';
    return 'legacy:'+p+'|'+s+'|'+hash(String(a.text||'').trim())+'|'+hash(String(a.ts||''));
  }
  function rememberTombstones(keys){
    if(!keys?.length)return;
    try{
      const current=JSON.parse(localStorage.getItem(TOMBSTONE_KEY)||'[]');
      const out=[];for(const k of [...(Array.isArray(current)?current:[]),...keys])if(k&&!out.includes(k))out.push(k);
      localStorage.setItem(TOMBSTONE_KEY,JSON.stringify(out.slice(-MAX_TOMBSTONES)));
    }catch(e){console.warn('PeerMatch history tombstone save',e);}
  }

  function locateRecord(x){
    for(const k of ['shadchanim','guys','girls']){
      const arr=data[k]||[];let i=arr.findIndex(z=>z===x);
      if(i<0&&x?.id!=null)i=arr.findIndex(z=>String(z.id)===String(x.id));
      if(i>=0)return{k,id:arr[i].id,record:arr[i]};
    }
    return null;
  }
  function eventTitle(a){
    if(a.type==='audio')return'Audio note';if(a.type==='wa-out')return'You → WhatsApp';if(a.type==='wa-in')return'WhatsApp → You';
    if(a.type==='sms-out')return'You → SMS';if(a.type==='email-out')return'You → Email';if(a.type==='action')return a.action||'Action';return'Text note';
  }

  window.acts=acts=function(x){
    if(!x.activities?.length)return'<div class="empty">No contact history yet.</div>';
    const loc=locateRecord(x);
    return x.activities.map((a,index)=>({a,index})).reverse().map(({a,index})=>{
      const right=`<span class="pmEventTopRight"><span>${esc(a.ts||'')}</span>${loc?`<button type="button" class="pmDeleteEvent" data-k="${esc(loc.k)}" data-id="${esc(loc.id)}" data-index="${index}">Delete</button>`:''}</span>`;
      const body=a.type==='audio'?(a.audio?`<audio controls src="${url(a.audio)}"></audio>`:'<div class="small">Audio unavailable.</div>'):`<div class="profileText">${esc(a.text||'')}</div>`;
      const cls=a.type==='wa-out'?'event waOut':a.type==='wa-in'?'event waIn':'event';
      return `<div class="${cls}"><div class="eventTop"><span>${esc(eventTitle(a))}</span>${right}</div>${body}</div>`;
    }).join('');
  };

  const idKey=v=>v==null?'':String(v);
  function removeLinkedEntries(recordKind,recordId,target){
    const selectedRecord=(data[recordKind]||[]).find(z=>String(z.id)===String(recordId))||null;
    const link=String(target?.shareLinkId||''),targetId=idKey(target?.id);
    const sourceProfileId=idKey(target?.mirroredFromProfileActivityId),sourceShadId=idKey(target?.mirroredFromShadchanActivityId);
    const legacy=legacyKey(recordKind,selectedRecord,target);
    const tombs=[];if(link)tombs.push('link:'+link);else if(legacy)tombs.push(legacy);
    let removed=0;

    for(const k of ['shadchanim','guys','girls']){
      for(const record of (data[k]||[])){
        if(!Array.isArray(record.activities))continue;
        const selected=k===recordKind&&String(record.id)===String(recordId);
        for(let i=record.activities.length-1;i>=0;i--){
          const a=record.activities[i],aId=idKey(a?.id),fromProfile=idKey(a?.mirroredFromProfileActivityId),fromShad=idKey(a?.mirroredFromShadchanActivityId);
          const sameSelected=selected&&(a===target||(targetId&&aId===targetId));
          const sameLink=!!link&&String(a?.shareLinkId||'')===link;
          const sameLegacy=!link&&!!legacy&&legacyKey(k,record,a)===legacy;
          const sourceOfSelected=(!!sourceProfileId&&k!=='shadchanim'&&aId===sourceProfileId)||(!!sourceShadId&&k==='shadchanim'&&aId===sourceShadId);
          const mirrorsSelected=!!targetId&&(fromProfile===targetId||fromShad===targetId);
          if(sameSelected||sameLink||sameLegacy||sourceOfSelected||mirrorsSelected){record.activities.splice(i,1);removed++;}
        }
      }
    }
    return{removed,tombs};
  }

  async function deleteEntry(btn){
    const k=btn.dataset.k,id=btn.dataset.id,index=Number(btn.dataset.index),arr=data[k]||[];
    const x=arr.find(z=>String(z.id)===String(id));
    if(!x||!Array.isArray(x.activities)||!Number.isInteger(index)||index<0||index>=x.activities.length)return;
    const a=x.activities[index],label=eventTitle(a);
    if(!confirm('Delete this history entry?\n\n'+label+'\n'+String(a.ts||'')))return;

    const snapshots=[];
    for(const kind of ['shadchanim','guys','girls'])for(const record of (data[kind]||[]))if(Array.isArray(record.activities))snapshots.push({record,activities:[...record.activities]});
    const result=removeLinkedEntries(k,x.id,a);
    try{
      await save();
      rememberTombstones(result.tombs);
      try{render();}catch(e){}
      if(k==='shadchanim')openS(x.id);else openP(k,x.id);
    }catch(e){
      for(const s of snapshots)s.record.activities=s.activities;
      console.warn('PeerMatch delete history failed',e);
      alert('PeerMatch could not save the deletion. Nothing was deleted.');
    }
  }

  document.addEventListener('click',e=>{
    const btn=e.target.closest?.('.pmDeleteEvent');if(!btn)return;
    e.preventDefault();e.stopPropagation();deleteEntry(btn);
  },true);
})();
