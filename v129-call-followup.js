/* PeerMatch v129: after a phone call ends, offer a quick status-update popup
   (typed note and/or a recorded audio note) for the Guy/Girl/Shadchan that was called.

   This file does not own any dialing behavior and never intercepts a click. It only
   watches, passively, for a tap on a button labeled exactly "Call" (every current
   Call owner — profile-contacts-v96.js, peermatch-v19.js, inline-phone-actions-v92.js —
   uses that exact label), then watches for the app regaining visibility afterward
   (the OS dialer closing). It never calls preventDefault/stopPropagation, so it cannot
   compete with or replace any existing Call/tel: handler.

   No browser API reports whether a phone call was actually answered — that is OS
   telephony state a web page never sees. "Answered" is therefore only a guess from
   how long PeerMatch was in the background (dialer open): short away-time usually
   means it rang out / was declined / went straight to voicemail, longer usually
   means a conversation happened. The guess is always shown as an editable Yes/No
   choice, never saved as fact without the user seeing and being able to correct it.
*/
(function(){
  document.documentElement.dataset.peerMatchVersion='129';

  const STORAGE_KEY='pmCallFollowupV129';
  const MIN_GAP_MS=600;
  const MAX_AGE_MS=3*60*60*1000;
  const SHOW_DELAY_MS=500;
  const ANSWERED_GUESS_THRESHOLD_SEC=15;

  let active=null;
  let pending=null;
  let popupOpen=false;
  let activeCapture=null;

  try{
    const raw=localStorage.getItem(STORAGE_KEY);
    if(raw)pending=JSON.parse(raw);
  }catch(e){}

  const priorOpenP=window.openP;
  if(typeof priorOpenP==='function')window.openP=function(k,id){active={k,id};const r=priorOpenP(k,id);setTimeout(mountBanner,80);return r;};
  const priorOpenS=window.openS;
  if(typeof priorOpenS==='function')window.openS=function(id){active={k:'shadchanim',id};const r=priorOpenS(id);setTimeout(mountBanner,80);return r;};

  function recordFor(k,id){return (data[k]||[]).find(x=>String(x.id)===String(id))||null;}
  function nowStamp(){return typeof stamp==='function'?stamp():new Date().toLocaleString();}
  function formatDuration(sec){
    if(sec<60)return sec+'s';
    const m=Math.floor(sec/60),s=sec%60;
    return m+'m'+(s?' '+s+'s':'');
  }

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
    .pmV129AnsweredLabel{font-size:12px;font-weight:850;color:var(--text);margin-top:12px}
    .pmV129AnsweredHint{font-size:11px;color:var(--muted);margin:2px 0 6px}
    .pmV129AnsweredRow{display:grid;grid-template-columns:1fr 1fr;gap:8px}
    .pmV129AnsweredRow button{width:100%!important;margin:0!important}
    .pmV129Reminder{display:flex;align-items:center;justify-content:space-between;gap:8px;background:#fff7dd;border:1px solid #ead79d;border-radius:11px;padding:8px 10px;margin-bottom:11px}
    .pmV129Reminder span{font-size:12px;font-weight:850;color:#76551c}
    .pmV129Reminder button{width:auto!important;min-width:0!important;margin:0!important;padding:7px 10px!important;border-radius:9px!important;font-size:11px!important;font-weight:850!important;background:#fff!important;color:#76551c!important;border:1px solid #ead79d!important}
    #sheet .pmV129Banner{background:#eaf5ec;border:1px solid #cfe5d5;border-radius:13px;padding:10px 12px;margin:8px 0 12px}
    #sheet .pmV129BannerTop{display:flex;justify-content:space-between;gap:10px;font-size:11px;color:var(--muted);margin-bottom:4px}
    #sheet .pmV129BannerMeta{font-size:11px;font-weight:850;color:#245f37;margin-bottom:4px}
    #sheet .pmV129BannerText{font-size:13px;color:var(--text);white-space:pre-wrap;line-height:1.4}
    #sheet .pmV129Banner audio{width:100%;margin-top:6px}
  `;
  document.head.appendChild(style);

  function lastCallNote(x){
    if(!x?.activities?.length)return null;
    let best=null;
    for(const a of x.activities){
      if(a.type==='call-note'&&(!best||(a.id||0)>(best.id||0)))best=a;
    }
    return best;
  }

  function bannerHTML(a){
    const bits=[];
    if(a.answered!=null)bits.push(a.answered?'Answered':'Not answered');
    if(a.durationApproxSec)bits.push('~'+formatDuration(a.durationApproxSec)+' away');
    const meta=bits.length?`<div class="pmV129BannerMeta">${esc(bits.join(' • '))}</div>`:'';
    const textPart=a.text?`<div class="pmV129BannerText">${esc(a.text)}</div>`:'';
    const audioPart=a.audio?`<audio controls src="${url(a.audio)}"></audio>`:'';
    return `<div class="pmV129BannerTop"><span>Last call status${a.phone?' • '+esc(a.phone):''}</span><span>${esc(a.ts||'')}</span></div>${meta}${textPart}${audioPart}`;
  }

  function detailInfo(){
    const sheet=document.getElementById('sheet');
    if(!sheet||!active)return null;
    if(active.k==='shadchanim'){
      const header=sheet.querySelector('.v19ShadHead');
      if(!header||document.getElementById('v19SName')||document.getElementById('esName')||document.getElementById('sn'))return null;
      return{header,x:recordFor(active.k,active.id)};
    }
    if(active.k==='guys'||active.k==='girls'){
      const header=sheet.querySelector('.v19Head');
      if(!header||sheet.querySelector('.v19ShadHead')||document.getElementById('v19Profile'))return null;
      return{header,x:recordFor(active.k,active.id)};
    }
    return null;
  }

  function mountBanner(){
    const sheet=document.getElementById('sheet');
    const info=detailInfo();
    if(!info||!info.x){sheet?.querySelectorAll('.pmV129Banner').forEach(e=>e.remove());return;}
    const note=lastCallNote(info.x);
    let banner=sheet.querySelector('.pmV129Banner');
    if(!note){banner?.remove();return;}
    const sig=String(note.id);
    if(banner&&banner.dataset.sig===sig)return;
    banner?.remove();
    banner=document.createElement('div');
    banner.className='pmV129Banner';
    banner.dataset.sig=sig;
    banner.innerHTML=bannerHTML(note);
    info.header.insertAdjacentElement('afterend',banner);
  }

  let bannerQueued=false;
  function scheduleBanner(){if(bannerQueued)return;bannerQueued=true;requestAnimationFrame(()=>{bannerQueued=false;mountBanner();});}
  new MutationObserver(scheduleBanner).observe(document.body,{childList:true,subtree:true});
  scheduleBanner();

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

    const durationSec=Math.max(0,Math.round((rec.durationMs||0)/1000));
    let answered=durationSec>=ANSWERED_GUESS_THRESHOLD_SEC;

    const shade=document.createElement('div');shade.id='pmV129Popup';shade.className='pmV129Shade';
    const box=document.createElement('div');box.className='pmV129Sheet';
    const title=document.createElement('div');title.className='pmV129Title';title.textContent='Call ended — add a status update?';
    const sub=document.createElement('div');sub.className='pmV129Sub';
    sub.textContent=String(x.name||'This contact')+(rec.phone?' • '+rec.phone:'');

    let reminderInfo=null;
    if(rec.k==='shadchanim'&&typeof window.pmCallReminderInfo==='function'){
      try{reminderInfo=window.pmCallReminderInfo(rec.id);}catch(e){}
    }
    let reminderBar=null;
    if(reminderInfo){
      reminderBar=document.createElement('div');reminderBar.className='pmV129Reminder';
      const label=document.createElement('span');label.textContent='Follow-up: Call '+(reminderInfo.label||reminderInfo.date);
      const cancelReminderBtn=document.createElement('button');cancelReminderBtn.type='button';cancelReminderBtn.textContent='Cancel follow-up';
      cancelReminderBtn.onclick=()=>{
        try{window.pmClearCallReminder(rec.id);}catch(e){console.warn('PeerMatch v129 clear reminder',e);}
        reminderBar.remove();
        status.textContent='Follow-up reminder canceled.';
      };
      reminderBar.append(label,cancelReminderBtn);
    }

    const noteInput=document.createElement('textarea');noteInput.placeholder='What happened on the call? (optional)';
    const audioBtn=document.createElement('button');audioBtn.type='button';audioBtn.className='secondary full';audioBtn.textContent='Record audio note';
    const answeredLabel=document.createElement('div');answeredLabel.className='pmV129AnsweredLabel';answeredLabel.textContent='Was the call answered?';
    const answeredHint=document.createElement('div');answeredHint.className='pmV129AnsweredHint';
    answeredHint.textContent=durationSec?`PeerMatch's best guess from being away ~${formatDuration(durationSec)} — tap to correct.`:'PeerMatch cannot detect this — tap to set it.';
    const answeredRow=document.createElement('div');answeredRow.className='pmV129AnsweredRow';
    const yesBtn=document.createElement('button');yesBtn.type='button';yesBtn.textContent='Yes';
    const noBtn=document.createElement('button');noBtn.type='button';noBtn.textContent='No';
    function paintAnswered(){yesBtn.className=answered?'primary':'secondary';noBtn.className=answered?'secondary':'primary';}
    paintAnswered();
    yesBtn.onclick=()=>{answered=true;paintAnswered();};
    noBtn.onclick=()=>{answered=false;paintAnswered();};
    answeredRow.append(yesBtn,noBtn);
    const status=document.createElement('div');status.className='pmV129Status';
    const row=document.createElement('div');row.className='pmV129Row';
    const saveBtn=document.createElement('button');saveBtn.type='button';saveBtn.className='primary';saveBtn.textContent='Save status update';
    const skipBtn=document.createElement('button');skipBtn.type='button';skipBtn.className='secondary';skipBtn.textContent='Skip';
    row.append(saveBtn,skipBtn);
    box.append(title,sub);
    if(reminderBar)box.appendChild(reminderBar);
    box.append(noteInput,audioBtn,answeredLabel,answeredHint,answeredRow,status,row);
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
      saveBtn.disabled=true;skipBtn.disabled=true;
      const target=recordFor(rec.k,rec.id);
      if(!target){closePopup();return;}
      target.activities=target.activities||[];
      const entry={id:Date.now(),type:'call-note',text,phone:rec.phone||'',answered,ts:nowStamp()};
      if(audioBlob)entry.audio=audioBlob;
      if(durationSec)entry.durationApproxSec=durationSec;
      target.activities.push(entry);
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
    rec.durationMs=age;
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
