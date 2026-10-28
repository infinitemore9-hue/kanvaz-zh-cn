/* Hover reads decoded source pixels, independent of zoom and preview filters. */
var KanvazHoverColor = (function() {
  var pointer = null, pressed = false, scheduled = false, current = null, controlDown=false, dragging=null, enteredId=null, enteredAt=0;
  var canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
  var context = canvas.getContext('2d', {willReadFrequently:true, colorSpace:'srgb'});
  var host = document.createElement('div'); host.id = 'hover-color-readout'; host.hidden = true;
  host.setAttribute('role','tooltip');
  var shadow = host.attachShadow({mode:'open'});
  shadow.innerHTML = '<style>:host{position:fixed;z-index:90000;font:12px var(--font-ui);color:var(--color-text)}:host([hidden]){display:none}.box{padding:6px 8px;border:1px solid var(--color-border-2);border-radius:7px;background:var(--color-surface);box-shadow:0 2px 10px rgba(0,0,0,.16);box-sizing:border-box}.compact-row{display:flex;align-items:center;gap:6px}.checker{width:16px;height:16px;flex-shrink:0;border:1px solid var(--color-border);border-radius:3px;overflow:hidden;background:conic-gradient(#999 25%,#ddd 0 50%,#999 0 75%,#ddd 0);background-size:8px 8px}.swatch{width:100%;height:100%}button{color:inherit;cursor:pointer;background:none;border:0;padding:0;font:inherit}.hex{font:600 12px monospace;white-space:nowrap}.drag{cursor:grab;color:var(--color-text-3)}.expand,.close{font-size:15px;min-width:15px;color:var(--color-text-2)}.details{display:none;margin-top:8px}.title,.hint,.settings{font-size:10px;color:var(--color-text-3)}.data{font:11px monospace;line-height:1.7}.hint{margin-top:5px}.settings{margin-top:7px;color:var(--color-accent)}:host([data-details=true]) .box{width:226px;padding:10px 12px}:host([data-details=true]) .details{display:block}:host([data-placement=cursor]) .drag,:host([data-placement=cursor]) .expand,:host([data-placement=cursor]) .close{display:none}</style><div class="box"><div class="compact-row"><button class="drag">⠿</button><div class="checker"><div class="swatch"></div></div><button class="hex"></button><button class="expand">⋯</button><button class="close">×</button></div><div class="details"><div class="title"></div><div class="data rgb"></div><div class="data hsl"></div><div class="data alpha"></div><div class="hint"></div><button class="settings"></button></div></div>';
  document.body.appendChild(host);
  function label(en) { var l=window.KanvazLocalization; return l && l.language()==='zh-CN' ? l.dictionary[en] || en : en; }
  function text(selector,value) { var el=shadow.querySelector(selector); if(el.textContent!==value)el.textContent=value; }
  function hide() { host.hidden=true; current=null; }
  function point(rect,nw,nh,fit,flipH,flipV,x,y) {
    if (!nw || !nh || rect.width<=0 || rect.height<=0 || x<rect.left || y<rect.top || x>=rect.left+rect.width || y>=rect.top+rect.height) return null;
    var scale=(fit==='contain'?Math.min:Math.max)(rect.width/nw,rect.height/nh);
    var px=Math.floor((x-rect.left-(rect.width-nw*scale)/2)/scale);
    var py=Math.floor((y-rect.top-(rect.height-nh*scale)/2)/scale);
    if(px<0 || py<0 || px>=nw || py>=nh)return null;
    return {x:flipH?nw-1-px:px,y:flipV?nh-1-py:py};
  }
  function format(data) {
    var r=data[0],g=data[1],b=data[2],a=data[3],max=Math.max(r,g,b)/255,min=Math.min(r,g,b)/255;
    var delta=max-min,l=(max+min)/2,h=0,s=0;
    if(delta){s=delta/(1-Math.abs(2*l-1));if(max===r/255)h=((g-b)/255/delta)%6;else if(max===g/255)h=(b-r)/255/delta+2;else h=(r-g)/255/delta+4;h=(h*60+360)%360;}
    var rgb='rgb('+r+', '+g+', '+b+')',hsl='hsl('+Math.round(h)+', '+Math.round(s*100)+'%, '+Math.round(l*100)+'%)';
    return {r:r,g:g,b:b,a:a,hex:'#'+[r,g,b].map(function(v){return v.toString(16).padStart(2,'0');}).join('').toUpperCase(),rgb:rgb,hsl:hsl};
  }
  function sample(x,y) {
    if(!context || typeof KanvazCards==='undefined')return null;
    var target=document.elementFromPoint(x,y);
    if(!target || target.closest('button,input,select,a,.card-bar,.resize-handle,.card-pin'))return null;
    var element=target.closest('.card-image');
    if(!element || !element.closest('#canvas-world'))return null;
    var card=KanvazCards.getAll()[element.dataset.cardId],img=element.querySelector('img');
    if(!card || card.hidden || card.type!=='image' || !img || !img.complete || !img.naturalWidth || img.style.display==='none')return null;
    var pixel=point(img.getBoundingClientRect(),img.naturalWidth,img.naturalHeight,card.objectFit,card.flipH,card.flipV,x,y);
    if(!pixel)return null;
    try { context.clearRect(0,0,1,1);context.imageSmoothingEnabled=false;context.drawImage(img,pixel.x,pixel.y,1,1,0,0,1,1);var color=format(context.getImageData(0,0,1,1).data);color.x=pixel.x;color.y=pixel.y;color.id=card.id;return color; }
    catch(e){canvas.width=1;return null;}
  }
  function preferences() { return typeof KanvazUI_Extended!=='undefined'?KanvazUI_Extended.getSettings():{}; }
  function editableFocus() { return document.activeElement && document.activeElement.closest('input,textarea,select,[contenteditable="true"]'); }
  function overPanel() { return pointer && document.elementFromPoint(pointer.x,pointer.y)===host; }
  function update() {
    scheduled=false;
    var settings=preferences(),placement=settings.hoverColorPlacement||'corner';
    if(!pointer || pressed || settings.hoverColorEnabled===false || document.hidden || (settings.hoverColorTrigger==='ctrl'&&!controlDown)){hide();return;}
    if(dragging)return;
    var value=overPanel()?null:sample(pointer.x,pointer.y);
    if(value){
      if(enteredId!==value.id){enteredId=value.id;enteredAt=performance.now();}
      current=value;
      if(performance.now()-enteredAt<(Number(settings.hoverColorDelay)||0)){host.hidden=true;return;}
    }else{enteredId=null;if(placement==='cursor' || !current || !KanvazCards.getAll()[current.id]){hide();return;}}
    text('.title',label('Source image color')+' · sRGB');
    text('.hex',current.a?current.hex:label('Fully transparent'));
    shadow.querySelector('.swatch').style.background='rgba('+current.r+','+current.g+','+current.b+','+(current.a/255)+')';
    text('.rgb',current.a?current.rgb:'RGB —');text('.hsl',current.a?current.hsl:'HSL —');
    text('.alpha','A '+current.a+'/255 · '+label('Pixel')+' '+current.x+', '+current.y);
    text('.hint',current.a?'Ctrl+Shift+C · '+label('Copy color')+' '+(settings.hoverColorFormat||'hex').toUpperCase():label('No visible color to copy'));
    text('.settings',label('Color display settings'));
    for(var item of [['.drag','Drag color panel'],['.expand','Toggle color details (F7)'],['.close','Hide color readout (F6)'],['.hex','Copy color']]){var btn=shadow.querySelector(item[0]);btn.title=label(item[1]);btn.setAttribute('aria-label',label(item[1]));}
    host.dataset.placement=placement;host.dataset.details=settings.hoverColorDetail==='detailed'?'true':'false';
    host.style.pointerEvents=placement==='cursor'?'none':'auto';
    host.style.opacity=String(Math.max(0.45,Math.min(1,(Number(settings.hoverColorOpacity)||92)/100)));
    host.hidden=false;
    var width=host.offsetWidth,height=host.offsetHeight,x,y;
    if(placement==='cursor'){x=pointer.x+24;y=pointer.y+24;if(x+width>innerWidth-8)x=pointer.x-width-24;if(y+height>innerHeight-8)y=pointer.y-height-24;}
    else if(placement==='floating'){x=Number(settings.hoverColorX)||12;y=Number(settings.hoverColorY)||60;}
    else{x=innerWidth-width-16;y=innerHeight-height-44;var minimap=document.getElementById('minimap-wrap');if(minimap && getComputedStyle(minimap).display!=='none'){var r=minimap.getBoundingClientRect();if(r.width && r.height)y=Math.min(y,r.top-height-12);}}
    host.style.left=Math.max(8,Math.min(x,innerWidth-width-8))+'px';host.style.top=Math.max(42,Math.min(y,innerHeight-height-8))+'px';
  }
  function toggleDetails(){KanvazUI_Extended.updateSettings({hoverColorDetail:preferences().hoverColorDetail==='detailed'?'compact':'detailed'});schedule();}
  function copyColor(value){
    if(!value || !value.a || !navigator.clipboard || !navigator.clipboard.writeText)return;
    var formatName=preferences().hoverColorFormat||'hex',copied=formatName==='rgb'?value.rgb:formatName==='hsl'?value.hsl:value.hex;
    if(formatName==='rgb' && value.a<255)copied='rgba('+value.r+', '+value.g+', '+value.b+', '+(value.a/255).toFixed(3)+')';
    navigator.clipboard.writeText(copied).then(function(){KanvazUI.toast(label('Color copied'));}).catch(function(){KanvazUI.toast(label('Could not copy to clipboard'),'error');});
  }
  shadow.querySelector('.expand').onclick=toggleDetails;
  shadow.querySelector('.close').onclick=function(){KanvazUI_Extended.updateSettings({hoverColorEnabled:false});hide();};
  shadow.querySelector('.hex').onclick=function(){copyColor(current);};
  shadow.querySelector('.settings').onclick=function(){KanvazUI_Extended.updateSettings({simpleWorkspace:false});KanvazSidePanel.showSection('settings');};
  shadow.querySelector('.drag').addEventListener('pointerdown',function(e){if(e.button!==0)return;e.preventDefault();var r=host.getBoundingClientRect();dragging={x:e.clientX,y:e.clientY,left:r.left,top:r.top};});
  window.addEventListener('pointermove',function(e){if(!dragging)return;host.style.left=Math.max(8,Math.min(dragging.left+e.clientX-dragging.x,innerWidth-host.offsetWidth-8))+'px';host.style.top=Math.max(42,Math.min(dragging.top+e.clientY-dragging.y,innerHeight-host.offsetHeight-8))+'px';});
  function schedule() {if(!scheduled){scheduled=true;requestAnimationFrame(update);}}
  document.addEventListener('pointermove',function(e){controlDown=!!(e.ctrlKey||e.metaKey);pointer={x:e.clientX,y:e.clientY};schedule();},{passive:true});
  window.addEventListener('pointerdown',function(e){if(e.composedPath().indexOf(host)!==-1)return;pressed=true;hide();},true);
  window.addEventListener('pointerup',function(){if(dragging){dragging=null;KanvazUI_Extended.updateSettings({hoverColorPlacement:'floating',hoverColorX:parseFloat(host.style.left),hoverColorY:parseFloat(host.style.top)});}pressed=false;schedule();},true);
  window.addEventListener('pointercancel',function(){dragging=null;enteredId=null;pressed=false;pointer=null;hide();},true);
  window.addEventListener('blur',function(){controlDown=false;dragging=null;pressed=false;pointer=null;enteredId=null;hide();});
  document.addEventListener('pointerleave',function(){pointer=null;hide();});
  window.addEventListener('resize',schedule);
  document.addEventListener('scroll',schedule,true);
  setInterval(function(){if(pointer)schedule();},200);
  window.addEventListener('keyup',function(e){if(e.key==='Control'||e.key==='Meta'){controlDown=false;schedule();}},true);
  window.addEventListener('keydown',function(e){
    if(e.key==='Control'||e.key==='Meta'){controlDown=true;schedule();}
    if(editableFocus())return;
    if(!e.ctrlKey&&!e.metaKey&&!e.altKey&&!e.shiftKey&&!e.repeat&&(e.key==='F6'||e.key==='F7')){
      e.preventDefault();e.stopImmediatePropagation();
      if(e.key==='F7')toggleDetails();else KanvazUI_Extended.updateSettings({hoverColorEnabled:preferences().hoverColorEnabled===false});schedule();return;
    }
    if(!(e.ctrlKey||e.metaKey)||!e.shiftKey||e.altKey||e.key.toLowerCase()!=='c'||e.repeat||!pointer||pressed||preferences().hoverColorEnabled===false)return;
    var value=overPanel()?current:sample(pointer.x,pointer.y);if(!value||!value.a)return;
    e.preventDefault();e.stopImmediatePropagation();copyColor(value);
  },true);
  return {sampleAt:sample,mapPoint:point,format:format,getCurrent:function(){return current;}};
})();
