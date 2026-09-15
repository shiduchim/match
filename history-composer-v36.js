/* PeerMatch v38: WhatsApp-style History composer for Guy/Girl/Shadchan details. */
(function(){
  document.documentElement.dataset.peerMatchVersion='38';

  const MIC_ICON='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 14.5a3.5 3.5 0 0 0 3.5-3.5V5a3.5 3.5 0 0 0-7 0v6a3.5 3.5 0 0 0 3.5 3.5Z"/><path d="M5.75 10.75a6.25 6.25 0 0 0 12.5 0M12 17v3.25M9.25 20.25h5.5"/></svg>';
  const SEND_ICON='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 4 16 8-16 8 3-8-3-8Z"/><path d="M7 12h13"/></svg>';
  const STOP_ICON='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="1.5"/></svg>';
  const BACK_ICON='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.5 5 8.5 12l7 7"/></svg>';

  const style=document.createElement('style');
  style.textContent=`
    .pmChatDetail{padding-bottom:92px!important}
    .pmChatDetail .v19Head,.pmChatDetail .v19ShadHead{align-items:center!important;padding-top:10px!important;min-height:58px}
    .pmChatBack{flex:0 0 48px!important;width:48px!important;height:48px!important;min-width:48px!important;min-height:48px!important;border-radius:50%!important;padding:0!important;margin:2px 7px 0 0!important;background:#eef3f6!important;color:#17364d!important;border:1px solid #d7e0e5!important;box-shadow:0 1px 3px rgba(0,0,0,.08)!important;display:grid!important;place-items:center!important;cursor:pointer!important;-webkit-tap-highlight-color:transparent}
    .pmChatBack svg{width:27px;height:27px;fill:none;stroke:currentColor;stroke-width:2.35;stroke-linecap:round;stroke-linejoin:round}
    .pmChatBack:active{transform:scale(.96);background:#e2eaee!important}
    .pmChatComposer{position:fixed;left:50%;bottom:max(7px,env(safe-area-inset-bottom));transform:translateX(-50%);width:min(590px,calc(100% - 14px));z-index:190;display:flex;align-items:flex-end;gap:7px;padding:6px;background:transparent;border:0;box-shadow:none}
    .pmChatBubble{flex:1;min-width:0;display:flex;align-items:flex-end;background:#fff;border:1px solid #d7e0e5;border-radius:24px;box-shadow:0 1px 4px rgba(0,0,0,.10);overflow:hidden}
    .pmChatInput{flex:1;min-width:0;width:100%;min-height:46px!important;max-height:120px!important;height:46px;resize:none!important;border:0!important;outline:0!important;box-shadow:none!important;border-radius:24px!important;padding:12px 15px!important;line-height:22px!important;background:transparent!important;font-size:16px!important;color:var(--text)!important;margin:0!important}
    .pmChatInput::placeholder{color:#7d8b94;opacity:1}
    .pmChatInput:disabled{opacity:1;color:#8a4a4a!important;-webkit-text-fill-color:#8a4a4a!important}
    .pmChatAction{flex:0 0 46px;width:46px;height:46px;min-width:46px;min-height:46px;padding:0!important;border:0!important;border-radius:50%!important;display:grid!important;place-items:center!important;background:#315b78!important;color:#fff!important;box-shadow:0 1px 4px rgba(0,0,0,.16)!important;cursor:pointer!important;-webkit-tap-highlight-color:transparent;transition:transform .08s ease,background .15s ease}
    .pmChatAction:active{transform:scale(.95)}
    .pmChatAction svg{width:23px;height:23px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
    .pmChatAction.pmSendMode svg:first-child{transform:translateX(1px)}
    .pmChatAction.recording{background:#b84848!important;animation:pmChatPulse 1s infinite}
    .pmChatAction.recording svg rect{fill:currentColor;stroke:none}
    @keyframes pmChatPulse{0%,100%{box-shadow:0 1px 4px rgba(0,0,0,.16)}50%{box-shadow:0 0 0 5px rgba(184,72,72,.14)}}
    @media(max-width:430px){
      .pmChatDetail .v19Head,.pmChatDetail .v19ShadHead{padding-top:12px!important;min-height:62px}
      .pmChatBack{flex-basis:50px!important;width:50px!important;height:50px!important;min-width:50px!important;min-height:50px!important;margin-right:8px!important}
      .pmChatBack svg{width:29px;height:29px}
      .pmChatComposer{width:calc(100% - 10px);gap:6px;padding:5px}
      .pmChatInput{min-height:46px!important;height:46px;padding:12px 14px!important}
      .pmChatAction{flex-basis:46px;width:46px;height:46px;min-width:46px;min-height:46px}
    }
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

  function drawAction(button,input,isRecording){
    if(!button||!input)return;
    if(isRecording){
      button.className='pmChatAction recording';
      button.innerHTML=STOP_ICON;
      button.setAttribute('aria-label','Stop and save audio note');
      button.title='Stop and save audio note';
      return;
    }
    const hasText=!!String(input.value||'').trim();
    button.className='pmChatAction'+(hasText?' pmSendMode':'');
    button.innerHTML=hasText?SEND_ICON:MIC_ICON;
    button.setAttribute('aria-label',hasText?'Send message':'Record audio message');
    button.title=hasText?'Send message':'Record audio message';
  }

  async function stopAndSave(){
    const c=capture;
    if(!c)return;
    capture=null;
    const btn=c.button,input=c.input;
    if(btn)btn.disabled=true;
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
      if(input){input.disabled=false;input.placeholder='Message…';}
      if(btn){btn.disabled=false;drawAction(btn,input,false);}
      alert('The audio recording could not be saved. Please record again.');
      return;
    }

    const x=findRecord(c.k,c.id);
    if(!x)return;
    x.activities=x.activities||[];
    x.activities.push({id:Date.now(),type:'audio',audio:blob,ts:stamp()});
    try{await save();}catch(e){
      if(input){input.disabled=false;input.placeholder='Message…';}
      if(btn){btn.disabled=false;drawAction(btn,input,false);}
      return alert('PeerMatch could not save the audio note.');
    }
    try{render();}catch(e){}
    if(c.k==='shadchanim')openS(c.id);else openP(c.k,c.id);
  }

  async function startAudio(k,id,button,input){
    if(capture){await stopAndSave();return;}
    if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined')return alert('Audio recording is not supported by this browser.');
    button.disabled=true;
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:true});
      const recorder=new MediaRecorder(stream);
      const parts=[];
      const c={k,id,stream,recorder,parts,mimeType:recorder.mimeType||'audio/webm',button,input};
      recorder.ondataavailable=e=>{if(e.data&&e.data.size)parts.push(e.data);};
      recorder.start(500);
      capture=c;
      input.disabled=true;
      input.placeholder='Recording audio…';
      button.disabled=false;
      drawAction(button,input,true);
    }catch(e){
      button.disabled=false;
      input.disabled=false;
      input.placeholder='Message…';
      drawAction(button,input,false);
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
    catch(e){button.disabled=false;return alert('PeerMatch could not save the message.');}
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

    const title=[...sheet.querySelectorAll('.sectionTitle')].find(el=>/What I did to help|Conversation\s*\/\s*contact history|contact history|notes|History/i.test(el.textContent||''));
    if(title)title.textContent='History';

    const head=sheet.querySelector('.v19Head,.v19ShadHead')||sheet.querySelector('h2')?.parentElement;
    if(head&&!head.querySelector('.pmChatBack')){
      const back=document.createElement('button');
      back.type='button';back.className='pmChatBack';back.setAttribute('aria-label','Back to list');back.title='Back';back.innerHTML=BACK_ICON;
      head.insertBefore(back,head.firstChild);
      back.onclick=()=>{abortCapture();close();};
    }

    document.getElementById('pmChatComposer')?.remove();
    const composer=document.createElement('div');
    composer.id='pmChatComposer';composer.className='pmChatComposer';
    composer.innerHTML='<div class="pmChatBubble"><textarea id="pmChatInput" class="pmChatInput" rows="1" placeholder="Message…" aria-label="Message"></textarea></div><button id="pmChatAction" type="button" class="pmChatAction" aria-label="Record audio message"></button>';
    sheet.appendChild(composer);

    const input=document.getElementById('pmChatInput'),action=document.getElementById('pmChatAction');
    const resize=()=>{input.style.height='46px';input.style.height=Math.min(120,input.scrollHeight)+'px';};
    input.oninput=()=>{resize();drawAction(action,input,false);};
    action.onclick=()=>{
      if(capture)return stopAndSave();
      if(String(input.value||'').trim())return sendText(k,id,input,action);
      return startAudio(k,id,action,input);
    };
    drawAction(action,input,false);
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
