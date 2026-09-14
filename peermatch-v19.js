/* PeerMatch v19: one image owner + one audio/transcription owner.
   Replaces the layered media/audio handlers used in v14-v18.
*/
(function(){
  document.documentElement.dataset.peerMatchVersion='19';
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  const objectUrls=new Map();
  let activeProfile=null;
  let activeAudio=null;

  const style=document.createElement('style');
  style.textContent=`
    .v19Head{display:flex;align-items:flex-start;justify-content:space-between;gap:9px;margin-bottom:7px}.v19Head h2{margin:0;min-width:0;flex:1}
    .v19Tools{display:flex;gap:6px;align-items:stretch;flex:0 0 auto}.v19Media{width:66px;height:66px;flex:0 0 66px;border:1px solid #cbd6dc;border-radius:12px;background:#f7fafc;display:flex;align-items:center;justify-content:center;overflow:hidden;position:relative;text-align:center;font-size:9px;font-weight:800;line-height:1.15;color:#536b7a;padding:4px;cursor:pointer}.v19Media img{width:100%;height:100%;object-fit:cover;display:block}.v19Media .remove{position:absolute;right:3px;bottom:3px;padding:3px 5px;border-radius:7px;background:rgba(25,50,74,.84);color:#fff;font-size:8px;line-height:1}.v19AudioProfile{width:72px;min-height:66px;padding:6px 5px;border-radius:12px;background:#eef3f6;color:var(--text);font-size:9px;line-height:1.15}.v19AudioProfile.recording{background:#f7e8e8;color:#7a2929}
    .v19Hidden{display:none!important}.v19Source{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(120px,.85fr);gap:7px;align-items:end}.v19Source label{min-width:0;margin:8px 0}.v19Source input{min-width:0;width:100%}
    .v19Fixed{position:fixed;left:50%;bottom:max(8px,env(safe-area-inset-bottom));transform:translateX(-50%);width:min(590px,calc(100% - 16px));z-index:140;display:grid;gap:6px;padding:7px;background:rgba(255,255,255,.97);border:1px solid var(--line);border-radius:14px;box-shadow:0 4px 18px rgba(0,0,0,.16);backdrop-filter:blur(10px)}.v19Fixed.form{grid-template-columns:1.25fr .75fr}.v19Fixed.detail{grid-template-columns:1fr 1fr .72fr}.v19Fixed button{padding:9px 7px;min-height:38px;border-radius:10px;font-size:12px;font-weight:800}.sheet.v19Bottom{padding-bottom:82px}
    .v19Transcript{margin:7px 0 10px;padding:8px 10px;border:1px solid var(--line);border-radius:11px;background:#fff;font-size:12px;line-height:1.4;white-space:pre-wrap}.v19Transcript .small{display:block;margin:0 0 3px}.v19Warn{color:#8a4b20;font-size:11px;margin-top:4px}
    .v19ProfileAudio{margin:8px 0 10px;padding:9px;background:#fff;border:1px solid var(--line);border-radius:12px}.v19ProfileAudio audio{margin:3px 0 0}.v19AudioText{font-size:13px;line-height:1.45;white-space:pre-wrap;margin-top:6px;padding-top:6px;border-top:1px solid var(--line)}
    .v19Full{position:fixed;inset:0;z-index:600;background:rgba(0,0,0,.94);display:flex;align-items:center;justify-content:center;padding:58px 8px 12px}.v19Full img{max-width:100%;max-height:100%;object-fit:contain}.v19Full button{position:fixed;top:max(12px,env(safe-area-inset-top));right:12px;background:#fff;color:#19324a;padding:9px 14px;border-radius:10px}
    .v19ShadHead{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}.v19ShadHead h2{margin:0}.v19Edit{padding:6px 8px;font-size:10px;border-radius:8px;background:#eef3f6;color:var(--text)}.v19Contact{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin:8px 0 11px}.v19Contact button{padding:8px 3px;font-size:10px;border-radius:9px;min-height:34px}.v19Compose{min-height:120px!important}
    .pmAudioTranscript{margin-top:7px;padding-top:7px;border-top:1px solid var(--line);font-size:13px;line-height:1.4;white-space:pre-wrap}.pmAudioTranscript .small{display:block;margin:0 0 3px}
    @media(max-width:420px){.v19Media{width:60px;height:60px;flex-basis:60px}.v19AudioProfile{width:67px;min-height:60px}.v19Source{grid-template-columns:minmax(0,1.1fr) minmax(112px,.9fr)}}
  `;
  document.head.appendChild(style);

  function senderName(x){return String(x?.sourceName||x?.source||'').trim();}
  function senderPhone(x){return String(x?.sourcePhone||'').trim();}
  function deriveAge(text){const m=String(text||'').match(/\bage\s*(?:is|:|-)?\s*(\d{2})\b/i)||String(text||'').match(/\b(\d{2})\s*(?:years?\s*old|yo)\b/i);if(!m)return'';const n=+m[1];return n>=18&&n<=99?String(n):'';}
  function fullMedia(x){return x?.profileMediaFull||x?.profileMedia||x?.profileImage||x?.photo||null;}
  function thumbMedia(x){return x?.profileMediaThumb||x?.photo||x?.profileMediaFull||x?.profileMedia||x?.profileImage||null;}
  function setObjectUrl(key,blob){const old=objectUrls.get(key);if(old)try{URL.revokeObjectURL(old)}catch(e){}if(!blob){objectUrls.delete(key);return'';}const u=URL.createObjectURL(blob);objectUrls.set(key,u);return u;}
  function revokePrefix(prefix){for(const [k,u] of objectUrls){if(k.startsWith(prefix)){try{URL.revokeObjectURL(u)}catch(e){}objectUrls.delete(k);}}}
  function openFull(blob){if(!blob)return;document.getElementById('v19Full')?.remove();const u=URL.createObjectURL(blob),d=document.createElement('div');d.id='v19Full';d.className='v19Full';d.innerHTML=`<button type="button">Close</button><img src="${u}" alt="Profile image">`;document.body.appendChild(d);const done=()=>{try{URL.revokeObjectURL(u)}catch(e){}d.remove();};d.querySelector('button').onclick=done;d.onclick=e=>{if(e.target===d)done();};}

  async function bitmapToBlob(bitmap,maxEdge,quality){
    const scale=Math.min(1,maxEdge/Math.max(bitmap.width,bitmap.height));const w=Math.max(1,Math.round(bitmap.width*scale)),h=Math.max(1,Math.round(bitmap.height*scale));
    let c,ctx,blob;
    if('OffscreenCanvas'in window){c=new OffscreenCanvas(w,h);ctx=c.getContext('2d',{alpha:false});ctx.drawImage(bitmap,0,0,w,h);blob=await c.convertToBlob({type:'image/webp',quality});}
    else{c=document.createElement('canvas');c.width=w;c.height=h;ctx=c.getContext('2d',{alpha:false});ctx.drawImage(bitmap,0,0,w,h);blob=await new Promise((ok,no)=>c.toBlob(b=>b?ok(b):no(new Error('Image encode failed')),'image/webp',quality));c.width=c.height=1;}
    return blob;
  }
  async function processImage(file,onStatus){
    if(!file||!String(file.type||'').startsWith('image/'))throw new Error('Choose an image file.');
    onStatus?.('Loading…');
    if(!('createImageBitmap'in window))return{full:file,thumb:file};
    let probe=null,fullBitmap=null;
    try{
      probe=await createImageBitmap(file,{resizeWidth:320,resizeQuality:'medium',imageOrientation:'from-image'});
      const portrait=probe.height>probe.width;
      const thumb=await bitmapToBlob(probe,320,.72);
      probe.close?.();probe=null;
      let full=file;
      if(file.size>2.5*1024*1024){
        const opts=portrait?{resizeHeight:1600,resizeQuality:'medium',imageOrientation:'from-image'}:{resizeWidth:1600,resizeQuality:'medium',imageOrientation:'from-image'};
        fullBitmap=await createImageBitmap(file,opts);full=await bitmapToBlob(fullBitmap,1600,.80);fullBitmap.close?.();fullBitmap=null;
      }
      return{full,thumb};
    }finally{try{probe?.close?.();fullBitmap?.close?.();}catch(e){}}
  }

  function fixedForm(saveText,onSave,onCancel){const s=document.getElementById('sheet');if(!s)return;s.classList.add('v19Bottom');document.getElementById('v19Fixed')?.remove();const b=document.createElement('div');b.id='v19Fixed';b.className='v19Fixed form';b.innerHTML=`<button id="v19Save" class="primary">${esc(saveText)}</button><button id="v19Cancel" class="secondary">Cancel</button>`;s.appendChild(b);document.getElementById('v19Save').onclick=onSave;document.getElementById('v19Cancel').onclick=onCancel;}
  function fixedDetail(onText,onAudio,onClose){const s=document.getElementById('sheet');if(!s)return;s.classList.add('v19Bottom');document.getElementById('v19Fixed')?.remove();const b=document.createElement('div');b.id='v19Fixed';b.className='v19Fixed detail';b.innerHTML='<button id="v19Text" class="secondary">Text note</button><button id="v19Audio" class="secondary">Audio note</button><button id="v19Close" class="primary">Close</button>';s.appendChild(b);document.getElementById('v19Text').onclick=onText;document.getElementById('v19Audio').onclick=onAudio;document.getElementById('v19Close').onclick=onClose;}

  class AudioManager{
    constructor(onText,onStatus){this.onText=onText||(()=>{});this.onStatus=onStatus||(()=>{});this.parts=[];this.results=[];this.ended=false;this.error='';}
    best(){return this.results.filter(Boolean).join(' ').replace(/\s+/g,' ').trim();}
    async start(){
      this.stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});this.track=this.stream.getAudioTracks()[0];
      this.recorder=new MediaRecorder(this.stream);this.recorder.ondataavailable=e=>{if(e.data.size)this.parts.push(e.data)};
      if(SR){
        this.speech=new SR();this.speech.lang=navigator.language||'en-US';this.speech.continuous=true;this.speech.interimResults=true;this.speech.maxAlternatives=1;
        this.speech.onresult=e=>{for(let i=e.resultIndex;i<e.results.length;i++){const t=(e.results[i]?.[0]?.transcript||'').trim();if(t)this.results[i]=t;}this.onText(this.best());};
        this.speech.onerror=e=>{this.error=e.error||'speech recognition error';this.onStatus('Transcription: '+this.error);};
        this.speech.onend=()=>{this.ended=true;if(this._endResolve)this._endResolve();};
        try{this.speech.start(this.track);this.onStatus('Listening');}
        catch(err){try{this.speech.start();this.onStatus('Listening');}catch(err2){this.error=err2?.message||'recognition failed';this.onStatus('Transcription unavailable');}}
      }else{this.error='Speech recognition is not supported by this browser';this.onStatus('Transcription unavailable');}
      this.recorder.start(500);return this;
    }
    waitSpeech(ms=1300){if(!this.speech||this.ended)return Promise.resolve();return new Promise(resolve=>{this._endResolve=resolve;setTimeout(resolve,ms);});}
    stopRecorder(){return new Promise(resolve=>{if(!this.recorder||this.recorder.state==='inactive')return resolve(new Blob(this.parts,{type:this.recorder?.mimeType||'audio/webm'}));this.recorder.onstop=()=>resolve(new Blob(this.parts,{type:this.recorder.mimeType||'audio/webm'}));try{this.recorder.requestData()}catch(e){}this.recorder.stop();});}
    async stop(){try{this.speech?.stop()}catch(e){}await this.waitSpeech();const audio=await this.stopRecorder();this.stream?.getTracks().forEach(t=>t.stop());const transcript=this.best();return{audio,transcript,error:this.error};}
  }

  function installMedia(tile,input,initialFull,initialThumb){
    const state={full:initialFull||null,thumb:initialThumb||initialFull||null,preview:'',busy:false};
    const draw=()=>{if(state.preview){try{URL.revokeObjectURL(state.preview)}catch(e){}state.preview='';}tile.innerHTML='';if(state.thumb){state.preview=URL.createObjectURL(state.thumb);tile.innerHTML=`<img src="${state.preview}" alt="Photo or screenshot"><button type="button" class="remove">Remove</button>`;tile.querySelector('.remove').onclick=e=>{e.stopPropagation();state.full=null;state.thumb=null;draw();};}else tile.textContent='Photo / screenshot';};
    tile.onclick=e=>{if(!e.target.closest('.remove')&&!state.busy)input.click();};
    input.onchange=async()=>{const f=input.files?.[0];input.value='';if(!f)return;state.busy=true;tile.textContent='Loading…';try{const m=await processImage(f,t=>{tile.textContent=t});state.full=m.full;state.thumb=m.thumb;draw();}catch(err){console.warn('PeerMatch image failed',err);tile.textContent='Photo / screenshot';alert('Could not use that image. Try another photo or screenshot.');}finally{state.busy=false;}};
    draw();return state;
  }

  function profileHeader(title,existingFull,existingThumb){
    open(`<div class="v19Head"><h2>${esc(title)}</h2><div class="v19Tools"><div id="v19Media" class="v19Media" role="button">Photo / screenshot</div><button id="v19ProfileAudio" class="v19AudioProfile" type="button">Audio profile</button></div></div><input id="v19MediaInput" class="v19Hidden" type="file" accept="image/*"><div id="v19AudioText" class="v19Transcript hidden"><span class="small">Audio profile text</span><span id="v19AudioValue"></span><div id="v19AudioWarn" class="v19Warn"></div></div>`);
    return installMedia(document.getElementById('v19Media'),document.getElementById('v19MediaInput'),existingFull,existingThumb);
  }

  function bindProfileAudio(existingAudio,existingText){
    const btn=document.getElementById('v19ProfileAudio'),box=document.getElementById('v19AudioText'),val=document.getElementById('v19AudioValue'),warn=document.getElementById('v19AudioWarn');
    const state={audio:existingAudio||null,text:existingText||'',manager:null};
    if(state.text){box.classList.remove('hidden');val.textContent=state.text;}btn.textContent=existingAudio?'Replace audio':'Audio profile';
    const profileEl=()=>document.getElementById('v19Profile');let writing=false;
    const fill=t=>{state.text=t;box.classList.remove('hidden');val.textContent=t||'Listening…';const p=profileEl();if(p&&(!p.value.trim()||p.dataset.audioFill==='1')){writing=true;p.value=t;p.dataset.audioFill='1';p.dispatchEvent(new Event('input',{bubbles:true}));writing=false;}};
    setTimeout(()=>{const p=profileEl();if(p)p.addEventListener('input',()=>{if(!writing)delete p.dataset.audioFill;});},0);
    async function start(){if(state.manager)return finish();warn.textContent='';box.classList.remove('hidden');val.textContent='Listening…';const m=new AudioManager(fill,s=>{warn.textContent=s==='Listening'?'':s});state.manager=m;activeAudio=m;try{await m.start();btn.classList.add('recording');btn.textContent='Stop audio';}catch(e){state.manager=null;activeAudio=null;warn.textContent='Microphone could not start.';alert('Microphone permission is required.');}}
    async function finish(){if(!state.manager)return;btn.textContent='Finishing…';const m=state.manager;state.manager=null;const r=await m.stop();activeAudio=null;state.audio=r.audio;if(r.transcript)fill(r.transcript);else{box.classList.remove('hidden');val.textContent='No transcript captured.';warn.textContent=r.error?('Reason: '+r.error):'Speech recognition ended without text.';}btn.classList.remove('recording');btn.textContent='Audio saved';}
    btn.onclick=start;state.finish=finish;return state;
  }

  addP=function(k,shared){
    const label=k==='guys'?'Guy':'Girl',txt=String(shared?.text||''),sharedImage=shared?.profileImage||shared?.photo||null;
    const media=profileHeader('Add '+label,sharedImage,sharedImage);document.getElementById('sheet').insertAdjacentHTML('beforeend',`<div class="pmGrid"><label>Name<input id="v19Name" placeholder="Name (optional)"></label><label>Age<input id="v19Age" type="number" min="18" max="99" inputmode="numeric" value="${esc(deriveAge(txt))}"></label></div><label>Profile text<textarea id="v19Profile" placeholder="Paste, type, or record the profile">${esc(txt)}</textarea></label><div class="v19Source"><label>Sender name<input id="v19Sender" placeholder="Who sent/told you?"></label><label>Sender phone<input id="v19SenderPhone" type="tel" inputmode="tel" placeholder="Phone"></label></div>`);
    const audioState=bindProfileAudio(null,'');
    fixedForm('Save '+label,async()=>{if(audioState.manager)await audioState.finish();let name=document.getElementById('v19Name').value.trim(),age=document.getElementById('v19Age').value.trim(),text=document.getElementById('v19Profile').value.trim();if(age&&(+age<18||+age>99))return alert('Check the age.');if(!text&&!media.full&&!audioState.audio)return alert('Add profile text, an audio profile, or a photo/screenshot.');if(!name)name=text?(text.split(/\r?\n/).map(s=>s.trim()).find(Boolean)||label+' profile').slice(0,70):(label+' profile');const sn=document.getElementById('v19Sender').value.trim(),sp=document.getElementById('v19SenderPhone').value.trim();data[k].unshift({id:Date.now(),name,age:age||deriveAge(text),text,profileImage:media.full,photo:media.thumb,profileMediaFull:media.full,profileMediaThumb:media.thumb,profileAudio:audioState.audio,profileAudioText:audioState.text,source:sn,sourceName:sn,sourcePhone:sp,activities:[]});await save();await del('inbox','pending');close();renderP(k);show(k);},close);
  };

  function editP19(k,id){const x=item(k,id);if(!x)return;const media=profileHeader('Edit '+(k==='guys'?'Guy':'Girl'),fullMedia(x),thumbMedia(x));document.getElementById('sheet').insertAdjacentHTML('beforeend',`<div class="pmGrid"><label>Name<input id="v19Name" value="${esc(x.name||'')}"></label><label>Age<input id="v19Age" type="number" min="18" max="99" inputmode="numeric" value="${esc(x.age||deriveAge(x.text))}"></label></div><label>Profile text<textarea id="v19Profile">${esc(x.text||'')}</textarea></label><div class="v19Source"><label>Sender name<input id="v19Sender" value="${esc(senderName(x))}"></label><label>Sender phone<input id="v19SenderPhone" type="tel" inputmode="tel" value="${esc(senderPhone(x))}"></label></div>`);const audioState=bindProfileAudio(x.profileAudio,x.profileAudioText||'');fixedForm('Save Changes',async()=>{if(audioState.manager)await audioState.finish();x.name=document.getElementById('v19Name').value.trim()||x.name||((k==='guys'?'Guy':'Girl')+' profile');x.age=document.getElementById('v19Age').value.trim();x.text=document.getElementById('v19Profile').value.trim();x.profileImage=media.full;x.photo=media.thumb;x.profileMediaFull=media.full;x.profileMediaThumb=media.thumb;if(audioState.audio)x.profileAudio=audioState.audio;if(audioState.text)x.profileAudioText=audioState.text;x.sourceName=document.getElementById('v19Sender').value.trim();x.sourcePhone=document.getElementById('v19SenderPhone').value.trim();x.source=x.sourceName;await save();renderP(k);openP(k,id);},()=>openP(k,id));}

  openP=function(k,id){activeProfile={k,id};const x=item(k,id);if(!x)return;revokePrefix('detail:');const media=thumbMedia(x),src=media?setObjectUrl('detail:'+k+':'+id,media):'';open(`<div class="v19Head"><h2>${esc(x.name||'Unnamed profile')}</h2>${media?`<div id="v19DetailMedia" class="v19Media"><img src="${src}" alt="Photo or screenshot"></div>`:''}</div>${x.age||senderName(x)||senderPhone(x)?`<div class="pmMeta" style="margin:6px 0 9px">${x.age?`<span class="pmPill">Age ${esc(x.age)}</span>`:''}${senderName(x)?`<span class="pmPill">Sent by ${esc(senderName(x))}</span>`:''}${senderPhone(x)?`<span class="pmPill">${esc(senderPhone(x))}</span>`:''}</div>`:''}${x.text?`<div class="card"><div class="profileText">${esc(x.text)}</div></div>`:''}${x.profileAudio?`<div class="v19ProfileAudio"><div class="small">Audio profile</div><audio controls src="${setObjectUrl('profileAudio:'+k+':'+id,x.profileAudio)}"></audio><div class="v19AudioText"><span class="small">Audio profile text</span>${esc(x.profileAudioText||x.text||'No transcript captured.')}</div></div>`:''}<button id="v19EditProfile" class="secondary full">Edit Profile</button><div class="sectionTitle">What I did to help / notes</div>${acts(x)}`);if(media)document.getElementById('v19DetailMedia').onclick=()=>openFull(fullMedia(x));document.getElementById('v19EditProfile').onclick=()=>editP19(k,id);fixedDetail(()=>note(k,id),()=>audio(k,id),close);};

  function audioEventHtml(a){const t=String(a.transcript||a.text||'').trim();return `<div class="event"><div class="eventTop"><span>Audio note</span><span>${esc(a.ts||'')}</span></div><audio controls src="${url(a.audio)}"></audio><div class="pmAudioTranscript"><span class="small">Transcript</span>${esc(t||('Transcription unavailable'+(a.transcriptionError?': '+a.transcriptionError:'.')))}</div></div>`;}
  acts=function(x){if(!x.activities?.length)return'<div class="empty">No contact history yet.</div>';return[...x.activities].reverse().map(a=>{if(a.type==='audio')return audioEventHtml(a);if(a.type==='wa-out')return `<div class="event waOut"><div class="eventTop"><span>You → WhatsApp</span><span>${esc(a.ts||'')}</span></div><div class="profileText">${esc(a.text||'')}</div></div>`;if(a.type==='sms-out')return `<div class="event"><div class="eventTop"><span>You → SMS</span><span>${esc(a.ts||'')}</span></div><div class="profileText">${esc(a.text||'')}</div></div>`;if(a.type==='email-out')return `<div class="event"><div class="eventTop"><span>You → Email</span><span>${esc(a.ts||'')}</span></div><div class="profileText">${esc(a.text||'')}</div></div>`;return `<div class="event"><div class="eventTop"><span>${esc(a.type==='action'?(a.action||'Action'):'Note')}</span><span>${esc(a.ts||'')}</span></div><div class="profileText">${esc(a.text||'')}</div></div>`;}).join('');};
  last=function(x){if(!x.activities?.length)return'No notes yet';const a=x.activities[x.activities.length-1];if(a.type==='audio')return'Audio note'+(a.transcript?' • '+a.transcript.slice(0,55):'')+' • '+(a.ts||'');return (a.text||a.action||'Activity')+' • '+(a.ts||'');};

  audio=async function(k,id){const x=item(k,id);if(!x||activeAudio)return;const b=document.getElementById('v19Audio');if(b)b.textContent='Starting…';const m=new AudioManager(()=>{},s=>{if(b&&s!=='Listening')b.textContent='Stop audio';});activeAudio=m;try{await m.start();if(b){b.textContent='Stop audio';b.onclick=async()=>{b.textContent='Finishing…';const r=await m.stop();activeAudio=null;x.activities=x.activities||[];x.activities.push({id:Date.now(),type:'audio',audio:r.audio,transcript:r.transcript,text:r.transcript,transcriptionError:r.error,ts:stamp()});await save();k==='shadchanim'?openS(id):openP(k,id);render();};}}catch(e){activeAudio=null;if(b)b.textContent='Audio note';alert('Microphone permission is required.');}};

  function normalizePhone(p){let d=String(p||'').replace(/\D/g,'');if(d.startsWith('00'))d=d.slice(2);if(d.startsWith('0'))d='972'+d.slice(1);return d;}
  function editShadchan19(id){const x=data.shadchanim.find(z=>z.id===id);if(!x)return;open(`<h2>Edit Shadchan</h2><label>Name<input id="v19SName" value="${esc(x.name||'')}"></label><label>Phone / SMS<input id="v19SPhone" type="tel" inputmode="tel" value="${esc(x.phone||'')}"></label><label>Email<input id="v19SEmail" type="email" value="${esc(x.email||'')}"></label><label>Tags<input id="v19STags" value="${esc(x.tags||'')}"></label>`);fixedForm('Save',async()=>{const n=document.getElementById('v19SName').value.trim();if(!n)return alert('Enter a name.');x.name=n;x.phone=document.getElementById('v19SPhone').value.trim();x.email=document.getElementById('v19SEmail').value.trim();x.tags=document.getElementById('v19STags').value.trim();await save();renderS();openS(id);},()=>openS(id));}
  function compose(x,channel){if((channel==='SMS'||channel==='WhatsApp')&&!x.phone)return alert('Add a phone number first.');if(channel==='Email'&&!x.email)return alert('Add an email first.');open(`<h2>${esc(channel)} message</h2><div class="small">PeerMatch saves the message first, then opens ${esc(channel)}.</div><label>Message<textarea id="v19Message" class="v19Compose" placeholder="Type your message…"></textarea></label>`);fixedForm('Continue',async()=>{const t=document.getElementById('v19Message').value.trim();if(!t)return alert('Type a message first.');let target='';if(channel==='WhatsApp'){const d=normalizePhone(x.phone);x.activities.push({id:Date.now(),type:'wa-out',text:t,ts:stamp()});target='https://wa.me/'+d+'?text='+encodeURIComponent(t);}else if(channel==='SMS'){x.activities.push({id:Date.now(),type:'sms-out',text:t,ts:stamp()});target='sms:'+x.phone+'?body='+encodeURIComponent(t);}else{x.activities.push({id:Date.now(),type:'email-out',text:t,ts:stamp()});target='mailto:'+encodeURIComponent(x.email)+'?body='+encodeURIComponent(t);}await save();renderS();location.href=target;},()=>openS(x.id));}
  openS=function(id){const x=data.shadchanim.find(z=>z.id===id);if(!x)return;open(`<div class="v19ShadHead"><h2>${esc(x.name||'Unnamed shadchan')}</h2><button id="v19EditShad" class="v19Edit">Edit</button></div><div class="v19Contact"><button id="v19Call" class="primary">Call</button><button id="v19Sms" class="secondary">SMS</button><button id="v19Wa" class="green">WhatsApp</button><button id="v19Email" class="secondary">Email</button></div><div class="sectionTitle">Conversation / contact history</div>${acts(x)}`);document.getElementById('v19EditShad').onclick=()=>editShadchan19(id);document.getElementById('v19Call').onclick=async()=>{if(!x.phone)return alert('Add a phone number first.');x.activities.push({id:Date.now(),type:'action',action:'Call',text:'Call opened',ts:stamp()});await save();location.href='tel:'+x.phone;};document.getElementById('v19Sms').onclick=()=>compose(x,'SMS');document.getElementById('v19Wa').onclick=()=>compose(x,'WhatsApp');document.getElementById('v19Email').onclick=()=>compose(x,'Email');fixedDetail(()=>note('shadchanim',id),()=>audio('shadchanim',id),close);};

  // Make current list thumbnails use the lightweight thumbnail blob without replacing v11 selection behavior.
  const priorRenderP=renderP;
  renderP=function(k){(data[k]||[]).forEach(x=>{if(x.profileMediaThumb&&!x.photo)x.photo=x.profileMediaThumb;});return priorRenderP(k);};

  // Rebind top-level Add buttons after replacing addP/openS/audio.
  setTimeout(()=>{try{document.getElementById('addGuy').onclick=()=>addP('guys');document.getElementById('addGirl').onclick=()=>addP('girls');document.getElementById('shadchanSearch').oninput=renderS;render();}catch(e){console.warn('PeerMatch v19 init',e)}},50);
})();
