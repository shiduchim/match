/* PeerMatch v119: one selected Guy/Girl -> multiple selected Shadchanim.
   Sequence is recipient-by-recipient: text first to Shadchan 1, optional photo Yes/No,
   then text to Shadchan 2, optional photo Yes/No, etc. Uses whatsapp:// on Android so
   closing WhatsApp returns to PeerMatch instead of the api.whatsapp.com intermediary.
   Also normalizes the existing v116/v118 photo follow-up buttons to Yes / No. */
(function(){
  document.documentElement.dataset.peerMatchVersion='119';

  const KEY='pmMultiShadWaQueue';
  let sharingPhoto=false,seq=0,scheduled=false;
  const trim=v=>String(v||'').trim();
  const cleanName=v=>trim(v).replace(/\*/g,'')||'Unnamed profile';

  function senderName(x){return trim(x?.sourceName||x?.source);}
  function senderPhone(x){return trim(x?.sourcePhone);}
  function shareText(x){return typeof window.pmShareFilteredText==='function'?window.pmShareFilteredText(x):String(x?.text||'');}
  function profileText(x){return [x?.name||'Unnamed profile',x?.age?'Age: '+x.age:'',shareText(x),senderName(x)?'Sent by: '+senderName(x):'',senderPhone(x)?'Sender phone: '+senderPhone(x):''].filter(Boolean).join('\n');}
  function fullPhoto(x){return x?.profileMediaFull||x?.profileMedia||x?.profileImage||x?.photo||null;}
  function safeName(s){return String(s||'profile').replace(/[\\/:*?\"<>|]+/g,' ').replace(/\s+/g,' ').trim().slice(0,60)||'profile';}
  function photoFile(x){
    const blob=fullPhoto(x);if(!(blob instanceof Blob))return null;
    const type=blob.type||'image/jpeg',ext=type.includes('png')?'png':type.includes('webp')?'webp':type.includes('gif')?'gif':'jpg';
    return blob instanceof File?blob:new File([blob],safeName(cleanName(x?.name))+'.'+ext,{type});
  }
  function findProfile(k,id){return (data[k]||[]).find(x=>String(x.id)===String(id));}
  function findShad(id){return (data.shadchanim||[]).find(x=>String(x.id)===String(id));}
  function loadQ(){try{const raw=localStorage.getItem(KEY),q=raw?JSON.parse(raw):null;if(q&&!q.stage)q.stage='text';return q;}catch(e){return null;}}
  function saveQ(q){try{if(q)localStorage.setItem(KEY,JSON.stringify(q));else localStorage.removeItem(KEY);}catch(e){}}

  function advanceRecipient(q){
    q.recipientIndex++;
    q.stage='text';
    if(q.recipientIndex>=q.shadIds.length)saveQ(null);else saveQ(q);
  }

  function openDirect(target,text){
    if(/Android/i.test(navigator.userAgent||'')){
      try{
        const u=new URL(target),digits=u.pathname.replace(/^\/+/, '');
        if(digits){location.href='whatsapp://send?phone='+encodeURIComponent(digits)+'&text='+encodeURIComponent(text||'');return;}
      }catch(e){console.warn('PeerMatch v119 native WhatsApp URL',e);}
    }
    location.href=target;
  }

  async function saveShare(k,x,sh,text){
    const ts=typeof stamp==='function'?stamp():new Date().toLocaleString();
    const link='v119-'+x.id+'-'+sh.id+'-'+Date.now()+'-'+(seq++);
    x.activities=x.activities||[];sh.activities=sh.activities||[];
    x.activities.push({
      id:Date.now()*1000+(seq++%1000),type:'action',action:'Profile sent • WhatsApp',text,ts,channel:'whatsapp',
      recipient:trim(sh.name)||'Shadchan',recipientPhone:trim(sh.phone),recipientShadchanId:sh.id,shadchanId:sh.id,
      sharedProfileId:x.id,sharedProfileName:trim(x.name)||'Unnamed profile',sharedProfileKind:k,shareLinkId:link
    });
    sh.activities.push({
      id:Date.now()*1000+(seq++%1000),type:'action',action:'Profile received • WhatsApp',text,ts,channel:'whatsapp',
      sharedProfileId:x.id,sharedProfileName:trim(x.name)||'Unnamed profile',sharedProfileKind:k,
      profileId:x.id,profileName:trim(x.name)||'Unnamed profile',shareLinkId:link
    });
    try{await save();}catch(e){console.warn('PeerMatch v119 share history',e);}
  }

  async function sendText(){
    const q=loadQ();if(!q||q.stage==='photo')return;
    const x=findProfile(q.k,q.profileId),sh=findShad(q.shadIds[q.recipientIndex]);
    if(!x||!sh){advanceRecipient(q);renderBar();return;}
    const text=profileText(x),target=window.pmWhatsAppUrl?.(sh.phone,text)||'';
    if(!target){alert((trim(sh.name)||'This Shadchan')+' needs a valid WhatsApp phone number.');saveQ(null);renderBar();return;}
    await saveShare(q.k,x,sh,text);
    if(photoFile(x)){q.stage='photo';saveQ(q);}else advanceRecipient(q);
    renderBar();
    openDirect(target,text);
  }

  async function sendPhoto(){
    if(sharingPhoto)return;
    const q=loadQ();if(!q||q.stage!=='photo')return;
    const x=findProfile(q.k,q.profileId);if(!x){advanceRecipient(q);renderBar();return;}
    const file=photoFile(x);if(!file){advanceRecipient(q);renderBar();return;}
    sharingPhoto=true;
    try{
      const can=typeof navigator.share==='function'&&(!navigator.canShare||navigator.canShare({files:[file]}));
      if(can){
        try{await navigator.share({files:[file]});}
        catch(err){if(err?.name==='AbortError')return;console.warn('PeerMatch v119 photo share',err);alert('Could not open the photo share. Try again or choose No.');return;}
      }else{
        const u=URL.createObjectURL(file),a=document.createElement('a');a.href=u;a.download=file.name;a.style.display='none';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1500);
        alert('Photo sharing is not supported in this browser, so the photo was downloaded. Attach it in WhatsApp.');
      }
      advanceRecipient(q);renderBar();
    }finally{sharingPhoto=false;}
  }

  function skipPhoto(){const q=loadQ();if(!q||q.stage!=='photo')return;advanceRecipient(q);renderBar();}

  function renderBar(){
    const q=loadQ();let bar=document.getElementById('pmV119QueueBar');
    if(!q){bar?.remove();return;}
    const x=findProfile(q.k,q.profileId),sh=findShad(q.shadIds[q.recipientIndex]);
    if(!x||!sh){advanceRecipient(q);return renderBar();}
    const isPhoto=q.stage==='photo',name=cleanName(x.name),shName=trim(sh.name).replace(/\*/g,'')||'Shadchan';
    const labelText=isPhoto
      ?'Send '+name+'\u2019s photo to '+shName+'?'
      :'Send '+name+' to '+shName+' ('+(q.recipientIndex+1)+' of '+q.shadIds.length+')';
    if(!bar){
      bar=document.createElement('div');bar.id='pmV119QueueBar';
      bar.style.cssText='position:fixed;left:0;right:0;bottom:0;z-index:100000;background:#111;color:#fff;padding:10px 14px;display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:14px;box-shadow:0 -2px 8px rgba(0,0,0,.3)';
      const label=document.createElement('span');label.id='pmV119QueueLabel';
      const actions=document.createElement('span');actions.style.cssText='display:flex;gap:8px;flex-shrink:0;align-items:center';
      const send=document.createElement('button');send.id='pmV119TextSend';send.textContent='Send';send.onclick=sendText;
      const cancel=document.createElement('button');cancel.id='pmV119Cancel';cancel.className='secondary';cancel.textContent='Cancel';cancel.onclick=()=>{saveQ(null);renderBar();};
      const yes=document.createElement('button');yes.id='pmV119PhotoYes';yes.textContent='Yes';yes.onclick=sendPhoto;
      const no=document.createElement('button');no.id='pmV119PhotoNo';no.className='secondary';no.textContent='No';no.onclick=skipPhoto;
      actions.append(send,cancel,yes,no);bar.append(label,actions);document.body.appendChild(bar);
    }
    const label=bar.querySelector('#pmV119QueueLabel');if(label.textContent!==labelText)label.textContent=labelText;
    bar.querySelector('#pmV119TextSend').style.display=isPhoto?'none':'';
    bar.querySelector('#pmV119Cancel').style.display=isPhoto?'none':'';
    bar.querySelector('#pmV119PhotoYes').style.display=isPhoto?'':'none';
    bar.querySelector('#pmV119PhotoNo').style.display=isPhoto?'':'none';
  }

  function routeMulti(){
    const shads=window.pmGetSelected?.('shadchanim')||[];
    if(shads.length<2)return false;
    const guys=window.pmGetSelected?.('guys')||[],girls=window.pmGetSelected?.('girls')||[];
    const total=guys.length+girls.length;
    if(total===0)return false;
    if(total!==1){alert('When sending to multiple Shadchanim, select only one Guy or one Girl.');return true;}
    const k=guys.length?'guys':'girls',x=(guys[0]||girls[0]);
    const bad=shads.find(s=>!window.pmWhatsAppUrl?.(s.phone,'x'));
    if(bad){alert((trim(bad.name)||'One selected Shadchan')+' needs a valid phone number for WhatsApp.');return true;}
    saveQ({k,profileId:x.id,shadIds:shads.map(s=>s.id),recipientIndex:0,stage:'text'});
    sendText();
    return true;
  }
  window.pmRouteMultiShadchanWhatsApp=routeMulti;

  function bindButton(id){
    const b=document.getElementById(id);if(!b||b.dataset.pmV119Bound==='1')return;
    const prior=b.onclick;
    b.dataset.pmV119Bound='1';
    b.onclick=()=>{if(routeMulti())return;if(typeof prior==='function')return prior.call(b);};
  }

  function normalizePhotoButtons(){
    for(const [yesId,noId] of [['pmWaPhotoSend','pmWaPhotoSkip'],['pmV118PhotoSend','pmV118PhotoSkip']]){
      const yes=document.getElementById(yesId),no=document.getElementById(noId);
      if(yes&&yes.textContent!=='Yes')yes.textContent='Yes';
      if(no){if(no.textContent!=='No')no.textContent='No';no.title='No';no.setAttribute('aria-label','No');no.style.fontSize='14px';no.style.minWidth='44px';}
    }
  }

  function polish(){
    bindButton('pmWhatsApp-guys');bindButton('pmWhatsApp-girls');bindButton('pmWhatsApp-shadchanim');
    normalizePhotoButtons();renderBar();
  }
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;polish();});}
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true,characterData:true});
  window.addEventListener('focus',()=>setTimeout(polish,80));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(polish,80);});
  schedule();setTimeout(polish,300);
})();
