/* PeerMatch v61: local WhatsApp ZIP import + referral source. */
(function(){
  document.documentElement.dataset.peerMatchVersion='61';
  const td=new TextDecoder('utf-8'),te=new TextEncoder();
  let activeShadId=null;

  const css=document.createElement('style');
  css.textContent=`
    .pmWaImportBtn{white-space:nowrap}
    .pmRefByDetail{margin:7px 0 10px;padding:8px 10px;background:#fff;border:1px solid var(--line);border-radius:11px;font-size:12px;color:var(--muted)}
    .pmRefByDetail b{color:var(--text)}
    .pmWaCard{background:#fff;border:1px solid var(--line);border-radius:15px;padding:11px;margin:9px 0}
    .pmWaCard h3{margin:0 0 8px;font-size:15px}
    .pmWaGrid{display:grid;grid-template-columns:1fr 1fr;gap:7px}
    .pmWaItem{border:1px solid #dbe3e7;border-radius:12px;padding:9px;margin:7px 0;background:#fbfcfd}
    .pmWaCheck{display:flex;align-items:center;gap:8px;margin:0 0 7px;font-size:12px;color:var(--text);font-weight:800}
    .pmWaCheck input{width:auto!important;min-width:18px;height:18px;margin:0}
    .pmWaItem label,.pmWaCard label{margin:6px 0}
    .pmWaItem input,.pmWaItem select,.pmWaCard select{width:100%;border:1px solid #d6d7d4;background:#fff;border-radius:11px;padding:9px 10px;font:inherit;color:var(--text)}
    .pmWaMeta{font-size:11px;color:var(--muted);line-height:1.4;margin:4px 0}
    .pmWaText{max-height:130px;overflow:auto;white-space:pre-wrap;font-size:11px;line-height:1.35;background:#f7fafc;border-radius:9px;padding:7px;margin-top:6px}
    .pmWaThumb{display:block;max-width:100%;max-height:160px;object-fit:contain;margin:7px auto;border-radius:10px;border:1px solid var(--line)}
    .pmWaBar{position:sticky;bottom:-18px;display:grid;grid-template-columns:1.4fr .8fr;gap:7px;background:rgba(246,245,242,.97);padding:10px 0 2px;z-index:3}
    .pmWaBadge{display:inline-block;border-radius:999px;background:#eaf1f6;padding:2px 7px;font-size:10px;font-weight:800;color:#315b78;margin-left:5px}
    .pmAttachmentBox{margin:9px 0;padding:9px;background:#fff;border:1px solid var(--line);border-radius:12px}
    .pmAttachmentBox button{width:100%;margin-top:6px}
    @media(max-width:430px){.pmWaGrid{grid-template-columns:1fr}.pmWaBar{grid-template-columns:1fr 1fr}}
  `;
  document.head.appendChild(css);

  const safe=s=>typeof esc==='function'?esc(s):String(s??'');
  const base=n=>String(n||'').split('/').pop()||'';
  const ext=n=>((base(n).toLowerCase().match(/(\.[a-z0-9]{1,8})$/)||[])[1]||'');
  const isImage=n=>/\.(?:jpe?g|png|webp|gif|heic)$/i.test(n);
  const isProfileFile=n=>/\.(?:jpe?g|png|webp|gif|heic|pdf|docx?|rtf|txt)$/i.test(n);
  function norm(s){return String(s||'').toLocaleLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim();}
  function digits(s){return String(s||'').replace(/\D/g,'');}
  function phoneNorm(p){let d=digits(p);if(d.startsWith('00'))d=d.slice(2);if(d.startsWith('0')&&d.length>=9)d='972'+d.slice(1);return d;}
  function sameName(a,b){const x=norm(a),y=norm(b);return !!x&&!!y&&(x===y||x.includes(y)||y.includes(x));}
  function hash(s){let h=2166136261>>>0;for(const c of String(s||'')){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return (h>>>0).toString(36);}
  function mime(n){return ({'.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.gif':'image/gif','.heic':'image/heic','.pdf':'application/pdf','.txt':'text/plain','.vcf':'text/vcard','.doc':'application/msword','.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','.rtf':'application/rtf'})[ext(n)]||'application/octet-stream';}

  const u16=(v,o)=>v.getUint16(o,true),u32=(v,o)=>v.getUint32(o,true);
  async function inflateRaw(bytes){
    if(!('DecompressionStream'in window))throw new Error('Update Chrome before importing compressed ZIP files.');
    const ds=new DecompressionStream('deflate-raw');
    return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(ds)).arrayBuffer());
  }
  async function openZip(file){
    const ab=await file.arrayBuffer(),b=new Uint8Array(ab),v=new DataView(ab);
    let e=-1,min=Math.max(0,b.length-65557);
    for(let i=b.length-22;i>=min;i--)if(i>=0&&u32(v,i)===0x06054b50){e=i;break;}
    if(e<0)throw new Error('This is not a valid ZIP file.');
    const count=u16(v,e+10),central=u32(v,e+16);let p=central;const out=[];
    for(let i=0;i<count;i++){
      if(p+46>b.length||u32(v,p)!==0x02014b50)throw new Error('The ZIP directory is damaged.');
      const method=u16(v,p+10),cs=u32(v,p+20),nl=u16(v,p+28),xl=u16(v,p+30),cl=u16(v,p+32),lo=u32(v,p+42);
      const name=td.decode(b.slice(p+46,p+46+nl)),ln=u16(v,lo+26),lx=u16(v,lo+28),start=lo+30+ln+lx,end=start+cs,compressed=b.slice(start,end);
      let cache=null;
      out.push({name,method,async bytes(){if(cache)return cache;if(method===0)cache=compressed;else if(method===8)cache=await inflateRaw(compressed);else throw new Error('Unsupported ZIP compression method '+method+'.');return cache;},async text(){return td.decode(await this.bytes());},async blob(){return new Blob([await this.bytes()],{type:mime(name)});}});
      p+=46+nl+xl+cl;
    }
    return out.filter(x=>!x.name.endsWith('/'));
  }

  function qp(v){
    if(!/=([0-9A-F]{2}|[\r\n])/i.test(v))return v;
    try{
      const s=v.replace(/=\r?\n/g,''),a=[];
      for(let i=0;i<s.length;i++){
        if(s[i]==='='&&/^[0-9A-F]{2}$/i.test(s.slice(i+1,i+3))){a.push(parseInt(s.slice(i+1,i+3),16));i+=2;}
        else a.push(...te.encode(s[i]));
      }
      return td.decode(new Uint8Array(a));
    }catch(e){return v;}
  }
  function parseVCF(text){
    const cards=String(text||'').replace(/\r?\n[ \t]/g,'').match(/BEGIN:VCARD[\s\S]*?END:VCARD/gi)||[];
    return cards.map((c,i)=>{
      const ls=c.split(/\r?\n/),get=k=>{const l=ls.find(x=>new RegExp('^'+k+'(?:;[^:]*)?:','i').test(x));return l?qp(l.slice(l.indexOf(':')+1)).replace(/\\n/gi,'\n').replace(/\\,/g,',').replace(/\\;/g,';').trim():'';};
      let name=get('FN');if(!name)name=get('N').split(';').filter(Boolean).reverse().join(' ').trim();
      const tel=(ls.find(x=>/^TEL(?:;[^:]*)?:/i.test(x))||'').replace(/^.*?:/,'').trim(),email=(ls.find(x=>/^EMAIL(?:;[^:]*)?:/i.test(x))||'').replace(/^.*?:/,'').trim();
      return{name:name||'Contact '+(i+1),phone:tel,email};
    });
  }

  function parseChat(text){
    const out=[];let cur=null;
    for(const line0 of String(text||'').replace(/\u200e|\u202a|\u202c/g,'').split(/\r?\n/)){
      const line=line0.trimEnd();
      const m=line.match(/^\[?(\d{1,2}[\/.]\d{1,2}[\/.]\d{2,4}),\s*(\d{1,2}:\d{2}(?::\d{2})?(?:\s?[AP]M)?)\]?\s*[-–]?\s*([^:]+):\s?(.*)$/i);
      if(m){cur={date:m[1],time:m[2],sender:m[3].trim(),text:m[4]||'',index:out.length};out.push(cur);}
      else if(cur)cur.text+=(cur.text?'\n':'')+line;
    }
    return out;
  }

  const termRes=[
    /\b(?:name|full name|age|height|occupation|education|hashkafa|background|looking for|contact|phone)\b/ig,
    /(?:שם מלא|שם|גיל|גובה|מגורים|עיסוק|עבודה|השכלה|לימודים|רקע|השקפה|מחפש|מחפשת|לפרטים|איש קשר|טלפון)/g,
    /(?:имя|фио|возраст|рост|город|работа|профессия|образование|семья|религиоз|контакт|телефон)/ig
  ];
  function scoreProfile(text){
    const s=String(text||''),lines=s.split(/\r?\n/).filter(x=>x.trim());let n=0;
    if(s.length>180)n+=2;else if(s.length>90)n++;
    if(lines.length>=6)n+=2;else if(lines.length>=3)n++;
    for(const re of termRes){const m=s.match(re);n+=Math.min(4,(m||[]).length);}
    if(/\b\d{2}\s*(?:years?\s*old|yo)\b/i.test(s)||/(?:בן|בת)\s*\d{2}/.test(s)||/\b\d{2}\s*(?:лет|года)\b/i.test(s))n+=2;
    if(/(?:\+?\d[\d\s().-]{7,}\d)/.test(s))n++;
    return n;
  }
  function cleanEdge(s){return String(s||'').replace(/^[\s*•\-–—:]+|[\s*•\-–—:]+$/g,'').trim();}
  function fileGuess(name){
    let s=base(name).replace(/\.[^.]+$/,'').replace(/[_-]+/g,' ').trim();
    if(/^(?:IMG|WA|DOC|PDF)[ -]?\d/i.test(s)||/^\d{8,}/.test(s))return'';
    return s.length>=2&&s.length<=70?s:'';
  }
  function nameAge(text,fileName){
    const s=String(text||''),lines=s.split(/\r?\n/).map(x=>x.trim()).filter(Boolean),top=lines.slice(0,14);let name='',age='';
    const nr=[/^(?:name|full name)\s*[:\-–]\s*(.+)$/i,/^(?:שם|שם מלא)\s*[:\-–]\s*(.+)$/,/^(?:имя|фио|ф\.?\s*и\.?\s*о\.?)\s*[:\-–]\s*(.+)$/i];
    for(const line of top){for(const re of nr){const m=line.match(re);if(m){name=cleanEdge(m[1]);break;}}if(name)break;}
    const sample=top.join('\n');
    const ar=[/\bage\s*(?:is|:|-|–)?\s*(\d{2})\b/i,/\b(\d{2})\s*(?:years?\s*old|yo)\b/i,/(?:גיל\s*[:\-–]?\s*|בן\s+|בת\s+)(\d{2})\b/,/(?:возраст\s*[:\-–]?\s*)(\d{2})\b/i,/\b(\d{2})\s*(?:лет|года)\b/i];
    for(const re of ar){const m=sample.match(re)||s.match(re);if(m&&+m[1]>=18&&+m[1]<=99){age=m[1];break;}}
    if(!name&&top.length){
      let first=cleanEdge(top[0].replace(/[*_~]/g,''));
      const bad=/^(?:shidduch|profile|resume|bio|פרופיל|כרטיס|שידוך|анкета|резюме)\b/i;
      if(first.length<=70&&!bad.test(first)&&!/@/.test(first)&&!/(?:\+?\d[\d\s().-]{7,}\d)/.test(first)&&first.split(/\s+/).length<=7){
        name=first.replace(/\s*[,|]\s*(?:age\s*)?\d{2}\b.*$/i,'').replace(/\s+(?:בן|בת)\s+\d{2}\b.*$/,'').replace(/\s+\d{2}\s*(?:лет|года)\b.*$/i,'').trim();
      }
    }
    if(!name&&fileName)name=fileGuess(fileName);
    return{name:name.slice(0,80),age};
  }
  function gender(text){
    const s=String(text||'');
    if(/(?:\bwoman\b|\bfemale\b|\bgirl\b|(?:^|\s)בת\s+\d{2}|מחפשת|בחורה|девушка|женщина|невеста)/i.test(s))return'girls';
    if(/(?:\bman\b|\bmale\b|\bguy\b|(?:^|\s)בן\s+\d{2}|מחפש|בחור|мужчина|парень|жених)/i.test(s))return'guys';
    return'';
  }
  function contactAtBottom(text){
    const lines=String(text||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean),b=lines.slice(-14),joined=b.join('\n');
    const pm=joined.match(/(?:\+?\d[\d\s().-]{7,}\d)/),em=joined.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);let name='';
    const re=/(?:contact(?:\s+person)?|for (?:more )?info(?:rmation)?|לפרטים|ליצירת קשר|יצירת קשר|איש קשר|контакт|для связи)\s*[:\-–]?\s*(.*)$/i;
    for(let i=b.length-1;i>=0;i--){const m=b[i].match(re);if(!m)continue;name=m[1].replace(/(?:\+?\d[\d\s().-]{7,}\d)/g,'').replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig,'').replace(/[•|,;]+$/g,'').trim();if(!name&&b[i+1])name=b[i+1].replace(/(?:\+?\d[\d\s().-]{7,}\d)/g,'').trim();break;}
    return{name:name.length<=70?name:'',phone:pm?pm[0].trim():'',email:em?em[0].trim():''};
  }
  function pureAttachment(t){return /^<?attached:.*>?$/i.test(String(t||'').trim())||/\(file attached\)$/i.test(String(t||'').trim())||/^<media omitted>$/i.test(String(t||'').trim());}
  function guessChatName(zipName,messages){
    for(const x of data.shadchanim||[]){const s=messages.find(m=>sameName(m.sender,x.name)||(phoneNorm(m.sender)&&phoneNorm(m.sender)===phoneNorm(x.phone)));if(s)return x.name;}
    let n=String(zipName||'').replace(/\.zip$/i,'').replace(/^WhatsApp(?: Chat)?(?: with)?\s*/i,'').replace(/^Chat(?: with)?\s*/i,'').trim();
    return n&&n.length<90&&!/^WhatsApp$/i.test(n)?n:(messages[0]?.sender||'');
  }
  function existingShad(name,phone){
    const p=phoneNorm(phone),n=norm(name);
    return (data.shadchanim||[]).find(x=>(p&&phoneNorm(x.phone)===p)||(n&&norm(x.name)===n))||null;
  }
  function existingProfile(k,name,age,text){
    const n=norm(name),h=hash(text);
    return (data[k]||[]).find(x=>(n&&norm(x.name)===n&&String(x.age||'')===String(age||''))||(text&&hash(x.text||'')===h))||null;
  }

  async function scanZip(file){
    const entries=await openZip(file),lookup=new Map(entries.map(e=>[base(e.name).toLowerCase(),e]));
    const txts=entries.filter(e=>ext(e.name)==='.txt');
    const chatEntry=txts.find(e=>/(^|\/)_?chat\.txt$/i.test(e.name))||txts.find(e=>/whatsapp/i.test(e.name))||txts[0]||null;
    const chatText=chatEntry?await chatEntry.text():'',messages=parseChat(chatText),sourceGuess=guessChatName(file.name,messages),contacts=[];
    for(const e of entries.filter(x=>ext(x.name)==='.vcf'))for(const c of parseVCF(await e.text()))contacts.push({...c,file:e.name});

    const profiles=[],used=new Set();
    function refEntry(text){
      const low=String(text||'').toLowerCase();
      for(const [name,e] of lookup)if(name&&low.includes(name))return e;
      return null;
    }
    for(const e of entries.filter(x=>x!==chatEntry&&ext(x.name)!=='.vcf'&&isProfileFile(x.name))){
      let mi=-1;for(let i=0;i<messages.length;i++)if(refEntry(messages[i].text)===e){mi=i;break;}
      let context='';
      if(mi>=0){
        const arr=[];
        for(let j=Math.max(0,mi-2);j<=Math.min(messages.length-1,mi+2);j++)if(j!==mi&&messages[j].sender===messages[mi].sender&&scoreProfile(messages[j].text)>=2){arr.push(messages[j].text);used.add(j);}
        context=arr.join('\n\n').trim();used.add(mi);
      }
      if(ext(e.name)==='.txt'){try{const t=await e.text();if(scoreProfile(t)>scoreProfile(context))context=t;}catch(_){ }}
      const na=nameAge(context,e.name),ct=contactAtBottom(context),sc=scoreProfile(context)+(/(profile|shidduch|resume|bio|פרופיל|כרטיס|שידוך|анкета|резюме)/i.test(e.name)?4:0);
      profiles.push({entry:e,fileName:base(e.name),text:context,name:na.name,age:na.age,kind:gender(context),contactName:ct.name,contactPhone:ct.phone,contactEmail:ct.email,checked:sc>=4||/\.(?:pdf|docx?|rtf)$/i.test(e.name),score:sc});
    }
    for(let i=0;i<messages.length;i++){
      if(used.has(i)||pureAttachment(messages[i].text))continue;
      const sc=scoreProfile(messages[i].text);if(sc<5)continue;
      const na=nameAge(messages[i].text,''),ct=contactAtBottom(messages[i].text);
      profiles.push({entry:null,fileName:'',text:messages[i].text,name:na.name,age:na.age,kind:gender(messages[i].text),contactName:ct.name,contactPhone:ct.phone,contactEmail:ct.email,checked:true,score:sc});
    }
    const seen=new Set(),dedup=profiles.filter(p=>{const k=norm(p.name)+'|'+p.age+'|'+hash(p.text||p.fileName);if(seen.has(k))return false;seen.add(k);return true;});
    return{file,entries,chatEntry,chatText,messages,sourceGuess,contacts,profiles:dedup};
  }

  async function previewImage(p){
    if(!p.entry||!isImage(p.entry.name))return'';
    try{const b=await p.entry.blob(),u=URL.createObjectURL(b);p.preview=u;return `<img class="pmWaThumb" src="${safe(u)}" alt="Possible profile">`;}catch(_){return'';}
  }
  function sourceSelect(scan){
    const arr=data.shadchanim||[];
    const match=arr.find(x=>sameName(x.name,scan.sourceGuess)||(phoneNorm(x.phone)&&phoneNorm(x.phone)===phoneNorm(scan.sourceGuess)));
    return{match,html:'<option value="">No existing match</option>'+arr.map(x=>`<option value="${safe(x.id)}" ${match&&String(match.id)===String(x.id)?'selected':''}>${safe(x.name||'Unnamed shadchan')}</option>`).join('')};
  }
  async function showScan(scan){
    const src=sourceSelect(scan),pre=[];
    for(const p of scan.profiles)pre.push(await previewImage(p));
    const contacts=scan.contacts.length?scan.contacts.map((c,i)=>{
      const ex=existingShad(c.name,c.phone);
      return `<div class="pmWaItem" data-contact="${i}">
        <label class="pmWaCheck"><input class="pmWaUseContact" type="checkbox" ${ex?'':'checked'}>Shadchan ${ex?'<span class="pmWaBadge">already in PeerMatch</span>':''}</label>
        <div class="pmWaGrid"><label>Name<input class="pmWaCName" value="${safe(c.name)}"></label><label>Phone<input class="pmWaCPhone" value="${safe(c.phone)}"></label></div>
        <label>Email<input class="pmWaCEmail" value="${safe(c.email)}"></label>
      </div>`;
    }).join(''):'<div class="pmWaMeta">No contact cards (.vcf) were found.</div>';

    const profiles=scan.profiles.length?scan.profiles.map((p,i)=>{
      const duplicate=(p.kind&&existingProfile(p.kind,p.name,p.age,p.text))||null;
      return `<div class="pmWaItem" data-profile="${i}">
        <label class="pmWaCheck"><input class="pmWaUseProfile" type="checkbox" ${p.checked&&!duplicate?'checked':''}>Possible profile ${duplicate?'<span class="pmWaBadge">already in PeerMatch</span>':''}</label>
        ${pre[i]||''}
        <div class="pmWaGrid">
          <label>Name<input class="pmWaPName" value="${safe(p.name)}" placeholder="Name"></label>
          <label>Age<input class="pmWaPAge" value="${safe(p.age)}" inputmode="numeric" placeholder="Age"></label>
        </div>
        <label>Guy / Girl<select class="pmWaPKind"><option value="" ${!p.kind?'selected':''}>Choose…</option><option value="guys" ${p.kind==='guys'?'selected':''}>Guy</option><option value="girls" ${p.kind==='girls'?'selected':''}>Girl</option></select></label>
        <div class="pmWaMeta">${safe(p.fileName?('Attachment: '+p.fileName):'Profile text found in chat')} • confidence ${p.score}</div>
        <div class="pmWaGrid">
          <label>Contact person<input class="pmWaPContactName" value="${safe(p.contactName)}" placeholder="Usually near bottom"></label>
          <label>Contact phone<input class="pmWaPContactPhone" value="${safe(p.contactPhone)}"></label>
        </div>
        <label>Contact email<input class="pmWaPContactEmail" value="${safe(p.contactEmail)}"></label>
        ${p.text?`<div class="pmWaText">${safe(p.text)}</div>`:''}
      </div>`;
    }).join(''):'<div class="pmWaMeta">No likely profiles were found automatically.</div>';

    open(`<h2>Import WhatsApp ZIP</h2>
      <div class="pmWaCard">
        <h3>Chat source</h3>
        <div class="pmWaMeta">This person will be saved as "Referred by" for the shadchanim found in the export.</div>
        <label>Existing shadchan<select id="pmWaSource">${src.html}</select></label>
        <label>Referred by / chat name<input id="pmWaSourceName" value="${safe(src.match?.name||scan.sourceGuess)}" placeholder="Who sent these contacts?"></label>
        <label class="pmWaCheck"><input id="pmWaAddSource" type="checkbox" ${src.match?'':'checked'}>Add this chat person as a shadchan if not already in PeerMatch</label>
        <label class="pmWaCheck"><input id="pmWaHistory" type="checkbox" ${scan.messages.length?'checked':''}>Import this WhatsApp conversation into the shadchan's History</label>
        <div class="pmWaMeta">${scan.messages.length} WhatsApp messages found.</div>
      </div>
      <div class="pmWaCard"><h3>Shadchanim found — ${scan.contacts.length}</h3>${contacts}</div>
      <div class="pmWaCard"><h3>Possible profiles — ${scan.profiles.length}</h3><div class="pmWaMeta">PeerMatch looks for Name / שם / Имя and Age / גיל / Возраст. It also checks the bottom of profile text for contact details. Review before saving.</div>${profiles}</div>
      <div id="pmWaStatus" class="pmWaMeta"></div>
      <div class="pmWaBar"><button id="pmWaImportNow" class="primary">Import selected</button><button id="pmWaCancel" class="secondary">Cancel</button></div>`);

    const sel=document.getElementById('pmWaSource'),nm=document.getElementById('pmWaSourceName'),add=document.getElementById('pmWaAddSource');
    sel.onchange=()=>{const x=(data.shadchanim||[]).find(z=>String(z.id)===String(sel.value));if(x)nm.value=x.name||'';add.checked=!x;};
    document.getElementById('pmWaCancel').onclick=()=>{cleanup(scan);close();};
    document.getElementById('pmWaImportNow').onclick=()=>importScan(scan);
  }

  function cleanup(scan){for(const p of scan?.profiles||[])if(p.preview)try{URL.revokeObjectURL(p.preview)}catch(_){}}
  function rows(scan){
    const contacts=[...document.querySelectorAll('[data-contact]')].map(r=>({use:r.querySelector('.pmWaUseContact').checked,name:r.querySelector('.pmWaCName').value.trim(),phone:r.querySelector('.pmWaCPhone').value.trim(),email:r.querySelector('.pmWaCEmail').value.trim()}));
    const profiles=[...document.querySelectorAll('[data-profile]')].map(r=>{
      const p=scan.profiles[+r.dataset.profile];
      return{original:p,use:r.querySelector('.pmWaUseProfile').checked,name:r.querySelector('.pmWaPName').value.trim(),age:r.querySelector('.pmWaPAge').value.trim(),kind:r.querySelector('.pmWaPKind').value,contactName:r.querySelector('.pmWaPContactName').value.trim(),contactPhone:r.querySelector('.pmWaPContactPhone').value.trim(),contactEmail:r.querySelector('.pmWaPContactEmail').value.trim()};
    });
    return{contacts,profiles};
  }
  function bestSender(messages,sourceName){
    const senders=[...new Set(messages.map(m=>m.sender).filter(Boolean))];
    return senders.find(s=>sameName(s,sourceName)||(phoneNorm(s)&&phoneNorm(s)===phoneNorm(sourceName)))||senders[0]||'';
  }
  function resolveSource(scan){
    const id=document.getElementById('pmWaSource').value,name=document.getElementById('pmWaSourceName').value.trim()||scan.sourceGuess||'WhatsApp shadchan';
    let x=(data.shadchanim||[]).find(z=>String(z.id)===String(id))||existingShad(name,name);
    if(!x&&document.getElementById('pmWaAddSource').checked){
      const p=/^\+?[\d\s().-]{8,}$/.test(name)?name:'';
      x={id:Date.now()+Math.floor(Math.random()*1000),name:p?'WhatsApp shadchan':name,phone:p,email:'',tags:'',referredBy:'',referredById:null,activities:[]};
      data.shadchanim.unshift(x);
    }
    return{x,name:x?.name||name};
  }
  function importHistory(source,scan,sourceName){
    if(!source)return 0;
    source.activities=source.activities||[];
    const old=new Set(source.activities.map(a=>a.importKey).filter(Boolean)),their=bestSender(scan.messages,sourceName);let n=0;
    for(const m of scan.messages){
      const text=String(m.text||'').trim();if(!text||pureAttachment(text))continue;
      const key='wa61:'+hash([m.date,m.time,m.sender,text].join('|'));if(old.has(key))continue;
      source.activities.push({id:Date.now()+n,type:sameName(m.sender,their)?'wa-in':'wa-out',text,ts:(m.date+' '+m.time).trim(),importKey:key,importedFrom:'WhatsApp ZIP',whatsappSender:m.sender});
      old.add(key);n++;
    }
    return n;
  }

  async function importScan(scan){
    const btn=document.getElementById('pmWaImportNow'),st=document.getElementById('pmWaStatus');btn.disabled=true;btn.textContent='Importing…';
    try{
      const r=rows(scan);
      for(const p of r.profiles)if(p.use){if(!p.kind)throw new Error('Choose Guy or Girl for each selected profile.');if(p.age&&(+p.age<18||+p.age>99))throw new Error('Check the age for '+(p.name||'a selected profile')+'.');}
      const src=resolveSource(scan),source=src.x,sourceName=src.name;let added=0,updated=0,profiles=0;
      for(const c of r.contacts){
        if(!c.use||(!c.name&&!c.phone))continue;
        let x=existingShad(c.name,c.phone);
        if(x){if(!x.phone&&c.phone)x.phone=c.phone;if(!x.email&&c.email)x.email=c.email;if(!x.referredBy&&sourceName){x.referredBy=sourceName;x.referredById=source?.id||null;}updated++;}
        else{data.shadchanim.unshift({id:Date.now()+Math.floor(Math.random()*1e6),name:c.name||c.phone||'Imported shadchan',phone:c.phone,email:c.email,tags:'',referredBy:sourceName||'',referredById:source?.id||null,activities:[]});added++;}
      }
      for(const p of r.profiles){
        if(!p.use||existingProfile(p.kind,p.name,p.age,p.original.text))continue;
        let image=null,attachment=null,attachmentName='',attachmentType='';
        if(p.original.entry){
          const b=await p.original.entry.blob();
          if(isImage(p.original.entry.name))image=b;
          else{attachment=b;attachmentName=p.original.fileName;attachmentType=b.type;}
        }
        const contactName=p.contactName||sourceName||'',contactPhone=p.contactPhone||source?.phone||'',contactEmail=p.contactEmail||source?.email||'';
        data[p.kind].unshift({
          id:Date.now()+Math.floor(Math.random()*1e6),name:p.name||((p.kind==='guys'?'Guy':'Girl')+' profile'),age:p.age||'',text:p.original.text||'',
          profileImage:image,photo:image,profileMediaFull:image,profileMediaThumb:image,
          profileAttachment:attachment,profileAttachmentName:attachmentName,profileAttachmentType:attachmentType,
          source:contactName,sourceName:contactName,sourcePhone:contactPhone,sourceEmail:contactEmail,
          importedFromShadchan:sourceName||'',importedFromShadchanId:source?.id||null,
          activities:[{id:Date.now(),type:'action',action:'Imported from WhatsApp',text:'Imported from WhatsApp chat'+(sourceName?' with '+sourceName:''),ts:typeof stamp==='function'?stamp():new Date().toLocaleString()}]
        });
        profiles++;
      }
      const hist=document.getElementById('pmWaHistory')?.checked?importHistory(source,scan,sourceName):0;
      await save();try{render();}catch(_){try{renderS();renderP('guys');renderP('girls');}catch(__){}}
      cleanup(scan);alert(`Import complete.\n\n${added} shadchanim added\n${updated} existing shadchanim updated\n${profiles} profiles added\n${hist} WhatsApp messages added to History`);close();
    }catch(e){
      console.warn('PeerMatch WhatsApp import',e);st.textContent=e?.message||'Import failed.';alert(e?.message||'Import failed.');btn.disabled=false;btn.textContent='Import selected';
    }
  }

  async function chooseZip(file){
    if(!file)return;
    if(!/\.zip$/i.test(file.name)&&!/zip/i.test(file.type||''))return alert('Choose a WhatsApp Export chat ZIP file.');
    open('<h2>Import WhatsApp ZIP</h2><div class="pmWaCard">Opening the ZIP and looking for conversation messages, contact cards and profiles…</div>');
    try{await showScan(await scanZip(file));}catch(e){console.warn(e);alert(e?.message||'Could not open this ZIP.');close();}
  }

  function installImportButton(){
    const tb=document.querySelector('#shadchanimSection .toolbar');
    if(!tb||document.getElementById('pmWaImport'))return;
    const b=document.createElement('button'),i=document.createElement('input');
    b.id='pmWaImport';b.className='secondary pmWaImportBtn';b.textContent='Import';
    i.id='pmWaZipInput';i.type='file';i.accept='.zip,application/zip,application/x-zip-compressed';i.className='hidden';
    tb.appendChild(b);tb.appendChild(i);b.onclick=()=>i.click();i.onchange=()=>{const f=i.files?.[0];i.value='';if(f)chooseZip(f);};
  }

  function addReferralField(){
    const h=String(document.querySelector('#sheet h2')?.textContent||'').trim();
    const addName=document.getElementById('sn'),editName=document.getElementById('v19SName')||document.getElementById('esName'),nameInput=addName||editName;
    if(!nameInput||!/^Add Shadchan|^Edit Shadchan/i.test(h)||document.getElementById('pmReferredBy'))return;
    const lab=document.createElement('label');lab.appendChild(document.createTextNode('Referred by'));
    const inp=document.createElement('input'),dl=document.createElement('datalist');inp.id='pmReferredBy';inp.placeholder='Who referred this shadchan?';inp.setAttribute('list','pmRefNames');dl.id='pmRefNames';
    dl.innerHTML=(data.shadchanim||[]).map(x=>`<option value="${safe(x.name||'')}"></option>`).join('');lab.append(inp,dl);
    const tags=document.getElementById('st')||document.getElementById('v19STags')||document.getElementById('esTags');
    (tags?.closest('label')||nameInput.closest('label'))?.insertAdjacentElement('afterend',lab);
    if(!addName&&activeShadId!=null){const x=(data.shadchanim||[]).find(z=>String(z.id)===String(activeShadId));if(x)inp.value=x.referredBy||'';}
    const saveBtn=document.getElementById('pmFormSave')||document.getElementById('v19Save');
    if(!saveBtn||saveBtn.dataset.pmRefBound==='1')return;
    saveBtn.dataset.pmRefBound='1';
    const before=new Set((data.shadchanim||[]).map(x=>String(x.id)));
    saveBtn.addEventListener('click',()=>{
      const value=String(document.getElementById('pmReferredBy')?.value||'').trim(),ref=(data.shadchanim||[]).find(z=>sameName(z.name,value))||null;
      if(!addName&&activeShadId!=null){
        const x=(data.shadchanim||[]).find(z=>String(z.id)===String(activeShadId));if(x){x.referredBy=value;x.referredById=ref?.id||null;}
      }else{
        setTimeout(async()=>{
          const x=(data.shadchanim||[]).find(z=>!before.has(String(z.id)));
          if(x){x.referredBy=value;x.referredById=ref?.id||null;try{await save();renderS();}catch(_){}}
        },180);
      }
    },true);
  }

  function referralDetail(id){
    const x=(data.shadchanim||[]).find(z=>String(z.id)===String(id)),sheet=document.getElementById('sheet');
    if(!x||!sheet)return;sheet.querySelectorAll('.pmRefByDetail').forEach(e=>e.remove());if(!x.referredBy)return;
    const d=document.createElement('div');d.className='pmRefByDetail';d.innerHTML='<b>Referred by:</b> '+safe(x.referredBy);
    (sheet.querySelector('.v19ShadHead')||sheet.querySelector('h2'))?.insertAdjacentElement('afterend',d);
  }

  function attachmentDetail(k,id){
    const x=(data[k]||[]).find(z=>String(z.id)===String(id)),sheet=document.getElementById('sheet');
    if(!x||!sheet||!x.profileAttachment||sheet.querySelector('.pmAttachmentBox'))return;
    const box=document.createElement('div');box.className='pmAttachmentBox';
    box.innerHTML=`<div class="small">Profile attachment</div><div>${safe(x.profileAttachmentName||'Attached profile')}</div><button type="button" class="secondary">Open attachment</button>`;
    const anchor=sheet.querySelector('#v19EditProfile')||sheet.querySelector('#pe')||sheet.querySelector('.sectionTitle');
    anchor?.insertAdjacentElement('beforebegin',box);
    box.querySelector('button').onclick=()=>{const u=URL.createObjectURL(x.profileAttachment);window.open(u,'_blank','noopener');setTimeout(()=>{try{URL.revokeObjectURL(u)}catch(_){}},60000);};
  }

  const oldOpenS=window.openS;
  if(typeof oldOpenS==='function')window.openS=openS=function(id){activeShadId=id;const r=oldOpenS(id);setTimeout(()=>referralDetail(id),0);return r;};
  const oldOpenP=window.openP;
  if(typeof oldOpenP==='function')window.openP=openP=function(k,id){const r=oldOpenP(k,id);setTimeout(()=>attachmentDetail(k,id),0);return r;};

  async function sharedZip(){
    try{
      if(typeof get!=='function')return;
      const x=await get('inbox','pending');if(!x?.files?.length)return;
      const f=x.files.find(z=>/\.zip$/i.test(z.name||'')||/zip/i.test(z.type||''));if(!f)return;
      await del('inbox','pending');chooseZip(f);
    }catch(e){console.warn('PeerMatch shared ZIP',e);}
  }

  let queued=false;
  function polish(){installImportButton();addReferralField();}
  new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;polish();});}).observe(document.body,{childList:true,subtree:true});
  setTimeout(()=>{polish();sharedZip();},900);
})();
