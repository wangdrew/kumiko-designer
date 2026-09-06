const {test}=require('node:test');
const assert=require('node:assert/strict');
require('../js/catalog.js');
require('../js/stl-patterns.js');
require('../js/insert-width.js');
require('../js/geometry.js');
const signedArea=ring=>ring.reduce((sum,p,i)=>{const q=ring[(i+1)%ring.length];return sum+p[0]*q[1]-p[1]*q[0];},0)/2;
const filledArea=rings=>Math.abs(rings.reduce((n,ring)=>n+signedArea(ring),0));

test('Mitsuke sets measured strip width in mm across different pitches',()=>{
  // A horizontal section through the straight lower arm of insert 1.
  for(const pitch of [40,50,150])for(const width of [.5,1,2,3,8]){
    const rings=KumikoInsertWidth.contours(1,pitch,width),xs=[],y=.55;
    for(const ring of rings)for(let i=0;i<ring.length;i++){
      const a=ring[i],b=ring[(i+1)%ring.length];
      if((a[1]>y)!==(b[1]>y))xs.push(a[0]+(y-a[1])*(b[0]-a[0])/(b[1]-a[1]));
    }
    xs.sort((a,b)=>a-b);assert.equal(xs.length,2);
    assert.ok(Math.abs((xs[1]-xs[0])*(pitch-3*Math.sqrt(3))-width)<.001,`pitch ${pitch}, width ${width}`);
  }
});

test('all 40 inserts remain finite, clipped, and grow monotonically with Mitsuke',()=>{
  for(const pitch of [15,40,150])for(let id=1;id<=40;id++){
    let previous=0;
    for(const width of [.5,1,3,8]){
      const rings=KumikoInsertWidth.contours(id,pitch,width),area=filledArea(rings);
      assert.ok(area>0&&area<=Math.sqrt(3)/4+1e-6,`insert ${id}`);
      assert.ok(area>=previous-1e-6,`nonmonotonic insert ${id}`);previous=area;
      for(const [x,y]of rings.flat())assert.ok(Number.isFinite(x)&&Number.isFinite(y)&&y>=-1e-6&&x-y/Math.sqrt(3)>=-1e-6&&x+y/Math.sqrt(3)<=1+1e-6);
    }
  }
});

test('nominal width preserves original geometry and thinning retains frame contacts',()=>{
  for(let id=1;id<=40;id++)assert.deepEqual(KumikoInsertWidth.contours(id,50,2*(50-3*Math.sqrt(3))/KumikoStlPatterns[id].sourceSideMm),KumikoStlPatterns[id].contours);
  const thin=KumikoInsertWidth.contours(1,50,.5).flat();
  for(const tip of [[0,0],[1,0],[.5,Math.sqrt(3)/2]])assert.ok(thin.some(p=>Math.hypot(p[0]-tip[0],p[1]-tip[1])<.001));
});

test('Mitsuke validates and round-trips; old designs can omit it',()=>{
  const design={format:'kumiko-studio',version:1,name:'Width test',config:{orientation:'side-corners',columns:3,rows:3,pitch:50,boardColor:'#BF9E82',emptyColor:'#EBEBE3',mitsuke:2.4},inserts:{},paletteColorId:'matte-bone-white'};
  assert.deepEqual(KumikoGeometry.validate(design),design);
  for(const bad of [0,-1,.1,9,NaN,Infinity,'3',null]){design.config.mitsuke=bad;assert.throws(()=>KumikoGeometry.validate(design),/Mitsuke/);}
  delete design.config.mitsuke;assert.deepEqual(KumikoGeometry.validate(design),design);
  const pattern=KumikoCatalog.patterns[1];
  assert.deepEqual(KumikoGeometry.paths(pattern,design.config),KumikoGeometry.paths(pattern,{...design.config,mitsuke:3}));
});
