/* PeerMatch v24: recording only. No transcription and no transcription backend. */
(function(){
  document.documentElement.dataset.peerMatchVersion='24';

  const SENTINEL='__PEERMATCH_AUDIO_ONLY__';
  let activeProfile=null;
  let activeCapture=null;

  const style=document.createElement('style');
  style.textContent=`
    .v24RecordingStatus{margin-top:5px;font-size:11px;color:var(--muted)}
    .pmSelectionBar .v24SelectAll{padding:8px 10px;font-size:12px;border-radius:10px}
  `;
  document.head.appendChild(style);

  function kindFromHeading(){
    const h=(document.querySelector('#sheet h2')?.textContent||'').trim();
    if(/Guy/i.test(h))return {k:'guys',label:'Guy'};
    if(/Girl/i.test(h))return {k:'girls',label:'Girl'};
    return null;
  }

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

  async function persist(){
    try{await save();}catch(e){console.warn('PeerMatch v24 save',e);}
  }

  const priorOpenP=window.openP;
  window.openP=openP=function(k,id){
    activeProfile={k,id};
    const r=priorOpenP(k,id);
    setTimeout(()=>{
      document.querySelectorAll('.v19ProfileAudio .v19AudioText').forEach(el=>el.remove());
    },20);
    return r;
  };

  function bindAudioProfile(){
    const old=document.getElementById('v19ProfileAudio');
    const saveBtn=document.getElementById('v19Save');
    const profile=document.getElementById('v19Profile');
    if(!old||!saveBtn||!profile||old.dataset.v24Bound==='1')return;

    const info=kindFromHeading();
    if(!info)return;

    const heading=(document.querySelector('#sheet h2')?.textContent||'').trim();
    const isEdit=/^Edit\b/i.test(heading);
    const editId=isEdit&&activeProfile?.k===info.k?activeProfile.id:null;
    const existing=isEdit&&editId!=null?data[info.k]?.find(x=>x.id===editId):null;
    const beforeCount=(data[info.k]||[]).length;

    const btn=old.cloneNode(true);
    old.replaceWith(btn);
    btn.dataset.v24Bound='1';

    const transcriptBox=document.getElementById('v19AudioText');
    if(transcriptBox)transcriptBox.style.display='none';

    let audioBlob=existing?.profileAudio||null;
    let changed=false;
    let capture=null;
    btn.textContent=audioBlob?'Replace audio':'Audio profile';

    let status=document.getElementById('v24RecordingStatus');
    if(!status){
      status=document.createElement('div');
      status.id='v24RecordingStatus';
      status.className='v24RecordingStatus';
      btn.insertAdjacentElement('afterend',status);
    }

    async function finish(){
      if(!capture)return;
      btn.textContent='Saving audio…';
      const c=capture;
      capture=null;
      activeCapture=null;
      try{
        audioBlob=await c.stop();
        changed=true;
        btn.classList.remove('recording');
        btn.textContent='Audio saved';
        status.textContent='Recording saved';
      }catch(e){
        btn.classList.remove('recording');
        btn.textContent=audioBlob?'Replace audio':'Audio profile';
        status.textContent='Recording could not be saved';
        alert('The audio recording could not be saved. Please record again.');
      }
    }

    btn.onclick=async()=>{
      if(capture){await finish();return;}
      if(activeCapture)return;
      const c=new RecorderOnly();
      capture=c;
      activeCapture=c;
      try{
        await c.start();
        btn.classList.add('recording');
        btn.textContent='Stop audio';
        status.textContent='Recording…';
      }catch(e){
        capture=null;
        activeCapture=null;
        c.abort();
        status.textContent='Microphone could not start';
        alert('Audio recording could not start.');
      }
    };

    saveBtn.addEventListener('click',async e=>{
      if(capture){
        e.preventDefault();
        e.stopImmediatePropagation();
        await finish();
        saveBtn.click();
        return;
      }

      const profileWasBlank=!profile.value.trim();
      if(audioBlob&&!isEdit&&profileWasBlank){
        // The v19 form validator does not know about the v24 recording state.
        // Use a temporary value only long enough to let its normal Save finish.
        profile.value=SENTINEL;
      }

      if(!audioBlob)return;

      setTimeout(async()=>{
        try{
          let target=null;
          if(isEdit&&editId!=null)target=data[info.k]?.find(x=>x.id===editId)||null;
          else if((data[info.k]||[]).length>beforeCount)target=data[info.k][0]||null;
          if(!target)return;

          target.profileAudio=audioBlob;
          if(changed){
            target.profileAudioText='';
            delete target.profileAudioTranscriptionStatus;
            delete target.profileAudioTranscriptionError;
            delete target.profileAudioTranscriptionAttempts;
          }

          if(String(target.text||'').trim()===SENTINEL)target.text='';
          if(String(target.name||'').trim()===SENTINEL||!String(target.name||'').trim())target.name=info.label+' profile';
          await persist();
          try{renderP(info.k);}catch(e){}
        }catch(err){console.warn('PeerMatch v24 profile audio save',err);}
      },450);
    },true);
  }

  // Recording-only audio notes for Guys, Girls and Shadchanim.
  window.audio=audio=async function(k,id){
    const x=item(k,id);
    if(!x||activeCapture)return;
    const b=document.getElementById('v19Audio');
    if(b)b.textContent='Starting…';
    const c=new RecorderOnly();
    activeCapture=c;
    try{
      await c.start();
      if(b){
        b.textContent='Stop audio';
        b.onclick=async()=>{
          b.textContent='Saving audio…';
          try{
            const blob=await c.stop();
            activeCapture=null;
            x.activities=x.activities||[];
            x.activities.push({id:Date.now(),type:'audio',audio:blob,ts:stamp()});
            await persist();
            try{k==='shadchanim'?openS(id):openP(k,id);}catch(e){}
            try{render();}catch(e){}
          }catch(e){
            activeCapture=null;
            b.textContent='Audio note';
            alert('The audio recording could not be saved. Please record again.');
          }
        };
      }
    }catch(e){
      activeCapture=null;
      c.abort();
      if(b)b.textContent='Audio note';
      alert('Audio recording could not start.');
    }
  };

  // Do not show transcription UI for audio notes. Existing transcript data is left untouched in storage.
  window.acts=acts=function(x){
    if(!x.activities?.length)return'<div class="empty">No contact history yet.</div>';
    return [...x.activities].reverse().map(a=>{
      if(a.type==='call-note'){
        const parts=[];
        if(a.answered!=null){
          const dur=a.durationApproxSec?` (~${a.durationApproxSec<60?a.durationApproxSec+'s':Math.floor(a.durationApproxSec/60)+'m '+(a.durationApproxSec%60)+'s'} away)`:'';
          parts.push(`<div class="small">${a.answered?'Answered':'Not answered'}${dur}</div>`);
        }
        if(a.text)parts.push(`<div class="profileText">${esc(a.text)}</div>`);
        if(a.audio)parts.push(`<audio controls src="${url(a.audio)}"></audio>`);
        return `<div class="event"><div class="eventTop"><span>Call status update${a.phone?' • '+esc(a.phone):''}</span><span>${esc(a.ts||'')}</span></div>${parts.join('')||'<div class="small">No details recorded.</div>'}</div>`;
      }
      if(a.type==='audio'){
        return `<div class="event"><div class="eventTop"><span>Audio note</span><span>${esc(a.ts||'')}</span></div>${a.audio?`<audio controls src="${url(a.audio)}"></audio>`:'<div class="small">Audio unavailable.</div>'}</div>`;
      }
      if(a.type==='wa-out')return `<div class="event waOut"><div class="eventTop"><span>You → WhatsApp</span><span>${esc(a.ts||'')}</span></div><div class="profileText">${esc(a.text||'')}</div></div>`;
      if(a.type==='wa-in')return `<div class="event waIn"><div class="eventTop"><span>WhatsApp → You</span><span>${esc(a.ts||'')}</span></div><div class="profileText">${esc(a.text||'')}</div></div>`;
      if(a.type==='sms-out')return `<div class="event"><div class="eventTop"><span>You → SMS</span><span>${esc(a.ts||'')}</span></div><div class="profileText">${esc(a.text||'')}</div></div>`;
      if(a.type==='email-out')return `<div class="event"><div class="eventTop"><span>You → Email</span><span>${esc(a.ts||'')}</span></div><div class="profileText">${esc(a.text||'')}</div></div>`;
      return `<div class="event"><div class="eventTop"><span>${esc(a.type==='action'?(a.action||'Action'):'Note')}</span><span>${esc(a.ts||'')}</span></div><div class="profileText">${esc(a.text||'')}</div></div>`;
    }).join('');
  };

  function addSelectAll(){
    document.querySelectorAll('.pmSelectionBar').forEach(bar=>{
      if(bar.querySelector('.v24SelectAll'))return;
      const m=(bar.id||'').match(/^pmSelected-(guys|girls|shadchanim)$/);
      if(!m)return;
      const k=m[1];
      const btn=document.createElement('button');
      btn.type='button';
      btn.className='secondary v24SelectAll';
      btn.textContent='Select all';
      const count=bar.querySelector('.pmCount');
      if(count)count.insertAdjacentElement('afterend',btn);else bar.prepend(btn);
      btn.onclick=()=>{
        const list=document.getElementById(k==='shadchanim'?'shadchanList':k+'List');
        if(!list)return;
        let guard=0;
        while(guard++<2000){
          const unchecked=list.querySelector('.pmListCheck:not(:checked)');
          if(!unchecked)break;
          unchecked.click();
        }
      };
    });
  }

  function scan(){
    bindAudioProfile();
    addSelectAll();
    document.querySelectorAll('.v19ProfileAudio .v19AudioText').forEach(el=>el.remove());
  }

  new MutationObserver(scan).observe(document.body,{childList:true,subtree:true});
  setInterval(scan,400);
  scan();
})();
