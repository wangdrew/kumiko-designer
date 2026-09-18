const {test,expect}=require('@playwright/test');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const url=pathToFileURL(path.resolve('index.html')).href;
async function expectCount(page,count){await expect(page.locator('#save-state')).toHaveText(`${count} change${count===1?'':'s'} since last download`);}
async function download(page,selector){const pending=page.waitForEvent('download');await page.locator(selector).click();return await pending;}
test('tracks edits across reloads and resets only on design download',async({page})=>{
 await page.goto(url);await expectCount(page,0);await expect(page.locator('#save')).toHaveText('↓ Download design');
 await page.locator('#select-all').click();await page.locator('#zoom-in').click();await expectCount(page,0);
 await page.locator('[data-pattern="3"]').click();await expectCount(page,1);
 await page.locator('[data-pattern="3"]').click();await expectCount(page,1);
 await page.locator('#swatches [aria-label^="Terracotta ·"]').click();await expectCount(page,2);
 await page.locator('#undo').click();await expectCount(page,3);
 await page.locator('#redo').click();await expectCount(page,4);
 await page.reload();await expectCount(page,4);
 await page.locator('.cell-hit').first().focus();await page.keyboard.press('Enter');await expectCount(page,4);
 await download(page,'#export-svg');await expectCount(page,4);
 expect((await download(page,'#save')).suggestedFilename()).toMatch(/\.kumiko\.json$/);await expectCount(page,0);
 await page.reload();await expectCount(page,0);
 await page.locator('#name').fill('Updated name');await page.locator('#name').blur();await expectCount(page,1);
 await page.locator('#new-design').click();await expect(page.locator('#save-before-new')).toHaveText('Download design');
 await download(page,'#save-before-new');await expectCount(page,0);
 await page.locator('#confirm-new-design').click();await expectCount(page,1);
 await page.locator('#undo').click();await expectCount(page,2);
});
test('storage failures retain the change count and download recovery',async({page})=>{
 await page.addInitScript(()=>{Storage.prototype.setItem=function(){throw new DOMException('Unavailable','QuotaExceededError');};});
 await page.goto(url);await page.locator('#select-all').click();await page.locator('[data-pattern="1"]').click();
 await expect(page.locator('#save-state')).toContainText('1 change since last download');
 await expect(page.locator('#save-state')).toContainText('Browser storage unavailable');
 await download(page,'#save');await expect(page.locator('#save-state')).toContainText('0 changes since last download');
});
