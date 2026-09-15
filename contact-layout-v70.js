/* PeerMatch v70: simple vertical contact-person layout. */
(function(){
  document.documentElement.dataset.peerMatchVersion='70';

  const style=document.createElement('style');
  style.textContent=`
    /* Profile detail: Contact 1 = name, phone; gap; Contact 2 = name, phone. */
    #sheet .pmV67ContactPeople{
      display:block!important;
      margin:7px 0 12px!important;
    }
    #sheet .pmV67ContactLine{
      display:block!important;
      grid-template-columns:none!important;
      padding:7px 9px!important;
      border:0!important;
      border-radius:0!important;
      background:transparent!important;
      font-size:12px!important;
      min-width:0!important;
    }
    #sheet .pmV67ContactLine + .pmV67ContactLine{
      margin-top:12px!important;
      padding-top:7px!important;
    }
    #sheet .pmV67ContactName{
      display:block!important;
      width:100%!important;
      font-weight:800!important;
      line-height:1.3!important;
      overflow-wrap:anywhere!important;
    }
    #sheet .pmV67ContactPhone,
    #sheet a.pmV67ContactPhone{
      display:block!important;
      width:max-content!important;
      max-width:100%!important;
      margin-top:3px!important;
      color:#315b78!important;
      font-weight:750!important;
      line-height:1.35!important;
      white-space:normal!important;
      text-decoration:none!important;
    }

    /* Add/Edit profile: first contact and second contact are fully vertical too. */
    #sheet .v19Source.v39SenderGrid{
      display:block!important;
      grid-template-columns:none!important;
    }
    #sheet .v19Source.v39SenderGrid > label{
      display:block!important;
      width:100%!important;
      margin:6px 0 8px!important;
    }
    #sheet .pmV67ContactFormRow{
      display:block!important;
      grid-template-columns:none!important;
      margin:14px 0 2px!important;
    }
    #sheet .pmV67ContactFormRow label{
      display:block!important;
      width:100%!important;
      margin:6px 0 8px!important;
    }
    #sheet .pmV67ContactFormRow input,
    #sheet .v19Source.v39SenderGrid input{
      width:100%!important;
    }
  `;
  document.head.appendChild(style);
})();
