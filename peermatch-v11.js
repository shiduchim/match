/* PeerMatch v11 workflow/UI
   - Guy/Girl profiles may be text, a screenshot/image, or both.
   - Guided voice advances only when the user taps Next; mic reconnects silently.
   - Add/Edit forms use fixed Save / Cancel controls.
   - Every Guy, Girl and Shadchan row has a checkbox; selected rows can be emailed,
     copied or deleted without entering a separate select mode.
   - Profile and Shadchan detail screens keep Text note / Audio note / Close fixed.
*/
(function(){
  const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  const selected={guys:new Set(),girls:new Set(),shadchanim:new Set()};

  const css=document.createElement('style');
  css.textContent=`
    .pmGrid{display:grid;grid-template-columns:1fr 105px;gap:9px}
    .pmSourceGrid{display:grid;grid-template-columns:1fr 1fr;gap:9px}
    .pmMeta{display:flex;gap:6px;flex-wrap:wrap}
    .pmPill{display:inline-block;background:#eef3f6;border-radius:999px;padding:3px 8px;font-size:12px;color:#315b78;margin-top:4px}
    .pmListCheck{width:22px!important;height:22px!important;min-width:22px;margin:0;accent-color:var(--accent);cursor:pointer}
    .card.pmSelected{outline:2px solid var(--accent);background:#f5f9fb}
    .pmSelectionBar{display:flex;gap:7px;align-items:center;flex-wrap:wrap;margin:8px 0 5px;padding:8px 9px;background:#fff;border:1px solid var(--line);border-radius:13px}
    .pmSelectionBar .pmCount{font-size:12px;font-weight:800;color:var(--muted);margin-right:auto}
    .pmSelectionBar button{padding:8px 10px;font-size:12px;border-radius:10px}
    .pmDanger{background:#fbe7e7;color:#8a2929}
    .pmProfileImage{display:block;width:100%;max-height:70vh;object-fit:contain;background:#fff;border:1px solid var(--line);border-radius:14px;margin:8px 0 12px}
    .pmImagePreview{display:block;max-width:100%;max-height:250px;object-fit:contain;background:#fff;border:1px solid var(--line);border-radius:12px;margin:8px auto}
    .pmInlineCheck{display:flex;align-items:center;gap:8px}.pmInlineCheck input{width:auto!important}
    .pmVoiceStart{margin:5px 0 7px;background:#315b78;color:#fff}
    .pmVoicePanel{background:#fff;border:1px solid var(--line);border-radius:15px;padding:11px;margin:7px 0 12px}
    .pmVoiceTop{display:flex;justify-content:space-between;align-items:center;gap:10px;font-size:12px;color:var(--muted);font-weight:800}
    .pmVoiceField{font-size:20px;font-weight:850;margin:6px 0}
    .pmVoiceHeard{font-size:13px;color:var(--muted);min-height:20px;line-height:1.4}
    .pmMicOn{color:#8c2f2f}.pmMicDot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#b33;margin-right:5px;animation:pmPulse 1s infinite}
    @keyframes pmPulse{0%,100%{opacity:.35}50%{opacity:1}}
    .pmVoiceNav{display:grid;grid-template-columns:.8fr 1fr .8fr;gap:7px;margin-top:9px}.pmVoiceNav button{padding:9px 7px;font-size:13px}
    .pmFixedForm,.pmFixedDetail{position:fixed;left:50%;bottom:max(9px,env(safe-area-inset-bottom));transform:translateX(-50%);width:min(590px,calc(100% - 20px));z-index:95;display:grid;gap:7px;padding:8px;background:rgba(255,255,255,.97);border:1px solid var(--line);border-radius:15px;box-shadow:0 4px 18px rgba(0,0,0,.16);backdrop-filter:blur(10px)}
    .pmFixedForm{grid-template-columns:1.25fr .75fr}.pmFixedDetail{grid-template-columns:1fr 1fr .72fr}
    .pmFixedForm button,.pmFixedDetail button{padding:9px 8px;min-height:38px;border-radius:10px;font-size:13px;font-weight:800}
    .pmFixedSave,.pmFixedClose{background:#315b78;color:#fff}.pmFixedCancel,.pmFixedText,.pmFixedAudio{background:#eef3f6;color:var(--text)}
    .sheet.pmBottomBar{padding-bottom:82px}
    .pmEditShadchan{width:100%;margin:9px 0 3px}
    @media(max-width:430px){.pmGrid{grid-template-columns:1fr 92px}.pmSourceGrid{grid-template-columns:1fr}.pmSelectionBar button{padding:7px 8px}.pmFixedForm,.pmFixedDetail{width:calc(100% - 16px);gap:6px;padding:7px}}
  `;
  document.head.appendChild(css);

  function senderName(x){return String(x.sourceName||x.source||'').trim();}
  function senderPhone(x){return String(x.sourcePhone||'').trim();}
  function deriveAge(text){
    const s=String(text||'');
    const m=s.match(/\bage\s*(?:is|:|-)?\s*(\d{2})\b/i)||s.match(/\b(\d{2})\s*(?:years?\s*old|yo)\b/i);
    if(!m)return'';const n=Number(m[1]);return n>=18&&n<=99?String(n):'';
  }
  function numberFromWords(s){
    s=String(s||'').toLowerCase().replace(/-/g,' ');
    const d=s.match(/\b(\d{1,2})\b/);if(d)return Number(d[1]);
    const ones={zero:0,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,sixteen:16,seventeen:17,eighteen:18,nineteen:19};
    const tens={twenty:20,thirty:30,forty:40,fifty:50,sixty:60,seventy:70,eighty:80,ninety:90};
    const w=s.split(/\s+/);
    for(let i=0;i<w.length;i++){if(tens[w[i]]!=null){const n=tens[w[i]]+(ones[w[i+1]]||0);if(n>=18&&n<=99)return n;}if(ones[w[i]]!=null&&ones[w[i]]>=18)return ones[w[i]];}
    return null;
  }
  function cleanPhoneSpeech(s){
    const raw=String(s||'').trim(),plus=/^\s*(?:plus|\+)/i.test(raw);
    const words={zero:'0',oh:'0',o:'0',one:'1',two:'2',three:'3',four:'4',five:'5',six:'6',seven:'7',eight:'8',nine:'9'};
    let digits='';raw.toLowerCase().replace(/[^a-z0-9+]/g,' ').split(/\s+/).filter(Boolean).forEach(p=>{if(/^\d+$/.test(p))digits+=p;else if(words[p]!=null)digits+=words[p];});
    return digits.length>=5?(plus?'+':'')+digits:'';
  }

  function visible(k){
    const q=(document.getElementById(k+'Search')?.value||'').toLowerCase();
    const arr=data[k]||[];
    return arr.filter(x=>{
      const hay=k==='shadchanim'
        ?`${x.name||''} ${x.phone||''} ${x.email||''} ${x.tags||''} ${(x.activities||[]).map(a=>a.text||a.action||'').join(' ')}`
        :`${x.name||''} ${x.age||''} ${x.text||''} ${senderName(x)} ${senderPhone(x)} ${(x.activities||[]).map(a=>a.text||a.action||'').join(' ')}`;
      return hay.toLowerCase().includes(q);
    });
  }

  function recordText(k,x){
    if(k==='shadchanim')return [
      x.name||'Unnamed shadchan',
      x.phone?'Phone: '+x.phone:'',
      x.email?'Email: '+x.email:'',
      x.tags?'Tags: '+x.tags:''
    ].filter(Boolean).join('\n');
    return [
      x.name||'Unnamed profile',
      x.age?'Age: '+x.age:'',
      x.text||'',
      x.profileImage?'[Profile screenshot/image saved in PeerMatch]':'',
      senderName(x)?'Sent by: '+senderName(x):'',
      senderPhone(x)?'Sender phone: '+senderPhone(x):''
    ].filter(Boolean).join('\n');
  }

  function selectedItems(k){return (data[k]||[]).filter(x=>selected[k].has(x.id));}
  function selectionText(k){return selectedItems(k).map(x=>recordText(k,x)).join('\n\n--------------------\n\n');}

  /* Authoritative selection accessor: the only source of truth for "what is checked"
     for guys/girls/shadchanim. Other files must read this instead of reconstructing
     selection from DOM card position, which breaks whenever the list is reordered,
     grouped/collapsed, or re-filtered. */
  window.pmGetSelected=function(k){return selectedItems(k);};

  function ensureSelectionBar(k){
    const section=document.getElementById(k+'Section'),toolbar=section?.querySelector('.toolbar');if(!section||!toolbar)return;
    let bar=document.getElementById('pmSelected-'+k);
    if(!bar){bar=document.createElement('div');bar.id='pmSelected-'+k;toolbar.insertAdjacentElement('afterend',bar);}
    const n=selected[k].size;
    if(!n){bar.className='hidden';bar.innerHTML='';return;}
    bar.className='pmSelectionBar';
    bar.innerHTML=`<span class="pmCount">${n} selected</span><button id="pmEmail-${k}" class="secondary">Email</button><button id="pmCopy-${k}" class="secondary">Copy</button><button id="pmDelete-${k}" class="pmDanger">Delete</button><button id="pmClear-${k}" class="secondary">Clear</button>`;
    document.getElementById('pmEmail-'+k).onclick=async()=>{
      const body=selectionText(k);if(!body)return;
      const subject=k==='shadchanim'?'PeerMatch shadchan contacts':'PeerMatch selected profiles';
      let url='mailto:?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(body);
      if(url.length>16000){try{await navigator.clipboard.writeText(body);alert('The selection is long, so PeerMatch copied it. Your email will open; paste the copied information into the message.');}catch(e){}url='mailto:?subject='+encodeURIComponent(subject);}
      location.href=url;
    };
    document.getElementById('pmCopy-'+k).onclick=async()=>{const t=selectionText(k);try{await navigator.clipboard.writeText(t);document.getElementById('pmCopy-'+k).textContent='Copied';}catch(e){alert('Copy was blocked by the browser.');}};
    document.getElementById('pmDelete-'+k).onclick=async()=>{
      const n=selected[k].size;if(!n)return;
      const label=k==='shadchanim'?'contacts':'profiles';
      if(!confirm(`Delete ${n} selected ${label}? This cannot be undone.`))return;
      data[k]=data[k].filter(x=>!selected[k].has(x.id));selected[k].clear();await save();k==='shadchanim'?renderS():renderP(k);
    };
    document.getElementById('pmClear-'+k).onclick=()=>{selected[k].clear();k==='shadchanim'?renderS():renderP(k);};
  }

  renderP=function(k){
    const b=document.getElementById(k+'List'),a=visible(k);if(!b)return;
    b.innerHTML=a.length?'':`<div class="empty">No ${k} added yet.</div>`;
    a.forEach(x=>{
      const d=document.createElement('div'),checked=selected[k].has(x.id);
      d.className='card'+(checked?' pmSelected':'');
      const im=x.photo?`<img class="photo" src="${url(x.photo)}">`:'<div class="photo">Photo</div>';
      const age=x.age||deriveAge(x.text),sentBy=senderName(x),sentPhone=senderPhone(x);
      const meta=[age?`<span class="pmPill">Age ${esc(age)}</span>`:'',sentBy?`<span class="pmPill">From ${esc(sentBy)}</span>`:'',x.profileImage?'<span class="pmPill">Screenshot</span>':''].join('');
      d.innerHTML=`<div class="cardRow"><div class="left"><input class="pmListCheck" type="checkbox" ${checked?'checked':''} aria-label="Select ${esc(x.name||'profile')}">${im}<div><div class="name">${esc(x.name||'Unnamed profile')}</div><div class="pmMeta">${meta}</div>${sentPhone?`<div class="small">${esc(sentPhone)}</div>`:''}<div class="small">${esc(last(x).slice(0,85))}</div></div></div><div>›</div></div>`;
      const check=d.querySelector('.pmListCheck');
      check.onclick=e=>{e.stopPropagation();if(check.checked)selected[k].add(x.id);else selected[k].delete(x.id);renderP(k);};
      d.onclick=()=>openP(k,x.id);b.appendChild(d);
    });
    ensureSelectionBar(k);
  };

  function waState(x){
    const a=[...(x.activities||[])].reverse().find(z=>z.type==='wa-out'||z.type==='wa-in');
    if(!a)return'';return a.type==='wa-out'?' • Waiting':' • Reply received';
  }
  renderS=function(){
    const b=document.getElementById('shadchanList'),a=visible('shadchanim');if(!b)return;
    b.innerHTML=a.length?'':'<div class="empty">No shadchanim yet.</div>';
    a.forEach(x=>{
      const d=document.createElement('div'),checked=selected.shadchanim.has(x.id);
      d.className='card'+(checked?' pmSelected':'');
      const initials=(x.name||'?').split(/\s+/).map(z=>z[0]).join('').slice(0,2).toUpperCase();
      d.innerHTML=`<div class="cardRow"><div class="left"><input class="pmListCheck" type="checkbox" ${checked?'checked':''} aria-label="Select ${esc(x.name||'shadchan')}"><div class="avatar">${esc(initials)}</div><div><div class="name">${esc(x.name||'Unnamed shadchan')}</div><div class="small">${esc(last(x).slice(0,95))}</div><div class="small">WhatsApp${esc(waState(x))}</div></div></div><div>›</div></div>`;
      const check=d.querySelector('.pmListCheck');
      check.onclick=e=>{e.stopPropagation();if(check.checked)selected.shadchanim.add(x.id);else selected.shadchanim.delete(x.id);renderS();};
      d.onclick=()=>openS(x.id);b.appendChild(d);
    });
    ensureSelectionBar('shadchanim');
  };

  function fixedForm(saveLabel,onSave,onCancel){
    const sheet=document.getElementById('sheet');if(!sheet)return;
    sheet.classList.add('pmBottomBar');
    const bar=document.createElement('div');bar.className='pmFixedForm';bar.id='pmFixedForm';
    bar.innerHTML=`<button id="pmFormSave" class="pmFixedSave">${esc(saveLabel||'Save')}</button><button id="pmFormCancel" class="pmFixedCancel">Cancel</button>`;
    sheet.appendChild(bar);document.getElementById('pmFormSave').onclick=onSave;document.getElementById('pmFormCancel').onclick=onCancel;
  }

  function attachDetailBar(textBtn,audioBtn,closeBtn){
    const sheet=document.getElementById('sheet');if(!sheet||!textBtn||!audioBtn||!closeBtn)return;
    textBtn.style.display='none';audioBtn.style.display='none';closeBtn.style.display='none';sheet.classList.add('pmBottomBar');
    const old=document.getElementById('pmFixedDetail');if(old)old.remove();
    const bar=document.createElement('div');bar.className='pmFixedDetail';bar.id='pmFixedDetail';
    bar.innerHTML='<button id="pmDetText" class="pmFixedText">Text note</button><button id="pmDetAudio" class="pmFixedAudio">Audio note</button><button id="pmDetClose" class="pmFixedClose">Close</button>';
    sheet.appendChild(bar);
    const syncAudio=()=>{const b=document.getElementById('pmDetAudio');if(b)b.textContent=/recording/i.test(audioBtn.textContent||'')?'Stop audio':'Audio note';};
    document.getElementById('pmDetText').onclick=()=>textBtn.click();document.getElementById('pmDetAudio').onclick=()=>audioBtn.click();document.getElementById('pmDetClose').onclick=()=>closeBtn.click();
    new MutationObserver(syncAudio).observe(audioBtn,{childList:true,characterData:true,subtree:true});syncAudio();
  }

  function previewInput(inputId,imgId){
    const input=document.getElementById(inputId),img=document.getElementById(imgId);if(!input||!img)return;
    let current='';input.onchange=()=>{if(current)URL.revokeObjectURL(current);const f=input.files?.[0];if(!f){img.classList.add('hidden');return;}current=URL.createObjectURL(f);img.src=current;img.classList.remove('hidden');};
  }

  function announce(label){
    if(!('speechSynthesis'in window))return;
    try{
      const voices=speechSynthesis.getVoices()||[];
      const male=/\b(david|guy|mark|christopher|daniel|alex|aaron|arthur|george|james|ryan)\b|google uk english male/i;
      const v=voices.find(x=>/^en/i.test(x.lang||'')&&male.test(x.name||''))||voices.find(x=>male.test(x.name||''))||null;
      const u=new SpeechSynthesisUtterance(label);if(v)u.voice=v;u.rate=1.15;u.pitch=1;speechSynthesis.cancel();speechSynthesis.speak(u);
    }catch(e){}
  }

  function setupGuidedVoice(){
    const button=document.getElementById('pmGuidedVoice');if(!button)return;
    if(!SpeechRecognition){button.onclick=()=>alert('Guided voice is not supported by this browser. Chrome usually works best.');return;}
    button.onclick=()=>{
      if(document.getElementById('pmVoicePanel'))return;
      const panel=document.createElement('div');panel.id='pmVoicePanel';panel.className='pmVoicePanel';button.insertAdjacentElement('afterend',panel);
      const steps=[
        {id:'pnm',label:'Name',mode:'text'},
        {id:'page',label:'Age',mode:'age'},
        {id:'pt',label:'Profile',mode:'profile'},
        {id:'psn',label:'Sender name',mode:'text'},
        {id:'psp',label:'Sender phone',mode:'phone'}
      ];
      const base=Object.fromEntries(steps.map(s=>[s.id,document.getElementById(s.id)?.value||'']));
      const buffers=steps.map(()=>[]);let index=0,recog=null,stopped=false,restartTimer=null,interim='';

      function norm(s){return String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();}
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
        const s=current();panel.innerHTML=`<div class="pmVoiceTop"><span>Field ${index+1} of ${steps.length}</span><span class="pmMicOn"><span class="pmMicDot"></span>Mic on</span></div><div class="pmVoiceField">${esc(s.label)}</div><div class="pmVoiceHeard">${buffers[index].length?'Heard: '+esc(buffers[index].join(' ')):'Speak normally. Tap Next when this field is finished.'}${interim?'<br><b>Hearing:</b> '+esc(interim):''}</div><div class="pmVoiceNav"><button id="pmVoiceBack" class="secondary" ${index===0?'disabled':''}>Back</button><button id="pmVoiceNext" class="primary">${index===steps.length-1?'Done':'Next'}</button><button id="pmVoiceStop" class="secondary">Stop</button></div>`;
        document.getElementById('pmVoiceBack').onclick=()=>{if(index>0){index--;interim='';draw();announce(current().label);}};
        document.getElementById('pmVoiceNext').onclick=()=>{updateField();if(index===steps.length-1){stop(true);return;}index++;interim='';draw();announce(current().label);};
        document.getElementById('pmVoiceStop').onclick=()=>stop(false);
      }
      function stop(done){stopped=true;clearTimeout(restartTimer);try{recog?.stop()}catch(e){}try{speechSynthesis?.cancel()}catch(e){}if(done){panel.innerHTML='<div class="pmVoiceField">✓ Voice entry complete</div><div class="pmVoiceHeard">Review the fields, then use Save below.</div>';setTimeout(()=>panel.remove(),900);}else panel.remove();}
      function startRec(){
        if(stopped)return;recog=new SpeechRecognition();recog.lang='en-US';recog.continuous=true;recog.interimResults=true;recog.maxAlternatives=1;
        recog.onresult=e=>{
          interim='';const label=norm(current().label);
          for(let n=e.resultIndex;n<e.results.length;n++){
            const t=(e.results[n]?.[0]?.transcript||'').trim();if(!t)continue;
            if(e.results[n].isFinal){if(norm(t)===label)continue;buffers[index].push(t);updateField();}else interim+=(interim?' ':'')+t;
          }
          draw();
        };
        recog.onerror=e=>{if(stopped||e.error==='aborted')return;if(e.error==='not-allowed'||e.error==='service-not-allowed'){stopped=true;panel.innerHTML='<div class="pmVoiceField">Microphone permission is blocked</div><div class="pmVoiceHeard">Allow microphone access and try again.</div>';return;}};
        recog.onend=()=>{if(stopped)return;restartTimer=setTimeout(startRec,120);};
        try{recog.start();}catch(e){restartTimer=setTimeout(startRec,250);}
      }
      draw();startRec();announce(current().label);
    };
  }

  addP=function(k,shared){
    const label=k==='guys'?'Guy':'Girl',txt=shared?.text||'',autoAge=deriveAge(txt),sharedProfileImage=shared?.profileImage||shared?.photo||null;
    open(`<h2>Add ${label}</h2>
      <div class="pmGrid"><label>Name<input id="pnm" placeholder="Name"></label><label>Age<input id="page" type="number" min="18" max="99" inputmode="numeric" value="${esc(autoAge)}"></label></div>
      <button id="pmGuidedVoice" class="full pmVoiceStart">🎤 Guided voice</button>
      <label>Profile text (optional)<textarea id="pt" placeholder="Paste or type the profile">${esc(txt)}</textarea></label>
      <label>Profile screenshot / image (optional)<input id="ppi" type="file" accept="image/*"></label><img id="ppiPreview" class="pmImagePreview hidden" alt="Profile screenshot preview">
      <label>Person photo (optional)<input id="pp" type="file" accept="image/*"></label>
      <div class="pmSourceGrid"><label>Sender name<input id="psn" placeholder="Who sent/told you?"></label><label>Sender phone<input id="psp" type="tel" inputmode="tel" placeholder="Phone number"></label></div>`);
    if(sharedProfileImage){const img=document.getElementById('ppiPreview');img.src=url(sharedProfileImage);img.classList.remove('hidden');}
    previewInput('ppi','ppiPreview');setupGuidedVoice();
    fixedForm('Save '+label,async()=>{
      let name=document.getElementById('pnm').value.trim(),age=document.getElementById('page').value.trim(),text=document.getElementById('pt').value.trim();
      if(age&&(Number(age)<18||Number(age)>99))return alert('Check the age.');
      const profileImage=document.getElementById('ppi').files?.[0]||sharedProfileImage||null,photo=document.getElementById('pp').files?.[0]||null;
      if(!name&&!text&&!profileImage)return alert('Add a name, profile text, or a profile screenshot.');
      if(!name)name=(text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean)[0]||(label+' profile')).slice(0,70);
      const sourceName=document.getElementById('psn').value.trim(),sourcePhone=document.getElementById('psp').value.trim();
      data[k].unshift({id:Date.now(),name,age:age||deriveAge(text),text,profileImage,photo,source:sourceName,sourceName,sourcePhone,activities:[]});
      await save();await del('inbox','pending');close();renderP(k);show(k);
    },close);
  };

  function editP(k,id){
    const x=item(k,id);if(!x)return;const age=x.age||deriveAge(x.text),hasShot=!!x.profileImage,hasPhoto=!!x.photo;
    open(`<h2>Edit ${k==='guys'?'Guy':'Girl'}</h2>
      <div class="pmGrid"><label>Name<input id="pen" value="${esc(x.name||'')}"></label><label>Age<input id="pea" type="number" min="18" max="99" inputmode="numeric" value="${esc(age)}"></label></div>
      <label>Profile text<textarea id="pet">${esc(x.text||'')}</textarea></label>
      ${hasShot?`<img class="pmImagePreview" src="${url(x.profileImage)}" alt="Current profile screenshot"><label class="pmInlineCheck"><input id="perShot" type="checkbox"> Remove current profile screenshot</label>`:''}
      <label>${hasShot?'Replace':'Add'} profile screenshot / image<input id="pei" type="file" accept="image/*"></label>
      ${hasPhoto?`<label class="pmInlineCheck"><input id="perPhoto" type="checkbox"> Remove current person photo</label>`:''}<label>${hasPhoto?'Replace':'Add'} person photo<input id="pep" type="file" accept="image/*"></label>
      <div class="pmSourceGrid"><label>Sender name<input id="pesn" value="${esc(senderName(x))}"></label><label>Sender phone<input id="pesp" type="tel" inputmode="tel" value="${esc(senderPhone(x))}"></label></div>`);
    fixedForm('Save Changes',async()=>{
      x.name=document.getElementById('pen').value.trim()||x.name;x.age=document.getElementById('pea').value.trim();x.text=document.getElementById('pet').value.trim();
      const newShot=document.getElementById('pei').files?.[0],newPhoto=document.getElementById('pep').files?.[0];
      if(newShot)x.profileImage=newShot;else if(document.getElementById('perShot')?.checked)x.profileImage=null;
      if(newPhoto)x.photo=newPhoto;else if(document.getElementById('perPhoto')?.checked)x.photo=null;
      x.sourceName=document.getElementById('pesn').value.trim();x.sourcePhone=document.getElementById('pesp').value.trim();x.source=x.sourceName;
      await save();renderP(k);openP(k,id);
    },()=>openP(k,id));
  }

  openP=function(k,id){
    const x=data[k].find(z=>z.id===id);if(!x)return;
    const photo=x.photo?`<img style="width:120px;height:120px;border-radius:16px;object-fit:cover" src="${url(x.photo)}">`:'';
    const shot=x.profileImage?`<div class="sectionTitle">Profile screenshot / image</div><img class="pmProfileImage" src="${url(x.profileImage)}" alt="Profile screenshot">`:'';
    const age=x.age||deriveAge(x.text),info=[age?`<span class="pmPill">Age ${esc(age)}</span>`:'',senderName(x)?`<span class="pmPill">Sent by ${esc(senderName(x))}</span>`:'',senderPhone(x)?`<span class="pmPill">${esc(senderPhone(x))}</span>`:''].join('');
    open(`<h2>${esc(x.name||'Unnamed profile')}</h2>${photo}${info?`<div class="pmMeta" style="margin:7px 0 10px">${info}</div>`:''}${x.text?`<div class="card"><div class="profileText">${esc(x.text)}</div></div>`:''}${shot}<button id="pe" class="secondary full">Edit Profile</button><div class="sectionTitle">What I did to help / notes</div>${acts(x)}<button id="pn" class="secondary full">Add text note</button><div class="gap"></div><button id="pa" class="secondary full">Record audio note</button><div class="gap"></div><button id="px" class="secondary full">Close</button>`);
    document.getElementById('pe').onclick=()=>editP(k,id);document.getElementById('pn').onclick=()=>note(k,id);document.getElementById('pa').onclick=()=>audio(k,id);document.getElementById('px').onclick=close;
    attachDetailBar(document.getElementById('pn'),document.getElementById('pa'),document.getElementById('px'));
  };

  addS=function(){
    open(`<h2>Add Shadchan</h2><label>Name<input id="sn"></label><label>Phone / SMS<input id="sp" type="tel" inputmode="tel"></label><label>Email<input id="se" type="email"></label><label>Tags<input id="st" placeholder="Chabad, 35+, Israel"></label>`);
    fixedForm('Save Shadchan',async()=>{const n=document.getElementById('sn').value.trim();if(!n)return alert('Enter a name.');data.shadchanim.unshift({id:Date.now(),name:n,phone:document.getElementById('sp').value.trim(),email:document.getElementById('se').value.trim(),tags:document.getElementById('st').value.trim(),activities:[]});await save();close();renderS();},close);
  };

  function editShadchan(id){
    const x=data.shadchanim.find(z=>z.id===id);if(!x)return;
    open(`<h2>Edit Shadchan</h2><label>Name<input id="esName" value="${esc(x.name||'')}"></label><label>Phone / SMS<input id="esPhone" type="tel" inputmode="tel" value="${esc(x.phone||'')}"></label><label>Email<input id="esEmail" type="email" value="${esc(x.email||'')}"></label><label>Tags<input id="esTags" value="${esc(x.tags||'')}" placeholder="Chabad, 35+, Israel"></label>`);
    fixedForm('Save Changes',async()=>{const n=document.getElementById('esName').value.trim();if(!n)return alert('Enter a name.');x.name=n;x.phone=document.getElementById('esPhone').value.trim();x.email=document.getElementById('esEmail').value.trim();x.tags=document.getElementById('esTags').value.trim();await save();renderS();openS(id);},()=>openS(id));
  }

  const baseOpenS=window.openS||openS;
  window.openS=openS=function(id){
    baseOpenS(id);
    setTimeout(()=>{
      const sheet=document.getElementById('sheet');if(!sheet)return;
      document.getElementById('waReply')?.remove();document.getElementById('waCopy')?.remove();const mini=sheet.querySelector('.waMini');if(mini)mini.remove();
      const actions=sheet.querySelector('.actions');if(actions&&!document.getElementById('pmEditShadchanBtn')){const btn=document.createElement('button');btn.id='pmEditShadchanBtn';btn.className='secondary pmEditShadchan';btn.textContent='Edit shadchan info';actions.insertAdjacentElement('afterend',btn);btn.onclick=()=>editShadchan(id);}
      const tn=document.getElementById('tn'),an=document.getElementById('an'),cl=document.getElementById('cl');if(tn&&an&&cl)attachDetailBar(tn,an,cl);
    },0);
  };

  function init(){
    try{
      document.getElementById('addGuy').onclick=()=>addP('guys');document.getElementById('addGirl').onclick=()=>addP('girls');document.getElementById('addShadchan').onclick=addS;
      document.getElementById('guysSearch').oninput=()=>renderP('guys');document.getElementById('girlsSearch').oninput=()=>renderP('girls');document.getElementById('shadchanSearch').oninput=renderS;
      document.getElementById('pmImportShotRow-guys')?.remove();document.getElementById('pmImportShotRow-girls')?.remove();
      renderP('guys');renderP('girls');renderS();
    }catch(e){console.warn('PeerMatch v11 init',e);}
  }
  setTimeout(init,750);
})();
