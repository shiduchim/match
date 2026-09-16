/* PeerMatch v122: clearer Make Match flow + stronger History separation.
   - Uses the authoritative ID-based selection state from peermatch-v11.js.
   - Groups the suggested Guy/Girl together and separates the optional Shadchan.
   - Send to selector uses Shadchan, Girl contact person, Guy contact person.
   - Android WhatsApp opens the installed app directly, leaving PeerMatch underneath.
*/
(function(){
  document.documentElement.dataset.peerMatchVersion='122';
  const style=document.createElement('style');
  style.textContent=`
    .pmV60Chosen{background:#fff;border:1px solid var(--line);border-radius:14px;padding:10px;margin:7px 0 11px}
    .pmV60ChosenTitle{font-size:11px;font-weight:850;color:var(--muted);text-transform:uppercase;letter-spacing:.35px;margin-bottom:7px}
    .pmV60Pair{display:grid;grid-template-columns:1fr 1fr;gap:7px}
    .pmV60Person{background:#f7fafc;border:1px solid #dde6eb;border-radius:11px;padding:8px 9px;min-width:0}
    .pmV60Person span,.pmV60Shad span{display:block;font-size:10px;font-weight:850;color:var(--muted);text-transform:uppercase;letter-spacing:.25px;margin-bottom:2px}
    .pmV60Person strong,.pmV60Shad strong{display:block;font-size:12.5px;line-height:1.25;color:var(--text);overflow-wrap:anywhere}
    .pmV60Shad{margin-top:9px;padding:9px 9px 1px;border-top:1px solid var(--line)}
    .pmV60SendTo{margin-top:9px!important}
    .pmV60SendTo select{margin-top:5px}
    .pmV60Form textarea{min-height:230px!important}
    .pmV60Actions{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin-top:10px}
    .pmV60Actions button{background:#dfeef9!important;color:#19324a!important;padding:10px 3px!important;font-size:10.5px!important;border-radius:10px!important;min-width:0!important;white-space:nowrap!important;text-align:center!important}
    .pmV60Photos{display:flex!important;align-items:center!important;gap:8px!important;margin:9px 1px 3px!important;font-size:12px!important;color:var(--text)!important;cursor:pointer}
    .pmV60Photos input{width:18px!important;height:18px!important;margin:0!important;accent-color:var(--accent)}
    .pmV60Hint{font-size:11px;line-height:1.4;color:var(--muted);margin:6px 1px 8px}
    .pmChatDetail .sectionTitle{margin:18px 0 9px!important;padding:10px 11px!important;background:#eaf1f6!important;border:1px solid #d3e0e8!important;border-radius:12px!important;color:#264b64!important;font-size:14px!important;font-weight:900!important;letter-spacing:.15px}
    .pmChatDetail .event{background:#f7fafc!important;border-color:#d9e4ea!important}
    .pmChatDetail .event+.event{margin-top:8px!important}
    @media(max-width:390px){.pmV60Pair{gap:5px}.pmV60Person{padding:7px}.pmV60Actions{gap:4px}.pmV60Actions button{font-size:9.2px!important;padding:9px 1px!important}}
  `;
  document.head.appendChild(style);

  function senderName(x){return String(x?.sourceName||x?.source||'').trim();}
  function senderPhone(x){return String(x?.sourcePhone||'').trim();}
  function cleanName(x,fallback){return String(x?.name||'').replace(/\*/g,'').trim()||fallback;}

  function visibleFor(k){
    const searchId=k==='shadchanim'?'shadchanSearch':k+'Search';
    const q=(document.getElementById(searchId)?.value||'').toLowerCase();
    return (data[k]||[]).filter(x=>{
      const hay=k==='shadchanim'
        ?`${x.name||''} ${x.phone||''} ${x.email||''} ${x.tags||''} ${(x.activities||[]).map(a=>a.text||a.action||'').join(' ')}`
        :`${x.name||''} ${x.age||''} ${x.text||''} ${senderName(x)} ${senderPhone(x)} ${(x.activities||[]).map(a=>a.text||a.action||'').join(' ')}`;
      return hay.toLowerCase().includes(q);
    });
  }

  function checkedRecords(k){
    if(typeof window.pmGetSelected==='function'){
      try{return window.pmGetSelected(k)||[];}catch(e){}
    }
    const listId=k==='shadchanim'?'shadchanList':k+'List';
    const list=document.getElementById(listId);if(!list)return[];
    const arr=visibleFor(k),boxes=[...list.querySelectorAll('.pmListCheck')],out=[];
    boxes.forEach((box,i)=>{if(box.checked&&arr[i])out.push(arr[i]);});
    return out;
  }

  function contactOptions(guy,girl,shadchan){
    const out=[];
    if(shadchan)out.push({kind:'shadchan',label:'Shadchan',name:cleanName(shadchan,'Shadchan'),greeting:'Shadchan '+cleanName(shadchan,'Shadchan'),phone:String(shadchan.phone||'').trim(),email:String(shadchan.email||'').trim(),side:'Shadchan'});
    const add=(side,x)=>{const phone=senderPhone(x);if(!phone)return;const name=senderName(x);out.push({kind:'contact',label:side+' contact person',name:name||side+' contact person',greeting:name||side+' contact person',phone,email:'',side});};
    add('Girl',girl);add('Guy',guy);return out;
  }
  function recipientDisplay(r){if(!r)return'contact person';return r.name&&r.name!==r.label?r.label+' — '+r.name:r.label;}
  function profileBlock(x,label){
    const lines=[],name=cleanName(x,label+' profile');lines.push(label.toUpperCase()+' — '+name+(x?.age?' (age '+x.age+')':''));
    const text=String(x?.text||'').trim();if(text)lines.push(text);
    const sn=senderName(x),sp=senderPhone(x);if(sn||sp)lines.push('Contact person: '+(sn||'Contact person')+(sp?' • '+sp:''));
    return lines.join('\n');
  }
  function defaultMessage(guy,girl,recipient){
    const gName=cleanName(guy,'Guy profile'),lName=cleanName(girl,'Girl profile'),hello=recipient?.greeting?'Hi '+recipient.greeting+',':'Hi,';
    return ['Shidduch suggestion','Guy: '+gName,'Girl: '+lName,'',hello,'','--------------------',profileBlock(guy,'Guy'),'--------------------',profileBlock(girl,'Girl'),'--------------------'].join('\n');
  }

  function fullPhoto(x){return x?.profileMediaFull||x?.profileImage||x?.photo||null;}
  function extFor(type){const map={'image/jpeg':'.jpg','image/png':'.png','image/webp':'.webp','image/gif':'.gif'};return map[String(type||'').toLowerCase()]||'.jpg';}
  function safePart(s){return String(s||'profile').replace(/[^a-z0-9_-]+/gi,'_').replace(/^_+|_+$/g,'').slice(0,45)||'profile';}
  function toPhotoFile(blob,name){if(!(blob instanceof Blob))return null;const type=blob.type||'image/jpeg';if(typeof File!=='undefined'&&blob instanceof File&&blob.name)return blob;try{return new File([blob],name,{type,lastModified:Date.now()});}catch(e){return null;}}
  function photoFiles(guy,girl){const files=[];const add=(side,x)=>{const photo=fullPhoto(x);if(!(photo instanceof Blob))return;const f=toPhotoFile(photo,side+'_'+safePart(cleanName(x,side))+'_photo'+extFor(photo.type));if(f)files.push(f);};add('Guy',guy);add('Girl',girl);return files;}

  function waNumber(phone){
    if(typeof window.pmWhatsAppDigits==='function'){try{return String(window.pmWhatsAppDigits(phone)||'');}catch(e){}}
    const raw=String(phone||'').trim();let d=raw.replace(/\D/g,'');if(!d)return'';if(raw.startsWith('+'))return d;if(d.startsWith('00'))d=d.slice(2);if(d.startsWith('0'))d='972'+d.slice(1);return d;
  }
  function whatsappTarget(phone,message){
    const d=waNumber(phone);if(!d)return'';
    return /Android/i.test(navigator.userAgent||'')
      ?'whatsapp://send?phone='+encodeURIComponent(d)+'&text='+encodeURIComponent(message||'')
      :'https://wa.me/'+d+'?text='+encodeURIComponent(message||'');
  }

  function canonical(k,id){return (data[k]||[]).find(x=>String(x.id)===String(id))||null;}
  async function addHistory(guy,girl,shadchan,recipient,channel,message,contactOnly){
    const g=canonical('guys',guy.id),l=canonical('girls',girl.id),s=shadchan?canonical('shadchanim',shadchan.id):null;if(!g||!l)return false;
    const matchId=Date.now(),ts=stamp(),gName=cleanName(g,'Guy profile'),lName=cleanName(l,'Girl profile'),who=recipientDisplay(recipient);
    const ch=channel==='whatsapp'?'WhatsApp':channel==='sms'?'SMS':channel==='email'?'Email':'Contact';
    const meta={pmV60:true,matchId,guyId:g.id,girlId:l.id,shadchanId:s?.id||null,channel,recipient:who,recipientPhone:recipient?.phone||'',recipientSide:recipient?.side||''};
    g.activities=g.activities||[];l.activities=l.activities||[];
    if(contactOnly){
      g.activities.push({id:matchId+1,type:'action',action:'Match contact • '+who,text:`Contact opened to ${who}${recipient?.phone?' ('+recipient.phone+')':''} about match with ${lName}.`,ts,...meta});
      l.activities.push({id:matchId+2,type:'action',action:'Match contact • '+who,text:`Contact opened to ${who}${recipient?.phone?' ('+recipient.phone+')':''} about match with ${gName}.`,ts,...meta});
      if(s){s.activities=s.activities||[];s.activities.push({id:matchId+3,type:'action',action:'Match contact • '+who,text:`Contact opened to ${who} about match: ${gName} ↔ ${lName}.`,ts,...meta});}
    }else{
      g.activities.push({id:matchId+1,type:'action',action:'Match sent • '+ch,text:`Match with ${lName} opened for ${who} via ${ch}.\n\n${message}`,ts,...meta});
      l.activities.push({id:matchId+2,type:'action',action:'Match sent • '+ch,text:`Match with ${gName} opened for ${who} via ${ch}.\n\n${message}`,ts,...meta});
      if(s){s.activities=s.activities||[];s.activities.push({id:matchId+3,type:'action',action:'Match sent • '+ch,text:`Match ${gName} ↔ ${lName} opened for ${who} via ${ch}.\n\n${message}`,ts,...meta});}
    }
    try{await save();return true;}catch(e){console.warn('PeerMatch v122 history save',e);return false;}
  }

  async function contactRecipient(guy,girl,shadchan,recipient){
    if(!recipient?.phone)return alert('The selected contact does not have a phone number.');
    if(!await addHistory(guy,girl,shadchan,recipient,'contact','',true))return alert('PeerMatch could not save the contact in History. Nothing was opened.');
    try{render();}catch(e){}close();location.href='tel:'+recipient.phone;
  }

  async function directSend(channel,guy,girl,shadchan,recipient,message){
    if(!recipient)return alert('Choose who this match should be sent to.');
    let target='';
    if(channel==='whatsapp'){
      target=whatsappTarget(recipient.phone,message);if(!target)return alert('The selected contact needs a phone number for WhatsApp.');
    }else if(channel==='sms'){
      if(!recipient.phone)return alert('The selected contact needs a phone number for SMS.');target='sms:'+recipient.phone+'?body='+encodeURIComponent(message);
    }else if(channel==='email'){
      if(!recipient.email)return alert('Email is only available when the selected Shadchan has an email address.');
      const subject='Shidduch suggestion: '+cleanName(guy,'Guy')+' & '+cleanName(girl,'Girl');target='mailto:'+encodeURIComponent(recipient.email)+'?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(message);
    }
    if(!await addHistory(guy,girl,shadchan,recipient,channel,message,false))return alert('PeerMatch could not save the match in History. Nothing was opened.');
    try{render();}catch(e){}close();location.href=target;
  }

  async function shareWithPhotos(channel,guy,girl,shadchan,recipient,message){
    const files=photoFiles(guy,girl);if(!files.length)return directSend(channel,guy,girl,shadchan,recipient,message);
    if(typeof navigator.share!=='function'||(navigator.canShare&&!navigator.canShare({files})))return directSend(channel,guy,girl,shadchan,recipient,message);
    const title='Shidduch suggestion: '+cleanName(guy,'Guy')+' & '+cleanName(girl,'Girl');
    try{await navigator.share({title,text:message,files});}catch(e){if(e?.name==='AbortError')return;console.warn('PeerMatch v122 photo share',e);return directSend(channel,guy,girl,shadchan,recipient,message);}
    if(!await addHistory(guy,girl,shadchan,recipient,channel,message,false))alert('The match was shared, but PeerMatch could not save it in History.');
    try{render();}catch(e){}close();
  }

  function openMakeMatchV60(){
    const guys=checkedRecords('guys'),girls=checkedRecords('girls'),shads=checkedRecords('shadchanim');
    if(guys.length!==1)return alert(guys.length?'Select exactly one Guy.':'Select one Guy using the checkbox in the Guys list.');
    if(girls.length!==1)return alert(girls.length?'Select exactly one Girl.':'Select one Girl using the checkbox in the Girls list.');
    if(shads.length>1)return alert('Select no more than one Shadchan.');
    const guy=guys[0],girl=girls[0],shadchan=shads[0]||null,contacts=contactOptions(guy,girl,shadchan);
    if(!contacts.length)return alert('Add a phone number for a Guy/Girl contact person, or select a Shadchan with contact information.');
    const photos=photoFiles(guy,girl);
    open(`<h2>Make match</h2><div class="pmV60Form"><div class="pmV60Chosen"><div class="pmV60ChosenTitle">Suggested match</div><div class="pmV60Pair"><div class="pmV60Person"><span>Guy</span><strong>${esc(cleanName(guy,'Guy profile'))}</strong></div><div class="pmV60Person"><span>Girl</span><strong>${esc(cleanName(girl,'Girl profile'))}</strong></div></div><div class="pmV60Shad"><span>Shadchan</span><strong>${shadchan?esc(cleanName(shadchan,'Shadchan')):'Not selected'}</strong></div></div><label class="pmV60SendTo">Send to<select id="pmV60Recipient">${contacts.map((r,i)=>`<option value="${i}">${esc(recipientDisplay(r)+(r.phone?' • '+r.phone:''))}</option>`).join('')}</select></label><label>Message<textarea id="pmMatchMessage"></textarea></label>${photos.length?'<label class="pmV60Photos"><input id="pmV60IncludePhotos" type="checkbox"> <span>Include profile photos with WhatsApp / Email</span></label>':''}<div class="pmV60Actions"><button id="pmV60Contact" type="button">Contact</button><button id="pmMatchSMS" type="button">SMS</button><button id="pmMatchWA" type="button">WhatsApp</button><button id="pmMatchEmail" type="button">Email</button></div><div class="pmV60Hint">Contact calls the person selected above. SMS, WhatsApp and Email send the message to that same selection.</div><button id="pmV60Cancel" class="secondary full" type="button">Cancel</button></div>`);
    const select=document.getElementById('pmV60Recipient'),message=document.getElementById('pmMatchMessage');
    const current=()=>contacts[Math.max(0,Number(select?.value||0))]||contacts[0];
    const rebuild=()=>{message.value=defaultMessage(guy,girl,current());};select.onchange=rebuild;rebuild();
    document.getElementById('pmV60Contact').onclick=()=>contactRecipient(guy,girl,shadchan,current());
    const send=channel=>{const text=String(message.value||'').trim();if(!text)return alert('Enter a message.');const include=!!document.getElementById('pmV60IncludePhotos')?.checked;if(include&&(channel==='whatsapp'||channel==='email'))shareWithPhotos(channel,guy,girl,shadchan,current(),text);else directSend(channel,guy,girl,shadchan,current(),text);};
    document.getElementById('pmMatchSMS').onclick=()=>send('sms');document.getElementById('pmMatchWA').onclick=()=>send('whatsapp');document.getElementById('pmMatchEmail').onclick=()=>send('email');document.getElementById('pmV60Cancel').onclick=close;
  }

  document.addEventListener('click',e=>{const btn=e.target?.closest?.('.pmSendMatchTop');if(!btn)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();openMakeMatchV60();},true);
})();
