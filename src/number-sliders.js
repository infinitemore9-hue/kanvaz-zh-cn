/* Pair existing numeric fields with a range control, preserving their handlers. */
(function(){
  function enhance(input){
    if(input.dataset.sliderReady || input.closest('.number-slider-field'))return;
    input.dataset.sliderReady='1';
    var wrapper=document.createElement('span');wrapper.className='number-slider-field';
    var parent=input.parentNode;parent.insertBefore(wrapper,input);wrapper.appendChild(input);
    var range=document.createElement('input');range.type='range';range.className='number-value-slider';
    range.setAttribute('aria-label',(input.getAttribute('aria-label')||input.title||'Value')+' · slider');
    range.step=input.getAttribute('step')||'1';
    wrapper.appendChild(range);
    var sliding=false;
    function sync(){
      var value=Number(input.value);if(!isFinite(value))return;
      var hasMin=input.hasAttribute('min'),hasMax=input.hasAttribute('max');
      var min=hasMin?Number(input.min):value-1000,max=hasMax?Number(input.max):hasMin?Math.max(1000,value*2):value+1000;
      if(!sliding || !range.hasAttribute('min')){range.min=String(min);range.max=String(max);}
      range.value=input.value;range.disabled=input.disabled||input.readOnly;if(range.title!==String(value))range.title=String(value);
    }
    range.addEventListener('input',function(){sliding=true;input.value=range.value;input.dispatchEvent(new Event('input',{bubbles:true}));range.title=range.value;});
    range.addEventListener('change',function(){input.value=range.value;input.dispatchEvent(new Event('change',{bubbles:true}));sliding=false;sync();});
    range.addEventListener('pointerup',function(){sliding=false;});
    range.addEventListener('keydown',function(e){if(!e.ctrlKey&&!e.metaKey)e.stopPropagation();});
    input.addEventListener('input',sync);input.addEventListener('change',sync);
    range._syncNumberSlider=sync;sync();
  }
  function update(){
    for(var input of document.querySelectorAll('#side-panel-content input[type="number"],#reference-tools-overlay input[type="number"],#text-quick-toolbar input[type="number"],#selection-layout-tools input[type="number"]'))enhance(input);
    for(var range of document.querySelectorAll('.number-value-slider'))if(range._syncNumberSlider && document.activeElement!==range)range._syncNumberSlider();
  }
  var pending=false;
  new MutationObserver(function(){if(pending)return;pending=true;requestAnimationFrame(function(){pending=false;update();});}).observe(document.body,{subtree:true,childList:true});
  setInterval(update,350);update();
})();
