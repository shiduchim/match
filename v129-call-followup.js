/* PeerMatch v129: after a phone call ends, offer a quick status-update popup
   (typed note and/or a recorded audio note) for the Guy/Girl/Shadchan that was called.

   This file does not own any dialing behavior and never intercepts a click. It only
   watches, passively, for a tap on a button labeled exactly "Call" (every current
   Call owner — profile-contacts-v96.js, peermatch-v19.js, inline-phone-actions-v92.js —
   uses that exact label), then watches for the app regaining visibility afterward
   (the OS dialer closing). It never calls preventDefault/stopPropagation, so it cannot
   compete with or replace any existing Call/tel: handler.
*/
(function(){
  document.documentElement.dataset.peerMatchVersion='129';

  const STORAGE_KEY='pmCallFollowupV129';
  const MIN_GAP_MS=600;
  const MAX_AGE_MS=3*60*60*1000;
  const SHOW_DELAY_MS=500;

  let active=null;
  let pending=null;
  let popupOpen=false;
  let activeCapture=null;

  try{
    const raw=localStorage.getItem(STORAGE_KEY);
    if(raw)pending=JSON.parse(raw);
  }catch(e){}

  const priorOpenP=window.openP;
  if(typeof priorOpenP==='function')window.openP=function(k,id){active={k,id};return priorOpenP(k,id);};
  const priorOpenS=window.openS;
  if(typeof priorOpenS==='function')window.openS=function(id){active={k:'shadchanim',id};return priorOpenS(id);};

  function recordFor(k,id){return (data[k]||[]).find(x=>String(x.id)===String(id))||null;}
  function nowStamp(){return typeof stamp==='function'?stamp():new Date().toLocaleString();}

  function extractPhoneNear(el){
    const scope=el.closest('.pmV96ContactRow,.v19Contact,.pmV92PhoneSheet,.pmUnifiedContact,#sheet')||document.body;
    const m=String(scope.textContent||'').match(/(?:\+?\d[\d\s().-]{7,}\d)/);
    return m?m[0].trim():'';
  }

  function armPending(k,id,el){
    const rec={k,id,phone:extractPhoneNear(el),ts:Date.now()};
    pending=rec;
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(rec));}catch(e){}
  }

  function clearPending(){
    pending=null;
    try{localStorage.removeItem(STORAGE_KEY);}catch(e){}
  }

  // Passive observer only: never blocks or redirects the real Call action.
  document.addEventListener('click',e=>{
    try{
      const el=e.target&&e.target.closest?e.target.closest('button,a'):null;
      if(!el||el.disabled)return;
      if(String(el.textContent||'').trim()!=='Call')return;
      if(!active)return;
      armPending(active.k,active.id,el);
    }catch(err){}
  },true);

  class RecorderOnly{
    constructor(){this.parts=[];}
    async start(){
      this.stream=await navigator.mediaDevices.getUserMedia({audio:true});
      this.recorder=new MediaRecorder(this.stream);
      this.recorder.ondataavailable=e=>{if(e.data&&e.data.size)this.parts.push(e.data);};
      this.recorder.start(500);
    }
    stop(){
      return new Promise((resolve,reject)=>{
        if(!this.recorder)return reject(new Error('Recording did not start.'));
        const finish=()=>{
          this.stream?.getTracks().forEach(t=>t.stop());
          const blob=new Blob(this.parts,{type:this.recorder.mimeType||'audio/webm'});
          if(!blob.size)return reject(new Error('Recording was empty.'));
          resolve(blob);
        };
        if(this.recorder.state==='inactive')return finish();
        this.recorder.onstop=finish;
        this.recorder.onerror=e=>{this.stream?.getTracks().forEach(t=>t.stop());reject(e.error||new Error('Recording failed.'));};
        try{this.recorder.requestData();}catch(e){}
        this.recorder.stop();
      });
    }
    abort(){
      try{if(this.recorder&&this.recorder.state!=='inactive')this.recorder.stop();}catch(e){}
      this.stream?.getTracks().forEach(t=>t.stop());
    }
  }

  const style=document.createElement('style');
  style.textContent=`
    .pmV129Shade{position:fixed;inset:0;z-index:17000;background:rgba(0,0,0,.4);display:flex;align-items:flex-end;justify-content:center;padding:14px}
    .pmV129Sheet{width:min(520px,100%);background:#fff;border-radius:18px;padding:16px;box-shadow:0 12px 36px rgba(0,0,0,.28)}
    .pmV129Title{font-size:17px;font-weight:900;color:var(--text);margin-bottom:3px}
    .pmV129Sub{font-size:13px;color:var(--muted);margin-bottom:12px;overflow-wrap:anywhere}
    .pmV129Sheet textarea{min-height:100px}
    .pmV129Row{display:grid;gap:8px;margin-top:10px}
    .pmV129Status{font-size:11px;color:var(--muted);margin-top:6px;min-height:14px}
  `;
  document.head.appendChild(style);

  function closePopup(){
    document.getElementById('pmV129Popup')?.remove();
    if(activeCapture){activeCapture.abort();activeCapture=null;}
    popupOpen=false;
  }

  function showFollowup(rec){
    if(popupOpen)return;
    const x=recordFor(rec.k,rec.id);
    if(!x)return;
    popupOpen=true;

    const shade=document.createElement('div');shade.id='pmV129Popup';shade.className='pmV129Shade';
    const box=document.createElement('div');box.className='pmV129Sheet';
    const title=document.createElement('div');title.className='pmV129Title';title.textContent='Call ended — add a status update?';
    const sub=document.createElement('div');sub.className='pmV129Sub';
    sub.textContent=String(x.name||'This contact')+(rec.phone?' • '+rec.phone:'');
    const noteInput=document.createElement('textarea');noteInput.placeholder='What happened on the call? (optional)';
    const audioBtn=document.createElement('button');audioBtn.type='button';audioBtn.className='secondary full';audioBtn.textContent='Record audio note';
    const status=document.createElement('div');status.className='pmV129Status';
    const row=document.createElement('div');row.className='pmV129Row';
    const saveBtn=document.createElement('button');saveBtn.type='button';saveBtn.className='primary';saveBtn.textContent='Save status update';
    const skipBtn=document.createElement('button');skipBtn.type='button';skipBtn.className='secondary';skipBtn.textContent='Skip';
    row.append(saveBtn,skipBtn);
    box.append(title,sub,noteInput,audioBtn,status,row);
    shade.appendChild(box);document.body.appendChild(shade);

    let audioBlob=null;
    let capture=null;

    audioBtn.onclick=async()=>{
      if(capture){
        audioBtn.disabled=true;
        try{
          audioBlob=await capture.stop();
          status.textContent='Audio note recorded.';
          audioBtn.textContent='Re-record audio note';
        }catch(e){
          status.textContent='Recording could not be saved.';
          audioBtn.textContent='Record audio note';
        }
        capture=null;activeCapture=null;audioBtn.disabled=false;
        return;
      }
      const c=new RecorderOnly();
      capture=c;activeCapture=c;
      try{
        await c.start();
        audioBtn.textContent='Stop recording';
        status.textContent='Recording…';
      }catch(e){
        capture=null;activeCapture=null;
        status.textContent='Microphone could not start.';
      }
    };

    function cancel(){
      if(capture){capture.abort();capture=null;activeCapture=null;}
      closePopup();
    }

    async function finishSave(){
      if(capture){
        audioBtn.disabled=true;
        try{audioBlob=await capture.stop();}catch(e){}
        capture=null;activeCapture=null;
      }
      const text=String(noteInput.value||'').trim();
      if(!text&&!audioBlob){
        status.textContent='Add a note or record audio, or tap Skip.';
        return;
      }
      saveBtn.disabled=true;skipBtn.disabled=true;
      const target=recordFor(rec.k,rec.id);
      if(!target){closePopup();return;}
      target.activities=target.activities||[];
      target.activities.push({
        id:Date.now(),
        type:'call-note',
        text,
        audio:audioBlob||undefined,
        phone:rec.phone||'',
        ts:nowStamp()
      });
      try{
        await save();
      }catch(e){
        console.warn('PeerMatch v129 call-note save',e);
        alert('PeerMatch could not save this status update.');
        saveBtn.disabled=false;skipBtn.disabled=false;
        return;
      }
      closePopup();
      try{rec.k==='shadchanim'?openS(rec.id):openP(rec.k,rec.id);}catch(e){}
      try{render();}catch(e){}
    }

    saveBtn.onclick=finishSave;
    skipBtn.onclick=cancel;
    shade.onclick=e=>{if(e.target===shade)cancel();};
  }

  function consumeIfDue(rec){
    if(!rec)return;
    const age=Date.now()-rec.ts;
    if(age<MIN_GAP_MS||age>MAX_AGE_MS)return;
    setTimeout(()=>showFollowup(rec),SHOW_DELAY_MS);
  }

  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState!=='visible')return;
    const rec=pending;
    if(!rec)return;
    clearPending();
    consumeIfDue(rec);
  });

  // Cover the case where Android reclaimed the WebView while the dialer was open,
  // so the app reloads already-visible instead of firing a visibilitychange event.
  setTimeout(()=>{
    if(!pending)return;
    const rec=pending;
    clearPending();
    consumeIfDue(rec);
  },700);
})();
