/* PeerMatch v55: share selected shadchan contact information.
   Adds WhatsApp and SMS beside Email for the Shadchanim selection bar.
   Removes Copy there so sharing actions stay focused and consistent.
*/
(function(){
  let waQueue=[];
  let waIndex=0;

  function visibleShadchanim(){
    const q=(document.getElementById('shadchanSearch')?.value||'').toLowerCase();
    return (data.shadchanim||[]).filter(x=>{
      const hay=`${x.name||''} ${x.phone||''} ${x.email||''} ${x.tags||''} ${(x.activities||[]).map(a=>a.text||a.action||'').join(' ')}`;
      return hay.toLowerCase().includes(q);
    });
  }

  function selectedItems(){
    const list=document.getElementById('shadchanList');
    if(!list)return[];
    const visible=visibleShadchanim();
    const cards=Array.from(list.children).filter(el=>el.classList?.contains('card'));
    const out=[];
    cards.forEach((card,i)=>{
      if(card.querySelector('.pmListCheck:checked')&&visible[i])out.push(visible[i]);
    });
    return out;
  }

  function contactText(x){
    return [
      String(x?.name||'Unnamed shadchan').replace(/\*/g,'').trim(),
      x?.phone?'Phone: '+x.phone:'',
      x?.email?'Email: '+x.email:'',
      x?.tags?'Tags: '+x.tags:''
    ].filter(Boolean).join('\n');
  }

  function combinedText(items){
    return items.map(contactText).join('\n\n--------------------\n\n');
  }

  function closeQueue(){
    document.getElementById('pmShadWaQueue')?.remove();
    waQueue=[];
    waIndex=0;
  }

  function safeHtml(s){
    return String(s||'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
  }

  function renderQueue(){
    document.getElementById('pmShadWaQueue')?.remove();
    if(!waQueue.length||waIndex>=waQueue.length){closeQueue();return;}
    const x=waQueue[waIndex];
    const shade=document.createElement('div');
    shade.id='pmShadWaQueue';
    shade.style.cssText='position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.36);display:flex;align-items:flex-end;justify-content:center;padding:14px';
    const box=document.createElement('div');
    box.style.cssText='width:min(560px,100%);background:#fff;border-radius:18px;padding:16px;box-shadow:0 12px 36px rgba(0,0,0,.28)';
    box.innerHTML=`
      <div style="font-weight:850;font-size:17px;margin-bottom:5px">Share shadchanim separately</div>
      <div style="font-size:13px;color:#667;margin-bottom:12px">Shadchan ${waIndex+1} of ${waQueue.length}: <b>${safeHtml(String(x?.name||'Unnamed shadchan').replace(/\*/g,''))}</b></div>
      <button id="pmShadWaNext" style="width:100%;padding:12px;border-radius:12px;font-weight:850">Share this shadchan</button>
      <button id="pmShadWaCancel" class="secondary" style="width:100%;margin-top:8px;padding:10px;border-radius:12px">Cancel</button>`;
    shade.appendChild(box);
    document.body.appendChild(shade);

    box.querySelector('#pmShadWaCancel').onclick=closeQueue;
    box.querySelector('#pmShadWaNext').onclick=()=>{
      const text=contactText(x);
      waIndex++;
      if(waIndex>=waQueue.length)closeQueue();else renderQueue();
      location.href='https://wa.me/?text='+encodeURIComponent(text);
    };
  }

  function sendWhatsApp(){
    const items=selectedItems();if(!items.length)return;
    if(items.length===1){
      location.href='https://wa.me/?text='+encodeURIComponent(contactText(items[0]));
      return;
    }
    waQueue=items.slice();
    waIndex=0;
    renderQueue();
  }

  function sendSms(){
    const items=selectedItems();if(!items.length)return;
    location.href='sms:?body='+encodeURIComponent(combinedText(items));
  }

  function polish(){
    const bar=document.getElementById('pmSelected-shadchanim');
    if(!bar||bar.classList.contains('hidden'))return;

    bar.querySelector('#pmCopy-shadchanim')?.remove();
    const email=bar.querySelector('#pmEmail-shadchanim');
    if(!email)return;

    if(!bar.querySelector('#pmWhatsApp-shadchanim')){
      const b=document.createElement('button');
      b.id='pmWhatsApp-shadchanim';b.className='secondary';b.textContent='WhatsApp';
      email.insertAdjacentElement('afterend',b);
    }
    if(!bar.querySelector('#pmSms-shadchanim')){
      const b=document.createElement('button');
      b.id='pmSms-shadchanim';b.className='secondary';b.textContent='SMS';
      email.insertAdjacentElement('afterend',b);
    }
  }

  document.addEventListener('click',e=>{
    const wa=e.target.closest?.('#pmWhatsApp-shadchanim');
    if(wa){e.preventDefault();e.stopImmediatePropagation();sendWhatsApp();return;}
    const sms=e.target.closest?.('#pmSms-shadchanim');
    if(sms){e.preventDefault();e.stopImmediatePropagation();sendSms();}
  },true);

  let scheduled=false;
  function schedule(){
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(()=>{scheduled=false;polish();});
  }
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
  schedule();
})();
