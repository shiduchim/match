/* PeerMatch unified photo/screenshot UI.
   One tappable square in the top-right for either a person photo or profile screenshot.
   Existing photo/profileImage records remain compatible. Tapping a saved image opens full-screen.
*/
(function(){
  let currentProfile=null;

  const style=document.createElement('style');
  style.textContent=`
    .pmMediaHeader{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:8px}
    .pmMediaHeader h2{margin:0;flex:1;min-width:0}
    .pmMediaTile{width:96px;height:96px;flex:0 0 96px;border:1.5px dashed #b7c5cf;border-radius:16px;background:#f7fafc;display:flex;align-items:center;justify-content:center;overflow:hidden;cursor:pointer;position:relative;color:#536b7a;text-align:center;font-size:11px;font-weight:800;line-height:1.2;padding:6px}
    .pmMediaTile:hover{background:#eef4f7}
    .pmMediaTile img{width:100%;height:100%;object-fit:cover;display:block}
    .pmMediaPlus{font-size:29px;line-height:1;margin-bottom:3px;font-weight:500}
    .pmMediaRemove{position:absolute;top:4px;right:4px;width:25px;height:25px;border-radius:50%;padding:0;background:rgba(25,50,74,.82);color:#fff;font-size:16px;line-height:25px;z-index:2}
    .pmMediaTapHint{font-size:11px;color:var(--muted);margin:-2px 0 8px;text-align:right}
    .pmHiddenMediaInput{display:none!important}
    .pmFullImage{position:fixed;inset:0;z-index:500;background:rgba(0,0,0,.94);display:flex;align-items:center;justify-content:center;padding:58px 10px 18px}
    .pmFullImage img{max-width:100%;max-height:100%;object-fit:contain}
    .pmFullClose{position:fixed;top:max(12px,env(safe-area-inset-top));right:12px;z-index:501;background:#fff;color:#19324a;border-radius:12px;padding:10px 16px;box-shadow:0 2px 12px rgba(0,0,0,.25)}
    @media(max-width:430px){.pmMediaTile{width:88px;height:88px;flex-basis:88px}.pmMediaHeader{gap:10px}}
  `;
  document.head.appendChild(style);

  function mediaOf(x){return x?.profileMedia||x?.profileImage||x?.photo||null;}
  function makeHeader(sheet,tile){
    const h2=sheet?.querySelector('h2');if(!sheet||!h2||h2.parentElement?.classList.contains('pmMediaHeader'))return;
    const row=document.createElement('div');row.className='pmMediaHeader';h2.parentNode.insertBefore(row,h2);row.appendChild(h2);row.appendChild(tile);
  }
  function emptyTile(tile){
    tile.innerHTML='<div><div class="pmMediaPlus">＋</div><div>Photo /<br>screenshot</div></div>';
  }
  function showTileImage(tile,src,removable,onRemove){
    tile.innerHTML=`<img src="${src}" alt="Photo or screenshot">${removable?'<button type="button" class="pmMediaRemove" aria-label="Remove image">×</button>':''}`;
    if(removable){const b=tile.querySelector('.pmMediaRemove');b.onclick=e=>{e.stopPropagation();onRemove?.();};}
  }
  function openFullscreen(blob){
    if(!blob)return;
    document.getElementById('pmFullImage')?.remove();
    const src=url(blob),ov=document.createElement('div');ov.id='pmFullImage';ov.className='pmFullImage';
    ov.innerHTML=`<button class="pmFullClose" type="button">Close</button><img src="${src}" alt="Full-screen profile image">`;
    document.body.appendChild(ov);
    const closeFull=()=>{ov.remove();try{URL.revokeObjectURL(src)}catch(e){}};
    ov.querySelector('.pmFullClose').onclick=closeFull;
    ov.onclick=e=>{if(e.target===ov)closeFull();};
    const key=e=>{if(e.key==='Escape'){document.removeEventListener('keydown',key);closeFull();}};document.addEventListener('keydown',key,{once:true});
  }

  function decorateAdd(){
    const sheet=document.getElementById('sheet'),photoInput=document.getElementById('pp');
    if(!sheet||!photoInput||document.getElementById('pmUnifiedMediaTile'))return;
    const screenInput=document.getElementById('ppi'),screenPreview=document.getElementById('ppiPreview');
    photoInput.closest('label')?.classList.add('pmHiddenMediaInput');
    screenInput?.closest('label')?.classList.add('pmHiddenMediaInput');
    if(screenPreview)screenPreview.classList.add('hidden');

    const tile=document.createElement('div');tile.id='pmUnifiedMediaTile';tile.className='pmMediaTile';tile.setAttribute('role','button');tile.setAttribute('tabindex','0');
    let previewUrl='';
    const refresh=()=>{
      if(previewUrl){try{URL.revokeObjectURL(previewUrl)}catch(e){}previewUrl='';}
      const f=photoInput.files?.[0];
      if(f){previewUrl=URL.createObjectURL(f);showTileImage(tile,previewUrl,true,()=>{photoInput.value='';refresh();});return;}
      if(screenPreview?.src&&!screenPreview.classList.contains('hidden')){showTileImage(tile,screenPreview.src,false);return;}
      emptyTile(tile);
    };
    tile.onclick=e=>{if(!e.target.closest('.pmMediaRemove'))photoInput.click();};
    tile.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();photoInput.click();}};
    photoInput.addEventListener('change',refresh);makeHeader(sheet,tile);refresh();
  }

  function decorateEdit(){
    const sheet=document.getElementById('sheet'),photoInput=document.getElementById('pep');
    if(!sheet||!photoInput||document.getElementById('pmUnifiedMediaTile'))return;
    const screenInput=document.getElementById('pei');
    photoInput.closest('label')?.classList.add('pmHiddenMediaInput');
    screenInput?.closest('label')?.classList.add('pmHiddenMediaInput');
    sheet.querySelectorAll('.pmImagePreview').forEach(x=>x.classList.add('hidden'));
    document.getElementById('perShot')?.closest('label')?.classList.add('pmHiddenMediaInput');
    document.getElementById('perPhoto')?.closest('label')?.classList.add('pmHiddenMediaInput');

    const x=currentProfile?data[currentProfile.k]?.find(z=>z.id===currentProfile.id):null;
    const existing=mediaOf(x);
    const tile=document.createElement('div');tile.id='pmUnifiedMediaTile';tile.className='pmMediaTile';tile.setAttribute('role','button');tile.setAttribute('tabindex','0');
    let previewUrl='',removed=false;
    const refresh=()=>{
      if(previewUrl){try{URL.revokeObjectURL(previewUrl)}catch(e){}previewUrl='';}
      const f=photoInput.files?.[0];
      if(f){previewUrl=URL.createObjectURL(f);showTileImage(tile,previewUrl,true,removeCurrent);return;}
      if(existing&&!removed){previewUrl=URL.createObjectURL(existing);showTileImage(tile,previewUrl,true,removeCurrent);return;}
      emptyTile(tile);
    };
    function removeCurrent(){
      photoInput.value='';removed=true;
      const rs=document.getElementById('perShot'),rp=document.getElementById('perPhoto');if(rs)rs.checked=true;if(rp)rp.checked=true;
      refresh();
    }
    tile.onclick=e=>{if(!e.target.closest('.pmMediaRemove'))photoInput.click();};
    tile.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();photoInput.click();}};
    photoInput.addEventListener('change',()=>{removed=false;refresh();});
    makeHeader(sheet,tile);refresh();

    const saveBtn=document.getElementById('pmFormSave');
    if(saveBtn&&x)saveBtn.addEventListener('click',()=>{
      if(photoInput.files?.[0]){x.profileImage=null;x.profileMedia=null;}
      if(removed){x.profileImage=null;x.profileMedia=null;x.photo=null;}
    },true);
  }

  function decorateDetail(){
    const sheet=document.getElementById('sheet');if(!sheet||!currentProfile||document.getElementById('pmUnifiedMediaTile'))return;
    const x=data[currentProfile.k]?.find(z=>z.id===currentProfile.id),media=mediaOf(x);if(!x)return;
    sheet.querySelectorAll('img').forEach(img=>{if(!img.closest('.event'))img.style.display='none';});
    [...sheet.querySelectorAll('.sectionTitle')].forEach(el=>{if(/profile screenshot|profile image/i.test(el.textContent||''))el.style.display='none';});
    const tile=document.createElement('div');tile.id='pmUnifiedMediaTile';tile.className='pmMediaTile';
    if(media){const src=url(media);showTileImage(tile,src,false);tile.onclick=()=>openFullscreen(media);tile.title='Tap to view full screen';}
    else emptyTile(tile);
    makeHeader(sheet,tile);
    if(media){const hint=document.createElement('div');hint.className='pmMediaTapHint';hint.textContent='Tap image for full screen';const header=tile.parentElement;header.insertAdjacentElement('afterend',hint);}
  }

  const baseAddP=window.addP||addP;
  window.addP=addP=function(k,shared){baseAddP(k,shared);setTimeout(decorateAdd,0);};

  const baseOpenP=window.openP||openP;
  window.openP=openP=function(k,id){currentProfile={k,id};baseOpenP(k,id);setTimeout(decorateDetail,0);};

  function scan(){
    if(document.getElementById('pnm')&&document.getElementById('pp'))decorateAdd();
    if(document.getElementById('pen')&&document.getElementById('pep'))decorateEdit();
  }
  new MutationObserver(scan).observe(document.body,{childList:true,subtree:true});
  setInterval(scan,500);
})();
