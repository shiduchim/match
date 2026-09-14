/* PeerMatch v20 audio: restore the proven Guided Voice principle.
   SpeechRecognition is the primary/only live mic owner for new voice capture.
   This avoids Android Chrome MediaRecorder/SpeechRecognition microphone contention.
*/
(function(){
  document.documentElement.dataset.peerMatchVersion='20';
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  let activeProfile=null;
  let activeVoice=null;
  const formState=new WeakMap();

  const style=document.createElement('style');
  style.textContent=`
    .v20Live{margin-top:5px;font-size:11px;color:var(--muted);line-height:1.35}
    .v20Live.error{color:#8a3c2c}
    .v20VoiceOnly{font-size:13px;line-height:1.45;white-space:pre-wrap}
  `;
  document.head.appendChild(style);

  function best(finalText,interimText){return [finalText,interimText].filter(Boolean).join(' ').replace(/\s+/g,' ').trim();}
  function kindFromHeading(){const h=document.querySelector('#sheet h2')?.textContent||'';if(/Guy/i.test(h))return'guys';if(/Girl/i.test(h))return'girls';return null;}
  function statusBox(){return document.getElementById('v19AudioWarn');}
  function valueBox(){return document.getElementById('v19AudioValue');}
  function transcriptBox(){return document.getElementById('v19AudioText');}

  class RecognitionOnly{
    constructor(onText,onStatus){this.onText=onText||(()=>{});this.onStatus=onStatus||(()=>{});this.finalText='';this.interimText='';this.error='';this.ended=false;this.started=false;}
    current(){return best(this.finalText,this.interimText);}
    start(){
      if(!SR)throw new Error('Speech recognition is not supported by this browser.');
      this.speech=new SR();
      this.speech.lang='en-US'; // same locale as the older Guided Voice that worked reliably
      this.speech.continuous=true;
      this.speech.interimResults=true;
      this.speech.maxAlternatives=1;
      this.speech.onstart=()=>{this.started=true;this.onStatus('Listening');};
      this.speech.onaudiostart=()=>this.onStatus('Listening');
      this.speech.onspeechstart=()=>this.onStatus('Listening');
      this.speech.onresult=e=>{
        let interim='';
        for(let i=e.resultIndex;i<e.results.length;i++){
          const t=(e.results[i]?.[0]?.transcript||'').trim();if(!t)continue;
          if(e.results[i].isFinal)this.finalText+=(this.finalText?' ':'')+t;
          else interim+=(interim?' ':'')+t;
        }
        this.interimText=interim;
        this.onText(this.current());
      };
      this.speech.onerror=e=>{this.error=e.error||'speech recognition error';this.onStatus('Transcription error: '+this.error,true);};
      this.speech.onnomatch=()=>this.onStatus('Speech was heard but not recognized.',true);
      this.speech.onend=()=>{this.ended=true;this.onStatus(this.current()?'Transcription ready':(this.error?'Transcription error: '+this.error:'Mic stopped — no speech was recognized'),!this.current());if(this._resolve)this._resolve();};
      this.speech.start();
    }
    async stop(){
      if(!this.speech)return{text:this.current(),error:this.error};
      try{this.speech.stop();}catch(e){}
      if(!this.ended)await new Promise(resolve=>{this._resolve=resolve;setTimeout(resolve,1300);});
      return{text:this.current(),error:this.error};
    }
  }

  const priorOpenP=window.openP;
  window.openP=openP=function(k,id){activeProfile={k,id};const r=priorOpenP(k,id);setTimeout(()=>{decorateSavedProfile(k,id);const b=document.getElementById('v19Audio');if(b)b.textContent='Voice note';},20);return r;};
  const priorOpenS=window.openS;
  window.openS=openS=function(id){const r=priorOpenS(id);setTimeout(()=>{const b=document.getElementById('v19Audio');if(b)b.textContent='Voice note';},20);return r;};

  function decorateSavedProfile(k,id){
    const x=data[k]?.find(z=>z.id===id),sheet=document.getElementById('sheet');if(!x||!sheet||!x.profileAudioText||x.profileAudio)return;
    if(document.getElementById('v20ProfileText'))return;
    const d=document.createElement('div');d.id='v20ProfileText';d.className='v19ProfileAudio';d.innerHTML=`<div class="small">Audio profile text</div><div class="v20VoiceOnly">${esc(x.profileAudioText)}</div>`;
    const edit=document.getElementById('v19EditProfile');if(edit)edit.insertAdjacentElement('beforebegin',d);else sheet.appendChild(d);
  }

  function bindProfileVoice(){
    const btn=document.getElementById('v19ProfileAudio'),profile=document.getElementById('v19Profile'),saveBtn=document.getElementById('v19Save');
    if(!btn||!profile||!saveBtn||btn.dataset.v20Bound==='1')return;
    const clean=btn.cloneNode(true);btn.replaceWith(clean);clean.dataset.v20Bound='1';clean.textContent='Audio profile';
    const box=transcriptBox(),val=valueBox(),warn=statusBox();
    const k=kindFromHeading(),heading=document.querySelector('#sheet h2')?.textContent||'',isEdit=/^Edit\b/i.test(heading);
    const beforeCount=k?(data[k]?.length||0):0;
    const state={recognizer:null,text:'',profileWasEmpty:!profile.value.trim(),k,isEdit,beforeCount,editId:isEdit&&activeProfile?.k===k?activeProfile.id:null};
    formState.set(clean,state);
    let voiceWriting=false;
    const setText=t=>{
      state.text=t||'';
      if(box)box.classList.remove('hidden');if(val)val.textContent=t||'Listening…';
      if(state.profileWasEmpty||profile.dataset.v20VoiceFill==='1'){
        voiceWriting=true;profile.value=t;profile.dataset.v20VoiceFill='1';profile.dispatchEvent(new Event('input',{bubbles:true}));voiceWriting=false;
      }
    };
    profile.addEventListener('input',()=>{if(!voiceWriting&&profile.dataset.v20VoiceFill==='1'){delete profile.dataset.v20VoiceFill;state.profileWasEmpty=false;}});
    const showStatus=(s,isErr)=>{if(warn){warn.textContent=s==='Listening'?'':s;warn.classList.toggle('error',!!isErr);}};
    async function stop(){if(!state.recognizer)return;clean.textContent='Finishing…';const r=await state.recognizer.stop();state.recognizer=null;activeVoice=null;if(r.text)setText(r.text);else{if(box)box.classList.remove('hidden');if(val)val.textContent='No transcript captured.';showStatus(r.error?'Reason: '+r.error:'Speech recognition ended without text.',true);}clean.classList.remove('recording');clean.textContent='Audio profile';}
    clean.onclick=async()=>{
      if(state.recognizer){await stop();return;}
      if(activeVoice)return;
      if(box)box.classList.remove('hidden');if(val)val.textContent='Listening…';showStatus('',false);
      const r=new RecognitionOnly(setText,showStatus);state.recognizer=r;activeVoice=r;
      try{r.start();clean.classList.add('recording');clean.textContent='Stop audio';}
      catch(e){state.recognizer=null;activeVoice=null;showStatus(e.message||'Speech recognition could not start.',true);}
    };
    saveBtn.addEventListener('click',()=>{
      if(state.recognizer){try{state.recognizer.speech?.stop();}catch(e){}const live=state.recognizer.current();if(live)setText(live);state.recognizer=null;activeVoice=null;}
      const text=state.text||profile.value.trim();
      if(!text)return;
      setTimeout(async()=>{
        try{
          let target=null;
          if(state.isEdit&&state.editId!=null)target=data[state.k]?.find(x=>x.id===state.editId)||null;
          else if(state.k&&(data[state.k]?.length||0)>state.beforeCount)target=data[state.k][0];
          if(!target)return;
          target.profileAudioText=text;
          if(!String(target.text||'').trim())target.text=text;
          await save();
        }catch(e){console.warn('PeerMatch v20 profile transcript save',e);}
      },250);
    },true);
  }

  // New voice notes prioritize transcription. Existing recorded audio notes remain untouched/playable.
  window.audio=audio=async function(k,id){
    const x=item(k,id);if(!x||activeVoice)return;
    const b=document.getElementById('v19Audio');if(b)b.textContent='Starting…';
    let live='';
    const r=new RecognitionOnly(t=>{live=t;if(b)b.textContent='Stop voice note';},(s,isErr)=>{if(b&&isErr)b.textContent='Stop voice note';});
    activeVoice=r;
    try{
      r.start();if(b){b.textContent='Stop voice note';b.onclick=async()=>{b.textContent='Finishing…';const out=await r.stop();activeVoice=null;const text=out.text||live;x.activities=x.activities||[];x.activities.push({id:Date.now(),type:'audio',audio:null,transcript:text,text:text,transcriptionOnly:true,transcriptionError:out.error,ts:stamp()});await save();k==='shadchanim'?openS(id):openP(k,id);render();};}
    }catch(e){activeVoice=null;if(b)b.textContent='Voice note';alert('Speech recognition could not start: '+(e.message||e));}
  };

  const priorActs=window.acts;
  window.acts=acts=function(x){
    if(!x.activities?.length)return'<div class="empty">No contact history yet.</div>';
    return [...x.activities].reverse().map(a=>{
      if(a.type==='audio'){
        const t=String(a.transcript||a.text||'').trim();
        if(a.audio)return `<div class="event"><div class="eventTop"><span>Audio note</span><span>${esc(a.ts||'')}</span></div><audio controls src="${url(a.audio)}"></audio><div class="pmAudioTranscript"><span class="small">Transcript</span>${esc(t||('Transcription unavailable'+(a.transcriptionError?': '+a.transcriptionError:'.')))}</div></div>`;
        return `<div class="event"><div class="eventTop"><span>Voice note</span><span>${esc(a.ts||'')}</span></div><div class="pmAudioTranscript"><span class="small">Transcript</span>${esc(t||('No transcript captured'+(a.transcriptionError?': '+a.transcriptionError:'.')))}</div></div>`;
      }
      if(a.type==='wa-out')return `<div class="event waOut"><div class="eventTop"><span>You → WhatsApp</span><span>${esc(a.ts||'')}</span></div><div class="profileText">${esc(a.text||'')}</div></div>`;
      if(a.type==='wa-in')return `<div class="event waIn"><div class="eventTop"><span>WhatsApp → You</span><span>${esc(a.ts||'')}</span></div><div class="profileText">${esc(a.text||'')}</div></div>`;
      if(a.type==='sms-out')return `<div class="event"><div class="eventTop"><span>You → SMS</span><span>${esc(a.ts||'')}</span></div><div class="profileText">${esc(a.text||'')}</div></div>`;
      if(a.type==='email-out')return `<div class="event"><div class="eventTop"><span>You → Email</span><span>${esc(a.ts||'')}</span></div><div class="profileText">${esc(a.text||'')}</div></div>`;
      return `<div class="event"><div class="eventTop"><span>${esc(a.type==='action'?(a.action||'Action'):'Note')}</span><span>${esc(a.ts||'')}</span></div><div class="profileText">${esc(a.text||'')}</div></div>`;
    }).join('');
  };

  function scan(){bindProfileVoice();}
  new MutationObserver(scan).observe(document.body,{childList:true,subtree:true});setInterval(scan,350);scan();
})();
