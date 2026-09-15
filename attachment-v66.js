/* PeerMatch v66: compact, reliable profile attachment opening. */
(function(){
  let active=null,queued=false;
  const css=document.createElement('style');
  css.textContent=`
    .pmV63Attachment{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:8px!important;margin:7px 0!important;padding:7px 9px!important;border-radius:10px!important;min-width:0!important}
    .pmV63Attachment>div{min-width:0!important;overflow-wrap:anywhere!important;font-size:11px!important;line-height:1.25!important}
    .pmV63Attachment .small{font-size:9.5px!important;margin:0 0 2px!important}
    .pmV63Attachment button{width:auto!important;flex:0 0 auto!important;margin:0!important;padding:6px 8px!important;border-radius:8px!important;font-size:10px!important;min-height:30px!important}
  `;
  document.head.appendChild(css);

  function currentRecord(){
    if(!active)return null;
    return(data[active.k]||[]).find(x=>String(x.id)===String(active.id))||null;
  }
  function openBlob(blob,name){
    if(!(blob instanceof Blob))return alert('This attachment is no longer available.');
    const url=URL.createObjectURL(blob);
    let opened=false;
    try{
      const w=window.open('', '_blank');
      if(w){w.location.href=url;opened=true;}
    }catch(_){ }
    if(!opened){
      try{const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener';a.style.display='none';document.body.appendChild(a);a.click();a.remove();opened=true;}catch(_){ }
    }
    if(!opened){
      try{const a=document.createElement('a');a.href=url;a.download=name||'profile-attachment';document.body.appendChild(a);a.click();a.remove();}catch(_){alert('Could not open the attachment on this device.');}
    }
    setTimeout(()=>URL.revokeObjectURL(url),300000);
  }
  function decorate(){
    const box=document.querySelector('#sheet .pmV63Attachment');if(!box)return;
    const btn=box.querySelector('button');if(!btn||btn.dataset.pmV66Open==='1')return;
    btn.dataset.pmV66Open='1';btn.textContent='Open';
    btn.onclick=e=>{e.preventDefault();e.stopPropagation();const x=currentRecord();if(!x?.profileAttachment)return alert('This attachment is not available.');openBlob(x.profileAttachment,x.profileAttachmentName||'profile-attachment');};
  }
  const p=window.openP;if(typeof p==='function')window.openP=function(k,id){active={k,id};const r=p(k,id);setTimeout(decorate,30);return r;};
  const s=window.openS;if(typeof s==='function')window.openS=function(id){active={k:'shadchanim',id};const r=s(id);setTimeout(decorate,30);return r;};
  function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;decorate();});}
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});schedule();
})();
