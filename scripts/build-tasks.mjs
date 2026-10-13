import { spawnSync } from 'node:child_process'
import { cp, readFile, writeFile, mkdir, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = resolve(root, 'optimus-tasks')
const result = spawnSync(process.execPath, ['build.mjs'], { cwd: source, stdio: 'inherit' })
if (result.status !== 0) process.exit(result.status || 1)

const destination = resolve(root, 'public/tasks')
await rm(destination, { recursive: true, force: true })
await mkdir(destination, { recursive: true })
await cp(resolve(source, 'dist'), destination, { recursive: true })

const indexPath = resolve(destination, 'index.html')
let html = await readFile(indexPath, 'utf8')
html = html.replaceAll('href="/manifest.webmanifest"', 'href="/tasks/manifest.webmanifest"')
  .replaceAll('href="/icon-', 'href="/tasks/icon-')
  .replaceAll('src="/app.js', 'src="/tasks/app.js')
await writeFile(indexPath, html)

const manifestPath = resolve(destination, 'manifest.webmanifest')
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
manifest.id = '/tasks/'
manifest.start_url = '/tasks/index.html'
manifest.scope = '/tasks/'
manifest.icons = manifest.icons.map(icon => ({ ...icon, src: '/tasks' + icon.src }))
await writeFile(manifestPath, JSON.stringify(manifest, null, 2))

const workerPath = resolve(destination, 'sw.js')
let worker = await readFile(workerPath, 'utf8')
worker = worker.replaceAll("'/', '/app.js', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/icon-maskable-512.png'", "'/tasks/index.html', '/tasks/app.js', '/tasks/manifest.webmanifest', '/tasks/icon-192.png', '/tasks/icon-512.png', '/tasks/icon-maskable-512.png'")
worker = worker.replaceAll("url.pathname==='/' || url.pathname==='/app.js' || url.pathname==='/manifest.webmanifest' || url.pathname.startsWith('/icon-')", "url.pathname.startsWith('/tasks/')")
worker = worker.replaceAll("await caches.match('/')", "await caches.match('/tasks/index.html')")
worker = worker.replaceAll('optimus-shell-20261013-1', 'optimus-unified-20261013-2')
await writeFile(workerPath, worker)

console.log('Optimus Tasks built into the same Next.js deployment at /tasks')
