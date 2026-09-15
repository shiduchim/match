/* PeerMatch v55: profile display polish.
   - Keep profile photos on the individual profile card/detail view, but hide them from Guy/Girl list views.
   - Render WhatsApp-style *bold* / **bold** in profile detail without changing stored text.
   - Hide literal * markers from Guy/Girl list display and profile title/name display.
   - Keep Edit Profile directly below the profile text.
*/
(function(){
  const style=document.createElement('style');
  style.textContent=`
    #guysList .photo,#girlsList .photo,#guysList .pmFaceCrop,#girlsList .pmFaceCrop{display:none!important}
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

    // Names copied from WhatsApp sometimes arrive as *Name* or **Name**.
    // Never show formatting stars in the profile title tile.
    const title=sheet.querySelector('.v19Head h2');
    if(title&&(title.textContent||'').includes('*')){
      title.textContent=title.textContent.replace(/\*/g,'').trim();
    }

    // Keep Edit Profile directly under the profile text/card.
    const profileCard=sheet.querySelector('.card:has(> .profileText)')||sheet.querySelector('.card');
    if(profileCard&&profileCard.nextElementSibling!==edit){
      profileCard.insertAdjacentElement('afterend',edit);
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
