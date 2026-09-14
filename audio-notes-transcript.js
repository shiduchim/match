/* PeerMatch automatic audio-note transcription.
   Newly recorded Guy/Girl audio notes are transcribed live when supported.
   Shadchan audio notes already record a transcript in peermatch-v14.
   Every audio player renders a transcript line underneath.
*/
(function(){
  const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;

  function audioHtml(a){
    const transcript=String(a.transcript||a.text||'').trim();
    return `<div class="event"><div class="eventTop"><span>Audio note</span><span>${esc(a.ts)}</span></div><audio controls src="${url(a.audio)}"></audio><div class="pmAudioTranscript"><span class="small">Transcript</span>${esc(transcript||'No transcript captured.')}</div></div>`;
  }

  window.acts=acts=function(x){
    if(!x.activities?.length)return '<div class="empty">No contact history yet.</div>';
    return [...x.activities].reverse().map(a=>{
      if(a.type==='audio')return audioHtml(a);
      if(a.type==='wa-out')return `<div class="event waOut"><div class="eventTop"><span>You → WhatsApp</span><span>${esc(a.ts)}</span></div><div class="profileText">${esc(a.text||'')}</div></div>`;
      if(a.type==='wa-in')return `<div class="event waIn"><div class="eventTop"><span>WhatsApp → You</span><span>${esc(a.ts)}</span></div><div class="profileText">${esc(a.text||'')}</div></div>`;
      if(a.type==='sms-out')return `<div class="event"><div class="eventTop"><span>You → SMS</span><span>${esc(a.ts)}</span></div><div class="profileText">${esc(a.text||'')}</div></div>`;
      if(a.type==='email-out')return `<div class="event"><div class="eventTop"><span>You → Email</span><span>${esc(a.ts)}</span></div><div class="profileText">${esc(a.text||'')}</div></div>`;
      return `<div class="event"><div class="eventTop"><span>${esc(a.type==='action'?a.action:'Note')}</span><span>${esc(a.ts)}</span></div><div class="profileText">${esc(a.text||'')}</div></div>`;
    }).join('');
  };

  window.audio=audio=async function(k,id){
    const x=item(k,id);if(!x)return;
    try{
      stream=await navigator.mediaDevices.getUserMedia({audio:true});chunks=[];let transcript='';let speech=null;
      rec=new MediaRecorder(stream);
      rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
      if(SpeechRecognition){
        try{
          speech=new SpeechRecognition();speech.lang=navigator.language||'en-US';speech.continuous=true;speech.interimResults=false;
          speech.onresult=e=>{for(let i=e.resultIndex;i<e.results.length;i++){if(!e.results[i].isFinal)continue;const t=(e.results[i][0]?.transcript||'').trim();if(t)transcript+=(transcript?' ':'')+t;}};
          speech.onerror=()=>{};speech.onend=()=>{};speech.start();
        }catch(e){speech=null;}
      }
      rec.onstop=async()=>{
        try{speech?.stop()}catch(e){}
        stream?.getTracks().forEach(t=>t.stop());
        const blob=new Blob(chunks,{type:rec.mimeType||'audio/webm'});
        x.activities=x.activities||[];
        x.activities.push({id:Date.now(),type:'audio',audio:blob,transcript:transcript.trim(),text:transcript.trim(),ts:stamp()});
        rec=null;stream=null;chunks=[];
        await save();
        if(k==='shadchanim')openS(id);else openP(k,id);
        render();
      };
      rec.start();
      const b=k==='shadchanim'?document.getElementById('pmV14Audio')||document.getElementById('an'):document.getElementById('pmDetAudio')||document.getElementById('pa');
      if(b){b.textContent='Stop audio';b.onclick=()=>rec?.stop();}
    }catch(e){alert('Microphone permission is required.');}
  };
})();