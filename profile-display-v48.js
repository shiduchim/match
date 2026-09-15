/* PeerMatch v48: profile display polish.
   - Focus list/detail thumbnails toward the face while keeping full-photo view unchanged.
   - Render WhatsApp-style *bold* / **bold** in profile display without changing stored text.
   - Move Edit Profile above the profile text for easier access.
*/
(function(){
  const style=document.createElement('style');
  style.textContent=`
    img.photo{object-position:50% 20%;width:58px;height:58px}
    #v19DetailMedia img{object-position:50% 20%;transform:scale(1.16);transform-origin:50% 28%}
    #v19EditProfile{margin:8px 0 10px}
    .pmWhatsAppBold strong{font-weight:800;color:inherit}
  `;
  document.head.appendChild(style);

  function escHtml(s){
    return String(s??'')
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;');
  }

  function whatsappBoldHtml(raw){
    let h=escHtml(raw);
    // Support both Markdown-style **bold** and WhatsApp-style *bold*.
    h=h.replace(/\*\*([^*\n]+?)\*\*/g,'<strong>$1</strong>');
    h=h.replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/gm,'$1<strong>$2</strong>');
    return h;
  }

  function polishProfileDetail(){
    const sheet=document.getElementById('sheet');
    const edit=document.getElementById('v19EditProfile');
    if(!sheet||!edit)return;

    // Keep Edit Profile near the top: after title/meta, before profile text/audio.
    const firstProfileContent=sheet.querySelector('.card, .v19ProfileAudio, .sectionTitle');
    if(firstProfileContent&&edit.nextElementSibling!==firstProfileContent){
      firstProfileContent.insertAdjacentElement('beforebegin',edit);
    }

    // Only alter the displayed profile. Stored text (and Edit textarea) stays unchanged.
    const profileText=sheet.querySelector('.card > .profileText');
    if(profileText&&!profileText.dataset.pmWhatsAppBold){
      const raw=profileText.textContent||'';
      if(raw.includes('*')){
        profileText.innerHTML=whatsappBoldHtml(raw);
        profileText.classList.add('pmWhatsAppBold');
      }
      profileText.dataset.pmWhatsAppBold='1';
    }
  }

  let scheduled=false;
  function schedule(){
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(()=>{
      scheduled=false;
      polishProfileDetail();
    });
  }

  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
  schedule();
})();
