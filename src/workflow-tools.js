/* Temporary image inspection and a collapsed layout palette for multi-selection. */
var KanvazWorkflowTools=(function(){
  var preview=document.createElement('div');preview.id='temporary-image-preview';preview.hidden=true;
  var image=document.createElement('img');image.alt='';preview.appendChild(image);
  var caption=document.createElement('div');caption.textContent='Temporary preview · release Space to return';preview.appendChild(caption);document.body.appendChild(preview);
  var x=-1,y=-1,held=false,pressed=false,draggingCard=false,timer=null,previewId=null;
  function dismiss(){clearTimeout(timer);timer=null;preview.hidden=true;previewId=null;image.removeAttribute('src');}
  function blocked(){return document.querySelector('.modal-overlay,#reference-tools-overlay,#startup-screen,#dialog-overlay.visible,#shortcuts-overlay,#about-screen') || document.body.classList.contains('reference-view') || (typeof KanvazMapView!=='undefined'&&KanvazMapView.isActive()) || (typeof KanvazScratchBoard!=='undefined'&&KanvazScratchBoard.isActive()) || (KanvazApp.isPresentationModeActive&&KanvazApp.isPresentationModeActive()) || (KanvazApp.isMoodLockActive&&KanvazApp.isMoodLockActive());}
  window.addEventListener('pointermove',function(e){x=e.clientX;y=e.clientY;});
  window.addEventListener('pointerdown',function(e){pressed=true;draggingCard=!!e.target.closest('.card');dismiss();},true);
  window.addEventListener('pointerup',function(){pressed=draggingCard=false;},true);
  window.addEventListener('keydown',function(e){
    if(e.key==='Escape'){dismiss();return;}
    if(e.code!=='Space'||e.repeat||held||pressed||e.ctrlKey||e.metaKey||e.altKey||e.shiftKey||e.target.closest('input,textarea,select,button,summary,[contenteditable="true"]')||blocked()||KanvazUI_Extended.getSettings().spacePreviewEnabled===false)return;
    var target=document.elementFromPoint(x,y),el=target&&target.closest('.card');
    var c=el&&KanvazCards.getAll()[el.id];
    if(!c||c.type!=='image'||c.hidden||!c.dataUrl)return;
    held=true;e.preventDefault();
    timer=setTimeout(function(){
      timer=null;if(!held||pressed||blocked()||!KanvazCards.getAll()[c.id])return;
      previewId=c.id;image.src=c.dataUrl;
      image.style.transform='scale('+(c.flipH?-1:1)+','+(c.flipV?-1:1)+')';
      preview.hidden=false;
    },350);
  });
  window.addEventListener('keyup',function(e){if(e.code==='Space'){held=false;dismiss();}});
  window.addEventListener('blur',function(){held=pressed=draggingCard=false;dismiss();});
  window.addEventListener('wheel',dismiss,{passive:true});
  window.addEventListener('pointercancel',function(){pressed=draggingCard=false;dismiss();});
  var tools=document.createElement('details');tools.id='selection-layout-tools';tools.hidden=true;
  var summary=document.createElement('summary');summary.textContent='Arrange selection';tools.appendChild(summary);
  var contents=document.createElement('div');contents.className='selection-layout-content';tools.appendChild(contents);
  function chosen(){return KanvazCards.getSelectedIds().filter(function(id){var c=KanvazCards.getAll()[id];return c&&!c.hidden;});}
  function button(id,label,fn){var b=document.createElement('button');b.id=id;b.type='button';b.textContent=label;b.addEventListener('mousedown',function(e){e.preventDefault();});b.onclick=function(){fn();};contents.appendChild(b);return b;}
  for(var entry of [['left','Align left'],['center-h','Align horizontal centers'],['right','Align right'],['top','Align top'],['middle-v','Align vertical centers'],['bottom','Align bottom']]){
    (function(mode,label){button('selection-align-'+mode,label,function(){KanvazCards.alignCards(chosen(),mode);});})(entry[0],entry[1]);
  }
  var equalH=button('selection-equal-h','Equal horizontal gaps',function(){KanvazCards.distributeCards(chosen(),'h');});
  var equalV=button('selection-equal-v','Equal vertical gaps',function(){KanvazCards.distributeCards(chosen(),'v');});
  var label=document.createElement('label');label.textContent='Spacing (canvas px)';
  var gap=document.createElement('input');gap.id='selection-layout-gap';gap.type='number';gap.min='0';gap.max='4096';gap.step='1';gap.setAttribute('aria-label','Spacing (canvas px)');label.appendChild(gap);contents.appendChild(label);
  gap.value=String(KanvazUI_Extended.getSettings().selectionGap==null?24:KanvazUI_Extended.getSettings().selectionGap);
  function currentGap(){return gap.value.trim()!==''&&isFinite(Number(gap.value))?Math.max(0,Math.min(4096,Number(gap.value))):24;}
  gap.onchange=function(){gap.value=String(currentGap());KanvazUI_Extended.updateSettings({selectionGap:currentGap()});};
  function space(axis){KanvazCards.spaceCards(chosen(),axis,currentGap());gap.onchange();}
  var spaceH=button('selection-space-h','Apply horizontal spacing',function(){space('h');});
  var spaceV=button('selection-space-v','Apply vertical spacing',function(){space('v');});
  var note=document.createElement('small');note.textContent='Locked items stay in place · arrows: 1 px · Shift: 10 px';contents.appendChild(note);
  document.body.appendChild(tools);
  tools.addEventListener('keydown',function(e){if(!e.ctrlKey&&!e.metaKey)e.stopPropagation();});
  var previous='';
  function sync(){
    var ids=chosen(),signature=ids.slice().sort().join('|');
    var dragging=draggingCard || document.querySelector('.card.dragging,.card.resizing');
    tools.hidden=ids.length<2||!!blocked()||!!dragging;
    if(signature!==previous){tools.open=false;previous=signature;}
    document.body.classList.toggle('selection-layout-visible',!tools.hidden);
    if(!tools.hidden)document.body.style.setProperty('--selection-layout-height',tools.offsetHeight+'px');
    var movable=ids.filter(function(id){return !KanvazCards.getAll()[id].pinned;}).length;
    equalH.disabled=equalV.disabled=movable<3;spaceH.disabled=spaceV.disabled=movable<2;
    if(previewId && (!KanvazCards.getAll()[previewId] || blocked()))dismiss();
  }
  tools.addEventListener('toggle',sync);
  setInterval(sync,150);window.addEventListener('pointerup',sync);window.addEventListener('resize',dismiss);
  return{sync:sync,dismiss:dismiss};
})();
