const {test,expect}=require('@playwright/test');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
test('Mount Diablo example loads with requested dimensions, colors and glue-free inserts',async({page})=>{
  await page.goto(pathToFileURL(path.resolve('index.html')).href);
  await page.locator('#file').setInputFiles(path.resolve('examples/mount-diablo.kumiko.json'));
  await expect(page.locator('#canvas-title')).toHaveText('Mount Diablo · Cocoa & Latte');
  await expect(page.locator('#columns')).toHaveValue('20');
  await expect(page.locator('#rows')).toHaveValue('11');
  await expect(page.locator('#pitch')).toHaveValue('40');
  await expect(page.locator('#mitsuke')).toHaveValue('2');
  await expect(page.locator('#board [data-insert]')).toHaveCount(292);
  const stats=await page.evaluate(()=>{
    const s=JSON.parse(localStorage.getItem('kumiko-studio.design.v1'));
    return {colors:[...new Set(Object.values(s.inserts).map(i=>i.colorId))].sort(),
      glue:Object.values(s.inserts).some(i=>KumikoCatalog.patterns.find(p=>p.id===i.patternId).requiresGlue)};
  });
  expect(stats.colors).toEqual(['basic-cocoa-brown','matte-latte-brown']);
  expect(stats.glue).toBe(false);
  await page.mouse.move(0,0);
  await page.locator('#board').screenshot({path:'examples/mount-diablo-preview.png'});
});
