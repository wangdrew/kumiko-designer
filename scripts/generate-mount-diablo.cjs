// Reproducible, abstract landscape using only the existing insert catalog.
const fs = require('node:fs');
const path = require('node:path');
require('../js/catalog.js');
require('../js/stl-patterns.js');
require('../js/insert-width.js');
require('../js/geometry.js');
const C = KumikoCatalog, G = KumikoGeometry;
const design = {
  format: 'kumiko-studio', version: 1, name: 'Mount Diablo · Cocoa & Latte',
  config: { orientation: 'side-corners', columns: 20, rows: 11, pitch: 40,
    mitsuke: 2, boardColor: '#BF9E82', emptyColor: '#EBEBE3' },
  inserts: {}, paletteColorId: 'basic-cocoa-brown'
};
const board = G.board(design.config);
// A broad main summit and smaller shoulder, descending into rolling terrain.
const skyline = [[0,.49],[.09,.45],[.17,.49],[.26,.39],[.34,.42],
  [.43,.31],[.56,.16],[.62,.24],[.68,.21],[.77,.36],[.86,.42],[.94,.39],[1,.47]];
function interpolate(points,x) {
  const i = points.findIndex(p=>p[0]>=x);
  if(i<=0)return points[0][1];
  const a=points[i-1],b=points[i];
  return a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]);
}
for (const cell of board.cells) {
  const x=cell.center[0]/board.width,y=cell.center[1]/board.height;
  const horizon=interpolate(skyline,x);
  if(y<horizon)continue; // Omitted entries are empty design 0.
  const middle=.60+.075*Math.sin(x*2*Math.PI+.55);
  const foreground=.82+.065*Math.sin(x*2.5*Math.PI-1.1);
  let patternId,colorId;
  if(y<middle){
    // Light comes from the left; a diagonal shadow descends from the summit.
    const shadow=x>.56+(y-.16)*.21;
    const depth=(y-horizon)/Math.max(.08,middle-horizon);
    colorId=shadow?'basic-cocoa-brown':'matte-latte-brown';
    patternId=shadow?(depth<.38?3:4):(depth<.35?1:3);
  }else if(y<foreground){
    // The middle ridge is pale along its crest and darkens into its valley.
    const depth=(y-middle)/(foreground-middle);
    colorId=depth<.60?'matte-latte-brown':'basic-cocoa-brown';
    patternId=depth<.28?1:depth<.70?3:4;
  }else{
    colorId='basic-cocoa-brown';
    patternId=y-foreground<.055?4:7;
  }
  design.inserts[cell.id]={patternId,colorId};
}
G.validate(design);
for(const insert of Object.values(design.inserts)) {
  if(C.patterns.find(p=>p.id===insert.patternId).requiresGlue)throw Error('Glue insert');
}
const occupancy=Object.keys(design.inserts).length/board.cells.length;
if(occupancy<.5||occupancy>.8)throw Error('Occupancy outside requested range');
const out=path.resolve(__dirname,'../examples');fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(out,'mount-diablo.kumiko.json'),JSON.stringify(design,null,2)+'\n');
const pts=poly=>poly.map(p=>p.join(',')).join(' ');
const svg=[`<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -8 ${board.outerWidth} ${board.outerHeight}" width="${board.outerWidth}mm" height="${board.outerHeight}mm">`,
  '<title>Mount Diablo · Cocoa &amp; Latte</title>',
  `<rect x="-8" y="-8" width="${board.outerWidth}" height="${board.outerHeight}" fill="${design.config.boardColor}"/>`,
  `<rect width="${board.width}" height="${board.height}" fill="${design.config.emptyColor}"/>`];
for(const cell of board.cells){
  const insert=design.inserts[cell.id];if(!insert)continue;
  const id='c'+cell.id.replaceAll(':','-');
  svg.push(`<clipPath id="${id}"><polygon points="${pts(cell.polygon)}"/></clipPath>`,
    `<path d="${G.pathData(C.patterns.find(p=>p.id===insert.patternId),G.insetTriangle(cell.triangle,1.5),0,design.config)}" fill="${C.colors.find(c=>c.id===insert.colorId).hex}" fill-rule="evenodd" clip-path="url(#${id})"/>`);
}
svg.push(`<g fill="none" stroke="${design.config.boardColor}" stroke-width="3" stroke-linejoin="round">`);
for(const cell of board.cells)svg.push(`<polygon points="${pts(cell.polygon)}"/>`);
svg.push('</g></svg>');
fs.writeFileSync(path.join(out,'mount-diablo-preview.svg'),svg.join('\n'));
console.log(JSON.stringify({filled:Object.keys(design.inserts).length,total:board.cells.length,occupancy,dimensions:[board.outerWidth,board.outerHeight],parts:G.partsList(design)},null,2));
