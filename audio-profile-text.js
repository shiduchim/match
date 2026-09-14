/* PeerMatch audio profile transcription overlay.
   New audio-profile recordings are transcribed live when browser speech recognition is available.
   The transcript is saved separately as profileAudioText and remains editable in Add/Edit.
   Existing saved audio profiles get the new text field but are not retro-transcribed in-browser.
*/
(function(){
  const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  let activeProfile=null;
  let recorder=null,stream=null,chunks=[],speech=null;
  let pendingAudio=null,pendingText='';

  const style=document.createElement('style');
  style.textContent=`
    .pmAudioProfileTextLabel{margin:8px 0 10px!important}
    .pmAudioProfileTextLabel textarea{min-height:92px!important}
    .pmAudioProfileTextNote{font-size:11px;color:var(--muted);margin-top:4px;line-height:1.3}
    .pmAudioProfileTextView{margin-top:8px;padding-top:8px;border-top:1px solid var(--line);font-size:13px;line-height:1.45;white-space:pre-wrap}
    .pmAudioProfileTextView .small{display:block;margin:0 0 3px}
  `;
  document.head.appendChild(style);

  const previousOpenP=window.openP;
  if(previousOpenP){
    window.openP=openP=function(k,id){activeProfile={k,id};return previousOpenP(k,id);};
  }

  function kindFromForm(){
    const h=document.querySelector('#sheet h2')?.textContent||'';
    if(/Guy/i.test(h))return'guys';
    if(/Girl/i.test(h))return'girls';
    return null;
  }

  function currentRecord(){
    if(!activeProfile)return null;
    return data[activeProfile.k]?.find(x=>x.id===activeProfile.id)||null;
  }

  function ensureTextField(existing,show){
    let label=document.getElementById('pmAudioProfileTextLabel');
    if(!label){
      label=document.createElement('label');
      label.id='pmAudioProfileTextLabel';
      label.className='pmAudioProfileTextLabel';
      label.innerHTML='Audio profile text<textarea id="pmAudioProfileText" placeholder="Transcript of the audio profile"></textarea><div class="pmAudioProfileTextNote">Editable — correct anything the transcription gets wrong.</div>';
      const header=document.querySelector('#sheet .pmMediaHeader');
      if(header)header.insertAdjacentElement('afterend',label);
      else document.querySelector('#sheet h2')?.insertAdjacentElement('afterend',label);
    }
    const box=document.getElementById('pmAudioProfileText');
    if(box&&existing!=null&&!box.dataset.seeded){box.value=existing;box.dataset.seeded='1';}
    label.classList.toggle('hidden',!show);
    return box;
  }

  function stopSpeech(){try{speech?.stop()}catch(e){}speech=null;}

  async function startAudio(button,textBox){
    if(recorder&&recorder.state==='recording'){recorder.stop();return;}
    try{
      stream=await navigator.mediaDevices.getUserMedia({audio:true});
      chunks=[];pendingText='';
      recorder=new MediaRecorder(stream);
      recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};

      if(SpeechRecognition){
        try{
          speech=new SpeechRecognition();
          speech.lang=navigator.language||'en-US';
          speech.continuous=true;
          speech.interimResults=false;
          speech.onresult=e=>{
            for(let i=e.resultIndex;i<e.results.length;i++){
              if(!e.results[i].isFinal)continue;
              const t=(e.results[i][0]?.transcript||'').trim();
              if(!t)continue;
              pendingText+=(pendingText?' ':'')+t;
              textBox.value=pendingText;
              textBox.dispatchEvent(new Event('input',{bubbles:true}));
            }
          };
          speech.onerror=()=>{};
          speech.onend=()=>{};
          speech.start();
        }catch(e){speech=null;}
      }

      recorder.onstop=()=>{
        stopSpeech();
        pendingAudio=new Blob(chunks,{type:recorder.mimeType||'audio/webm'});
        stream?.getTracks().forEach(t=>t.stop());stream=null;recorder=null;
        button.classList.remove('recording');button.textContent='Audio saved';
        if(!textBox.value.trim()&&pendingText)textBox.value=pendingText;
      };
      recorder.start();
      button.classList.add('recording');button.textContent='Stop audio';
    }catch(e){alert('Microphone permission is required to record an audio profile.');}
  }

  function bindForm(){
    const button=document.getElementById('pmAudioProfileBtn');
    const addForm=document.getElementById('pnm'),editForm=document.getElementById('pen');
    if(!button||(!addForm&&!editForm)||button.dataset.audioTextBound==='1')return;

    button.dataset.audioTextBound='1';
    pendingAudio=null;pendingText='';
    const k=kindFromForm();
    const record=editForm?currentRecord():null;
    const hasAudio=!!record?.profileAudio;
    const textBox=ensureTextField(record?.profileAudioText||'',hasAudio);

    // Remove v14's audio-button listener by replacing the node, then bind the transcription-aware recorder.
    const clean=button.cloneNode(true);
    button.replaceWith(clean);
    clean.dataset.audioTextBound='1';
    clean.onclick=()=>{
      document.getElementById('pmAudioProfileTextLabel')?.classList.remove('hidden');
      startAudio(clean,document.getElementById('pmAudioProfileText'));
    };

    const saveBtn=document.getElementById('pmFormSave');
    if(!saveBtn||saveBtn.dataset.audioTextSave==='1')return;
    saveBtn.dataset.audioTextSave='1';
    const beforeCount=k?(data[k]?.length||0):0;
    saveBtn.addEventListener('click',()=>{
      const audio=pendingAudio;
      const text=(document.getElementById('pmAudioProfileText')?.value||'').trim();
      setTimeout(async()=>{
        try{
          let target=null;
          if(editForm&&activeProfile)target=data[activeProfile.k]?.find(x=>x.id===activeProfile.id)||null;
          else if(k&&(data[k]?.length||0)>beforeCount)target=data[k][0];
          if(!target)return;
          if(audio)target.profileAudio=audio;
          if(target.profileAudio||audio)target.profileAudioText=text;
          await save();
        }catch(e){console.warn('Saving audio profile text failed',e)}
      },180);
    },true);
  }

  function decorateDetail(){
    const box=document.getElementById('pmProfileAudioBox');
    const record=currentRecord();
    if(!box||!record?.profileAudio||box.querySelector('.pmAudioProfileTextView'))return;
    const div=document.createElement('div');
    div.className='pmAudioProfileTextView';
    div.innerHTML=`<span class="small">Audio profile text</span>${record.profileAudioText?esc(record.profileAudioText):'<span class="small">No transcript saved yet.</span>'}`;
    box.appendChild(div);
  }

  function scan(){bindForm();decorateDetail();}
  new MutationObserver(scan).observe(document.body,{childList:true,subtree:true});
  setInterval(scan,450);
  scan();
})();
