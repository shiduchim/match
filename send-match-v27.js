/* PeerMatch v29: checkbox-based Send Match with profile photos/audio in SMS share flow. */
(function(){
  document.documentElement.dataset.peerMatchVersion='29';

  const style=document.createElement('style');
  style.textContent=`
    header{position:sticky}
    header.pmMatchHeader{padding-right:112px;min-height:76px}
    .pmBH{position:absolute;right:13px;top:3px;font-size:11px;font-weight:700;color:var(--muted);line-height:1}
    .pmSendMatchTop{position:absolute;right:10px;top:23px;padding:8px 10px;border-radius:10px;font-size:11px;line-height:1.1;white-space:nowrap;background:var(--accent);color:#fff}
    .pmMatchForm textarea{min-height:190px}
    .pmMatchSend{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-top:9px}
    .pmMatchSend button{padding:10px 5px;font-size:11px;border-radius:10px}
    .pmMatchHint{font-size:11px;line-height:1.4;color:var(--muted);margin:6px 1px 10px}
    .pmMatchChosen{background:#fff;border:1px solid var(--line);border-radius:13px;padding:9px 10px;margin:7px 0;font-size:12px;line-height:1.4}
    .pmMatchChosen b{display:inline-block;min-width:64px}
    .pmMatchForm select{width:100%;border:1px solid #d6d7d4;background:#fff;border-radius:14px;padding:13px 14px;font:inherit;color:var(--text)}
    .pmMatchMissing{font-size:12px;color:#8a3c2c;margin:8px 0;line-height:1.45}
    .pmMediaHint{font-size:11px;color:var(--muted);line-height:1.4;margin:7px 1px 0}
    @media(max-width:390px){header.pmMatchHeader{padding-right:102px}.pmSendMatchTop{right:8px;padding:7px 8px;font-size:10px}.pmBH{right:11px}.pmMatchSend{gap:5px}.pmMatchSend button{font-size:10px}}
  `;
  document.head.appendChild(style);

  function senderName(x){return String(x?.sourceName||x?.source||'').trim();}
  function senderPhone(x){return String(x?.sourcePhone||'').trim();}
  function cleanName(x,fallback){return String(x?.name||'').trim()||fallback;}

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
    const lines=[];
    lines.push(label+': '+cleanName(x,label+' profile')+(x?.age?' (age '+x.age+')':''));
    const text=String(x?.text||'').trim();
    if(text)lines.push(text);
    else if(x?.profileAudio)lines.push('[Audio profile attached when supported]');
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
    let raw=String(phone||'').trim();
    let digits=raw.replace(/\D/g,'');
    if(!digits)return'';
    if(raw.startsWith('+'))return digits;
    if(digits.startsWith('00'))digits=digits.slice(2);
    if(digits.startsWith('0'))digits='972'+digits.slice(1);
    return digits;
  }
  function waUrl(phone,message){return 'https://wa.me/'+waNumber(phone)+'?text='+encodeURIComponent(message);}
  function smsUrl(phone,message){return 'sms:'+String(phone||'').trim()+'?body='+encodeURIComponent(message);}
  function emailUrl(email,subject,message){return 'mailto:'+encodeURIComponent(String(email||'').trim())+'?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(message);}

  function senderInfoOk(x){return !!(senderName(x)||senderPhone(x));}

  function senderRecipients(guy,girl){
    const out=[];
    const add=(side,x)=>{
      const p=senderPhone(x);if(!p)return;
      const n=senderName(x);
      out.push({key:side.toLowerCase(),label:side+' sender'+(n?' — '+n:''),greeting:n||side+' sender',phone:p,side});
    };
    add('Girl',girl);
    add('Guy',guy);
    return out.filter((r,i,a)=>a.findIndex(z=>z.phone.replace(/\D/g,'')===r.phone.replace(/\D/g,''))===i);
  }

  function safeFilePart(s){return String(s||'profile').replace(/[^a-z0-9_-]+/gi,'_').replace(/^_+|_+$/g,'').slice(0,45)||'profile';}
  function extFor(type,fallback){
    const t=String(type||'').toLowerCase();
    if(t==='image/jpeg')return'.jpg';if(t==='image/png')return'.png';if(t==='image/webp')return'.webp';if(t==='image/gif')return'.gif';
    if(t==='audio/webm')return'.webm';if(t==='audio/mpeg')return'.mp3';if(t==='audio/mp4')return'.m4a';if(t==='audio/ogg')return'.ogg';if(t==='audio/wav')return'.wav';
    return fallback||'';
  }
  function fullPhoto(x){return x?.profileMediaFull||x?.profileImage||x?.photo||null;}
  function audioProfile(x){return x?.profileAudio||null;}
  function toFile(blob,name,fallbackType){
    if(!blob||!(blob instanceof Blob))return null;
    const type=blob.type||fallbackType||'application/octet-stream';
    if(typeof File!=='undefined'&&blob instanceof File&&blob.name)return blob;
    try{return new File([blob],name,{type,lastModified:Date.now()});}
    catch(e){return null;}
  }
  function matchMediaFiles(guy,girl){
    const files=[];
    const addProfile=(side,x)=>{
      const base=safeFilePart(cleanName(x,side));
      const photo=fullPhoto(x);
      if(photo instanceof Blob){
        const f=toFile(photo,side+'_'+base+'_photo'+extFor(photo.type,'.jpg'),'image/jpeg');
        if(f)files.push(f);
      }
      const audio=audioProfile(x);
      if(audio instanceof Blob){
        const f=toFile(audio,side+'_'+base+'_audio'+extFor(audio.type,'.webm'),'audio/webm');
        if(f)files.push(f);
      }
    };
    addProfile('Guy',guy);addProfile('Girl',girl);
    return files;
  }
  function mediaSummary(guy,girl){
    const parts=[];
    if(fullPhoto(guy) instanceof Blob)parts.push('Guy photo');
    if(audioProfile(guy) instanceof Blob)parts.push('Guy audio');
    if(fullPhoto(girl) instanceof Blob)parts.push('Girl photo');
    if(audioProfile(girl) instanceof Blob)parts.push('Girl audio');
    return parts;
  }

  function addHistory(guy,girl,shadchan,recipient,channel,message,mediaNames){
    const matchId=Date.now(),ts=stamp();
    const gName=cleanName(guy,'Guy profile'),lName=cleanName(girl,'Girl profile');
    const ch=channel==='sms-media'?'SMS / share sheet':channel.charAt(0).toUpperCase()+channel.slice(1);
    const recipientLabel=shadchan?cleanName(shadchan,'Shadchan'):(recipient?.label||'profile sender');
    const media=(mediaNames||[]).join(', ');
    const mediaLine=media?'\nAttachments: '+media:'';
    const meta={matchId,guyId:guy.id,girlId:girl.id,shadchanId:shadchan?.id||null,channel,message,recipient:recipientLabel,recipientPhone:recipient?.phone||shadchan?.phone||'',recipientSide:recipient?.side||'',media:mediaNames||[]};
    guy.activities=guy.activities||[];girl.activities=girl.activities||[];
    guy.activities.push({id:matchId+1,type:'action',action:'Match sent • '+ch,text:`Match with ${lName} sent to ${recipientLabel} via ${ch}.${mediaLine}\n\n${message}`,ts,...meta});
    girl.activities.push({id:matchId+2,type:'action',action:'Match sent • '+ch,text:`Match with ${gName} sent to ${recipientLabel} via ${ch}.${mediaLine}\n\n${message}`,ts,...meta});
    if(shadchan){
      shadchan.activities=shadchan.activities||[];
      shadchan.activities.push({id:matchId+3,type:'action',action:'Match sent • '+ch,text:`Match sent: ${gName} ↔ ${lName} via ${ch}.${mediaLine}\n\n${message}`,ts,...meta});
    }
  }

  async function saveHistory(guy,girl,shadchan,recipient,channel,message,mediaNames){
    addHistory(guy,girl,shadchan,recipient,channel,message,mediaNames);
    try{await save();return true;}catch(e){console.warn('PeerMatch v29 match history save',e);alert('PeerMatch could not save the match history. Nothing was opened.');return false;}
  }

  async function shareSmsWithMedia(guy,girl,shadchan,recipient,message,phone){
    const files=matchMediaFiles(guy,girl);
    if(!files.length)return false;
    if(!navigator.share||!navigator.canShare)return false;
    let can=false;
    try{can=navigator.canShare({files});}catch(e){can=false;}
    if(!can)return false;

    const recipientLabel=shadchan?cleanName(shadchan,'Shadchan'):(recipient?.label||'recipient');
    const title='Shidduch suggestion';
    try{
      await navigator.share({title,text:message,files});
      const names=mediaSummary(guy,girl);
      if(!await saveHistory(guy,girl,shadchan,recipient,'sms-media',message,names))return true;
      try{render();}catch(e){}
      close();
      return true;
    }catch(e){
      if(e?.name==='AbortError')return true;
      console.warn('PeerMatch media share failed',e);
      alert('Your phone could not share all of the photos/audio together. PeerMatch will open a normal text SMS instead.\n\nRecipient: '+recipientLabel+'\n'+phone);
      return false;
    }
  }

  async function handoff(channel,guy,girl,shadchan,recipient,message){
    const subject='Shidduch suggestion: '+cleanName(guy,'Guy')+' & '+cleanName(girl,'Girl');
    let target='',phone='';
    if(shadchan){
      if(channel==='whatsapp'){
        if(!waNumber(shadchan.phone))return alert('The selected Shadchan needs a phone number for WhatsApp.');
        target=waUrl(shadchan.phone,message);
      }else if(channel==='sms'){
        phone=String(shadchan.phone||'').trim();
        if(!phone)return alert('The selected Shadchan needs a phone number for SMS.');
      }else if(channel==='email'){
        if(!String(shadchan.email||'').trim())return alert('The selected Shadchan needs an email address.');
        target=emailUrl(shadchan.email,subject,message);
      }
    }else{
      if(channel==='email')return alert('Email currently requires a selected Shadchan because Guy/Girl sender email is not stored.');
      if(!recipient?.phone)return alert('Choose a sender with a phone number.');
      phone=recipient.phone;
      if(channel==='whatsapp')target=waUrl(recipient.phone,message);
    }

    if(channel==='sms'){
      const media=matchMediaFiles(guy,girl);
      if(media.length){
        const usedShare=await shareSmsWithMedia(guy,girl,shadchan,recipient,message,phone);
        if(usedShare)return;
      }
      target=smsUrl(phone,message);
    }

    if(!await saveHistory(guy,girl,shadchan,recipient,channel,message,[]))return;
    try{render();}catch(e){}
    close();
    location.href=target;
  }

  function openSendMatch(){
    const guys=checkedRecords('guys'),girls=checkedRecords('girls'),shads=checkedRecords('shadchanim');
    if(guys.length!==1)return alert(guys.length?'Select exactly one Guy.':'Select one Guy using the checkbox in the Guys list.');
    if(girls.length!==1)return alert(girls.length?'Select exactly one Girl.':'Select one Girl using the checkbox in the Girls list.');
    if(shads.length>1)return alert('Select no more than one Shadchan.');

    const guy=guys[0],girl=girls[0],shadchan=shads[0]||null;
    if(!shadchan&&(!senderInfoOk(guy)||!senderInfoOk(girl))){
      return alert('Without a selected Shadchan, both the Guy and Girl need a sender name or sender phone saved on their profiles.');
    }

    const recipients=!shadchan?senderRecipients(guy,girl):[];
    const chosenLabel=shadchan?cleanName(shadchan,'Shadchan'):(recipients[0]?.greeting||'');
    const media=mediaSummary(guy,girl);

    open(`<h2>Send match</h2><div class="pmMatchForm">
      <div class="pmMatchChosen"><div><b>Guy</b>${esc(cleanName(guy,'Guy profile'))}</div><div><b>Girl</b>${esc(cleanName(girl,'Girl profile'))}</div><div><b>Shadchan</b>${shadchan?esc(cleanName(shadchan,'Shadchan')):'Not selected'}</div></div>
      ${!shadchan?(
        recipients.length
          ?`<label>Send to<select id="pmMatchRecipient">${recipients.map((r,i)=>`<option value="${i}">${esc(r.label+' • '+r.phone)}</option>`).join('')}</select></label>`
          :'<div class="pmMatchMissing">Both profiles have sender information, but neither has a sender phone number. Add a sender phone or select a Shadchan to send by WhatsApp/SMS.</div>'
      ):''}
      <label>Message<textarea id="pmMatchMessage"></textarea></label>
      ${media.length?`<div class="pmMediaHint"><b>SMS media:</b> ${esc(media.join(', '))}. Tapping SMS will use the phone share sheet so these files can be attached when supported.</div>`:''}
      <div class="pmMatchHint">The Guy and Girl came from your existing checkbox selections. A Shadchan is optional. If both sender phone numbers are available, Girl sender is selected first by default; you can switch to Guy sender before sending. PeerMatch saves the exact message in both profile histories, and also in the Shadchan history when one is selected.</div>
      <div class="pmMatchSend"><button id="pmMatchWA" class="green">WhatsApp</button><button id="pmMatchSMS" class="secondary">SMS</button><button id="pmMatchEmail" class="secondary">Email</button></div>
      <div class="gap"></div><button id="pmMatchCancel" class="secondary full">Cancel</button>
    </div>`);

    const recipientSelect=document.getElementById('pmMatchRecipient');
    const message=document.getElementById('pmMatchMessage');
    const currentRecipient=()=>shadchan?null:(recipients[Number(recipientSelect?.value||0)]||null);
    const rebuild=()=>{
      const label=shadchan?cleanName(shadchan,'Shadchan'):(currentRecipient()?.greeting||chosenLabel);
      message.value=defaultMessage(guy,girl,label);
    };
    if(recipientSelect)recipientSelect.onchange=rebuild;
    rebuild();

    const send=channel=>{
      const text=message.value.trim();if(!text)return alert('Enter a message.');
      handoff(channel,guy,girl,shadchan,currentRecipient(),text);
    };
    document.getElementById('pmMatchWA').onclick=()=>send('whatsapp');
    document.getElementById('pmMatchSMS').onclick=()=>send('sms');
    document.getElementById('pmMatchEmail').onclick=()=>send('email');
    document.getElementById('pmMatchCancel').onclick=close;
  }

  function installHeader(){
    const header=document.querySelector('.app>header');if(!header)return;
    header.querySelectorAll('.pmSendMatchTop,.pmBH').forEach(el=>el.remove());
    header.classList.add('pmMatchHeader');
    const bh=document.createElement('div');bh.className='pmBH';bh.textContent='ב״ה';header.appendChild(bh);
    const b=document.createElement('button');b.type='button';b.className='pmSendMatchTop';b.textContent='Send match';b.onclick=openSendMatch;header.appendChild(b);
  }

  installHeader();
})();
