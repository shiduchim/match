/* PeerMatch v62: require some profile content without blocking image-only profiles. */
(function(){
  document.documentElement.dataset.peerMatchVersion='62';

  function setLabelTextOnce(label,text,key){
    if(!label||label.dataset[key]==='1')return;
    label.dataset[key]='1';
    [...label.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE).forEach(n=>n.remove());
    label.insertBefore(document.createTextNode(text),label.firstChild);
  }

  function decorate(){
    const name=document.getElementById('v19Name');
    const profile=document.getElementById('v19Profile');
    const saveBtn=document.getElementById('v19Save');

    if(name){
      setLabelTextOnce(name.closest('label'),'Name','pmv45NameLabel');
      if(name.placeholder!=='Name')name.placeholder='Name';
    }

    if(profile){
      setLabelTextOnce(profile.closest('label'),'Profile','pmv45ProfileLabel');
      if(profile.placeholder!=='Paste, type, or record the profile')profile.placeholder='Paste, type, or record the profile';
    }

    if(saveBtn&&profile&&saveBtn.dataset.pmv45Required!=='1'){
      saveBtn.dataset.pmv45Required='1';
      saveBtn.addEventListener('click',e=>{
        const text=String(profile.value||'').trim();
        const audioBtn=document.getElementById('v19ProfileAudio');
        const audioState=String(audioBtn?.textContent||'').trim();
        const hasOrSavingAudio=/Replace audio|Audio saved|Stop audio|Saving audio/i.test(audioState);
        const hasImage=!!document.querySelector('#v19Media img');
        if(text||hasOrSavingAudio||hasImage)return;
        e.preventDefault();
        e.stopImmediatePropagation();
        alert('Add profile text, audio, or a photo/screenshot before saving.');
        try{profile.focus();}catch(err){}
      },true);
    }
  }

  let scheduled=false;
  const schedule=()=>{
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(()=>{scheduled=false;decorate();});
  };

  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
  decorate();
})();
