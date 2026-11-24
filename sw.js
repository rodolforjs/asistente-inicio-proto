/* Cuenta conmigo · avisos al celular (demo). Sin manejador de fetch: no toca la carga de las páginas. */
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
const wins=()=>self.clients.matchAll({type:'window',includeUncontrolled:true});
self.addEventListener('push',e=>{
  let m={}; try{ m=e.data?e.data.json():{}; }catch(_){ m={body:e.data&&e.data.text()}; }
  const o={body:m.body||'',icon:'assets/icon-192.png',badge:'assets/badge-96.png',tag:m.tag||'cc',renotify:true,vibrate:[180,90,180],timestamp:m.ts||Date.now(),data:m};
  if(m.img) o.image=m.img;
  e.waitUntil(Promise.all([
    self.registration.showNotification(m.title||'Cuenta conmigo',o),
    wins().then(cs=>cs.forEach(c=>c.postMessage({cc:m})))
  ]));
});
self.addEventListener('notificationclick',e=>{
  e.notification.close(); const m=e.notification.data||{};
  const url=new URL('celu.html#m='+encodeURIComponent(JSON.stringify(m)),self.registration.scope).href;
  e.waitUntil(wins().then(cs=>{ const c=cs.find(c=>/celu\.html/.test(c.url)); if(c){ c.postMessage({cc:m,open:true}); return c.focus(); } return self.clients.openWindow(url); }));
});
