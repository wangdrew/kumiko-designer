const {test,expect}=require('@playwright/test');
const {pathToFileURL}=require('node:url'),path=require('node:path');
test('pencil follows a freeform stroke without selecting its bounding box and supports additive strokes',async({page})=>{
 await page.goto(pathToFileURL(path.resolve('index.html')).href);
 const points=await page.evaluate(()=>{
  const svg=document.querySelector('#board'),ctm=svg.getScreenCTM();
  return [[35,35],[170,35],[170,130],[90,90]].map(([x,y])=>{const p=new DOMPoint(x,y).matrixTransform(ctm);return {x:p.x,y:p.y};});
 });
 await page.locator('#pencil-tool').click();await expect(page.locator('#pencil-tool')).toHaveAttribute('aria-pressed','true');
 await page.mouse.move(points[0].x,points[0].y);await page.mouse.down();
 await page.mouse.move(points[1].x,points[1].y);await page.mouse.move(points[2].x,points[2].y);
 await expect(page.locator('#marquee')).toBeHidden();await page.mouse.up();
 const first=await page.locator('.cell-hit.selected').count();expect(first).toBeGreaterThan(8);
 const middle=await page.evaluate(p=>document.elementFromPoint(p.x,p.y).closest('[data-cell]').classList.contains('selected'),points[3]);expect(middle).toBe(false);
 await page.keyboard.down('Meta');await page.mouse.click(points[3].x,points[3].y);await page.keyboard.up('Meta');
 expect(await page.locator('.cell-hit.selected').count()).toBeGreaterThan(first);
 await page.mouse.click(points[3].x,points[3].y);await expect(page.locator('.cell-hit.selected')).toHaveCount(1);
 await page.locator('#cursor-tool').click();await page.mouse.move(points[0].x,points[0].y);await page.mouse.down();await page.mouse.move(points[2].x,points[2].y);
 await expect(page.locator('#marquee')).toBeVisible();await page.mouse.up();
 expect(await page.locator('.cell-hit.selected').count()).toBeGreaterThan(first);
});
