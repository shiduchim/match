/* PeerMatch Continuous Guided Voice Entry
   One microphone session for Name, Age, Profile, Sender name, and Sender phone.
   No text-to-speech prompts. The screen shows the current question. */
(function(){
  const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  const baseAddP=window.addP||addP;

  const style=document.createElement('style');
  style.textContent=`
    .gvBtn{margin-bottom:8px;background:#315b78;color:#fff}
    .gvPanel{background:#fff;border:1px solid var(--line);border-radius:16px;padding:12px;margin:8px 0 12px}
    .gvStep{font-size:12px;color:var(--muted);font-weight:700;display:flex;justify-content:space-between;gap:10px;align-items:center}
    .gvQuestion{font-size:18px;font-weight:800;margin:7px 0;color:var(--text)}
    .gvHeard{font-size:13px;color:var(--muted);min-height:18px;margin-top:5px;line-height:1.4}
    .gvActions{display:flex;gap:8px;margin-top:10px}.gvActions button{flex:1;padding:9px 10px}
    .gvMic{display:inline-flex;align-items:center;gap:6px;color:#8c2f2f;font-weight:800}
    .gvDot{display:inline-block;width:9px;height:9px;border-radius:50%;background:#b33;animation:gvPulse 1s infinite}
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
      if(tens[w[i]]!=null){
        const n=tens[w[i]]+(ones[w[i+1]]||0);
        if(n>=18&&n<=99)return n;
      }
      if(ones[w[i]]!=null){
        const n=ones[w[i]];
        if(n>=18&&n<=99)return n;
      }
    }
    return null;
  }

  function cleanPhoneSpeech(s){
    const raw=String(s||'').trim();
    const plus=/^\s*(?:plus|\+)/i.test(raw);
    const digitWords={zero:'0',oh:'0',o:'0',one:'1',two:'2',three:'3',four:'4',five:'5',six:'6',seven:'7',eight:'8',nine:'9'};
    const parts=raw.toLowerCase().replace(/[^a-z0-9+]/g,' ').split(/\s+/).filter(Boolean);
    let digits='';
    parts.forEach(p=>{
      if(/^\d+$/.test(p))digits+=p;
      else if(digitWords[p]!=null)digits+=digitWords[p];
    });
    if(digits.length<5)return '';
    return (plus?'+':'')+digits;
  }

  function enhanceGuidedVoice(){
    const quick=document.getElementById('pmVoiceFill');
    if(!quick||document.getElementById('pmGuidedVoice'))return;
    quick.textContent='🎙 Quick Voice — all at once';

    const guided=document.createElement('button');
    guided.id='pmGuidedVoice';
    guided.className='full gvBtn';
    guided.textContent='🎤 Continuous Guided Voice';
    quick.parentNode.insertBefore(guided,quick);

    const status=document.getElementById('pmVoiceStatus');
    if(status)status.textContent='Continuous Guided Voice keeps the microphone on and shows each question on screen. No talking assistant.';
    guided.onclick=startGuide;
  }

  function startGuide(){
    if(!SpeechRecognition){
      alert('Continuous voice entry is not supported by this browser. Chrome on Android or desktop usually works best.');
      return;
    }

    const quick=document.getElementById('pmVoiceFill');
    const guided=document.getElementById('pmGuidedVoice');
    if(quick)quick.classList.add('hidden');
    if(guided)guided.classList.add('hidden');

    const old=document.getElementById('gvPanel');
    if(old)old.remove();
    const panel=document.createElement('div');
    panel.id='gvPanel';panel.className='gvPanel';
    const anchor=document.getElementById('pmVoiceStatus');
    (anchor?.parentNode||document.getElementById('sheet')).insertBefore(panel,anchor||null);

    const steps=[
      {field:'pnm',question:'Say the name',hint:'Say just the name. This field advances automatically.',mode:'short',apply:t=>t.trim()},
      {field:'page',question:'Say the age',hint:'For example: “thirty five”. This field advances automatically.',mode:'age',apply:t=>{const n=numberFromWords(t);return n&&n>=18&&n<=99?String(n):'';}},
      {field:'pt',question:'Tell me the profile',hint:'Keep talking as long as you want. Say “next” when the profile is finished.',mode:'profile',apply:t=>t.trim()},
      {field:'psn',question:'Who sent you this profile?',hint:'Say the sender’s name. This field advances automatically.',mode:'short',apply:t=>t.trim()},
      {field:'psp',question:'What is the sender’s phone number?',hint:'Say the digits. This is the last field.',mode:'phone',apply:t=>cleanPhoneSpeech(t)}
    ];

    let i=0;
    let recognition=null;
    let stopped=false;
    let completed=false;
    let restartTimer=null;
    let interim='';

    function commandOf(text){
      return String(text||'').toLowerCase().replace(/[.,!?;:]+/g,'').trim();
    }

    function restore(){
      stopped=true;
      clearTimeout(restartTimer);
      try{recognition?.stop()}catch(e){}
      panel.remove();
      if(quick)quick.classList.remove('hidden');
      if(guided)guided.classList.remove('hidden');
    }

    function finish(){
      if(completed)return;
      completed=true;
      stopped=true;
      clearTimeout(restartTimer);
      try{recognition?.stop()}catch(e){}
      panel.innerHTML='<div class="gvQuestion">✓ Voice entry complete</div><div class="gvHeard">Review the fields below, make any corrections, then tap Save.</div><div class="gvActions"><button id="gvDone" class="primary">Done</button></div>';
      document.getElementById('gvDone').onclick=restore;
    }

    function draw(message){
      if(completed)return;
      const s=steps[i];
      panel.innerHTML=`<div class="gvStep"><span>Step ${i+1} of ${steps.length}</span><span class="gvMic"><span class="gvDot"></span>Mic on</span></div><div class="gvQuestion">${s.question}</div><div class="gvHeard">${message||s.hint}${interim?'<br><b>Hearing:</b> '+esc(interim):''}</div><div class="gvActions"><button id="gvSkip" class="secondary">Skip</button><button id="gvNext" class="secondary">Next</button><button id="gvStop" class="secondary">Stop</button></div>`;
      document.getElementById('gvSkip').onclick=advance;
      document.getElementById('gvNext').onclick=advance;
      document.getElementById('gvStop').onclick=restore;
    }

    function setField(s,value){
      if(!value)return;
      const el=document.getElementById(s.field);
      if(!el)return;
      if(s.mode==='profile'&&el.value.trim())el.value=el.value.trim()+'\n'+value;
      else el.value=value;
      el.dispatchEvent(new Event('input',{bubbles:true}));
    }

    function advance(){
      if(completed||stopped)return;
      interim='';
      i++;
      if(i>=steps.length){finish();return;}
      draw();
    }

    function handleFinal(text){
      if(stopped||completed)return;
      const heard=String(text||'').trim();
      if(!heard)return;
      const cmd=commandOf(heard);
      const s=steps[i];

      if(cmd==='stop'||cmd==='cancel'){
        restore();
        return;
      }
      if(cmd==='skip'){
        advance();
        return;
      }
      if(cmd==='next'||cmd==='continue'||cmd==='next field'){
        advance();
        return;
      }
      if(cmd==='done'||cmd==='finish'){
        if(s.mode==='profile')advance();
        else finish();
        return;
      }

      const value=s.apply(heard);
      if(s.mode==='age'&&!value){
        draw('I heard “'+esc(heard)+'”, but could not recognize an age from 18 to 99. Say the age again.');
        return;
      }
      if(s.mode==='phone'&&!value){
        draw('I heard “'+esc(heard)+'”, but could not recognize a phone number. Say the digits again.');
        return;
      }

      if(s.mode==='profile'){
        setField(s,value);
        draw('Added: '+esc(heard)+' — keep talking, or say “next” when finished.');
        return;
      }

      setField(s,value);
      draw('Heard: '+esc(heard));
      setTimeout(()=>{
        if(!stopped&&!completed)advance();
      },250);
    }

    function startRecognition(){
      if(stopped||completed)return;
      recognition=new SpeechRecognition();
      recognition.lang=document.documentElement.lang||'en-US';
      recognition.continuous=true;
      recognition.interimResults=true;
      recognition.maxAlternatives=1;

      recognition.onresult=e=>{
        interim='';
        for(let n=e.resultIndex;n<e.results.length;n++){
          const t=e.results[n]?.[0]?.transcript||'';
          if(e.results[n].isFinal)handleFinal(t);
          else interim+=t;
        }
        if(!stopped&&!completed)draw();
      };

      recognition.onerror=e=>{
        if(stopped||completed||e.error==='aborted')return;
        if(e.error==='not-allowed'||e.error==='service-not-allowed'){
          stopped=true;
          panel.innerHTML='<div class="gvQuestion">Microphone permission is blocked</div><div class="gvHeard">Allow microphone access in the browser, then try again.</div><div class="gvActions"><button id="gvDone" class="secondary">Close</button></div>';
          document.getElementById('gvDone').onclick=restore;
          return;
        }
        draw('Microphone briefly disconnected. Reconnecting…');
      };

      recognition.onend=()=>{
        if(stopped||completed)return;
        restartTimer=setTimeout(()=>{
          if(!stopped&&!completed)startRecognition();
        },120);
      };

      try{
        recognition.start();
        draw();
      }catch(e){
        restartTimer=setTimeout(startRecognition,250);
      }
    }

    draw();
    startRecognition();
  }

  window.addP=addP=function(k,shared){
    baseAddP(k,shared);
    setTimeout(enhanceGuidedVoice,0);
  };

  setTimeout(()=>{
    try{
      const g=document.getElementById('addGuy'),l=document.getElementById('addGirl');
      if(g)g.onclick=()=>addP('guys');
      if(l)l.onclick=()=>addP('girls');
    }catch(e){console.warn('Continuous guided voice init',e)}
  },850);
})();
