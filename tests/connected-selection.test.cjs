const {test}=require('node:test');
const assert=require('node:assert/strict');
require('../js/catalog.js');require('../js/geometry.js');require('../js/connected-selection.js');
const cell=(id,polygon)=>({id,polygon});
const cells=[
  cell('a',[[0,0],[2,0],[1,1]]),
  cell('b',[[2,0],[0,0],[1,-1]]),
  cell('c',[[1,1],[2,2],[0,2]]),
  cell('d',[[0,2],[2,2],[1,3]]),
  cell('remote',[[10,0],[12,0],[11,1]]),
];
const inserts={a:{patternId:14,colorId:'basic-blue'},b:{patternId:14,colorId:'basic-blue',rotation:240},c:{patternId:14,colorId:'basic-blue',rotation:120},d:{patternId:14,colorId:'basic-blue'},remote:{patternId:14,colorId:'basic-blue'}};
test('shared-edge selection follows only the connected same-design component',()=>{
  assert.deepEqual(new Set(KumikoConnectedSelection.find(cells,inserts,'a','edges')),new Set(['a','b']));
  assert.deepEqual(new Set(KumikoConnectedSelection.find(cells,inserts,'c','edges')),new Set(['c','d']));
});
test('vertex selection expands through corner contacts and then through their shared edges',()=>{
  assert.deepEqual(new Set(KumikoConnectedSelection.find(cells,inserts,'a','vertices')),new Set(['a','b','c','d']));
  assert.deepEqual(KumikoConnectedSelection.find(cells,inserts,'remote','vertices'),['remote']);
});
test('different designs cannot act as bridges and empty spaces form design-0 regions',()=>{
  const mixed={...inserts,c:{patternId:2,colorId:'basic-blue'}};
  assert.deepEqual(new Set(KumikoConnectedSelection.find(cells,mixed,'a','vertices')),new Set(['a','b']));
  assert.deepEqual(new Set(KumikoConnectedSelection.find(cells,{remote:inserts.remote},'a','vertices')),new Set(['a','b','c','d']));
  assert.deepEqual(KumikoConnectedSelection.find(cells,inserts,'missing','edges'),[]);
});
test('edge connectivity covers entire filled boards, including clipped halves and floating-point coordinates',()=>{
  for(const orientation of ['side-corners','vertex-corners'])for(const pitch of [15,40.5,150]){
    const board=KumikoGeometry.board({orientation,pitch,columns:5,rows:3});
    const placed=Object.fromEntries(board.cells.map(c=>[c.id,{patternId:8}]));
    for(const mode of ['edges','vertices'])assert.equal(KumikoConnectedSelection.find(board.cells,placed,board.cells[0].id,mode).length,board.cells.length);
  }
});

test('both modes stop at a different color even when the design matches',()=>{
 const mixed={...inserts,b:{patternId:14,colorId:'basic-red'},c:{patternId:14,colorId:'custom-blue'}};
 for(const mode of ['edges','vertices'])assert.deepEqual(KumikoConnectedSelection.find(cells,mixed,'a',mode),['a']);
});
