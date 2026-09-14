/* PeerMatch WhatsApp web/PWA enhancements.
   This stays inside the browser sandbox: it does not read WhatsApp automatically.
   It makes outgoing messages fast to send and incoming replies easy to save/share. */
(function(){
  const style=document.createElement('style');
  style.textContent=`
    .waBox{background:#fff;border:1px solid var(--line);border-radius:18px;padding:13px;margin:12px 0}
    .waBox textarea{min-height:92px;margin:8px 0}
    .waHint{font-size:12px;color:var(--muted);line-height:1.35;margin-top:7px}
    .waState{display:inline-block;font-size:12px;font-weight:800;border-radius:999px;padding:5px 9px;margin:3px 0 7px;background:#eef3f6;color:#315b78}
    .waState.waiting{background:#fff3d9;color:#7b5b13}
    .waState.received{background:#eaf5ec;color:#245f37}
    .event.waOut{margin-left:38px;background:#eaf1f6;border-color:#d7e5ee}
    .event.waIn{margin-right:38px;background:#eaf5ec;border-color:#d5ead9}
    .waMini{display:flex;gap:8px;margin-top:8px}.waMini button{flex:1}
    .waSelect{width:100%;border:1px solid #d6d7d4;background:#fff;border-radius:14px;padding:13px 14px;font:inherit;color:var(--text)}
  `;
  document.head.appendChild(style);

  function normalizePhone(p){
    let d=String(p||'').replace(/\D/g,'');
    if(d.startsWith('00')) d=d.slice(2);
    if(d.startsWith('0')) d='972'+d.slice(1); // convenient for Israeli local numbers
    return d;
  }
  function waLast(x){
    const arr=(x.activities||[]).filter(a=>a.type==='wa-out'||a.type==='wa-in');
    return arr.length?arr[arr.length-1]:null;
  }
  function waStatusHtml(x){
    const a=waLast(x);
    if(!a) return '<span class="waState">No WhatsApp history</span>';
    if(a.type==='wa-out') return '<span class="waState waiting">Waiting for reply</span>';
    return '<span class="waState received">Reply received</span>';
  }
  function addActivity(x,type,text,source){
    x.activities=x.activities||[];
    x.activities.push({id:Date.now(),type,text:String(text||'').trim(),source:source||'WhatsApp',ts:stamp()});
  }

  // Make WhatsApp messages look like a conversation while preserving ordinary notes/actions.
  acts=function(x){
    if(!x.activities?.length) return '<div class="empty">No contact history yet.</div>';
    return [...x.activities].reverse().map(a=>{
      if(a.type==='audio') return `<div class="event"><div class="eventTop"><span>Audio note</span><span>${esc(a.ts)}</span></div><audio controls src="${url(a.audio)}"></audio></div>`;
      if(a.type==='wa-out') return `<div class="event waOut"><div class="eventTop"><span>You → WhatsApp</span><span>${esc(a.ts)}</span></div><div class="profileText">${esc(a.text)}</div></div>`;
      if(a.type==='wa-in') return `<div class="event waIn"><div class="eventTop"><span>WhatsApp → You</span><span>${esc(a.ts)}</span></div><div class="profileText">${esc(a.text)}</div></div>`;
      return `<div class="event"><div class="eventTop"><span>${esc(a.type==='action'?a.action:'Note')}</span><span>${esc(a.ts)}</span></div><div class="profileText">${esc(a.text||'')}</div></div>`;
    }).join('');
  };

  last=function(x){
    if(!x.activities?.length) return 'No notes yet';
    const a=x.activities[x.activities.length-1];
    const label=a.type==='wa-out'?'You: ':a.type==='wa-in'?'Reply: ':a.type==='audio'?'Audio note: ':'';
    return label+(a.type==='audio'?'saved':(a.text||a.action||''))+' • '+(a.ts||'');
  };

  async function sendWhatsApp(x){
    const box=document.getElementById('waText');
    const text=(box?.value||'').trim();
    if(!text) return alert('Type a message first.');
    const digits=normalizePhone(x.phone);
    if(!digits) return alert('Add a phone number first.');
    addActivity(x,'wa-out',text,'PeerMatch');
    await save();
    try{await navigator.clipboard?.writeText(text)}catch(e){}
    // Official Click-to-Chat link: WhatsApp opens with this text prefilled; user taps Send there.
    location.href='https://wa.me/'+digits+'?text='+encodeURIComponent(text);
  }

  async function receiveReply(x){
    let clip='';
    try{clip=await navigator.clipboard?.readText()||''}catch(e){}
    open(`<h2>Add received WhatsApp reply</h2><div class="small">Paste the shadchan's reply here. If clipboard access is allowed, PeerMatch has already filled it in.</div><label>Reply<textarea id="wir">${esc(clip)}</textarea></label><button id="wis" class="green full">Save Reply</button><div class="gap"></div><button id="wic" class="secondary full">Cancel</button>`);
    $('wis').onclick=async()=>{
      const t=$('wir').value.trim(); if(!t)return alert('Paste the reply first.');
      addActivity(x,'wa-in',t,'WhatsApp'); await save(); renderS(); openS(x.id);
    };
    $('wic').onclick=()=>openS(x.id);
  }

  openS=function(id){
    const x=data.shadchanim.find(z=>z.id===id); if(!x)return;
    const digits=normalizePhone(x.phone);
    open(`<h2>${esc(x.name)}</h2>${waStatusHtml(x)}<div class="actions"><button id="call" class="primary">Call</button><button id="sms" class="secondary">SMS</button><button id="wa" class="green">Open WhatsApp</button><button id="em" class="secondary">Email</button></div>
      <div class="waBox"><div class="sectionTitle" style="margin-top:0">Send a WhatsApp message</div><textarea id="waText" placeholder="Type your message here…"></textarea><button id="waSend" class="green full">Send on WhatsApp</button><div class="waHint">PeerMatch saves the message first, then opens the correct WhatsApp chat with the text filled in. Tap Send in WhatsApp.</div><div class="waMini"><button id="waReply" class="secondary">Add received reply</button><button id="waCopy" class="secondary">Copy draft</button></div></div>
      <div class="sectionTitle">Conversation / contact history</div>${acts(x)}<button id="tn" class="secondary full">Add text note</button><div class="gap"></div><button id="an" class="secondary full">Record audio note</button><div class="gap"></div><button id="cl" class="secondary full">Close</button>`);
    $('call').onclick=()=>x.phone?launch(x,'Call','tel:'+x.phone):alert('Add a phone number first.');
    $('sms').onclick=()=>x.phone?launch(x,'SMS','sms:'+x.phone):alert('Add a phone number first.');
    $('wa').onclick=()=>digits?launch(x,'WhatsApp','https://wa.me/'+digits):alert('Add a phone number first.');
    $('em').onclick=()=>x.email?launch(x,'Email','mailto:'+encodeURIComponent(x.email)):alert('Add an email first.');
    $('waSend').onclick=()=>sendWhatsApp(x);
    $('waReply').onclick=()=>receiveReply(x);
    $('waCopy').onclick=async()=>{const t=$('waText').value.trim();if(!t)return alert('Type a message first.');try{await navigator.clipboard.writeText(t);$('waCopy').textContent='Copied'}catch(e){alert('Copy was blocked by the browser. Select the text and copy it manually.')}};
    $('tn').onclick=()=>note('shadchanim',id); $('an').onclick=()=>audio('shadchanim',id); $('cl').onclick=close;
  };

  // Improve the shadchan list with simple WhatsApp state.
  renderS=function(){
    const q=$('shadchanSearch').value.toLowerCase(),b=$('shadchanList');
    const a=data.shadchanim.filter(x=>(x.name+' '+x.phone+' '+x.email+' '+x.tags+' '+(x.activities||[]).map(n=>n.text||'').join(' ')).toLowerCase().includes(q));
    b.innerHTML=a.length?'':'<div class="empty">No shadchanim yet.</div>';
    a.forEach(x=>{let d=document.createElement('div');d.className='card';const w=waLast(x);const state=w?(w.type==='wa-out'?' • Waiting':' • Reply received'):'';d.innerHTML=`<div class="cardRow"><div class="left"><div class="avatar">${esc(x.name.split(/\s+/).map(z=>z[0]).join('').slice(0,2).toUpperCase())}</div><div><div class="name">${esc(x.name)}</div><div class="small">${esc(last(x).slice(0,95))}</div><div class="small">WhatsApp${esc(state)}</div></div></div><div>›</div></div>`;d.onclick=()=>openS(x.id);b.appendChild(d)});
  };

  // When something is shared into the installed PWA, it can now be assigned as a WhatsApp reply too.
  incoming=async function(){
    const x=await get('inbox','pending'); if(!x)return;
    $('banner').classList.remove('hidden');
    const photo=x.files?.find(f=>f.type?.startsWith('image/'))||null;
    let text=[x.title,x.text,x.url].filter(Boolean).join('\n').trim();
    const textFile=x.files?.find(f=>f.type==='text/plain');
    if(!text && textFile) try{text=(await textFile.text()).trim()}catch(e){}
    const opts=data.shadchanim.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('');
    open(`<h2>Shared to PeerMatch</h2><div class="card"><div class="profileText">${esc(text||'Shared item received')}</div></div>${data.shadchanim.length?`<label>Save as received message from<select id="shareShadchan" class="waSelect">${opts}</select></label><button id="im" class="green full">Save as WhatsApp Reply</button><div class="gap"></div>`:''}<div class="actions"><button id="ig" class="primary">Guy Profile</button><button id="il" class="primary">Girl Profile</button></div><div class="gap"></div><button id="ii" class="secondary full">Later</button>`);
    if($('im'))$('im').onclick=async()=>{const s=data.shadchanim.find(z=>String(z.id)===$('shareShadchan').value);if(!s)return;addActivity(s,'wa-in',text||'Shared item','WhatsApp share');await save();await del('inbox','pending');$('banner').classList.add('hidden');renderS();openS(s.id)};
    $('ig').onclick=()=>addP('guys',{text,photo}); $('il').onclick=()=>addP('girls',{text,photo}); $('ii').onclick=close;
  };

  // Rebind handlers that were attached before this enhancement loaded.
  setTimeout(()=>{
    try{$('shadchanSearch').oninput=renderS;renderS();incoming()}catch(e){console.warn('PeerMatch enhancement initialization',e)}
  },500);
})();
