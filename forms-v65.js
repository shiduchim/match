/* PeerMatch v65: religious level fields and small form fixes. */
(function(){
  let activeProfile=null,activeShad=null,queued=false;
  const style=document.createElement('style');
  style.textContent=`
    #sheet{overflow-x:hidden!important}
    #sheet .event,#sheet .profileText,#sheet .small,#sheet a{max-width:100%!important;overflow-wrap:anywhere!important;word-break:break-word!important}
    #sheet a{word-break:break-all!important;white-space:normal!important}
    #shadchanList .name{white-space:normal!important;overflow-wrap:anywhere!important;word-break:break-word!important}
    .pmChatDetail .v19Head,.pmChatDetail .v19ShadHead{position:sticky!important;top:0!important;z-index:90!important;background:var(--bg)!important}
    .v19Fixed.form,#pmFixedForm,#v19Fixed{z-index:1000!important;pointer-events:auto!important}
  `;
  document.head.appendChild(style);

  const rec=(k,id)=>(data[k]||[]).find(x=>String(x.id)===String(id))||null;
  const title=()=>String(document.querySelector('#sheet h2')?.textContent||'').trim();
  const kind=()=>/Guy/i.test(title())?'guys':/Girl/i.test(title())?'girls':'';
  function clamp(v){v=String(v||'').trim();if(v==='')return'';const n=Number(v);return Number.isFinite(n)?String(Math.max(0,Math.min(10,n))):'';}

  function profileField(){
    const tags=document.getElementById('pmV62FormTags');if(!tags||document.getElementById('pmV65RelForm'))return;
    const k=kind();if(!k)return;const edit=/^Edit\b/i.test(title()),x=edit&&activeProfile?.k===k?rec(k,activeProfile.id):null;
    const lab=document.createElement('label');lab.id='pmV65RelForm';lab.appendChild(document.createTextNode('Religious level 0-10'));
    const inp=document.createElement('input');inp.type='number';inp.min='0';inp.max='10';inp.inputMode='numeric';inp.placeholder='0-10';inp.value=x?.religiousLevel??'';lab.appendChild(inp);tags.closest('label')?.insertAdjacentElement('afterend',lab);
    const before=new Set((data[k]||[]).map(z=>String(z.id))),saveBtn=document.getElementById('v19Save');if(!saveBtn)return;
    saveBtn.addEventListener('click',()=>{const v=clamp(inp.value);inp.value=v;if(edit&&x){x.religiousLevel=v;setTimeout(()=>{x.religiousLevel=v;save();},180);}else setTimeout(()=>{const n=(data[k]||[]).find(z=>!before.has(String(z.id)));if(n){n.religiousLevel=v;save();}},220);},true);
  }

  function shadField(){
    const tags=document.getElementById('st')||document.getElementById('v19STags')||document.getElementById('esTags');if(!tags||document.getElementById('pmV65ShadRel'))return;
    const edit=/^Edit\b/i.test(title()),x=edit&&activeShad!=null?rec('shadchanim',activeShad):null;
    const lab=document.createElement('label');lab.id='pmV65ShadRel';lab.appendChild(document.createTextNode('Religious level 0-10'));
    const inp=document.createElement('input');inp.type='number';inp.min='0';inp.max='10';inp.inputMode='numeric';inp.placeholder='0-10';inp.value=x?.religiousLevel??'';lab.appendChild(inp);tags.closest('label')?.insertAdjacentElement('afterend',lab);
    const before=new Set((data.shadchanim||[]).map(z=>String(z.id))),saveBtn=document.getElementById('v19Save')||document.getElementById('pmFormSave')||document.getElementById('ss');if(!saveBtn)return;
    saveBtn.addEventListener('click',()=>{const v=clamp(inp.value);inp.value=v;if(edit&&x){x.religiousLevel=v;setTimeout(()=>{x.religiousLevel=v;save();},180);}else setTimeout(()=>{const n=(data.shadchanim||[]).find(z=>!before.has(String(z.id)));if(n){n.religiousLevel=v;save();}},220);},true);
  }

  function phone2Save(){
    const inp=document.getElementById('pmV65SenderPhone2'),btn=document.getElementById('v19Save');if(!inp||!btn||btn.dataset.pm65p2)return;btn.dataset.pm65p2='1';const k=kind();if(!k)return;const edit=/^Edit\b/i.test(title()),x=edit&&activeProfile?.k===k?rec(k,activeProfile.id):null,before=new Set((data[k]||[]).map(z=>String(z.id)));
    btn.addEventListener('click',()=>{const v=typeof pmNormalizePhone==='function'?pmNormalizePhone(inp.value):inp.value.trim();if(edit&&x)setTimeout(()=>{x.sourcePhone2=v;save();},180);else setTimeout(()=>{const n=(data[k]||[]).find(z=>!before.has(String(z.id)));if(n){n.sourcePhone2=v;save();}},220);},true);
  }

  const p=window.openP;if(typeof p==='function')window.openP=function(k,id){activeProfile={k,id};return p(k,id);};
  const s=window.openS;if(typeof s==='function')window.openS=function(id){activeShad=id;return s(id);};
  function polish(){profileField();shadField();phone2Save();}
  function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;polish();});}
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});schedule();
})();
