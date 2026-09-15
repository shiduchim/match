/* PeerMatch v47: app feature request email link shown below the main Backup control. */
(function(){
  document.documentElement.dataset.peerMatchVersion='47';
  const EMAIL='6137770@gmail.com';
  const SUBJECT='PeerMatch app feature request';
  const BODY='Hi,\n\nI would like to request a new app feature, improvement, or functionality for PeerMatch:\n\n\n\nHow I would use it:\n\n';

  const style=document.createElement('style');
  style.textContent=`
    .pmFeatureRequestMain{display:block;width:max-content;max-width:calc(100% - 22px);margin:5px 0 3px 11px;color:var(--accent);font-size:12px;font-weight:800;text-decoration:underline;text-underline-offset:2px;cursor:pointer;line-height:1.25}
    @media(max-width:390px){.pmFeatureRequestMain{margin-left:7px;font-size:11px}}
  `;
  document.head.appendChild(style);

  function addLink(){
    if(document.getElementById('pmFeatureRequestMain'))return;
    const header=document.querySelector('.app>header');
    const backup=header?.querySelector('.pmBackupTop');
    if(!header||!backup)return;
    const a=document.createElement('a');
    a.id='pmFeatureRequestMain';
    a.className='pmFeatureRequestMain';
    a.textContent='Request an app feature';
    a.href='mailto:'+EMAIL+'?subject='+encodeURIComponent(SUBJECT)+'&body='+encodeURIComponent(BODY);
    header.insertAdjacentElement('afterend',a);
  }

  new MutationObserver(addLink).observe(document.body,{childList:true,subtree:true});
  addLink();
})();
