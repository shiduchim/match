/* PeerMatch v65: recover profile/shadchan links from both contact phones and profile tail. */
(function(){
  function key(p){return typeof pmPhoneKey==='function'?pmPhoneKey(p):String(p||'').replace(/\D/g,'');}
  function shad(p){const k=key(p);return k?(data.shadchanim||[]).find(s=>key(s.phone)===k)||null:null;}
  function recover(k,id){
    const x=(data[k]||[]).find(z=>String(z.id)===String(id));if(!x)return;
    const found=[];const add=s=>{if(s&&!found.some(v=>String(v.id)===String(s.id)))found.push(s);};
    add(shad(x.sourcePhone));add(shad(x.sourcePhone2));
    const tail=String(x.text||'').split(/\r?\n/).slice(-18).join('\n');
    (tail.match(/(?:\+?\d[\d\s().-]{7,}\d)/g)||[]).forEach(p=>add(shad(p)));
    let changed=false;
    if(found[0]&&String(x.sourceShadchanId||'')!==String(found[0].id)){x.sourceShadchanId=found[0].id;x.sourceShadchanName=found[0].name||'';changed=true;}
    if(found[1]&&String(x.sourceShadchanId2||'')!==String(found[1].id)){x.sourceShadchanId2=found[1].id;if(!x.sourcePhone2)x.sourcePhone2=found[1].phone||'';changed=true;}
    if(changed)try{save();}catch(_){}
  }
  const prior=window.openP;
  if(typeof prior==='function')window.openP=function(k,id){recover(k,id);const r=prior(k,id);setTimeout(()=>recover(k,id),60);return r;};
})();
