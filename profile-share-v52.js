/* PeerMatch v103: SMS sharing for selected profiles.
   The selected-profile -> selected-Shadchan WhatsApp flow that used to live here
   (sendWhatsApp/selectedShadchan/chooseWhatsAppRecipient/waQueue) was removed at v113:
   it reconstructed "what's selected" from DOM card position via visibleShadchanim(),
   which breaks whenever the Shadchan list is reordered/grouped/collapsed. That flow is
   now owned exclusively by final-fixes-v107.js's directWhatsApp(), reading the real
   selection via peermatch-v11.js's window.pmGetSelected(k). Do not add WhatsApp-sending
   logic back to this file. */
(function(){
  const tracked={guys:new Set(),girls:new Set()};
  let smsQueue=[],smsIndex=0,historySeq=0;

  function senderName(x){return String(x?.sourceName||x?.source||'').trim();}
  function senderPhone(x){return String(x?.sourcePhone||'').trim();}
  function recordText(x){return [x?.name||'Unnamed profile',x?.age?'Age: '+x.age:'',x?.text||'',senderName(x)?'Sent by: '+senderName(x):'',senderPhone(x)?'Sender phone: '+senderPhone(x):''].filter(Boolean).join('\n');}
  function visible(k){const q=(document.getElementById(k+'Search')?.value||'').toLowerCase();return(data[k]||[]).filter(x=>`${x.name||''} ${x.age||''} ${x.text||''} ${senderName(x)} ${senderPhone(x)} ${(x.activities||[]).map(a=>a.text||a.action||'').join(' ')}`.toLowerCase().includes(q));}
  function itemForCheckbox(k,check){const list=document.getElementById(k+'List'),card=check.closest('.card');if(!list||!card)return null;const cards=[...list.children].filter(el=>el.classList?.contains('card')),i=cards.indexOf(card);return i>=0?visible(k)[i]||null:null;}
  function selectedCount(k){const m=(document.querySelector('#pmSelected-'+k+' .pmCount')?.textContent||'').match(/\d+/);return m?Number(m[0]):0;}
  function selectedItems(k){const n=selectedCount(k);let items=(data[k]||[]).filter(x=>tracked[k].has(x.id));if(items.length===n)return items;const list=document.getElementById(k+'List');if(!list)return[];const a=visible(k),cards=[...list.children].filter(el=>el.classList?.contains('card'));items=[];cards.forEach((c,i)=>{if(c.querySelector('.pmListCheck:checked')&&a[i])items.push(a[i]);});return items;}
  function fullPhoto(x){return x?.profileMediaFull||x?.profileMedia||x?.profileImage||x?.photo||null;}
  function safeName(s){return String(s||'profile').replace(/[\\/:*?\"<>|]+/g,' ').replace(/\s+/g,' ').trim().slice(0,60)||'profile';}
  function asFile(blob,x,index){if(!(blob instanceof Blob))return null;const type=blob.type||'image/jpeg',ext=type.includes('png')?'png':type.includes('webp')?'webp':type.includes('gif')?'gif':'jpg';return new File([blob],safeName(x?.name||('profile-'+(index+1)))+'.'+ext,{type});}
  function plainSmsText(s){return String(s||'').replace(/\*+/g,'');}
  function safeHtml(s){return String(s||'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));}

  async function recordShare(x,channel,message,recipient){
    if(!x)return;const rn=String(recipient?.name||'').trim(),rp=String(recipient?.phone||'').trim(),sid=recipient?.shadchanId??recipient?.id??null;
    x.activities=x.activities||[];x.activities.push({id:Date.now()*1000+(historySeq++%1000),type:'action',action:'Profile shared • '+channel,text:String(message||''),ts:typeof stamp==='function'?stamp():new Date().toLocaleString(),recipient:rn,recipientPhone:rp,recipientSide:'Profile share',recipientShadchanId:sid,shadchanId:sid});
    try{await save();}catch(err){console.warn('PeerMatch could not save share history',err);}
  }

  async function shareOneSms(x,index){
    const text=plainSmsText(recordText(x)),file=asFile(fullPhoto(x),x,index);
    if(file&&typeof navigator.share==='function'&&(!navigator.canShare||navigator.canShare({files:[file]}))){try{await navigator.share({title:x?.name||'PeerMatch profile',text,files:[file]});await recordShare(x,'SMS',text,null);return'shared';}catch(err){if(err?.name==='AbortError')return'cancelled';console.warn('PeerMatch SMS photo share failed',err);}}
    await recordShare(x,'SMS',text,null);location.href='sms:?body='+encodeURIComponent(text);return'fallback';
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

  async function sendSms(k){const items=selectedItems(k);if(!items.length)return;if(items.length===1){await shareOneSms(items[0],0);return;}smsQueue=items.slice();smsIndex=0;renderSmsQueue();}

  /* The WhatsApp button itself is still created here (final-fixes-v107.js's
     directWhatsApp() needs it to exist) — only this file's own click handling of it
     was removed, since v107 now owns that click exclusively. */
  function polishBar(k){const bar=document.getElementById('pmSelected-'+k);if(!bar||bar.classList.contains('hidden'))return;bar.querySelector('#pmCopy-'+k)?.remove();const email=bar.querySelector('#pmEmail-'+k);if(!email)return;if(!bar.querySelector('#pmWhatsApp-'+k)){const b=document.createElement('button');b.id='pmWhatsApp-'+k;b.className='secondary';b.textContent='WhatsApp';email.insertAdjacentElement('beforebegin',b);}if(!bar.querySelector('#pmSms-'+k)){const b=document.createElement('button');b.id='pmSms-'+k;b.className='secondary';b.textContent='SMS';email.insertAdjacentElement('beforebegin',b);}}
  function polish(){polishBar('guys');polishBar('girls');}

  document.addEventListener('click',e=>{
    const check=e.target.closest?.('.pmListCheck');if(check){const list=check.closest('#guysList,#girlsList');if(list){const k=list.id==='guysList'?'guys':'girls',x=itemForCheckbox(k,check);if(x){if(check.checked)tracked[k].add(x.id);else tracked[k].delete(x.id);}}return;}
    const clear=e.target.closest?.('button[id^="pmClear-"]');if(clear){const k=clear.id.slice('pmClear-'.length);if(tracked[k])tracked[k].clear();return;}
    const sms=e.target.closest?.('button[id^="pmSms-"]');if(sms){const k=sms.id.slice('pmSms-'.length);if(k==='guys'||k==='girls'){e.preventDefault();e.stopImmediatePropagation();sendSms(k);}}
  },true);

  let scheduled=false;function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;polish();});}
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});schedule();
})();
