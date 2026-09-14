/* PeerMatch v23: record first, transcribe the saved Blob server-side.
   No Web Speech API. Audio is always preserved even if transcription fails.
*/
(function(){
  document.documentElement.dataset.peerMatchVersion='23';
  const TRANSCRIBE_URL='https://peermatch-8fl6.hatchable.site/api/transcribe';
  let activeProfile=null;
  let activeCapture=null;

  const style=document.createElement('style');
  style.textContent=`
    .v23Status{margin-top:5px;font-size:11px;color:var(--muted);line-height:1.35}
    .v23Status.error{color:#8a3c2c}
    .v23Retry{margin-top:6px;padding:6px 9px;border-radius:8px;font-size:11px}
  `;
  document.head.appendChild(style);

  function kindFromHeading(){
    const h=(document.querySelector('#sheet h2')?.textContent||'').trim();
    if(/Guy/i.test(h))return'guys';
    if(/Girl/i.test(h))return'girls';
    return null;
  }
  function profileBox(){return document.getElementById('v19AudioText');}
  function profileValue(){return document.getElementById('v19AudioValue');}
  function profileWarn(){return document.getElementById('v19AudioWarn');}

  function audioFilename(blob){
    const t=String(blob?.type||'').toLowerCase();
    if(t.includes('ogg'))return'audio.ogg';
    if(t.includes('mp4')||t.includes('m4a'))return'audio.m4a';
    if(t.includes('wav'))return'audio.wav';
    return'audio.webm';
  }

  async function transcribeBlob(blob){
    if(!blob||!blob.size)throw new Error('No recording available to transcribe.');
    if(!navigator.onLine)throw new Error('Offline — transcript will stay pending.');
    const fd=new FormData();
    fd.append('audio',blob,audioFilename(blob));
    let res;
    try{
      res=await fetch(TRANSCRIBE_URL,{method:'POST',body:fd,cache:'no-store'});
    }catch(e){
      throw new Error('Could not reach transcription service.');
    }
    const ct=String(res.headers.get('content-type')||'');
    let body={};
    if(ct.includes('application/json')){
      try{body=await res.json();}catch(e){}
    }else{
      const txt=await res.text().catch(()=> '');
      if(res.redirected||/sign.?in|login/i.test(txt))throw new Error('Transcription service needs setup.');
      body={error:txt.slice(0,160)};
    }
    if(!res.ok)throw new Error(body.error||body.detail||('Transcription failed ('+res.status+').'));
    return String(body.text||'').trim();
  }

  class RecorderOnly{
    constructor(){this.parts=[];this.error='';}
    async start(){
      this.stream=await navigator.mediaDevices.getUserMedia({audio:true});
      this.recorder=new MediaRecorder(this.stream);
      this.recorder.ondataavailable=e=>{if(e.data?.size)this.parts.push(e.data);};
      this.recorder.onerror=e=>{this.error=e.error?.message||e.error?.name||'Recording error';};
      this.recorder.start(500);
    }
    stop(){
      return new Promise((resolve,reject)=>{
        if(!this.recorder)return reject(new Error('Recording did not start.'));
        const done=()=>{
          this.stream?.getTracks().forEach(t=>t.stop());
          const blob=new Blob(this.parts,{type:this.recorder.mimeType||'audio/webm'});
          if(!blob.size)return reject(new Error('Recording was empty.'));
          resolve(blob);
        };
        if(this.recorder.state==='inactive')return done();
        this.recorder.onstop=done;
        this.recorder.onerror=e=>{
          this.stream?.getTracks().forEach(t=>t.stop());
          reject(e.error||new Error('Recording failed.'));
        };
        try{this.recorder.requestData();}catch(e){}
        this.recorder.stop();
      });
    }
    abort(){
      try{if(this.recorder&&this.recorder.state!=='inactive')this.recorder.stop();}catch(e){}
      this.stream?.getTracks().forEach(t=>t.stop());
    }
  }

  async function persist(){try{await save();}catch(e){console.warn('PeerMatch v23 save',e);}}

  async function transcribeProfile(k,id){
    const x=data[k]?.find(z=>z.id===id);
    if(!x?.profileAudio)return;
    x.profileAudioTranscriptionStatus='in-progress';
    x.profileAudioTranscriptionError='';
    x.profileAudioTranscriptionAttempts=(x.profileAudioTranscriptionAttempts||0)+1;
    await persist();
    decorateProfileDetail(k,id);
    try{
      const text=await transcribeBlob(x.profileAudio);
      x.profileAudioText=text;
      x.profileAudioTranscriptionStatus='done';
      x.profileAudioTranscriptionError='';
    }catch(e){
      x.profileAudioTranscriptionStatus='error';
      x.profileAudioTranscriptionError=e.message||String(e);
    }
    await persist();
    decorateProfileDetail(k,id);
    try{renderP(k);}catch(e){}
  }

  async function transcribeNote(k,id,noteId){
    const x=item(k,id);if(!x)return;
    const a=x.activities?.find(z=>z.id===noteId);if(!a?.audio)return;
    a.transcriptionStatus='in-progress';
    a.transcriptionError='';
    a.transcriptionAttempts=(a.transcriptionAttempts||0)+1;
    await persist();
    try{
      const text=await transcribeBlob(a.audio);
      a.transcript=text;
      a.text=text;
      a.transcriptionStatus='done';
      a.transcriptionError='';
    }catch(e){
      a.transcriptionStatus='error';
      a.transcriptionError=e.message||String(e);
    }
    await persist();
    try{k==='shadchanim'?openS(id):openP(k,id);}catch(e){}
    try{render();}catch(e){}
  }

  window.pmRetryAudioNote=(k,id,noteId)=>transcribeNote(k,id,noteId);
  window.pmRetryProfileAudio=(k,id)=>transcribeProfile(k,id);

  const priorOpenP=window.openP;
  window.openP=openP=function(k,id){
    activeProfile={k,id};
    const r=priorOpenP(k,id);
    setTimeout(()=>decorateProfileDetail(k,id),30);
    return r;
  };

  function decorateProfileDetail(k,id){
    const x=data[k]?.find(z=>z.id===id),sheet=document.getElementById('sheet');
    if(!x||!sheet||!x.profileAudio)return;
    let wrap=sheet.querySelector('.v19ProfileAudio');
    if(!wrap){
      wrap=document.createElement('div');
      wrap.className='v19ProfileAudio';
      const edit=document.getElementById('v19EditProfile');
      if(edit)edit.insertAdjacentElement('beforebegin',wrap);else sheet.appendChild(wrap);
    }
    const audioUrl=url(x.profileAudio);
    const status=x.profileAudioTranscriptionStatus||'';
    const text=String(x.profileAudioText||'').trim();
    let transcriptHtml='';
    if(text){
      transcriptHtml=`<div class="v19AudioText"><span class="small">Audio profile text</span>${esc(text)}</div>`;
    }else if(status==='in-progress'||status==='pending'){
      transcriptHtml='<div class="v19AudioText"><span class="small">Audio profile text</span>Transcribing…</div>';
    }else{
      const msg=status==='error'?(x.profileAudioTranscriptionError||'Transcription failed.'):'No transcript yet.';
      transcriptHtml=`<div class="v19AudioText"><span class="small">Audio profile text</span>${esc(msg)}<br><button type="button" class="secondary v23Retry" id="v23ProfileRetry">Retry transcription</button></div>`;
    }
    wrap.innerHTML=`<div class="small">Audio profile</div><audio controls src="${audioUrl}"></audio>${transcriptHtml}`;
    const retry=document.getElementById('v23ProfileRetry');
    if(retry)retry.onclick=()=>transcribeProfile(k,id);
  }

  function bindAudioProfile(){
    const old=document.getElementById('v19ProfileAudio'),saveBtn=document.getElementById('v19Save');
    if(!old||!saveBtn||old.dataset.v23Bound==='1')return;
    const btn=old.cloneNode(true);old.replaceWith(btn);btn.dataset.v23Bound='1';
    const heading=(document.querySelector('#sheet h2')?.textContent||'').trim();
    const k=kindFromHeading(),isEdit=/^Edit\b/i.test(heading),beforeCount=k?(data[k]?.length||0):0;
    const editId=isEdit&&activeProfile?.k===k?activeProfile.id:null;
    const existing=isEdit&&editId!=null?data[k]?.find(x=>x.id===editId):null;
    let audioBlob=existing?.profileAudio||null;
    let transcript=String(existing?.profileAudioText||'');
    let transStatus=existing?.profileAudioTranscriptionStatus||(transcript?'done':(audioBlob?'pending':''));
    let transError=existing?.profileAudioTranscriptionError||'';
    let capture=null;

    const box=profileBox(),val=profileValue(),warn=profileWarn();
    function show(){
      if(!box)return;
      if(audioBlob||transcript||transStatus){box.classList.remove('hidden');}
      if(val){
        if(transcript)val.textContent=transcript;
        else if(transStatus==='in-progress'||transStatus==='pending')val.textContent='Transcript pending';
        else if(transStatus==='error')val.textContent='Transcript unavailable';
        else val.textContent='';
      }
      if(warn){warn.textContent=transError;warn.classList.toggle('error',!!transError);}
    }
    show();
    btn.textContent=audioBlob?'Replace audio':'Audio profile';

    async function finish(){
      if(!capture)return;
      btn.textContent='Saving audio…';
      const c=capture;capture=null;activeCapture=null;
      try{
        audioBlob=await c.stop();
        transcript='';transStatus='pending';transError='';
        btn.classList.remove('recording');btn.textContent='Audio saved';show();
      }catch(e){
        btn.classList.remove('recording');btn.textContent=audioBlob?'Replace audio':'Audio profile';
        transError='Recording could not be saved: '+(e.message||e);show();
        alert('The audio recording could not be saved. Please record again.');
      }
    }

    btn.onclick=async()=>{
      if(capture){await finish();return;}
      if(activeCapture)return;
      const c=new RecorderOnly();capture=c;activeCapture=c;
      try{
        await c.start();
        btn.classList.add('recording');btn.textContent='Stop audio';
        if(warn){warn.textContent='Recording…';warn.classList.remove('error');}
      }catch(e){
        capture=null;activeCapture=null;c.abort();
        if(warn){warn.textContent='Microphone could not start: '+(e.message||e);warn.classList.add('error');}
      }
    };

    saveBtn.addEventListener('click',async e=>{
      if(capture){
        e.preventDefault();e.stopImmediatePropagation();
        await finish();
        saveBtn.click();
        return;
      }
      if(!audioBlob)return;
      setTimeout(async()=>{
        try{
          let target=null;
          if(isEdit&&editId!=null)target=data[k]?.find(x=>x.id===editId)||null;
          else if(k&&(data[k]?.length||0)>beforeCount)target=data[k][0];
          if(!target)return;
          target.profileAudio=audioBlob;
          target.profileAudioText=transcript;
          target.profileAudioTranscriptionStatus=transcript?'done':'pending';
          target.profileAudioTranscriptionError=transError;
          target.profileAudioTranscriptionAttempts=target.profileAudioTranscriptionAttempts||0;
          await persist();
          if(!target.profileAudioText)transcribeProfile(k,target.id);
        }catch(err){console.warn('PeerMatch v23 profile audio save',err);}
      },300);
    },true);
  }

  window.audio=audio=async function(k,id){
    const x=item(k,id);if(!x||activeCapture)return;
    const b=document.getElementById('v19Audio');if(b)b.textContent='Starting…';
    const c=new RecorderOnly();activeCapture=c;
    try{
      await c.start();
      if(b){
        b.textContent='Stop audio';
        b.onclick=async()=>{
          b.textContent='Saving audio…';
          try{
            const blob=await c.stop();activeCapture=null;
            const note={
              id:Date.now(),type:'audio',audio:blob,transcript:'',text:'',ts:stamp(),
              transcriptionStatus:'pending',transcriptionError:'',transcriptionAttempts:0,
              ownerKind:k,ownerId:id
            };
            x.activities=x.activities||[];x.activities.push(note);
            await persist();
            try{k==='shadchanim'?openS(id):openP(k,id);}catch(e){}
            try{render();}catch(e){}
            transcribeNote(k,id,note.id);
          }catch(e){
            activeCapture=null;b.textContent='Audio note';
            alert('The audio recording could not be saved. Please record again.');
          }
        };
      }
    }catch(e){
      activeCapture=null;c.abort();if(b)b.textContent='Audio note';
      alert('Audio recording could not start.');
    }
  };

  window.acts=acts=function(x){
    if(!x.activities?.length)return'<div class="empty">No contact history yet.</div>';
    return [...x.activities].reverse().map(a=>{
      if(a.type==='audio'){
        const t=String(a.transcript||a.text||'').trim();
        const st=a.transcriptionStatus||'';
        let tr='';
        if(t)tr=esc(t);
        else if(st==='in-progress'||st==='pending')tr='Transcribing…';
        else tr=esc(a.transcriptionError||'No transcript yet.');
        let retry='';
        if(a.audio&&!t&&st!=='in-progress'&&a.ownerKind&&a.ownerId!=null){
          retry=`<br><button type="button" class="secondary v23Retry" onclick="window.pmRetryAudioNote('${esc(a.ownerKind)}',${Number(a.ownerId)},${Number(a.id)})">Retry transcription</button>`;
        }
        return `<div class="event"><div class="eventTop"><span>Audio note</span><span>${esc(a.ts||'')}</span></div>${a.audio?`<audio controls src="${url(a.audio)}"></audio>`:'<div class="small">Audio unavailable.</div>'}<div class="pmAudioTranscript"><span class="small">Transcript</span>${tr}${retry}</div></div>`;
      }
      if(a.type==='wa-out')return `<div class="event waOut"><div class="eventTop"><span>You → WhatsApp</span><span>${esc(a.ts||'')}</span></div><div class="profileText">${esc(a.text||'')}</div></div>`;
      if(a.type==='wa-in')return `<div class="event waIn"><div class="eventTop"><span>WhatsApp → You</span><span>${esc(a.ts||'')}</span></div><div class="profileText">${esc(a.text||'')}</div></div>`;
      if(a.type==='sms-out')return `<div class="event"><div class="eventTop"><span>You → SMS</span><span>${esc(a.ts||'')}</span></div><div class="profileText">${esc(a.text||'')}</div></div>`;
      if(a.type==='email-out')return `<div class="event"><div class="eventTop"><span>You → Email</span><span>${esc(a.ts||'')}</span></div><div class="profileText">${esc(a.text||'')}</div></div>`;
      return `<div class="event"><div class="eventTop"><span>${esc(a.type==='action'?(a.action||'Action'):'Note')}</span><span>${esc(a.ts||'')}</span></div><div class="profileText">${esc(a.text||'')}</div></div>`;
    }).join('');
  };

  window.addEventListener('online',()=>{
    try{
      for(const k of ['guys','girls'])for(const x of (data[k]||[])){
        if(x.profileAudio&&!x.profileAudioText&&['pending','error'].includes(x.profileAudioTranscriptionStatus||'pending'))transcribeProfile(k,x.id);
      }
      for(const k of ['guys','girls','shadchanim'])for(const x of (data[k]||[]))for(const a of (x.activities||[])){
        if(a.type==='audio'&&a.audio&&!a.transcript&&['pending','error'].includes(a.transcriptionStatus||'pending'))transcribeNote(k,x.id,a.id);
      }
    }catch(e){}
  });

  function scan(){bindAudioProfile();}
  new MutationObserver(scan).observe(document.body,{childList:true,subtree:true});
  setInterval(scan,350);
  scan();
})();
