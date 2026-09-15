/* PeerMatch v40: sender contact actions on Guy/Girl profiles. */
(function(){
  document.documentElement.dataset.peerMatchVersion='40';

  const style=document.createElement('style');
  style.textContent=`
    .pmProfileContact{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:8px 0 11px}
    .pmProfileContact button{padding:9px 4px;font-size:10px;border-radius:10px;min-height:38px}
    .pmProfileCompose textarea{min-height:140px!important}
    @media(max-width:380px){.pmProfileContact{gap:4px}.pmProfileContact button{font-size:9px;padding:8px 2px}}
  `;
  document.head.appendChild(style);

  function record(k,id){return (data[k]||[]).find(x=>String(x.id)===String(id))||null;}
  function senderName(x){return String(x?.sourceName||x?.source||'').trim();}
  function senderPhone(x){return String(x?.sourcePhone||'').trim();}
  function senderEmail(x){return String(x?.sourceEmail||'').trim();}
  function normalizePhone(p){let d=String(p||'').replace(/\D/g,'');if(d.startsWith('00'))d=d.slice(2);if(d.startsWith('0'))d='972'+d.slice(1);return d;}

  async function logAction(x,entry){
    x.activities=x.activities||[];
    x.activities.push(Object.assign({id:Date.now(),ts:stamp()},entry));
    try{await save();render();return true;}catch(e){console.warn('PeerMatch v40 history save',e);alert('PeerMatch could not save this action. Nothing was opened.');return false;}
  }

  function closeCompose(k,id){if(k==='guys'||k==='girls')openP(k,id);else close();}

  function compose(k,id,channel){
    const x=record(k,id);if(!x)return;
    const phone=senderPhone(x),email=senderEmail(x),name=senderName(x)||'Sender';
    if((channel==='SMS'||channel==='WhatsApp')&&!phone)return alert('Add the sender phone in Edit Profile first.');
    if(channel==='Email'&&!email)return alert('Add the sender email in Edit Profile first.');

    open(`<h2>${esc(channel)} message</h2><div class="small">To: ${esc(name)}${channel==='Email'?' • '+esc(email):' • '+esc(phone)}</div><div class="pmProfileCompose"><label>Message<textarea id="pmProfileContactMessage" placeholder="Type your message…"></textarea></label></div><div class="v19Fixed form" id="pmProfileContactFixed"><button id="pmProfileContactContinue" class="primary">Continue</button><button id="pmProfileContactCancel" class="secondary">Cancel</button></div>`);
    document.getElementById('sheet')?.classList.add('v19Bottom');
    document.getElementById('pmProfileContactCancel').onclick=()=>closeCompose(k,id);
    document.getElementById('pmProfileContactContinue').onclick=async()=>{
      const text=String(document.getElementById('pmProfileContactMessage')?.value||'').trim();
      if(!text)return alert('Type a message first.');
      let target='',type='',label='';
      if(channel==='WhatsApp'){
        const d=normalizePhone(phone);if(!d)return alert('Check the sender phone number.');
        target='https://wa.me/'+d+'?text='+encodeURIComponent(text);type='wa-out';label='You → WhatsApp';
      }else if(channel==='SMS'){
        target='sms:'+phone+'?body='+encodeURIComponent(text);type='sms-out';label='You → SMS';
      }else{
        target='mailto:'+encodeURIComponent(email)+'?body='+encodeURIComponent(text);type='email-out';label='You → Email';
      }
      const ok=await logAction(x,{type,text,action:label,recipient:name,recipientPhone:phone,recipientEmail:email,recipientSide:'Sender'});
      if(!ok)return;
      location.href=target;
    };
  }

  async function callSender(k,id){
    const x=record(k,id);if(!x)return;
    const phone=senderPhone(x),name=senderName(x)||'Sender';
    if(!phone)return alert('Add the sender phone in Edit Profile first.');
    const ok=await logAction(x,{type:'action',action:'Call • Sender',text:`Call opened to ${name} (${phone}).`,recipient:name,recipientPhone:phone,recipientSide:'Sender'});
    if(!ok)return;
    location.href='tel:'+phone;
  }

  function install(k,id){
    if(k!=='guys'&&k!=='girls')return;
    const sheet=document.getElementById('sheet'),x=record(k,id);if(!sheet||!x)return;
    sheet.querySelectorAll('.pmProfileContact').forEach(el=>el.remove());
    const row=document.createElement('div');row.className='pmProfileContact';
    row.innerHTML='<button type="button" class="primary" data-act="call">Call</button><button type="button" class="secondary" data-act="sms">SMS</button><button type="button" class="green" data-act="wa">WhatsApp</button><button type="button" class="secondary" data-act="email">Email</button>';
    const meta=sheet.querySelector('.pmMeta');
    const head=sheet.querySelector('.v19Head');
    if(meta)meta.insertAdjacentElement('afterend',row);else if(head)head.insertAdjacentElement('afterend',row);else sheet.prepend(row);
    row.querySelector('[data-act="call"]').onclick=()=>callSender(k,id);
    row.querySelector('[data-act="sms"]').onclick=()=>compose(k,id,'SMS');
    row.querySelector('[data-act="wa"]').onclick=()=>compose(k,id,'WhatsApp');
    row.querySelector('[data-act="email"]').onclick=()=>compose(k,id,'Email');
  }

  const priorOpenP=window.openP;
  if(typeof priorOpenP==='function')window.openP=openP=function(k,id){
    const r=priorOpenP(k,id);
    setTimeout(()=>install(k,id),0);
    return r;
  };
})();
