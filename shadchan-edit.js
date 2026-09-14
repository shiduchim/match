/* PeerMatch shadchan editing.
   Adds an Edit shadchan info button without disturbing the existing contact/history logic. */
(function(){
  const baseOpenS=window.openS||openS;

  const style=document.createElement('style');
  style.textContent=`
    .pmEditShadchan{margin:10px 0 2px}
    .pmEditShadchan button{width:100%;background:#eef3f6;color:var(--text)}
  `;
  document.head.appendChild(style);

  function editShadchan(id){
    const x=data.shadchanim.find(z=>z.id===id);
    if(!x)return;
    open(`<h2>Edit Shadchan</h2>
      <label>Name<input id="esName" value="${esc(x.name||'')}"></label>
      <label>Phone / SMS<input id="esPhone" type="tel" inputmode="tel" value="${esc(x.phone||'')}"></label>
      <label>Email<input id="esEmail" type="email" value="${esc(x.email||'')}"></label>
      <label>Tags<input id="esTags" value="${esc(x.tags||'')}" placeholder="Chabad, 35+, Israel"></label>
      <button id="esSave" class="primary full">Save Changes</button><div class="gap"></div>
      <button id="esCancel" class="secondary full">Cancel</button>`);

    $('esSave').onclick=async()=>{
      const name=$('esName').value.trim();
      if(!name)return alert('Enter a name.');
      x.name=name;
      x.phone=$('esPhone').value.trim();
      x.email=$('esEmail').value.trim();
      x.tags=$('esTags').value.trim();
      await save();
      renderS();
      openS(id);
    };
    $('esCancel').onclick=()=>openS(id);
  }

  window.openS=openS=function(id){
    baseOpenS(id);
    setTimeout(()=>{
      const sheet=document.getElementById('sheet');
      if(!sheet||document.getElementById('pmEditShadchan'))return;
      const actions=sheet.querySelector('.actions');
      if(!actions)return;
      const row=document.createElement('div');
      row.id='pmEditShadchan';
      row.className='pmEditShadchan';
      row.innerHTML='<button id="pmEditShadchanBtn">Edit shadchan info</button>';
      actions.insertAdjacentElement('afterend',row);
      document.getElementById('pmEditShadchanBtn').onclick=()=>editShadchan(id);
    },0);
  };
})();
