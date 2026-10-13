import { build } from 'esbuild';
import { mkdir, copyFile, writeFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';

await mkdir('dist',{recursive:true});
for(const file of ['index.html','manifest.webmanifest','sw.js'])await copyFile(file,'dist/'+file);
await build({entryPoints:['app.js'],outfile:'dist/app.js',bundle:true,minify:true,format:'esm',platform:'browser',target:'es2020',logLevel:'info'});

function crc32(buffer){
 let crc=-1;
 for(const byte of buffer){crc ^= byte;for(let k=0;k<8;k++)crc=(crc>>>1)^((crc&1)?0xedb88320:0)}
 return (crc^-1)>>>0;
}
function chunk(type,data){
 const label=Buffer.from(type,'ascii');
 const size=Buffer.alloc(4);size.writeUInt32BE(data.length);
 const crc=Buffer.alloc(4);crc.writeUInt32BE(crc32(Buffer.concat([label,data])));
 return Buffer.concat([size,label,data,crc]);
}
function insideRounded(x,y,left,top,right,bottom,r){
 if(x<left||x>right||y<top||y>bottom)return false;
 const xx=Math.max(left+r,Math.min(x,right-r));
 const yy=Math.max(top+r,Math.min(y,bottom-r));
 return (x-xx)**2+(y-yy)**2 <= r*r;
}
function makeIcon(n,maskable=false){
 const data=Buffer.alloc((n*4+1)*n);
 const pad=n*(maskable?0.235:0.15),r=n*0.155;
 for(let y=0;y<n;y++){
  const row=y*(n*4+1);data[row]=0;
  for(let x=0;x<n;x++){
   const border=insideRounded(x,y,pad,pad,n-pad,n-pad,r) &&
       !insideRounded(x,y,pad+n*.019,pad+n*.019,n-pad-n*.019,n-pad-n*.019,r-n*.012);
   const xx=(x-n/2)/(n*(maskable?.14:.165)),yy=(y-n/2)/(n*(maskable?.197:.23));
   const insideOuter=xx*xx+yy*yy<=1;
   const ix=(x-n/2)/(n*(maskable?.095:.12)),iy=(y-n/2)/(n*(maskable?.15:.182));
   const letter=insideOuter&&(ix*ix+iy*iy>=1);
   const color=letter?[216,190,133,255]:border?[191,158,100,255]:[30,37,32,255];
   const offset=row+1+x*4;
   data[offset]=color[0];data[offset+1]=color[1];data[offset+2]=color[2];data[offset+3]=255;
  }
 }
 const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(n,0);ihdr.writeUInt32BE(n,4);ihdr[8]=8;ihdr[9]=6;
 const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(data,{level:9})),chunk('IEND',Buffer.alloc(0))]);
 return png;
}
for(const n of [180,192,512])await writeFile('dist/icon-'+n+'.png',makeIcon(n));
await writeFile('dist/icon-maskable-512.png',makeIcon(512,true));
