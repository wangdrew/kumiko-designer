/* Connectivity is based on the triangle spaces, matching design and color, independent of rotation and strip width. */
(function(root){
  function find(cells,inserts,seedId,mode='edges'){
    if(!['edges','vertices'].includes(mode))throw Error('Unknown connected-selection mode.');
    if(!cells.some(cell=>cell.id===seedId))return [];
    const colorId=inserts[seedId]?.colorId,patternId=inserts[seedId]?.patternId??0,buckets=new Map(),memberships=new Map();
    const pointKey=p=>p.map(v=>Math.round(v*1e6)).join(',');
    for(const cell of cells){
      if((inserts[cell.id]?.patternId??0)!==patternId||inserts[cell.id]?.colorId!==colorId)continue;
      const vertices=cell.polygon.map(pointKey),keys=new Set();
      if(mode==='vertices')vertices.forEach(key=>keys.add(key));
      else for(let i=0;i<vertices.length;i++){
        const a=vertices[i],b=vertices[(i+1)%vertices.length];
        if(a!==b)keys.add([a,b].sort().join('|'));
      }
      memberships.set(cell.id,keys);
      for(const key of keys){if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(cell.id);}
    }
    const selected=new Set([seedId]),queue=[seedId],visitedBuckets=new Set();
    for(let i=0;i<queue.length;i++)for(const key of memberships.get(queue[i])){
      if(visitedBuckets.has(key))continue;visitedBuckets.add(key);
      for(const id of buckets.get(key))if(!selected.has(id)){selected.add(id);queue.push(id);}
    }
    return [...selected];
  }
  root.KumikoConnectedSelection={find};
})(typeof window==='undefined'?globalThis:window);
