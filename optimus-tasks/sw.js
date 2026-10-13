const CACHE = 'optimus-shell-20261013-1';
const SHELL = ['/', '/app.js', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/icon-maskable-512.png'];
self.addEventListener('install', e => {
 e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', e => {
 e.waitUntil(caches.keys().then(names=>Promise.all(names.filter(n=>n!==CACHE).map(n=>caches.delete(n)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',e=>{
 const request=e.request;
 if(request.method!=='GET')return;
 const url=new URL(request.url);
 if(url.origin!==self.location.origin)return;
 if(url.pathname.startsWith('/api/'))return;
 const isAsset= url.pathname==='/' || url.pathname==='/app.js' || url.pathname==='/manifest.webmanifest' || url.pathname.startsWith('/icon-');
 if(!isAsset && request.mode!=='navigate')return;
 e.respondWith((async()=>{
  try{
   const response=await fetch(request);
   if(response.ok && isAsset) {
    const cache=await caches.open(CACHE);
    await cache.put(request,response.clone());
   }
   return response;
  }catch{
   return (await caches.match(request,{ignoreSearch:true}))||(request.mode==='navigate'?await caches.match('/'):Response.error());
  }
 })());
});
