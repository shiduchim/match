/* PeerMatch image optimizer.
   Normal screenshots/photos pass through immediately.
   Only unusually large files are resized before older preview handlers see them.
*/
(function(){
  const IDS=new Set(['pp','pep','ppi','pei']);
  const LARGE_FILE=3.5*1024*1024;
  const MAX_DIM=1400;
  const QUALITY=.84;
  let busy=false;

  function showPreparing(input){
    const tile=document.getElementById('pmUnifiedMediaTile');
    if(tile)tile.innerHTML='<div style="font-size:9px;line-height:1.2;color:#617482;font-weight:750">Optimizing<br>large image…</div>';
    input.disabled=true;
  }
  function restoreTile(){
    const tile=document.getElementById('pmUnifiedMediaTile');
    if(tile&&!tile.querySelector('img'))tile.innerHTML='<div style="font-size:10px;line-height:1.25;color:#536b7a;font-weight:800">Photo /<br>screenshot</div>';
  }
  function donePreparing(input){input.disabled=false;}

  async function bitmapFor(file){
    if('createImageBitmap' in window){
      try{return await createImageBitmap(file,{imageOrientation:'from-image'});}catch(e){return await createImageBitmap(file);}
    }
    const src=URL.createObjectURL(file);
    try{
      const img=new Image();img.decoding='async';img.src=src;
      if(img.decode)await img.decode();else await new Promise((ok,no)=>{img.onload=ok;img.onerror=no;});
      return img;
    }finally{URL.revokeObjectURL(src);}
  }

  async function optimize(file){
    const bmp=await bitmapFor(file);
    let w=bmp.width||bmp.naturalWidth,h=bmp.height||bmp.naturalHeight;
    if(!w||!h)throw new Error('Could not read image');
    const scale=Math.min(1,MAX_DIM/Math.max(w,h));
    w=Math.max(1,Math.round(w*scale));h=Math.max(1,Math.round(h*scale));
    const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
    const ctx=canvas.getContext('2d',{alpha:false});ctx.drawImage(bmp,0,0,w,h);
    try{bmp.close?.();}catch(e){}
    const blob=await new Promise((ok,no)=>canvas.toBlob(b=>b?ok(b):no(new Error('Could not resize image')),'image/jpeg',QUALITY));
    canvas.width=canvas.height=1;
    return new File([blob],String(file.name||'profile-image').replace(/\.[^.]+$/,'')+'.jpg',{type:'image/jpeg',lastModified:Date.now()});
  }

  function putFile(input,file){const dt=new DataTransfer();dt.items.add(file);input.files=dt.files;}

  document.addEventListener('change',async function(e){
    const input=e.target;
    if(!(input instanceof HTMLInputElement)||input.type!=='file'||!IDS.has(input.id))return;
    if(input.dataset.pmOptimizedReady==='1'){delete input.dataset.pmOptimizedReady;return;}
    const file=input.files?.[0];
    if(!file||!String(file.type||'').startsWith('image/'))return;

    // Most screenshots and ordinary photos are small enough to preview immediately.
    if(file.size<=LARGE_FILE)return;

    // Large camera images are the ones that previously froze the phone UI.
    e.stopImmediatePropagation();
    if(busy)return;
    busy=true;showPreparing(input);
    try{
      const smaller=await optimize(file);
      putFile(input,smaller);
      input.dataset.pmOptimizedReady='1';
      input.dispatchEvent(new Event('change',{bubbles:true}));
    }catch(err){
      console.warn('PeerMatch image optimization failed',err);
      input.value='';restoreTile();
      alert('That image is unusually large and could not be prepared. Try a screenshot or a smaller photo.');
    }finally{donePreparing(input);busy=false;}
  },true);
})();