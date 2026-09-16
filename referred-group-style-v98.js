/* PeerMatch v98: make the referred-shadchanim group row clearly visible. */
(function(){
  document.documentElement.dataset.peerMatchVersion='98';
  const style=document.createElement('style');
  style.textContent=`
    #shadchanList .pmV65RefToggle{
      display:flex!important;
      align-items:center!important;
      gap:8px!important;
      margin:6px 5px 8px 26px!important;
      padding:9px 12px!important;
      border:0!important;
      border-radius:10px!important;
      background:var(--accent)!important;
      color:#fff!important;
      font-size:11px!important;
      font-weight:900!important;
      line-height:1.2!important;
      cursor:pointer!important;
      box-shadow:0 1px 3px rgba(25,50,74,.18)!important;
    }
    #shadchanList .pmV65RefToggle .arrow{
      color:#fff!important;
      font-size:15px!important;
      font-weight:900!important;
      line-height:1!important;
    }
    @media(max-width:430px){
      #shadchanList .pmV65RefToggle{margin-left:18px!important;margin-right:3px!important}
    }
  `;
  document.head.appendChild(style);
})();
