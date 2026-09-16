/* PeerMatch v96: show known recipient name/phone in profile and Shadchan history. */
(function(){
  document.documentElement.dataset.peerMatchVersion='96';
  let active=null,queued=false;

  const style=document.createElement('style');
  style.textContent=`
    #sheet .pmV96Recipient{font-size:11px;font-weight:800;color:#315b78;margin:4px 0 5px;overflow-wrap:anywhere}
  `;
  document.head.appendChild(style);

  const rec=(k,id)=>(data[k]||[]).find(x=>String(x.id)===String(id))||null;

  function decorate(){
    const sheet=document.getElementById('sheet');if(!sheet||!active)return;
    const x=rec(active.k,active.id);if(!x)return;
    const events=[...sheet.querySelectorAll('.event')],acts=[...(x.activities||[])].reverse();
    if(!events.length||!acts.length)return;
    events.forEach((el,i)=>{
      const a=acts[i];if(!a)return;
      const name=String(a.recipient||'').trim(),phone=String(a.recipientPhone||'').trim(),email=String(a.recipientEmail||'').trim();
      const value=[name,phone,email].filter(Boolean).join(' • ');
      let line=el.querySelector('.pmV96Recipient');
      if(!value){line?.remove();return;}
      if(!line){line=document.createElement('div');line.className='pmV96Recipient';el.querySelector('.eventTop')?.insertAdjacentElement('afterend',line);}
      line.textContent='To: '+value;
    });
  }

  const p=window.openP;if(typeof p==='function')window.openP=function(k,id){active={k,id};const r=p(k,id);setTimeout(decorate,100);return r;};
  const s=window.openS;if(typeof s==='function')window.openS=function(id){active={k:'shadchanim',id};const r=s(id);setTimeout(decorate,100);return r;};
  function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;decorate();});}
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});schedule();
})();
