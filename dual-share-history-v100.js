/* PeerMatch v127: keep profile WhatsApp-share history on BOTH sides.
   Historical filename retained because this is still the same reconciliation owner.

   v127 hardening:
   - shareLinkId is the primary identity for modern shares, so sending the same unchanged
     profile to the same Shadchan twice creates two real pairs instead of collapsing them.
   - legacy pre-shareLinkId pairs are upgraded in place to a shared shareLinkId whenever
     both sides can be matched, which makes later deletion deterministic.
   - legacy duplicate messages prefer an unlinked counterpart, pairing them one-to-one.
   - the permanent 4-second full-history scan was removed. Reconciliation still runs at
     startup, before detail opens, and on focus/visibility return. */
(function(){
  document.documentElement.dataset.peerMatchVersion='127';

  const norm=s=>String(s||'').trim().toLocaleLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
  function phoneKey(p){
    if(typeof window.pmPhoneKey==='function'){try{return String(window.pmPhoneKey(p)||'');}catch(e){}}
    let d=String(p||'').replace(/\D/g,'');if(d.startsWith('00'))d=d.slice(2);if(d.startsWith('972'))d=d.slice(3);if(d.startsWith('0'))d=d.slice(1);return d;
  }
  const stampNow=()=>typeof stamp==='function'?stamp():new Date().toLocaleString();
  const idEq=(a,b)=>a!=null&&b!=null&&String(a)===String(b);

  function allProfiles(){const out=[];for(const k of ['guys','girls'])for(const x of (data[k]||[]))out.push({k,x});return out;}

  function isProfileWhatsApp(a){
    if(!a)return false;
    const action=String(a.action||'').toLowerCase(),channel=String(a.channel||'').toLowerCase();
    if(action.includes('match'))return false;
    if(action.includes('profile')&&action.includes('whatsapp'))return true;
    return channel==='whatsapp'&&(a.sharedProfileId!=null||a.profileId!=null||a.recipientSide==='Profile share'||a.recipientShadchanId!=null||a.shadchanId!=null);
  }

  function shadByRecipient(a){
    const arr=data.shadchanim||[];
    for(const id of [a?.recipientShadchanId,a?.shadchanId,a?.linkedShadchanId]){if(id!=null){const s=arr.find(z=>idEq(z.id,id));if(s)return s;}}
    const pk=phoneKey(a?.recipientPhone);if(pk){const s=arr.find(z=>phoneKey(z.phone)===pk);if(s)return s;}
    const n=norm(a?.recipient);if(n){const s=arr.find(z=>norm(z.name)===n);if(s)return s;}
    return null;
  }

  function profileFromShadActivity(a){
    const profiles=allProfiles();
    for(const id of [a?.sharedProfileId,a?.profileId]){if(id!=null){const p=profiles.find(z=>idEq(z.x.id,id));if(p)return p;}}
    const named=norm(a?.sharedProfileName||a?.profileName);if(named){const p=profiles.find(z=>norm(z.x.name)===named);if(p)return p;}
    const text=String(a?.text||'').trim();if(!text)return null;
    const first=norm((text.split(/\r?\n/).find(line=>String(line||'').trim())||''));
    if(first){const exact=profiles.find(z=>norm(z.x.name)===first);if(exact)return exact;}
    const candidates=profiles.filter(z=>{const n=String(z.x.name||'').trim();return n&&text.includes(n);});
    return candidates.length===1?candidates[0]:null;
  }

  const sameMessage=(a,text)=>String(a?.text||'').trim()===String(text||'').trim();
  const linkOf=a=>String(a?.shareLinkId||'');
  function newLink(profile,shad,a){return 'profile-'+profile.id+'-shad-'+shad.id+'-'+String(a?.id||Date.now())+'-'+Date.now();}

  function findProfileCounterpart(profile,shad,text,source){
    const list=profile.activities||[],link=linkOf(source);
    if(link)return list.find(a=>linkOf(a)===link)||null;
    if(source?.id!=null){const m=list.find(a=>idEq(a?.mirroredFromShadchanActivityId,source.id));if(m)return m;}
    const sp=phoneKey(shad?.phone),sn=norm(shad?.name);
    const matches=list.filter(a=>{
      if(!isProfileWhatsApp(a)||!sameMessage(a,text))return false;
      const ap=phoneKey(a.recipientPhone),an=norm(a.recipient);
      return (sp&&ap===sp)||(sn&&an===sn)||idEq(a.recipientShadchanId||a.shadchanId,shad?.id);
    });
    return matches.find(a=>!linkOf(a))||matches[0]||null;
  }

  function findShadCounterpart(shad,profile,text,source){
    const list=shad.activities||[],link=linkOf(source),pn=norm(profile?.name);
    if(link)return list.find(a=>linkOf(a)===link)||null;
    if(source?.id!=null){const m=list.find(a=>idEq(a?.mirroredFromProfileActivityId,source.id));if(m)return m;}
    const matches=list.filter(a=>{
      if(!isProfileWhatsApp(a)||!sameMessage(a,text))return false;
      if(idEq(a.sharedProfileId||a.profileId,profile?.id))return true;
      if(pn&&norm(a.sharedProfileName||a.profileName)===pn)return true;
      const first=norm((String(a.text||'').trim().split(/\r?\n/).find(line=>String(line||'').trim())||''));
      return !!pn&&first===pn;
    });
    return matches.find(a=>!linkOf(a))||matches[0]||null;
  }

  function ensurePairLink(profile,shad,a,b){
    const link=linkOf(a)||linkOf(b)||newLink(profile,shad,a||b),beforeA=linkOf(a),beforeB=linkOf(b);
    if(a&&!beforeA)a.shareLinkId=link;
    if(b&&!beforeB)b.shareLinkId=link;
    return (!!a&&!beforeA)||(!!b&&!beforeB);
  }

  function mirrorProfileToShad(k,profile,a){
    if(!isProfileWhatsApp(a))return false;
    const shad=shadByRecipient(a);if(!shad)return false;
    const text=String(a.text||''),existing=findShadCounterpart(shad,profile,text,a);
    if(existing)return ensurePairLink(profile,shad,a,existing);
    shad.activities=shad.activities||[];
    const link=linkOf(a)||newLink(profile,shad,a);if(!a.shareLinkId)a.shareLinkId=link;
    shad.activities.push({
      id:Date.now()*1000+Math.floor(Math.random()*900+100),type:'action',action:'Profile received • WhatsApp',text,
      ts:a.ts||stampNow(),channel:'whatsapp',sharedProfileId:profile.id,sharedProfileName:String(profile.name||'Unnamed profile'),sharedProfileKind:k,
      profileId:profile.id,profileName:String(profile.name||'Unnamed profile'),mirroredFromProfileActivityId:a.id,shareLinkId:link
    });
    return true;
  }

  function mirrorShadToProfile(shad,a){
    if(!isProfileWhatsApp(a))return false;
    const found=profileFromShadActivity(a);if(!found)return false;
    const profile=found.x,text=String(a.text||''),existing=findProfileCounterpart(profile,shad,text,a);
    if(existing)return ensurePairLink(profile,shad,existing,a);
    profile.activities=profile.activities||[];
    const link=linkOf(a)||newLink(profile,shad,a);if(!a.shareLinkId)a.shareLinkId=link;
    profile.activities.push({
      id:Date.now()*1000+Math.floor(Math.random()*900+100),type:'action',action:'Profile sent • WhatsApp',text,
      ts:a.ts||stampNow(),channel:'whatsapp',recipient:String(shad.name||'Shadchan'),recipientPhone:String(shad.phone||''),recipientSide:'Shadchan',
      recipientShadchanId:shad.id,shadchanId:shad.id,sharedProfileId:profile.id,sharedProfileName:String(profile.name||'Unnamed profile'),sharedProfileKind:found.k,
      mirroredFromShadchanActivityId:a.id,shareLinkId:link
    });
    return true;
  }

  let syncing=false;
  function sync(){
    if(syncing)return false;syncing=true;let changed=false;
    try{
      for(const k of ['guys','girls'])for(const profile of (data[k]||[]))for(const a of [...(profile.activities||[])])if(mirrorProfileToShad(k,profile,a))changed=true;
      for(const shad of (data.shadchanim||[]))for(const a of [...(shad.activities||[])])if(mirrorShadToProfile(shad,a))changed=true;
      if(changed){try{const p=save();if(p?.catch)p.catch(e=>console.warn('PeerMatch v127 dual share history save',e));}catch(e){console.warn('PeerMatch v127 dual share history save',e);}}
    }finally{syncing=false;}
    return changed;
  }
  window.pmSyncDualShareHistory=sync;

  const priorP=window.openP;if(typeof priorP==='function')window.openP=function(k,id){sync();return priorP(k,id);};
  const priorS=window.openS;if(typeof priorS==='function')window.openS=function(id){sync();return priorS(id);};
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(sync,120);});
  window.addEventListener('focus',()=>setTimeout(sync,120));
  setTimeout(sync,500);
})();
