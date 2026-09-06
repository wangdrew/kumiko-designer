const {test,expect}=require('@playwright/test');
const {pathToFileURL}=require('node:url');
const path=require('node:path'),fs=require('node:fs');
test('new design allows cancel and saving before reset, with undo recovery',async({page})=>{
 await page.goto(pathToFileURL(path.resolve('index.html')).href);
 await page.locator('#name').fill('Keep this design');await page.locator('#name').blur();
 await page.locator('#select-all').click();await page.locator('[data-pattern="3"]').click();
 const count=await page.locator('#board [data-insert]').count();
 await page.locator('#new-design').click();await expect(page.locator('#new-design-dialog')).toContainText('replace your current design');
 await page.locator('#cancel-new-design').click();await expect(page.locator('#board [data-insert]')).toHaveCount(count);
 await page.locator('#new-design').click();
 const pending=page.waitForEvent('download');await page.locator('#save-before-new').click();const download=await pending;
 const saved=JSON.parse(fs.readFileSync(await download.path(),'utf8'));expect(saved.name).toBe('Keep this design');expect(Object.keys(saved.inserts)).toHaveLength(count);
 await expect(page.locator('#new-design-dialog')).toBeVisible();
 await page.locator('#confirm-new-design').click();await expect(page.locator('#name')).toHaveValue('Untitled panel');await expect(page.locator('#board [data-insert]')).toHaveCount(0);
 await page.locator('#undo').click();await expect(page.locator('#name')).toHaveValue('Keep this design');await expect(page.locator('#board [data-insert]')).toHaveCount(count);
 await expect(page.locator('.settings h2')).toHaveText('Frame Settings');await expect(page.locator('.tagline')).toContainText('Paper View');await expect(page.locator('.canvas-caption')).toHaveCount(0);
});
