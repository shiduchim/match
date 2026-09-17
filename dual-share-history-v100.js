/* PeerMatch v127: keep profile WhatsApp share history on BOTH sides safely.
   Modern share flows already write both sides with shareLinkId. This file mainly repairs
   older/partial history. v127 fixes two important edge cases:
   - repeated identical shares are distinguished by shareLinkId instead of message text;
   - deleted legacy pairs are remembered with tombstones so reconciliation cannot recreate them.
   The old permanent 4-second sweep is removed; reconciliation now runs only at startup,
   before opening details, and when the app regains focus/visibility. */
(function(){
  document.documentElement.dataset.peerMatchVersion='127';
  const TOMBSTONE_KEY='pmDeletedShareHistoryV127';

  const norm=s=>String(s||'').trim().toLocaleLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
  function phoneKey(p){
    if(typeof window.pmPhoneKey==='function'){
      try{return String(window.pmPhoneKey(p)||'');}catch(e){}
    }
    let d=String(p||'').replace(/\D/g,'');
    if(d.startsWith('00'))d=d.slice(2);
    if(d.startsWith('972'))d=d.slice(3);
    if(d.startsWith('0'))d=d.slice(1);
    return d;
  }
  const stampNow=()=>typeof stamp==='function'?stamp():new Date().toLocaleString();
  function hash(s){let h=2166136261>>>0;for(const c of String(s||'')){h^=c.charCodeAt(0);h=Math.imul(h,16777619)>>>0;}return h.toString(36);}

  function tombstones(){
    try{const a=JSON.parse(localStorage.getItem(TOMBSTONE_KEY)||'[]');return new Set(Array.isArray(a)?a:[]);}catch(e){return new Set();}
  }
  function firstTextName(a){return norm((String(a?.text||'').split(/\r?\n/).find(x=>String(x||'').trim())||''));}
  function legacyKey(kind,record,a){
    if(!record||!a)return'';
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
  function deleted(kind,record,a,tombs){
    const link=String(a?.shareLinkId||'');
    if(link)return tombs.has('link:'+link); // linked modern shares are identified only by their unique link.
    const lk=legacyKey(kind,record,a);
    return !!lk&&tombs.has(lk);
  }

  function allProfiles(){const out=[];for(const k of ['guys','girls'])for(const x of (data[k]||[]))out.push({k,x});return out;}
  function isProfileWhatsApp(a){
    if(!a)return false;
    const action=String(a.action||'').toLowerCase(),channel=String(a.channel||'').toLowerCase();
    if(action.includes('match'))return false;
    if(action.includes('profile')&&action.includes('whatsapp'))return true;
    return channel==='whatsapp'&&(a.sharedProfileId!=null||a.profileId!=null||a.recipientSide==='Profile share');
  }
  function shadByRecipient(a){
    const arr=data.shadchanim||[];
    for(const id of [a?.recipientShadchanId,a?.shadchanId,a?.linkedShadchanId]){
      if(id!=null){const s=arr.find(z=>String(z.id)===String(id));if(s)return s;}
    }
    const pk=phoneKey(a?.recipientPhone);if(pk){const s=arr.find(z=>phoneKey(z.phone)===pk);if(s)return s;}
    const n=norm(a?.recipient);if(n){const s=arr.find(z=>norm(z.name)===n);if(s)return s;}
    return null;
  }
  function profileFromShadActivity(a){
    const profiles=allProfiles();
    for(const id of [a?.sharedProfileId,a?.profileId]){
      if(id!=null){const p=profiles.find(z=>String(z.x.id)===String(id));if(p)return p;}
    }
    const named=norm(a?.sharedProfileName||a?.profileName);if(named){const p=profiles.find(z=>norm(z.x.name)===named);if(p)return p;}
    const text=String(a?.text||'').trim();if(!text)return null;
    const first=firstTextName(a);if(first){const p=profiles.find(z=>norm(z.x.name)===first);if(p)return p;}
    const candidates=profiles.filter(z=>{const n=String(z.x.name||'').trim();return n&&text.includes(n);});
    return candidates.length===1?candidates[0]:null;
  }
  const sameMessage=(a,text)=>String(a?.text||'').trim()===String(text||'').trim();

  function profileAlreadyHas(profile,shad,text,source){
    const sourceId=source?.id,link=String(source?.shareLinkId||'');
    const sp=phoneKey(shad?.phone),sn=norm(shad?.name);
    return (profile.activities||[]).some(a=>{
      if(link&&String(a.shareLinkId||'')===link)return true;
      if(sourceId!=null&&String(a.mirroredFromShadchanActivityId||'')===String(sourceId))return true;
      if(link)return false;
      if(!isProfileWhatsApp(a)||!sameMessage(a,text))return false;
      const ap=phoneKey(a.recipientPhone),an=norm(a.recipient);
      return (sp&&ap===sp)||(sn&&an===sn)||String(a.recipientShadchanId||a.shadchanId||'')===String(shad?.id||'');
    });
  }
  function shadAlreadyHas(shad,profile,text,source){
    const sourceId=source?.id,link=String(source?.shareLinkId||''),pn=norm(profile?.name);
    return (shad.activities||[]).some(a=>{
      if(link&&String(a.shareLinkId||'')===link)return true;
      if(sourceId!=null&&String(a.mirroredFromProfileActivityId||'')===String(sourceId))return true;
      if(link)return false;
      if(!isProfileWhatsApp(a)||!sameMessage(a,text))return false;
      const direct=String(a.sharedProfileId||a.profileId||'')===String(profile?.id||'');
      const named=pn&&norm(a.sharedProfileName||a.profileName)===pn;
      if(direct||named)return true;
      return firstTextName(a)===pn;
    });
  }

  function mirrorProfileToShad(k,profile,a,tombs){
    if(!isProfileWhatsApp(a)||deleted(k,profile,a,tombs))return false;
    const shad=shadByRecipient(a);if(!shad)return false;
    const text=String(a.text||'');if(shadAlreadyHas(shad,profile,text,a))return false;
    shad.activities=shad.activities||[];
    shad.activities.push({
      id:Date.now()*1000+Math.floor(Math.random()*900+100),type:'action',action:'Profile received • WhatsApp',text,
      ts:a.ts||stampNow(),channel:'whatsapp',sharedProfileId:profile.id,sharedProfileName:String(profile.name||'Unnamed profile'),
      sharedProfileKind:k,profileId:profile.id,profileName:String(profile.name||'Unnamed profile'),
      mirroredFromProfileActivityId:a.id,shareLinkId:a.shareLinkId||('legacy-profile-'+profile.id+'-shad-'+shad.id+'-'+String(a.id||Date.now()))
    });
    return true;
  }
  function mirrorShadToProfile(shad,a,tombs){
    if(!isProfileWhatsApp(a)||deleted('shadchanim',shad,a,tombs))return false;
    const found=profileFromShadActivity(a);if(!found)return false;
    const profile=found.x,text=String(a.text||'');if(profileAlreadyHas(profile,shad,text,a))return false;
    profile.activities=profile.activities||[];
    profile.activities.push({
      id:Date.now()*1000+Math.floor(Math.random()*900+100),type:'action',action:'Profile sent • WhatsApp',text,
      ts:a.ts||stampNow(),channel:'whatsapp',recipient:String(shad.name||'Shadchan'),recipientPhone:String(shad.phone||''),
      recipientSide:'Shadchan',recipientShadchanId:shad.id,shadchanId:shad.id,sharedProfileId:profile.id,
      sharedProfileName:String(profile.name||'Unnamed profile'),sharedProfileKind:found.k,mirroredFromShadchanActivityId:a.id,
      shareLinkId:a.shareLinkId||('legacy-profile-'+profile.id+'-shad-'+shad.id+'-'+String(a.id||Date.now()))
    });
    return true;
  }

  let syncing=false;
  function sync(){
    if(syncing)return false;syncing=true;let changed=false;
    try{
      const tombs=tombstones();
      for(const k of ['guys','girls'])for(const profile of (data[k]||[]))for(const a of [...(profile.activities||[])])if(mirrorProfileToShad(k,profile,a,tombs))changed=true;
      for(const shad of (data.shadchanim||[]))for(const a of [...(shad.activities||[])])if(mirrorShadToProfile(shad,a,tombs))changed=true;
      if(changed){try{const p=save();if(p?.catch)p.catch(e=>console.warn('PeerMatch v127 dual history save',e));}catch(e){console.warn('PeerMatch v127 dual history save',e);}}
    }finally{syncing=false;}
    return changed;
  }

  const priorP=window.openP;if(typeof priorP==='function')window.openP=function(k,id){sync();return priorP(k,id);};
  const priorS=window.openS;if(typeof priorS==='function')window.openS=function(id){sync();return priorS(id);};
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(sync,120);});
  window.addEventListener('focus',()=>setTimeout(sync,120));
  setTimeout(sync,500);
})();
