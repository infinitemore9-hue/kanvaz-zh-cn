/* Derived alpha bounds; never crops or rewrites the image. */
var KanvazAlphaGeometry = (function() {
  function extract(img) {
    var factor = Math.min(1, 4096 / Math.max(img.naturalWidth, img.naturalHeight));
    var canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.ceil(img.naturalWidth * factor));
    canvas.height = Math.max(1, Math.ceil(img.naturalHeight * factor));
    var ctx = canvas.getContext('2d', {willReadFrequently:true});
    ctx.drawImage(img,0,0,canvas.width,canvas.height);
    var data = ctx.getImageData(0,0,canvas.width,canvas.height).data;
    var left = canvas.width, top = canvas.height, right = -1, bottom = -1, transparent = false;
    for (var y = 0; y < canvas.height; y++) for (var x = 0; x < canvas.width; x++) {
      var alpha = data[(y * canvas.width + x) * 4 + 3];
      if (alpha < 255) transparent = true;
      if (alpha >= 16) { left = Math.min(left,x); top = Math.min(top,y); right = Math.max(right,x); bottom = Math.max(bottom,y); }
    }
    canvas.width = canvas.height = 0;
    if (right < left) return {transparent:true, empty:true};
    return {transparent:transparent, left:left / Math.ceil(img.naturalWidth * factor), top:top / Math.ceil(img.naturalHeight * factor), right:(right+1) / Math.ceil(img.naturalWidth * factor), bottom:(bottom+1) / Math.ceil(img.naturalHeight * factor), nw:img.naturalWidth, nh:img.naturalHeight};
  }
  function project(c,x,y,w,h) {
    var a = c._alphaBounds;
    if (!a || !a.transparent || a.empty) return {x:x,y:y,w:w,h:h};
    var ratio = c.objectFit === 'contain' ? Math.min(w/a.nw,h/a.nh) : Math.max(w/a.nw,h/a.nh);
    var iw = a.nw*ratio, ih = a.nh*ratio, ox = (w-iw)/2, oy = (h-ih)/2;
    var l = c.flipH ? 1-a.right : a.left, r = c.flipH ? 1-a.left : a.right;
    var t = c.flipV ? 1-a.bottom : a.top, b = c.flipV ? 1-a.top : a.bottom;
    var left=Math.max(0,ox+l*iw), top=Math.max(0,oy+t*ih), right=Math.min(w,ox+r*iw), bottom=Math.min(h,oy+b*ih);
    return right > left && bottom > top ? {x:x+left,y:y+top,w:right-left,h:bottom-top} : {x:x,y:y,w:w,h:h};
  }
  function decorate(c,el) {
    var a=c._alphaBounds;
    el.classList.toggle('alpha-image', !!(a && a.transparent));
    if (!a || !a.transparent) return;
    var outline=el.querySelector('.alpha-content-outline');
    if (!outline) { outline=document.createElement('div'); outline.className='alpha-content-outline'; outline.setAttribute('aria-hidden','true'); el.appendChild(outline); }
    var b=project(c,0,0,c.w,c.h);
    outline.style.cssText='left:'+b.x+'px;top:'+b.y+'px;width:'+b.w+'px;height:'+b.h+'px;';
  }
  return {extract:extract, project:project, decorate:decorate};
})();
if (typeof module !== 'undefined' && module.exports) module.exports=KanvazAlphaGeometry;
