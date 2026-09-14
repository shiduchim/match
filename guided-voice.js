/* PeerMatch Guided Voice Entry
   Walks through Name, Age, Profile, and Who sent it / phone one field at a time. */
(function(){
  const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  const baseAddP=window.addP||addP;

  const style=document.createElement('style');
  style.textContent=`
    .gvBtn{margin-bottom:8px;background:#315b78;color:#fff}
    .gvPanel{background:#fff;border:1px solid var(--line);border-radius:16px;padding:12px;margin:8px 0 12px}
    .gvStep{font-size:12px;color:var(--muted);font-weight:700}
    .gvQuestion{font-size:18px;font-weight:800;margin:5px 0;color:var(--text)}
    .gvHeard{font-size:13px;color:var(--muted);min-height:18px;margin-top:5px}
    .gvActions{display:flex;gap:8px;margin-top:9px}.gvActions button{flex:1;padding:9px 10px}
    .gvListening{display:inline-block;width:8px;height:8px;border-radius:50%;background:#b33;margin-right:6px;animation:gvPulse 1s infinite}
    @keyframes gvPulse{0%,100%{opacity:.35}50%{opacity:1}}
  `;
  document.head.appendChild(style);

  function numberFromWords(s){
    s=String(s||'').toLowerCase().replace(/-/g,' ');
    const digit=s.match(/\b(\d{1,2})\b/);
    if(digit)return Number(digit[1]);
    const ones={zero:0,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,sixteen:16,seventeen:17,eighteen:18,nineteen:19};
    const tens={twenty:20,thirty:30,forty:40,fifty:50,sixty:60,seventy:70,eighty:80,ninety:90};
    const w=s.split(/\s+/);
    for(let i=0;i<w.length;i++){
      if(ones[w[i]]!=null){const n=ones[w[i]];if(n>=18&&n<=99)return n;}
      if(tens[w[i]]!=null){let n=tens[w[i]]+(ones[w[i+1]]||0);if(n>=18&&n<=99)return n;}
    }
    return null;
  }

  function speakThen(text,after){
    const run=()=>setTimeout(after,250);
    try{
      if(!('speechSynthesis'in window))return run();
      speechSynthesis.cancel();
      const u=new SpeechSynthesisUtterance(text);
      u.rate=.96;
      u.onend=run;u.onerror=run;
      speechSynthesis.speak(u);
    }catch(e){run();}
  }

  function enhanceGuidedVoice(){
    const quick=document.getElementById('pmVoiceFill');
    if(!quick||document.getElementById('pmGuidedVoice'))return;
    quick.textContent='🎙 Quick Voice — all at once';
    quick.classList.remove('primary');

    const guided=document.createElement('button');
    guided.id='pmGuidedVoice';
    guided.className='full gvBtn';
    guided.textContent='🎤 Guided Voice Entry';
    quick.parentNode.insertBefore(guided,quick);

    const status=document.getElementById('pmVoiceStatus');
    if(status)status.textContent='Guided Voice asks you each question separately. Quick Voice lets you say everything in one sentence.';

    guided.onclick=()=>startGuide();
  }

  function startGuide(){
    if(!SpeechRecognition){
      alert('Guided Voice is not supported by this browser. Chrome on Android or desktop usually works best.');
      return;
    }
    const quick=document.getElementById('pmVoiceFill');
    if(quick)quick.classList.add('hidden');
    const guided=document.getElementById('pmGuidedVoice');
    if(guided)guided.classList.add('hidden');

    let old=document.getElementById('gvPanel'); if(old)old.remove();
    const panel=document.createElement('div');
    panel.id='gvPanel';panel.className='gvPanel';
    const anchor=document.getElementById('pmVoiceStatus');
    (anchor?.parentNode||document.getElementById('sheet')).insertBefore(panel,anchor||null);

    const steps=[
      {field:'pnm',question:'What is the name?',spoken:'What is the name?',apply:t=>t.trim()},
      {field:'page',question:'What is the age?',spoken:'What is the age?',apply:t=>{const n=numberFromWords(t);return n&&n>=18&&n<=99?String(n):'';}},
      {field:'pt',question:'Tell me the profile.',spoken:'Tell me the profile.',apply:t=>t.trim()},
      {field:'ps',question:'Who sent this profile? Say their name and phone number.',spoken:'Who sent this profile? Say their name and phone number.',apply:t=>t.trim()}
    ];
    let i=0,recognition=null,stopped=false;

    function restore(){
      stopped=true;
      try{recognition?.abort()}catch(e){}
      try{speechSynthesis?.cancel()}catch(e){}
      panel.remove();
      if(quick)quick.classList.remove('hidden');
      if(guided)guided.classList.remove('hidden');
    }

    function draw(message,listening){
      const s=steps[i];
      panel.innerHTML=`<div class="gvStep">Step ${i+1} of ${steps.length}</div><div class="gvQuestion">${listening?'<span class="gvListening"></span>':''}${s.question}</div><div class="gvHeard">${message||'PeerMatch will ask, then listen for your answer.'}</div><div class="gvActions"><button id="gvSkip" class="secondary">Skip</button><button id="gvStop" class="secondary">Stop</button></div>`;
      document.getElementById('gvSkip').onclick=()=>{try{recognition?.abort()}catch(e){};next();};
      document.getElementById('gvStop').onclick=restore;
    }

    function next(){
      if(stopped)return;
      i++;
      if(i>=steps.length){
        panel.innerHTML='<div class="gvQuestion">✓ Voice entry complete</div><div class="gvHeard">Review the four fields below, make any corrections, then tap Save.</div><div class="gvActions"><button id="gvDone" class="primary">Done</button></div>';
        document.getElementById('gvDone').onclick=restore;
        try{speechSynthesis?.speak(new SpeechSynthesisUtterance('Done. Please review the profile before saving.'))}catch(e){}
        return;
      }
      ask();
    }

    function listen(){
      if(stopped)return;
      const s=steps[i];
      recognition=new SpeechRecognition();
      recognition.lang=document.documentElement.lang||'en-US';
      recognition.interimResults=false;
      recognition.maxAlternatives=1;
      let got=false;
      draw('Listening…',true);
      recognition.onresult=e=>{
        got=true;
        const heard=e.results?.[0]?.[0]?.transcript||'';
        const value=s.apply(heard);
        if(s.field==='page'&&!value){
          draw('I heard “'+heard+'”, but I could not find an age from 18 to 99. Tap the question again by using Retry below.',false);
          const actions=panel.querySelector('.gvActions');
          const retry=document.createElement('button');retry.className='secondary';retry.textContent='Retry';retry.onclick=ask;actions.insertBefore(retry,actions.firstChild);
          return;
        }
        if(value){
          const el=document.getElementById(s.field);
          if(el){
            if(s.field==='pt'&&el.value.trim())el.value=el.value.trim()+'\n'+value;
            else el.value=value;
            el.dispatchEvent(new Event('input',{bubbles:true}));
          }
        }
        draw('Heard: '+heard,false);
        setTimeout(next,650);
      };
      recognition.onerror=e=>{
        if(stopped||e.error==='aborted')return;
        draw('I did not catch that. Tap Retry or Skip.',false);
        const actions=panel.querySelector('.gvActions');
        const retry=document.createElement('button');retry.className='secondary';retry.textContent='Retry';retry.onclick=ask;actions.insertBefore(retry,actions.firstChild);
      };
      recognition.onend=()=>{
        if(!got&&!stopped&&panel.isConnected&&!panel.querySelector('button:first-child')?.textContent?.includes('Retry')){
          // onerror usually handles this; keep the current question visible otherwise.
        }
      };
      try{recognition.start()}catch(e){draw('Microphone could not start. Tap Retry.',false);}
    }

    function ask(){
      if(stopped)return;
      draw('',false);
      speakThen(steps[i].spoken,listen);
    }

    ask();
  }

  window.addP=addP=function(k,shared){
    baseAddP(k,shared);
    setTimeout(enhanceGuidedVoice,0);
  };

  // Rebind existing Add buttons to the wrapped addP.
  setTimeout(()=>{
    try{
      const g=document.getElementById('addGuy'),l=document.getElementById('addGirl');
      if(g)g.onclick=()=>addP('guys');
      if(l)l.onclick=()=>addP('girls');
    }catch(e){console.warn('Guided voice init',e)}
  },850);
})();
