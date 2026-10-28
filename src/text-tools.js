/* Screen-sized controls for the selected text card; never scaled with the canvas. */
var KanvazTextTools=(function(){
  var bar=document.createElement('div');bar.id='text-quick-toolbar';bar.hidden=true;bar.setAttribute('role','toolbar');bar.setAttribute('aria-label','Text formatting');
  document.body.appendChild(bar);
  var active=null;
  function make(tag,id,title){var el=document.createElement(tag);if(id)el.id=id;if(title){el.title=title;el.setAttribute('aria-label',title);}bar.appendChild(el);return el;}
  function button(id,title,value,fn){var el=make('button',id,title);el.type='button';el.textContent=value;el.addEventListener('mousedown',function(e){e.preventDefault();});el.onclick=fn;return el;}
  function apply(patch){if(active)KanvazCards.setTextStyle(active.id,patch);sync();}
  var font=make('select','text-quick-font','Font family');
  for(var item of [['default','Default font'],['yahei','Microsoft YaHei'],['simsun','SimSun'],['sans','Sans serif'],['serif','Serif'],['mono','Monospace'],['arial','Arial']]){var option=document.createElement('option');option.value=item[0];option.textContent=item[1];font.appendChild(option);}
  font.onchange=function(){apply({fontFamily:font.value});};
  button('text-quick-smaller','Smaller text','−',function(){apply({fontSize:(active.fontSize||22)-2});});
  var size=make('input','text-quick-size','Font size');size.type='number';size.min=10;size.max=512;size.step=1;var sizeChanged=false;
  size.oninput=function(){if(active && size.value!=='' && isFinite(Number(size.value)))sizeChanged=KanvazCards.setTextStyle(active.id,{fontSize:Number(size.value)},false)||sizeChanged;};
  size.onchange=function(){if(sizeChanged){KanvazHistory.push();sizeChanged=false;}sync();};
  button('text-quick-larger','Larger text','+',function(){apply({fontSize:(active.fontSize||22)+2});});
  var bold=button('text-quick-bold','Bold','B',function(){apply({fontBold:active.fontBold==null?false:!active.fontBold});});
  var italic=button('text-quick-italic','Italic','I',function(){apply({fontItalic:!active.fontItalic});});
  var align=make('select','text-quick-align','Text alignment');
  for(var pair of [['left','Align left'],['center','Align center'],['right','Align right']]){var o=document.createElement('option');o.value=pair[0];o.textContent=pair[1];align.appendChild(o);}
  align.onchange=function(){apply({textAlign:align.value});};
  var color=make('input','text-quick-color','Text color');color.type='color';color.onchange=function(){apply({textColor:color.value});};
  function editable(){return active && !active.pinned;}
  function edit(){if(!editable())return;var ta=document.getElementById(active.id).querySelector('.text-body');ta.readOnly=false;ta.focus();}
  function fit(){
    if(!editable())return;
    var ta=document.getElementById(active.id).querySelector('.text-body'),style=getComputedStyle(ta);
    var canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');ctx.font=style.fontStyle+' '+style.fontWeight+' '+style.fontSize+' '+style.fontFamily;
    var width=80;for(var line of (active.text||'Text').split('\n'))width=Math.max(width,ctx.measureText(line).width+18);
    width=Math.min(4096,Math.ceil(width));
    var measuring=ta.cloneNode();measuring.value=active.text||'Text';measuring.style.cssText=ta.style.cssText+';position:fixed;left:-10000px;top:0;width:'+width+'px;height:0;padding:4px;line-height:1.3;box-sizing:border-box;';document.body.appendChild(measuring);
    var height=Math.min(8192,Math.max(80,Math.ceil(measuring.scrollHeight+8)));measuring.remove();
    KanvazCards.setTransform(active.id,{w:width,h:height});sync();
  }
  button('text-quick-fit','Fit text box','Fit text box',fit);
  button('text-quick-edit','Edit text','Edit text',edit);
  var layout=make('details','text-quick-layout'),summary=document.createElement('summary');summary.textContent='Position and size';layout.appendChild(summary);
  var geometry=document.createElement('div');geometry.className='text-quick-geometry';layout.appendChild(geometry);
  var fields={};
  for(var item of [['x','X'],['y','Y'],['w','Width'],['h','Height']]){
    (function(key,title){var label=document.createElement('label');label.textContent=title;var input=document.createElement('input');input.type='number';input.step='1';input.id='text-quick-'+key;input.setAttribute('aria-label',title);if(key==='w'||key==='h')input.min='80';label.appendChild(input);geometry.appendChild(label);fields[key]=input;var changed=false;
    input.oninput=function(){if(!active||input.value===''||!isFinite(Number(input.value)))return;var patch={};patch[key]=Number(input.value);KanvazCards.setTransform(active.id,patch,false);changed=true;};
    input.onchange=function(){if(changed && active){var patch={};patch[key]=Number(input.value);KanvazCards.setTransform(active.id,patch);changed=false;}};
    })(item[0],item[1]);
  }
  bar.addEventListener('keydown',function(e){if(!e.ctrlKey&&!e.metaKey)e.stopPropagation();});
  function sync(){
    if(typeof KanvazCards==='undefined')return;
    var ids=KanvazCards.getSelectedIds(),c=ids.length===1?KanvazCards.getAll()[ids[0]]:null;
    var locked=(KanvazApp.isPresentationModeActive&&KanvazApp.isPresentationModeActive())||(KanvazApp.isMoodLockActive&&KanvazApp.isMoodLockActive());
    var el=c&&document.getElementById(c.id);
    if(!c||c.type!=='text'||c.hidden||!el||locked||document.body.classList.contains('reference-view')||document.querySelector('.modal-overlay,#reference-tools-overlay')){active=null;bar.hidden=true;return;}
    var rect=el.getBoundingClientRect();if(rect.bottom<40||rect.top>innerHeight||rect.right<0||rect.left>innerWidth){bar.hidden=true;return;}
    active=c;bar.hidden=false;
    for(var field in fields)if(document.activeElement!==fields[field])fields[field].value=Math.round(c[field]);
    if(document.activeElement!==font)font.value=c.fontFamily||'default';
    if(document.activeElement!==size)size.value=c.fontSize||22;
    if(document.activeElement!==align)align.value=c.textAlign||'center';
    if(document.activeElement!==color)color.value=c.textColor||'#dcdce8';
    bold.setAttribute('aria-pressed',c.fontBold===false?'false':'true');italic.setAttribute('aria-pressed',c.fontItalic?'true':'false');
    for(var control of bar.querySelectorAll('input,select,button'))control.disabled=!!c.pinned;
    var h=bar.offsetHeight,w=bar.offsetWidth;
    bar.style.left=Math.max(8,Math.min(rect.left,innerWidth-w-8))+'px';
    bar.style.top=Math.max(42,Math.min(rect.top-h-8>=42?rect.top-h-8:rect.bottom+8,innerHeight-h-8))+'px';
  }
  layout.addEventListener('toggle',sync);
  if(typeof ResizeObserver!=='undefined')new ResizeObserver(sync).observe(bar);
  setInterval(sync,150);window.addEventListener('resize',sync);window.addEventListener('mouseup',sync);
  var add=document.createElement('button');add.id='simple-workspace-text';add.type='button';add.className='titlebar-btn';add.textContent='Text';add.title='Add text label';
  add.onclick=function(){if((KanvazApp.isMoodLockActive&&KanvazApp.isMoodLockActive())||(KanvazApp.isPresentationModeActive&&KanvazApp.isPresentationModeActive()))return;var area=document.getElementById('canvas-container')||document.getElementById('canvas-world').parentElement;var r=area.getBoundingClientRect();var p=KanvazCanvas.screenToWorld(r.left+r.width/2,r.top+r.height/2);KanvazCards.createTextCard(p.x-110,p.y-40);sync();};
  document.getElementById('titlebar-controls').insertBefore(add,document.getElementById('simple-workspace-toggle'));
  return {sync:sync,fit:fit,edit:edit};
})();
