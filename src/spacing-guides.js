/* Equal-spacing candidates are secondary to edge/center alignment. */
var KanvazSpacingGuides=(function(){
  function solve(box,targets,threshold){
    var result={x:null,y:null};
    for(var axis of ['x','y']){
      var size=axis==='x'?'w':'h',other=axis==='x'?'y':'x',os=axis==='x'?'h':'w';
      var row=targets.filter(function(t){return box[other]<t[other]+t[os]&&box[other]+box[os]>t[other];}).slice().sort(function(a,b){return a[axis]-b[axis];});
      var distance=threshold;
      function offer(value,a,b,gap){var d=Math.abs(value-box[axis]);if(d<distance&&gap>=0){distance=d;result[axis]={value:value,target:a.id,target2:b.id,gap:gap,axis:axis};}}
      for(var i=0;i<row.length-1;i++){
        var a=row[i],b=row[i+1],gap=b[axis]-a[axis]-a[size];
        if(gap<0)continue;
        offer(b[axis]+b[size]+gap,a,b,gap);
        offer(a[axis]-box[size]-gap,a,b,gap);
        if(gap>=box[size])offer(a[axis]+a[size]+(gap-box[size])/2,a,b,(gap-box[size])/2);
      }
    }
    return result;
  }
  var host=null;
  function hide(){if(host)host.replaceChildren();}
  function show(box,targets,matches){
    if(typeof document==='undefined')return;
    if(!host){host=document.createElement('div');host.id='smart-spacing-guides';document.getElementById('canvas-world').appendChild(host);}
    hide();var scale=KanvazCanvas.getScale(),segments=[];
    for(var axis of ['x','y']){
      var size=axis==='x'?'w':'h',other=axis==='x'?'y':'x',os=axis==='x'?'h':'w',before=null,after=null;
      for(var t of targets){if(!(box[other]<t[other]+t[os]&&box[other]+box[os]>t[other]))continue;
        if(t[axis]+t[size]<=box[axis]&&(!before||t[axis]+t[size]>before[axis]+before[size]))before=t;
        if(t[axis]>=box[axis]+box[size]&&(!after||t[axis]<after[axis]))after=t;
      }
      if(before)segments.push({axis:axis,start:before[axis]+before[size],end:box[axis],cross:Math.max(box[other],before[other])+Math.min(box[os],before[os])/2});
      if(after)segments.push({axis:axis,start:box[axis]+box[size],end:after[axis],cross:Math.max(box[other],after[other])+Math.min(box[os],after[os])/2});
      var match=matches&&matches[axis];
      if(match){var a=targets.find(function(t){return t.id===match.target;}),b=targets.find(function(t){return t.id===match.target2;});if(a&&b)segments.push({axis:axis,start:a[axis]+a[size],end:b[axis],cross:a[other]+a[os]/2});}
    }
    for(var s of segments){var gap=s.end-s.start;if(gap<0||gap*scale>1000)continue;
      var line=document.createElement('div');line.className='spacing-measure spacing-'+s.axis;
      var label=document.createElement('span');label.textContent=(Math.round(gap*10)/10)+' px';label.style.fontSize=(11/scale)+'px';line.appendChild(label);
      line.style.left=(s.axis==='x'?s.start:s.cross)+'px';line.style.top=(s.axis==='x'?s.cross:s.start)+'px';
      line.style[s.axis==='x'?'width':'height']=gap+'px';host.appendChild(line);
    }
  }
  return{solve:solve,show:show,hide:hide};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=KanvazSpacingGuides;
