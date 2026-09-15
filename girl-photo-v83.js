/* PeerMatch v83: vertically center the Girl profile Photo button with the header text. */
(function(){
  document.documentElement.dataset.peerMatchVersion='83';
  const style=document.createElement('style');
  style.textContent=`
    #sheet .v19Head .pmV65GirlPhoto{
      margin-top:8px!important;
      align-self:flex-start!important;
    }
  `;
  document.head.appendChild(style);
})();
