/* PeerMatch image optimizer.
   Intercepts profile photo/screenshot file selections before older preview handlers run.
   Large phone images are resized asynchronously, then the optimized copy is handed back
   to the existing UI. This keeps the compact thumbnail while avoiding full-size decode freezes.
*/
(function(){
  const IDS=new Set(['pp','pep','ppi','pei']);
  const MAX_DIM=2000;
  const QUALITY=.92;
  let busy=false;

  function showPreparing(input){
    const tile=document.getElementById('pmUnifiedMediaTile');
    if(tile)tile.innerHTML='<div style="font-size:9px;line-height:1.2;color:#617482;font-weight:750">Preparing<br>image…</div>';
    input.disabled=true;
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
    const blob=await new Promise((ok,no)=>canvas.toBlob(b=>b?ok(b):no(new Error('Could not resize image')),'image/webp',QUALITY));
    canvas.width=canvas.height=1;
    return new File([blob],String(file.name||'profile-image').replace(/\.[^.]+$/,'')+'.webp',{type:'image/webp',lastModified:Date.now()});
  }

  function putFile(input,file){
    const dt=new DataTransfer();dt.items.add(file);input.files=dt.files;
  }

  document.addEventListener('change',async function(e){
    const input=e.target;
    if(!(input instanceof HTMLInputElement)||input.type!=='file'||!IDS.has(input.id))return;
    if(input.dataset.pmOptimizedReady==='1'){
      delete input.dataset.pmOptimizedReady;
      return;
    }
    const file=input.files?.[0];
    if(!file||!String(file.type||'').startsWith('image/'))return;

    // Stop older preview listeners from decoding the original full-size file.
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
      try{
        putFile(input,file);
        input.dataset.pmOptimizedReady='1';
        input.dispatchEvent(new Event('change',{bubbles:true}));
      }catch(e2){alert('PeerMatch could not prepare that image. Try a smaller screenshot or photo.');}
    }finally{donePreparing(input);busy=false;}
  },true);
})();