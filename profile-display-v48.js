/* PeerMatch v49: profile display polish.
   - Stronger face-focused crop in Guy/Girl list and detail thumbnails.
   - Render WhatsApp-style *bold* / **bold** in profile detail without changing stored text.
   - Hide literal * markers from Guy/Girl list display only.
   - Keep Edit Profile above the profile text for easier access.
*/
(function(){
  const style=document.createElement('style');
  style.textContent=`
    .pmFaceCrop{width:62px;height:62px;flex:0 0 62px;border-radius:14px;overflow:hidden;background:#edf0f1;display:block}
    .pmFaceCrop img.photo{width:100%!important;height:100%!important;border-radius:0!important;object-fit:cover!important;object-position:50% 8%!important;transform:scale(1.52);transform-origin:50% 10%;display:block}
    #v19DetailMedia{overflow:hidden}
    #v19DetailMedia img{object-position:50% 8%!important;transform:scale(1.42)!important;transform-origin:50% 10%!important}
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
    h=h.replace(/\*\*([^*\n]+?)\*\*/g,'<strong>$1</strong>');
    h=h.replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/gm,'$1<strong>$2</strong>');
    return h;
  }

  function polishProfileDetail(){
    const sheet=document.getElementById('sheet');
    const edit=document.getElementById('v19EditProfile');
    if(!sheet||!edit)return;

    const firstProfileContent=sheet.querySelector('.card, .v19ProfileAudio, .sectionTitle');
    if(firstProfileContent&&edit.nextElementSibling!==firstProfileContent){
      firstProfileContent.insertAdjacentElement('beforebegin',edit);
    }

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

  function polishLists(){
    ['guysList','girlsList'].forEach(id=>{
      const list=document.getElementById(id);
      if(!list)return;

      // Make the list photo feel like a headshot while keeping the stored/full image unchanged.
      list.querySelectorAll('img.photo').forEach(img=>{
        if(img.parentElement?.classList.contains('pmFaceCrop'))return;
        const wrap=document.createElement('span');
        wrap.className='pmFaceCrop';
        img.parentNode.insertBefore(wrap,img);
        wrap.appendChild(img);
      });

      // WhatsApp formatting marks should never appear in the compact list view.
      list.querySelectorAll('.name,.small,.pmPill').forEach(el=>{
        if((el.textContent||'').includes('*'))el.textContent=el.textContent.replace(/\*/g,'');
      });
    });
  }

  let scheduled=false;
  function schedule(){
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(()=>{
      scheduled=false;
      polishProfileDetail();
      polishLists();
    });
  }

  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
  schedule();
})();
