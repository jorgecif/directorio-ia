#!/usr/bin/env node
/**
 * Marca el catálogo como actualizado hoy y sube la versión de datos.
 * Ejecútalo justo antes de publicar una actualización.
 *
 * Uso:  node scripts/sellar.mjs            (fecha de hoy, versión +0.0.1)
 *       node scripts/sellar.mjs 2026-08-15 (fecha concreta)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ruta = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'tools.json');
const db = JSON.parse(readFileSync(ruta, 'utf8'));

const arg = process.argv[2];
if (arg && !/^\d{4}-\d{2}-\d{2}$/.test(arg)) {
  console.error('  La fecha debe tener el formato YYYY-MM-DD');
  process.exit(1);
}
const fecha = arg || new Date().toISOString().slice(0, 10);

const [ma, mi, pa] = String(db.meta.version || '1.0.0').split('.').map(Number);
const nueva = `${ma || 1}.${mi || 0}.${(pa || 0) + 1}`;

const antes = db.meta.actualizado;
db.meta.actualizado = fecha;
db.meta.version = nueva;

writeFileSync(ruta, JSON.stringify(db, null, 2) + '\n', 'utf8');

console.log(`\n  Catálogo sellado`);
console.log(`   fecha:   ${antes} -> ${fecha}`);
console.log(`   versión: ${nueva}`);
console.log(`   total:   ${db.herramientas.length} herramientas\n`);
console.log('  Recuerda ejecutar:  node scripts/validar.mjs\n');
