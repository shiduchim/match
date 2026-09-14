/* PeerMatch v34: optional photo inclusion for WhatsApp / Email via native share sheet. */
(function(){
  document.documentElement.dataset.peerMatchVersion='34';

  const style=document.createElement('style');
  style.textContent=`
    .pmIncludePhotos{display:flex;align-items:center;gap:8px;margin:9px 1px 3px;font-size:12px;color:var(--text);cursor:pointer}
    .pmIncludePhotos input{width:18px;height:18px;margin:0;accent-color:var(--accent)}
  `;
  document.head.appendChild(style);

  function senderName(x){return String(x?.sourceName||x?.source||'').trim();}
  function senderPhone(x){return String(x?.sourcePhone||'').trim();}
  function cleanName(x,fallback){return String(x?.name||'').trim()||fallback;}
  function digits(s){return String(s||'').replace(/\D/g,'');}

  function visibleFor(k){
    const searchId=k==='shadchanim'?'shadchanSearch':k+'Search';
    const q=(document.getElementById(searchId)?.value||'').toLowerCase();
    return (data[k]||[]).filter(x=>{
      const hay=k==='shadchanim'
        ?`${x.name||''} ${x.phone||''} ${x.email||''} ${x.tags||''} ${(x.activities||[]).map(a=>a.text||a.action||'').join(' ')}`
        :`${x.name||''} ${x.age||''} ${x.text||''} ${senderName(x)} ${senderPhone(x)} ${(x.activities||[]).map(a=>a.text||a.action||'').join(' ')}`;
      return hay.toLowerCase().includes(q);
    });
  }

  function checkedRecords(k){
    const listId=k==='shadchanim'?'shadchanList':k+'List';
    const list=document.getElementById(listId);
    if(!list)return[];
    const arr=visibleFor(k);
    const boxes=[...list.querySelectorAll('.pmListCheck')];
    const out=[];
    boxes.forEach((box,i)=>{if(box.checked&&arr[i])out.push(arr[i]);});
    return out;
  }

  function fullPhoto(x){return x?.profileMediaFull||x?.profileImage||x?.photo||null;}
  function extFor(type){
    const map={'image/jpeg':'.jpg','image/png':'.png','image/webp':'.webp','image/gif':'.gif'};
    return map[String(type||'').toLowerCase()]||'.jpg';
  }
  function safePart(s){return String(s||'profile').replace(/[^a-z0-9_-]+/gi,'_').replace(/^_+|_+$/g,'').slice(0,45)||'profile';}
  function toPhotoFile(blob,name){
    if(!(blob instanceof Blob))return null;
    const type=blob.type||'image/jpeg';
    if(typeof File!=='undefined'&&blob instanceof File&&blob.name)return blob;
    try{return new File([blob],name,{type,lastModified:Date.now()});}catch(e){return null;}
  }
  function photoFiles(guy,girl){
    const files=[];
    const add=(side,x)=>{
      const photo=fullPhoto(x);
      if(!(photo instanceof Blob))return;
      const f=toPhotoFile(photo,side+'_'+safePart(cleanName(x,side))+'_photo'+extFor(photo.type));
      if(f)files.push(f);
    };
    add('Guy',guy);add('Girl',girl);
    return files;
  }
  function photoNames(guy,girl){
    const out=[];
    if(fullPhoto(guy) instanceof Blob)out.push('Guy photo');
    if(fullPhoto(girl) instanceof Blob)out.push('Girl photo');
    return out;
  }

  function recipients(guy,girl){
    const out=[];
    const add=(side,x)=>{
      const phone=senderPhone(x);if(!phone)return;
      const name=senderName(x);
      out.push({label:side+' sender'+(name?' — '+name:''),phone,side});
    };
    add('Girl',girl);add('Guy',guy);
    return out.filter((r,i,a)=>a.findIndex(z=>digits(z.phone)===digits(r.phone))===i);
  }

  function currentRecipient(guy,girl,shadchan){
    if(shadchan)return {label:cleanName(shadchan,'Shadchan'),phone:String(shadchan.phone||''),side:'Shadchan'};
    const arr=recipients(guy,girl);
    const sel=document.getElementById('pmMatchRecipient');
    return arr[Number(sel?.value||0)]||null;
  }

  function addHistory(guy,girl,shadchan,recipient,channel,message,names){
    const matchId=Date.now(),ts=stamp();
    const gName=cleanName(guy,'Guy profile'),lName=cleanName(girl,'Girl profile');
    const requested=channel==='whatsapp'?'WhatsApp':'Email';
    const recipientLabel=shadchan?cleanName(shadchan,'Shadchan'):(recipient?.label||'profile sender');
    const list=(names||[]).join(', ');
    const suffix=list?' Photos: '+list+'.':'';
    const meta={matchId,guyId:guy.id,girlId:girl.id,shadchanId:shadchan?.id||null,channel:channel+'-photo-share',message,recipient:recipientLabel,recipientPhone:recipient?.phone||'',recipientSide:recipient?.side||'',media:names||[]};
    guy.activities=guy.activities||[];girl.activities=girl.activities||[];
    guy.activities.push({id:matchId+1,type:'action',action:'Match shared with photos • '+requested,text:`Share sheet completed for ${requested} about match with ${lName}.${suffix}\n\n${message}`,ts,...meta});
    girl.activities.push({id:matchId+2,type:'action',action:'Match shared with photos • '+requested,text:`Share sheet completed for ${requested} about match with ${gName}.${suffix}\n\n${message}`,ts,...meta});
    if(shadchan){
      shadchan.activities=shadchan.activities||[];
      shadchan.activities.push({id:matchId+3,type:'action',action:'Match shared with photos • '+requested,text:`Share sheet completed for ${requested}: ${gName} ↔ ${lName}.${suffix}\n\n${message}`,ts,...meta});
    }
  }

  async function shareWithPhotos(channel){
    const guys=checkedRecords('guys'),girls=checkedRecords('girls'),shads=checkedRecords('shadchanim');
    if(guys.length!==1||girls.length!==1)return;
    const guy=guys[0],girl=girls[0],shadchan=shads[0]||null;
    if(channel==='email'&&!shadchan)return alert('Email currently requires a selected Shadchan.');

    const files=photoFiles(guy,girl);
    if(!files.length)return alert('There are no saved profile photos to include.');
    if(!navigator.share||!navigator.canShare)return alert('This phone/browser cannot share saved photos from PeerMatch.');
    let can=false;
    try{can=navigator.canShare({files});}catch(e){can=false;}
    if(!can)return alert('This phone/browser cannot share these profile photos.');

    const message=String(document.getElementById('pmMatchMessage')?.value||'').trim();
    if(!message)return alert('Enter a message.');
    const title='Shidduch suggestion: '+cleanName(guy,'Guy')+' & '+cleanName(girl,'Girl');
    const recipient=currentRecipient(guy,girl,shadchan);

    try{
      await navigator.share({title,text:message,files});
    }catch(e){
      if(e?.name==='AbortError')return;
      console.warn('PeerMatch v34 photo share',e);
      return alert('The phone could not open the share sheet with the match photos.');
    }

    addHistory(guy,girl,shadchan,recipient,channel,message,photoNames(guy,girl));
    try{await save();}
    catch(e){
      console.warn('PeerMatch v34 history save',e);
      return alert('The match was shared, but PeerMatch could not save the share in history.');
    }
    try{render();}catch(e){}
    close();
  }

  function installCheckbox(){
    const form=document.querySelector('.pmMatchForm');
    const actions=form?.querySelector('.pmMatchActions');
    if(!form||!actions||document.getElementById('pmIncludePhotos'))return;
    const guys=checkedRecords('guys'),girls=checkedRecords('girls');
    if(guys.length!==1||girls.length!==1)return;
    if(!photoFiles(guys[0],girls[0]).length)return;

    const label=document.createElement('label');
    label.className='pmIncludePhotos';
    label.innerHTML='<input id="pmIncludePhotos" type="checkbox"> <span>Include photos</span>';
    actions.parentNode.insertBefore(label,actions);
  }

  document.addEventListener('click',function(e){
    const btn=e.target?.closest?.('button');
    if(!btn||(btn.id!=='pmMatchWA'&&btn.id!=='pmMatchEmail'))return;
    const cb=document.getElementById('pmIncludePhotos');
    if(!cb?.checked)return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    shareWithPhotos(btn.id==='pmMatchWA'?'whatsapp':'email');
  },true);

  installCheckbox();
  new MutationObserver(installCheckbox).observe(document.body,{childList:true,subtree:true});
})();
