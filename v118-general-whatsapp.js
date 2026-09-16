/* PeerMatch v118: Case-A (Guy/Girl selected without a selected Shadchan) WhatsApp flow.
   Keeps the existing recipient chooser (pick an existing Shadchan or type a phone), but
   uses the same two-step UX as the v116 direct-selected-Shadchan flow:
   1) send text directly to the chosen phone; 2) on return, optionally share only the
   profile photo. Multiple profiles use one persistent bottom queue and never show the
   old "Share profiles separately" modal. This file rebinds the recreated Guy/Girl
   WhatsApp buttons at their creation churn point; it never uses a window capture handler. */
(function(){
  document.documentElement.dataset.peerMatchVersion='118';

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
    const type=blob.type||'image/jpeg';
    const ext=type.includes('png')?'png':type.includes('webp')?'webp':type.includes('gif')?'gif':'jpg';
    return blob instanceof File?blob:new File([blob],safeName(cleanName(x?.name)||('profile-'+(index+1)))+'.'+ext,{type});
  }
  function findProfile(k,id){return (data[k]||[]).find(x=>String(x.id)===String(id));}
  function loadQ(){try{const raw=localStorage.getItem(KEY),q=raw?JSON.parse(raw):null;if(q&&!q.stage)q.stage='text';return q;}catch(e){return null;}}
  function saveQ(q){try{if(q)localStorage.setItem(KEY,JSON.stringify(q));else localStorage.removeItem(KEY);}catch(e){}}
  function advance(q){q.index++;q.stage='text';if(q.index>=q.ids.length)saveQ(null);else saveQ(q);}

  function directUrl(phone,text){
    if(typeof window.pmWhatsAppUrl==='function')return window.pmWhatsAppUrl(phone,text);
    let d=String(phone||'').replace(/\D/g,'');if(d.startsWith('00'))d=d.slice(2);if(d.startsWith('0'))d='972'+d.slice(1);else if(d.length===9&&d.startsWith('5'))d='972'+d;
    return d?'https://wa.me/'+d+'?text='+encodeURIComponent(text||''):'';
  }
  function openDirect(target,text){
    if(/Android/i.test(navigator.userAgent||'')){
      try{const u=new URL(target),digits=u.pathname.replace(/^\/+/, '');if(digits){location.href='whatsapp://send?phone='+encodeURIComponent(digits)+'&text='+encodeURIComponent(text||'');return;}}catch(e){console.warn('PeerMatch v118 native WhatsApp URL',e);}
    }
    location.href=target;
  }

  async function recordShare(x,text,recipient){
    if(!x)return;
    const rn=trim(recipient?.name),rp=trim(recipient?.phone),sid=recipient?.shadchanId??recipient?.id??null;
    x.activities=x.activities||[];
    x.activities.push({
      id:Date.now()*1000+(historySeq++%1000),type:'action',action:'Profile shared • WhatsApp',text:String(text||''),
      ts:typeof stamp==='function'?stamp():new Date().toLocaleString(),channel:'whatsapp',recipient:rn,recipientPhone:rp,
      recipientSide:'Profile share',recipientShadchanId:sid,shadchanId:sid,
      sharedProfileId:x.id,sharedProfileName:trim(x.name)||'Unnamed profile',shareLinkId:'v118-general-'+x.id+'-'+(sid??rp)+'-'+Date.now()
    });
    try{await save();}catch(err){console.warn('PeerMatch v118 share history',err);}
  }

  function chooseRecipient(){
    return new Promise(resolve=>{
      document.getElementById('pmV118Recipient')?.remove();
      const shade=document.createElement('div');shade.id='pmV118Recipient';shade.style.cssText='position:fixed;inset:0;z-index:16000;background:rgba(0,0,0,.40);display:flex;align-items:flex-end;justify-content:center;padding:14px';
      const box=document.createElement('div');box.style.cssText='width:min(560px,100%);max-height:82vh;overflow:auto;background:#fff;border-radius:18px;padding:16px;box-shadow:0 12px 36px rgba(0,0,0,.28)';
      box.innerHTML='<div style="font-weight:900;font-size:17px;margin-bottom:4px">Who are you sending this to?</div><div style="font-size:12px;color:#73818b;margin-bottom:12px">Choose a Shadchan or enter a phone number.</div><label style="display:block;margin:8px 0;font-size:12px;color:#73818b">Existing Shadchan<select id="pmV118Shad" style="width:100%;margin-top:4px;border:1px solid #d6d7d4;border-radius:11px;padding:10px;background:#fff;font:inherit;color:#19324a"><option value="">Choose Shadchan (optional)</option></select></label><label style="display:block;margin:8px 0;font-size:12px;color:#73818b">Name<input id="pmV118Name" style="margin-top:4px" placeholder="Recipient name (optional)"></label><label style="display:block;margin:8px 0;font-size:12px;color:#73818b">Phone<input id="pmV118Phone" type="tel" inputmode="tel" style="margin-top:4px" placeholder="Phone number"></label><div id="pmV118Err" style="min-height:16px;font-size:11px;color:#8a4b20;margin-top:3px"></div><button id="pmV118Go" class="primary full" type="button">Continue to WhatsApp</button><button id="pmV118Cancel" class="secondary full" type="button" style="margin-top:8px">Cancel</button>';
      shade.appendChild(box);document.body.appendChild(shade);
      const sel=box.querySelector('#pmV118Shad'),name=box.querySelector('#pmV118Name'),phone=box.querySelector('#pmV118Phone'),err=box.querySelector('#pmV118Err');
      const arr=[...(data.shadchanim||[])].sort((a,b)=>String(a.name||'').localeCompare(String(b.name||'')));
      for(const s of arr){const o=document.createElement('option');o.value=String(s.id);o.textContent=String(s.name||'Unnamed Shadchan')+(s.phone?' • '+String(s.phone):'');sel.appendChild(o);}
      sel.onchange=()=>{const s=arr.find(z=>String(z.id)===String(sel.value));if(s){name.value=String(s.name||'');phone.value=String(s.phone||'');err.textContent='';}};
      const done=v=>{shade.remove();resolve(v);};
      box.querySelector('#pmV118Cancel').onclick=()=>done(null);shade.onclick=e=>{if(e.target===shade)done(null);};
      box.querySelector('#pmV118Go').onclick=()=>{
        const n=trim(name.value),p=trim(phone.value),s=arr.find(z=>String(z.id)===String(sel.value));
        if(!p){err.textContent=s?'That Shadchan needs a phone number.':'Enter a phone number or choose a Shadchan with a phone number.';return;}
        if(!directUrl(p,'x')){err.textContent='Enter a valid WhatsApp phone number.';return;}
        done({name:n||trim(s?.name)||p,phone:p,shadchanId:s?.id??null,id:s?.id??null});
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
        catch(err){if(err?.name==='AbortError')return;console.warn('PeerMatch v118 photo share',err);alert('Could not open the photo share. Try again or use Skip.');return;}
      }else{downloadPhoto(file,x);alert('Photo sharing is not supported in this browser, so the photo was downloaded. Attach it in WhatsApp.');}
      advance(q);renderBar();
    }finally{sharingPhoto=false;}
  }
  function skipPhoto(){const q=loadQ();if(!q||q.stage!=='photo')return;advance(q);renderBar();}

  async function sendText(){
    const q=loadQ();if(!q||q.stage==='photo')return;
    const x=findProfile(q.k,q.ids[q.index]);if(!x){advance(q);renderBar();return;}
    const text=recordText(x),target=directUrl(q.recipient?.phone,text);
    if(!target){alert('The recipient needs a valid phone number for WhatsApp.');saveQ(null);renderBar();return;}
    await recordShare(x,text,q.recipient);
    if(photoFile(x,q.index)){q.stage='photo';saveQ(q);}else advance(q);
    renderBar();openDirect(target,text);
  }

  function renderBar(){
    const q=loadQ();let bar=document.getElementById('pmV118QueueBar');
    if(!q){bar?.remove();return;}
    const x=findProfile(q.k,q.ids[q.index]),isPhoto=q.stage==='photo',recipient=trim(q.recipient?.name||q.recipient?.phone)||'recipient';
    const labelText=isPhoto?'Send '+cleanName(x?.name)+'\u2019s photo?':'Send profile '+(q.index+1)+' of '+q.ids.length+' to '+recipient;
    if(!bar){
      bar=document.createElement('div');bar.id='pmV118QueueBar';bar.style.cssText='position:fixed;left:0;right:0;bottom:0;z-index:99998;background:#111;color:#fff;padding:10px 14px;display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:14px;box-shadow:0 -2px 8px rgba(0,0,0,.3)';
      const label=document.createElement('span');label.id='pmV118QueueLabel';
      const actions=document.createElement('span');actions.style.cssText='display:flex;gap:8px;flex-shrink:0;align-items:center';
      const send=document.createElement('button');send.id='pmV118TextSend';send.textContent='Send';send.onclick=sendText;
      const cancel=document.createElement('button');cancel.id='pmV118CancelQueue';cancel.className='secondary';cancel.textContent='Cancel';cancel.onclick=()=>{saveQ(null);renderBar();};
      const photo=document.createElement('button');photo.id='pmV118PhotoSend';photo.textContent='Send photo';photo.onclick=sendPhoto;
      const skip=document.createElement('button');skip.id='pmV118PhotoSkip';skip.className='secondary';skip.textContent='⏭';skip.title='Skip photo';skip.setAttribute('aria-label','Skip photo');skip.style.cssText='min-width:42px;font-size:18px;line-height:1';skip.onclick=skipPhoto;
      actions.append(send,cancel,photo,skip);bar.append(label,actions);document.body.appendChild(bar);
    }
    const label=bar.querySelector('#pmV118QueueLabel');if(label.textContent!==labelText)label.textContent=labelText;
    bar.querySelector('#pmV118TextSend').style.display=isPhoto?'none':'';bar.querySelector('#pmV118CancelQueue').style.display=isPhoto?'none':'';
    bar.querySelector('#pmV118PhotoSend').style.display=isPhoto?'':'none';bar.querySelector('#pmV118PhotoSkip').style.display=isPhoto?'':'none';
  }

  async function startGeneral(k){
    const items=window.pmGetSelected?.(k)||[];if(!items.length)return;
    const shads=window.pmGetSelected?.('shadchanim')||[];
    if(shads.length>1){alert('Select only one Shadchan before sending a profile.');return;}
    /* Exactly one selected Shadchan belongs to the proven v116 Case-B router, so this
       function is only the zero-selected-Shadchan general path. */
    if(shads.length===1){if(typeof window.pmSendSelectedWhatsApp==='function')window.pmSendSelectedWhatsApp(k);return;}
    const recipient=await chooseRecipient();if(!recipient)return;
    saveQ({k,ids:items.map(x=>x.id),index:0,stage:'text',recipient});
    await sendText();
  }

  function bindBar(k){
    const bar=document.getElementById('pmSelected-'+k);if(!bar||bar.classList.contains('hidden'))return;
    const b=bar.querySelector('#pmWhatsApp-'+k);if(!b||b.dataset.pmV118Bound==='1')return;
    b.dataset.pmV118Bound='1';
    b.onclick=()=>{
      if(typeof window.pmRouteSelectedWhatsApp==='function'&&window.pmRouteSelectedWhatsApp())return;
      startGeneral(k);
    };
  }
  function polish(){bindBar('guys');bindBar('girls');renderBar();}
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;polish();});}
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
  window.addEventListener('focus',()=>setTimeout(renderBar,80));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(renderBar,80);});
  schedule();setTimeout(polish,300);
})();
