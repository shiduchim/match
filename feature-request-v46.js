/* PeerMatch v46: email link for new feature/functionality requests from the Backup screen. */
(function(){
  const EMAIL='6137770@gmail.com';
  const SUBJECT='PeerMatch feature request';
  const BODY='Hi,\n\nI would like to request a new feature, improvement, or functionality for PeerMatch:\n\n\n\nHow I would use it:\n\n';

  const style=document.createElement('style');
  style.textContent=`
    .pmFeatureRequest{display:block;text-align:center;margin:12px 0 5px;color:var(--accent);font-size:13px;font-weight:800;text-decoration:underline;text-underline-offset:2px;cursor:pointer}
  `;
  document.head.appendChild(style);

  function addLink(){
    const heading=document.querySelector('#sheet h2');
    if(!heading||heading.textContent.trim()!=='Backup')return;
    if(document.getElementById('pmFeatureRequest'))return;
    const card=document.querySelector('#sheet .pmBackupCard');
    if(!card)return;
    const a=document.createElement('a');
    a.id='pmFeatureRequest';
    a.className='pmFeatureRequest';
    a.textContent='Request a feature';
    a.href='mailto:'+EMAIL+'?subject='+encodeURIComponent(SUBJECT)+'&body='+encodeURIComponent(BODY);
    card.insertAdjacentElement('afterend',a);
  }

  new MutationObserver(addLink).observe(document.body,{childList:true,subtree:true});
  addLink();
})();
