/* PeerMatch v22: allow an audio recording by itself to be a valid Guy/Girl profile.
   v21 owns the actual audio Blob and injects it after the base profile is created.
   The older v19 form validator does not know about that Blob, so this layer briefly
   supplies an internal sentinel only during Save, then removes it from the stored record.
*/
(function(){
  document.documentElement.dataset.peerMatchVersion='22';
  const SENTINEL='__PEERMATCH_AUDIO_ONLY__';

  function kindFromHeading(){
    const h=(document.querySelector('#sheet h2')?.textContent||'').trim();
    if(/^Add Guy\b/i.test(h)) return {k:'guys',label:'Guy'};
    if(/^Add Girl\b/i.test(h)) return {k:'girls',label:'Girl'};
    return null;
  }

  function bindAudioOnlySave(){
    const info=kindFromHeading();
    const saveBtn=document.getElementById('v19Save');
    const profile=document.getElementById('v19Profile');
    const audioBtn=document.getElementById('v19ProfileAudio');
    if(!info||!saveBtn||!profile||!audioBtn||saveBtn.dataset.v22AudioOnly==='1') return;

    saveBtn.dataset.v22AudioOnly='1';
    const beforeCount=(data[info.k]||[]).length;

    saveBtn.addEventListener('click',()=>{
      const hasSavedAudio=/Audio saved/i.test(audioBtn.textContent||'');
      const profileWasBlank=!profile.value.trim();
      if(!hasSavedAudio||!profileWasBlank) return;

      // Bridge only the old v19 validation/name fallback. v21 still owns and saves
      // the real audio Blob. The sentinel is removed immediately after creation.
      profile.value=SENTINEL;

      setTimeout(async()=>{
        try{
          if((data[info.k]||[]).length<=beforeCount) return;
          const x=data[info.k][0];
          if(!x) return;
          if(String(x.text||'').trim()===SENTINEL) x.text='';
          if(String(x.name||'').trim()===SENTINEL) x.name=info.label+' profile';
          if(!String(x.name||'').trim()) x.name=info.label+' profile';
          // Name, age and normal profile text remain optional. Do not copy the
          // Audio profile transcript into normal Profile text.
          await save();
          try{renderP(info.k);}catch(e){}
        }catch(e){console.warn('PeerMatch v22 audio-only cleanup',e);}
      },700);
    },true);
  }

  const scan=()=>bindAudioOnlySave();
  new MutationObserver(scan).observe(document.body,{childList:true,subtree:true});
  setInterval(scan,400);
  scan();
})();
