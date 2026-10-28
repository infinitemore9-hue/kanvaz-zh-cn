/* Hover reads decoded source pixels, independent of zoom and preview filters. */
var KanvazHoverColor = (function() {
  var pointer = null, pressed = false, scheduled = false, current = null;
  var canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
  var context = canvas.getContext('2d', {willReadFrequently:true, colorSpace:'srgb'});
  var host = document.createElement('div'); host.id = 'hover-color-readout'; host.hidden = true;
  host.setAttribute('role','tooltip');
  var shadow = host.attachShadow({mode:'open'});
  shadow.innerHTML = '<style>:host{position:fixed;z-index:90000;pointer-events:none;font:12px var(--font-ui);color:var(--color-text)}:host([hidden]){display:none}.box{width:226px;padding:11px 13px;border:1px solid var(--color-border-2);border-radius:9px;background:var(--color-surface);box-shadow:0 5px 22px rgba(0,0,0,.22);box-sizing:border-box}.title,.hint{font-size:10px;color:var(--color-text-3)}.hero{display:flex;align-items:center;gap:9px;margin:7px 0}.checker{width:28px;height:28px;border:1px solid var(--color-border);border-radius:5px;overflow:hidden;background:conic-gradient(#999 25%,#ddd 0 50%,#999 0 75%,#ddd 0);background-size:10px 10px}.swatch{width:100%;height:100%}.hex{font:600 16px monospace}.data{font:11px monospace;line-height:1.7}.hint{margin-top:5px}</style><div class="box"><div class="title"></div><div class="hero"><div class="checker"><div class="swatch"></div></div><div class="hex"></div></div><div class="data rgb"></div><div class="data hsl"></div><div class="data alpha"></div><div class="hint"></div></div>';
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
  function update() {
    scheduled=false;
    var settings=typeof KanvazUI_Extended!=='undefined'?KanvazUI_Extended.getSettings():{};
    if(!pointer || pressed || settings.hoverColorEnabled===false || document.hidden){hide();return;}
    current=sample(pointer.x,pointer.y);if(!current){hide();return;}
    text('.title',label('Source image color')+' · sRGB');
    text('.hex',current.a?current.hex:label('Fully transparent'));
    shadow.querySelector('.swatch').style.background='rgba('+current.r+','+current.g+','+current.b+','+(current.a/255)+')';
    text('.rgb',current.a?current.rgb:'RGB —');text('.hsl',current.a?current.hsl:'HSL —');
    text('.alpha','A '+current.a+'/255 · '+label('Pixel')+' '+current.x+', '+current.y);
    text('.hint',current.a?'Ctrl+Shift+C · '+label('Copy color')+' '+(settings.hoverColorFormat||'hex').toUpperCase():label('No visible color to copy'));
    host.hidden=false;
    var width=host.offsetWidth,height=host.offsetHeight;
    host.style.left=Math.max(8,Math.min(pointer.x+18,window.innerWidth-width-8))+'px';
    host.style.top=Math.max(8,Math.min(pointer.y+18,window.innerHeight-height-8))+'px';
  }
  function schedule() {if(!scheduled){scheduled=true;requestAnimationFrame(update);}}
  document.addEventListener('pointermove',function(e){pointer={x:e.clientX,y:e.clientY};schedule();},{passive:true});
  window.addEventListener('pointerdown',function(){pressed=true;hide();},true);
  window.addEventListener('pointerup',function(){pressed=false;schedule();},true);
  window.addEventListener('pointercancel',function(){pressed=false;pointer=null;hide();},true);
  window.addEventListener('blur',function(){pressed=false;pointer=null;hide();});
  document.addEventListener('pointerleave',function(){pointer=null;hide();});
  window.addEventListener('resize',schedule);
  document.addEventListener('scroll',schedule,true);
  setInterval(function(){if(pointer)schedule();},200);
  window.addEventListener('keydown',function(e){
    if(!(e.ctrlKey||e.metaKey)||!e.shiftKey||e.altKey||e.key.toLowerCase()!=='c'||e.repeat||host.hidden||!pointer)return;
    if(document.activeElement && document.activeElement.closest('input,textarea,select,[contenteditable="true"]'))return;
    var value=sample(pointer.x,pointer.y);if(!value || !value.a)return;
    var formatName=KanvazUI_Extended.getSettings().hoverColorFormat || 'hex';
    var copied=formatName==='rgb'?value.rgb:formatName==='hsl'?value.hsl:value.hex;
    if(formatName==='rgb' && value.a<255)copied='rgba('+value.r+', '+value.g+', '+value.b+', '+(value.a/255).toFixed(3)+')';
    if(!navigator.clipboard || !navigator.clipboard.writeText)return;
    e.preventDefault();e.stopImmediatePropagation();
    navigator.clipboard.writeText(copied).then(function(){KanvazUI.toast(label('Color copied'));}).catch(function(){KanvazUI.toast(label('Could not copy to clipboard'),'error');});
  },true);
  return {sampleAt:sample,mapPoint:point,format:format,getCurrent:function(){return current;}};
})();
