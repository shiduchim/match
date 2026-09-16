/* PeerMatch v100: keep single-profile WhatsApp share history on BOTH sides.
   - Single history: who received the profile + exact outgoing message.
   - Shadchan history: whose profile was received + exact outgoing message.
   - Reconciles either direction and avoids duplicate mirror entries.
*/
(function(){
  document.documentElement.dataset.peerMatchVersion='100';

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

  function allProfiles(){
    const out=[];
    for(const k of ['guys','girls'])for(const x of (data[k]||[]))out.push({k,x});
    return out;
  }

  function isProfileWhatsApp(a){
    if(!a)return false;
    const action=String(a.action||'').toLowerCase();
    const channel=String(a.channel||'').toLowerCase();
    if(action.indexOf('match')>=0)return false;
    if(action.indexOf('profile')>=0&&action.indexOf('whatsapp')>=0)return true;
    if(channel==='whatsapp'&&(a.sharedProfileId!=null||a.profileId!=null||a.recipientSide==='Profile share'))return true;
    return false;
  }

  function shadByRecipient(a){
    const arr=data.shadchanim||[];
    for(const id of [a?.recipientShadchanId,a?.shadchanId,a?.linkedShadchanId]){
      if(id!=null){const s=arr.find(z=>String(z.id)===String(id));if(s)return s;}
    }
    const pk=phoneKey(a?.recipientPhone);
    if(pk){const s=arr.find(z=>phoneKey(z.phone)===pk);if(s)return s;}
    const n=norm(a?.recipient);
    if(n){const s=arr.find(z=>norm(z.name)===n);if(s)return s;}
    return null;
  }

  function profileFromShadActivity(a){
    const profiles=allProfiles();
    for(const id of [a?.sharedProfileId,a?.profileId]){
      if(id!=null){const p=profiles.find(z=>String(z.x.id)===String(id));if(p)return p;}
    }
    const named=norm(a?.sharedProfileName||a?.profileName);
    if(named){const p=profiles.find(z=>norm(z.x.name)===named);if(p)return p;}

    const text=String(a?.text||'').trim();
    if(!text)return null;
    const first=norm((text.split(/\r?\n/).find(line=>String(line||'').trim())||''));
    if(first){
      const exact=profiles.find(z=>norm(z.x.name)===first);
      if(exact)return exact;
    }
    // Fallback for history entries that added a short prefix before the actual profile text.
    const candidates=profiles.filter(z=>{
      const n=String(z.x.name||'').trim();
      return n&&text.indexOf(n)>=0;
    });
    if(candidates.length===1)return candidates[0];
    return null;
  }

  function sameMessage(a,text){return String(a?.text||'').trim()===String(text||'').trim();}

  function profileAlreadyHas(profile,shad,text,sourceId){
    const sp=phoneKey(shad?.phone),sn=norm(shad?.name);
    return (profile.activities||[]).some(a=>{
      if(sourceId!=null&&String(a.mirroredFromShadchanActivityId||'')===String(sourceId))return true;
      if(!isProfileWhatsApp(a)||!sameMessage(a,text))return false;
      const ap=phoneKey(a.recipientPhone),an=norm(a.recipient);
      return (sp&&ap===sp)||(sn&&an===sn)||String(a.recipientShadchanId||a.shadchanId||'')===String(shad?.id||'');
    });
  }

  function shadAlreadyHas(shad,profile,text,sourceId){
    const pn=norm(profile?.name);
    return (shad.activities||[]).some(a=>{
      if(sourceId!=null&&String(a.mirroredFromProfileActivityId||'')===String(sourceId))return true;
      if(!isProfileWhatsApp(a)||!sameMessage(a,text))return false;
      const direct=String(a.sharedProfileId||a.profileId||'')===String(profile?.id||'');
      const named=pn&&(norm(a.sharedProfileName||a.profileName)===pn);
      if(direct||named)return true;
      const t=String(a.text||'').trim(),first=norm((t.split(/\r?\n/).find(line=>String(line||'').trim())||''));
      return first===pn;
    });
  }

  function mirrorProfileToShad(k,profile,a){
    if(!isProfileWhatsApp(a))return false;
    const shad=shadByRecipient(a);if(!shad)return false;
    const text=String(a.text||'');
    if(shadAlreadyHas(shad,profile,text,a.id))return false;
    shad.activities=shad.activities||[];
    shad.activities.push({
      id:Date.now()*1000+Math.floor(Math.random()*900+100),
      type:'action',
      action:'Profile received • WhatsApp',
      text:text,
      ts:a.ts||stampNow(),
      channel:'whatsapp',
      sharedProfileId:profile.id,
      sharedProfileName:String(profile.name||'Unnamed profile'),
      sharedProfileKind:k,
      profileId:profile.id,
      profileName:String(profile.name||'Unnamed profile'),
      mirroredFromProfileActivityId:a.id,
      shareLinkId:a.shareLinkId||('profile-'+profile.id+'-shad-'+shad.id+'-'+String(a.id||Date.now()))
    });
    return true;
  }

  function mirrorShadToProfile(shad,a){
    if(!isProfileWhatsApp(a))return false;
    const found=profileFromShadActivity(a);if(!found)return false;
    const profile=found.x,text=String(a.text||'');
    if(profileAlreadyHas(profile,shad,text,a.id))return false;
    profile.activities=profile.activities||[];
    profile.activities.push({
      id:Date.now()*1000+Math.floor(Math.random()*900+100),
      type:'action',
      action:'Profile sent • WhatsApp',
      text:text,
      ts:a.ts||stampNow(),
      channel:'whatsapp',
      recipient:String(shad.name||'Shadchan'),
      recipientPhone:String(shad.phone||''),
      recipientSide:'Shadchan',
      recipientShadchanId:shad.id,
      shadchanId:shad.id,
      sharedProfileId:profile.id,
      sharedProfileName:String(profile.name||'Unnamed profile'),
      sharedProfileKind:found.k,
      mirroredFromShadchanActivityId:a.id,
      shareLinkId:a.shareLinkId||('profile-'+profile.id+'-shad-'+shad.id+'-'+String(a.id||Date.now()))
    });
    return true;
  }

  let syncing=false;
  function sync(){
    if(syncing)return false;syncing=true;
    let changed=false;
    try{
      // First: profile -> recipient Shadchan.
      for(const k of ['guys','girls']){
        for(const profile of (data[k]||[])){
          for(const a of [...(profile.activities||[])]){
            if(mirrorProfileToShad(k,profile,a))changed=true;
          }
        }
      }
      // Second: recipient Shadchan -> profile. This also backfills older shares
      // that currently exist only in the Shadchan history.
      for(const shad of (data.shadchanim||[])){
        for(const a of [...(shad.activities||[])]){
          if(mirrorShadToProfile(shad,a))changed=true;
        }
      }
      if(changed){
        try{const p=save();if(p?.catch)p.catch(e=>console.warn('PeerMatch v100 dual share history save',e));}
        catch(e){console.warn('PeerMatch v100 dual share history save',e);}
      }
    }finally{syncing=false;}
    return changed;
  }

  // Reconcile before opening details, so the newly mirrored activity is already
  // present when the existing History UI renders.
  const priorP=window.openP;
  if(typeof priorP==='function')window.openP=function(k,id){sync();return priorP(k,id);};
  const priorS=window.openS;
  if(typeof priorS==='function')window.openS=function(id){sync();return priorS(id);};

  document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(sync,120);});
  window.addEventListener('focus',()=>setTimeout(sync,120));
  setTimeout(sync,500);
  setInterval(sync,4000);
})();
