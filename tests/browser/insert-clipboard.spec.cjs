const {test,expect}=require('@playwright/test');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const saved=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('kumiko-studio.design.v1')).inserts);
async function select(page,id,add=false){await page.locator(`[data-cell="${id}"]`).focus();await page.keyboard.press(add?'Control+Enter':'Enter');}
async function menu(page,id){await page.locator(`[data-cell="${id}"]`).focus();await page.keyboard.press('Shift+F10');}
async function fixture(page){
 await page.goto(pathToFileURL(path.resolve('index.html')).href);
 const fixture=await page.evaluate(()=>{
  const config={orientation:'side-corners',columns:6,rows:4,pitch:40,mitsuke:1,boardColor:'#BF9E82',emptyColor:'#EBEBE3'};
  const ids=KumikoGeometry.board(config).cells.slice(0,3).map(c=>c.id);
  const inserts={[ids[0]]:{patternId:3,colorId:'custom-test',rotation:240},[ids[1]]:{patternId:1,colorId:'basic-blue',rotation:120}};
  return {ids,design:{format:'kumiko-studio',version:1,name:'Clipboard test',config,inserts,paletteColorId:'basic-blue',customColors:[{id:'custom-test',name:'Test color',family:'custom',hex:'#123456'}]}};
 });
 await page.locator('#file').setInputFiles({name:'clipboard.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixture.design))});return fixture;
}
for(const modifier of ['Control','Meta'])test(`${modifier} shortcuts copy a snapshot and paste design, color and rotation with undo/redo`,async({page})=>{
 const {ids,design}=await fixture(page);
 await select(page,ids[0]);await page.keyboard.press(`${modifier}+c`);
 // Changing the source after copying must not change the clipboard.
 await page.locator('[data-pattern="8"]').click();
 const before=await saved(page);
 await select(page,ids[1]);await page.keyboard.press(`${modifier}+v`);
 const after=await saved(page);expect(after[ids[1]]).toEqual(design.inserts[ids[0]]);expect(after[ids[0]]).toEqual(before[ids[0]]);
 await expect(page.locator('#color-name')).toHaveText('Test color');
 await page.locator('#undo').click();expect(await saved(page)).toEqual(before);
 await page.locator('#redo').click();expect(await saved(page)).toEqual(after);
});
test('copy requires one occupied cell; paste accepts empty and occupied selections',async({page})=>{
 const {ids,design}=await fixture(page),copy=page.locator('[data-menu-action="copy"]'),paste=page.locator('[data-menu-action="paste"]');
 await select(page,ids[0]);await menu(page,ids[0]);await expect(copy).toBeEnabled();await expect(paste).toBeDisabled();await copy.click();
 await select(page,ids[1]);await menu(page,ids[1]);await expect(paste).toBeEnabled();await paste.click();
 expect((await saved(page))[ids[1]]).toEqual(design.inserts[ids[0]]);
 await page.locator('#undo').click();
 await select(page,ids[0]);await select(page,ids[1],true);await menu(page,ids[0]);
 await expect(copy).toBeDisabled();await expect(paste).toBeEnabled();
 await page.keyboard.press('Control+c');await page.keyboard.press('Control+v');
 expect(await saved(page)).toEqual({...design.inserts,[ids[1]]:design.inserts[ids[0]]});
 await page.locator('#undo').click();expect(await saved(page)).toEqual(design.inserts);
 await page.keyboard.press('Escape');await select(page,ids[2]);await menu(page,ids[2]);
 await expect(copy).toBeDisabled();await expect(paste).toBeEnabled();await paste.click();
 const filled={...design.inserts,[ids[2]]:design.inserts[ids[0]]};expect(await saved(page)).toEqual(filled);
 await page.locator('#undo').click();expect(await saved(page)).toEqual(design.inserts);
 await page.locator('#redo').click();expect(await saved(page)).toEqual(filled);
 await page.locator('#undo').click();await select(page,ids[2]);await page.keyboard.press('Control+v');expect(await saved(page)).toEqual(filled);
 await page.locator('#undo').click();
 await select(page,ids[2]);await page.locator('#deselect').click();await page.keyboard.press('Control+v');expect(await saved(page)).toEqual(design.inserts);
 // Shortcuts work while the context menu is open; invalid copies did not replace the clipboard.
 await select(page,ids[1]);await menu(page,ids[1]);await page.keyboard.press('Control+v');
 expect((await saved(page))[ids[1]]).toEqual(design.inserts[ids[0]]);await expect(page.locator('#insert-menu')).toBeHidden();
});
for(const method of ['menu','Control','Meta'])test(`batch paste via ${method} fills mixed selections in one undo step`,async({page})=>{
 const {ids,design}=await fixture(page);
 await select(page,ids[0]);await page.keyboard.press('Control+c');
 await select(page,ids[1]);await select(page,ids[2],true);
 await page.keyboard.press('Control+c'); // A multi-selection must not replace the copied insert.
 if(method==='menu'){
  await menu(page,ids[1]);await expect(page.locator('[data-menu-action="copy"]')).toBeDisabled();
  await expect(page.locator('[data-menu-action="paste"]')).toBeEnabled();await page.locator('[data-menu-action="paste"]').click();
 }else await page.keyboard.press(`${method}+v`);
 const after={...design.inserts,[ids[1]]:design.inserts[ids[0]],[ids[2]]:design.inserts[ids[0]]};
 expect(await saved(page)).toEqual(after);
 await page.locator('#undo').click();expect(await saved(page)).toEqual(design.inserts);
 await page.locator('#redo').click();expect(await saved(page)).toEqual(after);
});
test('text fields retain native shortcuts and custom colors survive copying across designs',async({page})=>{
 const {ids,design}=await fixture(page);
 await select(page,ids[0]);await page.keyboard.press('Control+c');
 await page.locator('#name').focus();
 expect(await page.locator('#name').evaluate(el=>el.dispatchEvent(new KeyboardEvent('keydown',{key:'v',ctrlKey:true,bubbles:true,cancelable:true})))).toBe(true);
 const target={...design,customColors:[],inserts:{[ids[1]]:design.inserts[ids[1]]}};
 await page.locator('#file').setInputFiles({name:'target.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(target))});
 await select(page,ids[1]);await page.keyboard.press('Control+v');
 expect((await saved(page))[ids[1]]).toEqual(design.inserts[ids[0]]);
 await expect(page.locator('#color-name')).toHaveText('Test color');
 await page.locator('#undo').click();expect(await saved(page)).toEqual(target.inserts);
});
