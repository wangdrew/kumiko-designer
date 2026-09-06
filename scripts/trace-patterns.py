"""Trace screenshot linework into normalized vector contours; no runtime images needed."""
import struct,zlib,json,math
from pathlib import Path

def read_png(path):
 data=Path(path).read_bytes();pos=8;compressed=b''
 while pos<len(data):
  size=struct.unpack('>I',data[pos:pos+4])[0];typ=data[pos+4:pos+8];chunk=data[pos+8:pos+8+size];pos+=size+12
  if typ==b'IHDR':w,h,depth,color,*_=struct.unpack('>IIBBBBB',chunk)
  if typ==b'IDAT':compressed+=chunk
 assert depth==8 and color in (2,6),(depth,color)
 channels=3 if color==2 else 4;stride=w*channels;raw=zlib.decompress(compressed);rows=[];prev=bytearray(stride);off=0
 for y in range(h):
  filt=raw[off];row=bytearray(raw[off+1:off+1+stride]);off+=stride+1
  for x in range(stride):
   a=row[x-channels] if x>=channels else 0;b=prev[x];c=prev[x-channels] if x>=channels else 0
   if filt==1:v=a
   elif filt==2:v=b
   elif filt==3:v=(a+b)//2
   elif filt==4:
    p=a+b-c;pa,pb,pc=abs(p-a),abs(p-b),abs(p-c);v=a if pa<=pb and pa<=pc else b if pb<=pc else c
   else:v=0
   row[x]=(row[x]+v)&255
  rows.append(row);prev=row
 return w,h,channels,rows

def simplify(points,epsilon=.007):
 if len(points)<3:return points
 a,b=points[0],points[-1];dx,dy=b[0]-a[0],b[1]-a[1];den=dx*dx+dy*dy
 def distance(p):
  t=max(0,min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/den)) if den else 0
  return math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy)
 d,i=max((distance(p),i) for i,p in enumerate(points))
 if d<=epsilon:return [a,b]
 return simplify(points[:i+1],epsilon)[:-1]+simplify(points[i:],epsilon)

def trace(img,tri):
 w,h,c,rows=img;N=180;H=math.sqrt(3)/2;mask=set()
 for y in range(N):
  for x in range(N):
   u=(x+.5)/N;v=(y+.5)/N;b=v/H;a=u-b/2
   if min(a,b,1-a-b)<.016:continue
   px=tri[0][0]+a*(tri[1][0]-tri[0][0])+b*(tri[2][0]-tri[0][0]);py=tri[0][1]+a*(tri[1][1]-tri[0][1])+b*(tri[2][1]-tri[0][1]);ix,iy=int(px),int(py)
   r,g,bl=rows[iy][ix*c:ix*c+3]
   if r>135 and g>100 and bl>85 and r-g>8:mask.add((x,y))
 edges={}
 for x,y in mask:
  for neighbor,start,end in [((x,y-1),(x,y),(x+1,y)),((x+1,y),(x+1,y),(x+1,y+1)),((x,y+1),(x+1,y+1),(x,y+1)),((x-1,y),(x,y+1),(x,y))]:
   if neighbor not in mask:edges.setdefault(start,[]).append(end)
 contours=[]
 while edges:
  start=next(iter(edges));p=start;loop=[p]
  while True:
   opts=edges.get(p)
   if not opts:break
   q=opts.pop()
   if not opts:del edges[p]
   p=q
   if p==start:break
   loop.append(p)
  if len(loop)<4:continue
  area=abs(sum(a[0]*b[1]-a[1]*b[0] for a,b in zip(loop,loop[1:]+loop[:1])))/2
  if area<6:continue
  simple=[]
  for i,p in enumerate(loop):
   a,b=loop[i-1],loop[(i+1)%len(loop)]
   if (p[0]-a[0])*(b[1]-p[1])!=(p[1]-a[1])*(b[0]-p[0]):simple.append([round(p[0]/N,5),round(p[1]/N,5)])
  half=len(simple)//2
  contours.append(simplify(simple[:half+1])[:-1]+simplify(simple[half:]+simple[:1])[:-1])
 return contours

if __name__=='__main__':
 base=Path('/Users/andrewwang/Desktop');imgs=[read_png(base/f'Screenshot 2026-09-05 at {t}.png') for t in ['10.14.33\u202fPM','10.14.40\u202fPM','10.14.45\u202fPM']]
 out={}
 for id in range(1,40):
  if id in [10,11,12,13,16]:continue
  if id<=14:
   idx=0;col=(id-1)%7;row=(id-1)//7
   # Coordinates in the 2048px-wide reference preview. Use an interior triangle.
   left=[33,322,610,899,1187,1476,1764][col];top=[295,668][row]
   tri=[(left+65,top+78),(left+129,top+40),(left+129,top+116)]
  elif id<=35:
   idx=1;col=(id-15)%7;row=(id-15)//7
   left=[39,324,610,896,1182,1468,1753][col];top=[60,424,786][row]
   tri=[(left+64,top+78),(left+128,top+40),(left+128,top+116)]
  else:
   idx=2;col=id-36;left=[23,314,607,899,1191][col];top=56
   tri=[(left+65,top+78),(left+130,top+40),(left+130,top+116)]
  scale=imgs[idx][0]/2048
  out[str(id)]=trace(imgs[idx],[(x*scale,y*scale) for x,y in tri])
 Path('js/traced-patterns.js').write_text('/* Vector contours traced from the user-supplied numbered screenshots. */\nglobalThis.KumikoTraces='+json.dumps(out,separators=(',',':'))+';\n')
 print('Traced',len(out),'patterns;',sum(len(c) for cs in out.values() for c in cs),'vertices')
