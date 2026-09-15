/* PeerMatch v80: authoritative reverse links from Shadchan to Guy/Girl profiles. */
(function(){
  document.documentElement.dataset.peerMatchVersion='80';
  let activeShad=null,queued=false;

  const css=document.createElement('style');
  css.textContent=`
    /* Replace older reverse-link renderers with one list based on the saved manual link. */
    #sheet:has(.v19ShadHead) .pmV64ReverseLinks,
    #sheet:has(.v19ShadHead) .pmV65ReverseLinks{display:none!important}
    #sheet .pmV80ReverseLinks{margin:8px 0 11px;padding:9px 10px;border:1px solid #d7e2e9;border-radius:11px;background:#f7fafc}
    #sheet .pmV80ReverseTitle{font-size:11px;font-weight:850;color:var(--muted);margin-bottom:6px}
    #sheet .pmV80ReverseProfiles{display:flex;flex-wrap:wrap;gap:6px}
    #sheet .pmV80ProfileBtn{width:auto!important;padding:7px 9px!important;border-radius:9px!important;background:#e8f1f7!important;color:#274b64!important;font-size:11px!important;font-weight:850!important}
  `;
  document.head.appendChild(css);

  function linkedTo(x,shadId){
    if(!x)return false;
    /* Once the user has explicitly chosen/cleared a link, that choice is authoritative. */
    if(x.linkedShadchanManual===true){
      return x.linkedShadchanId!=null&&String(x.linkedShadchanId)===String(shadId);
    }
    /* Backward compatibility for older profiles that have not used the manual dropdown yet. */
    const id=x.linkedShadchanId??x.sourceShadchanId??x.importedFromShadchanId;
    return id!=null&&String(id)===String(shadId);
  }

  function profilesFor(shadId){
    const out=[];
    for(const k of ['guys','girls']){
      for(const x of data[k]||[]){if(linkedTo(x,shadId))out.push({k,x});}
    }
    return out;
  }

  function render(){
    const sheet=document.getElementById('sheet');
    if(!sheet)return;
    const isShad=!!sheet.querySelector('.v19ShadHead')&&!document.getElementById('v19SName')&&!document.getElementById('esName')&&!document.getElementById('sn');
    if(!isShad||activeShad==null){sheet.querySelector('.pmV80ReverseLinks')?.remove();return;}

    /* Remove old implementations so the user sees one definitive Linked profiles section. */
    sheet.querySelectorAll('.pmV64ReverseLinks,.pmV65ReverseLinks').forEach(el=>el.remove());

    const links=profilesFor(activeShad);
    const sig=JSON.stringify(links.map(p=>[p.k,String(p.x.id),String(p.x.name||'')]));
    let box=sheet.querySelector('.pmV80ReverseLinks');
    if(!links.length){box?.remove();return;}
    if(box?.dataset.sig===sig)return;
    box?.remove();

    box=document.createElement('div');box.className='pmV80ReverseLinks';box.dataset.sig=sig;
    const title=document.createElement('div');title.className='pmV80ReverseTitle';title.textContent=`Linked profiles (${links.length})`;
    const holder=document.createElement('div');holder.className='pmV80ReverseProfiles';
    for(const p of links){
      const b=document.createElement('button');b.type='button';b.className='pmV80ProfileBtn';
      b.textContent=(p.k==='guys'?'Guy: ':'Girl: ')+String(p.x.name||'Unnamed profile');
      b.onclick=()=>openP(p.k,p.x.id);
      holder.appendChild(b);
    }
    box.append(title,holder);

    const contact=sheet.querySelector('.v19Contact');
    const notes=sheet.querySelector('.pmV63ProfileCard');
    const quick=sheet.querySelector('.pmInlineTools');
    if(contact)contact.insertAdjacentElement('afterend',box);
    else if(notes)notes.insertAdjacentElement('beforebegin',box);
    else if(quick)quick.insertAdjacentElement('afterend',box);
    else sheet.querySelector('.v19ShadHead')?.insertAdjacentElement('afterend',box);
  }

  const prevS=window.openS;
  if(typeof prevS==='function')window.openS=function(id){activeShad=id;const r=prevS(id);setTimeout(render,90);return r;};
  const prevP=window.openP;
  if(typeof prevP==='function')window.openP=function(k,id){activeShad=null;const r=prevP(k,id);setTimeout(render,0);return r;};

  function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;render();});}
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
  schedule();
})();
