/* PeerMatch v31: rename Send Match to Make Match and add a tracked Girl-side Call action. */
(function(){
  document.documentElement.dataset.peerMatchVersion='31';

  const style=document.createElement('style');
  style.textContent=`
    .pmMatchSend{grid-template-columns:repeat(4,1fr)!important}
    @media(max-width:390px){.pmMatchSend{grid-template-columns:repeat(2,1fr)!important}}
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

  async function callGirlSide(){
    const guys=checkedRecords('guys');
    const girls=checkedRecords('girls');
    const shads=checkedRecords('shadchanim');
    if(guys.length!==1)return alert('Select exactly one Guy.');
    if(girls.length!==1)return alert('Select exactly one Girl.');

    const guy=guys[0],girl=girls[0];
    const phone=senderPhone(girl);
    if(!phone)return alert('The selected Girl needs a sender phone number before you can call from Make match.');

    const gName=cleanName(guy,'Guy profile');
    const lName=cleanName(girl,'Girl profile');
    const contactName=senderName(girl)||'Girl sender';
    const matchId=Date.now();
    const ts=stamp();
    const meta={
      matchId,
      guyId:guy.id,
      girlId:girl.id,
      channel:'call',
      recipient:contactName,
      recipientPhone:phone,
      recipientSide:'Girl'
    };

    guy.activities=guy.activities||[];
    girl.activities=girl.activities||[];
    guy.activities.push({
      id:matchId+1,
      type:'action',
      action:'Match call • Girl sender',
      text:`Call opened to ${contactName} (${phone}) about match with ${lName}.`,
      ts,
      ...meta
    });
    girl.activities.push({
      id:matchId+2,
      type:'action',
      action:'Match call • Girl sender',
      text:`Call opened to ${contactName} (${phone}) about match with ${gName}.`,
      ts,
      ...meta
    });

    // If the selected Shadchan is actually the same phone contact, record it there too.
    if(shads.length===1&&digits(shads[0].phone)===digits(phone)&&digits(phone)){
      const s=shads[0];
      s.activities=s.activities||[];
      s.activities.push({
        id:matchId+3,
        type:'action',
        action:'Match call • Girl sender',
        text:`Call opened about match: ${gName} ↔ ${lName}.`,
        ts,
        ...meta,
        shadchanId:s.id
      });
    }

    try{await save();}
    catch(e){
      console.warn('PeerMatch v31 call history save',e);
      return alert('PeerMatch could not save the call in history, so the call was not opened.');
    }

    try{render();}catch(e){}
    close();
    location.href='tel:'+phone;
  }

  function updateMakeMatchUI(){
    const top=document.querySelector('.pmSendMatchTop');
    if(top&&top.textContent!=='Make match')top.textContent='Make match';

    const h=document.querySelector('#sheet h2');
    if(h&&/^Send match$/i.test(h.textContent.trim()))h.textContent='Make match';

    const actions=document.querySelector('.pmMatchSend');
    if(actions&&!document.getElementById('pmMatchCall')){
      const b=document.createElement('button');
      b.id='pmMatchCall';
      b.type='button';
      b.className='secondary';
      b.textContent='Call';
      b.title='Call the Girl-side sender and record it in match history';
      b.onclick=callGirlSide;
      actions.appendChild(b);
    }
  }

  updateMakeMatchUI();
  new MutationObserver(updateMakeMatchUI).observe(document.body,{childList:true,subtree:true});
})();
