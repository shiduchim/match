/* PeerMatch v107: direct selected WhatsApp send and top-right Edit reinforcement.
   Attachment viewing (images and PDFs) was consolidated into profile-pdf-ocr-v63.js's
   openPmAttachment() at v111 — this file no longer binds any attachment click handler.
   Selection reading was switched to peermatch-v11.js's window.pmGetSelected(k) at v113
   — this file no longer reconstructs "what's checked" from DOM card position. */
(function(){
  document.documentElement.dataset.peerMatchVersion='107';
  let queued=false,seq=0;

  const trim=v=>String(v||'').trim();
  function senderName(x){return trim(x?.sourceName||x?.source);}
  function senderPhone(x){return trim(x?.sourcePhone);}
  function profileText(x){return [x?.name||'Unnamed profile',x?.age?'Age: '+x.age:'',x?.text||'',senderName(x)?'Sent by: '+senderName(x):'',senderPhone(x)?'Sender phone: '+senderPhone(x):''].filter(Boolean).join('\n');}
  function waPhone(v){
    if(typeof window.pmWhatsAppDigits==='function'){try{return String(window.pmWhatsAppDigits(v)||'');}catch(_){ }}
    let d=String(v||'').replace(/\D/g,'');if(d.startsWith('00972'))d=d.slice(2);if(d.startsWith('0'))d='972'+d.slice(1);else if(d.length===9&&d.startsWith('5'))d='972'+d;return d;
  }

  async function saveShare(k,x,sh,text){
    const ts=typeof stamp==='function'?stamp():new Date().toLocaleString(),link=`v107-${x.id}-${sh.id}-${Date.now()}-${seq++}`;
    x.activities=x.activities||[];sh.activities=sh.activities||[];
    x.activities.push({id:Date.now()*1000+(seq++%1000),type:'action',action:'Profile sent • WhatsApp',text,ts,channel:'whatsapp',recipient:trim(sh.name)||'Shadchan',recipientPhone:trim(sh.phone),recipientShadchanId:sh.id,shadchanId:sh.id,sharedProfileId:x.id,sharedProfileName:trim(x.name)||'Unnamed profile',sharedProfileKind:k,shareLinkId:link});
    sh.activities.push({id:Date.now()*1000+(seq++%1000),type:'action',action:'Profile received • WhatsApp',text,ts,channel:'whatsapp',sharedProfileId:x.id,sharedProfileName:trim(x.name)||'Unnamed profile',sharedProfileKind:k,profileId:x.id,profileName:trim(x.name)||'Unnamed profile',shareLinkId:link});
  }
  /* Single source of truth for "what's selected": peermatch-v11.js's real closure-owned
     Sets, exposed read-only via window.pmGetSelected(k). Never reconstruct selection
     from DOM card position/count — the Shadchan list is reordered/grouped/collapsed by
     other live scripts, so a positional mapping back to data.shadchanim silently picks
     the wrong record (or the wrong count) once that happens. */
  async function directWhatsApp(k){
    const profiles=window.pmGetSelected(k);if(!profiles.length)return false;
    const shads=window.pmGetSelected('shadchanim');
    if(shads.length>1){alert('Select only one Shadchan before sending on WhatsApp.');return true;}
    if(shads.length<1){alert('Select exactly one Shadchan to send this profile to on WhatsApp.');return true;}
    const sh=shads[0],phone=waPhone(sh.phone);if(!phone){alert('The selected Shadchan needs a phone number for WhatsApp.');return true;}
    const parts=[];for(const x of profiles){const t=profileText(x);parts.push(t);await saveShare(k,x,sh,t);}
    try{await save();}catch(e){console.warn('PeerMatch v107 share history',e);}
    location.href='https://wa.me/'+phone+'?text='+encodeURIComponent(parts.join('\n\n--------------------\n\n'));
    return true;
  }

  function keepEditTop(){
    const sheet=document.getElementById('sheet'),edit=sheet?.querySelector('#v19EditProfile'),head=sheet?.querySelector('.v19Head');if(!sheet||!edit||!head||sheet.querySelector('.v19ShadHead'))return;
    let stack=head.querySelector('.pmV82EditStack');if(!stack){stack=document.createElement('div');stack.className='pmV82EditStack';const bh=document.createElement('div');bh.className='pmV82BH';bh.textContent='ב״ה';stack.appendChild(bh);head.appendChild(stack);}if(edit.parentElement!==stack)stack.appendChild(edit);edit.textContent='Edit';
  }
  function polish(){keepEditTop();}

  const priorP=window.openP;if(typeof priorP==='function')window.openP=function(k,id){const r=priorP(k,id);setTimeout(polish,70);return r;};
  const priorS=window.openS;if(typeof priorS==='function')window.openS=function(id){const r=priorS(id);setTimeout(polish,70);return r;};

  document.addEventListener('click',e=>{
    const wa=e.target.closest?.('button[id^="pmWhatsApp-"]');if(wa){const k=wa.id.slice('pmWhatsApp-'.length);if(k==='guys'||k==='girls'){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();directWhatsApp(k);return;}}
  },true);

  function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;polish();});}
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});schedule();setTimeout(polish,300);
})();