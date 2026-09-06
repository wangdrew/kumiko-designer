/* Offset the STL's nominal 2 mm strips in physical units, retaining holes and contacts. */
(function(root){
  const lib=root.ClipperLib || (typeof require==='function'?require('./vendor/clipper.js'):null);
  const SCALE=1e6, HEIGHT=Math.sqrt(3)/2, TRIANGLE=[[0,0],[1,0],[.5,HEIGHT]];
  const cache=new Map();
  const integerPaths=paths=>paths.map(ring=>ring.map(([x,y])=>({X:Math.round(x*SCALE),Y:Math.round(y*SCALE)})));
  function clip(paths,type,clipPaths){
    const engine=new lib.Clipper(),result=[];
    engine.AddPaths(paths,lib.PolyType.ptSubject,true);
    if(clipPaths)engine.AddPaths(clipPaths,lib.PolyType.ptClip,true);
    engine.Execute(type,result,lib.PolyFillType.pftNonZero,lib.PolyFillType.pftNonZero);
    return result;
  }
  function reflect(p,a,b){
    const dx=b[0]-a[0],dy=b[1]-a[1],t=((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy);
    return [2*(a[0]+t*dx)-p[0],2*(a[1]+t*dy)-p[1]];
  }
  function extendAcrossEdges(contours){
    // Mirroring before erosion retains connections at the frame, rather than shortening every strip tip.
    const signature=tri=>tri.map(p=>p.map(v=>Math.round(v*SCALE)).join(',')).sort().join('|');
    const first={tri:TRIANGLE,contours},tiles=[first],seen=new Set([signature(TRIANGLE)]);let frontier=[first];
    for(let depth=0;depth<3;depth++){
      const next=[];
      for(const tile of frontier)for(let i=0;i<3;i++){
        const a=TRIANGLE[i],b=TRIANGLE[(i+1)%3],tri=tile.tri.map(p=>reflect(p,a,b)),key=signature(tri);
        if(seen.has(key))continue;seen.add(key);
        const copy={tri,contours:tile.contours.map(ring=>ring.map(p=>reflect(p,a,b)).reverse())};
        tiles.push(copy);next.push(copy);
      }
      frontier=next;
    }
    return tiles.flatMap(tile=>tile.contours);
  }
  function contours(id,pitch,mitsuke){
    const model=root.KumikoStlPatterns[id];if(!model)return [];
    const key=`${id}:${pitch}:${mitsuke}`;if(cache.has(key))return cache.get(key);
    const innerSide=pitch-3*Math.sqrt(3);
    if(!Number.isFinite(innerSide)||innerSide<=0||!Number.isFinite(mitsuke)||mitsuke<=0)throw Error('Invalid insert dimensions.');
    const delta=(mitsuke/innerSide-2/model.sourceSideMm)/2;
    if(Math.abs(delta)<1e-9)return model.contours;
    // All outer contours have negative winding after the STL-to-SVG transform. Reverse for Clipper.
    const source=model.contours.map(ring=>[...ring].reverse());
    let paths=delta<0?clip(integerPaths(extendAcrossEdges(source)),lib.ClipType.ctUnion):integerPaths(source);
    // Weld sub-micron rounding seams along the mirrored 60° edges before erosion.
    // Compensate for this tiny expansion in the final offset so strip width stays unchanged.
    const weld=delta<0?4:0;
    if(weld){
      const bridge=new lib.ClipperOffset(8,100),joined=[];
      bridge.AddPaths(paths,lib.JoinType.jtMiter,lib.EndType.etClosedPolygon);
      bridge.Execute(joined,weld);paths=joined;
    }
    const offset=new lib.ClipperOffset(8,100),expanded=[];
    offset.AddPaths(paths,lib.JoinType.jtMiter,lib.EndType.etClosedPolygon);
    offset.Execute(expanded,delta*SCALE-weld);
    const result=clip(expanded,lib.ClipType.ctIntersection,integerPaths([TRIANGLE])).map(ring=>ring.map(p=>[p.X/SCALE,p.Y/SCALE]));
    if(cache.size>=160)cache.delete(cache.keys().next().value);
    cache.set(key,result);return result;
  }
  root.KumikoInsertWidth={contours};
})(typeof window==='undefined'?globalThis:window);
