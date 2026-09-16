/* PeerMatch v107: direct selected WhatsApp send and top-right Edit reinforcement.
   Attachment viewing (images and PDFs) was consolidated into profile-pdf-ocr-v63.js's
   openPmAttachment() at v111 — this file no longer binds any attachment click handler.
   Selection reading was switched to peermatch-v11.js's window.pmGetSelected(k) at v113
   — this file no longer reconstructs "what's checked" from DOM card position.
   At v114, the wa.me URL/phone-normalization was switched to the shared
   window.pmWhatsAppUrl() helper (peermatch-v19.js) — the same proven code path the
   ordinary Shadchan-detail WhatsApp button uses. This file's own document-wide
   capture-phase click listener for the selected-profile WhatsApp button was removed;
   profile-share-v52.js now binds the click directly on the button at creation time
   (see that file), calling window.pmSendSelectedWhatsApp (exposed below).
   Also at v114: when multiple profiles are selected alongside one Shadchan, they are
   never merged into a single WhatsApp message (Shadchanim don't want bundled profiles).
   Instead a small persistent one-at-a-time send queue is kept in localStorage
   (`pmWaSendQueue`) — the first profile sends on the same tap that opened this flow,
   then a bottom bar prompts "Send profile N of M" for each remaining profile, requiring
   its own explicit tap before navigating to WhatsApp again, and surviving PeerMatch
   losing focus while WhatsApp is open (the queue is re-read from localStorage on every poll).

   v116 adds an OPTIONAL photo-only follow-up for Case B. Text still goes first, directly
   to the selected Shadchan. If (and only if) that profile has a real stored image Blob,
   the queue pauses on that same profile and shows "Send <name>'s photo?" with Send photo
   and X. Send photo uses navigator.share({files:[file]}) with NO text; X skips the photo.
   Only after share/skip does the queue advance to the next profile. Profiles with no
   photo never show the extra prompt.

   v116 also avoids the WhatsApp web/API intermediary screen on Android for this direct
   selected-Shadchan flow: after the same proven pmWhatsAppUrl() validation/normalization,
   Android launches whatsapp://send?... directly. Non-Android keeps the existing wa.me
   behavior. This leaves the installed PWA underneath WhatsApp so returning does not land
   on the api.whatsapp.com / Share on WhatsApp page. */
(function(){
  document.documentElement.dataset.peerMatchVersion='107';
  let queued=false,seq=0,sharingPhoto=false;
  const WA_QUEUE_KEY='pmWaSendQueue';

  const trim=v=>String(v||'').trim();
  function senderName(x){return trim(x?.sourceName||x?.source);}
  function senderPhone(x){return trim(x?.sourcePhone);}
  /* Respects the profile's own "Include when sharing" English/Hebrew/Russian settings
     via the existing window.pmShareFilteredText(x) (profile-tools-v62.js) — the same
     filter the old, now-removed WhatsApp interception used to apply. Falls back to raw
     x.text if that helper isn't available for any reason. */
  function shareText(x){return typeof window.pmShareFilteredText==='function'?window.pmShareFilteredText(x):String(x?.text||'');}
  function profileText(x){return [x?.name||'Unnamed profile',x?.age?'Age: '+x.age:'',shareText(x),senderName(x)?'Sent by: '+senderName(x):'',senderPhone(x)?'Sender phone: '+senderPhone(x):''].filter(Boolean).join('\n');}
  function fullPhoto(x){return x?.profileMediaFull||x?.profileMedia||x?.profileImage||x?.photo||null;}
  function safeName(s){return String(s||'profile').replace(/[\\/:*?\"<>|]+/g,' ').replace(/\s+/g,' ').trim().slice(0,60)||'profile';}
  function photoFile(x,index){
    const blob=fullPhoto(x);if(!(blob instanceof Blob))return null;
    const type=blob.type||'image/jpeg';
    const ext=type.includes('png')?'png':type.includes('webp')?'webp':type.includes('gif')?'gif':'jpg';
    return blob instanceof File?blob:new File([blob],safeName(x?.name||('profile-'+(index+1)))+'.'+ext,{type});
  }

  async function saveShare(k,x,sh,text){
    const ts=typeof stamp==='function'?stamp():new Date().toLocaleString(),link=`v107-${x.id}-${sh.id}-${Date.now()}-${seq++}`;
    x.activities=x.activities||[];sh.activities=sh.activities||[];
    x.activities.push({id:Date.now()*1000+(seq++%1000),type:'action',action:'Profile sent • WhatsApp',text,ts,channel:'whatsapp',recipient:trim(sh.name)||'Shadchan',recipientPhone:trim(sh.phone),recipientShadchanId:sh.id,shadchanId:sh.id,sharedProfileId:x.id,sharedProfileName:trim(x.name)||'Unnamed profile',sharedProfileKind:k,shareLinkId:link});
    sh.activities.push({id:Date.now()*1000+(seq++%1000),type:'action',action:'Profile received • WhatsApp',text,ts,channel:'whatsapp',sharedProfileId:x.id,sharedProfileName:trim(x.name)||'Unnamed profile',sharedProfileKind:k,profileId:x.id,profileName:trim(x.name)||'Unnamed profile',shareLinkId:link});
  }
  function findRecord(k,id){
    const list=k==='guys'?data.guys:k==='girls'?data.girls:data.shadchanim;
    return (list||[]).find(r=>r.id===id);
  }
  function loadQueue(){
    try{
      const raw=localStorage.getItem(WA_QUEUE_KEY),q=raw?JSON.parse(raw):null;
      if(q&&!q.stage)q.stage='text';
      return q;
    }catch(e){return null;}
  }
  function saveQueue(q){try{if(q)localStorage.setItem(WA_QUEUE_KEY,JSON.stringify(q));else localStorage.removeItem(WA_QUEUE_KEY);}catch(e){}}
  function advanceQueue(q){
    q.index++;
    q.stage='text';
    if(q.index>=q.ids.length)saveQueue(null);else saveQueue(q);
  }

  /* Android-only native scheme for the direct Case-B text handoff. A wa.me navigation
     replaces the PWA with WhatsApp's web/API intermediary, so Back/closing WhatsApp can
     reveal that Chrome-like page. whatsapp:// hands directly to the installed app and
     leaves PeerMatch underneath. The already-built pmWhatsAppUrl remains the source of
     truth for normalization and validation; we only reuse its normalized digits here. */
  function openDirectWhatsApp(target,text){
    if(/Android/i.test(navigator.userAgent||'')){
      try{
        const u=new URL(target),digits=u.pathname.replace(/^\/+/, '');
        if(digits){location.href='whatsapp://send?phone='+encodeURIComponent(digits)+'&text='+encodeURIComponent(text||'');return;}
      }catch(e){console.warn('PeerMatch v116 native WhatsApp URL',e);}
    }
    location.href=target;
  }

  function downloadPhoto(file,x){
    const u=URL.createObjectURL(file),a=document.createElement('a');
    a.href=u;a.download=file.name||safeName(x?.name||'profile')+'.jpg';a.style.display='none';
    document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1500);
  }

  async function sendPhotoItem(){
    if(sharingPhoto)return;
    const q=loadQueue();if(!q||q.stage!=='photo')return;
    const x=findRecord(q.k,q.ids[q.index]);
    if(!x){advanceQueue(q);renderQueueBar();return;}
    const file=photoFile(x,q.index);
    if(!file){advanceQueue(q);renderQueueBar();return;}

    sharingPhoto=true;
    try{
      const canNativeShare=typeof navigator.share==='function'&&(!navigator.canShare||navigator.canShare({files:[file]}));
      if(canNativeShare){
        try{await navigator.share({files:[file]});}
        catch(err){
          if(err?.name==='AbortError')return;
          console.warn('PeerMatch v116 photo share failed',err);
          alert('Could not open the photo share. Try again or tap X to skip it.');
          return;
        }
      }else{
        downloadPhoto(file,x);
        alert('Photo sharing is not supported in this browser, so the photo was downloaded. Attach it in WhatsApp.');
      }
      advanceQueue(q);
      renderQueueBar();
    }finally{sharingPhoto=false;}
  }

  function skipPhotoItem(){
    const q=loadQueue();if(!q||q.stage!=='photo')return;
    advanceQueue(q);renderQueueBar();
  }

  /* Sends exactly the CURRENT text-stage queue item (one direct WhatsApp navigation,
     one history entry each side). If that profile has a stored photo Blob, the queue
     stays on the same profile and changes to stage='photo'; otherwise it advances to
     the next profile immediately. No more than one profile text is ever handed off per
     explicit tap. */
  async function sendQueueItem(){
    const q=loadQueue();if(!q)return;
    if(q.stage==='photo')return;
    const sh=findRecord('shadchanim',q.shadchanId);
    if(!sh){alert('The selected Shadchan is no longer available.');saveQueue(null);renderQueueBar();return;}
    const x=findRecord(q.k,q.ids[q.index]);
    if(!x){advanceQueue(q);renderQueueBar();return;}
    const text=profileText(x);
    const target=window.pmWhatsAppUrl(sh.phone,text);
    if(!target){alert('The selected Shadchan needs a phone number for WhatsApp.');saveQueue(null);renderQueueBar();return;}
    await saveShare(q.k,x,sh,text);
    try{await save();}catch(e){console.warn('PeerMatch v107 share history',e);}

    if(photoFile(x,q.index)){
      q.stage='photo';
      saveQueue(q);
    }else{
      advanceQueue(q);
    }
    renderQueueBar();
    openDirectWhatsApp(target,text);
  }

  /* Idempotent by design: one fixed bar owns both text-stage and photo-stage controls.
     Later polls only change label text / button visibility, avoiding a MutationObserver
     render loop. Photo stage shows Send photo + X; text stage shows Send + Cancel. */
  function renderQueueBar(){
    const q=loadQueue();
    let bar=document.getElementById('pmWaQueueBar');
    if(!q){bar?.remove();return;}
    const sh=findRecord('shadchanim',q.shadchanId),x=findRecord(q.k,q.ids[q.index]);
    const isPhoto=q.stage==='photo';
    const text=isPhoto
      ?`Send ${(trim(x?.name)||'this profile')}\u2019s photo?`
      :`Send profile ${q.index+1} of ${q.ids.length} to ${trim(sh?.name)||'Shadchan'}`;
    if(!bar){
      bar=document.createElement('div');bar.id='pmWaQueueBar';
      bar.style.cssText='position:fixed;left:0;right:0;bottom:0;z-index:99999;background:#111;color:#fff;padding:10px 14px;display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:14px;box-shadow:0 -2px 8px rgba(0,0,0,.3)';
      const label=document.createElement('span');label.id='pmWaQueueLabel';
      const actions=document.createElement('span');actions.style.cssText='display:flex;gap:8px;flex-shrink:0;align-items:center';
      const sendBtn=document.createElement('button');sendBtn.id='pmWaTextSend';sendBtn.textContent='Send';sendBtn.onclick=()=>{sendQueueItem();};
      const cancelBtn=document.createElement('button');cancelBtn.id='pmWaTextCancel';cancelBtn.className='secondary';cancelBtn.textContent='Cancel';cancelBtn.onclick=()=>{saveQueue(null);renderQueueBar();};
      const photoBtn=document.createElement('button');photoBtn.id='pmWaPhotoSend';photoBtn.textContent='Send photo';photoBtn.onclick=()=>{sendPhotoItem();};
      const skipBtn=document.createElement('button');skipBtn.id='pmWaPhotoSkip';skipBtn.className='secondary';skipBtn.textContent='\u00d7';skipBtn.title='Do not send photo';skipBtn.setAttribute('aria-label','Do not send photo');skipBtn.style.cssText='min-width:38px;font-size:20px;line-height:1';skipBtn.onclick=skipPhotoItem;
      actions.appendChild(sendBtn);actions.appendChild(cancelBtn);actions.appendChild(photoBtn);actions.appendChild(skipBtn);
      bar.appendChild(label);bar.appendChild(actions);
      document.body.appendChild(bar);
    }
    const label=bar.querySelector('#pmWaQueueLabel');if(label.textContent!==text)label.textContent=text;
    const sendBtn=bar.querySelector('#pmWaTextSend'),cancelBtn=bar.querySelector('#pmWaTextCancel'),photoBtn=bar.querySelector('#pmWaPhotoSend'),skipBtn=bar.querySelector('#pmWaPhotoSkip');
    sendBtn.style.display=isPhoto?'none':'';cancelBtn.style.display=isPhoto?'none':'';
    photoBtn.style.display=isPhoto?'':'none';skipBtn.style.display=isPhoto?'':'none';
  }

  /* Single source of truth for "what's selected": peermatch-v11.js's real closure-owned
     Sets, exposed read-only via window.pmGetSelected(k). Never reconstruct selection
     from DOM card position/count — the Shadchan list is reordered/grouped/collapsed by
     other live scripts, so a positional mapping back to data.shadchanim silently picks
     the wrong record (or the wrong count) once that happens.
     Phone normalization + wa.me URL building is window.pmWhatsAppUrl() (peermatch-v19.js)
     — the same proven code the ordinary Shadchan-detail WhatsApp button uses. Do not
     re-derive phone normalization here.
     Multiple selected profiles are queued, never merged: the first sends immediately
     (this call is itself the user's tap), then any optional photo follow-up is handled,
     then the rest wait for their own explicit tap on the bottom queue bar. */
  async function directWhatsApp(k){
    const profiles=window.pmGetSelected(k);if(!profiles.length)return false;
    const shads=window.pmGetSelected('shadchanim');
    if(shads.length>1){alert('Select only one Shadchan before sending on WhatsApp.');return true;}
    if(shads.length<1){alert('Select exactly one Shadchan to send this profile to on WhatsApp.');return true;}
    const sh=shads[0];
    if(!window.pmWhatsAppUrl(sh.phone,'x')){alert('The selected Shadchan needs a phone number for WhatsApp.');return true;}
    saveQueue({k,shadchanId:sh.id,ids:profiles.map(p=>p.id),index:0,stage:'text'});
    await sendQueueItem();
    return true;
  }
  /* Exposed so profile-share-v52.js can bind it directly on the selected-profile WhatsApp
     button at the moment that button is (re)created, instead of this file depending on a
     document-wide capture-phase listener to catch the click. */
  window.pmSendSelectedWhatsApp=directWhatsApp;

  /* v115: single shared decision point for "does this WhatsApp tap mean Case B (direct
     send to the one selected Shadchan)?" — used by BOTH the Guy/Girl selection bar
     (profile-share-v52.js) and the Shadchanim selection bar (shadchan-share-v55.js) so
     the two toolbars can never diverge on the answer again. Each bar's own button falls
     back to its own default behavior (general share / Shadchan-contact-share) only when
     this returns false — it does not decide anything on its own selection reads. */
  window.pmRouteSelectedWhatsApp=function(){
    const shads=window.pmGetSelected('shadchanim');
    if(shads.length!==1)return false;
    const guys=window.pmGetSelected('guys'),girls=window.pmGetSelected('girls');
    if(guys.length&&girls.length){alert('Select only Guy profiles or only Girl profiles (not both) before sending to a Shadchan on WhatsApp.');return true;}
    if(guys.length){directWhatsApp('guys');return true;}
    if(girls.length){directWhatsApp('girls');return true;}
    return false;
  };

  function keepEditTop(){
    const sheet=document.getElementById('sheet'),edit=sheet?.querySelector('#v19EditProfile'),head=sheet?.querySelector('.v19Head');if(!sheet||!edit||!head||sheet.querySelector('.v19ShadHead'))return;
    let stack=head.querySelector('.pmV82EditStack');if(!stack){stack=document.createElement('div');stack.className='pmV82EditStack';const bh=document.createElement('div');bh.className='pmV82BH';bh.textContent='ב״ה';stack.appendChild(bh);head.appendChild(stack);}if(edit.parentElement!==stack)stack.appendChild(edit);edit.textContent='Edit';
  }
  function polish(){keepEditTop();renderQueueBar();}

  const priorP=window.openP;if(typeof priorP==='function')window.openP=function(k,id){const r=priorP(k,id);setTimeout(polish,70);return r;};
  const priorS=window.openS;if(typeof priorS==='function')window.openS=function(id){const r=priorS(id);setTimeout(polish,70);return r;};

  function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;polish();});}
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});schedule();setTimeout(polish,300);
})();