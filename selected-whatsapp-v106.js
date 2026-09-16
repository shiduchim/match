/* PeerMatch v106: one selected Shadchan + selected profile(s) opens that Shadchan's WhatsApp directly. */
(function(){
  document.documentElement.dataset.peerMatchVersion='106';
  const selected={shadchanim:new Set(),guys:new Set(),girls:new Set()};
  let seq=0;

  const trim=v=>String(v||'').trim();
  function senderName(x){return trim(x?.sourceName||x?.source);}
  function senderPhone(x){return trim(x?.sourcePhone);}
  function profileText(x){return [x?.name||'Unnamed profile',x?.age?'Age: '+x.age:'',x?.text||'',senderName(x)?'Sent by: '+senderName(x):'',senderPhone(x)?'Sender phone: '+senderPhone(x):''].filter(Boolean).join('\n');}
  function visible(k){
    const q=String(document.getElementById(k+'Search')?.value||'').toLowerCase();
    if(k==='shadchanim')return(data.shadchanim||[]).filter(x=>`${x.name||''} ${x.phone||''} ${x.email||''} ${x.tags||''} ${(x.activities||[]).map(a=>a.text||a.action||'').join(' ')}`.toLowerCase().includes(q));
    return(data[k]||[]).filter(x=>`${x.name||''} ${x.age||''} ${x.text||''} ${senderName(x)} ${senderPhone(x)} ${(x.activities||[]).map(a=>a.text||a.action||'').join(' ')}`.toLowerCase().includes(q));
  }
  function itemForCheckbox(k,check){
    const list=document.getElementById(k+'List'),card=check.closest('.card');if(!list||!card)return null;
    const cards=[...list.children].filter(el=>el.classList?.contains('card')),i=cards.indexOf(card);return i>=0?visible(k)[i]||null:null;
  }
  function waPhone(p){
    if(typeof window.pmWhatsAppDigits==='function'){try{return String(window.pmWhatsAppDigits(p)||'');}catch(_){ }}
    let d=String(p||'').replace(/\D/g,'');if(d.startsWith('00972'))d=d.slice(2);if(d.startsWith('0'))d='972'+d.slice(1);else if(d.length===9&&d.startsWith('5'))d='972'+d;return d;
  }
  function selectedItems(k){return(data[k]||[]).filter(x=>selected[k].has(String(x.id)));}
  function selectedShads(){return(data.shadchanim||[]).filter(x=>selected.shadchanim.has(String(x.id)));}

  function refreshFromDom(k){
    const list=document.getElementById(k+'List');if(!list)return;const arr=visible(k),cards=[...list.children].filter(el=>el.classList?.contains('card'));
    const seen=new Set();cards.forEach((card,i)=>{const x=arr[i],c=card.querySelector('.pmListCheck');if(!x||!c)return;const id=String(x.id);seen.add(id);if(c.checked)selected[k].add(id);else selected[k].delete(id);});
  }
  function syncAll(){refreshFromDom('shadchanim');refreshFromDom('guys');refreshFromDom('girls');}

  async function logShare(k,x,sh,text,linkId){
    x.activities=x.activities||[];sh.activities=sh.activities||[];const ts=typeof stamp==='function'?stamp():new Date().toLocaleString();
    x.activities.push({id:Date.now()*1000+(seq++%1000),type:'action',action:'Profile sent • WhatsApp',text,ts,channel:'whatsapp',recipient:trim(sh.name)||'Shadchan',recipientPhone:trim(sh.phone),recipientSide:'Shadchan',recipientShadchanId:sh.id,shadchanId:sh.id,sharedProfileId:x.id,sharedProfileName:trim(x.name)||'Unnamed profile',sharedProfileKind:k,shareLinkId:linkId});
    sh.activities.push({id:Date.now()*1000+(seq++%1000),type:'action',action:'Profile received • WhatsApp',text,ts,channel:'whatsapp',sharedProfileId:x.id,sharedProfileName:trim(x.name)||'Unnamed profile',sharedProfileKind:k,profileId:x.id,profileName:trim(x.name)||'Unnamed profile',shareLinkId:linkId});
  }
  async function directSend(k){
    syncAll();const profiles=selectedItems(k),shads=selectedShads();
    if(shads.length!==1)return false;
    if(!profiles.length)return false;
    const sh=shads[0],direct=waPhone(sh.phone);if(!direct){alert('The selected Shadchan needs a phone number for WhatsApp.');return true;}
    const parts=[];
    for(const x of profiles){const text=profileText(x),linkId=`direct-${x.id}-${sh.id}-${Date.now()}-${seq++}`;parts.push(text);await logShare(k,x,sh,text,linkId);}
    try{await save();}catch(e){console.warn('PeerMatch v106 WhatsApp history save',e);alert('PeerMatch could not save the WhatsApp history.');return true;}
    const message=parts.join('\n\n--------------------\n\n');
    location.href='https://wa.me/'+direct+'?text='+encodeURIComponent(message);
    return true;
  }

  document.addEventListener('click',e=>{
    const check=e.target.closest?.('.pmListCheck');
    if(check){
      const list=check.closest('#shadchanList,#guysList,#girlsList');if(!list)return;
      const k=list.id==='shadchanList'?'shadchanim':list.id==='guysList'?'guys':'girls',x=itemForCheckbox(k,check);if(!x)return;
      const id=String(x.id);if(check.checked)selected[k].add(id);else selected[k].delete(id);return;
    }
    const clear=e.target.closest?.('button[id^="pmClear-"]');
    if(clear){const k=clear.id.slice('pmClear-'.length);if(selected[k])selected[k].clear();return;}
    const wa=e.target.closest?.('button[id^="pmWhatsApp-"]');if(!wa)return;
    const k=wa.id.slice('pmWhatsApp-'.length);if(k!=='guys'&&k!=='girls')return;
    syncAll();const shads=selectedShads();if(!shads.length)return;
    e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
    if(shads.length>1){alert('Select only one Shadchan before sending a profile.');return;}
    directSend(k);
  },true);

  window.addEventListener('focus',()=>setTimeout(syncAll,80));
  setTimeout(syncAll,500);
})();