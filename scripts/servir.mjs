#!/usr/bin/env node
/**
 * Servidor estático mínimo, sin dependencias, para ver el directorio en local.
 * Uso:  node scripts/servir.mjs [puerto]
 */
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize, extname } from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const puerto = Number(process.argv[2]) || 4321;

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  let rel = normalize(url).replace(/^([/\\.])+/, '');
  if (rel === '' || rel.endsWith('/')) rel = join(rel, 'index.html');

  const archivo = join(raiz, rel);

  // No servir nada fuera de la carpeta del proyecto.
  if (!archivo.startsWith(raiz)) {
    res.writeHead(403).end('403');
    return;
  }
  if (!existsSync(archivo) || !statSync(archivo).isFile()) {
    res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' })
      .end('<h1>404</h1><p>No encontrado: ' + rel + '</p>');
    return;
  }

  res.writeHead(200, {
    'content-type': TIPOS[extname(archivo).toLowerCase()] || 'application/octet-stream',
    'cache-control': 'no-cache',
  });
  createReadStream(archivo).pipe(res);
}).listen(puerto, () => {
  console.log(`\n  Directorio IA en  http://localhost:${puerto}\n  Ctrl+C para parar\n`);
});
