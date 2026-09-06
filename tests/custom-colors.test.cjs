const {test}=require('node:test'),assert=require('node:assert/strict');
require('../js/catalog.js');require('../js/geometry.js');
const design=()=>({format:'kumiko-studio',version:1,name:'Custom',config:{orientation:'side-corners',columns:2,rows:2,pitch:40,boardColor:'#123456',emptyColor:'#EBEBE3'},customColors:[{id:'custom-walnut',family:'custom',name:'Walnut',hex:'#123456'}],inserts:{},paletteColorId:'custom-walnut'});
test('custom color references round-trip without altering the shared catalog',()=>{
 const d=design();d.inserts[KumikoGeometry.board(d.config).cells[0].id]={patternId:1,colorId:'custom-walnut'};
 assert.deepEqual(KumikoGeometry.validate(d),d);assert.equal(KumikoCatalog.colors.length,55);
});
test('invalid custom colors and missing references are rejected',()=>{
 for(const mutate of [d=>d.customColors={},d=>d.customColors.push(d.customColors[0]),d=>d.customColors[0].hex='red',d=>d.customColors[0].id='basic-blue',d=>d.customColors[0].name=' ',d=>{d.inserts[KumikoGeometry.board(d.config).cells[0].id]={patternId:1,colorId:'custom-missing'};}]){
  const d=design();mutate(d);assert.throws(()=>KumikoGeometry.validate(d));
 }
});
