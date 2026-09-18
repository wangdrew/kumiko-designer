const {test,expect}=require('@playwright/test');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
async function fixture(page){
 await page.goto(pathToFileURL(path.resolve('index.html')).href);
 const data=await page.evaluate(()=>{
  const config={orientation:'side-corners',columns:6,rows:4,pitch:40,mitsuke:1,boardColor:'#BF9E82',emptyColor:'#EBEBE3'};
  const ids=KumikoGeometry.board(config).cells.slice(0,5).map(c=>c.id);
  const inserts=Object.fromEntries(ids.slice(0,4).map((id,i)=>[id,{patternId:i<2?1:3,colorId:i%2?'basic-red':'basic-blue',rotation:120}]));
  return {ids,design:{format:'kumiko-studio',version:1,name:'Palette test',config,inserts,paletteColorId:'matte-bone-white'}};
 });
 await page.locator('#file').setInputFiles({name:'test.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data.design))});return data;
}
const cell=(page,id)=>page.locator(`[data-cell="${id}"]`);
const saved=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('kumiko-studio.design.v1')).inserts);
async function select(page,id,add=false){await cell(page,id).focus();await page.keyboard.press(add?'Control+Enter':'Enter');}
async function menu(page,id){await cell(page,id).focus();await page.keyboard.press('Shift+F10');}
test('selection reflects its first insert; recoloring preserves designs and rotations and supports undo/redo',async({page})=>{
 const {ids,design}=await fixture(page);
 await select(page,ids[1]);await select(page,ids[0],true);await select(page,ids[4],true);
 await expect(page.locator('#color-name')).toHaveText('Red');
 await expect(page.locator('#filament-family')).toHaveValue('basic');
 const swatch=page.locator('#swatches [aria-label^="Blue ·"]');
 await swatch.hover();await expect(page.locator('#color-tooltip')).toHaveText(await swatch.getAttribute('aria-label'));
 await swatch.click();const after=await saved(page);
 expect(after[ids[1]]).toEqual({...design.inserts[ids[1]],colorId:'basic-blue'});
 expect(after[ids[0]]).toEqual(design.inserts[ids[0]]);expect(after[ids[4]]).toBeUndefined();
 expect(after[ids[3]]).toEqual(design.inserts[ids[3]]);
 await page.locator('#undo').click();expect(await saved(page)).toEqual(design.inserts);
 await page.locator('#redo').click();expect(await saved(page)).toEqual(after);
});
test('global matching selections and disabled states depend on shared attributes',async({page})=>{
 const {ids}=await fixture(page);
 for(const [action,expected]of [['same-color',[ids[0],ids[2]]],['same-design',[ids[0],ids[1]]],['same-design-color',[ids[0]]]]){
  await select(page,ids[0]);await menu(page,ids[0]);await page.locator(`[data-menu-action="${action}"]`).click();
  expect(await page.locator('.cell-hit.selected').evaluateAll(els=>els.map(e=>e.dataset.cell))).toEqual(expected);
 }
 await select(page,ids[0]);await select(page,ids[1],true);await menu(page,ids[0]);
 await expect(page.locator('[data-menu-action="same-color"]')).toBeDisabled();
 await expect(page.locator('[data-menu-action="same-design-color"]')).toBeDisabled();
 await expect(page.locator('[data-menu-action="same-design"]')).toBeEnabled();
 await page.keyboard.press('Escape');await select(page,ids[0]);await select(page,ids[2],true);await menu(page,ids[0]);
 await expect(page.locator('[data-menu-action="same-color"]')).toBeEnabled();await expect(page.locator('[data-menu-action="same-design"]')).toBeDisabled();
 await page.keyboard.press('Escape');await select(page,ids[3],true);await menu(page,ids[0]);
 for(const action of ['same-color','same-design','same-design-color'])await expect(page.locator(`[data-menu-action="${action}"]`)).toBeDisabled();
 await page.keyboard.press('Escape');await select(page,ids[4]);await menu(page,ids[4]);
 for(const action of ['same-color','same-design','same-design-color'])await expect(page.locator(`[data-menu-action="${action}"]`)).toBeDisabled();
});
