/* PeerMatch v44: clearer required profile field and Name wording. */
(function(){
  document.documentElement.dataset.peerMatchVersion='44';

  function setLabelText(label,text){
    if(!label)return;
    [...label.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE).forEach(n=>n.remove());
    label.insertBefore(document.createTextNode(text),label.firstChild);
  }

  function decorate(){
    const name=document.getElementById('v19Name');
    const profile=document.getElementById('v19Profile');
    const saveBtn=document.getElementById('v19Save');
    if(name){
      setLabelText(name.closest('label'),'Name');
      name.placeholder='Name';
    }
    if(profile){
      setLabelText(profile.closest('label'),'Profile (required)');
      profile.placeholder='Paste, type, or record the profile';
    }
    if(saveBtn&&profile&&saveBtn.dataset.pmv44Required!=='1'){
      saveBtn.dataset.pmv44Required='1';
      saveBtn.addEventListener('click',e=>{
        const text=String(profile.value||'').trim();
        const audioBtn=document.getElementById('v19ProfileAudio');
        const audioState=String(audioBtn?.textContent||'').trim();
        const hasOrSavingAudio=/Replace audio|Audio saved|Stop audio|Saving audio/i.test(audioState);
        if(text||hasOrSavingAudio)return;
        e.preventDefault();
        e.stopImmediatePropagation();
        alert('Paste, type, or record the profile before saving.');
        try{profile.focus();}catch(err){}
      },true);
    }
  }

  new MutationObserver(decorate).observe(document.body,{childList:true,subtree:true});
  decorate();
})();
