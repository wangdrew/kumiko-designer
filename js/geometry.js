(function(root){
const C=root.KumikoCatalog, mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t), centroid=p=>[p.reduce((a,v)=>a+v[0],0)/p.length,p.reduce((a,v)=>a+v[1],0)/p.length];
function clip(poly,axis,bound,sign){const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],ai=sign*(a[axis]-bound)>=-1e-8,bi=sign*(b[axis]-bound)>=-1e-8;if(ai)out.push(a);if(ai!==bi)out.push(mix(a,b,(bound-a[axis])/(b[axis]-a[axis])));}return out;}
function area(p){return Math.abs(p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-a[1]*b[0];},0))/2;}
function board(config){const p=config.pitch,h=p*Math.sqrt(3)/2,w=config.columns*h,height=config.rows*p,phase=C.orientations.find(o=>o.id===config.orientation).phase,cells=[];
for(let x=0;x<config.columns;x++){const offset=((x+phase)%2)*p/2;for(let y=-1;y<=config.rows;y++){const yy=y*p+offset;const candidates=[[[x*h,yy],[x*h,yy+p],[(x+1)*h,yy+p/2]], [[(x+1)*h,yy-p/2],[(x+1)*h,yy+p/2],[x*h,yy]]];candidates.forEach((tri,k)=>{let poly=clip(clip(tri,1,0,1),1,height,-1);if(poly.length>=3&&area(poly)>1e-5)cells.push({id:`${x}:${y}:${k}`,triangle:tri,polygon:poly,center:centroid(poly)});});}}
return {width:w,height,cells,outerWidth:w+16,outerHeight:height+16};}
function paths(pattern,dimensions){if(dimensions&&root.KumikoStlPatterns?.[pattern.id])return root.KumikoInsertWidth.contours(pattern.id,dimensions.pitch,dimensions.mitsuke??C.defaults.mitsuke).map(points=>({points,closed:true,filled:true}));if(root.KumikoTraces?.[pattern.id])return root.KumikoTraces[pattern.id].map(points=>({points,closed:true,filled:true}));const A=[0,0],B=[1,0],D=[.5,Math.sqrt(3)/2],v=[A,B,D],O=centroid(v),out=[];const line=(...p)=>out.push({points:p});const ring=(points)=>line(...points,points[0]);const n=pattern.detail,f=pattern.family;
const spokes=()=>v.forEach(p=>line(p,O));
const leaf=(count)=>{spokes();v.forEach((p,i)=>{const a=v[(i+1)%3],b=v[(i+2)%3],mid=mix(a,b,.5);line(O,mid);for(let k=1;k<=count;k++){const t=.28+k*.12;line(p,mix(O,a,t),mid,mix(O,b,t),p);}});};
const star=(count)=>{for(let j=0;j<count;j++){const t=.22+j*.18;ring(v.map(p=>mix(O,p,t)));}v.forEach((p,i)=>{line(p,mix(v[(i+1)%3],v[(i+2)%3],.5));});};
if(f==='empty')return out;
if(f.startsWith('leaf')){leaf(n);if(f==='leaf-sprout')v.forEach(p=>{const q=mix(O,p,.24);line(mix(q,v[(v.indexOf(p)+1)%3],.1),q,mix(q,v[(v.indexOf(p)+2)%3],.1));});if(f==='leaf-flower'||f==='leaf-star')star(1);if(f==='leaf-weave')for(let k=1;k<=2;k++)ring(v.map(p=>mix(O,p,k*.2)));if(f==='leaf-hex'){const pts=[];v.forEach((p,i)=>pts.push(mix(O,p,.22),mix(O,mix(p,v[(i+1)%3],.5),.38)));ring(pts);}}
else if(f==='petal'){spokes();v.forEach((p,i)=>{const a=v[(i+1)%3];for(let k=1;k<=n;k++){out.push({points:[p,mix(O,mix(p,a,.5),k/(n+1)),a],curve:true});}});}
else if(f==='fan'){v.forEach((p,i)=>{for(let k=1;k<=n;k++)line(p,mix(v[(i+1)%3],v[(i+2)%3],k/(n+1)));});}
else if(f==='cross'){v.forEach((p,i)=>{for(let k=1;k<=n;k++)line(mix(p,v[(i+1)%3],.2*k),mix(v[(i+1)%3],v[(i+2)%3],.8-.2*(k-1)));});}
else if(f==='step'){spokes();for(let k=1;k<=n;k++){v.forEach((p,i)=>{const a=mix(p,v[(i+1)%3],.5),b=mix(p,v[(i+2)%3],.5),q=mix(p,O,.22+k*.19);line(a,mix(a,q,.5),q,mix(b,q,.5),b);});}}
else if(f==='weave'||f==='layered-weave'){if(f==='layered-weave')spokes();for(let k=1;k<=n;k++){v.forEach((p,i)=>{const t=.12+k*.12;line(mix(p,v[(i+1)%3],t),mix(v[(i+1)%3],v[(i+2)%3],t),mix(v[(i+2)%3],p,t));});}}
else if(f==='mesh'){for(let k=1;k<=n;k++)v.forEach((p,i)=>line(mix(p,v[(i+1)%3],k/(n+1)),mix(p,v[(i+2)%3],k/(n+1))));}
else if(f==='star')star(n);
else if(f==='pinwheel')v.forEach((p,i)=>line(p,mix(O,v[(i+1)%3],.5),v[(i+1)%3]));
else if(f==='outline'){for(let k=1;k<=n;k++)ring(v.map(p=>mix(O,p,1-k*.15)));spokes();}
else if(f==='hex'){v.forEach((p,i)=>line(p,mix(p,O,.45)));for(let k=1;k<=n;k++){const points=[];v.forEach((p,i)=>{points.push(mix(O,p,.55/k),mix(O,mix(p,v[(i+1)%3],.5),.9/k));});ring(points);}}
else if(f==='angular'){spokes();v.forEach((p,i)=>{line(p,mix(p,v[(i+1)%3],.5),mix(O,v[(i+1)%3],.35),mix(O,v[(i+2)%3],.35),mix(p,v[(i+2)%3],.5),p);});}
return out;}
function transform(p,tri){const a=p[0]-p[1]/Math.sqrt(3),b=p[1]*2/Math.sqrt(3);return [tri[0][0]+a*(tri[1][0]-tri[0][0])+b*(tri[2][0]-tri[0][0]),tri[0][1]+a*(tri[1][1]-tri[0][1])+b*(tri[2][1]-tri[0][1])];}
function insetTriangle(triangle, distance){const center=centroid(triangle),side=Math.hypot(triangle[1][0]-triangle[0][0],triangle[1][1]-triangle[0][1]),factor=1-distance/(side*Math.sqrt(3)/6);if(factor<=0)throw Error("Lattice leaves no insert space.");return triangle.map(p=>mix(center,p,factor));}
function pathData(pattern,tri,rotation=0,dimensions){const center=centroid(tri),angle=rotation*Math.PI/180,cos=Math.cos(angle),sin=Math.sin(angle);return paths(pattern,dimensions).map(p=>{const q=p.points.map(x=>{const point=transform(x,tri);if(!rotation)return point;const dx=point[0]-center[0],dy=point[1]-center[1];return [center[0]+dx*cos-dy*sin,center[1]+dx*sin+dy*cos];});return `M${q[0].join(',')} ${p.curve?'Q':''}${q.slice(1).map(x=>x.join(',')).join(p.curve?' ':' L')}${p.closed?' Z':''}`;}).join(' ');}
function validate(raw){if(!raw||raw.format!=='kumiko-studio'||raw.version!==1)throw Error('This is not a supported Kumiko Studio design (version 1).');const customColors=raw.customColors??[];
if(!Array.isArray(customColors)||customColors.length>256)throw Error('Custom colors must be a list of at most 256 colors.');
const customIds=new Set();
const validatedColors=customColors.map(color=>{
 if(!color||typeof color.id!=='string'||!/^custom-[a-zA-Z0-9-]{1,80}$/.test(color.id)||customIds.has(color.id)||typeof color.name!=='string'||!color.name.trim()||color.name.length>60||typeof color.hex!=='string'||!/^#[0-9a-f]{6}$/i.test(color.hex))throw Error('Invalid custom color: use a unique ID, name and six-digit hex code.');
 customIds.add(color.id);return {id:color.id,family:'custom',name:color.name.trim(),hex:color.hex.toUpperCase()};
});
const colors=[...C.colors,...validatedColors];const c=raw.config;if(!c||!C.orientations.some(o=>o.id===c.orientation))throw Error('Unknown orientation.');for(const k of ['columns','rows'])if(!Number.isInteger(c[k])||c[k]<1||c[k]>24)throw Error('Triangle counts must be whole numbers from 1 to 24.');if(typeof c.pitch!=='number'||!Number.isFinite(c.pitch)||c.pitch<15||c.pitch>150)throw Error('Pitch must be between 15 and 150 mm.');if(c.mitsuke!==undefined&&(typeof c.mitsuke!=='number'||!Number.isFinite(c.mitsuke)||c.mitsuke<.5||c.mitsuke>8))throw Error('Mitsuke must be between 0.5 and 8 mm.');for(const k of ['boardColor','emptyColor'])if(!/^#[0-9a-f]{6}$/i.test(c[k]))throw Error('Invalid panel color.');if(typeof raw.name!=='string'||raw.name.length>80)throw Error('Invalid design name.');if(!raw.inserts||Array.isArray(raw.inserts)||typeof raw.inserts!=='object')throw Error('Invalid inserts.');const ids=new Set(board(c).cells.map(x=>x.id)),inserts={};for(const [key,value] of Object.entries(raw.inserts)){if(!ids.has(key)||!value||!C.patterns.some(p=>p.id===value.patternId&&p.id!==0)||!colors.some(c=>c.id===value.colorId))throw Error('The design contains an unknown triangle, pattern, or filament color.');if(value.rotation!==undefined&&![0,120,240].includes(value.rotation))throw Error('Insert rotation must be 0, 120 or 240 degrees.');inserts[key]={patternId:value.patternId,colorId:value.colorId};if(value.rotation)inserts[key].rotation=value.rotation;}const favorites=[];if(raw.favorites!==undefined){if(!Array.isArray(raw.favorites)||raw.favorites.length>40*colors.length)throw Error('Invalid favorites list.');const seen=new Set();for(const f of raw.favorites){if(!f||!C.patterns.some(p=>p.id===f.patternId&&p.id!==0)||!colors.some(c=>c.id===f.colorId))throw Error('Unknown favorite design or color.');const key=f.patternId+'|'+f.colorId;if(seen.has(key))continue;seen.add(key);favorites.push({patternId:f.patternId,colorId:f.colorId});}}return {format:'kumiko-studio',version:1,name:raw.name,config:{orientation:c.orientation,columns:c.columns,rows:c.rows,pitch:c.pitch,...(c.mitsuke===undefined?{}:{mitsuke:c.mitsuke}),boardColor:c.boardColor,emptyColor:c.emptyColor},inserts,...(raw.favorites===undefined?{}:{favorites}),...(raw.customColors===undefined?{}:{customColors:validatedColors}),paletteColorId:colors.some(c=>c.id===raw.paletteColorId)?raw.paletteColorId:'matte-bone-white'};}
function partsList(design){
 const cells=new Map(board(design.config).cells.map(c=>[c.id,c])),groups=new Map();
 for(const [id,insert]of Object.entries(design.inserts)){
  if(!insert||insert.patternId===0||!cells.has(id))continue;
  const key=`${insert.patternId}|${insert.colorId}`;
  if(!groups.has(key))groups.set(key,{patternId:insert.patternId,colorId:insert.colorId,full:0,half:0,quantity:0});
  const row=groups.get(key),cell=cells.get(id);row.quantity++;
  if(area(cell.polygon)<area(cell.triangle)*.75)row.half++;else row.full++;
 }
 return [...groups.values()].sort((a,b)=>a.patternId-b.patternId||a.colorId.localeCompare(b.colorId));
}
root.KumikoGeometry={board,paths,pathData,validate,clip,area,partsList,insetTriangle};
})(typeof window==='undefined'?globalThis:window);
