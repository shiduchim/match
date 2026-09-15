/* PeerMatch v92: clickable phone numbers inside Guy/Girl/Shadchan profile text.
   Tap a number -> Call / WhatsApp / Cancel. The chosen action is recorded in History.
*/
(function(){
  document.documentElement.dataset.peerMatchVersion='92';
  let active=null,queued=false;

  const style=document.createElement('style');
  style.textContent=`
    #sheet .pmV92InlinePhone{
      display:inline!important;
      width:auto!important;
      min-width:0!important;
      margin:0!important;
      padding:0!important;
      border:0!important;
      border-radius:0!important;
      background:transparent!important;
      color:#315b78!important;
      font:inherit!important;
      font-weight:850!important;
      line-height:inherit!important;
      text-decoration:underline!important;
      text-underline-offset:2px!important;
      cursor:pointer!important;
      touch-action:manipulation!important;
      vertical-align:baseline!important;
    }
    .pmV92PhoneShade{
      position:fixed;inset:0;z-index:16000;background:rgba(0,0,0,.38);
      display:flex;align-items:flex-end;justify-content:center;padding:14px
    }
    .pmV92PhoneSheet{
      width:min(520px,100%);background:#fff;border-radius:18px;padding:15px;
      box-shadow:0 12px 36px rgba(0,0,0,.28)
    }
    .pmV92PhoneTitle{font-size:16px;font-weight:900;color:var(--text);margin-bottom:3px}
    .pmV92PhoneNumber{font-size:13px;color:var(--muted);margin-bottom:12px;overflow-wrap:anywhere}
    .pmV92PhoneActions{display:grid;grid-template-columns:1fr 1fr;gap:8px}
    .pmV92PhoneActions button{width:100%!important;min-height:42px!important;margin:0!important;border-radius:11px!important;font-size:12px!important;font-weight:850!important}
    .pmV92PhoneCancel{width:100%!important;margin-top:8px!important;min-height:38px!important;border-radius:10px!important}
  `;
  document.head.appendChild(style);

  const record=(k,id)=>(data[k]||[]).find(x=>String(x.id)===String(id))||null;
  const digits=s=>String(s||'').replace(/\D/g,'');
  function validPhone(s){const n=digits(s).length;return n>=9&&n<=15;}
  function callHref(raw){
    let s=String(raw||'').trim();
    const plus=/^\s*\+/.test(s);
    s=digits(s);
    return 'tel:'+(plus?'+':'')+s;
  }
  function waDigits(raw){
    if(typeof window.pmWhatsAppDigits==='function')return window.pmWhatsAppDigits(raw);
    let d=digits(raw);if(d.startsWith('00'))d=d.slice(2);if(d.startsWith('0'))d='972'+d.slice(1);return d;
  }
  function stampNow(){return typeof stamp==='function'?stamp():new Date().toLocaleString();}

  function currentRecord(){return active?record(active.k,active.id):null;}

  function logAction(x,channel,phone){
    if(!x)return;
    x.activities=x.activities||[];
    x.activities.push({
      id:Date.now(),
      type:'action',
      action:'Profile phone • '+channel,
      text:`${channel} opened for phone number ${phone}.`,
      ts:stampNow(),
      recipientPhone:String(phone||''),
      recipientSide:'Profile phone'
    });
    try{const p=save();if(p?.catch)p.catch(e=>console.warn('PeerMatch v92 history save',e));}
    catch(e){console.warn('PeerMatch v92 history save',e);}
  }

  function closePicker(){document.getElementById('pmV92PhonePicker')?.remove();}

  function openPicker(raw){
    const x=currentRecord();if(!x||!validPhone(raw))return;
    closePicker();
    const shade=document.createElement('div');shade.id='pmV92PhonePicker';shade.className='pmV92PhoneShade';
    const box=document.createElement('div');box.className='pmV92PhoneSheet';
    const title=document.createElement('div');title.className='pmV92PhoneTitle';title.textContent='Open phone number';
    const num=document.createElement('div');num.className='pmV92PhoneNumber';num.textContent=String(raw).trim();
    const actions=document.createElement('div');actions.className='pmV92PhoneActions';
    const call=document.createElement('button');call.type='button';call.className='secondary';call.textContent='Call';
    const wa=document.createElement('button');wa.type='button';wa.className='secondary';wa.textContent='WhatsApp';
    const cancel=document.createElement('button');cancel.type='button';cancel.className='secondary pmV92PhoneCancel';cancel.textContent='Cancel';
    actions.append(call,wa);box.append(title,num,actions,cancel);shade.appendChild(box);document.body.appendChild(shade);

    call.onclick=()=>{
      logAction(x,'Call',raw);
      closePicker();
      location.href=callHref(raw);
    };
    wa.onclick=()=>{
      const d=waDigits(raw);if(!d)return;
      logAction(x,'WhatsApp',raw);
      closePicker();
      location.href='https://wa.me/'+encodeURIComponent(d);
    };
    cancel.onclick=closePicker;
    shade.onclick=e=>{if(e.target===shade)closePicker();};
  }

  const PHONE_RE=/(?:\+?\d[\d\s().-]{7,}\d)/g;
  function linkify(root){
    if(!root||root.dataset.pmV92Phones==='1')return;
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode(node){
      const p=node.parentElement;if(!p||!node.nodeValue||!PHONE_RE.test(node.nodeValue)){PHONE_RE.lastIndex=0;return NodeFilter.FILTER_REJECT;}
      PHONE_RE.lastIndex=0;
      if(p.closest('button,a,input,textarea,select,script,style,.pmV92InlinePhone'))return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }});
    const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
    for(const node of nodes){
      const text=node.nodeValue;PHONE_RE.lastIndex=0;let m,last=0,changed=false;const frag=document.createDocumentFragment();
      while((m=PHONE_RE.exec(text))){
        const raw=m[0];if(!validPhone(raw))continue;
        changed=true;
        if(m.index>last)frag.appendChild(document.createTextNode(text.slice(last,m.index)));
        const b=document.createElement('button');b.type='button';b.className='pmV92InlinePhone';b.textContent=raw;b.dataset.phone=raw;
        b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();openPicker(raw);});
        frag.appendChild(b);last=m.index+raw.length;
      }
      if(changed){if(last<text.length)frag.appendChild(document.createTextNode(text.slice(last)));node.replaceWith(frag);}
    }
    root.dataset.pmV92Phones='1';
  }

  function decorate(){
    const sheet=document.getElementById('sheet');if(!sheet||!active)return;
    if(document.getElementById('v19Profile')||document.getElementById('v19SName')||document.getElementById('esName')||document.getElementById('sn'))return;
    if(active.k==='guys'||active.k==='girls'){
      sheet.querySelectorAll('.profileText').forEach(linkify);
    }else if(active.k==='shadchanim'){
      sheet.querySelectorAll('.pmV63ProfileCard,.profileText').forEach(linkify);
    }
  }

  const oldP=window.openP;
  if(typeof oldP==='function')window.openP=function(k,id){active={k,id};const r=oldP(k,id);setTimeout(decorate,80);return r;};
  const oldS=window.openS;
  if(typeof oldS==='function')window.openS=function(id){active={k:'shadchanim',id};const r=oldS(id);setTimeout(decorate,80);return r;};

  function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;decorate();});}
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
  schedule();
})();
