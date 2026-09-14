/* PeerMatch v32: clean Make Match flow. SMS is text-only; photos share separately. */
(function(){
  document.documentElement.dataset.peerMatchVersion='32';

  const style=document.createElement('style');
  style.textContent=`
    .pmMatchForm textarea{min-height:190px}
    .pmMatchActions{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:9px}
    .pmMatchActions button{padding:10px 4px;font-size:11px;border-radius:10px}
    .pmMatchSharePhoto{margin-top:8px}
    .pmMatchChosen{background:#fff;border:1px solid var(--line);border-radius:13px;padding:9px 10px;margin:7px 0;font-size:12px;line-height:1.4}
    .pmMatchChosen b{display:inline-block;min-width:64px}
    .pmMatchForm select{width:100%;border:1px solid #d6d7d4;background:#fff;border-radius:14px;padding:13px 14px;font:inherit;color:var(--text)}
    .pmMatchMissing{font-size:12px;color:#8a3c2c;margin:8px 0;line-height:1.45}
    .pmPhotoHint{font-size:11px;line-height:1.4;color:var(--muted);margin:6px 1px 0}
    @media(max-width:390px){.pmMatchActions{grid-template-columns:repeat(2,1fr)}}
  `;
  document.head.appendChild(style);

  function senderName(x){return String(x?.sourceName||x?.source||'').trim();}
  function senderPhone(x){return String(x?.sourcePhone||'').trim();}
  function cleanName(x,fallback){return String(x?.name||'').trim()||fallback;}
  function digits(s){return String(s||'').replace(/\D/g,'');}

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
    const listId=k==='shadchanim'?'shadchanList':k+'List';
    const list=document.getElementById(listId);
    if(!list)return[];
    const arr=visibleFor(k);
    const boxes=[...list.querySelectorAll('.pmListCheck')];
    const out=[];
    boxes.forEach((box,i)=>{if(box.checked&&arr[i])out.push(arr[i]);});
    return out;
  }

  function profileSummary(x,label){
    const lines=[label+': '+cleanName(x,label+' profile')+(x?.age?' (age '+x.age+')':'')];
    const text=String(x?.text||'').trim();
    if(text)lines.push(text);
    const sn=senderName(x),sp=senderPhone(x);
    if(sn||sp)lines.push('Sent by: '+(sn||'Sender')+(sp?' • '+sp:''));
    return lines.join('\n');
  }

  function defaultMessage(guy,girl,recipientLabel){
    return [
      recipientLabel?'Hi '+recipientLabel+',':'Hi,',
      '',
      'I wanted to suggest a possible shidduch:',
      '',
      profileSummary(guy,'Guy'),
      '',
      profileSummary(girl,'Girl'),
      '',
      'Please let me know what you think.'
    ].join('\n');
  }

  function waNumber(phone){
    const raw=String(phone||'').trim();
    let d=raw.replace(/\D/g,'');
    if(!d)return'';
    if(raw.startsWith('+'))return d;
    if(d.startsWith('00'))d=d.slice(2);
    if(d.startsWith('0'))d='972'+d.slice(1);
    return d;
  }
  function waUrl(phone,message){return 'https://wa.me/'+waNumber(phone)+'?text='+encodeURIComponent(message);}
  function smsUrl(phone,message){return 'sms:'+String(phone||'').trim()+'?body='+encodeURIComponent(message);}
  function emailUrl(email,subject,message){return 'mailto:'+encodeURIComponent(String(email||'').trim())+'?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(message);}

  function senderInfoOk(x){return !!(senderName(x)||senderPhone(x));}
  function senderRecipients(guy,girl){
    const out=[];
    const add=(side,x)=>{
      const phone=senderPhone(x);if(!phone)return;
      const name=senderName(x);
      out.push({
        label:side+' sender'+(name?' — '+name:''),
        greeting:name||side+' sender',
        phone,
        side
      });
    };
    add('Girl',girl);
    add('Guy',guy);
    return out.filter((r,i,a)=>a.findIndex(z=>digits(z.phone)===digits(r.phone))===i);
  }

  function fullPhoto(x){return x?.profileMediaFull||x?.profileImage||x?.photo||null;}
  function extFor(type){
    const map={'image/jpeg':'.jpg','image/png':'.png','image/webp':'.webp','image/gif':'.gif'};
    return map[String(type||'').toLowerCase()]||'.jpg';
  }
  function safePart(s){return String(s||'profile').replace(/[^a-z0-9_-]+/gi,'_').replace(/^_+|_+$/g,'').slice(0,45)||'profile';}
  function toPhotoFile(blob,name){
    if(!(blob instanceof Blob))return null;
    const type=blob.type||'image/jpeg';
    if(typeof File!=='undefined'&&blob instanceof File&&blob.name)return blob;
    try{return new File([blob],name,{type,lastModified:Date.now()});}catch(e){return null;}
  }
  function matchPhotoFiles(guy,girl){
    const files=[];
    const add=(side,x)=>{
      const photo=fullPhoto(x);
      if(!(photo instanceof Blob))return;
      const f=toPhotoFile(photo,side+'_'+safePart(cleanName(x,side))+'_photo'+extFor(photo.type));
      if(f)files.push(f);
    };
    add('Guy',guy);add('Girl',girl);
    return files;
  }
  function photoNames(guy,girl){
    const names=[];
    if(fullPhoto(guy) instanceof Blob)names.push('Guy photo');
    if(fullPhoto(girl) instanceof Blob)names.push('Girl photo');
    return names;
  }

  function addSendHistory(guy,girl,shadchan,recipient,channel,message){
    const matchId=Date.now(),ts=stamp();
    const gName=cleanName(guy,'Guy profile'),lName=cleanName(girl,'Girl profile');
    const ch=channel.charAt(0).toUpperCase()+channel.slice(1);
    const recipientLabel=shadchan?cleanName(shadchan,'Shadchan'):(recipient?.label||'profile sender');
    const meta={matchId,guyId:guy.id,girlId:girl.id,shadchanId:shadchan?.id||null,channel,message,recipient:recipientLabel,recipientPhone:recipient?.phone||shadchan?.phone||'',recipientSide:recipient?.side||''};
    guy.activities=guy.activities||[];girl.activities=girl.activities||[];
    guy.activities.push({id:matchId+1,type:'action',action:'Match sent • '+ch,text:`Match with ${lName} sent to ${recipientLabel} via ${ch}.\n\n${message}`,ts,...meta});
    girl.activities.push({id:matchId+2,type:'action',action:'Match sent • '+ch,text:`Match with ${gName} sent to ${recipientLabel} via ${ch}.\n\n${message}`,ts,...meta});
    if(shadchan){
      shadchan.activities=shadchan.activities||[];
      shadchan.activities.push({id:matchId+3,type:'action',action:'Match sent • '+ch,text:`Match sent: ${gName} ↔ ${lName} via ${ch}.\n\n${message}`,ts,...meta});
    }
  }

  function addCallHistory(guy,girl,shadchan,phone){
    const matchId=Date.now(),ts=stamp();
    const gName=cleanName(guy,'Guy profile'),lName=cleanName(girl,'Girl profile');
    const contactName=senderName(girl)||'Girl sender';
    const meta={matchId,guyId:guy.id,girlId:girl.id,channel:'call',recipient:contactName,recipientPhone:phone,recipientSide:'Girl'};
    guy.activities=guy.activities||[];girl.activities=girl.activities||[];
    guy.activities.push({id:matchId+1,type:'action',action:'Match call • Girl sender',text:`Call opened to ${contactName} (${phone}) about match with ${lName}.`,ts,...meta});
    girl.activities.push({id:matchId+2,type:'action',action:'Match call • Girl sender',text:`Call opened to ${contactName} (${phone}) about match with ${gName}.`,ts,...meta});
    if(shadchan&&digits(shadchan.phone)===digits(phone)&&digits(phone)){
      shadchan.activities=shadchan.activities||[];
      shadchan.activities.push({id:matchId+3,type:'action',action:'Match call • Girl sender',text:`Call opened about match: ${gName} ↔ ${lName}.`,ts,...meta,shadchanId:shadchan.id});
    }
  }

  function addPhotoHistory(guy,girl,shadchan,names){
    const matchId=Date.now(),ts=stamp();
    const gName=cleanName(guy,'Guy profile'),lName=cleanName(girl,'Girl profile');
    const list=(names||[]).join(', ');
    const meta={matchId,guyId:guy.id,girlId:girl.id,shadchanId:shadchan?.id||null,channel:'share-photo',media:names||[]};
    guy.activities=guy.activities||[];girl.activities=girl.activities||[];
    guy.activities.push({id:matchId+1,type:'action',action:'Match photo shared',text:`Photo shared for match with ${lName}${list?' ('+list+')':''}.`,ts,...meta});
    girl.activities.push({id:matchId+2,type:'action',action:'Match photo shared',text:`Photo shared for match with ${gName}${list?' ('+list+')':''}.`,ts,...meta});
    if(shadchan){
      shadchan.activities=shadchan.activities||[];
      shadchan.activities.push({id:matchId+3,type:'action',action:'Match photo shared',text:`Photo shared for match: ${gName} ↔ ${lName}${list?' ('+list+')':''}.`,ts,...meta});
    }
  }

  async function persistOrStop(message){
    try{await save();return true;}
    catch(e){console.warn('PeerMatch v32 save',e);alert(message);return false;}
  }

  async function handoff(channel,guy,girl,shadchan,recipient,message){
    const subject='Shidduch suggestion: '+cleanName(guy,'Guy')+' & '+cleanName(girl,'Girl');
    let target='';
    if(shadchan){
      if(channel==='whatsapp'){
        if(!waNumber(shadchan.phone))return alert('The selected Shadchan needs a phone number for WhatsApp.');
        target=waUrl(shadchan.phone,message);
      }else if(channel==='sms'){
        if(!String(shadchan.phone||'').trim())return alert('The selected Shadchan needs a phone number for SMS.');
        target=smsUrl(shadchan.phone,message);
      }else if(channel==='email'){
        if(!String(shadchan.email||'').trim())return alert('The selected Shadchan needs an email address.');
        target=emailUrl(shadchan.email,subject,message);
      }
    }else{
      if(channel==='email')return alert('Email currently requires a selected Shadchan because Guy/Girl sender email is not stored.');
      if(!recipient?.phone)return alert('Choose a sender with a phone number.');
      target=channel==='whatsapp'?waUrl(recipient.phone,message):smsUrl(recipient.phone,message);
    }

    addSendHistory(guy,girl,shadchan,recipient,channel,message);
    if(!await persistOrStop('PeerMatch could not save the match history. Nothing was opened.'))return;
    try{render();}catch(e){}
    close();
    location.href=target;
  }

  async function callGirlSide(guy,girl,shadchan){
    const phone=senderPhone(girl);
    if(!phone)return alert('The selected Girl needs a sender phone number before you can call from Make match.');
    addCallHistory(guy,girl,shadchan,phone);
    if(!await persistOrStop('PeerMatch could not save the call in history, so the call was not opened.'))return;
    try{render();}catch(e){}
    close();
    location.href='tel:'+phone;
  }

  async function sharePhoto(guy,girl,shadchan){
    const files=matchPhotoFiles(guy,girl);
    if(!files.length)return alert('There are no saved profile photos to share for this match.');
    if(!navigator.share||!navigator.canShare)return alert('This phone/browser cannot share saved photos from PeerMatch.');
    let can=false;
    try{can=navigator.canShare({files});}catch(e){can=false;}
    if(!can)return alert('This phone/browser cannot share these profile photos.');

    try{await navigator.share({title:'Shidduch profile photo',files});}
    catch(e){
      if(e?.name==='AbortError')return;
      console.warn('PeerMatch v32 photo share',e);
      return alert('The phone could not open the share sheet with the profile photo.');
    }

    addPhotoHistory(guy,girl,shadchan,photoNames(guy,girl));
    if(!await persistOrStop('The photo was shared, but PeerMatch could not save the share in history.'))return;
    try{render();}catch(e){}
    close();
  }

  function openMakeMatch(){
    const guys=checkedRecords('guys'),girls=checkedRecords('girls'),shads=checkedRecords('shadchanim');
    if(guys.length!==1)return alert(guys.length?'Select exactly one Guy.':'Select one Guy using the checkbox in the Guys list.');
    if(girls.length!==1)return alert(girls.length?'Select exactly one Girl.':'Select one Girl using the checkbox in the Girls list.');
    if(shads.length>1)return alert('Select no more than one Shadchan.');

    const guy=guys[0],girl=girls[0],shadchan=shads[0]||null;
    if(!shadchan&&(!senderInfoOk(guy)||!senderInfoOk(girl))){
      return alert('Without a selected Shadchan, both the Guy and Girl need a sender name or sender phone saved on their profiles.');
    }

    const recipients=!shadchan?senderRecipients(guy,girl):[];
    const greeting=shadchan?cleanName(shadchan,'Shadchan'):(recipients[0]?.greeting||'');
    const hasPhoto=matchPhotoFiles(guy,girl).length>0;

    open(`<h2>Make match</h2><div class="pmMatchForm">
      <div class="pmMatchChosen">
        <div><b>Guy</b>${esc(cleanName(guy,'Guy profile'))}</div>
        <div><b>Girl</b>${esc(cleanName(girl,'Girl profile'))}</div>
        <div><b>Shadchan</b>${shadchan?esc(cleanName(shadchan,'Shadchan')):'Not selected'}</div>
      </div>
      ${!shadchan?(
        recipients.length
          ?`<label>Send to<select id="pmMatchRecipient">${recipients.map((r,i)=>`<option value="${i}">${esc(r.label+' • '+r.phone)}</option>`).join('')}</select></label>`
          :'<div class="pmMatchMissing">Neither profile has a sender phone number. Add a sender phone or select a Shadchan to use SMS/WhatsApp.</div>'
      ):''}
      <label>Message<textarea id="pmMatchMessage"></textarea></label>
      <div class="pmMatchActions">
        <button id="pmMatchCall" class="secondary">Call</button>
        <button id="pmMatchSMS" class="secondary">SMS</button>
        <button id="pmMatchWA" class="green">WhatsApp</button>
        <button id="pmMatchEmail" class="secondary">Email</button>
      </div>
      <button id="pmMatchSharePhoto" class="secondary full pmMatchSharePhoto"${hasPhoto?'':' disabled'}>Share photo</button>
      ${hasPhoto?'':'<div class="pmPhotoHint">No saved profile photo is available for this match.</div>'}
      <div class="gap"></div><button id="pmMatchCancel" class="secondary full">Cancel</button>
    </div>`);

    const recipientSelect=document.getElementById('pmMatchRecipient');
    const message=document.getElementById('pmMatchMessage');
    const currentRecipient=()=>shadchan?null:(recipients[Number(recipientSelect?.value||0)]||null);
    const rebuild=()=>{
      const label=shadchan?cleanName(shadchan,'Shadchan'):(currentRecipient()?.greeting||greeting);
      message.value=defaultMessage(guy,girl,label);
    };
    if(recipientSelect)recipientSelect.onchange=rebuild;
    rebuild();

    const send=channel=>{
      const text=message.value.trim();if(!text)return alert('Enter a message.');
      handoff(channel,guy,girl,shadchan,currentRecipient(),text);
    };
    document.getElementById('pmMatchCall').onclick=()=>callGirlSide(guy,girl,shadchan);
    document.getElementById('pmMatchSMS').onclick=()=>send('sms');
    document.getElementById('pmMatchWA').onclick=()=>send('whatsapp');
    document.getElementById('pmMatchEmail').onclick=()=>send('email');
    document.getElementById('pmMatchSharePhoto').onclick=()=>sharePhoto(guy,girl,shadchan);
    document.getElementById('pmMatchCancel').onclick=close;
  }

  function installHeader(){
    const header=document.querySelector('.app>header');if(!header)return;
    header.querySelectorAll('.pmSendMatchTop,.pmBH').forEach(el=>el.remove());
    header.classList.add('pmMatchHeader');
    const bh=document.createElement('div');bh.className='pmBH';bh.textContent='ב״ה';header.appendChild(bh);
    const b=document.createElement('button');b.type='button';b.className='pmSendMatchTop';b.textContent='Make match';b.onclick=openMakeMatch;header.appendChild(b);
  }

  installHeader();
})();
