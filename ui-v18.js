/* PeerMatch v18 UI polish and v19 self-upgrade hook. */
(function(){
  if(!document.documentElement.dataset.peerMatchVersion)document.documentElement.dataset.peerMatchVersion='18';
  const style=document.createElement('style');
  style.textContent=`
    .pmSourceGrid{display:grid!important;grid-template-columns:minmax(0,1.15fr) minmax(125px,.85fr)!important;gap:8px!important;align-items:end}
    .pmSourceGrid label{min-width:0!important;margin:8px 0!important}
    .pmSourceGrid input{min-width:0!important;width:100%!important}
    @media(max-width:430px){.pmSourceGrid{grid-template-columns:minmax(0,1.1fr) minmax(115px,.9fr)!important;gap:7px!important}}
  `;
  document.head.appendChild(style);

  window.addEventListener('load',()=>{
    setTimeout(()=>{
      if(document.documentElement.dataset.peerMatchVersion==='19'||document.querySelector('script[data-pmv19]'))return;
      const s=document.createElement('script');s.src='./peermatch-v19.js?v=19';s.dataset.pmv19='1';document.body.appendChild(s);
    },60);
  },{once:true});
})();
