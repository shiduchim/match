/* PeerMatch v21 audio: recorded audio is mandatory, transcript stays separate.
   Recognition starts first (Guided Voice style), then MediaRecorder starts after
   recognition has had a chance to establish its mic session.
*/
(function(){
  document.documentElement.dataset.peerMatchVersion='21';
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  let activeProfile=null;
  let activeCapture=null;

  const style=document.createElement('style');
  style.textContent=`
    .v21AudioText{margin-top:6px;padding:8px 10px;border:1px solid var(--line);border-radius:11px;background:#fff;font-size:13px;line-height:1.42;white-space:pre-wrap}
    .v21AudioStatus{margin-top:5px;font-size:11px;color:var(--muted);line-height:1.3}
    .v21AudioStatus.error{color:#8a3c2c}
  `;
  document.head.appendChild(style);

  function kindFromHeading(){const h=document.querySelector('#sheet h2')?.textContent||'';if(/Guy/i.test(h))return'guys';if(/Girl/i.test(h))return'girls';return null;}
  function box(){return document.getElementById('v19AudioText');}
  function valueBox(){return document.getElementById('v19AudioValue');}
  function warnBox(){return document.getElementById('v19AudioWarn');}

  class CombinedCapture{
    constructor(onText,onStatus){
      this.onText=onText||(()=>{});this.onStatus=onStatus||(()=>{});
      this.finalText='';this.interimText='';this.error='';this.parts=[];
      this.speechEnded=false;this.speechStarted=false;this.audioStarted=false;
    }
    current(){return [this.finalText,this.interimText].filter(Boolean).join(' ').replace(/\s+/g,' ').trim();}
    setupSpeech(){
      if(!SR)throw new Error('Speech recognition is not supported by this browser.');
      const s=this.speech=new SR();
      s.lang='en-US';s.continuous=true;s.interimResults=true;s.maxAlternatives=1;
      const started=()=>{if(!this.speechStarted){this.speechStarted=true;if(this._startResolve)this._startResolve();}this.onStatus('Listening');};
      s.onstart=started;s.onaudiostart=started;s.onspeechstart=started;
      s.onresult=e=>{
        let interim='';
        for(let i=e.resultIndex;i<e.results.length;i++){
          const t=(e.results[i]?.[0]?.transcript||'').trim();if(!t)continue;
          if(e.results[i].isFinal)this.finalText+=(this.finalText?' ':'')+t;
          else interim+=(interim?' ':'')+t;
        }
        this.interimText=interim;this.onText(this.current());
      };
      s.onerror=e=>{this.error=e.error||'speech recognition error';this.onStatus('Transcription: '+this.error,true);};
      s.onnomatch=()=>this.onStatus('Speech was heard but not recognized.',true);
      s.onend=()=>{this.speechEnded=true;if(this._endResolve)this._endResolve();};
      s.start();
    }
    waitSpeechStart(ms=700){
      if(this.speechStarted)return Promise.resolve();
      return new Promise(resolve=>{this._startResolve=resolve;setTimeout(resolve,ms);});
    }
    async startRecorder(){
      // Keep the recording path as simple as possible on Android Chrome.
      this.stream=await navigator.mediaDevices.getUserMedia({audio:true});
      this.recorder=new MediaRecorder(this.stream);
      this.recorder.ondataavailable=e=>{if(e.data?.size)this.parts.push(e.data);};
      this.recorder.onerror=e=>{this.recordingError=e.error?.message||e.error?.name||'recording error';this.onStatus('Recording error: '+this.recordingError,true);};
      this.recorder.start(500);this.audioStarted=true;this.onStatus(this.error?('Recording; transcription: '+this.error):'Recording + transcription');
    }
    async start(){
      this.setupSpeech();
      await this.waitSpeechStart();
      // Recording is mandatory, so fail the whole start if MediaRecorder cannot start.
      await this.startRecorder();
      return this;
    }
    waitSpeechEnd(ms=1200){if(!this.speech||this.speechEnded)return Promise.resolve();return new Promise(resolve=>{this._endResolve=resolve;setTimeout(resolve,ms);});}
    stopRecorder(){
      return new Promise((resolve,reject)=>{
        if(!this.recorder)return reject(new Error('Recording did not start.'));
        if(this.recorder.state==='inactive')return resolve(new Blob(this.parts,{type:this.recorder.mimeType||'audio/webm'}));
        this.recorder.onstop=()=>resolve(new Blob(this.parts,{type:this.recorder.mimeType||'audio/webm'}));
        this.recorder.onerror=e=>reject(e.error||new Error('Recording failed.'));
        try{this.recorder.requestData();}catch(e){}
        this.recorder.stop();
      });
    }
    async stop(){
      try{this.speech?.stop();}catch(e){}
      await this.waitSpeechEnd();
      const audio=await this.stopRecorder();
      this.stream?.getTracks().forEach(t=>t.stop());
      return{audio,transcript:this.current(),error:this.error,recordingError:this.recordingError||''};
    }
  }

  const priorOpenP=window.openP;
  window.openP=openP=function(k,id){activeProfile={k,id};return priorOpenP(k,id);};

  function bindAudioProfile(){
    const old=document.getElementById('v19ProfileAudio'),saveBtn=document.getElementById('v19Save');
    if(!old||!saveBtn||old.dataset.v21Bound==='1')return;
    const btn=old.cloneNode(true);old.replaceWith(btn);btn.dataset.v21Bound='1';
    const heading=document.querySelector('#sheet h2')?.textContent||'';
    const k=kindFromHeading(),isEdit=/^Edit\b/i.test(heading),beforeCount=k?(data[k]?.length||0):0;
    const editId=isEdit&&activeProfile?.k===k?activeProfile.id:null;
    let capture=null,audioBlob=null,transcript='';
    const existing=isEdit&&editId!=null?data[k]?.find(x=>x.id===editId):null;
    if(existing){audioBlob=existing.profileAudio||null;transcript=String(existing.profileAudioText||'');}

    const tb=box(),vb=valueBox(),wb=warnBox();
    const showText=t=>{transcript=t||'';if(tb)tb.classList.remove('hidden');if(vb)vb.textContent=transcript||'Listening…';};
    const showStatus=(s,isErr)=>{if(wb){wb.textContent=s==='Listening'?'':s;wb.classList.toggle('error',!!isErr);}};
    if(transcript)showText(transcript);
    btn.textContent=audioBlob?'Replace audio':'Audio profile';

    async function finish(){
      if(!capture)return;
      btn.textContent='Finishing…';
      const c=capture;capture=null;activeCapture=null;
      try{
        const r=await c.stop();audioBlob=r.audio;if(r.transcript)showText(r.transcript);
        else{if(tb)tb.classList.remove('hidden');if(vb)vb.textContent='No transcript captured.';showStatus(r.error?('Reason: '+r.error):'Recording saved, but no speech text was recognized.',true);}
        btn.classList.remove('recording');btn.textContent='Audio saved';
      }catch(e){btn.classList.remove('recording');btn.textContent='Audio profile';showStatus('Recording could not be saved: '+(e.message||e),true);alert('The audio recording could not be saved. Please record again.');audioBlob=null;}
    }

    btn.onclick=async()=>{
      if(capture){await finish();return;}
      if(activeCapture)return;
      if(tb)tb.classList.remove('hidden');if(vb)vb.textContent=transcript||'Listening…';showStatus('',false);
      const c=new CombinedCapture(showText,showStatus);capture=c;activeCapture=c;
      try{await c.start();btn.classList.add('recording');btn.textContent='Stop audio';}
      catch(e){capture=null;activeCapture=null;try{c.stream?.getTracks().forEach(t=>t.stop());c.speech?.abort();}catch(_){}showStatus('Audio could not start: '+(e.message||e),true);alert('Audio recording could not start.');}
    };

    saveBtn.addEventListener('click',async e=>{
      if(capture){e.preventDefault();e.stopImmediatePropagation();await finish();saveBtn.click();return;}
      if(!audioBlob&&!transcript)return;
      setTimeout(async()=>{
        try{
          let target=null;
          if(isEdit&&editId!=null)target=data[k]?.find(x=>x.id===editId)||null;
          else if(k&&(data[k]?.length||0)>beforeCount)target=data[k][0];
          if(!target)return;
          if(audioBlob)target.profileAudio=audioBlob;
          target.profileAudioText=transcript;
          // Important: do NOT copy audio transcript into normal profile text.
          await save();
        }catch(err){console.warn('PeerMatch v21 audio profile save',err);}
      },250);
    },true);
  }

  // Every new note saves BOTH audio and the best transcript available.
  window.audio=audio=async function(k,id){
    const x=item(k,id);if(!x||activeCapture)return;
    const b=document.getElementById('v19Audio');if(b)b.textContent='Starting…';
    let live='';
    const c=new CombinedCapture(t=>{live=t;if(b)b.textContent='Stop audio';},(s,isErr)=>{if(b&&isErr)b.textContent='Stop audio';});
    activeCapture=c;
    try{
      await c.start();
      if(b){b.textContent='Stop audio';b.onclick=async()=>{
        b.textContent='Finishing…';
        try{
          const r=await c.stop();activeCapture=null;
          x.activities=x.activities||[];x.activities.push({id:Date.now(),type:'audio',audio:r.audio,transcript:r.transcript||live,text:r.transcript||live,transcriptionError:r.error,ts:stamp()});
          await save();k==='shadchanim'?openS(id):openP(k,id);render();
        }catch(e){activeCapture=null;b.textContent='Audio note';alert('The audio recording could not be saved. Please record again.');}
      };}
    }catch(e){activeCapture=null;if(b)b.textContent='Audio note';try{c.stream?.getTracks().forEach(t=>t.stop());c.speech?.abort();}catch(_){}alert('Audio recording could not start.');}
  };

  // Keep audio note rendering from v19: player first, transcript directly below it.
  window.acts=acts=function(x){
    if(!x.activities?.length)return'<div class="empty">No contact history yet.</div>';
    return [...x.activities].reverse().map(a=>{
      if(a.type==='audio'){
        const t=String(a.transcript||a.text||'').trim();
        return `<div class="event"><div class="eventTop"><span>Audio note</span><span>${esc(a.ts||'')}</span></div>${a.audio?`<audio controls src="${url(a.audio)}"></audio>`:'<div class="small">Audio unavailable for this older note.</div>'}<div class="pmAudioTranscript"><span class="small">Transcript</span>${esc(t||('No transcript captured'+(a.transcriptionError?': '+a.transcriptionError:'.')))}</div></div>`;
      }
      if(a.type==='wa-out')return `<div class="event waOut"><div class="eventTop"><span>You → WhatsApp</span><span>${esc(a.ts||'')}</span></div><div class="profileText">${esc(a.text||'')}</div></div>`;
      if(a.type==='wa-in')return `<div class="event waIn"><div class="eventTop"><span>WhatsApp → You</span><span>${esc(a.ts||'')}</span></div><div class="profileText">${esc(a.text||'')}</div></div>`;
      if(a.type==='sms-out')return `<div class="event"><div class="eventTop"><span>You → SMS</span><span>${esc(a.ts||'')}</span></div><div class="profileText">${esc(a.text||'')}</div></div>`;
      if(a.type==='email-out')return `<div class="event"><div class="eventTop"><span>You → Email</span><span>${esc(a.ts||'')}</span></div><div class="profileText">${esc(a.text||'')}</div></div>`;
      return `<div class="event"><div class="eventTop"><span>${esc(a.type==='action'?(a.action||'Action'):'Note')}</span><span>${esc(a.ts||'')}</span></div><div class="profileText">${esc(a.text||'')}</div></div>`;
    }).join('');
  };

  function scan(){bindAudioProfile();}
  new MutationObserver(scan).observe(document.body,{childList:true,subtree:true});setInterval(scan,350);scan();
})();
