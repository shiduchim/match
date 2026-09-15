/* PeerMatch v42: compact Make Match action row + selectable call recipient, with idempotent observer updates. */
(function(){
  document.documentElement.dataset.peerMatchVersion='42';

  const style=document.createElement('style');
  style.textContent=`
    .pmMatchActions{grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:5px!important}
    .pmMatchActions button{padding:10px 3px!important;font-size:10.5px!important;min-width:0!important;white-space:nowrap}
    #pmMatchSharePhoto{width:auto!important;margin:0!important}
    .pmCallChoice{margin:8px 0 2px!important}
    .pmCallChoice select{margin-top:4px}
    @media(max-width:390px){
      .pmMatchActions{grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:4px!important}
      .pmMatchActions button{font-size:9.5px!important;padding:9px 2px!important}
    }
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

  function callTargets(guy,girl,shadchan){
    const out=[];
    const add=(label,phone,side,name)=>{
      phone=String(phone||'').trim();
      if(!phone)return;
      const d=digits(phone);
      if(d&&out.some(x=>digits(x.phone)===d))return;
      out.push({label,name:name||label,phone,side});
    };
    add('Girl sender',senderPhone(girl),'Girl',senderName(girl));
    add('Guy sender',senderPhone(guy),'Guy',senderName(guy));
    if(shadchan)add('Shadchan',shadchan.phone,'Shadchan',cleanName(shadchan,'Shadchan'));
    return out;
  }

  function addCallHistory(guy,girl,shadchan,target){
    const matchId=Date.now(),ts=stamp();
    const gName=cleanName(guy,'Guy profile'),lName=cleanName(girl,'Girl profile');
    const recipient=target.name&&target.name!==target.label?`${target.label} — ${target.name}`:target.label;
    const meta={matchId,guyId:guy.id,girlId:girl.id,shadchanId:shadchan?.id||null,channel:'call',recipient,recipientPhone:target.phone,recipientSide:target.side};
    guy.activities=guy.activities||[];
    girl.activities=girl.activities||[];
    guy.activities.push({id:matchId+1,type:'action',action:'Match call • '+target.label,text:`Call opened to ${recipient} (${target.phone}) about match with ${lName}.`,ts,...meta});
    girl.activities.push({id:matchId+2,type:'action',action:'Match call • '+target.label,text:`Call opened to ${recipient} (${target.phone}) about match with ${gName}.`,ts,...meta});
    if(shadchan){
      shadchan.activities=shadchan.activities||[];
      shadchan.activities.push({id:matchId+3,type:'action',action:'Match call • '+target.label,text:`Call opened to ${recipient} (${target.phone}) about match: ${gName} ↔ ${lName}.`,ts,...meta});
    }
  }

  async function doCall(){
    const guys=checkedRecords('guys'),girls=checkedRecords('girls'),shads=checkedRecords('shadchanim');
    if(guys.length!==1||girls.length!==1)return;
    const guy=guys[0],girl=girls[0],shadchan=shads[0]||null;
    const targets=callTargets(guy,girl,shadchan);
    if(!targets.length)return alert('No phone number is available for the selected Guy, Girl, or Shadchan.');
    const sel=document.getElementById('pmCallRecipient');
    const target=targets[Math.max(0,Number(sel?.value||0))]||targets[0];
    addCallHistory(guy,girl,shadchan,target);
    try{await save();}
    catch(e){console.warn('PeerMatch v42 call history save',e);return alert('PeerMatch could not save the call in history, so the call was not opened.');}
    try{render();}catch(e){}
    close();
    location.href='tel:'+target.phone;
  }

  function targetSignature(targets){
    return targets.map(t=>[t.label,t.name,t.phone,t.side].join('|')).join('||');
  }

  function install(){
    const form=document.querySelector('.pmMatchForm');
    const actions=form?.querySelector('.pmMatchActions');
    const callBtn=document.getElementById('pmMatchCall');
    const photoBtn=document.getElementById('pmMatchSharePhoto');
    if(!form||!actions||!callBtn)return;

    if(photoBtn&&photoBtn.parentElement!==actions){
      photoBtn.classList.remove('full','pmMatchSharePhoto');
      actions.appendChild(photoBtn);
    }

    const guys=checkedRecords('guys'),girls=checkedRecords('girls'),shads=checkedRecords('shadchanim');
    let wrap=document.getElementById('pmCallChoice');
    if(guys.length===1&&girls.length===1){
      const targets=callTargets(guys[0],girls[0],shads[0]||null);
      if(targets.length>1){
        if(!wrap){
          wrap=document.createElement('label');
          wrap.id='pmCallChoice';
          wrap.className='pmCallChoice';
          actions.parentNode.insertBefore(wrap,actions);
        }
        const sig=targetSignature(targets);
        if(wrap.dataset.targets!==sig){
          const current=Number(document.getElementById('pmCallRecipient')?.value||0);
          wrap.innerHTML='Call <select id="pmCallRecipient">'+targets.map((t,i)=>`<option value="${i}">${esc(t.label+(t.name&&t.name!==t.label?' — '+t.name:'')+' • '+t.phone)}</option>`).join('')+'</select>';
          wrap.dataset.targets=sig;
          const sel=wrap.querySelector('#pmCallRecipient');
          if(sel&&current>=0&&current<targets.length)sel.value=String(current);
        }
      }else if(wrap){
        wrap.remove();
      }
    }else if(wrap){
      wrap.remove();
    }

    if(callBtn.dataset.pmv42!=='1'){
      callBtn.dataset.pmv42='1';
      callBtn.onclick=e=>{e.preventDefault();e.stopPropagation();doCall();};
    }
  }

  let scheduled=false;
  function scheduleInstall(){
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(()=>{scheduled=false;install();});
  }

  install();
  new MutationObserver(scheduleInstall).observe(document.body,{childList:true,subtree:true});
})();
