#!/usr/bin/env node
/**
 * Valida data/tools.json antes de publicar.
 * Uso:  node scripts/validar.mjs
 *       node scripts/validar.mjs --arreglar-alt   (elimina referencias 'alt' inexistentes)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const ruta = join(raiz, 'data', 'tools.json');
const arreglarAlt = process.argv.includes('--arreglar-alt');

const PRECIOS = ['gratis', 'freemium', 'pago', 'oss'];
const PRIVS = ['local', 'no-entrena', 'opt-out', 'entrena'];
const PLATS = ['web', 'ios', 'android', 'win', 'mac', 'linux', 'ext', 'api', 'cli'];
const OBLIGATORIOS = [
  'id', 'nombre', 'empresa', 'url', 'desc', 'cat', 'precio', 'desde',
  'api', 'oss', 'es', 'priv', 'plat', 'nivel', 'usos', 'alt', 'score',
  'destacado', 'agregado',
];

const errores = [];
const avisos = [];
const err = (m) => errores.push(m);
const avi = (m) => avisos.push(m);

let db;
try {
  db = JSON.parse(readFileSync(ruta, 'utf8'));
} catch (e) {
  console.error(`\n  JSON invalido en data/tools.json\n   ${e.message}\n`);
  process.exit(1);
}

if (!db.meta?.actualizado) err('meta.actualizado es obligatorio (YYYY-MM-DD)');
if (!Array.isArray(db.categorias) || !db.categorias.length) err('categorias vacia');
if (!Array.isArray(db.herramientas) || !db.herramientas.length) err('herramientas vacia');

const cats = new Set((db.categorias || []).map((c) => c.id));
const ids = new Set();
const catsUsadas = new Set();

for (const [i, h] of (db.herramientas || []).entries()) {
  const donde = `herramientas[${i}] ${h.id || h.nombre || '(sin id)'}`;

  for (const campo of OBLIGATORIOS) {
    if (h[campo] === undefined) err(`${donde}: falta el campo "${campo}"`);
  }

  if (h.id) {
    if (ids.has(h.id)) err(`${donde}: id duplicado "${h.id}"`);
    ids.add(h.id);
    if (!/^[a-z0-9-]+$/.test(h.id)) err(`${donde}: el id solo admite minusculas, numeros y guiones`);
  }

  if (h.url && !/^https?:\/\//.test(h.url)) err(`${donde}: url debe empezar por http(s)://`);
  if (h.desc && h.desc.length > 240) avi(`${donde}: descripcion de ${h.desc.length} caracteres (recomendado <= 240)`);

  if (!PRECIOS.includes(h.precio)) err(`${donde}: precio "${h.precio}" no valido (${PRECIOS.join(' | ')})`);
  if (!PRIVS.includes(h.priv)) err(`${donde}: priv "${h.priv}" no valido (${PRIVS.join(' | ')})`);
  if (typeof h.desde !== 'number' || h.desde < 0) err(`${donde}: "desde" debe ser un numero >= 0`);
  if (!(h.es >= 1 && h.es <= 5)) err(`${donde}: "es" debe estar entre 1 y 5`);
  if (![1, 2, 3].includes(h.nivel)) err(`${donde}: "nivel" debe ser 1, 2 o 3`);
  if (!(h.score >= 0 && h.score <= 10)) err(`${donde}: "score" debe estar entre 0 y 10`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(h.agregado || '')) err(`${donde}: "agregado" debe tener formato YYYY-MM-DD`);

  if (h.precio === 'pago' && h.desde === 0) avi(`${donde}: marcada como "pago" pero desde = 0`);
  if ((h.precio === 'gratis' || h.precio === 'oss') && h.desde > 0) {
    avi(`${donde}: marcada como "${h.precio}" pero desde = ${h.desde}`);
  }
  if (h.precio === 'freemium' && !h.gratis) avi(`${donde}: freemium sin describir el campo "gratis"`);

  for (const c of h.cat || []) {
    if (!cats.has(c)) err(`${donde}: categoria desconocida "${c}"`);
    catsUsadas.add(c);
  }
  if (!(h.cat || []).length) err(`${donde}: necesita al menos una categoria`);

  for (const p of h.plat || []) {
    if (!PLATS.includes(p)) err(`${donde}: plataforma desconocida "${p}" (${PLATS.join(' | ')})`);
  }
}

// Las referencias cruzadas se comprueban al final, cuando ya conocemos todos los ids.
const altHuerfanas = [];
for (const h of db.herramientas || []) {
  for (const a of h.alt || []) {
    if (a === h.id) err(`${h.id}: se referencia a si misma en "alt"`);
    else if (!ids.has(a)) altHuerfanas.push([h, a]);
  }
}

if (altHuerfanas.length && arreglarAlt) {
  for (const [h, a] of altHuerfanas) h.alt = h.alt.filter((x) => x !== a);
  writeFileSync(ruta, JSON.stringify(db, null, 2) + '\n', 'utf8');
  console.log(`  Eliminadas ${altHuerfanas.length} referencias "alt" huerfanas y reescrito el archivo.`);
} else {
  for (const [h, a] of altHuerfanas) {
    err(`${h.id}: alternativa "${a}" no existe en el directorio (usa --arreglar-alt para limpiar)`);
  }
}

for (const c of cats) {
  if (!catsUsadas.has(c)) avi(`la categoria "${c}" no la usa ninguna herramienta`);
}

const total = db.herramientas.length;
const porPrecio = PRECIOS.map((p) => `${p}: ${db.herramientas.filter((h) => h.precio === p).length}`);

console.log('');
console.log(`  Directorio: ${total} herramientas en ${cats.size} categorias`);
console.log(`  Precio -> ${porPrecio.join('  |  ')}`);
console.log(`  Con plan gratuito: ${db.herramientas.filter((h) => h.precio !== 'pago').length}`);
console.log(`  Codigo abierto: ${db.herramientas.filter((h) => h.oss).length}`);
console.log(`  Actualizado: ${db.meta.actualizado}`);
console.log('');

if (avisos.length) {
  console.log(`  Avisos (${avisos.length}):`);
  for (const a of avisos) console.log(`   - ${a}`);
  console.log('');
}

if (errores.length) {
  console.error(`  ERRORES (${errores.length}):`);
  for (const e of errores) console.error(`   x ${e}`);
  console.error('');
  process.exit(1);
}

console.log('  Todo correcto. Listo para publicar.\n');
