/* PeerMatch v121: Shadchan contact-card WhatsApp handoff without the web intermediary.
   When no Guy/Girl profile is being routed, the Shadchanim-tab WhatsApp button shares
   the selected Shadchan contact card(s). On Android, use whatsapp://send?text= so the
   installed WhatsApp app opens directly and PeerMatch stays underneath. This prevents
   returning to the api.whatsapp.com / "Share on WhatsApp" Chrome-like screen.

   Profile-routing cases remain owned by v119/v116:
   - one profile + many Shadchanim -> pmRouteMultiShadchanWhatsApp()
   - profile(s) + exactly one Shadchan -> pmRouteSelectedWhatsApp()
*/
(function(){
  document.documentElement.dataset.peerMatchVersion='121';
  let scheduled=false,queue=[],index=0;

  const trim=v=>String(v||'').trim();
  const clean=v=>trim(v).replace(/\*/g,'');

  function selectedShadchanim(){
    try{return typeof window.pmGetSelected==='function'?(window.pmGetSelected('shadchanim')||[]):[];}catch(e){return[];}
  }

  function contactText(x){
    return [
      clean(x?.name)||'Unnamed shadchan',
      x?.phone?'Phone: '+x.phone:'',
      x?.email?'Email: '+x.email:'',
      x?.tags?'Tags: '+x.tags:''
    ].filter(Boolean).join('\n');
  }

  function openWhatsAppPicker(text){
    if(/Android/i.test(navigator.userAgent||'')){
      location.href='whatsapp://send?text='+encodeURIComponent(text||'');
      return;
    }
    location.href='https://wa.me/?text='+encodeURIComponent(text||'');
  }

  function closeQueue(){
    document.getElementById('pmV121ShadQueue')?.remove();
    queue=[];index=0;
  }

  function renderQueue(){
    document.getElementById('pmV121ShadQueue')?.remove();
    if(!queue.length||index>=queue.length){closeQueue();return;}
    const x=queue[index];
    const shade=document.createElement('div');shade.id='pmV121ShadQueue';
    shade.style.cssText='position:fixed;inset:0;z-index:100001;background:rgba(0,0,0,.36);display:flex;align-items:flex-end;justify-content:center;padding:14px';
    const box=document.createElement('div');
    box.style.cssText='width:min(560px,100%);background:#fff;border-radius:18px;padding:16px;box-shadow:0 12px 36px rgba(0,0,0,.28)';
    const label=document.createElement('div');
    label.style.cssText='font-size:14px;color:#445;margin-bottom:12px';
    label.textContent='Send '+(clean(x?.name)||'Shadchan')+' ('+(index+1)+' of '+queue.length+')';
    const send=document.createElement('button');send.className='primary full';send.textContent='Send';
    const cancel=document.createElement('button');cancel.className='secondary full';cancel.style.marginTop='8px';cancel.textContent='Cancel';
    send.onclick=()=>{
      const text=contactText(x);
      index++;
      if(index>=queue.length)closeQueue();else renderQueue();
      openWhatsAppPicker(text);
    };
    cancel.onclick=closeQueue;
    box.append(label,send,cancel);shade.appendChild(box);document.body.appendChild(shade);
  }

  function shareSelectedShadchanim(){
    const items=selectedShadchanim();if(!items.length)return;
    if(items.length===1){openWhatsAppPicker(contactText(items[0]));return;}
    queue=items.slice();index=0;renderQueue();
  }

  function bind(){
    const b=document.getElementById('pmWhatsApp-shadchanim');
    if(!b||b.dataset.pmV121Bound==='1')return;
    b.dataset.pmV121Bound='1';
    b.onclick=()=>{
      if(typeof window.pmRouteMultiShadchanWhatsApp==='function'&&window.pmRouteMultiShadchanWhatsApp())return;
      if(typeof window.pmRouteSelectedWhatsApp==='function'&&window.pmRouteSelectedWhatsApp())return;
      shareSelectedShadchanim();
    };
  }

  function polish(){bind();}
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;polish();});}
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
  schedule();setTimeout(polish,300);
})();
