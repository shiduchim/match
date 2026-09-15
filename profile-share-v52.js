/* PeerMatch v52: selected-profile sharing shortcuts.
   Guy/Girl selection bar becomes: WhatsApp | SMS | Email | Delete | Clear.
   - Removes Copy from profile selections.
   - WhatsApp keeps the original profile text, including WhatsApp *bold* markers.
   - SMS strips * formatting markers.
   - When a selected profile has a photo, use Android/Web Share so the photo can travel with the text.
*/
(function(){
  const tracked={guys:new Set(),girls:new Set()};

  function senderName(x){return String(x?.sourceName||x?.source||'').trim();}
  function senderPhone(x){return String(x?.sourcePhone||'').trim();}

  function recordText(x){
    return [
      x?.name||'Unnamed profile',
      x?.age?'Age: '+x.age:'',
      x?.text||'',
      senderName(x)?'Sent by: '+senderName(x):'',
      senderPhone(x)?'Sender phone: '+senderPhone(x):''
    ].filter(Boolean).join('\n');
  }

  function visible(k){
    const q=(document.getElementById(k+'Search')?.value||'').toLowerCase();
    return (data[k]||[]).filter(x=>{
      const hay=`${x.name||''} ${x.age||''} ${x.text||''} ${senderName(x)} ${senderPhone(x)} ${(x.activities||[]).map(a=>a.text||a.action||'').join(' ')}`;
      return hay.toLowerCase().includes(q);
    });
  }

  function itemForCheckbox(k,check){
    const list=document.getElementById(k+'List');
    const card=check.closest('.card');
    if(!list||!card)return null;
    const cards=Array.from(list.children).filter(el=>el.classList?.contains('card'));
    const index=cards.indexOf(card);
    return index>=0?visible(k)[index]||null:null;
  }

  function selectedCount(k){
    const t=document.querySelector('#pmSelected-'+k+' .pmCount')?.textContent||'';
    const m=t.match(/\d+/);
    return m?Number(m[0]):0;
  }

  function selectedItems(k){
    const n=selectedCount(k);
    let items=(data[k]||[]).filter(x=>tracked[k].has(x.id));
    if(items.length===n)return items;

    const list=document.getElementById(k+'List');
    if(!list)return [];
    const a=visible(k),cards=Array.from(list.children).filter(el=>el.classList?.contains('card'));
    items=[];
    cards.forEach((card,i)=>{
      if(card.querySelector('.pmListCheck:checked')&&a[i])items.push(a[i]);
    });
    return items;
  }

  function fullPhoto(x){
    return x?.profileMediaFull||x?.profileMedia||x?.profileImage||x?.photo||null;
  }

  function safeName(s){
    return String(s||'profile').replace(/[\\/:*?\"<>|]+/g,' ').replace(/\s+/g,' ').trim().slice(0,60)||'profile';
  }

  function asFile(blob,x,index){
    if(!(blob instanceof Blob))return null;
    const type=blob.type||'image/jpeg';
    const ext=type.includes('png')?'png':type.includes('webp')?'webp':type.includes('gif')?'gif':'jpg';
    return new File([blob],safeName(x?.name||('profile-'+(index+1)))+'.'+ext,{type});
  }

  function bodyFor(items){
    return items.map(recordText).join('\n\n--------------------\n\n');
  }

  function plainSmsText(s){
    return String(s||'').replace(/\*+/g,'');
  }

  function profileFiles(items){
    return items.map((x,i)=>asFile(fullPhoto(x),x,i)).filter(Boolean);
  }

  async function shareWithFiles(title,text,files){
    const canShare=typeof navigator.share==='function'&&(!navigator.canShare||navigator.canShare({files}));
    if(!canShare)return false;
    try{
      await navigator.share({title,text,files});
      return true;
    }catch(err){
      if(err?.name==='AbortError')return true;
      console.warn('PeerMatch profile share failed',err);
      return false;
    }
  }

  async function sendWhatsApp(k){
    const items=selectedItems(k);if(!items.length)return;
    const text=bodyFor(items),files=profileFiles(items);
    if(files.length&&await shareWithFiles('PeerMatch profile',text,files))return;
    location.href='https://wa.me/?text='+encodeURIComponent(text);
  }

  async function sendSms(k){
    const items=selectedItems(k);if(!items.length)return;
    const text=plainSmsText(bodyFor(items)),files=profileFiles(items);
    // Web pages cannot directly attach a file to an sms: URI. With a photo,
    // use the Android share sheet so the user can choose Messages/RCS/MMS.
    if(files.length&&await shareWithFiles('PeerMatch profile',text,files))return;
    location.href='sms:?body='+encodeURIComponent(text);
  }

  function polishBar(k){
    const bar=document.getElementById('pmSelected-'+k);
    if(!bar||bar.classList.contains('hidden'))return;

    bar.querySelector('#pmCopy-'+k)?.remove();

    const email=bar.querySelector('#pmEmail-'+k);
    if(!email)return;

    if(!bar.querySelector('#pmWhatsApp-'+k)){
      const b=document.createElement('button');
      b.id='pmWhatsApp-'+k;b.className='secondary';b.textContent='WhatsApp';
      email.insertAdjacentElement('beforebegin',b);
    }
    if(!bar.querySelector('#pmSms-'+k)){
      const b=document.createElement('button');
      b.id='pmSms-'+k;b.className='secondary';b.textContent='SMS';
      email.insertAdjacentElement('beforebegin',b);
    }
  }

  function polish(){
    polishBar('guys');
    polishBar('girls');
  }

  document.addEventListener('click',e=>{
    const check=e.target.closest?.('.pmListCheck');
    if(check){
      const list=check.closest('#guysList,#girlsList');
      if(list){
        const k=list.id==='guysList'?'guys':'girls';
        const x=itemForCheckbox(k,check);
        if(x){
          if(check.checked)tracked[k].add(x.id);
          else tracked[k].delete(x.id);
        }
      }
      return;
    }

    const clear=e.target.closest?.('button[id^="pmClear-"]');
    if(clear){
      const k=clear.id.slice('pmClear-'.length);
      if(tracked[k])tracked[k].clear();
      return;
    }

    const wa=e.target.closest?.('button[id^="pmWhatsApp-"]');
    if(wa){
      const k=wa.id.slice('pmWhatsApp-'.length);
      if(k==='guys'||k==='girls'){
        e.preventDefault();e.stopImmediatePropagation();sendWhatsApp(k);
      }
      return;
    }

    const sms=e.target.closest?.('button[id^="pmSms-"]');
    if(sms){
      const k=sms.id.slice('pmSms-'.length);
      if(k==='guys'||k==='girls'){
        e.preventDefault();e.stopImmediatePropagation();sendSms(k);
      }
    }
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
