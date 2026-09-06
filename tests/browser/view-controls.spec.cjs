const {test,expect}=require('@playwright/test');
const {pathToFileURL}=require('node:url');
const path=require('node:path'),fs=require('node:fs');
const url=pathToFileURL(path.resolve(__dirname,'../../index.html')).href;
test.beforeEach(async({page})=>page.goto(url));
async function clickFullCell(page){
 const cell=await page.evaluate(()=>{
  const config=JSON.parse(localStorage.getItem('kumiko-studio.design.v1')).config;
  const cell=KumikoGeometry.board(config).cells.find(c=>KumikoGeometry.area(c.polygon)>KumikoGeometry.area(c.triangle)*.99&&c.center[0]>config.pitch);
  const p=new DOMPoint(...cell.center).matrixTransform(document.querySelector('#board').getScreenCTM());return{id:cell.id,x:p.x,y:p.y};
 });
 if(await page.locator('#deselect').isEnabled())await page.locator('#deselect').click();await page.mouse.move(cell.x,cell.y);await expect(page.locator('#rotation-controls')).toBeHidden();await page.mouse.click(cell.x,cell.y);await expect(page.locator('#rotation-controls')).toBeVisible();return cell.id;
}
test('click rotation persists, is undoable, and is included in disk and SVG exports',async({page})=>{
 await page.locator('#select-all').click();await page.locator('[data-pattern="14"]').click();
 const id=await clickFullCell(page),insert=page.locator(`[data-insert="${id}"]`),before=await insert.getAttribute('d');
 await page.locator('#rotate-cw').click();await expect(page.locator('#rotation-angle')).toHaveText('120°');const rotated=await insert.getAttribute('d');expect(rotated).not.toBe(before);
 const read=()=>page.evaluate(id=>JSON.parse(localStorage.getItem('kumiko-studio.design.v1')).inserts[id],id);
 expect((await read()).rotation).toBe(120);
 const others=await page.evaluate(id=>Object.entries(JSON.parse(localStorage.getItem('kumiko-studio.design.v1')).inserts).filter(([key])=>key!==id).every(([,value])=>!value.rotation),id);expect(others).toBe(true);
 await page.keyboard.press('Control+z');expect((await read()).rotation).toBeUndefined();await expect(insert).toHaveAttribute('d',before);
 await page.keyboard.press('Control+Shift+z');expect((await read()).rotation).toBe(120);
 await page.reload();await expect(insert).toHaveAttribute('d',rotated);
 const saved=page.waitForEvent('download');await page.locator('#save').click();const design=JSON.parse(fs.readFileSync(await (await saved).path(),'utf8'));expect(design.inserts[id].rotation).toBe(120);
 const svgDownload=page.waitForEvent('download');await page.locator('#export-svg').click();const svg=fs.readFileSync(await (await svgDownload).path(),'utf8');expect(svg).toContain(rotated);expect(svg).not.toContain('rotation-controls');
 await clickFullCell(page);await page.locator('#rotate-ccw').click();await expect(insert).toHaveAttribute('d',before);
 await page.locator('#rotate-ccw').click();await expect(page.locator('#rotation-angle')).toHaveText('240°');
 await page.locator('#file').setInputFiles({name:'rotated.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(design))});await expect(insert).toHaveAttribute('d',rotated);
});
test('rotation toolbar is hidden on empty cells and rotations cycle back to the original',async({page})=>{
 await expect(page.locator('#rotation-controls')).toBeHidden();await page.locator('#select-all').click();await page.locator('[data-pattern="20"]').click();const id=await clickFullCell(page),insert=page.locator(`[data-insert="${id}"]`),before=await insert.getAttribute('d');
 for(let i=0;i<3;i++)await page.locator('#rotate-cw').click();await expect(insert).toHaveAttribute('d',before);
 await page.locator('#clear').click();await expect(page.locator('#rotation-controls')).toBeHidden();
});
test('click rotation preserves a multi-selection, clears the target with a margin, and rotates the group',async({page})=>{
 await page.locator('#select-all').click();await page.locator('[data-pattern="14"]').click();
 const id=await clickFullCell(page);
 const target=await page.evaluate(id=>{
  const el=[...document.querySelectorAll('.cell-hit')].find(e=>e.dataset.cell!==id),pts=[...el.points];
  const p=new DOMPoint(pts.reduce((s,p)=>s+p.x,0)/pts.length,pts.reduce((s,p)=>s+p.y,0)/pts.length).matrixTransform(document.querySelector('#board').getScreenCTM());return {id:el.dataset.cell,x:p.x,y:p.y};
 },id);
 await page.keyboard.down('Meta');await page.mouse.click(target.x,target.y);await page.keyboard.up('Meta');
 await expect(page.locator('.cell-hit.selected')).toHaveCount(2);
 await page.mouse.click(target.x,target.y);await expect(page.locator('.cell-hit.selected')).toHaveCount(2);
 const cell=await page.locator(`[data-cell="${target.id}"]`).boundingBox(),bar=await page.locator('#rotation-controls').boundingBox();
 expect(bar.y+bar.height<=cell.y-14||bar.y>=cell.y+cell.height+14,JSON.stringify({cell,bar})).toBe(true);
 await page.locator('#rotate-cw').click();
 const rotations=await page.evaluate(()=>Object.values(JSON.parse(localStorage.getItem('kumiko-studio.design.v1')).inserts).filter(i=>i.rotation===120).length);
 expect(rotations).toBe(2);await page.locator('#undo').click();
 expect(await page.evaluate(()=>Object.values(JSON.parse(localStorage.getItem('kumiko-studio.design.v1')).inserts).some(i=>i.rotation))).toBe(false);
});
test('zoom controls and keyboard shortcuts change only the view, with panning and fit reset',async({page})=>{
 await page.locator('#select-all').click();await page.locator('[data-pattern="1"]').click();const saved=await page.evaluate(()=>localStorage.getItem('kumiko-studio.design.v1'));
 const original=await page.locator('#board').getAttribute('viewBox');await page.locator('#zoom-in').click();await expect(page.locator('#zoom-fit')).toHaveText('125%');
 await page.keyboard.press('+');await expect(page.locator('#zoom-fit')).toHaveText('156%');await page.keyboard.press('-');await expect(page.locator('#zoom-fit')).toHaveText('125%');
 const nativeShortcuts=await page.evaluate(()=>{
  const results=[];for(const modifier of ['metaKey','ctrlKey'])for(const key of ['+','=','-','0']){const event=new KeyboardEvent('keydown',{key,[modifier]:true,bubbles:true,cancelable:true});document.dispatchEvent(event);results.push(event.defaultPrevented);}return results;
 });expect(nativeShortcuts).toEqual(Array(8).fill(false));await expect(page.locator('#zoom-fit')).toHaveText('125%');
 for(let i=0;i<8;i++)await page.keyboard.press('+');await expect(page.locator('#zoom-fit')).toHaveText('400%');await expect(page.locator('#zoom-in')).toBeDisabled();
 const beforePan=await page.locator('#board').getAttribute('viewBox'),box=await page.locator('#canvas').boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.keyboard.down('Space');await page.mouse.down();await page.mouse.move(box.x+box.width/2+50,box.y+box.height/2+40,{steps:5});await page.mouse.up();await page.keyboard.up('Space');expect(await page.locator('#board').getAttribute('viewBox')).not.toBe(beforePan);
 await page.keyboard.press('0');await expect(page.locator('#board')).toHaveAttribute('viewBox',original);await expect(page.locator('#zoom-fit')).toHaveText('100%');
 for(let i=0;i<8;i++)await page.keyboard.press('-');await expect(page.locator('#zoom-fit')).toHaveText('50%');await expect(page.locator('#zoom-out')).toBeDisabled();
 await page.locator('#zoom-fit').click();expect(await page.evaluate(()=>localStorage.getItem('kumiko-studio.design.v1'))).toBe(saved);
 await page.locator('#name').fill('A+B-0');await expect(page.locator('#zoom-fit')).toHaveText('100%');
});
for(const viewport of [{width:1440,height:900},{width:1280,height:720},{width:1024,height:768},{width:1366,height:600},{width:390,height:844}])test(`fits viewport ${viewport.width}x${viewport.height}`,async({page})=>{
 await page.setViewportSize(viewport);
 if(viewport.width<=820)await page.locator('button[data-panel="palette"]').click();
 const metrics=await page.evaluate(()=>({height:document.documentElement.scrollHeight,width:document.documentElement.scrollWidth,patterns:document.querySelector('#patterns').scrollHeight,available:document.querySelector('#patterns').clientHeight}));
 expect(metrics.height).toBeLessThanOrEqual(viewport.height);expect(metrics.width).toBeLessThanOrEqual(viewport.width);expect(metrics.patterns).toBeLessThanOrEqual(metrics.available+1);
 await expect(page.locator('[data-pattern="40"]')).toBeInViewport();await expect(page.locator('#patterns')).not.toContainText('STL');
 if(viewport.width<=820){await page.locator('button[data-panel="settings"]').click();await expect(page.locator('#pitch')).toBeInViewport();await page.locator('button[data-panel="workspace"]').click();}
 await expect(page.locator('#save')).toBeInViewport();await expect(page.locator('#zoom-in')).toBeInViewport();
 await page.screenshot({path:`tests/browser/compact-${viewport.width}-${viewport.height}.png`});
});
test('Delete and Backspace replace single and multiple selections with empty design 0',async({page})=>{
 await page.locator('#select-all').click();await page.locator('[data-pattern="14"]').click();const total=await page.locator('.cell-hit').count();
 await page.locator('#deselect').click();
 const cells=await page.evaluate(()=>[10,20].map(i=>{const el=document.querySelectorAll('.cell-hit')[i],pts=[...el.points],p=new DOMPoint(pts.reduce((s,p)=>s+p.x,0)/pts.length,pts.reduce((s,p)=>s+p.y,0)/pts.length).matrixTransform(document.querySelector('#board').getScreenCTM());return{id:el.dataset.cell,x:p.x,y:p.y};}));
 // Selecting a cell after editing a field must transfer keyboard focus back to the canvas.
 await page.locator('#name').fill('Keep my name');await page.mouse.click(cells[0].x,cells[0].y);await page.keyboard.press('Delete');
 await expect(page.locator(`[data-insert="${cells[0].id}"]`)).toHaveCount(0);await expect(page.locator('.cell-hit')).toHaveCount(total);await expect(page.locator('.selected')).toHaveCount(1);await expect(page.locator('[data-pattern="0"]')).toHaveClass(/active/);await expect(page.locator('#name')).toHaveValue('Keep my name');
 await page.keyboard.press('Control+z');await expect(page.locator(`[data-insert="${cells[0].id}"]`)).toHaveCount(1);
 await page.mouse.click(cells[0].x,cells[0].y);await page.keyboard.down('Control');await page.mouse.click(cells[1].x,cells[1].y);await page.keyboard.up('Control');await expect(page.locator('.selected')).toHaveCount(2);
 await page.keyboard.press('Backspace');for(const c of cells)await expect(page.locator(`[data-insert="${c.id}"]`)).toHaveCount(0);await expect(page.locator('.selected')).toHaveCount(2);
 await expect(page.locator('#piece-count')).toContainText(`${total-2} inserts`);await page.reload();for(const c of cells)await expect(page.locator(`[data-insert="${c.id}"]`)).toHaveCount(0);
 await page.locator('#select-all').click();await page.locator('#name').focus();await page.keyboard.press('End');await page.keyboard.press('Backspace');await expect(page.locator('#piece-count')).toContainText(`${total-2} inserts`);
});
