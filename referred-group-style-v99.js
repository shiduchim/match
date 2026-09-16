/* PeerMatch v99: referred-shadchanim header touches its referring Shadchan card and uses a soft contrast. */
(function(){
  document.documentElement.dataset.peerMatchVersion='99';
  const style=document.createElement('style');
  style.textContent=`
    #shadchanList .pmV65RefToggle{
      display:flex!important;
      align-items:center!important;
      gap:8px!important;
      /* The Shadchan cards have a 10px bottom margin. Cancel it so this
         group header sits directly against the referring Shadchan card. */
      margin:-10px 5px 8px 26px!important;
      padding:8px 11px!important;
      border:1px solid #d4e1e9!important;
      border-top:0!important;
      border-radius:0 0 10px 10px!important;
      background:#edf4f8!important;
      color:#315b78!important;
      font-size:11px!important;
      font-weight:900!important;
      line-height:1.2!important;
      cursor:pointer!important;
      box-shadow:none!important;
    }
    #shadchanList .pmV65RefToggle .arrow{
      color:#315b78!important;
      font-size:15px!important;
      font-weight:900!important;
      line-height:1!important;
    }
    @media(max-width:430px){
      #shadchanList .pmV65RefToggle{
        margin-left:18px!important;
        margin-right:3px!important;
        margin-top:-10px!important;
      }
    }
  `;
  document.head.appendChild(style);
})();
