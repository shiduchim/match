/* PeerMatch v25: send a Guy/Girl match to a Shadchan and record it on all three records. */
(function(){
  document.documentElement.dataset.peerMatchVersion='25';

  const style=document.createElement('style');
  style.textContent=`
    header{position:sticky}
    header.pmMatchHeader{padding-right:112px;min-height:76px}
    .pmBH{position:absolute;right:13px;top:3px;font-size:11px;font-weight:700;color:var(--muted);line-height:1}
    .pmSendMatchTop{position:absolute;right:10px;top:23px;padding:8px 10px;border-radius:10px;font-size:11px;line-height:1.1;white-space:nowrap;background:var(--accent);color:#fff}
    .pmMatchForm select{width:100%;border:1px solid #d6d7d4;background:#fff;border-radius:14px;padding:13px 14px;font:inherit;color:var(--text)}
    .pmMatchForm textarea{min-height:190px}
    .pmMatchSend{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-top:9px}
    .pmMatchSend button{padding:10px 5px;font-size:11px;border-radius:10px}
    .pmMatchHint{font-size:11px;line-height:1.35;color:var(--muted);margin:5px 1px 10px}
    .pmMatchMissing{font-size:12px;color:#8a3c2c;margin:8px 0}
    @media(max-width:390px){header.pmMatchHeader{padding-right:102px}.pmSendMatchTop{right:8px;padding:7px 8px;font-size:10px}.pmBH{right:11px}.pmMatchSend{gap:5px}.pmMatchSend button{font-size:10px}}
  `;
  document.head.appendChild(style);

  function byId(k,id){return (data[k]||[]).find(x=>String(x.id)===String(id))||null;}
  function cleanName(x,fallback){return String(x?.name||'').trim()||fallback;}
  function senderName(x){return String(x?.sourceName||x?.source||'').trim();}
  function senderPhone(x){return String(x?.sourcePhone||'').trim();}
  function optionLabel(x,fallback){
    const n=cleanName(x,fallback),bits=[];
    if(x?.age)bits.push('Age '+x.age);
    return bits.length?n+' • '+bits.join(' • '):n;
  }
  function sorted(arr){return [...(arr||[])].sort((a,b)=>cleanName(a,'').localeCompare(cleanName(b,''),undefined,{sensitivity:'base'}));}
  function options(k,fallback){
    return '<option value="">Choose '+fallback.toLowerCase()+'…</option>'+sorted(data[k]).map(x=>`<option value="${esc(x.id)}">${esc(optionLabel(x,fallback+' profile'))}</option>`).join('');
  }
  function profileSummary(x,label){
    if(!x)return'';
    const lines=[];
    lines.push(label+': '+cleanName(x,label+' profile')+(x.age?' (age '+x.age+')':''));
    const text=String(x.text||'').trim();
    if(text)lines.push(text);
    else if(x.profileAudio)lines.push('[Audio profile is saved in PeerMatch]');
    const sn=senderName(x),sp=senderPhone(x);
    if(sn)lines.push('Sent by: '+sn+(sp?' • '+sp:''));
    return lines.join('\n');
  }
  function defaultMessage(guy,girl,shadchan){
    if(!guy||!girl)return'';
    const shName=cleanName(shadchan,'');
    return [
      shName?'Hi '+shName+',':'Hi,',
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
  function smsUrl(phone,message){
    return 'sms:'+String(phone||'').trim()+'?body='+encodeURIComponent(message);
  }
  function emailUrl(email,subject,message){
    return 'mailto:'+encodeURIComponent(String(email||'').trim())+'?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(message);
  }
  function waUrl(phone,message){
    return 'https://wa.me/'+waNumber(phone)+'?text='+encodeURIComponent(message);
  }

  function addHistory(guy,girl,shadchan,channel,message){
    const matchId=Date.now();
    const ts=stamp();
    const gName=cleanName(guy,'Guy profile');
    const lName=cleanName(girl,'Girl profile');
    const sName=cleanName(shadchan,'Shadchan');
    const ch=channel.charAt(0).toUpperCase()+channel.slice(1);
    const meta={matchId,guyId:guy.id,girlId:girl.id,shadchanId:shadchan.id,channel,message};
    guy.activities=guy.activities||[];
    girl.activities=girl.activities||[];
    shadchan.activities=shadchan.activities||[];
    guy.activities.push({id:matchId+1,type:'action',action:'Match sent • '+ch,text:`Match with ${lName} sent to ${sName} via ${ch}.\n\n${message}`,ts,...meta});
    girl.activities.push({id:matchId+2,type:'action',action:'Match sent • '+ch,text:`Match with ${gName} sent to ${sName} via ${ch}.\n\n${message}`,ts,...meta});
    shadchan.activities.push({id:matchId+3,type:'action',action:'Match sent • '+ch,text:`Match sent: ${gName} ↔ ${lName} via ${ch}.\n\n${message}`,ts,...meta});
  }

  async function handoff(channel,guy,girl,shadchan,message){
    const subject='Shidduch suggestion: '+cleanName(guy,'Guy')+' & '+cleanName(girl,'Girl');
    let target='';
    if(channel==='whatsapp'){
      if(!waNumber(shadchan.phone))return alert('Add a phone number for this shadchan first.');
      target=waUrl(shadchan.phone,message);
    }else if(channel==='sms'){
      if(!String(shadchan.phone||'').trim())return alert('Add a phone number for this shadchan first.');
      target=smsUrl(shadchan.phone,message);
    }else if(channel==='email'){
      if(!String(shadchan.email||'').trim())return alert('Add an email address for this shadchan first.');
      target=emailUrl(shadchan.email,subject,message);
    }else return;

    addHistory(guy,girl,shadchan,channel,message);
    try{await save();}catch(e){console.warn('PeerMatch v25 match history save',e);return alert('PeerMatch could not save the match history. Nothing was opened.');}
    try{render();}catch(e){}
    close();
    location.href=target;
  }

  function openSendMatch(){
    const missing=[];
    if(!(data.guys||[]).length)missing.push('a Guy');
    if(!(data.girls||[]).length)missing.push('a Girl');
    if(!(data.shadchanim||[]).length)missing.push('a Shadchan');

    open(`<h2>Send match</h2><div class="pmMatchForm">
      ${missing.length?`<div class="pmMatchMissing">Add ${esc(missing.join(', '))} before sending a match.</div>`:''}
      <label>Guy<select id="pmMatchGuy">${options('guys','Guy')}</select></label>
      <label>Girl<select id="pmMatchGirl">${options('girls','Girl')}</select></label>
      <label>Shadchan<select id="pmMatchShadchan">${options('shadchanim','Shadchan')}</select></label>
      <label>Message<textarea id="pmMatchMessage" placeholder="Choose a Guy and Girl to build the message"></textarea></label>
      <div class="pmMatchHint">PeerMatch records the sent match in the Guy, Girl and Shadchan histories before opening the selected messaging app.</div>
      <div class="pmMatchSend"><button id="pmMatchWA" class="green">WhatsApp</button><button id="pmMatchSMS" class="secondary">SMS</button><button id="pmMatchEmail" class="secondary">Email</button></div>
      <div class="gap"></div><button id="pmMatchCancel" class="secondary full">Cancel</button>
    </div>`);

    const g=document.getElementById('pmMatchGuy'),l=document.getElementById('pmMatchGirl'),s=document.getElementById('pmMatchShadchan'),m=document.getElementById('pmMatchMessage');
    const rebuild=()=>{m.value=defaultMessage(byId('guys',g.value),byId('girls',l.value),byId('shadchanim',s.value));};
    g.onchange=rebuild;l.onchange=rebuild;s.onchange=rebuild;

    const send=channel=>{
      const guy=byId('guys',g.value),girl=byId('girls',l.value),shadchan=byId('shadchanim',s.value),message=m.value.trim();
      if(!guy)return alert('Choose a Guy.');
      if(!girl)return alert('Choose a Girl.');
      if(!shadchan)return alert('Choose a Shadchan.');
      if(!message)return alert('Enter a message.');
      handoff(channel,guy,girl,shadchan,message);
    };
    document.getElementById('pmMatchWA').onclick=()=>send('whatsapp');
    document.getElementById('pmMatchSMS').onclick=()=>send('sms');
    document.getElementById('pmMatchEmail').onclick=()=>send('email');
    document.getElementById('pmMatchCancel').onclick=close;
  }

  function installHeader(){
    const header=document.querySelector('.app>header');
    if(!header||header.dataset.v25Match==='1')return;
    header.dataset.v25Match='1';
    header.classList.add('pmMatchHeader');
    const bh=document.createElement('div');bh.className='pmBH';bh.textContent='ב״ה';header.appendChild(bh);
    const b=document.createElement('button');b.type='button';b.className='pmSendMatchTop';b.textContent='Send match';b.onclick=openSendMatch;header.appendChild(b);
  }

  installHeader();
  new MutationObserver(installHeader).observe(document.body,{childList:true,subtree:true});
})();
