/* PeerMatch audio profile transcription.
   New audio-profile recordings are transcribed live when browser speech recognition is available.
   The best transcript is saved separately as profileAudioText and displayed read-only.
*/
(function(){
  const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  let activeProfile=null;
  let recorder=null,stream=null,chunks=[],speech=null;
  let pendingAudio=null,pendingText='';

  const style=document.createElement('style');
  style.textContent=`
    .pmAudioProfileTextBox{margin:8px 0 10px;padding:9px 10px;background:#fff;border:1px solid var(--line);border-radius:12px;font-size:13px;line-height:1.45;white-space:pre-wrap}
    .pmAudioProfileTextBox .small{display:block;margin:0 0 4px;color:var(--muted)}
    .pmAudioProfileTextView{margin-top:8px;padding-top:8px;border-top:1px solid var(--line);font-size:13px;line-height:1.45;white-space:pre-wrap}
    .pmAudioProfileTextView .small{display:block;margin:0 0 3px}
  `;
  document.head.appendChild(style);

  const previousOpenP=window.openP;
  if(previousOpenP){window.openP=openP=function(k,id){activeProfile={k,id};return previousOpenP(k,id);};}

  function kindFromForm(){
    const h=document.querySelector('#sheet h2')?.textContent||'';
    if(/Guy/i.test(h))return'guys';if(/Girl/i.test(h))return'girls';return null;
  }
  function currentRecord(){return activeProfile?data[activeProfile.k]?.find(x=>x.id===activeProfile.id)||null:null;}
  function ensureTextBox(existing,show){
    let box=document.getElementById('pmAudioProfileTextBox');
    if(!box){
      box=document.createElement('div');box.id='pmAudioProfileTextBox';box.className='pmAudioProfileTextBox';
      const header=document.querySelector('#sheet .pmMediaHeader');
      if(header)header.insertAdjacentElement('afterend',box);else document.querySelector('#sheet h2')?.insertAdjacentElement('afterend',box);
    }
    if(existing!=null&&!box.dataset.seeded){box.dataset.seeded='1';box.dataset.text=existing;}
    const text=box.dataset.text||existing||'';
    box.innerHTML=`<span class="small">Audio profile text</span><span id="pmAudioProfileTextValue">${text?esc(text):'Listening…'}</span>`;
    box.classList.toggle('hidden',!show);return box;
  }
  function setText(text){
    const box=document.getElementById('pmAudioProfileTextBox');if(!box)return;
    box.dataset.text=text||'';
    const v=document.getElementById('pmAudioProfileTextValue');if(v)v.textContent=text||'Listening…';
  }
  function stopSpeech(){try{speech?.stop()}catch(e){}speech=null;}

  async function startAudio(button){
    if(recorder&&recorder.state==='recording'){recorder.stop();return;}
    try{
      stream=await navigator.mediaDevices.getUserMedia({audio:true});chunks=[];pendingText='';
      recorder=new MediaRecorder(stream);recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
      ensureTextBox('',true);setText('');
      if(SpeechRecognition){
        try{
          speech=new SpeechRecognition();speech.lang=navigator.language||'en-US';speech.continuous=true;speech.interimResults=false;
          speech.onresult=e=>{for(let i=e.resultIndex;i<e.results.length;i++){if(!e.results[i].isFinal)continue;const t=(e.results[i][0]?.transcript||'').trim();if(!t)continue;pendingText+=(pendingText?' ':'')+t;setText(pendingText);}};
          speech.onerror=()=>{};speech.onend=()=>{};speech.start();
        }catch(e){speech=null;}
      }
      recorder.onstop=()=>{
        stopSpeech();pendingAudio=new Blob(chunks,{type:recorder.mimeType||'audio/webm'});
        stream?.getTracks().forEach(t=>t.stop());stream=null;recorder=null;
        button.classList.remove('recording');button.textContent='Audio saved';
        setText(pendingText.trim()||'No transcript captured.');
      };
      recorder.start();button.classList.add('recording');button.textContent='Stop audio';
    }catch(e){alert('Microphone permission is required to record an audio profile.');}
  }

  function bindForm(){
    const button=document.getElementById('pmAudioProfileBtn'),addForm=document.getElementById('pnm'),editForm=document.getElementById('pen');
    if(!button||(!addForm&&!editForm)||button.dataset.audioTextBound==='1')return;
    pendingAudio=null;pendingText='';
    const k=kindFromForm(),record=editForm?currentRecord():null;
    if(record?.profileAudio)ensureTextBox(record.profileAudioText||'No transcript captured.',true);
    const clean=button.cloneNode(true);button.replaceWith(clean);clean.dataset.audioTextBound='1';clean.onclick=()=>startAudio(clean);
    const saveBtn=document.getElementById('pmFormSave');if(!saveBtn||saveBtn.dataset.audioTextSave==='1')return;
    saveBtn.dataset.audioTextSave='1';const beforeCount=k?(data[k]?.length||0):0;
    saveBtn.addEventListener('click',()=>{
      const audio=pendingAudio,text=pendingText.trim();
      setTimeout(async()=>{try{
        let target=null;
        if(editForm&&activeProfile)target=data[activeProfile.k]?.find(x=>x.id===activeProfile.id)||null;
        else if(k&&(data[k]?.length||0)>beforeCount)target=data[k][0];
        if(!target)return;if(audio)target.profileAudio=audio;if(audio)target.profileAudioText=text;await save();
      }catch(e){console.warn('Saving audio profile transcript failed',e)}},180);
    },true);
  }

  function decorateDetail(){
    const box=document.getElementById('pmProfileAudioBox'),record=currentRecord();
    if(!box||!record?.profileAudio||box.querySelector('.pmAudioProfileTextView'))return;
    const div=document.createElement('div');div.className='pmAudioProfileTextView';
    div.innerHTML=`<span class="small">Audio profile text</span>${esc(record.profileAudioText||'No transcript captured.')}`;box.appendChild(div);
  }
  function scan(){bindForm();decorateDetail();}
  new MutationObserver(scan).observe(document.body,{childList:true,subtree:true});setInterval(scan,450);scan();
})();