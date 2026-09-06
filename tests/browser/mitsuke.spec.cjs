const {test,expect}=require('@playwright/test');
const {pathToFileURL}=require('node:url');
const path=require('node:path'),fs=require('node:fs');
const url=pathToFileURL(path.resolve(__dirname,'../../index.html')).href;
test.beforeEach(async({page})=>page.goto(url));

test('Mitsuke changes board and palette widths, supports history, persistence and exports',async({page})=>{
  await expect(page.locator('#mitsuke')).toHaveValue('3');
  const pitchBox=await page.locator('#pitch').boundingBox(),widthBox=await page.locator('#mitsuke').boundingBox();expect(widthBox.y).toBeGreaterThan(pitchBox.y+pitchBox.height);
  await expect(page.locator('label[for="pitch"]')).toHaveAttribute('title',/larger pitch makes the triangles/i);
  await expect(page.locator('label[for="mitsuke"]')).toHaveAttribute('title',/visible width.*above/i);
  await page.locator('#select-all').click();await page.locator('[data-pattern="1"]').click();
  const insert=page.locator('[data-insert]').first(),palette=page.locator('[data-pattern="1"] path').nth(1);
  const before=await insert.getAttribute('d'),preview=await palette.getAttribute('d'),size=await page.locator('#dimensions').textContent(),cells=await page.locator('.cell-hit').count();
  await page.locator('#mitsuke').fill('1');await page.locator('#mitsuke').blur();
  const thin=await insert.getAttribute('d');expect(thin).not.toBe(before);expect(await palette.getAttribute('d')).not.toBe(preview);
  await expect(page.locator('#dimensions')).toHaveText(size);await expect(page.locator('.cell-hit')).toHaveCount(cells);
  await expect(page.locator('#board g[stroke-width="3"]')).toHaveCount(1);
  await page.locator('#undo').click();await expect(insert).toHaveAttribute('d',before);
  await page.locator('#redo').click();await expect(insert).toHaveAttribute('d',thin);
  await page.reload();await expect(page.locator('#mitsuke')).toHaveValue('1');await expect(insert).toHaveAttribute('d',thin);
  const saved=page.waitForEvent('download');await page.locator('#save').click();const design=JSON.parse(fs.readFileSync(await (await saved).path(),'utf8'));expect(design.config.mitsuke).toBe(1);
  const exported=page.waitForEvent('download');await page.locator('#export-svg').click();expect(fs.readFileSync(await (await exported).path(),'utf8')).toContain(thin);
  await page.locator('#mitsuke').fill('4');await page.locator('#mitsuke').blur();
  await page.locator('#file').setInputFiles({name:'width.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(design))});await expect(insert).toHaveAttribute('d',thin);
  await page.locator('#print-parts').click();await expect(page.locator('#parts-report')).toContainText('Mitsuke 1 mm');await page.locator('#close-parts').click();
  await page.locator('#mitsuke').fill('0');await page.locator('#mitsuke').blur();await expect(page.locator('#mitsuke')).toHaveValue('1');await expect(page.locator('#toast')).toContainText('0.5 to 8');
  await page.setViewportSize({width:1280,height:720});await page.screenshot({path:'tests/browser/mitsuke.png'});
});

test('favicon loads as a self-contained SVG',async({page})=>{
  const icon=page.locator('link[rel="icon"]');await expect(icon).toHaveAttribute('href','favicon.svg');await expect(icon).toHaveAttribute('type','image/svg+xml');
  await page.setViewportSize({width:64,height:64});await page.goto(new URL('favicon.svg',url).href);
  await expect(page.locator('svg')).toHaveAttribute('viewBox','0 0 64 64');await page.screenshot({path:'tests/browser/favicon.png'});
});
