/* PeerMatch v14 interaction refinements
   - Compact photo/screenshot tile without plus/cross symbols.
   - Audio profile recording beside media tile; Guided Voice hidden.
   - Compact shadchan header/actions; edit in top-right.
   - SMS/Email/WhatsApp compose inside PeerMatch first, save history, then hand off.
   - Shadchan audio notes attempt live transcription and display it under the player.
*/
(function(){
  const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  let currentProfile=null;
  let profileRecorder=null,profileStream=null,profileChunks=[];
  let pendingProfileAudio=null;
  let shadRecorder=null,shadStream=null,shadChunks=[],shadSpeech=null;

  const style=document.createElement('style');
  style.textContent=`
    .pmMediaTile{width:72px!important;height:72px!important;flex:0 0 72px!important;border:1px solid #cfd9df!important;border-radius:13px!important;background:#f7fafc!important;font-size:10px!important;padding:5px!important}
    .pmMediaPlus{display:none!important}
    .pmMediaRemove{width:auto!important;height:auto!important;min-width:0!important;border-radius:8px!important;padding:3px 6px!important;top:3px!important;right:3px!important;font-size:9px!important;line-height:1.1!important;background:rgba(25,50,74,.86)!important}
    .pmMediaTapHint{display:none!important}
    .pmMediaHeader{gap:8px!important;align-items:flex-start!important}
    .pmTopTools{display:flex;align-items:stretch;gap:6px;flex:0 0 auto}
    .pmAudioProfileBtn{width:78px;min-height:72px;padding:7px 6px;border-radius:13px;background:#eef3f6;color:var(--text);font-size:10px;line-height:1.2}
    .pmAudioProfileBtn.recording{background:#f7e6e6;color:#7d2929}
    .pmProfileAudioBox{margin:6px 0 10px;padding:8px 10px;background:#fff;border:1px solid var(--line);border-radius:12px}
    .pmProfileAudioBox .small{margin:0 0 4px}
    .pmProfileAudioBox audio{margin:0}
    .pmShadHeader{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:8px}
    .pmShadHeader h2{margin:0;min-width:0}
    .pmSmallEdit{padding:6px 9px;border-radius:9px;font-size:11px;font-weight:700;background:#eef3f6;color:var(--text);white-space:nowrap}
    .pmContactActions{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:7px 0 10px}
    .pmContactActions button{padding:8px 5px;border-radius:10px;font-size:11px;min-height:34px}
    .pmMessageBox{min-height:120px!important}
    .pmComposeInfo{font-size:12px;color:var(--muted);margin:-4px 0 7px}
    .pmV14Fixed{position:fixed;left:50%;bottom:max(9px,env(safe-area-inset-bottom));transform:translateX(-50%);width:min(590px,calc(100% - 20px));z-index:110;display:grid;gap:7px;padding:8px;background:rgba(255,255,255,.97);border:1px solid var(--line);border-radius:15px;box-shadow:0 4px 18px rgba(0,0,0,.16);backdrop-filter:blur(10px)}
    .pmV14Fixed.form{grid-template-columns:1.25fr .75fr}
    .pmV14Fixed.detail{grid-template-columns:1fr 1fr .72fr}
    .pmV14Fixed button{padding:9px 7px;min-height:38px;border-radius:10px;font-size:12px;font-weight:800}
    .pmAudioTranscript{margin-top:7px;padding-top:7px;border-top:1px solid var(--line);font-size:13px;line-height:1.4;white-space:pre-wrap}
    .pmAudioTranscript .small{display:block;margin:0 0 3px}
    .sheet.pmV14Bottom{padding-bottom:82px}
    @media(max-width:420px){.pmMediaTile{width:66px!important;height:66px!important;flex-basis:66px!important}.pmAudioProfileBtn{width:70px;min-height:66px}.pmContactActions{gap:4px}.pmContactActions button{font-size:10px;padding:8px 3px}}
  `;
  document.head.appendChild(style);

  function mediaOf(x){return x?.profileMedia||x?.profileImage||x?.photo||null;}
  function cleanMediaUI(){
    document.querySelectorAll('.pmMediaPlus').forEach(n=>n.remove());
    document.querySelectorAll('.pmMediaRemove').forEach(b=>{b.textContent='Remove';b.setAttribute('aria-label','Remove image');});
    const tile=document.getElementById('pmUnifiedMediaTile');
    if(tile&&!tile.querySelector('img')&&!tile.dataset.cleaned){tile.dataset.cleaned='1';tile.innerHTML='<div>Photo /<br>screenshot</div>';}
  }

  function profileKindFromForm(){
    const h=document.querySelector('#sheet h2')?.textContent||'';
    if(/Guy/i.test(h))return'guys';if(/Girl/i.test(h))return'girls';return null;
  }

  async function startProfileAudio(btn,onDone){
    if(profileRecorder&&profileRecorder.state==='recording'){profileRecorder.stop();return;}
    try{
      profileStream=await navigator.mediaDevices.getUserMedia({audio:true});
      profileChunks=[];profileRecorder=new MediaRecorder(profileStream);
      profileRecorder.ondataavailable=e=>{if(e.data.size)profileChunks.push(e.data)};
      profileRecorder.onstop=()=>{
        const blob=new Blob(profileChunks,{type:profileRecorder.mimeType||'audio/webm'});
        profileStream?.getTracks().forEach(t=>t.stop());profileStream=null;profileRecorder=null;
        btn.classList.remove('recording');btn.textContent='Audio saved';onDone(blob);
      };
      profileRecorder.start();btn.classList.add('recording');btn.textContent='Stop audio';
    }catch(e){alert('Microphone permission is required to record an audio profile.');}
  }

  function decorateProfileForm(){
    cleanMediaUI();
    const sheet=document.getElementById('sheet'),tile=document.getElementById('pmUnifiedMediaTile');
    const addForm=document.getElementById('pnm'),editForm=document.getElementById('pen');
    if(!sheet||!tile||(!addForm&&!editForm))return;
    document.getElementById('pmGuidedVoice')?.remove();
    if(document.getElementById('pmAudioProfileBtn'))return;

    const tools=document.createElement('div');tools.className='pmTopTools';
    const parent=tile.parentElement;parent?.appendChild(tools);tools.appendChild(tile);
    const btn=document.createElement('button');btn.type='button';btn.id='pmAudioProfileBtn';btn.className='pmAudioProfileBtn';
    tools.appendChild(btn);

    const k=profileKindFromForm();
    const x=editForm&&currentProfile?data[currentProfile.k]?.find(z=>z.id===currentProfile.id):null;
    pendingProfileAudio=null;
    btn.textContent=x?.profileAudio?'Replace audio':'Audio profile';
    btn.onclick=()=>startProfileAudio(btn,blob=>{pendingProfileAudio=blob;});

    const saveBtn=document.getElementById('pmFormSave');
    if(saveBtn&&!saveBtn.dataset.v14AudioSave){
      saveBtn.dataset.v14AudioSave='1';
      const beforeCount=k?(data[k]?.length||0):0;
      saveBtn.addEventListener('click',()=>{
        const audioBlob=pendingProfileAudio;if(!audioBlob)return;
        setTimeout(async()=>{
          try{
            if(editForm&&currentProfile){const target=data[currentProfile.k]?.find(z=>z.id===currentProfile.id);if(target){target.profileAudio=audioBlob;await save();}}
            else if(k&&(data[k]?.length||0)>beforeCount){data[k][0].profileAudio=audioBlob;await save();}
          }catch(e){console.warn('Saving audio profile failed',e)}
        },120);
      });
    }
  }

  function decorateProfileDetail(){
    cleanMediaUI();
    if(!currentProfile)return;
    const sheet=document.getElementById('sheet'),x=data[currentProfile.k]?.find(z=>z.id===currentProfile.id);if(!sheet||!x)return;
    if(x.profileAudio&&!document.getElementById('pmProfileAudioBox')){
      const header=sheet.querySelector('.pmMediaHeader')||sheet.querySelector('h2');
      const box=document.createElement('div');box.id='pmProfileAudioBox';box.className='pmProfileAudioBox';
      box.innerHTML=`<div class="small">Audio profile</div><audio controls src="${url(x.profileAudio)}"></audio>`;
      (header?.parentElement?header:sheet.firstElementChild)?.insertAdjacentElement('afterend',box);
    }
  }

  const previousOpenP=window.openP;
  if(previousOpenP){window.openP=openP=function(k,id){currentProfile={k,id};previousOpenP(k,id);setTimeout(decorateProfileDetail,30);};}

  function normalizePhone(p){
    let d=String(p||'').replace(/\D/g,'');if(d.startsWith('00'))d=d.slice(2);if(d.startsWith('0'))d='972'+d.slice(1);return d;
  }
  function addActivity(x,type,text,extra){
    x.activities=x.activities||[];x.activities.push(Object.assign({id:Date.now(),type,text:String(text||'').trim(),ts:stamp()},extra||{}));
  }

  const oldActs=window.acts;
  window.acts=acts=function(x){
    if(!x.activities?.length)return '<div class="empty">No contact history yet.</div>';
    return [...x.activities].reverse().map(a=>{
      if(a.type==='audio')return `<div class="event"><div class="eventTop"><span>Audio note</span><span>${esc(a.ts)}</span></div><audio controls src="${url(a.audio)}"></audio>${a.transcript||a.text?`<div class="pmAudioTranscript"><span class="small">Transcript</span>${esc(a.transcript||a.text||'')}</div>`:''}</div>`;
      if(a.type==='wa-out')return `<div class="event waOut"><div class="eventTop"><span>You → WhatsApp</span><span>${esc(a.ts)}</span></div><div class="profileText">${esc(a.text||'')}</div></div>`;
      if(a.type==='wa-in')return `<div class="event waIn"><div class="eventTop"><span>WhatsApp → You</span><span>${esc(a.ts)}</span></div><div class="profileText">${esc(a.text||'')}</div></div>`;
      if(a.type==='sms-out')return `<div class="event"><div class="eventTop"><span>You → SMS</span><span>${esc(a.ts)}</span></div><div class="profileText">${esc(a.text||'')}</div></div>`;
      if(a.type==='email-out')return `<div class="event"><div class="eventTop"><span>You → Email</span><span>${esc(a.ts)}</span></div><div class="profileText">${esc(a.text||'')}</div></div>`;
      return `<div class="event"><div class="eventTop"><span>${esc(a.type==='action'?a.action:'Note')}</span><span>${esc(a.ts)}</span></div><div class="profileText">${esc(a.text||'')}</div></div>`;
    }).join('');
  };

  function formBar(saveText,onSave,onCancel){
    const sheet=document.getElementById('sheet');if(!sheet)return;
    sheet.classList.add('pmV14Bottom');document.getElementById('pmV14Fixed')?.remove();
    const bar=document.createElement('div');bar.id='pmV14Fixed';bar.className='pmV14Fixed form';
    bar.innerHTML=`<button id="pmV14Save" class="primary">${esc(saveText)}</button><button id="pmV14Cancel" class="secondary">Cancel</button>`;
    sheet.appendChild(bar);document.getElementById('pmV14Save').onclick=onSave;document.getElementById('pmV14Cancel').onclick=onCancel;
  }

  function detailBar(id,x){
    const sheet=document.getElementById('sheet');if(!sheet)return;
    sheet.classList.add('pmV14Bottom');document.getElementById('pmV14Fixed')?.remove();
    const bar=document.createElement('div');bar.id='pmV14Fixed';bar.className='pmV14Fixed detail';
    bar.innerHTML='<button id="pmV14Text" class="secondary">Text note</button><button id="pmV14Audio" class="secondary">Audio note</button><button id="pmV14Close" class="primary">Close</button>';
    sheet.appendChild(bar);
    document.getElementById('pmV14Text').onclick=()=>note('shadchanim',id);
    document.getElementById('pmV14Audio').onclick=()=>recordShadchanAudio(x,id,document.getElementById('pmV14Audio'));
    document.getElementById('pmV14Close').onclick=close;
  }

  function editShadchan(id){
    const x=data.shadchanim.find(z=>z.id===id);if(!x)return;
    open(`<h2>Edit Shadchan</h2><label>Name<input id="v14Name" value="${esc(x.name||'')}"></label><label>Phone / SMS<input id="v14Phone" type="tel" inputmode="tel" value="${esc(x.phone||'')}"></label><label>Email<input id="v14Email" type="email" value="${esc(x.email||'')}"></label><label>Tags<input id="v14Tags" value="${esc(x.tags||'')}"></label>`);
    formBar('Save',async()=>{const n=document.getElementById('v14Name').value.trim();if(!n)return alert('Enter a name.');x.name=n;x.phone=document.getElementById('v14Phone').value.trim();x.email=document.getElementById('v14Email').value.trim();x.tags=document.getElementById('v14Tags').value.trim();await save();renderS();openS(id);},()=>openS(id));
  }

  function composeMessage(x,channel){
    const isWa=channel==='WhatsApp',isSms=channel==='SMS';
    if((isWa||isSms)&&!x.phone)return alert('Add a phone number first.');
    if(channel==='Email'&&!x.email)return alert('Add an email first.');
    open(`<h2>${esc(channel)} message</h2><div class="pmComposeInfo">Write it here first. PeerMatch saves the message before opening ${esc(channel)}.</div><textarea id="pmV14Message" class="pmMessageBox" placeholder="Type your message…"></textarea>`);
    formBar('Continue to '+channel,async()=>{
      const text=document.getElementById('pmV14Message').value.trim();if(!text)return alert('Type a message first.');
      let target='';
      if(isWa){const d=normalizePhone(x.phone);if(!d)return alert('Check the phone number.');addActivity(x,'wa-out',text,{source:'PeerMatch'});target='https://wa.me/'+d+'?text='+encodeURIComponent(text);}
      else if(isSms){addActivity(x,'sms-out',text,{source:'PeerMatch'});target='sms:'+x.phone+'?body='+encodeURIComponent(text);}
      else {addActivity(x,'email-out',text,{source:'PeerMatch'});target='mailto:'+encodeURIComponent(x.email)+'?body='+encodeURIComponent(text);}
      await save();renderS();location.href=target;
    },()=>openS(x.id));
  }

  async function recordShadchanAudio(x,id,button){
    if(shadRecorder&&shadRecorder.state==='recording'){shadRecorder.stop();return;}
    try{
      shadStream=await navigator.mediaDevices.getUserMedia({audio:true});shadChunks=[];let transcript='';
      shadRecorder=new MediaRecorder(shadStream);
      shadRecorder.ondataavailable=e=>{if(e.data.size)shadChunks.push(e.data)};
      if(SpeechRecognition){
        try{
          shadSpeech=new SpeechRecognition();shadSpeech.lang=navigator.language||'en-US';shadSpeech.continuous=true;shadSpeech.interimResults=false;
          shadSpeech.onresult=e=>{for(let i=e.resultIndex;i<e.results.length;i++){if(e.results[i].isFinal)transcript+=(transcript?' ':'')+(e.results[i][0]?.transcript||'').trim();}};
          shadSpeech.onerror=()=>{};shadSpeech.onend=()=>{};shadSpeech.start();
        }catch(e){shadSpeech=null;}
      }
      shadRecorder.onstop=async()=>{
        try{shadSpeech?.stop()}catch(e){}shadSpeech=null;
        shadStream?.getTracks().forEach(t=>t.stop());
        const blob=new Blob(shadChunks,{type:shadRecorder.mimeType||'audio/webm'});shadRecorder=null;shadStream=null;
        x.activities=x.activities||[];x.activities.push({id:Date.now(),type:'audio',audio:blob,transcript:transcript.trim(),text:transcript.trim(),ts:stamp()});
        await save();renderS();openS(id);
      };
      shadRecorder.start();button.textContent='Stop audio';button.classList.add('pmDanger');
    }catch(e){alert('Microphone permission is required.');}
  }

  window.openS=openS=function(id){
    const x=data.shadchanim.find(z=>z.id===id);if(!x)return;
    open(`<div class="pmShadHeader"><h2>${esc(x.name||'Unnamed shadchan')}</h2><button id="pmV14Edit" class="pmSmallEdit">Edit</button></div><div class="pmContactActions"><button id="pmV14Call" class="primary">Call</button><button id="pmV14Sms" class="secondary">SMS</button><button id="pmV14Wa" class="green">WhatsApp</button><button id="pmV14Email" class="secondary">Email</button></div><div class="sectionTitle">Conversation / contact history</div>${acts(x)}`);
    document.getElementById('pmV14Edit').onclick=()=>editShadchan(id);
    document.getElementById('pmV14Call').onclick=async()=>{if(!x.phone)return alert('Add a phone number first.');addActivity(x,'action','Call opened',{action:'Call'});await save();location.href='tel:'+x.phone;};
    document.getElementById('pmV14Sms').onclick=()=>composeMessage(x,'SMS');
    document.getElementById('pmV14Wa').onclick=()=>composeMessage(x,'WhatsApp');
    document.getElementById('pmV14Email').onclick=()=>composeMessage(x,'Email');
    detailBar(id,x);
  };

  function scan(){
    cleanMediaUI();
    if(document.getElementById('pmUnifiedMediaTile')&&(document.getElementById('pnm')||document.getElementById('pen')))decorateProfileForm();
    if(currentProfile&&document.getElementById('pmUnifiedMediaTile')&&!document.getElementById('pnm')&&!document.getElementById('pen'))decorateProfileDetail();
  }
  new MutationObserver(scan).observe(document.body,{childList:true,subtree:true});
  setInterval(scan,500);scan();
})();
