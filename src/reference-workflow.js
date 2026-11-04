/* Reference-board workflows; stored user labels always use textContent. */
var KanvazReferenceWorkflow=(function(){
  function node(tag,parent,text,id){var e=document.createElement(tag);if(text)e.textContent=text;if(id)e.id=id;if(parent)parent.appendChild(e);return e;}
  function button(parent,text,id,fn){var b=node('button',parent,text,id);b.type='button';b.onclick=fn;return b;}
  function select(parent,id,entries){var e=node('select',parent,null,id);for(var pair of entries){var o=node('option',e,pair[1]);o.value=pair[0];}return e;}
  function ids(){return KanvazCards.getSelectedIds().filter(function(id){var c=KanvazCards.getAll()[id];return c&&!c.hidden;});}
  function locked(){return (KanvazApp.isMoodLockActive&&KanvazApp.isMoodLockActive())||(KanvazApp.isPresentationModeActive&&KanvazApp.isPresentationModeActive());}
  var content=document.querySelector('.selection-layout-content'),plan=null,previewHost=null;
  var boundsLabel=node('label',content,'Layout boundary');
  var bounds=select(boundsLabel,'layout-boundary',[['card','Card rectangle'],['visible','Visible image content']]);bounds.value=KanvazUI_Extended.getSettings().layoutBounds||'card';
  var thresholdLabel=node('label',content,'Ignore alpha below (1–255)');
  var threshold=node('input',thresholdLabel,null,'layout-alpha-threshold');threshold.type='number';threshold.min=1;threshold.max=255;threshold.step=1;threshold.value=KanvazUI_Extended.getSettings().layoutAlphaThreshold||16;threshold.setAttribute('aria-label','Ignore alpha below (1–255)');
  var confirmation=node('div',content,null,'layout-confirmation');confirmation.hidden=true;
  button(confirmation,'Apply preview','layout-confirm',commitPlan);button(confirmation,'Cancel','layout-cancel',clearPlan);
  var status=node('small',content,null,'layout-preview-status');status.setAttribute('aria-live','polite');
  bounds.onchange=function(){clearPlan();KanvazUI_Extended.updateSettings({layoutBounds:bounds.value});};
  threshold.onchange=function(){clearPlan();threshold.value=Math.max(1,Math.min(255,Number(threshold.value)||16));KanvazUI_Extended.updateSettings({layoutAlphaThreshold:Number(threshold.value)});};
  function snapshot(c){return[c.x,c.y,c.w,c.h,c.pinned,c.hidden,c.dataUrl,c.objectFit,c.flipH,c.flipV];}
  function validPlan(){return plan&&!locked()&&JSON.stringify(ids().slice().sort())===plan.selection&&plan.items.every(function(p){var c=KanvazCards.getAll()[p.id];return c&&snapshot(c).every(function(v,i){return v===p.before[i];});});}
  function clearPlan(){plan=null;if(previewHost)previewHost.replaceChildren();confirmation.hidden=true;status.textContent='';}
  var alphaCache=new WeakMap();
  function box(c){
    if(c.type!=='image')return{x:c.x,y:c.y,w:c.w,h:c.h};
    var img=document.getElementById(c.id).querySelector('img');
    if(!img||!img.complete||!img.naturalWidth)throw Error('Wait for images to load');
    var limit=Math.max(1,Math.min(255,Number(threshold.value)||16)),cached=alphaCache.get(img);
    if(!cached||cached.src!==img.currentSrc||cached.threshold!==limit){cached={src:img.currentSrc,threshold:limit,value:KanvazAlphaGeometry.extract(img,limit)};alphaCache.set(img,cached);}
    if(cached.value.empty)return null;
    return KanvazAlphaGeometry.project(c,c.x,c.y,c.w,c.h,cached.value);
  }
  function previewLayout(kind,value){
    clearPlan();if(locked())return;
    var list=ids().map(function(id){return KanvazCards.getAll()[id];}).filter(function(c){return !c.pinned;}),items=[];
    try{for(var c of list){var b=box(c);if(b)items.push({id:c.id,b:b,before:snapshot(c),x:c.x,y:c.y});}}catch(e){KanvazUI.toast('Wait for images to load','error');return;}
    if(items.length<2){KanvazUI.toast('Select at least two visible objects','error');return;}
    var axis=kind==='h'||kind==='equal-h'?'x':'y',size=axis==='x'?'w':'h';
    if(kind==='h'||kind==='v'||kind==='equal-h'||kind==='equal-v'){
      items.sort(function(a,b){return a.b[axis]-b.b[axis]||a.id.localeCompare(b.id);});
      var gap=Math.max(0,Math.min(4096,Number(value)||0));
      if(kind.indexOf('equal-')===0){if(items.length<3){KanvazUI.toast('Select three objects for equal gaps','error');return;}var total=0;for(var p of items)total+=p.b[size];gap=(items[items.length-1].b[axis]+items[items.length-1].b[size]-items[0].b[axis]-total)/(items.length-1);}
      var cursor=items[0].b[axis];for(var item of items){item[axis]+=cursor-item.b[axis];cursor+=item.b[size]+gap;}
    }else{
      var left=Math.min.apply(null,items.map(function(i){return i.b.x;})),right=Math.max.apply(null,items.map(function(i){return i.b.x+i.b.w;})),top=Math.min.apply(null,items.map(function(i){return i.b.y;})),bottom=Math.max.apply(null,items.map(function(i){return i.b.y+i.b.h;}));
      for(var item of items){var b=item.b;if(kind==='left')item.x+=left-b.x;if(kind==='right')item.x+=right-b.w-b.x;if(kind==='center-h')item.x+=(left+right-b.w)/2-b.x;if(kind==='top')item.y+=top-b.y;if(kind==='bottom')item.y+=bottom-b.h-b.y;if(kind==='middle-v')item.y+=(top+bottom-b.h)/2-b.y;}
    }
    plan={items:items,selection:JSON.stringify(ids().slice().sort())};
    if(!previewHost){previewHost=node('div',document.getElementById('canvas-world'),null,'visible-layout-preview');}
    for(var item of items){var outline=node('div',previewHost);outline.style.cssText='left:'+(item.x+item.b.x-item.before[0])+'px;top:'+(item.y+item.b.y-item.before[1])+'px;width:'+item.b.w+'px;height:'+item.b.h+'px;';}
    confirmation.hidden=false;status.textContent='Preview only — confirm to move objects';
  }
  function commitPlan(){if(!validPlan()){clearPlan();return;}var changed=false;for(var p of plan.items){if(p.x!==p.before[0]||p.y!==p.before[1]){KanvazCards.setTransform(p.id,{x:p.x,y:p.y},false);changed=true;}}if(changed){KanvazApp.markDirty();KanvazHistory.push();}clearPlan();}
  for(var pair of [['selection-space-h','h'],['selection-space-v','v'],['selection-equal-h','equal-h'],['selection-equal-v','equal-v'],['selection-align-left','left'],['selection-align-right','right'],['selection-align-top','top'],['selection-align-bottom','bottom'],['selection-align-center-h','center-h'],['selection-align-middle-v','middle-v']]){
    (function(id,kind){var b=document.getElementById(id),old=b.onclick;b.onclick=function(){if(bounds.value!=='visible'){old();return;}previewLayout(kind,document.getElementById('selection-layout-gap').value);};})(pair[0],pair[1]);
  }
  var smartLabel=node('label',content,'Show and snap equal spacing'),smart=node('input',smartLabel,null,'smart-spacing-toggle');smart.type='checkbox';smart.checked=KanvazUI_Extended.getSettings().smartSpacing!==false;smart.onchange=function(){KanvazUI_Extended.updateSettings({smartSpacing:smart.checked});if(!smart.checked)KanvazSpacingGuides.hide();};

  /* Presets contain style only, never text, position or box dimensions. */
  var presetArea=node('details',document.getElementById('text-quick-layout'),null,'text-style-presets');node('summary',presetArea,'Text style presets');var presetRow=node('div',presetArea);presetRow.className='reference-control-row';
  var preset=select(presetRow,'text-style-preset',[]),presetName=node('input',presetRow,null,'text-style-preset-name');presetName.type='text';presetName.maxLength=40;presetName.placeholder='Preset name';
  var builtins=[{name:'Title style',fontSize:48,fontBold:true,fontFamily:'yahei',textAlign:'left',textColor:null,textSizing:'auto-both'},{name:'Description style',fontSize:22,fontBold:false,fontFamily:'yahei',textAlign:'left',textColor:null,textSizing:'auto-height'},{name:'Parameters style',fontSize:18,fontBold:false,fontFamily:'mono',textAlign:'left',textColor:null,textSizing:'auto-height'}];
  function presets(){var saved=KanvazUI_Extended.getSettings().textStylePresets;return builtins.concat(Array.isArray(saved)?saved.filter(function(p){return p&&typeof p==='object'&&typeof p.name==='string';}).slice(0,20):[]);}
  function refreshPresets(){var old=preset.value;preset.replaceChildren();var all=presets();for(var i=0;i<all.length;i++){var o=node('option',preset,all[i].name||'Preset');o.value=i;if(i>=3)o.setAttribute('data-user-content','');}if(Number(old)<all.length)preset.value=old;}
  function selectedText(){var selected=ids();var c=selected.length===1&&KanvazCards.getAll()[selected[0]];return c&&c.type==='text'&&!c.pinned&&!locked()?c:null;}
  function applyPreset(){var c=selectedText(),p=presets()[Number(preset.value)];if(!c||!p)return;KanvazHistory.batch(function(){KanvazCards.setTextStyle(c.id,{fontSize:p.fontSize,fontFamily:p.fontFamily,fontBold:p.fontBold,fontItalic:!!p.fontItalic,textAlign:p.textAlign,textColor:p.textColor});KanvazCards.setTextSizing(c.id,p.textSizing||'fixed');});KanvazTextTools.sync();}
  function savePreset(){var c=selectedText(),name=presetName.value.trim();if(!c||!name){presetName.focus();return;}var saved=presets().slice(3),p={name:name,fontSize:c.fontSize||22,fontFamily:c.fontFamily||'default',fontBold:c.fontBold==null?null:c.fontBold,fontItalic:!!c.fontItalic,textAlign:c.textAlign||'center',textColor:c.textColor||null,textSizing:c.textSizing||'fixed'};var index=saved.findIndex(function(v){return v.name===name;});if(index>=0)saved[index]=p;else if(saved.length<20)saved.push(p);else{KanvazUI.toast('Maximum 20 custom presets','error');return;}KanvazUI_Extended.updateSettings({textStylePresets:saved});refreshPresets();preset.value=3+(index>=0?index:saved.length-1);}
  button(presetRow,'Apply style','text-preset-apply',applyPreset);button(presetRow,'Save current style','text-preset-save',savePreset);button(presetRow,'Delete saved style','text-preset-delete',function(){var i=Number(preset.value)-3;if(i<0)return;var saved=presets().slice(3);saved.splice(i,1);KanvazUI_Extended.updateSettings({textStylePresets:saved});refreshPresets();});refreshPresets();

  /* Named view slots are part of the board file, not global preferences. */
  var views=node('div',document.body,null,'view-bookmark-panel');views.hidden=true;views.className='reference-floating-panel';
  var viewRow=node('div',views);viewRow.className='reference-control-row';var slot=select(viewRow,'view-bookmark-slot',Array.from({length:9},function(_,i){return[String(i+1),String(i+1)];}));var viewName=node('input',viewRow,null,'view-bookmark-name');viewName.maxLength=80;viewName.placeholder='View name';
  function refreshViews(){var all=KanvazCanvas.getViewBookmarks();for(var o of slot.options){var v=all[o.value];o.textContent=o.value+(v&&v.name?' · '+v.name:v?' · ●':'');o.setAttribute('data-user-content','');}viewName.value=all[slot.value]&&all[slot.value].name||'';}
  slot.onchange=refreshViews;
  button(viewRow,'Save view','view-bookmark-save',function(){KanvazCanvas.saveViewBookmark(slot.value,viewName.value);refreshViews();});button(viewRow,'Go to view','view-bookmark-go',function(){KanvazCanvas.recallViewBookmark(slot.value);});button(viewRow,'Delete view','view-bookmark-delete',function(){KanvazCanvas.removeViewBookmark(slot.value);refreshViews();});button(viewRow,'Close','view-bookmark-close',function(){views.hidden=true;});
  var viewLaunch=button(document.getElementById('titlebar-controls'),'Views','view-bookmark-launch',function(){if(locked())return;views.hidden=!views.hidden;refreshViews();});viewLaunch.className='titlebar-btn';
  document.getElementById('titlebar-controls').insertBefore(viewLaunch,document.getElementById('simple-workspace-toggle'));
  views.addEventListener('keydown',function(e){if(!e.ctrlKey&&!e.metaKey)e.stopPropagation();if(e.key==='Escape')views.hidden=true;});

  var compare=null,compareObserver=null;
  function closeCompare(){if(compareObserver)compareObserver.disconnect();compareObserver=null;if(compare){compare.remove();compare=null;}document.getElementById('compare-images-launch').focus();}
  function openCompare(){
    if(compare||locked())return;clearPlan();var selected=ids(),cards=selected.map(function(id){return KanvazCards.getAll()[id];});if(cards.length!==2||cards.some(function(c){return c.type!=='image';}))return;
    compare=node('div',document.body,null,'image-compare-overlay');compare.className='modal-overlay';compare.setAttribute('role','dialog');compare.setAttribute('aria-modal','true');compare.setAttribute('aria-label','Compare images');
    var boxEl=node('div',compare);boxEl.className='image-compare-box';var controls=node('div',boxEl);controls.className='reference-control-row';
    var mode=select(controls,'compare-mode',[['side','Side by side'],['overlay','Overlay images'],['switch','Switch A/B']]);
    var matchLabel=node('label',controls,'Match displayed size'),match=node('input',matchLabel,null,'compare-match');match.type='checkbox';
    var zoomLabel=node('label',controls,'Zoom'),zoom=node('input',zoomLabel,null,'compare-zoom');zoom.type='range';zoom.min=25;zoom.max=400;zoom.value=100;zoom.setAttribute('aria-label','Comparison zoom');
    var zoomValue=node('input',zoomLabel,null,'compare-zoom-value');zoomValue.type='number';zoomValue.min=25;zoomValue.max=400;zoomValue.value=100;zoomValue.setAttribute('aria-label','Comparison zoom percent');
    var opacityLabel=node('label',controls,'B opacity'),opacity=node('input',opacityLabel,null,'compare-opacity');opacity.type='range';opacity.min=0;opacity.max=100;opacity.value=50;opacity.setAttribute('aria-label','B opacity');
    var opacityValue=node('input',opacityLabel,null,'compare-opacity-value');opacityValue.type='number';opacityValue.min=0;opacityValue.max=100;opacityValue.value=50;opacityValue.setAttribute('aria-label','B opacity percent');
    var active=0,panX=0,panY=0,drag=null;
    button(controls,'Switch A/B','compare-switch',function(){active=1-active;render();});button(controls,'Reset view','compare-reset',function(){zoom.value=100;panX=panY=0;render();});button(controls,'Close','compare-close',closeCompare);
    var stage=node('div',boxEl,null,'compare-stage');var panes=[],images=[];for(var i=0;i<2;i++){var pane=node('div',stage);pane.className='compare-pane';var label=node('span',pane,(i?'B · ':'A · ')+cards[i].name);label.className='compare-name';label.setAttribute('data-user-content','');var img=node('img',pane);img.alt='';img.src=cards[i].dataUrl;img.draggable=false;img.onload=render;panes.push(pane);images.push(img);}
    function render(){if(!compare)return;zoomValue.value=zoom.value;opacityValue.value=opacity.value;stage.dataset.mode=mode.value;opacityLabel.hidden=mode.value!=='overlay';var area=stage.getBoundingClientRect(),pw=mode.value==='side'?area.width/2:area.width,ph=area.height;
      var base=Math.min((pw-32)/Math.max(images[0].naturalWidth||1,images[1].naturalWidth||1),(ph-32)/Math.max(images[0].naturalHeight||1,images[1].naturalHeight||1));
      for(var i=0;i<2;i++){var img=images[i],nw=img.naturalWidth||1,nh=img.naturalHeight||1,factor=match.checked?Math.min((pw-32)/nw,(ph-32)/nh):base;img.style.width=nw*factor+'px';img.style.height=nh*factor+'px';img.style.transform='translate(-50%,-50%) translate('+panX+'px,'+panY+'px) scale('+(Number(zoom.value)/100*(cards[i].flipH?-1:1))+','+(Number(zoom.value)/100*(cards[i].flipV?-1:1))+')';panes[i].hidden=mode.value==='switch'&&active!==i;panes[i].style.opacity=mode.value==='overlay'&&i===1?Number(opacity.value)/100:1;}
    }
    mode.onchange=match.onchange=zoom.oninput=opacity.oninput=render;
    zoomValue.oninput=function(){if(zoomValue.value==='')return;zoom.value=zoomValue.value;render();};opacityValue.oninput=function(){if(opacityValue.value==='')return;opacity.value=opacityValue.value;render();};
    stage.onpointerdown=function(e){if(e.button!==0)return;drag={x:e.clientX,y:e.clientY,px:panX,py:panY};stage.setPointerCapture(e.pointerId);e.preventDefault();};stage.onpointermove=function(e){if(drag){panX=drag.px+e.clientX-drag.x;panY=drag.py+e.clientY-drag.y;render();}};stage.onpointerup=stage.onpointercancel=function(){drag=null;};
    stage.addEventListener('wheel',function(e){e.preventDefault();zoom.value=Math.max(25,Math.min(400,Number(zoom.value)*(e.deltaY<0?1.1:1/1.1)));render();},{passive:false});
    compare.addEventListener('keydown',function(e){if(e.key==='Escape'){e.preventDefault();closeCompare();}e.stopPropagation();});compare.tabIndex=-1;compare.focus();compareObserver=new ResizeObserver(render);compareObserver.observe(stage);render();
  }
  var compareButton=button(content,'Compare two images','compare-images-launch',openCompare);
  /* Color history is explicit: copying or saving, never every hover tick. */
  var colors=node('div',document.body,null,'color-library-panel');colors.className='reference-floating-panel';colors.hidden=true;
  var colorControls=node('div',colors);colorControls.className='reference-control-row';
  var colorFilter=select(colorControls,'color-library-filter',[['recent','Recent colors'],['favorites','Favorite colors']]);
  var colorName=node('input',colorControls,null,'color-library-name');colorName.maxLength=60;colorName.placeholder='Color name';
  var lastSample=null;
  function records(key){var list=KanvazUI_Extended.getSettings()[key];return Array.isArray(list)?list.filter(function(v){return v&&/^#[0-9a-f]{6}$/i.test(v.hex)&&Number(v.a)>0;}):[];}
  function colorKey(v){return v.hex.toUpperCase()+':'+v.a;}
  function recordColor(value){if(!value||!value.a||!/^#[0-9a-f]{6}$/i.test(value.hex))return;var c=KanvazCards.getAll()[value.id],info=KanvazBoards.getActiveBoardInfo();var entry={hex:value.hex,r:value.r,g:value.g,b:value.b,a:value.a,rgb:value.rgb,hsl:value.hsl,x:value.x,y:value.y,sourceName:value.sourceName||(c&&c.name)||'',sourceId:value.id,boardId:value.boardId||(info&&info.id)||'',name:''};var list=records('colorHistory').filter(function(v){return colorKey(v)!==colorKey(entry);});list.unshift(entry);KanvazUI_Extended.updateSettings({colorHistory:list.slice(0,20)});refreshColors();}
  button(colorControls,'Save sampled color','color-save-sample',function(){recordColor(lastSample);if(!lastSample)KanvazUI.toast('Hover over an image before saving a color','error');});
  button(colorControls,'Clear recent colors','color-clear-recent',function(){KanvazUI_Extended.updateSettings({colorHistory:[]});refreshColors();});button(colorControls,'Close','color-library-close',function(){colors.hidden=true;});
  var colorList=node('div',colors,null,'color-library-list');
  function copyText(value){if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(value).then(function(){KanvazUI.toast('Color copied');}).catch(function(){KanvazUI.toast('Could not copy to clipboard','error');});}
  function refreshColors(){colorList.replaceChildren();var list=records(colorFilter.value==='favorites'?'favoriteColors':'colorHistory');for(var value of list){
    (function(v){var row=node('div',colorList);row.className='color-library-row';var swatch=node('span',row);swatch.className='saved-color-swatch';swatch.style.background=v.hex;swatch.style.opacity=v.a/255;var details=node('div',row);var title=node('div',details,v.name||v.hex);title.setAttribute('data-user-content','');var data=node('small',details,(v.rgb||v.hex)+' · A '+v.a+'/255');data.setAttribute('data-user-content','');var source=node('small',details,(v.sourceName||'')+' · '+v.x+', '+v.y);source.setAttribute('data-user-content','');
    button(row,'Copy HEX',null,function(){copyText(v.hex);});button(row,'Copy RGB',null,function(){copyText(v.a<255?'rgba('+v.r+', '+v.g+', '+v.b+', '+(v.a/255).toFixed(3)+')':v.rgb);});
    var favorites=records('favoriteColors'),saved=favorites.some(function(f){return colorKey(f)===colorKey(v);});
    button(row,saved?'Remove favorite':'Favorite',null,function(){var all=records('favoriteColors').filter(function(f){return colorKey(f)!==colorKey(v);});if(!saved){if(all.length>=30){KanvazUI.toast('Maximum 30 favorite colors','error');return;}all.unshift(Object.assign({},v,{name:colorName.value.trim()||v.name||v.hex}));}KanvazUI_Extended.updateSettings({favoriteColors:all});refreshColors();});
    })(value);
  }}
  colorFilter.onchange=refreshColors;
  document.addEventListener('kanvaz-color-copied',function(e){recordColor(e.detail);});
  var colorLaunch=button(document.getElementById('titlebar-controls'),'Colors','color-library-launch',function(){if(locked())return;colors.hidden=!colors.hidden;views.hidden=true;refreshColors();});colorLaunch.className='titlebar-btn';document.getElementById('titlebar-controls').insertBefore(colorLaunch,viewLaunch);
  colors.addEventListener('keydown',function(e){if(!e.ctrlKey&&!e.metaKey)e.stopPropagation();if(e.key==='Escape')colors.hidden=true;});
  var viewOpen=viewLaunch.onclick;viewLaunch.onclick=function(){colors.hidden=true;viewOpen();};
  window.addEventListener('keydown',function(e){if(e.key==='Escape'&&plan){clearPlan();e.preventDefault();e.stopImmediatePropagation();}},true);
  content.addEventListener('input',function(){if(plan)clearPlan();});
  var previousBoard=null,lastSettings='';
  setInterval(function(){if(plan&&(!validPlan()||!document.getElementById('selection-layout-tools').open))clearPlan();var selected=ids();compareButton.disabled=selected.length!==2||selected.some(function(id){return KanvazCards.getAll()[id].type!=='image';});if(locked()){views.hidden=true;colors.hidden=true;}var sample=KanvazHoverColor.getCurrent();if(sample&&sample.a){var source=KanvazCards.getAll()[sample.id],board=KanvazBoards.getActiveBoardInfo();lastSample=Object.assign({},sample,{sourceName:source&&source.name||'',boardId:board&&board.id||''});}var info=KanvazBoards.getActiveBoardInfo();if(info&&info.id!==previousBoard){previousBoard=info.id;refreshViews();}var settings=KanvazUI_Extended.getSettings(),key=JSON.stringify([settings.layoutBounds,settings.layoutAlphaThreshold,settings.smartSpacing,settings.textStylePresets]);if(key!==lastSettings){lastSettings=key;refreshPresets();if(!plan){bounds.value=settings.layoutBounds||'card';if(document.activeElement!==threshold)threshold.value=settings.layoutAlphaThreshold||16;}smart.checked=settings.smartSpacing!==false;}},200);
  return{previewLayout:previewLayout,commitPlan:commitPlan,clearPlan:clearPlan,savePreset:savePreset,applyPreset:applyPreset,openCompare:openCompare,closeCompare:closeCompare,refreshViews:refreshViews};
})();
