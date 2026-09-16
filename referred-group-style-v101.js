/* PeerMatch v101: shorten the referred-shadchanim header on the right while keeping the left edge attached/aligned. */
(function(){
  document.documentElement.dataset.peerMatchVersion='101';
  const style=document.createElement('style');
  style.textContent=`
    #shadchanList .pmV65RefToggle{
      width:80%!important;
      box-sizing:border-box!important;
      margin-right:auto!important;
    }
    @media(max-width:430px){
      #shadchanList .pmV65RefToggle{
        width:80%!important;
        margin-right:auto!important;
      }
    }
  `;
  document.head.appendChild(style);
})();
