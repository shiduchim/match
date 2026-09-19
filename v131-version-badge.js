/* PeerMatch v131: show the running runtime version in the header.

   Until now nothing in the UI said which version was loaded, so "I don't see the new
   version" could not be told apart from "the new version is loaded but the feature is
   broken". The version comes from the ?v= query the live runtime already appends to every
   script src (added by sw.js -> withEnhancer and by the Pages build), so this file has no
   version constant of its own to keep in sync. */
(function(){
  function readVersion(){
    try{
      const own=document.currentScript&&document.currentScript.src;
      const fromOwn=own&&new URL(own,location.href).searchParams.get('v');
      if(fromOwn)return fromOwn;
    }catch(e){}
    for(const s of document.querySelectorAll('script[src]')){
      try{
        const v=new URL(s.src,location.href).searchParams.get('v');
        if(v)return v;
      }catch(e){}
    }
    return '';
  }

  const version=readVersion();
  if(!version)return;

  const style=document.createElement('style');
  style.textContent=`
    .pmV131Version{
      display:inline-block;
      margin-left:7px;
      padding:1px 6px;
      border-radius:7px;
      background:var(--soft);
      color:var(--accent);
      font-size:11px;
      font-weight:850;
      letter-spacing:.2px;
      vertical-align:middle;
    }
  `;
  document.head.appendChild(style);

  function mount(){
    const sub=document.querySelector('header .sub');
    if(!sub||sub.querySelector('.pmV131Version'))return;
    const tag=document.createElement('span');
    tag.className='pmV131Version';
    tag.textContent='v'+version;
    sub.appendChild(tag);
  }

  mount();
  if(!document.querySelector('.pmV131Version'))document.addEventListener('DOMContentLoaded',mount);
})();
