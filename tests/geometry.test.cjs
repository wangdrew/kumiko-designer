const {test}=require('node:test');const assert=require('node:assert/strict');require('../js/catalog.js');require('../js/traced-patterns.js');require('../js/stl-patterns.js');require('../js/geometry.js');const C=globalThis.KumikoCatalog,G=globalThis.KumikoGeometry;
const config={columns:6,rows:4,pitch:40,orientation:'side-corners',boardColor:'#BF9E82',emptyColor:'#EBEBE3'};
const design=()=>({format:'kumiko-studio',version:1,name:'Test',config:{...config},inserts:{},paletteColorId:'matte-bone-white'});
test('catalog contains precisely allowed reference IDs and unique filament IDs',()=>{assert.deepEqual(C.patterns.map(p=>p.id),Array.from({length:41},(_,i)=>i));assert.equal(new Set(C.colors.map(c=>c.id)).size,C.colors.length);assert.equal(C.colors.length,55);});
test('both orientations tile the full rectangle without out-of-bounds or duplicate cells',()=>{for(const orientation of C.orientations)for(const columns of [1,2,5,24])for(const rows of [1,3,24]){const b=G.board({...config,columns,rows,orientation:orientation.id});assert.ok(Math.abs(b.cells.reduce((a,c)=>a+G.area(c.polygon),0)-b.width*b.height)<1e-6);assert.equal(new Set(b.cells.map(c=>c.id)).size,b.cells.length);for(const c of b.cells)for(const [x,y]of c.polygon){assert.ok(x>=-1e-8&&x<=b.width+1e-8&&y>=-1e-8&&y<=b.height+1e-8);}}});
test('orientation phase changes corner triangle geometry',()=>{const a=G.board(config),b=G.board({...config,orientation:'vertex-corners'});assert.notDeepEqual(a.cells.map(c=>c.polygon),b.cells.map(c=>c.polygon));assert.equal(a.width,b.width);});
test('every nonempty pattern produces finite geometry',()=>{const values=C.patterns.filter(p=>p.id).map(p=>G.pathData(p,[[0,0],[40,0],[20,34.641]]));assert.ok(values.every(x=>x.length&&!/NaN|undefined|Infinity/.test(x)));assert.equal(G.paths(C.patterns[0]).length,0);});
test('valid populated design round-trips with stable references',()=>{const d=design();d.inserts[G.board(config).cells[0].id]={patternId:8,colorId:'basic-blue'};assert.deepEqual(G.validate(JSON.parse(JSON.stringify(d))),d);});
test('reject malformed versions, counts, colors, positions and catalog references',()=>{for(const mutate of [d=>d.version=2,d=>d.config.columns=1.2,d=>d.config.rows=25,d=>d.config.pitch=Infinity,d=>d.config.boardColor='<script>',d=>d.config.orientation='unknown',d=>d.inserts.bad={patternId:1,colorId:'basic-blue'},d=>d.inserts[G.board(config).cells[0].id]={patternId:99,colorId:'basic-blue'},d=>d.inserts[G.board(config).cells[0].id]={patternId:1,colorId:'missing'}]){const d=design();mutate(d);assert.throws(()=>G.validate(d));}});
test('parts list groups by pattern AND color, splits full/half, sorts, and omits empty',()=>{const d=design(),b=G.board(d.config),full=b.cells.filter(c=>G.area(c.polygon)>G.area(c.triangle)*.75),half=b.cells.filter(c=>G.area(c.polygon)<G.area(c.triangle)*.75);d.inserts[full[0].id]={patternId:8,colorId:'basic-blue'};d.inserts[full[1].id]={patternId:8,colorId:'basic-blue'};d.inserts[half[0].id]={patternId:8,colorId:'basic-blue'};d.inserts[full[2].id]={patternId:8,colorId:'matte-bone-white'};d.inserts[full[3].id]={patternId:1,colorId:'basic-blue'};d.inserts[full[4].id]={patternId:0,colorId:'basic-blue'};assert.deepEqual(G.partsList(d),[{patternId:1,colorId:'basic-blue',full:1,half:0,quantity:1},{patternId:8,colorId:'basic-blue',full:2,half:1,quantity:3},{patternId:8,colorId:'matte-bone-white',full:1,half:0,quantity:1}]);assert.deepEqual(G.partsList(design()),[]);});
test('rotation validates and round-trips while legacy inserts remain unchanged',()=>{
 const d=design(),id=G.board(config).cells[0].id;d.inserts[id]={patternId:14,colorId:'basic-blue',rotation:120};assert.deepEqual(G.validate(d),d);
 for(const value of [90,-120,360,'120',null,1.2]){d.inserts[id].rotation=value;assert.throws(()=>G.validate(d),/rotation/);}
 d.inserts[id].rotation=240;assert.equal(G.validate(d).inserts[id].rotation,240);
 delete d.inserts[id].rotation;assert.deepEqual(G.validate(d),d);
});
test('120 degree rotations are clockwise, preserve area, and fit both triangle orientations',()=>{
 const pattern=C.patterns.find(p=>p.id===14);
 for(const tri of [[[0,0],[40,0],[20,20*Math.sqrt(3)]],[[0,0],[0,40],[20*Math.sqrt(3),20]]]){
  const paths=[0,120,240].map(angle=>G.pathData(pattern,tri,angle));assert.equal(new Set(paths).size,3);
  const vertices=[[0,0],[1,0],[.5,Math.sqrt(3)/2]];
  const testPattern={id:999,family:'empty'};KumikoTraces[999]=[vertices];
  const rotated=G.pathData(testPattern,tri,120).match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi).map(Number);
  const points=[];for(let i=0;i<rotated.length;i+=2)points.push(rotated.slice(i,i+2));
  assert.ok(Math.abs(G.area(points)-G.area(tri))<1e-8);
  for(const p of points)assert.ok(tri.some(q=>Math.hypot(p[0]-q[0],p[1]-q[1])<1e-8));
  const center=[tri.reduce((s,p)=>s+p[0],0)/3,tri.reduce((s,p)=>s+p[1],0)/3],a=tri[0],b=points[0];
  assert.ok((a[0]-center[0])*(b[1]-center[1])-(a[1]-center[1])*(b[0]-center[0])>0);
  delete KumikoTraces[999];
 }
});
