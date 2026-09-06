/* Convert constant-Z extruded STL meshes to exact planar contours. Uses polygon-clipping at build time only. */
const fs = require('node:fs');
const path = require('node:path');
const {union} = require('polygon-clipping');
const EPS = 1e-5;
const cross = (a,b,c) => (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const area = points => points.reduce((sum,p,i)=>sum+cross([0,0],p,points[(i+1)%points.length]),0)/2;
function parseSTL(buffer) {
  let triangles=[];
  if (buffer.length>=84 && 84+buffer.readUInt32LE(80)*50===buffer.length) {
    for(let i=0;i<buffer.readUInt32LE(80);i++) {
      const offset=84+i*50+12;
      triangles.push(Array.from({length:3},(_,v)=>Array.from({length:3},(_,k)=>buffer.readFloatLE(offset+v*12+k*4))));
    }
  } else {
    const matches=[...buffer.toString('utf8').matchAll(/vertex\s+([-+\d.eE]+)\s+([-+\d.eE]+)\s+([-+\d.eE]+)/g)];
    if(!matches.length || matches.length%3) throw Error('Invalid ASCII or binary STL.');
    for(let i=0;i<matches.length;i+=3)triangles.push(matches.slice(i,i+3).map(m=>m.slice(1).map(Number)));
  }
  if(!triangles.length || triangles.flat(2).some(x=>!Number.isFinite(x)))throw Error('Empty or non-finite STL.');
  return triangles;
}
function hull(points) {
  const sorted=[...points].sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
  function half(list){const out=[];for(const p of list){while(out.length>1&&cross(out.at(-2),out.at(-1),p)<=EPS)out.pop();out.push(p);}return out;}
  return half(sorted).slice(0,-1).concat(half(sorted.reverse()).slice(0,-1));
}
function projectSTL(buffer, {referenceCorners} = {}) {
  const triangles=parseSTL(buffer),vertices=triangles.flat(),zMin=Math.min(...vertices.map(p=>p[2])),zMax=Math.max(...vertices.map(p=>p[2]));
  if(zMax-zMin<EPS)throw Error('STL has no depth.');
  // These inserts are straight extrusions. Reject stepped/beveled meshes rather than silently dropping details.
  if(vertices.some(p=>Math.min(Math.abs(p[2]-zMin),Math.abs(p[2]-zMax))>EPS))throw Error('Expected a straight extrusion with two Z levels; this mesh needs a general silhouette union.');
  for(const t of triangles)if(Math.max(...t.map(p=>p[2]))-Math.min(...t.map(p=>p[2]))>EPS && Math.abs(cross(...t))>EPS)throw Error('Non-vertical side surface: expected a straight extrusion.');
  const top=triangles.filter(t=>t.every(p=>Math.abs(p[2]-zMax)<EPS));
  if(!top.length)throw Error('No planar top surface.');
  // Union removes internal triangulation, overlapping faces, and duplicate shells.
  const polygons=union(...top.filter(t=>Math.abs(cross(...t))>EPS*EPS).map(t=>[t.map(p=>p.slice(0,2))]));
  const contours=polygons.flatMap(p=>p.map(ring=>ring.slice(0,-1)));
  const topArea=Math.abs(contours.reduce((n,c)=>n+area(c),0));
  if(!topArea)throw Error('Empty projected surface.');
  let best=referenceCorners;
  if(!best){
    const outer=hull(contours.flat());let bestArea=0;
    for(let i=0;i<outer.length;i++)for(let j=i+1;j<outer.length;j++)for(let k=j+1;k<outer.length;k++){
      const candidate=[outer[i],outer[j],outer[k]],a=Math.abs(cross(...candidate));if(a>bestArea){best=candidate;bestArea=a;}
    }
  }
  if(!best)throw Error('Cannot locate three outer tips.');
  const lengths=best.map((p,i)=>Math.hypot(p[0]-best[(i+1)%3][0],p[1]-best[(i+1)%3][1]));
  if(Math.max(...lengths)-Math.min(...lengths)>Math.max(...lengths)*.001)throw Error('Outer tips do not form an equilateral triangle.');
  const apex=[...best].sort((a,b)=>a[0]-b[0]||a[1]-b[1])[0];
  const others=best.filter(p=>p!==apex).sort((a,b)=>b[1]-a[1]);
  const corners=[...others,apex], [a,b,c]=corners,det=cross(a,b,c);
  // +Z top view: preserve the XY handedness when converting Cartesian Y-up to SVG Y-down.
  if(det>=0)throw Error('Unexpected corner ordering.');
  const normalize=p=>{
    const u=((p[0]-a[0])*(c[1]-a[1])-(p[1]-a[1])*(c[0]-a[0]))/det;
    const v=((b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]))/det;
    if(u < -EPS || v < -EPS || u+v>1+EPS)throw Error('Mesh extends beyond the three selected tips.');
    return [u+v/2,v*Math.sqrt(3)/2].map(x=>Math.abs(x)<1e-12?0:x);
  };
  return {contours:contours.map(c=>c.map(normalize)),sourceCorners:corners,sourceSideMm:lengths.reduce((a,b)=>a+b)/3,depthMm:zMax-zMin,projectedAreaMm2:topArea,topTriangleCount:top.length};
}
function main() {
  const folder=path.resolve(process.argv[2]||'insert-stls'),output=path.resolve('js/stl-patterns.js'),result={};
  const referenceCorners=projectSTL(fs.readFileSync(path.join(folder,'insert-1.stl'))).sourceCorners;
  for(const file of fs.readdirSync(folder).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}))) {
    const match=/^insert-(\d+)\.stl$/i.exec(file);if(!match)continue;
    result[Number(match[1])]={source:`insert-stls/${file}`,...projectSTL(fs.readFileSync(path.join(folder,file)),{referenceCorners})};
    console.log(`${file}: ${result[match[1]].contours.length} contours, ${result[match[1]].sourceSideMm.toFixed(4)} mm tip spacing`);
  }
  if(!Object.keys(result).length)throw Error('No insert-N.stl files found.');
  fs.mkdirSync('previews',{recursive:true});
  const ids=Object.keys(result),columns=Math.min(5,ids.length),height=Math.ceil(ids.length/columns)*360;
  const cards=ids.map((id,i)=>{const model=result[id],d=model.contours.map(c=>'M'+c.map(p=>p.join(',')).join(' L')+' Z').join(' ');return `<g transform="translate(${(i%columns)*300+30},${Math.floor(i/columns)*360})"><text x="0" y="42" font-size="20">Insert ${id}</text><g transform="translate(5,78) scale(230)"><path d="M0,0 L1,0 L.5,.8660254037844386 Z" fill="#EBEBE3" stroke="#a3af9b" stroke-width=".003" stroke-dasharray=".015 .012"/><path d="${d}" fill="#BF9E82" fill-rule="evenodd"/></g><text x="0" y="315" font-size="12">+Z outline · shared triangle alignment</text><text x="0" y="336" font-size="12">${model.sourceSideMm.toFixed(4)} mm tip spacing · ${model.depthMm} mm deep</text></g>`;}).join('');
  fs.writeFileSync('previews/stl-inserts.svg',`<svg xmlns="http://www.w3.org/2000/svg" width="${columns*300}" height="${height}" viewBox="0 0 ${columns*300} ${height}"><rect width="100%" height="100%" fill="#f8f9f5"/><g font-family="system-ui, sans-serif" fill="#435d4b">${cards}</g></svg>`);
  fs.writeFileSync(output,'/* Generated by scripts/import-stls.cjs. Exact +Z silhouettes, registered to the shared source triangle. */\nglobalThis.KumikoTraces = {};\nglobalThis.KumikoStlPatterns = '+JSON.stringify(result,null,2)+';\nfor (const [id, model] of Object.entries(globalThis.KumikoStlPatterns)) {\n  globalThis.KumikoTraces[id] = model.contours;\n}\n');
}
if(require.main===module)main();
module.exports={parseSTL,projectSTL,area};
