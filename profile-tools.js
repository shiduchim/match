/* PeerMatch profile entry + bulk management enhancements.
   Adds structured name/age fields, browser voice dictation, editing,
   separate sender name/phone fields, and bulk selection/deletion. */
(function(){
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const selecting = {guys:false,girls:false};
  const selected = {guys:new Set(),girls:new Set()};

  const style=document.createElement('style');
  style.textContent=`
    .pmToolbarBtn{white-space:nowrap}
    .pmVoice{display:flex;align-items:center;justify-content:center;gap:8px}
    .pmVoice.live{background:#fdeaea;color:#8c2f2f}
    .pmVoiceStatus{font-size:12px;color:var(--muted);margin-top:7px;min-height:18px}
    .pmBulk{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:10px 0 4px;padding:10px;background:#fff;border:1px solid var(--line);border-radius:14px}
    .pmBulk button{padding:9px 11px}
    .pmBulk .count{font-size:13px;color:var(--muted);margin-right:auto}
    .danger{background:#fbe7e7;color:#8a2929}
    .pmCheck{width:23px!important;height:23px!important;min-width:23px;margin:0;accent-color:var(--accent)}
    .card.pmSelected{outline:2px solid var(--accent);background:#f6fafc}
    .pmMeta{display:flex;gap:6px;flex-wrap:wrap}
    .pmPill{display:inline-block;background:#eef3f6;border-radius:999px;padding:3px 8px;font-size:12px;color:#315b78;margin-top:4px}
    .pmGrid{display:grid;grid-template-columns:1fr 110px;gap:9px}
    .pmSourceGrid{display:grid;grid-template-columns:1fr 1fr;gap:9px}
    @media(max-width:430px){.pmGrid{grid-template-columns:1fr 96px}.pmSourceGrid{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);

  function senderName(x){return (x.sourceName||x.source||'').trim();}
  function senderPhone(x){return (x.sourcePhone||'').trim();}

  function visiblePeople(k){
    const q=(document.getElementById(k+'Search')?.value||'').toLowerCase();
    return data[k].filter(x=>(
      (x.name||'')+' '+(x.age||'')+' '+(x.text||'')+' '+senderName(x)+' '+senderPhone(x)+' '+
      (x.activities||[]).map(n=>n.text||'').join(' ')
    ).toLowerCase().includes(q));
  }

  function deriveAge(text){
    const s=String(text||'');
    let m=s.match(/\bage\s*(?:is|:|-)?\s*(\d{2})\b/i) || s.match(/\b(\d{2})\s*(?:years?\s*old|yo)\b/i);
    if(!m)return '';
    const n=Number(m[1]);
    return n>=18&&n<=99?String(n):'';
  }

  function parseVoice(text){
    let s=String(text||'').trim(),name='',age='',profile='';
    const ageMatch=s.match(/\bage\s*(?:is|:|-)?\s*(\d{2})\b/i) || s.match(/\b(\d{2})\s*(?:years?\s*old|yo)\b/i);
    if(ageMatch){
      const n=Number(ageMatch[1]); if(n>=18&&n<=99)age=String(n);
    }
    const nameMatch=s.match(/\bname\s*(?:is|:|-)?\s*(.+?)(?=\s+age\b|\s+profile\b|\s+about\b|$)/i);
    if(nameMatch)name=nameMatch[1].replace(/[,.]+$/,'').trim();
    const profileMatch=s.match(/\b(?:profile|about)\s*(?:is|:|-)?\s*(.+)$/i);
    if(profileMatch)profile=profileMatch[1].trim();
    else {
      profile=s
        .replace(/\bname\s*(?:is|:|-)?\s*.+?(?=\s+age\b|\s+profile\b|\s+about\b|$)/i,'')
        .replace(/\bage\s*(?:is|:|-)?\s*\d{2}\b/i,'')
        .replace(/\b\d{2}\s*(?:years?\s*old|yo)\b/i,'')
        .replace(/^\s*[,.;:-]+|\s*[,.;:-]+$/g,'')
        .trim();
    }
    return {name,age,profile,raw:s};
  }

  function attachVoice(){
    const btn=document.getElementById('pmVoiceFill');
    if(!btn)return;
    const status=document.getElementById('pmVoiceStatus');
    if(!SpeechRecognition){
      btn.onclick=()=>alert('Voice-to-text is not supported by this browser. Chrome on Android or desktop usually works best.');
      return;
    }
    btn.onclick=()=>{
      const r=new SpeechRecognition();
      r.lang=document.documentElement.lang||'en-US';
      r.interimResults=false;
      r.maxAlternatives=1;
      btn.classList.add('live'); btn.textContent='Listening… tap browser stop if needed';
      if(status)status.textContent='Say: “Name Sarah Cohen, age 35, profile lives in Jerusalem…”';
      r.onresult=e=>{
        const t=e.results?.[0]?.[0]?.transcript||'';
        const p=parseVoice(t);
        if(p.name && !$('pnm').value.trim())$('pnm').value=p.name;
        if(p.age)$('page').value=p.age;
        if(p.profile){
          const old=$('pt').value.trim();
          $('pt').value=old?old+'\n'+p.profile:p.profile;
        } else if(p.raw){
          const old=$('pt').value.trim();
          $('pt').value=old?old+'\n'+p.raw:p.raw;
        }
        if(status)status.textContent='Heard: '+t;
      };
      r.onerror=e=>{if(status)status.textContent='Voice error: '+(e.error||'not available');};
      r.onend=()=>{btn.classList.remove('live');btn.textContent='🎙 Voice Fill';};
      try{r.start()}catch(e){btn.classList.remove('live');btn.textContent='🎙 Voice Fill';}
    };
  }

  function ensureBulkUI(k){
    const section=$(k+'Section'); if(!section)return;
    const toolbar=section.querySelector('.toolbar'); if(!toolbar)return;
    let selectBtn=document.getElementById('pmSelect-'+k);
    if(!selectBtn){
      selectBtn=document.createElement('button');
      selectBtn.id='pmSelect-'+k; selectBtn.className='secondary pmToolbarBtn'; selectBtn.textContent='Select';
      toolbar.appendChild(selectBtn);
      selectBtn.onclick=()=>{
        selecting[k]=!selecting[k];
        if(!selecting[k])selected[k].clear();
        renderP(k);
      };
    }
    let bar=document.getElementById('pmBulk-'+k);
    if(!bar){bar=document.createElement('div');bar.id='pmBulk-'+k;toolbar.insertAdjacentElement('afterend',bar);}
    bar.className=selecting[k]?'pmBulk':'hidden';
    if(selecting[k]){
      const n=selected[k].size;
      bar.innerHTML=`<span class="count">${n} selected</span><button id="pmAll-${k}" class="secondary">Select all</button><button id="pmDelete-${k}" class="danger" ${n?'':'disabled'}>Delete ${n||''}</button><button id="pmDone-${k}" class="secondary">Done</button>`;
      $('pmAll-'+k).onclick=()=>{visiblePeople(k).forEach(x=>selected[k].add(x.id));renderP(k)};
      $('pmDelete-'+k).onclick=async()=>{
        const count=selected[k].size; if(!count)return;
        if(!confirm(`Delete ${count} ${count===1?'profile':'profiles'}? This cannot be undone.`))return;
        data[k]=data[k].filter(x=>!selected[k].has(x.id));
        selected[k].clear();
        await save();
        renderP(k);
      };
      $('pmDone-'+k).onclick=()=>{selecting[k]=false;selected[k].clear();renderP(k)};
    }
    selectBtn.textContent=selecting[k]?'Cancel':'Select';
  }

  renderP=function(k){
    ensureBulkUI(k);
    const b=$(k+'List'),a=visiblePeople(k);
    b.innerHTML=a.length?'':`<div class="empty">No ${k} added yet.</div>`;
    a.forEach(x=>{
      let d=document.createElement('div');
      const isSel=selected[k].has(x.id);
      d.className='card'+(isSel?' pmSelected':'');
      const im=x.photo?`<img class="photo" src="${url(x.photo)}">`:'<div class="photo">Photo</div>';
      const age=x.age||deriveAge(x.text),sentBy=senderName(x),sentPhone=senderPhone(x);
      const meta=[age?`<span class="pmPill">Age ${esc(age)}</span>`:'',sentBy?`<span class="pmPill">From ${esc(sentBy)}</span>`:'',sentPhone?`<span class="pmPill">${esc(sentPhone)}</span>`:''].join('');
      d.innerHTML=`<div class="cardRow"><div class="left">${selecting[k]?`<input class="pmCheck" type="checkbox" ${isSel?'checked':''} aria-label="Select ${esc(x.name||'profile')}">`:''}${im}<div><div class="name">${esc(x.name||'Unnamed profile')}</div><div class="pmMeta">${meta}</div><div class="small">${esc(last(x).slice(0,85))}</div></div></div><div>${selecting[k]?'':'›'}</div></div>`;
      d.onclick=e=>{
        if(selecting[k]){
          e.preventDefault();
          if(selected[k].has(x.id))selected[k].delete(x.id);else selected[k].add(x.id);
          renderP(k);
        }else openP(k,x.id);
      };
      b.appendChild(d);
    });
    ensureBulkUI(k);
  };

  addP=function(k,shared){
    const s=k==='guys'?'Guy':'Girl',txt=shared?.text||'',autoAge=deriveAge(txt);
    open(`<h2>Add ${s}</h2>
      <div class="pmGrid"><label>Name<input id="pnm" placeholder="Name"></label><label>Age<input id="page" type="number" min="18" max="99" inputmode="numeric" value="${esc(autoAge)}"></label></div>
      <button id="pmVoiceFill" class="secondary full pmVoice">🎙 Voice Fill</button><div id="pmVoiceStatus" class="pmVoiceStatus">Say “Name…, age…, profile…” and PeerMatch will fill it in.</div>
      <label>Profile<textarea id="pt" placeholder="Paste the profile, type it, or use Voice Fill">${esc(txt)}</textarea></label>
      <label>Photo (optional)<input id="pp" type="file" accept="image/*"></label>
      <div class="pmSourceGrid"><label>Sender name<input id="psn" placeholder="Who sent/told you?"></label><label>Sender phone<input id="psp" type="tel" inputmode="tel" placeholder="Phone number"></label></div>
      <button id="pv" class="primary full">Save ${s}</button><div class="gap"></div><button id="pc" class="secondary full">Cancel</button>`);
    attachVoice();
    $('pv').onclick=async()=>{
      let t=$('pt').value.trim(),name=$('pnm').value.trim(),age=$('page').value.trim();
      if(!t&&!name)return alert('Enter a name or some profile information.');
      if(age && (Number(age)<18||Number(age)>99))return alert('Check the age.');
      if(!name)name=(t.split(/\r?\n/).map(x=>x.trim()).filter(Boolean)[0]||s).slice(0,70);
      let photo=$('pp').files?.[0]||shared?.photo||null;
      const sourceName=$('psn').value.trim(),sourcePhone=$('psp').value.trim();
      data[k].unshift({id:Date.now(),name,age:age||deriveAge(t),text:t,photo,source:sourceName,sourceName,sourcePhone,activities:[]});
      await save();await del('inbox','pending');close();renderP(k);show(k);
    };
    $('pc').onclick=close;
  };

  function editP(k,id){
    const x=item(k,id); if(!x)return;
    const age=x.age||deriveAge(x.text),oldSender=senderName(x),oldPhone=senderPhone(x);
    open(`<h2>Edit ${k==='guys'?'Guy':'Girl'}</h2>
      <div class="pmGrid"><label>Name<input id="pen" value="${esc(x.name||'')}"></label><label>Age<input id="pea" type="number" min="18" max="99" inputmode="numeric" value="${esc(age)}"></label></div>
      <label>Profile<textarea id="pet">${esc(x.text||'')}</textarea></label>
      <div class="pmSourceGrid"><label>Sender name<input id="pesn" value="${esc(oldSender)}"></label><label>Sender phone<input id="pesp" type="tel" inputmode="tel" value="${esc(oldPhone)}"></label></div>
      <button id="peSave" class="primary full">Save Changes</button><div class="gap"></div><button id="peCancel" class="secondary full">Cancel</button>`);
    $('peSave').onclick=async()=>{
      x.name=$('pen').value.trim()||x.name;
      x.age=$('pea').value.trim();
      x.text=$('pet').value.trim();
      x.sourceName=$('pesn').value.trim();
      x.sourcePhone=$('pesp').value.trim();
      x.source=x.sourceName;
      await save();renderP(k);openP(k,id);
    };
    $('peCancel').onclick=()=>openP(k,id);
  }

  openP=function(k,id){
    const x=data[k].find(z=>z.id===id); if(!x)return;
    const im=x.photo?`<img style="width:140px;height:140px;border-radius:18px;object-fit:cover" src="${url(x.photo)}">`:'';
    const age=x.age||deriveAge(x.text),sentBy=senderName(x),sentPhone=senderPhone(x);
    const info=[age?`<span class="pmPill">Age ${esc(age)}</span>`:'',sentBy?`<span class="pmPill">Sent by ${esc(sentBy)}</span>`:'',sentPhone?`<span class="pmPill">${esc(sentPhone)}</span>`:''].join(' ');
    open(`<h2>${esc(x.name||'Unnamed profile')}</h2>${im}${info?`<div class="pmMeta" style="margin:6px 0 10px">${info}</div>`:''}<div class="card"><div class="profileText">${esc(x.text||'')}</div></div><button id="pe" class="secondary full">Edit Profile</button><div class="sectionTitle">What I did to help / notes</div>${acts(x)}<button id="pn" class="secondary full">Add text note</button><div class="gap"></div><button id="pa" class="secondary full">Record audio note</button><div class="gap"></div><button id="px" class="secondary full">Close</button>`);
    $('pe').onclick=()=>editP(k,id);
    $('pn').onclick=()=>note(k,id);$('pa').onclick=()=>audio(k,id);$('px').onclick=close;
  };

  setTimeout(()=>{
    try{
      ensureBulkUI('guys');ensureBulkUI('girls');
      $('guysSearch').oninput=()=>renderP('guys');
      $('girlsSearch').oninput=()=>renderP('girls');
      $('addGuy').onclick=()=>addP('guys');
      $('addGirl').onclick=()=>addP('girls');
      renderP('guys');renderP('girls');
    }catch(e){console.warn('PeerMatch profile tools initialization',e)}
  },650);
})();
