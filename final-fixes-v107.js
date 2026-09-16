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
   its own explicit tap before navigating to wa.me again, and surviving PeerMatch losing
   focus while WhatsApp is open (the queue is re-read from localStorage on every poll). */
(function(){
  document.documentElement.dataset.peerMatchVersion='107';
  let queued=false,seq=0;
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
  function loadQueue(){try{const raw=localStorage.getItem(WA_QUEUE_KEY);return raw?JSON.parse(raw):null;}catch(e){return null;}}
  function saveQueue(q){try{if(q)localStorage.setItem(WA_QUEUE_KEY,JSON.stringify(q));else localStorage.removeItem(WA_QUEUE_KEY);}catch(e){}}

  /* Sends exactly the CURRENT queue item (one wa.me navigation, one history entry each
     side), then advances/persists the queue for the next explicit tap. Never sends more
     than one profile per call — multi-profile handoffs must never be merged into one
     WhatsApp message or fired without a user tap per profile. */
  async function sendQueueItem(){
    const q=loadQueue();if(!q)return;
    const sh=findRecord('shadchanim',q.shadchanId);
    if(!sh){alert('The selected Shadchan is no longer available.');saveQueue(null);renderQueueBar();return;}
    const x=findRecord(q.k,q.ids[q.index]);
    if(!x){q.index++;if(q.index>=q.ids.length)saveQueue(null);else saveQueue(q);renderQueueBar();return;}
    const text=profileText(x);
    const target=window.pmWhatsAppUrl(sh.phone,text);
    if(!target){alert('The selected Shadchan needs a phone number for WhatsApp.');saveQueue(null);renderQueueBar();return;}
    await saveShare(q.k,x,sh,text);
    try{await save();}catch(e){console.warn('PeerMatch v107 share history',e);}
    q.index++;
    if(q.index>=q.ids.length)saveQueue(null);else saveQueue(q);
    renderQueueBar();
    location.href=target;
  }

  /* Idempotent by design: the bar and its Send/Cancel buttons are created and bound
     exactly once. Every later call only touches the label's text, and only when it has
     actually changed. This matters because renderQueueBar() runs from polish(), which is
     itself scheduled by the body-wide MutationObserver below — an unconditional
     innerHTML rebuild here would count as a DOM mutation on every single poll, re-firing
     that same observer and creating a self-sustaining render loop for as long as a queue
     exists. */
  function renderQueueBar(){
    const q=loadQueue();
    let bar=document.getElementById('pmWaQueueBar');
    if(!q){bar?.remove();return;}
    const sh=findRecord('shadchanim',q.shadchanId);
    const text=`Send profile ${q.index+1} of ${q.ids.length} to ${trim(sh?.name)||'Shadchan'}`;
    if(!bar){
      bar=document.createElement('div');bar.id='pmWaQueueBar';
      bar.style.cssText='position:fixed;left:0;right:0;bottom:0;z-index:99999;background:#111;color:#fff;padding:10px 14px;display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:14px;box-shadow:0 -2px 8px rgba(0,0,0,.3)';
      const label=document.createElement('span');label.id='pmWaQueueLabel';
      const actions=document.createElement('span');actions.style.cssText='display:flex;gap:8px;flex-shrink:0';
      const sendBtn=document.createElement('button');sendBtn.textContent='Send';sendBtn.onclick=()=>{sendQueueItem();};
      const cancelBtn=document.createElement('button');cancelBtn.className='secondary';cancelBtn.textContent='Cancel';cancelBtn.onclick=()=>{saveQueue(null);renderQueueBar();};
      actions.appendChild(sendBtn);actions.appendChild(cancelBtn);
      bar.appendChild(label);bar.appendChild(actions);
      document.body.appendChild(bar);
    }
    const label=bar.querySelector('#pmWaQueueLabel');
    if(label.textContent!==text)label.textContent=text;
  }

  /* Single source of truth for "what's selected": peermatch-v11.js's real closure-owned
     Sets, exposed read-only via window.pmGetSelected(k). Never reconstruct selection
     from DOM card position/count — the Shadchan list is reordered/grouped/collapsed by
     other live scripts, so a positional mapping back to data.shadchanim silently picks
     the wrong record (or the wrong count) once that happens.
     Phone normalization + wa.me URL building is window.pmWhatsAppUrl() (peermatch-v19.js)
     — the same proven code the ordinary Shadchan-detail WhatsApp button uses. Do not
     re-derive a wa.me URL here.
     Multiple selected profiles are queued, never merged: the first sends immediately
     (this call is itself the user's tap), the rest wait for their own tap on the
     bottom queue bar rendered by renderQueueBar(). */
  async function directWhatsApp(k){
    const profiles=window.pmGetSelected(k);if(!profiles.length)return false;
    const shads=window.pmGetSelected('shadchanim');
    if(shads.length>1){alert('Select only one Shadchan before sending on WhatsApp.');return true;}
    if(shads.length<1){alert('Select exactly one Shadchan to send this profile to on WhatsApp.');return true;}
    const sh=shads[0];
    if(!window.pmWhatsAppUrl(sh.phone,'x')){alert('The selected Shadchan needs a phone number for WhatsApp.');return true;}
    saveQueue({k,shadchanId:sh.id,ids:profiles.map(p=>p.id),index:0});
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