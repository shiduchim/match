/* PeerMatch v120: general Guy/Girl WhatsApp share without a preselected Shadchan.
   Phone is OPTIONAL. The user may choose a saved Shadchan, type a name/phone, or leave
   the recipient fields blank and choose the recipient inside WhatsApp.

   Android always uses the whatsapp:// scheme for the text handoff (with or without a
   phone number), so closing WhatsApp returns to PeerMatch instead of leaving the
   api.whatsapp.com / Chrome intermediary screen behind.

   Keeps the two-step flow: text first, then photo Yes/No only when a photo exists.
   Multiple selected profiles continue one at a time through the same bottom queue. */
(function(){
  document.documentElement.dataset.peerMatchVersion='120';

  const KEY='pmGeneralWaQueue';
  let sharingPhoto=false,historySeq=0,scheduled=false;
  const trim=v=>String(v||'').trim();
  const cleanName=v=>trim(v).replace(/\*/g,'')||'Unnamed profile';

  function senderName(x){return trim(x?.sourceName||x?.source);}
  function senderPhone(x){return trim(x?.sourcePhone);}
  function shareText(x){return typeof window.pmShareFilteredText==='function'?window.pmShareFilteredText(x):String(x?.text||'');}
  function recordText(x){return [x?.name||'Unnamed profile',x?.age?'Age: '+x.age:'',shareText(x),senderName(x)?'Sent by: '+senderName(x):'',senderPhone(x)?'Sender phone: '+senderPhone(x):''].filter(Boolean).join('\n');}
  function fullPhoto(x){return x?.profileMediaFull||x?.profileMedia||x?.profileImage||x?.photo||null;}
  function safeName(s){return String(s||'profile').replace(/[\\/:*?\"<>|]+/g,' ').replace(/\s+/g,' ').trim().slice(0,60)||'profile';}
  function photoFile(x,index){
    const blob=fullPhoto(x);if(!(blob instanceof Blob))return null;
    const type=blob.type||'image/jpeg',ext=type.includes('png')?'png':type.includes('webp')?'webp':type.includes('gif')?'gif':'jpg';
    return blob instanceof File?blob:new File([blob],safeName(cleanName(x?.name)||('profile-'+(index+1)))+'.'+ext,{type});
  }
  function findProfile(k,id){return (data[k]||[]).find(x=>String(x.id)===String(id));}
  function loadQ(){try{const raw=localStorage.getItem(KEY),q=raw?JSON.parse(raw):null;if(q&&!q.stage)q.stage='text';return q;}catch(e){return null;}}
  function saveQ(q){try{if(q)localStorage.setItem(KEY,JSON.stringify(q));else localStorage.removeItem(KEY);}catch(e){}}
  function advance(q){q.index++;q.stage='text';if(q.index>=q.ids.length)saveQ(null);else saveQ(q);}

  function normalizedDigits(phone){
    const p=trim(phone);if(!p)return'';
    if(typeof window.pmWhatsAppUrl==='function'){
      try{const target=window.pmWhatsAppUrl(p,'x');if(target){const u=new URL(target);return u.pathname.replace(/^\/+/, '');}}catch(e){}
    }
    let d=p.replace(/\D/g,'');
    if(d.startsWith('00'))d=d.slice(2);
    if(d.startsWith('0'))d='972'+d.slice(1);
    else if(d.length===9&&d.startsWith('5'))d='972'+d;
    return d;
  }

  /* On Android never navigate through wa.me/api.whatsapp.com. With no number,
     whatsapp://send?text=... opens WhatsApp and lets the user choose the recipient. */
  function openWhatsApp(phone,text){
    const digits=normalizedDigits(phone),encoded=encodeURIComponent(text||'');
    if(/Android/i.test(navigator.userAgent||'')){
      location.href=digits
        ?'whatsapp://send?phone='+encodeURIComponent(digits)+'&text='+encoded
        :'whatsapp://send?text='+encoded;
      return;
    }
    location.href=(digits?'https://wa.me/'+digits:'https://wa.me/')+'?text='+encoded;
  }

  async function recordShare(x,text,recipient){
    if(!x)return;
    const rn=trim(recipient?.name)||'WhatsApp recipient',rp=trim(recipient?.phone),sid=recipient?.shadchanId??recipient?.id??null;
    x.activities=x.activities||[];
    x.activities.push({
      id:Date.now()*1000+(historySeq++%1000),type:'action',action:'Profile shared • WhatsApp',text:String(text||''),
      ts:typeof stamp==='function'?stamp():new Date().toLocaleString(),channel:'whatsapp',recipient:rn,recipientPhone:rp,
      recipientSide:'Profile share',recipientShadchanId:sid,shadchanId:sid,
      sharedProfileId:x.id,sharedProfileName:trim(x.name)||'Unnamed profile',shareLinkId:'v120-general-'+x.id+'-'+(sid??rp??'picker')+'-'+Date.now()
    });
    try{await save();}catch(err){console.warn('PeerMatch v120 share history',err);}
  }

  function chooseRecipient(){
    return new Promise(resolve=>{
      document.getElementById('pmV120Recipient')?.remove();
      const shade=document.createElement('div');shade.id='pmV120Recipient';shade.style.cssText='position:fixed;inset:0;z-index:16000;background:rgba(0,0,0,.40);display:flex;align-items:flex-end;justify-content:center;padding:14px';
      const box=document.createElement('div');box.style.cssText='width:min(560px,100%);max-height:82vh;overflow:auto;background:#fff;border-radius:18px;padding:16px;box-shadow:0 12px 36px rgba(0,0,0,.28)';
      box.innerHTML='<div style="font-weight:900;font-size:17px;margin-bottom:4px">Who are you sending this to?</div><div style="font-size:12px;color:#73818b;margin-bottom:12px">Choose a Shadchan, enter a phone number, or leave the recipient blank and choose inside WhatsApp.</div><label style="display:block;margin:8px 0;font-size:12px;color:#73818b">Existing Shadchan<select id="pmV120Shad" style="width:100%;margin-top:4px;border:1px solid #d6d7d4;border-radius:11px;padding:10px;background:#fff;font:inherit;color:#19324a"><option value="">Choose Shadchan (optional)</option></select></label><label style="display:block;margin:8px 0;font-size:12px;color:#73818b">Name<input id="pmV120Name" style="margin-top:4px" placeholder="Recipient name (optional)"></label><label style="display:block;margin:8px 0;font-size:12px;color:#73818b">Phone<input id="pmV120Phone" type="tel" inputmode="tel" style="margin-top:4px" placeholder="Phone number (optional)"></label><div style="font-size:11px;color:#73818b;margin:2px 0 10px">No phone? PeerMatch will open WhatsApp and you can choose the recipient there.</div><button id="pmV120Go" class="primary full" type="button">Continue to WhatsApp</button><button id="pmV120Cancel" class="secondary full" type="button" style="margin-top:8px">Cancel</button>';
      shade.appendChild(box);document.body.appendChild(shade);
      const sel=box.querySelector('#pmV120Shad'),name=box.querySelector('#pmV120Name'),phone=box.querySelector('#pmV120Phone');
      const arr=[...(data.shadchanim||[])].sort((a,b)=>String(a.name||'').localeCompare(String(b.name||'')));
      for(const s of arr){const o=document.createElement('option');o.value=String(s.id);o.textContent=String(s.name||'Unnamed Shadchan')+(s.phone?' • '+String(s.phone):'');sel.appendChild(o);}
      sel.onchange=()=>{const s=arr.find(z=>String(z.id)===String(sel.value));if(s){name.value=String(s.name||'');phone.value=String(s.phone||'');}};
      const done=v=>{shade.remove();resolve(v);};
      box.querySelector('#pmV120Cancel').onclick=()=>done(null);shade.onclick=e=>{if(e.target===shade)done(null);};
      box.querySelector('#pmV120Go').onclick=()=>{
        const s=arr.find(z=>String(z.id)===String(sel.value)),p=trim(phone.value),n=trim(name.value)||trim(s?.name);
        done({name:n||'WhatsApp recipient',phone:p,shadchanId:s?.id??null,id:s?.id??null});
      };
    });
  }

  function downloadPhoto(file,x){const u=URL.createObjectURL(file),a=document.createElement('a');a.href=u;a.download=file.name||safeName(cleanName(x?.name))+'.jpg';a.style.display='none';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1500);}

  async function sendPhoto(){
    if(sharingPhoto)return;
    const q=loadQ();if(!q||q.stage!=='photo')return;
    const x=findProfile(q.k,q.ids[q.index]);if(!x){advance(q);renderBar();return;}
    const file=photoFile(x,q.index);if(!file){advance(q);renderBar();return;}
    sharingPhoto=true;
    try{
      const can=typeof navigator.share==='function'&&(!navigator.canShare||navigator.canShare({files:[file]}));
      if(can){
        try{await navigator.share({files:[file]});}
        catch(err){if(err?.name==='AbortError')return;console.warn('PeerMatch v120 photo share',err);alert('Could not open the photo share. Try again or choose No.');return;}
      }else{downloadPhoto(file,x);alert('Photo sharing is not supported in this browser, so the photo was downloaded. Attach it in WhatsApp.');}
      advance(q);renderBar();
    }finally{sharingPhoto=false;}
  }
  function skipPhoto(){const q=loadQ();if(!q||q.stage!=='photo')return;advance(q);renderBar();}

  async function sendText(){
    const q=loadQ();if(!q||q.stage==='photo')return;
    const x=findProfile(q.k,q.ids[q.index]);if(!x){advance(q);renderBar();return;}
    const text=recordText(x);
    await recordShare(x,text,q.recipient);
    if(photoFile(x,q.index)){q.stage='photo';saveQ(q);}else advance(q);
    renderBar();
    openWhatsApp(q.recipient?.phone,text);
  }

  function renderBar(){
    const q=loadQ();let bar=document.getElementById('pmV120QueueBar');
    if(!q){bar?.remove();return;}
    const x=findProfile(q.k,q.ids[q.index]),isPhoto=q.stage==='photo',recipient=trim(q.recipient?.name||q.recipient?.phone)||'WhatsApp recipient';
    const labelText=isPhoto?'Send '+cleanName(x?.name)+'\u2019s photo?':'Send profile '+(q.index+1)+' of '+q.ids.length+' to '+recipient;
    if(!bar){
      bar=document.createElement('div');bar.id='pmV120QueueBar';bar.style.cssText='position:fixed;left:0;right:0;bottom:0;z-index:100001;background:#111;color:#fff;padding:10px 14px;display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:14px;box-shadow:0 -2px 8px rgba(0,0,0,.3)';
      const label=document.createElement('span');label.id='pmV120QueueLabel';
      const actions=document.createElement('span');actions.style.cssText='display:flex;gap:8px;flex-shrink:0;align-items:center';
      const send=document.createElement('button');send.id='pmV120TextSend';send.textContent='Send';send.onclick=sendText;
      const cancel=document.createElement('button');cancel.id='pmV120CancelQueue';cancel.className='secondary';cancel.textContent='Cancel';cancel.onclick=()=>{saveQ(null);renderBar();};
      const yes=document.createElement('button');yes.id='pmV120PhotoYes';yes.textContent='Yes';yes.onclick=sendPhoto;
      const no=document.createElement('button');no.id='pmV120PhotoNo';no.className='secondary';no.textContent='No';no.onclick=skipPhoto;
      actions.append(send,cancel,yes,no);bar.append(label,actions);document.body.appendChild(bar);
    }
    const label=bar.querySelector('#pmV120QueueLabel');if(label.textContent!==labelText)label.textContent=labelText;
    bar.querySelector('#pmV120TextSend').style.display=isPhoto?'none':'';bar.querySelector('#pmV120CancelQueue').style.display=isPhoto?'none':'';
    bar.querySelector('#pmV120PhotoYes').style.display=isPhoto?'':'none';bar.querySelector('#pmV120PhotoNo').style.display=isPhoto?'':'none';
  }

  async function startGeneral(k){
    const items=window.pmGetSelected?.(k)||[];if(!items.length)return;
    const recipient=await chooseRecipient();if(!recipient)return;
    saveQ({k,ids:items.map(x=>x.id),index:0,stage:'text',recipient});
    await sendText();
  }

  /* Loaded after v119. This becomes the final Guy/Girl WhatsApp click owner while still
     delegating the already-working selected-Shadchan and multi-Shadchan cases first. */
  function bindBar(k){
    const bar=document.getElementById('pmSelected-'+k);if(!bar||bar.classList.contains('hidden'))return;
    const b=bar.querySelector('#pmWhatsApp-'+k);if(!b||b.dataset.pmV120Bound==='1')return;
    b.dataset.pmV120Bound='1';
    b.onclick=()=>{
      if(typeof window.pmRouteMultiShadchanWhatsApp==='function'&&window.pmRouteMultiShadchanWhatsApp())return;
      if(typeof window.pmRouteSelectedWhatsApp==='function'&&window.pmRouteSelectedWhatsApp())return;
      startGeneral(k);
    };
  }

  function polish(){bindBar('guys');bindBar('girls');renderBar();}
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;polish();});}
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
  window.addEventListener('focus',()=>setTimeout(polish,80));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(polish,80);});
  schedule();setTimeout(polish,300);
})();
