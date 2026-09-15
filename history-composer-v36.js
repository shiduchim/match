/* PeerMatch v36: WhatsApp-style History composer for Guy/Girl/Shadchan details. */
(function(){
  document.documentElement.dataset.peerMatchVersion='36';

  const style=document.createElement('style');
  style.textContent=`
    .pmChatDetail{padding-bottom:94px!important}
    .pmChatBack{flex:0 0 34px;width:34px;height:34px;border-radius:50%;padding:0!important;background:transparent!important;color:var(--text)!important;font-size:25px!important;line-height:34px!important;font-weight:500!important;display:grid;place-items:center;margin:-2px 1px 0 -4px}
    .pmChatBack:active{background:#e9edef!important}
    .pmChatComposer{position:fixed;left:50%;bottom:max(7px,env(safe-area-inset-bottom));transform:translateX(-50%);width:min(590px,calc(100% - 16px));z-index:190;display:flex;align-items:flex-end;gap:6px;padding:7px;background:rgba(255,255,255,.98);border:1px solid var(--line);border-radius:16px;box-shadow:0 4px 18px rgba(0,0,0,.16);backdrop-filter:blur(10px)}
    .pmChatInput{flex:1;min-width:0;min-height:40px!important;max-height:118px!important;height:40px;resize:none!important;border-radius:18px!important;padding:9px 12px!important;line-height:20px!important;background:#fff!important}
    .pmChatRound{flex:0 0 40px;width:40px;height:40px;min-height:40px;padding:0!important;border-radius:50%!important;display:grid;place-items:center;font-size:17px!important}
    .pmChatMic{background:#eef3f6!important;color:var(--text)!important}
    .pmChatMic.recording{background:#f5dddd!important;color:#8b2f2f!important;animation:pmChatPulse 1s infinite}
    .pmChatSend{background:var(--accent)!important;color:#fff!important;font-size:12px!important}
    .pmChatRecording{font-size:11px;color:#8b2f2f;margin:4px 2px 0;display:none}
    @keyframes pmChatPulse{0%,100%{opacity:.65}50%{opacity:1}}
    @media(max-width:430px){.pmChatComposer{width:calc(100% - 12px);gap:5px;padding:6px}.pmChatRound{flex-basis:38px;width:38px;height:38px;min-height:38px}.pmChatInput{min-height:38px!important;height:38px;padding:8px 11px!important}}
  `;
  document.head.appendChild(style);

  let capture=null;

  function findRecord(k,id){
    return (data[k]||[]).find(x=>String(x.id)===String(id))||null;
  }

  function abortCapture(){
    const c=capture;
    capture=null;
    if(!c)return;
    try{c.recorder.ondataavailable=null;c.recorder.onstop=null;if(c.recorder.state!=='inactive')c.recorder.stop();}catch(e){}
    try{c.stream.getTracks().forEach(t=>t.stop());}catch(e){}
  }

  async function stopAndSave(){
    const c=capture;
    if(!c)return;
    capture=null;
    const btn=c.button;
    if(btn){btn.disabled=true;btn.textContent='…';}
    let blob=null;
    try{
      blob=await new Promise((resolve,reject)=>{
        const finish=()=>{
          try{c.stream.getTracks().forEach(t=>t.stop());}catch(e){}
          const b=new Blob(c.parts,{type:c.mimeType||'audio/webm'});
          if(!b.size)return reject(new Error('Recording was empty.'));
          resolve(b);
        };
        c.recorder.ondataavailable=e=>{if(e.data&&e.data.size)c.parts.push(e.data);};
        c.recorder.onerror=e=>reject(e.error||new Error('Recording failed.'));
        c.recorder.onstop=finish;
        if(c.recorder.state==='inactive')finish();
        else{
          try{c.recorder.requestData();}catch(e){}
          c.recorder.stop();
        }
      });
    }catch(e){
      try{c.stream.getTracks().forEach(t=>t.stop());}catch(err){}
      alert('The audio recording could not be saved. Please record again.');
      return;
    }

    const x=findRecord(c.k,c.id);
    if(!x)return;
    x.activities=x.activities||[];
    x.activities.push({id:Date.now(),type:'audio',audio:blob,ts:stamp()});
    try{await save();}catch(e){return alert('PeerMatch could not save the audio note.');}
    try{render();}catch(e){}
    if(c.k==='shadchanim')openS(c.id);else openP(c.k,c.id);
  }

  async function startAudio(k,id,button,status){
    if(capture){await stopAndSave();return;}
    if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined')return alert('Audio recording is not supported by this browser.');
    button.disabled=true;button.textContent='…';
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:true});
      const recorder=new MediaRecorder(stream);
      const parts=[];
      const c={k,id,stream,recorder,parts,mimeType:recorder.mimeType||'audio/webm',button,status};
      recorder.ondataavailable=e=>{if(e.data&&e.data.size)parts.push(e.data);};
      recorder.start(500);
      capture=c;
      button.disabled=false;button.classList.add('recording');button.textContent='■';button.title='Stop recording';
      if(status){status.style.display='block';status.textContent='Recording… tap the red button to save';}
    }catch(e){
      button.disabled=false;button.classList.remove('recording');button.textContent='🎤';
      if(status)status.style.display='none';
      alert('Microphone permission is required to record an audio note.');
    }
  }

  async function sendText(k,id,input,button){
    const text=String(input.value||'').trim();
    if(!text)return;
    const x=findRecord(k,id);if(!x)return;
    button.disabled=true;
    x.activities=x.activities||[];
    x.activities.push({id:Date.now(),type:'text',text,ts:stamp()});
    try{await save();}
    catch(e){button.disabled=false;return alert('PeerMatch could not save the note.');}
    input.value='';
    try{render();}catch(e){}
    if(k==='shadchanim')openS(id);else openP(k,id);
  }

  function enhanceDetail(k,id){
    const sheet=document.getElementById('sheet');
    if(!sheet)return;
    const x=findRecord(k,id);if(!x)return;

    document.getElementById('v19Fixed')?.remove();
    document.getElementById('pmFixedDetail')?.remove();
    sheet.classList.add('pmChatDetail');

    const title=[...sheet.querySelectorAll('.sectionTitle')].find(el=>/What I did to help|Conversation\s*\/\s*contact history|contact history|notes/i.test(el.textContent||''));
    if(title)title.textContent='History';

    const head=sheet.querySelector('.v19Head,.v19ShadHead')||sheet.querySelector('h2')?.parentElement;
    if(head&&!head.querySelector('.pmChatBack')){
      const back=document.createElement('button');
      back.type='button';back.className='pmChatBack';back.setAttribute('aria-label','Back');back.title='Back';back.textContent='←';
      head.insertBefore(back,head.firstChild);
      back.onclick=()=>{abortCapture();close();};
    }

    const old=document.getElementById('pmChatComposer');if(old)old.remove();
    const composer=document.createElement('div');
    composer.id='pmChatComposer';composer.className='pmChatComposer';
    composer.innerHTML='<textarea id="pmChatInput" class="pmChatInput" rows="1" placeholder="Add to history…"></textarea><button id="pmChatMic" type="button" class="pmChatRound pmChatMic" aria-label="Record audio note" title="Record audio note">🎤</button><button id="pmChatSend" type="button" class="pmChatRound pmChatSend" aria-label="Send note" title="Save note">Send</button>';
    sheet.appendChild(composer);
    const status=document.createElement('div');status.id='pmChatRecording';status.className='pmChatRecording';composer.insertAdjacentElement('beforebegin',status);

    const input=document.getElementById('pmChatInput'),mic=document.getElementById('pmChatMic'),send=document.getElementById('pmChatSend');
    input.oninput=()=>{input.style.height='40px';input.style.height=Math.min(118,input.scrollHeight)+'px';};
    send.onclick=()=>sendText(k,id,input,send);
    mic.onclick=()=>startAudio(k,id,mic,status);
  }

  const priorOpenP=window.openP;
  if(typeof priorOpenP==='function')window.openP=openP=function(k,id){
    abortCapture();
    const r=priorOpenP(k,id);
    setTimeout(()=>enhanceDetail(k,id),0);
    return r;
  };

  const priorOpenS=window.openS;
  if(typeof priorOpenS==='function')window.openS=openS=function(id){
    abortCapture();
    const r=priorOpenS(id);
    setTimeout(()=>enhanceDetail('shadchanim',id),0);
    return r;
  };

  document.addEventListener('click',e=>{
    if(!capture)return;
    const t=e.target;
    if(t?.id==='modal'||t?.closest?.('#v19EditProfile,#v19EditShad'))abortCapture();
  },true);
})();
