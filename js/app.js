(()=>{'use strict';
const C=KumikoCatalog,G=KumikoGeometry,$=id=>document.getElementById(id),NS='http://www.w3.org/2000/svg',KEY='kumiko-studio.design.v1';
const initial={format:'kumiko-studio',version:1,name:'Untitled panel',config:{orientation:'side-corners',columns:6,rows:4,pitch:40,mitsuke:C.defaults.mitsuke,boardColor:C.defaults.boardColor,emptyColor:C.defaults.emptyColor},inserts:{},paletteColorId:'matte-bone-white'};
let state=structuredClone(initial),selected=new Set(),past=[],future=[],geometry,activePattern=1,dragPattern=null,gesture=null,toastTimer,storageError=false,hoveredCell=null,rotationHideTimer,zoom=1,viewPan={x:0,y:0},spaceHeld=false,connectedCycle=null,connectedMode='',contextCell=null;
let colorFamily=null,customTarget='insert',selectionTool='cursor';
let insertClipboard=null;
let dragColor=null;
function appendFavoriteCard(parent,button,pattern,color){
 const card=document.createElement('div');card.className='pattern-card';card.append(button);parent.append(card);
 const number=button.querySelector('span:not(.glue-warning)');number.className='insert-number';number.textContent=String(pattern.id).padStart(2,'0');
 if(parent.id==='favorites'){const caption=document.createElement('span');caption.className='favorite-color';caption.textContent=color.name;button.append(caption);}
 if(pattern.requiresGlue&&!button.querySelector('.glue-warning')){const warning=document.createElement('span');warning.className='glue-warning';warning.textContent='!';warning.title='Requires glue to secure this insert in the frame.';warning.setAttribute('role','img');warning.setAttribute('aria-label',warning.title);button.append(warning);}
 if(!pattern.id)return;
 const active=(state.favorites||[]).some(f=>f.patternId===pattern.id&&f.colorId===color.id);
 const heart=document.createElement('button');heart.className='favorite-heart';heart.type='button';heart.textContent=active?'♥':'♡';
 heart.setAttribute('aria-pressed',active);heart.setAttribute('aria-label',`${active?'Remove':'Add'} favorite: ${pattern.name} · ${color.name}`);heart.title=heart.getAttribute('aria-label');
 heart.onclick=()=>change(()=>{const favorites=state.favorites??=[];const index=favorites.findIndex(f=>f.patternId===pattern.id&&f.colorId===color.id);if(index<0)favorites.push({patternId:pattern.id,colorId:color.id});else favorites.splice(index,1);});card.append(heart);
}
function renderFavorites(){
 $('favorites').replaceChildren();$('favorites-empty').hidden=!!state.favorites?.length;
 for(const favorite of state.favorites||[]){
  const pattern=C.patterns.find(p=>p.id===favorite.patternId),color=colors().find(c=>c.id===favorite.colorId),button=document.createElement('button');
  button.className='pattern';button.dataset.favoritePattern=pattern.id;button.dataset.colorId=color.id;button.draggable=true;
  button.title=`${pattern.name} · ${color.name} · ${color.hex}${pattern.requiresGlue?' · Requires glue':''}`;button.setAttribute('aria-label',`Apply favorite: ${button.title}`);
  button.append(preview(pattern,color.hex));const label=document.createElement('span');label.textContent=String(pattern.id).padStart(2,'0')+' · '+color.name;button.append(label);
  button.onclick=()=>{activePattern=pattern.id;if(selected.size)apply(pattern.id,null,color.id);else{change(()=>state.paletteColorId=color.id);colorFamily=null;renderPalette();}};
  button.addEventListener('dragstart',e=>{dragPattern=pattern.id;dragColor=color.id;hideRotation();e.dataTransfer.setData('application/x-kumiko-insert',String(pattern.id));e.dataTransfer.effectAllowed='copy';});
  button.addEventListener('dragend',()=>{dragPattern=null;dragColor=null;clearHover();});
  appendFavoriteCard($('favorites'),button,pattern,color);
 }
}
let changesSinceDownload=0;
const CHANGE_COUNT_KEY=KEY+'.changes-since-download';
const colors=()=>[...C.colors,...(state.customColors||[])];
const colorTooltip=document.createElement('div');colorTooltip.id='color-tooltip';colorTooltip.role='tooltip';colorTooltip.hidden=true;document.body.append(colorTooltip);
function hideColorTooltip(){colorTooltip.hidden=true;}
for(const event of ['pointerover','focusin'])document.addEventListener(event,e=>{
 const swatch=e.target.closest('.swatch');if(!swatch)return;
 // Mount in the popover when needed so the tooltip remains above the top layer.
 (swatch.closest('[popover]')||document.body).append(colorTooltip);
 colorTooltip.textContent=swatch.getAttribute('aria-label');colorTooltip.hidden=false;
 const r=swatch.getBoundingClientRect();
 colorTooltip.style.left=Math.max(8,Math.min(r.left,innerWidth-colorTooltip.offsetWidth-8))+'px';
 colorTooltip.style.top=Math.max(8,r.top-colorTooltip.offsetHeight-7)+'px';
});
for(const event of ['pointerout','focusout','pointerdown','scroll'])document.addEventListener(event,hideColorTooltip,true);
function toast(message){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),4000);}
try{const saved=localStorage.getItem(KEY);if(saved)state=G.validate(JSON.parse(saved));}catch(e){storageError=true;setTimeout(()=>toast('Local design could not be restored. '+e.message),0);}
try{const count=Number(localStorage.getItem(CHANGE_COUNT_KEY));if(Number.isSafeInteger(count)&&count>=0)changesSinceDownload=count;}catch{}
function renderSaveStatus(){
 $('save-state').textContent=`${changesSinceDownload} change${changesSinceDownload===1?'':'s'} since last download${storageError?' · Browser storage unavailable; download design to keep changes':''}`;
}
function persist(){try{localStorage.setItem(KEY,JSON.stringify(state));localStorage.setItem(CHANGE_COUNT_KEY,String(changesSinceDownload));storageError=false;}catch{storageError=true;}renderSaveStatus();}
function change(fn){const before=JSON.stringify(state);fn();if(JSON.stringify(state)===before)return;resetConnectedCycle();closeContextMenu();past.push(before);if(past.length>100)past.shift();future=[];changesSinceDownload++;persist();render();}
function history(redo){const from=redo?future:past,to=redo?past:future;if(!from.length)return;resetConnectedCycle();closeContextMenu();to.push(JSON.stringify(state));state=JSON.parse(from.pop());colorFamily=null;selected.clear();changesSinceDownload++;persist();render();}
function svgEl(tag,attrs={},parent){const el=document.createElementNS(NS,tag);for(const [k,v]of Object.entries(attrs))el.setAttribute(k,v);if(parent)parent.append(el);return el;}
const points=p=>p.map(v=>v.join(',')).join(' ');
function renderBoard(target=$('board'),exporting=false){geometry=G.board(state.config);const {width:w,height:h,cells,outerWidth:ow,outerHeight:oh}=geometry;target.replaceChildren();target.setAttribute('viewBox',`-12 -12 ${w+24} ${h+24}`);if(exporting){target.setAttribute('viewBox',`-8 -8 ${ow} ${oh}`);target.setAttribute('width',`${ow}mm`);target.setAttribute('height',`${oh}mm`);}
const defs=svgEl('defs',{},target);svgEl('clipPath',{id:'panel-clip'},defs).append(svgEl('rect',{x:0,y:0,width:w,height:h}));
if(!exporting)svgEl('rect',{width:w,height:h,fill:state.config.emptyColor},target);
const contents=svgEl('g',{'clip-path':'url(#panel-clip)'},target);
for(const cell of cells){const insert=state.inserts[cell.id];if(insert){const clip=svgEl('clipPath',{id:`cell-${cell.id.replaceAll(':','-')}`},defs);svgEl('polygon',{points:points(cell.polygon)},clip);svgEl('path',{d:G.pathData(C.patterns.find(p=>p.id===insert.patternId),KumikoStlPatterns[insert.patternId]?G.insetTriangle(cell.triangle,1.5):cell.triangle,insert.rotation||0,state.config),'data-insert':cell.id,fill:KumikoTraces[insert.patternId]?colors().find(c=>c.id===insert.colorId).hex:'none','fill-rule':'evenodd',stroke:KumikoTraces[insert.patternId]?'none':colors().find(c=>c.id===insert.colorId).hex,'stroke-width':1.2,'stroke-linejoin':'round','stroke-linecap':'round','clip-path':`url(#${clip.id})`},contents);}}
const lattice=svgEl('g',{fill:'none',stroke:state.config.boardColor,'stroke-width':3,'stroke-linejoin':'round'},contents);for(const cell of cells)svgEl('polygon',{points:points(cell.polygon)},lattice);
svgEl('path',{d:`M-8,-8 H${w+8} V${h+8} H-8 Z M0,0 V${h} H${w} V0 Z`,fill:state.config.boardColor,'fill-rule':'evenodd'},target);
if(!exporting){svgEl('rect',{x:-7,y:-7,width:w+14,height:h+14,fill:'none',stroke:'#fff','stroke-opacity':.15,'stroke-width':.5},target);for(const cell of cells){const hit=svgEl('polygon',{points:points(cell.polygon),fill:'transparent',class:'cell-hit','data-cell':cell.id,tabindex:0,role:'button','aria-label':`Triangle ${cell.id}${state.inserts[cell.id]?`, insert ${state.inserts[cell.id].patternId}`:', empty'}`},target);hit.addEventListener('keydown',e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();if(!e.ctrlKey&&!e.metaKey)selected.clear();selected.has(cell.id)?selected.delete(cell.id):selected.add(cell.id);updateSelection();showRotation(cell.id);}});}}
}
function updateSelection(){document.querySelectorAll('.cell-hit').forEach(el=>{el.classList.toggle('selected',selected.has(el.dataset.cell));el.setAttribute('aria-pressed',selected.has(el.dataset.cell));});updateRotationControls();$('selection-status').textContent=selected.size?`${selected.size} triangle${selected.size===1?'':'s'} selected${connectedMode?' · '+(connectedMode==='edges'?'shared edges':'edges + vertices'):''}`:'No triangles selected';$('deselect').disabled=!selected.size;$('clear').disabled=!selected.size;syncPaletteSelection();}
function syncPaletteSelection(){
 const insert=[...selected].map(id=>state.inserts[id]).find(Boolean);
 if(!insert)return;
 const color=colors().find(c=>c.id===insert.colorId);
 if(state.paletteColorId===color.id&&(colorFamily===null||colorFamily===color.family))return;
 state.paletteColorId=color.id;colorFamily=null;persist();renderPalette();
}
function setInsertColor(id){state.paletteColorId=id;for(const key of selected)if(state.inserts[key])state.inserts[key].colorId=id;}
function resetConnectedCycle(){connectedCycle=null;connectedMode='';}
function selectConnected(id,level){
 if(!geometry.cells.some(cell=>cell.id===id))return;
 connectedCycle={id,level};connectedMode=level===1?'edges':level===2?'vertices':'';
 selected=new Set(level?KumikoConnectedSelection.find(geometry.cells,state.inserts,id,connectedMode):[]);
 updateSelection();if(level)showRotation(id);else hideRotation();
}
function preview(pattern,color){const svg=svgEl('svg',{viewBox:'-0.06 -0.07 1.12 1.02','aria-hidden':true});svgEl('path',{d:'M0,0 L1,0 L.5,.866 Z',fill:'#efefe7',stroke:'#d5d9cd','stroke-width':.025},svg);if(pattern.id)svgEl('path',{d:G.pathData(pattern,[[0,0],[1,0],[.5,Math.sqrt(3)/2]],0,state.config),fill:KumikoTraces[pattern.id]?color:'none','fill-rule':'evenodd',stroke:KumikoTraces[pattern.id]?'none':color,'stroke-width':.022,'stroke-linejoin':'round','stroke-linecap':'round'},svg);else{svgEl('path',{d:'M.38,.29 L.62,.53 M.62,.29 L.38,.53',stroke:'#b1b6a9','stroke-width':.025},svg);}return svg;}
function renderPalette(){const color=colors().find(c=>c.id===state.paletteColorId);const family=colorFamily??color.family;$('filament-family').value=family;$('swatches').replaceChildren();for(const c of colors().filter(c=>c.family===family)){const b=document.createElement('button');b.className='swatch'+(c.id===color.id?' active':'');b.style.setProperty('--swatch',c.hex);b.title=`${c.name} · ${c.hex}`;b.setAttribute('aria-label',b.title);b.setAttribute('aria-pressed',c.id===color.id);b.onclick=()=>change(()=>setInsertColor(c.id));$('swatches').append(b);}$('color-chip').style.background=color.hex;$('color-name').textContent=color.name;$('color-hex').textContent=color.hex;
$('patterns').replaceChildren();for(const p of C.patterns){const b=document.createElement('button');b.className='pattern'+(p.id===activePattern?' active':'');b.draggable=true;b.dataset.pattern=p.id;b.title=`${p.id} · ${p.name}${p.requiresGlue?" · Requires glue to secure the insert in the frame.":""}`;b.setAttribute('aria-label',`Insert ${p.id}: ${p.name}. Drag to place or click to fill selection.`);b.append(preview(p,color.hex));const label=document.createElement('span');label.textContent=p.id===0?'0 · Empty':String(p.id).padStart(2,'0');b.append(label);if(p.requiresGlue){const warning=document.createElement('span');warning.className='glue-warning';warning.textContent='!';warning.title='Requires glue to secure this insert in the frame.';warning.setAttribute('role','img');warning.setAttribute('aria-label',warning.title);b.setAttribute('aria-description',warning.title);b.append(warning);}b.addEventListener('dragstart',e=>{dragPattern=p.id;hideRotation();e.dataTransfer.setData('application/x-kumiko-insert',String(p.id));e.dataTransfer.setData('text/plain',String(p.id));e.dataTransfer.effectAllowed='copy';});b.addEventListener('dragend',()=>{dragPattern=null;clearHover();});b.onclick=()=>{activePattern=p.id;if(selected.size)apply(p.id);else{renderPalette();toast('Select triangles or drag this insert onto the panel.');}};appendFavoriteCard($('patterns'),b,p,color); }renderFavorites();}
function render(){for(const key of ['name'])$(key).value=state[key];for(const key of ['columns','rows','pitch','mitsuke'])$(key).value=state.config[key]??C.defaults.mitsuke;$('board-color').value=state.config.boardColor;$('empty-color').value=state.config.emptyColor;renderPanelColors();$('canvas-title').textContent=state.name||'Untitled panel';document.querySelectorAll('.orientation').forEach(el=>{const active=el.dataset.orientation===state.config.orientation;el.classList.toggle('active',active);el.setAttribute('aria-pressed',active);});renderBoard();$('dimensions').textContent=`${geometry.outerWidth.toFixed(1)} × ${geometry.outerHeight.toFixed(1)} mm`;$('piece-count').textContent=`${Object.keys(state.inserts).length} inserts · ${geometry.cells.length} spaces`;$('undo').disabled=!past.length;$('redo').disabled=!future.length;const ids=new Set(geometry.cells.map(c=>c.id));selected=new Set([...selected].filter(id=>ids.has(id)));updateSelection();renderPalette();updateView();}
function apply(id,target,colorId=state.paletteColorId){const ids=selected.size?[...selected]:target?[target]:[];if(!ids.length)return;change(()=>{for(const key of ids){if(id===0)delete state.inserts[key];else state.inserts[key]={patternId:id,colorId};}});activePattern=id;renderPalette();}
for(const o of C.orientations){const b=document.createElement('button');b.className='orientation';b.dataset.orientation=o.id;const mini=G.board({columns:2,rows:3,pitch:20,orientation:o.id}),s=svgEl('svg',{viewBox:`-3 -3 ${mini.width+6} ${mini.height+6}`,'aria-hidden':true});svgEl('rect',{x:-2,y:-2,width:mini.width+4,height:mini.height+4,fill:'#f1eee3',stroke:'#b8c2a8','stroke-width':3},s);for(const cell of mini.cells)svgEl('polygon',{points:points(cell.polygon),fill:'none',stroke:'#879775','stroke-width':1},s);b.append(s,document.createTextNode(o.name));b.onclick=()=>change(()=>{state.config.orientation=o.id;const ids=new Set(G.board(state.config).cells.map(c=>c.id));for(const id of Object.keys(state.inserts))if(!ids.has(id))delete state.inserts[id];selected.clear();});$('orientations').append(b);}
$('name').addEventListener('change',e=>change(()=>state.name=e.target.value));for(const key of ['columns','rows','pitch'])$(key).addEventListener('change',e=>{const v=Number(e.target.value),valid=key==='pitch'?Number.isFinite(v)&&v>=15&&v<=150:Number.isInteger(v)&&v>=1&&v<=24;if(!valid){e.target.value=state.config[key];toast(key==='pitch'?'Choose a pitch from 15 to 150 mm.':'Choose a whole number from 1 to 24.');return;}change(()=>{state.config[key]=v;const ids=new Set(G.board(state.config).cells.map(c=>c.id));for(const id of Object.keys(state.inserts))if(!ids.has(id))delete state.inserts[id];selected.clear();});});for(const [id,key] of [['board-color','boardColor'],['empty-color','emptyColor']])$(id).addEventListener('change',e=>{const hex=e.target.value;if((state.customColors||[]).length>=256&&!colors().some(c=>c.hex.toLowerCase()===hex.toLowerCase())){render();toast('The design already has 256 custom colors.');return;}change(()=>{rememberCustom(hex);state.config[key]=hex;});});
$('mitsuke').addEventListener('change',e=>{const v=Number(e.target.value);if(!Number.isFinite(v)||v<.5||v>8){e.target.value=state.config.mitsuke??C.defaults.mitsuke;toast('Choose a Mitsuke width from 0.5 to 8 mm.');return;}change(()=>state.config.mitsuke=v);});
function rememberCustom(hex,name){
 const existing=colors().find(c=>c.hex.toLowerCase()===hex.toLowerCase());
 if(existing&&!name)return existing;
 if((state.customColors||[]).length>=256)throw Error('The design already has 256 custom colors.');
 const color={id:'custom-'+crypto.randomUUID(),family:'custom',name:name||'Custom '+hex.toUpperCase(),hex:hex.toUpperCase()};
 (state.customColors??=[]).push(color);return color;
}
let frameColorTarget='boardColor';
function renderPanelColors(){
 for(const [id,key]of [['board-filament','boardColor'],['empty-filament','emptyColor']]){
  const hex=state.config[key],color=colors().find(c=>c.hex.toLowerCase()===hex.toLowerCase());
  $(id).textContent=color?.name||hex;$(id).style.setProperty('--swatch',hex);
 }
 if($('frame-color-popover').matches(':popover-open'))renderFramePalette();
}
function renderFramePalette(){
 const hex=state.config[frameColorTarget],color=colors().find(c=>c.hex.toLowerCase()===hex.toLowerCase());
 $('frame-color-title').textContent=frameColorTarget==='boardColor'?'BOARD & LATTICE':'EMPTY SPACES';
 $('frame-swatches').replaceChildren();
 const customFallback=!color?[{id:'current-frame-color',name:'Current color',hex,family:'custom'}]:[];
 for(const c of [...colors(),...customFallback].filter(c=>c.family===$('frame-color-family').value)){
  const b=document.createElement('button');b.className='swatch'+(c.hex.toLowerCase()===hex.toLowerCase()?' active':'');b.style.setProperty('--swatch',c.hex);
  b.title=`${c.name} · ${c.hex}`;b.setAttribute('aria-label',b.title);b.setAttribute('aria-pressed',c.hex.toLowerCase()===hex.toLowerCase());
  b.onclick=()=>change(()=>state.config[frameColorTarget]=c.hex);$('frame-swatches').append(b);
 }
 $('frame-color-chip').style.background=hex;$('frame-color-name').textContent=color?.name||'Custom';$('frame-color-hex').textContent=hex;
}
for(const [id,key]of [['board-filament','boardColor'],['empty-filament','emptyColor']])$(id).addEventListener('click',()=>{
 frameColorTarget=key;const color=colors().find(c=>c.hex.toLowerCase()===state.config[key].toLowerCase());$('frame-color-family').value=color?.family||'custom';renderFramePalette();
 const r=$(id).getBoundingClientRect(),p=$('frame-color-popover');p.style.left=Math.max(8,Math.min(r.left,innerWidth-282))+'px';p.style.top=Math.max(8,Math.min(r.bottom+6,innerHeight-265))+'px';
});
$('frame-color-family').onchange=renderFramePalette;
$('frame-add-custom').onclick=()=>{$('frame-color-popover').hidePopover();openCustomColor(frameColorTarget);};
function openCustomColor(target='insert'){
 customTarget=target;$('custom-color-name').value='';$('custom-color-error').textContent='';
 $('custom-color-dialog').showModal();$('custom-color-name').focus();
}
$('add-custom-color').onclick=()=>openCustomColor();
$('cancel-custom-color').onclick=()=>$('custom-color-dialog').close();
$('custom-color-picker').oninput=e=>$('custom-color-hex').value=e.target.value.toUpperCase();
$('custom-color-hex').oninput=e=>{if(/^#[0-9a-f]{6}$/i.test(e.target.value))$('custom-color-picker').value=e.target.value;};
$('custom-color-form').onsubmit=e=>{
 e.preventDefault();const name=$('custom-color-name').value.trim(),hex=$('custom-color-hex').value;
 if(!name){$('custom-color-error').textContent='Enter a color name.';return;}
 if((state.customColors||[]).length>=256){$('custom-color-error').textContent='The design already has 256 custom colors.';return;}
 change(()=>{const c=rememberCustom(hex,name);if(customTarget==='insert'){setInsertColor(c.id);colorFamily='custom';}else state.config[customTarget]=c.hex;});
 $('custom-color-dialog').close();
};
$('filament-family').onchange=e=>{colorFamily=e.target.value;renderPalette();};
$('undo').onclick=()=>history(false);$('redo').onclick=()=>history(true);$('select-all').onclick=()=>{resetConnectedCycle();selected=new Set(geometry.cells.map(c=>c.id));updateSelection();};$('deselect').onclick=()=>{resetConnectedCycle();selected.clear();updateSelection();};$('clear').onclick=()=>apply(0);
const cellAt=(x,y)=>document.elementFromPoint(x,y)?.closest('[data-cell]')?.dataset.cell;
function clearHover(){document.querySelectorAll('.drop-target').forEach(el=>el.classList.remove('drop-target'));}
$('board').addEventListener('dragover',e=>{if(dragPattern===null)return;e.preventDefault();e.dataTransfer.dropEffect='copy';clearHover();const id=e.target.closest('[data-cell]')?.dataset.cell;if(id)document.querySelectorAll('.cell-hit').forEach(el=>el.classList.toggle('drop-target',selected.size?selected.has(el.dataset.cell):el.dataset.cell===id));});
$('board').addEventListener('dragleave',e=>{if(!$('board').contains(e.relatedTarget))clearHover();});$('board').addEventListener('drop',e=>{e.preventDefault();const id=e.target.closest('[data-cell]')?.dataset.cell;if(id&&dragPattern!==null)apply(dragPattern,id,dragColor??state.paletteColorId);clearHover();dragPattern=null;dragColor=null;});
function svgPoint(x,y){const p=new DOMPoint(x,y);return p.matrixTransform($('board').getScreenCTM().inverse());}
function intersects(poly,r){const inside=p=>p[0]>=r.x1&&p[0]<=r.x2&&p[1]>=r.y1&&p[1]<=r.y2;if(poly.some(inside))return true;let clipped=poly;for(const [axis,bound,sign]of [[0,r.x1,1],[0,r.x2,-1],[1,r.y1,1],[1,r.y2,-1]])clipped=G.clip(clipped,axis,bound,sign);return clipped.length>=3&&G.area(clipped)>1e-8;}
function hideRotation(){clearTimeout(rotationHideTimer);hoveredCell=null;$('rotation-controls').hidden=true;}
function updateRotationControls(){
 if(!hoveredCell||!selected.has(hoveredCell)||!state.inserts[hoveredCell]||gesture||dragPattern!==null||!$('insert-menu').hidden){$('rotation-controls').hidden=true;return;}
 const cell=geometry.cells.find(c=>c.id===hoveredCell);if(!cell){hideRotation();return;}
 const p=new DOMPoint(...cell.center).matrixTransform($('board').getScreenCTM()),bounds=$('canvas').getBoundingClientRect();
 if(p.x<bounds.left||p.x>bounds.right||p.y<bounds.top||p.y>bounds.bottom){$('rotation-controls').hidden=true;return;}
 const toolbar=$('rotation-controls');toolbar.hidden=false;
 const count=[...selected].filter(id=>state.inserts[id]).length;
 $('rotation-angle').textContent=count>1?`${count} inserts`:`${state.inserts[hoveredCell].rotation||0}°`;
 const targetBounds=[...$('board').querySelectorAll('[data-cell]')].find(el=>el.dataset.cell===hoveredCell).getBoundingClientRect();
 const top=targetBounds.top-bounds.top,bottom=targetBounds.bottom-bounds.top;
 const width=toolbar.offsetWidth,height=toolbar.offsetHeight,gap=28;
 toolbar.style.left=`${Math.max(4,Math.min(bounds.width-width-4,p.x-bounds.left-width/2))}px`;
 toolbar.style.top=`${top-height-gap>=4?top-height-gap:Math.min(bounds.height-height-4,bottom+gap)}px`;
 toolbar.setAttribute('aria-label',count>1?`Rotate ${count} selected inserts`:`Rotate insert ${state.inserts[hoveredCell].patternId} in triangle ${hoveredCell}`);
}
function showRotation(id){if(!selected.has(id)||!state.inserts[id])id=[...selected].find(key=>state.inserts[key]);if(!id){hideRotation();return;}hoveredCell=id;updateRotationControls();}
function rotateInsert(direction){
 const id=hoveredCell;if(!id||!state.inserts[id])return;
 rotateInserts([...selected],direction*120);
}
function rotateInserts(ids,degrees){change(()=>{for(const id of ids){const insert=state.inserts[id];if(!insert)continue;const angle=((insert.rotation||0)+degrees+360)%360;if(angle)insert.rotation=angle;else delete insert.rotation;}});}
function singleSelectedInsert(){return selected.size===1&&!!state.inserts[[...selected][0]];}
function canPasteInsert(){return selected.size>0&&!!insertClipboard&&(colors().some(c=>c.id===insertClipboard.color.id)||(state.customColors||[]).length<256);}
function copyInsert(){
 if(!singleSelectedInsert())return;
 const insert=state.inserts[[...selected][0]];
 insertClipboard=structuredClone({insert,color:colors().find(c=>c.id===insert.colorId)});
 closeContextMenu();toast('Insert copied.');
}
function pasteInsert(){
 if(!canPasteInsert())return;
 change(()=>{
  if(!colors().some(c=>c.id===insertClipboard.color.id))(state.customColors??=[]).push(structuredClone(insertClipboard.color));
  for(const id of selected)state.inserts[id]=structuredClone(insertClipboard.insert);
 });
 closeContextMenu();
}
function closeContextMenu(restoreFocus=false){
 const id=contextCell;contextCell=null;$('insert-menu').hidden=true;
 if(restoreFocus){const target=[...document.querySelectorAll('.cell-hit')].find(el=>el.dataset.cell===id)||$('board');target.focus({preventScroll:true});}
}
function openContextMenu(id,x,y){
 $('board').focus({preventScroll:true});
 if(!geometry.cells.some(cell=>cell.id===id))return;
 if(!selected.has(id)){resetConnectedCycle();selected=new Set([id]);updateSelection();}
 hideRotation();contextCell=id;
 const menu=$('insert-menu'),insert=state.inserts[id],hasInserts=[...selected].some(key=>state.inserts[key]);
 $('insert-menu-title').textContent=`${insert?'Insert '+insert.patternId:'Empty · design 0'} · ${selected.size} selected`;
 for(const button of menu.querySelectorAll('button'))button.disabled=['clear','rotate120','rotate240'].includes(button.dataset.menuAction)&&!hasInserts;
 const inserts=[...selected].map(key=>state.inserts[key]);
 const sameColor=!!insert&&inserts.every(value=>value?.colorId===insert.colorId);
 const sameDesign=!!insert&&inserts.every(value=>value?.patternId===insert.patternId);
 menu.querySelector('[data-menu-action="same-color"]').disabled=!sameColor;
 menu.querySelector('[data-menu-action="same-design"]').disabled=!sameDesign;
 menu.querySelector('[data-menu-action="same-design-color"]').disabled=!sameColor||!sameDesign;
 menu.querySelector('[data-menu-action="copy"]').disabled=!singleSelectedInsert();
 menu.querySelector('[data-menu-action="paste"]').disabled=!canPasteInsert();
 const clear=menu.querySelector('[data-menu-action="clear"]');clear.firstChild.textContent=selected.size>1?'Clear selected inserts':'Clear insert';
 menu.hidden=false;
 menu.style.left=`${Math.max(8,Math.min(x,window.innerWidth-menu.offsetWidth-8))}px`;
 menu.style.top=`${Math.max(8,Math.min(y,window.innerHeight-menu.offsetHeight-8))}px`;
 menu.querySelector('button:not(:disabled)').focus({preventScroll:true});
}
for(const button of $('insert-menu').querySelectorAll('button'))button.onclick=()=>{
 const id=contextCell,action=button.dataset.menuAction;if(!id)return;
 const targets=[...selected];closeContextMenu();
 if(action==='edges'||action==='vertices')selectConnected(id,action==='edges'?1:2);
 else if(action.startsWith('same-')){
  const insert=state.inserts[id];resetConnectedCycle();
  selected=new Set(Object.entries(state.inserts).filter(([,value])=>(action==='same-design'||value.colorId===insert.colorId)&&(action==='same-color'||value.patternId===insert.patternId)).map(([key])=>key));
  updateSelection();showRotation(id);
 }
 else if(action==='clear')apply(0);
 else if(action==='copy')copyInsert();
 else if(action==='paste')pasteInsert();
 else rotateInserts(targets,action==='rotate120'?120:240);
 $('board').focus({preventScroll:true});
};
$('insert-menu').addEventListener('keydown',e=>{
 const buttons=[...$('insert-menu').querySelectorAll('button:not(:disabled)')],index=buttons.indexOf(document.activeElement);
 if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){
  e.preventDefault();e.stopPropagation();
  const next=e.key==='Home'?0:e.key==='End'?buttons.length-1:(index+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length;
  buttons[next].focus();
 }else if(e.key==='Escape'||e.key==='Tab'){if(e.key==='Escape')e.preventDefault();e.stopPropagation();closeContextMenu(true);}
 else if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();e.stopPropagation();$('insert-menu').querySelector('[data-menu-action="clear"]').click();}
});
document.addEventListener('pointerdown',e=>{if(!$('insert-menu').hidden&&!$('insert-menu').contains(e.target))closeContextMenu();},true);
window.addEventListener('resize',()=>closeContextMenu());
document.addEventListener('scroll',e=>{if(!$('insert-menu').contains(e.target))closeContextMenu();},true);
$('canvas').addEventListener('contextmenu',e=>{
 const id=e.target.closest('[data-cell]')?.dataset.cell;
 if(!id)return;e.preventDefault();openContextMenu(id,e.clientX,e.clientY);
});
$('canvas').addEventListener('dblclick',e=>{
 if(e.button!==0||spaceHeld||selectionTool==='pencil'||e.target.closest('[data-canvas-control]'))return;
 const id=cellAt(e.clientX,e.clientY);if(!id)return;
 e.preventDefault();closeContextMenu();
 selectConnected(id,connectedCycle?.id===id?(connectedCycle.level+1)%3:1);
});
$('rotate-ccw').onclick=()=>rotateInsert(-1);$('rotate-cw').onclick=()=>rotateInsert(1);
$('rotation-controls').addEventListener('pointerenter',()=>clearTimeout(rotationHideTimer));
$('rotation-controls').addEventListener('focusin',()=>clearTimeout(rotationHideTimer));

$('board').addEventListener('keydown',e=>{if((e.key===' '||e.key==='Enter')&&e.target.closest('[data-cell]'))resetConnectedCycle();},true);
function updateView(){
 if(!geometry)return;
 const width=(geometry.width+24)/zoom,height=(geometry.height+24)/zoom;
 const limitX=Math.max(0,(geometry.width+24-width)/2),limitY=Math.max(0,(geometry.height+24-height)/2);
 viewPan.x=Math.max(-limitX,Math.min(limitX,viewPan.x));viewPan.y=Math.max(-limitY,Math.min(limitY,viewPan.y));
 $('board').setAttribute('viewBox',`${geometry.width/2+viewPan.x-width/2} ${geometry.height/2+viewPan.y-height/2} ${width} ${height}`);
 $('zoom-fit').textContent=`${Math.round(zoom*100)}%`;$('zoom-in').disabled=zoom>=4;$('zoom-out').disabled=zoom<=.5;
 updateRotationControls();
}
function setZoom(value){zoom=Math.max(.5,Math.min(4,value));updateView();}
$('zoom-in').onclick=()=>setZoom(zoom*1.25);$('zoom-out').onclick=()=>setZoom(zoom/1.25);
$('zoom-fit').onclick=()=>{viewPan={x:0,y:0};setZoom(1);};
new ResizeObserver(()=>updateRotationControls()).observe($('canvas'));
for(const tab of document.querySelectorAll('button[data-panel]'))tab.onclick=()=>{document.body.dataset.panel=tab.dataset.panel;document.querySelectorAll('button[data-panel]').forEach(b=>b.setAttribute('aria-pressed',b===tab));hideRotation();};
for(const tool of ['cursor','pencil'])$(tool+'-tool').onclick=()=>{
 selectionTool=tool;for(const name of ['cursor','pencil'])$(name+'-tool').setAttribute('aria-pressed',name===tool);
 $('canvas').classList.toggle('pencil-mode',tool==='pencil');hideRotation();
};
// Clip the drag segment against each convex triangle, so fast strokes skip no cells.
function segmentHits(poly,a,b){
 const signed=poly.reduce((sum,p,i)=>{const q=poly[(i+1)%poly.length];return sum+p[0]*q[1]-q[0]*p[1];},0),sign=Math.sign(signed);
 let low=0,high=1;
 for(let i=0;i<poly.length;i++){
  const p=poly[i],q=poly[(i+1)%poly.length];
  const cross=v=>sign*((q[0]-p[0])*(v.y-p[1])-(q[1]-p[1])*(v.x-p[0]));
  const start=cross(a),end=cross(b);
  if(start< -1e-7&&end< -1e-7)return false;
  if(start<0&&end>=0)low=Math.max(low,start/(start-end));
  else if(end<0&&start>=0)high=Math.min(high,start/(start-end));
  if(low>high+1e-9)return false;
 }
 return true;
}
function pencilSegment(g,x,y){
 const a=svgPoint(g.lastX,g.lastY),b=svgPoint(x,y);
 for(const cell of geometry.cells)if(segmentHits(cell.polygon,a,b))selected.add(cell.id);
 g.lastX=x;g.lastY=y;updateSelection();
}
$('canvas').addEventListener('pointerdown',e=>{
 if(e.target.closest('[data-canvas-control]')||(e.button!==0&&e.button!==1))return;
 e.preventDefault();hideRotation();$('board').focus({preventScroll:true});
 gesture={x:e.clientX,y:e.clientY,cell:cellAt(e.clientX,e.clientY),add:e.metaKey||e.ctrlKey,base:new Set(selected),moved:false,pointer:e.pointerId,mode:spaceHeld||e.button===1?'pan':selectionTool==='pencil'?'pencil':'select',lastX:e.clientX,lastY:e.clientY,panStart:{...viewPan},scale:$('board').getScreenCTM().inverse().a};
 if(gesture.mode==='pencil'){resetConnectedCycle();selected=gesture.add?new Set(gesture.base):new Set();pencilSegment(gesture,e.clientX,e.clientY);}
 $('canvas').classList.toggle('panning',gesture.mode==='pan');$('canvas').setPointerCapture(e.pointerId);
});
$('canvas').addEventListener('pointermove',e=>{
 if(!gesture)return;
 const g=gesture;
 if(g.mode==='pencil'){for(const sample of e.getCoalescedEvents?.()||[])pencilSegment(g,sample.clientX,sample.clientY);pencilSegment(g,e.clientX,e.clientY);return;}
 if(g.mode==='pan'){viewPan={x:g.panStart.x-(e.clientX-g.x)*g.scale,y:g.panStart.y-(e.clientY-g.y)*g.scale};updateView();return;}
 if(Math.hypot(e.clientX-g.x,e.clientY-g.y)>5){if(!g.moved)resetConnectedCycle();g.moved=true;}if(!g.moved)return;
 const bounds=$('canvas').getBoundingClientRect(),box=$('marquee');Object.assign(box.style,{display:'block',left:`${Math.min(g.x,e.clientX)-bounds.left}px`,top:`${Math.min(g.y,e.clientY)-bounds.top}px`,width:`${Math.abs(e.clientX-g.x)}px`,height:`${Math.abs(e.clientY-g.y)}px`});
 const a=svgPoint(g.x,g.y),b=svgPoint(e.clientX,e.clientY),rect={x1:Math.min(a.x,b.x),x2:Math.max(a.x,b.x),y1:Math.min(a.y,b.y),y2:Math.max(a.y,b.y)};
 selected=g.add?new Set(g.base):new Set();for(const cell of geometry.cells)if(intersects(cell.polygon,rect))selected.add(cell.id);updateSelection();
});

$('canvas').addEventListener('pointerup',e=>{
 if(!gesture)return;const g=gesture;if(g.mode==='pencil')pencilSegment(g,e.clientX,e.clientY);
 if(g.mode==='select'&&!g.moved){if(g.add||g.cell!==connectedCycle?.id)resetConnectedCycle();else connectedMode='';if(!g.add&&!selected.has(g.cell))selected.clear();if(g.cell){if(g.add&&selected.has(g.cell))selected.delete(g.cell);else selected.add(g.cell);}updateSelection();}
 gesture=null;$('marquee').style.display='none';$('canvas').classList.remove('panning');if(g.mode!=='pan')showRotation(g.cell);
});
$('canvas').addEventListener('pointercancel',()=>{if(gesture&&gesture.mode!=='pan')selected=gesture.base;gesture=null;$('marquee').style.display='none';$('canvas').classList.remove('panning');updateSelection();});
document.addEventListener('keydown',e=>{
 if(e.target.closest('input,select,textarea,[contenteditable="true"]')||$('parts-dialog').open||$('custom-color-dialog').open||$('new-design-dialog').open||$('frame-color-popover').matches(':popover-open'))return;
 const mod=e.metaKey||e.ctrlKey;
 if(mod&&!e.altKey&&!e.shiftKey&&['c','v'].includes(e.key.toLowerCase())){
  const copy=e.key.toLowerCase()==='c';
  if(copy?singleSelectedInsert():canPasteInsert()){e.preventDefault();copy?copyInsert():pasteInsert();}
  return;
 }
 if(!$('insert-menu').hidden)return;
 if(e.key==='ContextMenu'||(e.shiftKey&&e.key==='F10')){
  const id=e.target.closest('[data-cell]')?.dataset.cell||hoveredCell||(selected.size===1?[...selected][0]:null),cell=geometry.cells.find(c=>c.id===id);
  if(cell){e.preventDefault();const point=new DOMPoint(...cell.center).matrixTransform($('board').getScreenCTM());openContextMenu(id,point.x,point.y);}
 }
 else if(mod&&e.key.toLowerCase()==='z'){e.preventDefault();history(e.shiftKey);}
 else if(mod&&e.key.toLowerCase()==='y'){e.preventDefault();history(true);}
 else if(!mod&&!e.altKey&&['+','='].includes(e.key)){e.preventDefault();setZoom(zoom*1.25);}
 else if(!mod&&!e.altKey&&['-','_'].includes(e.key)){e.preventDefault();setZoom(zoom/1.25);}
 else if(!mod&&!e.altKey&&e.key==='0'){e.preventDefault();$('zoom-fit').click();}
 else if(e.code==='Space'&&(!e.target.closest('button,[data-cell]')||$('canvas').matches(':hover'))){e.preventDefault();spaceHeld=true;$('canvas').classList.add('pan-ready');}
 else if(mod&&e.key.toLowerCase()==='a'){e.preventDefault();$('select-all').click();}
 else if(e.key==='Escape'){resetConnectedCycle();$('deselect').click();hideRotation();}
 else if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();apply(0);}
});
document.addEventListener('keyup',e=>{if(e.code==='Space'){spaceHeld=false;$('canvas').classList.remove('pan-ready');}});
window.addEventListener('blur',()=>{spaceHeld=false;$('canvas').classList.remove('pan-ready');closeContextMenu();});

function download(data,type,extension){const url=URL.createObjectURL(new Blob([data],{type})),a=document.createElement('a');a.href=url;a.download=(state.name.trim().replace(/[^a-z0-9_-]+/gi,'-')||'kumiko-panel')+extension;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('new-design').onclick=()=>{$('new-design-dialog').showModal();$('cancel-new-design').focus();};
$('cancel-new-design').onclick=()=>$('new-design-dialog').close();
$('save-before-new').onclick=()=>$('save').click();
$('confirm-new-design').onclick=()=>{change(()=>{state=structuredClone(initial);colorFamily=null;selected.clear();activePattern=1;zoom=1;viewPan={x:0,y:0};hideRotation();});$('new-design-dialog').close();$('name').focus();};
$('save').onclick=()=>{download(JSON.stringify(state,null,2),'application/json','.kumiko.json');changesSinceDownload=0;persist();toast('Design downloaded.');};$('load').onclick=()=>$('file').click();$('file').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>2000000)throw Error('Design files must be smaller than 2 MB.');const loaded=G.validate(JSON.parse(await file.text()));change(()=>{state=loaded;colorFamily=null;selected.clear();});toast('Design loaded. Undo restores the previous panel.');}catch(err){toast('Could not load design. '+err.message);}finally{e.target.value='';}};
$('export-svg').onclick=()=>{const svg=svgEl('svg',{xmlns:NS});renderBoard(svg,true);download(new XMLSerializer().serializeToString(svg),'image/svg+xml','.svg');toast('SVG exported in millimeters. Convert strokes to paths in CAD.');};
function renderParts(){
 const report=$('parts-report');report.replaceChildren();
 function text(tag,value,parent=report){const el=document.createElement(tag);el.textContent=value;parent.append(el);return el;}
 text('p','KUMIKO STUDIO · PRINT CHECKLIST').className='eyebrow';
 text('h1',state.name||'Untitled panel');
 const rows=G.partsList(state).map((row,index)=>({...row,number:index+1})),total=rows.reduce((n,r)=>n+r.quantity,0),board=G.board(state.config);
 const numbers=new Map(rows.map(row=>[`${row.patternId}|${row.colorId}`,row.number]));
 function reportPreview(svg,title,className,description){
  const figure=document.createElement('figure');figure.className='report-figure';report.append(figure);
  text('figcaption',title,figure);
  const img=document.createElement('img');img.className=className;img.alt=description;
  img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(new XMLSerializer().serializeToString(svg));figure.append(img);
 }
 const previewSvg=svgEl('svg',{xmlns:NS});renderBoard(previewSvg,true);
 const background=svgEl('rect',{x:0,y:0,width:geometry.width,height:geometry.height,fill:state.config.emptyColor});previewSvg.prepend(background);
 reportPreview(previewSvg,'Color preview','report-preview',`Panel preview: ${state.name||'Untitled panel'}`);
 const assemblySvg=svgEl('svg',{xmlns:NS,viewBox:`-8 -8 ${board.outerWidth} ${board.outerHeight}`,width:board.outerWidth,height:board.outerHeight});
 svgEl('rect',{x:-6,y:-6,width:board.width+12,height:board.height+12,fill:'white',stroke:'#555','stroke-width':1},assemblySvg);
 for(const cell of board.cells){
  svgEl('polygon',{points:points(cell.polygon),fill:'white',stroke:'#777','stroke-width':.5},assemblySvg);
  const insert=state.inserts[cell.id],number=insert&&numbers.get(`${insert.patternId}|${insert.colorId}`);
  if(number){
   const label=svgEl('text',{x:cell.center[0],y:cell.center[1],'text-anchor':'middle','dominant-baseline':'central','font-family':'Arial, sans-serif','font-size':state.config.pitch*(String(number).length>2?.14:.19),'font-weight':600,fill:'#222','data-cell':cell.id},assemblySvg);
   label.textContent=number;
  }
 }
 reportPreview(assemblySvg,'Assembly preview','report-assembly-preview','Assembly map: numbered inserts match the part IDs in the checklist. Empty spaces are blank.');
 text('p','Assembly numbers refer to part IDs below. Empty spaces are blank.').className='report-note';
 text('p',`${board.outerWidth.toFixed(1)} × ${board.outerHeight.toFixed(1)} mm · Jigumi pitch ${state.config.pitch} mm · Mitsuke ${state.config.mitsuke??C.defaults.mitsuke} mm · ${C.orientations.find(o=>o.id===state.config.orientation).name}`);
 text('p',`${total} inserts · ${rows.length} design/color combinations · Board ${state.config.boardColor}`);
 if(!rows.length){text('p','No inserts placed yet. Empty spaces are omitted from this list.');return;}
 text('h2','Parts checklist');
 const table=document.createElement('table');table.className='parts-checklist';report.append(table);const head=table.createTHead().insertRow();
 for(const title of ['Part ID','Design','Filament color','Hex','Full','Half','Total']){const th=document.createElement('th');th.scope='col';th.textContent=title;head.append(th);}
 const body=table.createTBody();for(const item of rows){const row=body.insertRow(),color=colors().find(c=>c.id===item.colorId);
  row.dataset.partId=item.number;text('td',String(item.number),row);
  const design=row.insertCell();text('strong',`#${item.patternId}`,design);const pattern=C.patterns.find(p=>p.id===item.patternId);text('small',pattern.name,design);if(pattern.requiresGlue)text('small','! Requires glue',design);
  const colorCell=row.insertCell(),swatch=text('i','',colorCell);swatch.className='report-swatch';swatch.style.background=color.hex;
  text('span',color.name,colorCell);text('small',color.family==='custom'?'Custom':`Bambu PLA ${color.family==='matte'?'Matte':'Basic'}`,colorCell);
  for(const value of [color.hex,item.full,item.half,item.quantity])text('td',String(value),row);
 }
 const foot=table.createTFoot().insertRow(),label=foot.insertCell();label.colSpan=4;label.textContent='Total inserts';for(const key of ['full','half','quantity'])text('td',String(rows.reduce((n,r)=>n+r[key],0)),foot);
 text('p','Full = complete triangular insert. Half = a clipped insert along the panel edge. Quantities count individual pieces, not full triangles to cut. Empty spaces are excluded.').className='report-note';
 text('h2','Filament use estimate');
 text('p','Piece counts by filament color across all designs. Full and half pieces each count as one piece; this is not a weight or length estimate.').className='report-note';
 const byColor=new Map();for(const item of rows){
  if(!byColor.has(item.colorId))byColor.set(item.colorId,{color:colors().find(c=>c.id===item.colorId),full:0,half:0,quantity:0});
  const group=byColor.get(item.colorId);for(const key of ['full','half','quantity'])group[key]+=item[key];
 }
 const filamentTable=document.createElement('table');filamentTable.className='filament-estimate';report.append(filamentTable);
 const filamentHead=filamentTable.createTHead().insertRow();
 for(const title of ['Filament color','Hex','Full','Half','Total pieces']){const th=text('th',title,filamentHead);th.scope='col';}
 const filamentBody=filamentTable.createTBody();
 for(const item of [...byColor.values()].sort((a,b)=>a.color.name.localeCompare(b.color.name)||a.color.id.localeCompare(b.color.id))){
  const row=filamentBody.insertRow();row.dataset.colorId=item.color.id;
  const colorCell=row.insertCell(),swatch=text('i','',colorCell);swatch.className='report-swatch';swatch.style.background=item.color.hex;
  text('span',item.color.name,colorCell);text('small',item.color.family==='custom'?'Custom':`Bambu PLA ${item.color.family==='matte'?'Matte':'Basic'}`,colorCell);
  for(const value of [item.color.hex,item.full,item.half,item.quantity])text('td',String(value),row);
 }
 const filamentFoot=filamentTable.createTFoot().insertRow(),filamentLabel=filamentFoot.insertCell();filamentLabel.colSpan=2;filamentLabel.textContent='Total pieces';
 for(const key of ['full','half','quantity'])text('td',String(rows.reduce((n,r)=>n+r[key],0)),filamentFoot);
}
$('print-parts').onclick=()=>{renderParts();$('parts-dialog').showModal();};
$('close-parts').onclick=()=>$('parts-dialog').close();
$('print-sheet').onclick=()=>window.print();
window.addEventListener('beforeprint',renderParts);
render();renderSaveStatus();
})();
