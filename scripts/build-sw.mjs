import { readdir, writeFile, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const files = await readdir("dist", { recursive: true });
const assets = files
  .filter((f) => f === "index.html" || f.startsWith("assets/"))
  .map((f) => "/" + f);
const hash = createHash("sha256")
  .update(await readFile("dist/index.html"))
  .digest("hex")
  .slice(0, 16);
await writeFile(
  "dist/sw.js",
  `const CACHE='applyflow-${hash}';const ASSETS=${JSON.stringify(assets)};
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('applyflow-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{if(event.request.method!=='GET'||new URL(event.request.url).origin!==location.origin)return;event.respondWith(caches.match(event.request,{ignoreVary:true}).then(cached=>cached||fetch(event.request).catch(()=>event.request.mode==='navigate'?caches.match('/index.html'):Response.error())));});`,
);
