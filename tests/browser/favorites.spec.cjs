const {test,expect}=require('@playwright/test');
const {pathToFileURL}=require('node:url');const path=require('node:path'),fs=require('node:fs');
const card=(page,id)=>page.locator('#patterns .pattern-card').filter({has:page.locator(`[data-pattern="${id}"]`)});
test('favorites preserve combinations, apply and drag their color, persist and toggle from both panels',async({page})=>{
 await page.goto(pathToFileURL(path.resolve('index.html')).href);
 await card(page,8).locator('.favorite-heart').click();
 await expect(page.locator('#favorites .pattern')).toHaveCount(1);
 await page.locator('#swatches [aria-label^="Terracotta ·"]').click();
 await expect(card(page,8).locator('.favorite-heart')).toHaveAttribute('aria-pressed','false');
 await card(page,8).locator('.favorite-heart').click();await expect(page.locator('#favorites .pattern')).toHaveCount(2);
 await page.locator('#select-all').click();await page.locator('#favorites .pattern').first().click();
 expect(await page.evaluate(()=>Object.values(JSON.parse(localStorage.getItem('kumiko-studio.design.v1')).inserts).every(i=>i.patternId===8&&i.colorId==='matte-bone-white'))).toBe(true);
 await page.locator('#deselect').click();
 const dt=await page.evaluateHandle(()=>new DataTransfer());await page.locator('#favorites .pattern').nth(1).dispatchEvent('dragstart',{dataTransfer:dt});await page.locator('.cell-hit').nth(10).dispatchEvent('drop',{dataTransfer:dt});
 expect(await page.evaluate(()=>Object.values(JSON.parse(localStorage.getItem('kumiko-studio.design.v1')).inserts).filter(i=>i.colorId==='matte-terracotta').length)).toBe(1);
 await page.reload();await expect(page.locator('#favorites .pattern')).toHaveCount(2);
 const pending=page.waitForEvent('download');await page.locator('#save').click();const data=JSON.parse(fs.readFileSync(await (await pending).path(),'utf8'));expect(data.favorites).toHaveLength(2);
 await page.locator('#favorites .favorite-heart').first().click();await expect(page.locator('#favorites .pattern')).toHaveCount(1);
 await page.locator('#undo').click();await expect(page.locator('#favorites .pattern')).toHaveCount(2);
 await page.locator('#file').setInputFiles({name:'favorites.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});
 await card(page,8).locator('.favorite-heart').click();await expect(page.locator('#favorites .pattern')).toHaveCount(1);
 await page.screenshot({path:'tests/browser/favorites.png'});
});
test('favorites validate custom colors and reject unknown references',async({page})=>{
 await page.goto(pathToFileURL(path.resolve('index.html')).href);
 await page.locator('#add-custom-color').click();await page.locator('#custom-color-name').fill('Favorite plum');await page.locator('#custom-color-hex').fill('#663355');await page.locator('#custom-color-form button[type=submit]').click();
 await card(page,3).locator('.favorite-heart').click();await page.reload();await expect(page.locator('#favorites .pattern')).toHaveAttribute('title',/Favorite plum/);
 expect(await page.evaluate(()=>{const d=JSON.parse(localStorage.getItem('kumiko-studio.design.v1'));const valid=KumikoGeometry.validate(d);let rejected=0;for(const f of [{patternId:0,colorId:d.paletteColorId},{patternId:3,colorId:'missing'}]){try{KumikoGeometry.validate({...d,favorites:[f]});}catch{rejected++;}}return {favorites:valid.favorites.length,rejected};})).toEqual({favorites:1,rejected:2});
});
