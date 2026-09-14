/* PeerMatch stable Guided Voice overlay.
   Replaces v11 Guided Voice behavior so browser speech recognition is never
   automatically restarted after silence. This avoids repeated OS/browser mic chimes.
   User advances fields with Next. If Chrome ends recognition, user taps Resume mic. */
(function(){
  const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;

  const style=document.createElement('style');
  style.textContent=`
    .pmMicPaused{color:#7b5b13;font-weight:800}
    .pmResumeMic{width:100%;margin-top:8px;background:#fff3d9;color:#6e5011;border:1px solid #ead8aa}
  `;
  document.head.appendChild(style);

  function numberFromWords(s){
    s=String(s||'').toLowerCase().replace(/-/g,' ');
    const d=s.match(/\b(\d{1,2})\b/);if(d)return Number(d[1]);
    const ones={zero:0,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,sixteen:16,seventeen:17,eighteen:18,nineteen:19};
    const tens={twenty:20,thirty:30,forty:40,fifty:50,sixty:60,seventy:70,eighty:80,ninety:90};
    const w=s.split(/\s+/);
    for(let i=0;i<w.length;i++){
      if(tens[w[i]]!=null){const n=tens[w[i]]+(ones[w[i+1]]||0);if(n>=18&&n<=99)return n;}
      if(ones[w[i]]!=null&&ones[w[i]]>=18)return ones[w[i]];
    }
    return null;
  }

  function cleanPhoneSpeech(s){
    const raw=String(s||'').trim(),plus=/^\s*(?:plus|\+)/i.test(raw);
    const words={zero:'0',oh:'0',o:'0',one:'1',two:'2',three:'3',four:'4',five:'5',six:'6',seven:'7',eight:'8',nine:'9'};
    let digits='';
    raw.toLowerCase().replace(/[^a-z0-9+]/g,' ').split(/\s+/).filter(Boolean).forEach(p=>{
      if(/^\d+$/.test(p))digits+=p;else if(words[p]!=null)digits+=words[p];
    });
    return digits.length>=5?(plus?'+':'')+digits:'';
  }

  function announce(label){
    if(!('speechSynthesis'in window))return;
    try{
      const voices=speechSynthesis.getVoices()||[];
      const male=/\b(david|guy|mark|christopher|daniel|alex|aaron|arthur|george|james|ryan)\b|google uk english male/i;
      const v=voices.find(x=>/^en/i.test(x.lang||'')&&male.test(x.name||''))||voices.find(x=>male.test(x.name||''))||null;
      const u=new SpeechSynthesisUtterance(label);if(v)u.voice=v;u.rate=1.15;u.pitch=1;
      speechSynthesis.cancel();speechSynthesis.speak(u);
    }catch(e){}
  }

  function install(button){
    if(!button||button.dataset.stableVoice==='1')return;
    button.dataset.stableVoice='1';
    button.onclick=()=>{
      if(!SpeechRecognition){alert('Guided voice is not supported by this browser. Chrome usually works best.');return;}
      document.getElementById('pmVoicePanel')?.remove();
      const panel=document.createElement('div');panel.id='pmVoicePanel';panel.className='pmVoicePanel';button.insertAdjacentElement('afterend',panel);
      const steps=[
        {id:'pnm',label:'Name',mode:'text'},
        {id:'page',label:'Age',mode:'age'},
        {id:'pt',label:'Profile',mode:'profile'},
        {id:'psn',label:'Sender name',mode:'text'},
        {id:'psp',label:'Sender phone',mode:'phone'}
      ];
      const base=Object.fromEntries(steps.map(s=>[s.id,document.getElementById(s.id)?.value||'']));
      const buffers=steps.map(()=>[]);
      let index=0,recog=null,stopped=false,listening=false,interim='';

      function current(){return steps[index];}
      function updateField(){
        const s=current(),el=document.getElementById(s.id);if(!el)return;
        const heard=buffers[index].join(' ').trim();if(!heard)return;
        if(s.mode==='age'){const n=numberFromWords(heard);if(n)el.value=String(n);}
        else if(s.mode==='phone'){const p=cleanPhoneSpeech(heard);if(p)el.value=p;}
        else if(s.mode==='profile')el.value=[base[s.id],heard].filter(Boolean).join(base[s.id]?'\n':'');
        else el.value=heard;
        el.dispatchEvent(new Event('input',{bubbles:true}));
      }

      function draw(){
        if(stopped)return;
        const s=current();
        const mic=listening
          ?'<span class="pmMicOn"><span class="pmMicDot"></span>Mic on</span>'
          :'<span class="pmMicPaused">Mic paused</span>';
        panel.innerHTML=`<div class="pmVoiceTop"><span>Field ${index+1} of ${steps.length}</span>${mic}</div><div class="pmVoiceField">${esc(s.label)}</div><div class="pmVoiceHeard">${buffers[index].length?'Heard: '+esc(buffers[index].join(' ')):'Speak normally. Tap Next when this field is finished.'}${interim?'<br><b>Hearing:</b> '+esc(interim):''}</div>${listening?'':'<button id="pmVoiceResume" class="pmResumeMic">Resume mic</button>'}<div class="pmVoiceNav"><button id="pmVoiceBack" class="secondary" ${index===0?'disabled':''}>Back</button><button id="pmVoiceNext" class="primary">${index===steps.length-1?'Done':'Next'}</button><button id="pmVoiceStop" class="secondary">Stop</button></div>`;
        if(document.getElementById('pmVoiceResume'))document.getElementById('pmVoiceResume').onclick=startRecognition;
        document.getElementById('pmVoiceBack').onclick=()=>{if(index>0){updateField();index--;interim='';draw();announce(current().label);}};
        document.getElementById('pmVoiceNext').onclick=()=>{updateField();if(index===steps.length-1){stop(true);return;}index++;interim='';draw();announce(current().label);};
        document.getElementById('pmVoiceStop').onclick=()=>stop(false);
      }

      function stop(done){
        stopped=true;listening=false;
        try{recog?.abort()}catch(e){}
        try{speechSynthesis?.cancel()}catch(e){}
        if(done){panel.innerHTML='<div class="pmVoiceField">✓ Voice entry complete</div><div class="pmVoiceHeard">Review the fields, then use Save below.</div>';setTimeout(()=>panel.remove(),900);}else panel.remove();
      }

      function startRecognition(){
        if(stopped||listening)return;
        recog=new SpeechRecognition();
        recog.lang='en-US';recog.continuous=true;recog.interimResults=true;recog.maxAlternatives=1;
        recog.onstart=()=>{listening=true;draw();};
        recog.onresult=e=>{
          interim='';
          for(let n=e.resultIndex;n<e.results.length;n++){
            const t=(e.results[n]?.[0]?.transcript||'').trim();if(!t)continue;
            if(e.results[n].isFinal){buffers[index].push(t);updateField();}else interim+=(interim?' ':'')+t;
          }
          draw();
        };
        recog.onerror=e=>{
          if(stopped||e.error==='aborted')return;
          if(e.error==='not-allowed'||e.error==='service-not-allowed'){
            stopped=true;panel.innerHTML='<div class="pmVoiceField">Microphone permission is blocked</div><div class="pmVoiceHeard">Allow microphone access and try again.</div>';return;
          }
          listening=false;draw();
        };
        recog.onend=()=>{
          if(stopped)return;
          listening=false;
          interim='';
          draw();
          /* Intentionally NO automatic restart. Chrome may end recognition after silence.
             User resumes explicitly, preventing repeated mic start chimes. */
        };
        try{recog.start();}catch(e){listening=false;draw();}
      }

      draw();
      startRecognition();
      announce(current().label);
    };
  }

  function scan(){install(document.getElementById('pmGuidedVoice'));}
  new MutationObserver(scan).observe(document.body,{childList:true,subtree:true});
  setInterval(scan,500);
  scan();
})();
