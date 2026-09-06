const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {projectSTL,area,parseSTL}=require('../scripts/import-stls.cjs');
require('../js/catalog.js');require('../js/traced-patterns.js');require('../js/stl-patterns.js');require('../js/geometry.js');
for(const id of [1,2,3])test(`STL ${id}: exact projected area, sharp corner registration and generated data`,()=>{
  const input=fs.readFileSync(`insert-stls/insert-${id}.stl`),p=projectSTL(input);
  assert.deepEqual(p.contours,KumikoStlPatterns[id].contours);
  assert.equal(p.depthMm,11);
  assert.ok(Math.abs(p.sourceSideMm-(50-3*Math.sqrt(3)))<1e-5);
  const normalizedArea=Math.abs(p.contours.reduce((n,c)=>n+area(c),0));
  const [a,b,c]=p.sourceCorners,det=Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]));
  assert.ok(Math.abs(normalizedArea/(Math.sqrt(3)/2)*det-p.projectedAreaMm2)<1e-8);
  for(const tip of [[0,0],[1,0],[.5,Math.sqrt(3)/2]])assert.ok(p.contours.flat().some(p=>Math.hypot(p[0]-tip[0],p[1]-tip[1])<1e-10));
  for(const [x,y] of p.contours.flat())assert.ok(y>=-1e-7&&x-y/Math.sqrt(3)>=-1e-7&&x+y/Math.sqrt(3)<=1+1e-7);
  assert.equal(KumikoGeometry.paths(KumikoCatalog.patterns.find(p=>p.id===id)).length,p.contours.length);
});
test('STL 3 retains its three internal openings',()=>{
 const p=KumikoStlPatterns[3],areas=p.contours.map(area);
 assert.equal(areas.length,4);assert.equal(areas.filter(a=>a<0).length,1);assert.equal(areas.filter(a=>a>0).length,3);
});
test('lattice inset matches source insert dimensions at 50 mm pitch',()=>{
 const tri=[[0,0],[50,0],[25,25*Math.sqrt(3)]],inner=KumikoGeometry.insetTriangle(tri,1.5);
 assert.ok(Math.abs(Math.hypot(inner[0][0]-inner[1][0],inner[0][1]-inner[1][1])-KumikoStlPatterns[1].sourceSideMm)<1e-5);
 assert.ok(Math.abs(inner[0][1]-1.5)<1e-10);
});
test('ASCII parsing and invalid mesh rejection',()=>{
 assert.equal(parseSTL(Buffer.from('solid test\nfacet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 1 0 0\nvertex 0 1 0\nendloop\nendfacet\nendsolid')).length,1);
 assert.throws(()=>parseSTL(Buffer.from('invalid')));
 const b=Buffer.from(fs.readFileSync('insert-stls/insert-1.stl'));b.writeFloatLE(5,84+12+8);
 assert.throws(()=>projectSTL(b),/two Z levels/);
});
test('all 40 projected silhouettes match source triangles in their shared coordinate frame',()=>{
 const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
 function inRing(p,ring){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
 const referenceCorners=KumikoStlPatterns[1].sourceCorners;
 assert.equal(Object.keys(KumikoStlPatterns).length,40);
 for(let id=1;id<=40;id++){
  const input=fs.readFileSync(`insert-stls/insert-${id}.stl`),model=projectSTL(input,{referenceCorners});
  assert.deepEqual(model.contours,KumikoStlPatterns[id].contours);
  assert.deepEqual(model.sourceCorners,referenceCorners);
  const top=parseSTL(input).filter(t=>t.every(v=>v[2]===11));
  const [a,b,c]=referenceCorners;
  for(let ix=0;ix<27;ix++)for(let iy=0;iy<24;iy++){
   const p=[(ix+.371)/27,(iy+.219)/24*Math.sqrt(3)/2],v=p[1]*2/Math.sqrt(3),u=p[0]-v/2;
   const q=[a[0]+u*(b[0]-a[0])+v*(c[0]-a[0]),a[1]+u*(b[1]-a[1])+v*(c[1]-a[1])];
   const meshInside=top.some(t=>{const values=t.map((a,i)=>cross(a,t[(i+1)%3],q));return values.every(x=>x>=0)||values.every(x=>x<=0);});
   const outlineInside=model.contours.reduce((inside,ring)=>inside!==inRing(p,ring),false);
   assert.equal(outlineInside,meshInside,`insert ${id} sample ${ix},${iy}`);
  }
 }
});
test('glue requirements apply only to the six marked nonempty designs',()=>{
 assert.deepEqual(KumikoCatalog.patterns.filter(p=>p.requiresGlue).map(p=>p.id),[10,11,12,13,16,40]);
 assert.equal(KumikoGeometry.paths(KumikoCatalog.patterns[0]).length,0);
});
