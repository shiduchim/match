/* PeerMatch v65: clean duplicate contact labels and separate contacts from profile text. */
(function(){
  let queued=false;
  function cleanName(s){
    let t=String(s||'').trim();
    for(let i=0;i<3;i++)t=t.replace(/^(?:contact(?:\s+person)?|sender(?:\s+name)?|איש קשר|לפרטים|контакт(?:ное лицо)?)\s*[:\-–]\s*/i,'').trim();
    return t;
  }
  function cleanMessage(text){
    const lines=String(text||'').split(/\r?\n/),out=[];
    for(const line of lines){
      const m=line.match(/^\s*Contact person:\s*(.*)$/i);
      if(!m){out.push(line);continue;}
      const contact=cleanName(m[1]);
      while(out.length&&out[out.length-1]==='')out.pop();
      out.push('','','CONTACT',contact||'Contact person');
    }
    return out.join('\n').replace(/\n{5,}/g,'\n\n\n\n');
  }
  function polish(){
    const form=document.querySelector('.pmV60Form'),msg=document.getElementById('pmMatchMessage'),sel=document.getElementById('pmV60Recipient');if(!form||!msg)return;
    const apply=()=>{const c=cleanMessage(msg.value);if(c!==msg.value)msg.value=c;};
    apply();
    if(form.dataset.pmV65ContactFix==='1')return;form.dataset.pmV65ContactFix='1';
    sel?.addEventListener('change',()=>setTimeout(apply,0));
    msg.addEventListener('input',()=>{});
    setTimeout(apply,40);
  }
  function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;polish();});}
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});schedule();
})();
