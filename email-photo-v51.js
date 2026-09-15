/* PeerMatch v58: email selected profiles with photos when available.
   - Photos use Web Share so Gmail/email apps can receive attachments.
   - Text-only selections use mailto as before.
   - Each selected profile gets a History entry when its Email share is opened/successfully handed off.
*/
(function(){
  const tracked={guys:new Set(),girls:new Set()};
  let historySeq=0;

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
    if(!list)return null;
    const a=visible(k),cards=Array.from(list.children).filter(el=>el.classList?.contains('card'));
    items=[];
    cards.forEach((card,i)=>{
      if(card.querySelector('.pmListCheck:checked')&&a[i])items.push(a[i]);
    });
    return items.length===n?items:null;
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

  async function recordEmailShare(items){
    (items||[]).forEach(x=>{
      x.activities=x.activities||[];
      x.activities.push({
        id:Date.now()*1000+(historySeq++%1000),
        type:'action',
        action:'Profile shared • Email',
        text:'Profile sharing opened via Email.',
        ts:stamp()
      });
    });
    try{await save();}
    catch(err){console.warn('PeerMatch could not save Email share history',err);}
  }

  function mailto(subject,body,items){
    recordEmailShare(items);
    let u='mailto:?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(body);
    if(u.length>16000){
      navigator.clipboard?.writeText(body).catch(()=>{});
      u='mailto:?subject='+encodeURIComponent(subject);
    }
    location.href=u;
  }

  async function emailProfiles(items){
    const subject='PeerMatch selected profiles';
    const body=items.map(recordText).join('\n\n--------------------\n\n');
    const files=items.map((x,i)=>asFile(fullPhoto(x),x,i)).filter(Boolean);

    if(!files.length){mailto(subject,body,items);return;}

    const payload={title:subject,text:body,files};
    const canShare=typeof navigator.share==='function'&&(!navigator.canShare||navigator.canShare({files}));
    if(canShare){
      try{
        await navigator.share(payload);
        await recordEmailShare(items);
        return;
      }catch(err){
        if(err?.name==='AbortError')return;
        console.warn('PeerMatch email photo share failed',err);
      }
    }

    alert('This browser cannot attach the photo automatically. PeerMatch will open the email with the profile text instead.');
    mailto(subject,body,items);
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

    const btn=e.target.closest?.('button[id^="pmEmail-"]');
    if(!btn)return;
    const k=btn.id.slice('pmEmail-'.length);
    if(k!=='guys'&&k!=='girls')return;

    const items=selectedItems(k);
    if(!items||!items.length)return;

    e.preventDefault();
    e.stopImmediatePropagation();
    emailProfiles(items);
  },true);
})();
