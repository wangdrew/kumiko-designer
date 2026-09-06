const {test,expect}=require('@playwright/test');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const url=pathToFileURL(path.resolve(__dirname,'../../index.html')).href;

async function loadFixture(page){
  await page.goto(url);
  const fixture=await page.evaluate(()=>{
    const config={orientation:'side-corners',columns:6,rows:4,pitch:40,mitsuke:1,boardColor:'#BF9E82',emptyColor:'#EBEBE3'};
    const board=KumikoGeometry.board(config),cells=board.cells;
    const shared=(a,b)=>a.polygon.filter(p=>b.polygon.some(q=>Math.hypot(p[0]-q[0],p[1]-q[1])<1e-6)).length;
    const seed=cells.find(c=>c.center[0]>60&&c.center[0]<100&&c.center[1]>60&&c.center[1]<100);
    const edge=cells.find(c=>c.id!==seed.id&&shared(seed,c)===2);
    const vertex=cells.find(c=>c.id!==seed.id&&c.id!==edge.id&&shared(seed,c)===1&&shared(edge,c)<2);
    const chain=cells.find(c=>![seed.id,edge.id,vertex.id].includes(c.id)&&shared(vertex,c)===2&&shared(seed,c)<2&&shared(edge,c)<2);
    const remote=cells.find(c=>[seed,edge,vertex,chain].every(a=>a.id!==c.id&&shared(a,c)===0));
    const different=cells.find(c=>![seed.id,edge.id,vertex.id,chain.id,remote.id].includes(c.id)&&shared(seed,c)===2);
    const ids={seed:seed.id,edge:edge.id,vertex:vertex.id,chain:chain.id,remote:remote.id,different:different.id};
    const inserts={};[seed,edge,vertex,chain,remote].forEach((c,i)=>inserts[c.id]={patternId:14,colorId:'basic-blue',...(i===1?{rotation:240}:i===2?{rotation:120}:{})});
    inserts[different.id]={patternId:3,colorId:'basic-blue'};
    return {ids,design:{format:'kumiko-studio',version:1,name:'Connected selection',config,inserts,paletteColorId:'matte-bone-white'}};
  });
  await page.locator('#file').setInputFiles({name:'fixture.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixture.design))});
  return fixture;
}
async function point(page,id){return page.evaluate(id=>{const el=[...document.querySelectorAll('.cell-hit')].find(el=>el.dataset.cell===id),points=[...el.points];const p=new DOMPoint(points.reduce((n,p)=>n+p.x,0)/points.length,points.reduce((n,p)=>n+p.y,0)/points.length).matrixTransform(document.querySelector('#board').getScreenCTM());return {x:p.x,y:p.y};},id);}
async function doubleClick(page,id){const p=await point(page,id);await page.mouse.dblclick(p.x,p.y);}
async function contextMenu(page,id){const p=await point(page,id);await page.mouse.click(p.x,p.y,{button:'right'});await expect(page.locator('#insert-menu')).toBeVisible();}
async function selectedIds(page){return (await page.locator('.cell-hit.selected').evaluateAll(els=>els.map(el=>el.dataset.cell))).sort();}
async function expectSelected(page,ids){expect(await selectedIds(page)).toEqual([...ids].sort());}
async function savedInserts(page){return page.evaluate(()=>JSON.parse(localStorage.getItem('kumiko-studio.design.v1')).inserts);}

test('repeated double-clicks select edge, vertex, none, then restart; another insert starts at level one',async({page})=>{
  const {ids,design}=await loadFixture(page),both=[ids.seed,ids.edge,ids.vertex,ids.chain];
  await doubleClick(page,ids.seed);await expectSelected(page,[ids.seed,ids.edge]);await expect(page.locator('#selection-status')).toContainText('shared edges');
  await doubleClick(page,ids.seed);await expectSelected(page,both);await expect(page.locator('#selection-status')).toContainText('edges + vertices');
  await doubleClick(page,ids.seed);await expectSelected(page,[]);
  await doubleClick(page,ids.seed);await expectSelected(page,[ids.seed,ids.edge]);
  await doubleClick(page,ids.vertex);await expectSelected(page,[ids.vertex,ids.chain]);
  await doubleClick(page,ids.vertex);await expectSelected(page,both);
  await doubleClick(page,ids.different);await expectSelected(page,[ids.different]);
  expect(await savedInserts(page)).toEqual(design.inserts);
});

test('right-click selections match double-click modes and clear targets the selected group as one undo step',async({page})=>{
  const {ids,design}=await loadFixture(page);
  await contextMenu(page,ids.seed);await page.locator('[data-menu-action="edges"]').click();await expectSelected(page,[ids.seed,ids.edge]);
  await contextMenu(page,ids.seed);await page.locator('[data-menu-action="vertices"]').click();await expectSelected(page,[ids.seed,ids.edge,ids.vertex,ids.chain]);
  await contextMenu(page,ids.edge);await page.locator('[data-menu-action="clear"]').click();
  const remaining=await savedInserts(page);expect(Object.keys(remaining).sort()).toEqual([ids.remote,ids.different].sort());
  await page.keyboard.press('Control+z');expect(await savedInserts(page)).toEqual(design.inserts);
  await page.keyboard.press('Control+Shift+z');expect(await savedInserts(page)).toEqual(remaining);
});

test('context rotation applies both equivalent angles to the selection; unselected right-click targets just that insert',async({page})=>{
  const {ids,design}=await loadFixture(page),group=[ids.seed,ids.edge,ids.vertex,ids.chain];
  await doubleClick(page,ids.seed);await doubleClick(page,ids.seed);
  await contextMenu(page,ids.seed);await page.locator('[data-menu-action="rotate120"]').click();let inserts=await savedInserts(page);
  for(const id of group)expect(inserts[id].rotation||0).toBe(((design.inserts[id].rotation||0)+120)%360);
  expect(inserts[ids.remote]).toEqual(design.inserts[ids.remote]);
  await contextMenu(page,ids.edge);await page.locator('[data-menu-action="rotate240"]').click();expect(await savedInserts(page)).toEqual(design.inserts);
  await contextMenu(page,ids.remote);await expectSelected(page,[ids.remote]);await page.locator('[data-menu-action="clear"]').click();inserts=await savedInserts(page);expect(inserts[ids.remote]).toBeUndefined();
  for(const id of group)expect(inserts[id]).toEqual(design.inserts[id]);
});

test('menu supports keyboard navigation, dismisses without clearing, and stays within the viewport',async({page})=>{
  const {ids}=await loadFixture(page);
  await page.locator(`[data-cell="${ids.seed}"]`).focus();await page.keyboard.press('Shift+F10');await expect(page.locator('#insert-menu')).toBeVisible();
  await expect(page.locator('[data-menu-action="edges"]')).toBeFocused();await page.keyboard.press('ArrowDown');await expect(page.locator('[data-menu-action="vertices"]')).toBeFocused();await page.keyboard.press('Enter');await expectSelected(page,[ids.seed,ids.edge,ids.vertex,ids.chain]);
  await contextMenu(page,ids.seed);const bounds=await page.locator('#insert-menu').boundingBox(),viewport=page.viewportSize();expect(bounds.x).toBeGreaterThanOrEqual(0);expect(bounds.y).toBeGreaterThanOrEqual(0);expect(bounds.x+bounds.width).toBeLessThanOrEqual(viewport.width);expect(bounds.y+bounds.height).toBeLessThanOrEqual(viewport.height);
  await page.screenshot({path:'tests/browser/connected-menu.png'});
  await page.keyboard.press('Escape');await expect(page.locator('#insert-menu')).toBeHidden();await expectSelected(page,[ids.seed,ids.edge,ids.vertex,ids.chain]);
  await contextMenu(page,ids.seed);await page.locator('#canvas-title').click();await expect(page.locator('#insert-menu')).toBeHidden();
});

test('empty design-0 regions can be selected, and clear/rotate are disabled on an empty selection',async({page})=>{
  await page.goto(url);const id=await page.locator('.cell-hit').first().getAttribute('data-cell');
  await doubleClick(page,id);await expect(page.locator('.selected')).toHaveCount(await page.locator('.cell-hit').count());
  await contextMenu(page,id);for(const action of ['clear','rotate120','rotate240'])await expect(page.locator(`[data-menu-action="${action}"]`)).toBeDisabled();
  await page.keyboard.press('Escape');await page.locator('[data-pattern="1"]').click();await expect(page.locator('[data-insert]')).toHaveCount(await page.locator('.cell-hit').count());
});

test('double-click and context selection do not cross colors',async({page})=>{
 const {ids,design}=await loadFixture(page);
 design.inserts[ids.edge].colorId='basic-red';design.inserts[ids.vertex].colorId='basic-red';
 await page.locator('#file').setInputFiles({name:'mixed.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(design))});
 await doubleClick(page,ids.seed);await expectSelected(page,[ids.seed]);
 await doubleClick(page,ids.seed);await expectSelected(page,[ids.seed]);
 await contextMenu(page,ids.seed);await page.locator('[data-menu-action="vertices"]').click();await expectSelected(page,[ids.seed]);
});
