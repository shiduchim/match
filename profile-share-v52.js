/* PeerMatch v103: two intentional selected-profile WhatsApp/SMS behaviors, routed from
   one button, bound directly at the button's creation site.

   A. No single Shadchan selected (0 or 2+ selected), or the profile-only general case:
      the existing general WhatsApp/share path — sendWhatsApp() below. Lets the user pick
      any recipient (an existing Shadchan or a typed name/phone) via chooseWhatsAppRecipient(),
      tries Web Share with the profile photo first, falls back to a bare or targeted wa.me
      URL, and queues multiple selected profiles one at a time. This is pre-existing,
      intentional behavior — keep it working, do not remove it again.
   B. Exactly one Shadchan selected (with one or more Guy/Girl profiles selected): the
      direct "send this profile to this Shadchan" path — final-fixes-v107.js's
      directWhatsApp(), exposed as window.pmSendSelectedWhatsApp(k). It builds the
      message from the profile, launches straight to the Shadchan's saved number via
      peermatch-v19.js's window.pmWhatsAppUrl() (the same proven code the ordinary
      Shadchan-detail WhatsApp button uses), and writes exactly one history entry on
      each side. When more than one profile is selected, they are never merged into one
      message — final-fixes-v107.js sends the first immediately and queues the rest one
      at a time behind an explicit tap each (Shadchanim don't want bundled profiles). Do
      not duplicate wa.me URL construction or queueing here for that path.

   Selection reading for both paths uses window.pmGetSelected(k) (peermatch-v11.js) —
   the authoritative, ID-based selection. The old tracked-Set/DOM-position reconstruction
   (visible()/itemForCheckbox()/selectedCount()/a parallel `tracked` Set) has been removed
   from this file entirely; it was the same class of bug for both the WhatsApp and SMS
   paths, not just the now-removed one-file-one-path version of this bug from v113.

   The WhatsApp button's click is bound directly here, inside polishBar()'s creation
   block, not via a document-wide capture-phase listener: the button has no stable DOM
   identity (peermatch-v11.js's ensureSelectionBar() rebuilds the whole selection bar via
   innerHTML= on every checkbox toggle, destroying and recreating this button), so binding
   must happen at the button's actual (re)creation site to survive that churn. */
(function(){
  let waQueue=[],waIndex=0,waRecipient=null,smsQueue=[],smsIndex=0,historySeq=0;

  function senderName(x){return String(x?.sourceName||x?.source||'').trim();}
  function senderPhone(x){return String(x?.sourcePhone||'').trim();}
  function recordText(x){return [x?.name||'Unnamed profile',x?.age?'Age: '+x.age:'',x?.text||'',senderName(x)?'Sent by: '+senderName(x):'',senderPhone(x)?'Sender phone: '+senderPhone(x):''].filter(Boolean).join('\n');}
  function fullPhoto(x){return x?.profileMediaFull||x?.profileMedia||x?.profileImage||x?.photo||null;}
  function safeName(s){return String(s||'profile').replace(/[\\/:*?\"<>|]+/g,' ').replace(/\s+/g,' ').trim().slice(0,60)||'profile';}
  function asFile(blob,x,index){if(!(blob instanceof Blob))return null;const type=blob.type||'image/jpeg',ext=type.includes('png')?'png':type.includes('webp')?'webp':type.includes('gif')?'gif':'jpg';return new File([blob],safeName(x?.name||('profile-'+(index+1)))+'.'+ext,{type});}
  function plainSmsText(s){return String(s||'').replace(/\*+/g,'');}
  function safeHtml(s){return String(s||'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));}
  /* General-path-only phone helper (case A). Case B uses the shared window.pmWhatsAppUrl()
     instead — kept separate because this one intentionally falls back to a bare
     https://wa.me/ (no number) when there's no phone, letting WhatsApp's own picker take
     over; window.pmWhatsAppUrl() intentionally returns '' in that situation instead. */
  function waPhone(p){let d=String(p||'').replace(/\D/g,'');if(d.startsWith('00'))d=d.slice(2);if(d.startsWith('0'))d='972'+d.slice(1);else if(d.length===9&&d.startsWith('5'))d='972'+d;return d;}

  async function recordShare(x,channel,message,recipient){
    if(!x)return;const rn=String(recipient?.name||'').trim(),rp=String(recipient?.phone||'').trim(),sid=recipient?.shadchanId??recipient?.id??null;
    x.activities=x.activities||[];x.activities.push({id:Date.now()*1000+(historySeq++%1000),type:'action',action:'Profile shared • '+channel,text:String(message||''),ts:typeof stamp==='function'?stamp():new Date().toLocaleString(),recipient:rn,recipientPhone:rp,recipientSide:'Profile share',recipientShadchanId:sid,shadchanId:sid});
    try{await save();}catch(err){console.warn('PeerMatch could not save share history',err);}
  }

  function chooseWhatsAppRecipient(){
    return new Promise(resolve=>{
      document.getElementById('pmV97ShareRecipient')?.remove();
      const shade=document.createElement('div');shade.id='pmV97ShareRecipient';shade.style.cssText='position:fixed;inset:0;z-index:16000;background:rgba(0,0,0,.40);display:flex;align-items:flex-end;justify-content:center;padding:14px';
      const box=document.createElement('div');box.style.cssText='width:min(560px,100%);max-height:82vh;overflow:auto;background:#fff;border-radius:18px;padding:16px;box-shadow:0 12px 36px rgba(0,0,0,.28)';
      box.innerHTML=`<div style="font-weight:900;font-size:17px;margin-bottom:4px">Who are you sending this to?</div><div style="font-size:12px;color:#73818b;margin-bottom:12px">PeerMatch saves this recipient in History before opening WhatsApp.</div><label style="display:block;margin:8px 0;font-size:12px;color:#73818b">Existing Shadchan<select id="pmV97RecipientShad" style="width:100%;margin-top:4px;border:1px solid #d6d7d4;border-radius:11px;padding:10px;background:#fff;font:inherit;color:#19324a"><option value="">Choose Shadchan (optional)</option></select></label><label style="display:block;margin:8px 0;font-size:12px;color:#73818b">Name<input id="pmV97RecipientName" style="margin-top:4px" placeholder="Recipient name"></label><label style="display:block;margin:8px 0;font-size:12px;color:#73818b">Phone<input id="pmV97RecipientPhone" type="tel" inputmode="tel" style="margin-top:4px" placeholder="Phone number"></label><div id="pmV97RecipientErr" style="min-height:16px;font-size:11px;color:#8a4b20;margin-top:3px"></div><button id="pmV97RecipientGo" class="primary full" type="button">Continue to WhatsApp</button><button id="pmV97RecipientCancel" class="secondary full" type="button" style="margin-top:8px">Cancel</button>`;
      shade.appendChild(box);document.body.appendChild(shade);
      const sel=box.querySelector('#pmV97RecipientShad'),name=box.querySelector('#pmV97RecipientName'),phone=box.querySelector('#pmV97RecipientPhone'),err=box.querySelector('#pmV97RecipientErr');
      const arr=[...(data.shadchanim||[])].sort((a,b)=>String(a.name||'').localeCompare(String(b.name||'')));
      for(const s of arr){const o=document.createElement('option');o.value=String(s.id);o.textContent=String(s.name||'Unnamed Shadchan')+(s.phone?' • '+String(s.phone):'');sel.appendChild(o);}
      sel.onchange=()=>{const s=arr.find(z=>String(z.id)===String(sel.value));if(s){name.value=String(s.name||'');phone.value=String(s.phone||'');}};
      const done=v=>{shade.remove();resolve(v);};
      box.querySelector('#pmV97RecipientCancel').onclick=()=>done(null);
      shade.onclick=e=>{if(e.target===shade)done(null);};
      box.querySelector('#pmV97RecipientGo').onclick=()=>{const n=String(name.value||'').trim(),p=String(phone.value||'').trim(),s=arr.find(z=>String(z.id)===String(sel.value));if(!n&&!p){err.textContent='Enter a name or phone number.';return;}done({name:n,phone:p,shadchanId:s?.id??null,id:s?.id??null});};
    });
  }

  async function shareOneWhatsApp(x,index,recipient){
    const text=recordText(x),file=asFile(fullPhoto(x),x,index),direct=waPhone(recipient?.phone);
    if(file&&typeof navigator.share==='function'&&(!navigator.canShare||navigator.canShare({files:[file]}))){
      try{await navigator.share({title:x?.name||'PeerMatch profile',text,files:[file]});await recordShare(x,'WhatsApp',text,recipient);return'shared';}
      catch(err){if(err?.name==='AbortError')return'cancelled';console.warn('PeerMatch WhatsApp share failed',err);}
    }
    await recordShare(x,'WhatsApp',text,recipient);
    location.href=(direct?'https://wa.me/'+direct:'https://wa.me/')+'?text='+encodeURIComponent(text);return'fallback';
  }

  async function shareOneSms(x,index){
    const text=plainSmsText(recordText(x)),file=asFile(fullPhoto(x),x,index);
    if(file&&typeof navigator.share==='function'&&(!navigator.canShare||navigator.canShare({files:[file]}))){try{await navigator.share({title:x?.name||'PeerMatch profile',text,files:[file]});await recordShare(x,'SMS',text,null);return'shared';}catch(err){if(err?.name==='AbortError')return'cancelled';console.warn('PeerMatch SMS photo share failed',err);}}
    await recordShare(x,'SMS',text,null);location.href='sms:?body='+encodeURIComponent(text);return'fallback';
  }

  function closeWaQueue(){document.getElementById('pmWaQueue')?.remove();waQueue=[];waIndex=0;waRecipient=null;}
  function renderWaQueue(){
    document.getElementById('pmWaQueue')?.remove();if(!waQueue.length||waIndex>=waQueue.length){closeWaQueue();return;}
    const x=waQueue[waIndex],shade=document.createElement('div');shade.id='pmWaQueue';shade.style.cssText='position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.36);display:flex;align-items:flex-end;justify-content:center;padding:14px';
    const box=document.createElement('div');box.style.cssText='width:min(560px,100%);background:#fff;border-radius:18px;padding:16px;box-shadow:0 12px 36px rgba(0,0,0,.28)';
    box.innerHTML=`<div style="font-weight:850;font-size:17px;margin-bottom:5px">Share profiles separately</div><div style="font-size:13px;color:#667;margin-bottom:6px">To: <b>${safeHtml(waRecipient?.name||waRecipient?.phone||'Recipient')}</b></div><div style="font-size:13px;color:#667;margin-bottom:12px">Profile ${waIndex+1} of ${waQueue.length}: <b>${safeHtml(String(x?.name||'Unnamed profile').replace(/\*/g,''))}</b></div><button id="pmWaShareNext" style="width:100%;padding:12px;border-radius:12px;font-weight:850">Share this profile</button><button id="pmWaCancelQueue" class="secondary" style="width:100%;margin-top:8px;padding:10px;border-radius:12px">Cancel</button>`;
    shade.appendChild(box);document.body.appendChild(shade);box.querySelector('#pmWaCancelQueue').onclick=closeWaQueue;
    box.querySelector('#pmWaShareNext').onclick=async()=>{const btn=box.querySelector('#pmWaShareNext');btn.disabled=true;btn.textContent='Opening share...';const result=await shareOneWhatsApp(x,waIndex,waRecipient);if(result==='cancelled'){btn.disabled=false;btn.textContent='Share this profile';return;}waIndex++;if(waIndex>=waQueue.length)closeWaQueue();else renderWaQueue();};
  }

  function closeSmsQueue(){document.getElementById('pmSmsQueue')?.remove();smsQueue=[];smsIndex=0;}
  function renderSmsQueue(){
    document.getElementById('pmSmsQueue')?.remove();if(!smsQueue.length||smsIndex>=smsQueue.length){closeSmsQueue();return;}
    const x=smsQueue[smsIndex],shade=document.createElement('div');shade.id='pmSmsQueue';shade.style.cssText='position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.36);display:flex;align-items:flex-end;justify-content:center;padding:14px';
    const box=document.createElement('div');box.style.cssText='width:min(560px,100%);background:#fff;border-radius:18px;padding:16px;box-shadow:0 12px 36px rgba(0,0,0,.28)';
    box.innerHTML=`<div style="font-weight:850;font-size:17px;margin-bottom:5px">Send profiles separately</div><div style="font-size:13px;color:#667;margin-bottom:12px">Profile ${smsIndex+1} of ${smsQueue.length}: <b>${safeHtml(String(x?.name||'Unnamed profile').replace(/\*/g,''))}</b></div><button id="pmSmsShareNext" style="width:100%;padding:12px;border-radius:12px;font-weight:850">Send this profile</button><button id="pmSmsCancelQueue" class="secondary" style="width:100%;margin-top:8px;padding:10px;border-radius:12px">Cancel</button>`;
    shade.appendChild(box);document.body.appendChild(shade);box.querySelector('#pmSmsCancelQueue').onclick=closeSmsQueue;
    box.querySelector('#pmSmsShareNext').onclick=async()=>{const btn=box.querySelector('#pmSmsShareNext');btn.disabled=true;btn.textContent='Opening share...';const result=await shareOneSms(x,smsIndex);if(result==='cancelled'){btn.disabled=false;btn.textContent='Send this profile';return;}smsIndex++;if(smsIndex>=smsQueue.length)closeSmsQueue();else renderSmsQueue();};
  }

  /* Case A: general WhatsApp share path. Selection is read via window.pmGetSelected —
     the same authoritative source as case B — instead of the old tracked-Set/DOM
     reconstruction. */
  async function sendWhatsApp(k){
    const items=window.pmGetSelected(k);if(!items.length)return;
    const shads=window.pmGetSelected('shadchanim');
    if(shads.length>1)return alert('Select only one Shadchan before sending a profile.');
    const picked=shads.length===1?shads[0]:null;
    let recipient=null;
    if(picked){
      if(!waPhone(picked.phone))return alert('The selected Shadchan needs a phone number for WhatsApp.');
      recipient={name:String(picked.name||'Shadchan'),phone:String(picked.phone||''),shadchanId:picked.id,id:picked.id};
    }else{
      recipient=await chooseWhatsAppRecipient();
    }
    if(!recipient)return;waRecipient=recipient;if(items.length===1){await shareOneWhatsApp(items[0],0,recipient);waRecipient=null;return;}waQueue=items.slice();waIndex=0;renderWaQueue();
  }
  async function sendSms(k){const items=window.pmGetSelected(k);if(!items.length)return;if(items.length===1){await shareOneSms(items[0],0);return;}smsQueue=items.slice();smsIndex=0;renderSmsQueue();}

  /* Creates the WhatsApp/SMS buttons and binds the WhatsApp click directly here, at
     creation time. The handler is the router between case A and case B: exactly one
     Shadchan selected (with one or more profiles) goes to the direct path
     (window.pmSendSelectedWhatsApp) — final-fixes-v107.js queues profiles one at a time
     when more than one is selected, never merging them into a single message; anything
     else (no Shadchan selected, or 2+ Shadchanim) goes to the general path
     (sendWhatsApp) above. */
  function polishBar(k){
    const bar=document.getElementById('pmSelected-'+k);if(!bar||bar.classList.contains('hidden'))return;
    bar.querySelector('#pmCopy-'+k)?.remove();
    const email=bar.querySelector('#pmEmail-'+k);if(!email)return;
    if(!bar.querySelector('#pmWhatsApp-'+k)){
      const b=document.createElement('button');b.id='pmWhatsApp-'+k;b.className='secondary';b.textContent='WhatsApp';
      email.insertAdjacentElement('beforebegin',b);
      b.onclick=()=>{
        const profiles=window.pmGetSelected(k);if(!profiles.length)return;
        const shads=window.pmGetSelected('shadchanim');
        if(shads.length===1&&typeof window.pmSendSelectedWhatsApp==='function'){window.pmSendSelectedWhatsApp(k);return;}
        sendWhatsApp(k);
      };
    }
    if(!bar.querySelector('#pmSms-'+k)){const b=document.createElement('button');b.id='pmSms-'+k;b.className='secondary';b.textContent='SMS';email.insertAdjacentElement('beforebegin',b);}
  }
  function polish(){polishBar('guys');polishBar('girls');}

  document.addEventListener('click',e=>{
    const sms=e.target.closest?.('button[id^="pmSms-"]');if(sms){const k=sms.id.slice('pmSms-'.length);if(k==='guys'||k==='girls'){e.preventDefault();e.stopImmediatePropagation();sendSms(k);}}
  },true);

  let scheduled=false;function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;polish();});}
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});schedule();
})();
