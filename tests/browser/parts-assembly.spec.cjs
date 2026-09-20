const {test,expect}=require('@playwright/test');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
test('part IDs map every placed insert to its combination and filament counts aggregate designs',async({page})=>{
 await page.goto(pathToFileURL(path.resolve('index.html')).href);
 const fixture=await page.evaluate(()=>{
  const config={orientation:'side-corners',columns:6,rows:4,pitch:40,mitsuke:1,boardColor:'#BF9E82',emptyColor:'#EBEBE3'},cells=KumikoGeometry.board(config).cells;
  const half=cells.find(c=>KumikoGeometry.area(c.polygon)<KumikoGeometry.area(c.triangle)*.75);
  const full=cells.filter(c=>KumikoGeometry.area(c.polygon)>=KumikoGeometry.area(c.triangle)*.75).slice(0,3);
  const inserts={
   [half.id]:{patternId:1,colorId:'basic-blue'},
   [full[0].id]:{patternId:1,colorId:'custom-test'},
   [full[1].id]:{patternId:3,colorId:'basic-blue',rotation:120},
   [full[2].id]:{patternId:1,colorId:'basic-blue',rotation:240}
  };
  const design={format:'kumiko-studio',version:1,name:'Assembly test',config,inserts,paletteColorId:'basic-blue',customColors:[{id:'custom-test',name:'Test color',family:'custom',hex:'#123456'}]};
  return {design,rows:KumikoGeometry.partsList(design)};
 });
 await page.locator('#file').setInputFiles({name:'assembly.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixture.design))});
 await page.locator('#print-parts').click();
 await expect(page.locator('.parts-checklist tbody tr')).toHaveCount(3);
 expect(await page.locator('.parts-checklist tbody tr td:first-child').allTextContents()).toEqual(['1','2','3']);
 const thumbnails=page.locator('.parts-checklist .report-insert-preview');
 await expect(thumbnails).toHaveCount(3);
 for(let i=0;i<fixture.rows.length;i++){
  const color=fixture.rows[i].colorId==='custom-test'?'#123456':'#0A2989';
  const ink=thumbnails.nth(i).locator('path').last();
  expect(await ink.evaluate(path=>[path.getAttribute('fill'),path.getAttribute('stroke')])).toContain(color);
  expect(await ink.getAttribute('d')).toBeTruthy();
 }

 const map=await page.locator('.report-assembly-preview').evaluate(img=>{
  const svg=new DOMParser().parseFromString(decodeURIComponent(img.src.split(',')[1]),'image/svg+xml');
  return {labels:[...svg.querySelectorAll('text')].map(t=>({cell:t.dataset.cell,number:Number(t.textContent),x:Number(t.getAttribute('x')),y:Number(t.getAttribute('y'))})),paths:svg.querySelectorAll('path').length};
 });
 expect(map.paths).toBe(0);expect(map.labels).toHaveLength(4);
 for(const label of map.labels){const insert=fixture.design.inserts[label.cell];expect(label.number).toBe(fixture.rows.findIndex(r=>r.patternId===insert.patternId&&r.colorId===insert.colorId)+1);expect(Number.isFinite(label.x)&&Number.isFinite(label.y)).toBe(true);}
 const blue=page.locator('.filament-estimate [data-color-id="basic-blue"]');
 expect(await blue.locator('td').allTextContents()).toEqual(['BlueBambu PLA Basic','#0A2989','2','1','3']);
 const custom=page.locator('.filament-estimate [data-color-id="custom-test"]');
 expect((await custom.locator('td').allTextContents()).slice(1)).toEqual(['#123456','1','0','1']);
 await expect(page.locator('.filament-estimate tfoot td').last()).toHaveText('4');
 expect((await page.locator('.report-preview').boundingBox()).width).toBeGreaterThan(240);
 await page.emulateMedia({media:'print'});
 for(const selector of ['.report-preview','.report-assembly-preview','.parts-checklist','.filament-estimate'])await expect(page.locator(selector)).toBeVisible();
 await page.evaluate(()=>window.dispatchEvent(new Event('beforeprint')));
 // A4 is narrower than Letter; both use the report's 16mm page margins.
 const printableWidth=(210-32)*96/25.4;
 const bounds=await page.locator('#parts-report').evaluate(report=>({width:report.getBoundingClientRect().width,scroll:report.scrollWidth,client:report.clientWidth}));
 expect(bounds.width).toBeLessThanOrEqual(printableWidth+1);
 expect(bounds.scroll).toBeLessThanOrEqual(bounds.client);
 const tableBounds=await page.locator('.parts-checklist').boundingBox();
 expect(tableBounds.width).toBeLessThanOrEqual(printableWidth+1);

 expect(await page.locator('.parts-checklist tbody tr td:first-child').allTextContents()).toEqual(['1','2','3']);
});
