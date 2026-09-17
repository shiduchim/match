/* PeerMatch v124: safer backup destinations + PDF-first profile sharing.
   Backup:
   - Existing ZIP backup remains the source of truth.
   - Backup screen offers Save to phone/computer and Email backup.
   - Email backup prepares the ZIP first, then requires a fresh second tap to open the
     device share sheet so the browser still has user activation for file sharing.

   Profile sharing:
   - If a Guy/Girl has a saved PDF attachment, the PDF is the preferred outgoing profile.
   - The OCR/autofilled profile text is NOT sent in place of that PDF.
   - If the PDF is later removed, all existing text-sharing behavior remains unchanged.
*/
(function(){
  document.documentElement.dataset.peerMatchVersion='124';
  let scheduled=false,preparedBackup=null,preparingBackup=false;

  const trim=v=>String(v||'').trim();
  const clean=v=>trim(v).replace(/\*/g,'');

  function selected(k){
    try{return typeof window.pmGetSelected==='function'?(window.pmGetSelected(k)||[]):[];}
    catch(e){return[];}
  }

  function attachmentType(x){
    const name=trim(x?.profileAttachmentName).toLowerCase();
    const type=trim(x?.profileAttachmentType||x?.profileAttachment?.type).toLowerCase();
    if(type.includes('pdf')||name.endsWith('.pdf'))return'application/pdf';
    return type;
  }
  function hasPdf(x){return x?.profileAttachment instanceof Blob&&attachmentType(x)==='application/pdf';}
  function pdfFile(x){
    if(!hasPdf(x))return null;
    const blob=x.profileAttachment;
    let name=trim(x.profileAttachmentName)||((clean(x.name)||'profile')+'.pdf');
    if(!/\.pdf$/i.test(name))name+='.pdf';
    try{return blob instanceof File&&/\.pdf$/i.test(blob.name||'')?blob:new File([blob],name,{type:'application/pdf'});}
    catch(e){return null;}
  }
  function filteredText(x){return typeof window.pmShareFilteredText==='function'?window.pmShareFilteredText(x):String(x?.text||'');}
  function regularText(x){
    const sn=trim(x?.sourceName||x?.source),sp=trim(x?.sourcePhone);
    return [x?.name||'Unnamed profile',x?.age?'Age: '+x.age:'',filteredText(x),sn?'Sent by: '+sn:'',sp?'Sender phone: '+sp:''].filter(Boolean).join('\n');
  }
  function pdfCaption(x){return [clean(x?.name)||'Shidduch profile',x?.age?'Age: '+x.age:''].filter(Boolean).join('\n');}

  function downloadFile(file){
    const u=URL.createObjectURL(file),a=document.createElement('a');
    a.href=u;a.download=file.name||'profile.pdf';a.style.display='none';document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(u),60000);
  }

  async function logPdfShare(k,x,channel,shad){
    if(!x)return;
    const ts=typeof stamp==='function'?stamp():new Date().toLocaleString();
    const link='v124-pdf-'+x.id+'-'+(shad?.id??'picker')+'-'+Date.now();
    x.activities=x.activities||[];
    x.activities.push({
      id:Date.now()*1000+Math.floor(Math.random()*900+100),type:'action',action:'Profile PDF shared • '+channel,
      text:'Shared attached PDF: '+(trim(x.profileAttachmentName)||'profile.pdf'),ts,channel:String(channel||'').toLowerCase(),
      recipient:trim(shad?.name)||'Share sheet recipient',recipientPhone:trim(shad?.phone),recipientShadchanId:shad?.id??null,
      shadchanId:shad?.id??null,sharedProfileId:x.id,sharedProfileName:trim(x.name)||'Unnamed profile',sharedProfileKind:k,
      shareLinkId:link
    });
    if(shad){
      shad.activities=shad.activities||[];
      shad.activities.push({
        id:Date.now()*1000+Math.floor(Math.random()*900+100),type:'action',action:'Profile PDF received • '+channel,
        text:'Shared attached PDF: '+(trim(x.profileAttachmentName)||'profile.pdf'),ts,channel:String(channel||'').toLowerCase(),
        sharedProfileId:x.id,sharedProfileName:trim(x.name)||'Unnamed profile',sharedProfileKind:k,profileId:x.id,profileName:trim(x.name)||'Unnamed profile',
        shareLinkId:link
      });
    }
    try{await save();}catch(e){console.warn('PeerMatch v124 PDF share history',e);}
  }

  async function shareOnePdf(k,x,channel,shad){
    const file=pdfFile(x);if(!file)return false;
    const can=typeof navigator.share==='function'&&(!navigator.canShare||navigator.canShare({files:[file]}));
    if(can){
      try{
        await navigator.share({title:clean(x.name)||'Shidduch profile',text:pdfCaption(x),files:[file]});
        await logPdfShare(k,x,channel,shad||null);
        return true;
      }catch(e){if(e?.name==='AbortError')return false;console.warn('PeerMatch v124 PDF share',e);}
    }
    downloadFile(file);
    alert('PeerMatch downloaded the PDF because this browser could not attach it automatically. Attach the downloaded PDF in the app you want to send it with.');
    return true;
  }

  async function sharePdfSelection(k,channel){
    const items=selected(k);if(!items.length||!items.some(hasPdf))return false;
    const shads=selected('shadchanim');

    if(items.length===1&&hasPdf(items[0])&&shads.length>1){
      for(let i=0;i<shads.length;i++){
        const sh=shads[i];
        const ok=confirm('Send '+(clean(items[0].name)||'this profile')+' PDF to '+(clean(sh.name)||'Shadchan')+'?\n\n'+(i+1)+' of '+shads.length+'\n\nChoose '+(channel==='Email'?'your email app':'WhatsApp')+' and then '+(clean(sh.name)||'that Shadchan')+' in the share screen.');
        if(!ok)continue;
        const sent=await shareOnePdf(k,items[0],channel,sh);if(!sent)break;
      }
      return true;
    }

    const shad=shads.length===1?shads[0]:null;
    if(items.length===1&&hasPdf(items[0])&&shad){
      const ok=confirm('Send '+(clean(items[0].name)||'this profile')+' PDF to '+(clean(shad.name)||'Shadchan')+'?\n\nChoose '+(channel==='Email'?'your email app':'WhatsApp')+' and then '+(clean(shad.name)||'that Shadchan')+' in the share screen.');
      if(!ok)return true;
    }
    for(let i=0;i<items.length;i++){
      const x=items[i];
      if(items.length>1&&!confirm('Share '+(clean(x.name)||'profile')+' ('+(i+1)+' of '+items.length+')?'))continue;
      if(hasPdf(x)){
        const sent=await shareOnePdf(k,x,channel,shad);if(!sent)break;
      }else{
        const text=regularText(x);
        if(typeof navigator.share==='function'){
          try{await navigator.share({title:clean(x.name)||'Shidduch profile',text});}
          catch(e){if(e?.name==='AbortError')break;console.warn('PeerMatch v124 mixed text share',e);location.href='https://wa.me/?text='+encodeURIComponent(text);}
        }else location.href='https://wa.me/?text='+encodeURIComponent(text);
      }
    }
    return true;
  }

  function bindWhatsApp(k){
    const b=document.getElementById('pmWhatsApp-'+k);
    if(!b||b.dataset.pmV124Pdf==='1'||b.dataset.pmV120Bound!=='1')return;
    const prior=b.onclick;b.dataset.pmV124Pdf='1';
    b.onclick=async function(e){
      const items=selected(k);
      if(items.some(hasPdf)){e?.preventDefault?.();e?.stopPropagation?.();await sharePdfSelection(k,'WhatsApp');return;}
      if(typeof prior==='function')return prior.call(b,e);
    };
  }

  function bindPdfEmail(k){
    const b=document.getElementById('pmEmail-'+k);if(!b||b.dataset.pmV124PdfEmail==='1')return;
    b.dataset.pmV124PdfEmail='1';
    b.addEventListener('pointerdown',()=>{
      const items=selected(k);if(!items.some(hasPdf))return;
      const oldId=b.id,oldClick=b.onclick;
      b.id='pmV124Email-'+k;
      b.onclick=e=>{e.preventDefault();e.stopPropagation();};
      sharePdfSelection(k,'Email');
      setTimeout(()=>{if(document.body.contains(b)){b.id=oldId;b.onclick=oldClick;}},1200);
    },true);
  }

  function captureBackupDownload(run){
    return new Promise(async(resolve,reject)=>{
      const proto=HTMLAnchorElement.prototype,oldClick=proto.click;
      let captured=null,capturedName='PeerMatch_Backup.zip';
      proto.click=function(){
        try{
          if(/^PeerMatch_Backup_.*\.zip$/i.test(String(this.download||''))&&String(this.href||'').startsWith('blob:')){
            capturedName=this.download||capturedName;
            captured=fetch(this.href).then(r=>r.blob());
            return;
          }
        }catch(e){}
        return oldClick.call(this);
      };
      try{
        const r=run();if(r&&typeof r.then==='function')await r;
        if(!captured)throw new Error('PeerMatch did not produce a backup ZIP.');
        const blob=await captured;
        resolve(new File([blob],capturedName,{type:'application/zip'}));
      }catch(e){reject(e);}
      finally{proto.click=oldClick;}
    });
  }

  function decorateBackupScreen(){
    const saveBtn=document.getElementById('pmBackupEverything');if(!saveBtn||saveBtn.dataset.pmV124Backup==='1')return;
    saveBtn.dataset.pmV124Backup='1';
    saveBtn.textContent='Save backup to phone / computer';
    const email=document.createElement('button');email.id='pmV124EmailBackup';email.className='secondary';email.textContent='Email backup';
    saveBtn.insertAdjacentElement('afterend',email);
    const progress=document.getElementById('pmBackupProgress');

    email.onclick=async()=>{
      if(preparedBackup){
        const file=preparedBackup;
        const can=typeof navigator.share==='function'&&(!navigator.canShare||navigator.canShare({files:[file]}));
        if(can){
          try{
            await navigator.share({title:'PeerMatch Backup',text:'PeerMatch backup file',files:[file]});
            if(progress)progress.textContent='Backup handed to your email/share app.';
            preparedBackup=null;email.textContent='Email backup';
            return;
          }catch(e){if(e?.name==='AbortError')return;console.warn('PeerMatch v124 email backup share',e);}
        }
        downloadFile(file);
        location.href='mailto:?subject='+encodeURIComponent('PeerMatch Backup')+'&body='+encodeURIComponent('PeerMatch downloaded the backup ZIP. Please attach '+file.name+' to this email before sending.');
        if(progress)progress.textContent='Backup downloaded. Attach the ZIP to the email that opened.';
        preparedBackup=null;email.textContent='Email backup';
        return;
      }
      if(preparingBackup)return;
      preparingBackup=true;email.disabled=true;email.textContent='Preparing backup…';if(progress)progress.textContent='Collecting profiles, photos, audio and attachments…';
      try{
        preparedBackup=await captureBackupDownload(()=>saveBtn.onclick?.call(saveBtn));
        email.textContent='Choose email app';
        if(progress)progress.textContent='Backup is ready. Tap “Choose email app” to attach it.';
      }catch(e){console.warn('PeerMatch v124 prepare email backup',e);preparedBackup=null;email.textContent='Email backup';if(progress)progress.textContent='';alert('PeerMatch could not prepare the email backup.\n\n'+(e.message||e));}
      finally{preparingBackup=false;email.disabled=false;}
    };
  }

  function polish(){
    bindWhatsApp('guys');bindWhatsApp('girls');
    bindPdfEmail('guys');bindPdfEmail('girls');
    decorateBackupScreen();
  }
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;polish();});}
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
  window.addEventListener('focus',()=>setTimeout(polish,80));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(polish,80);});
  schedule();setTimeout(polish,350);
})();
