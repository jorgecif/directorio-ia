/* ============================================================
   Directorio IA — lógica de la aplicación
   Sin dependencias, sin build. Vanilla JS.
   ============================================================ */
'use strict';

/* ---------- Constantes y etiquetas ---------- */

const ETIQ_PRECIO = { gratis: 'Gratis', freemium: 'Freemium', pago: 'De pago', oss: 'Código abierto' };
const ETIQ_PRIV = {
  local: 'Se ejecuta en tu equipo',
  'no-entrena': 'No entrena con tus datos',
  'opt-out': 'Entrena salvo que lo desactives',
  entrena: 'Entrena con tus datos',
};
const PRIV_ICONO = { local: '🔒', 'no-entrena': '🛡️', 'opt-out': '⚙️', entrena: '⚠️' };
const ETIQ_PLAT = {
  web: 'Web', ios: 'iOS', android: 'Android', win: 'Windows', mac: 'macOS',
  linux: 'Linux', ext: 'Extensión', api: 'API', cli: 'Terminal',
};
const ETIQ_NIVEL = { 1: 'Principiante', 2: 'Intermedio', 3: 'Avanzado' };
const DIAS_NOVEDAD = 45;

const LS = {
  tema: 'dir-ia:tema',
  fav: 'dir-ia:favoritos',
  stack: 'dir-ia:stack',
  presu: 'dir-ia:presupuesto',
  vista: 'dir-ia:vista',
};

/* ---------- Estado ---------- */

let DB = { meta: {}, categorias: [], herramientas: [] };
let PORID = new Map();
let CATNOM = new Map();
let CATEMOJI = new Map();
let LIMITE_NOVEDAD = 0;

const F = {
  q: '',
  cat: new Set(),
  precio: new Set(),
  priv: new Set(),
  plat: new Set(),
  nivel: new Set(),
  es: 0,
  max: null,
  api: false,
  oss: false,
  conGratis: false,
  nuevas: false,
  favs: false,
};

let orden = 'destacados';
let vista = leer(LS.vista, 'grid');
let favoritos = new Set(leer(LS.fav, []));
let stack = new Set(leer(LS.stack, []));
let presupuesto = leer(LS.presu, 60);
let comparador = [];
let resultados = [];
let hashInicial = '';

/* ---------- Utilidades ---------- */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

function leer(clave, porDefecto) {
  try {
    const v = localStorage.getItem(clave);
    return v === null ? porDefecto : JSON.parse(v);
  } catch { return porDefecto; }
}
function guardar(clave, valor) {
  try { localStorage.setItem(clave, JSON.stringify(valor)); } catch { /* modo privado */ }
}

const norm = (s) => String(s || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '');

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Formatea dinero sin arrastrar el ruido de la coma flotante: 1043.8799999 -> 1043.88 */
const dinero = (n) => {
  const r = Math.round(Number(n) * 100) / 100;
  return Number.isInteger(r) ? String(r) : r.toFixed(2);
};

const plural = (n, singular, plural_) => `${n} ${n === 1 ? singular : plural_}`;

function hue(id) {
  let h = 0;
  for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

function logoHTML(h, clase = 'logo') {
  const t = hue(h.id);
  const ini = (h.nombre.match(/[a-z0-9]/i) || ['?'])[0].toUpperCase();
  const bg = `linear-gradient(135deg, hsl(${t} 68% 52%), hsl(${(t + 40) % 360} 70% 44%))`;
  return `<span class="${clase}" style="background:${bg}" aria-hidden="true">${esc(ini)}</span>`;
}

function precioTexto(h) {
  if (h.precio === 'oss') return 'Libre <small>· autoalojable</small>';
  if (h.precio === 'gratis') return 'Gratis';
  if (h.desde === 0) return 'Gratis <small>· pago por uso</small>';
  return `$${dinero(h.desde)}<small>/mes</small>`;
}

function esNueva(h) {
  return Date.parse(h.agregado) >= LIMITE_NOVEDAD;
}
function tieneGratis(h) {
  return h.precio !== 'pago' || !!h.gratis;
}
const catNom = (c) => CATNOM.get(c) || c;
const catEmoji = (c) => CATEMOJI.get(c) || '•';

function aviso(msg) {
  const cont = $('#avisos');
  const el = document.createElement('div');
  el.className = 'aviso';
  el.textContent = msg;
  cont.appendChild(el);
  setTimeout(() => { el.classList.add('va'); setTimeout(() => el.remove(), 260); }, 2100);
}

function descargar(nombre, contenido, tipo = 'text/plain;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ---------- Búsqueda ---------- */

/* Palabras que la gente escribe pero no aportan nada al filtrado. */
const VACIAS = new Set([
  'de', 'del', 'la', 'el', 'lo', 'los', 'las', 'un', 'una', 'unos', 'unas',
  'para', 'por', 'con', 'sin', 'y', 'o', 'u', 'en', 'a', 'al', 'que', 'qué',
  'mi', 'me', 'te', 'se', 'su', 'como', 'cual', 'mas', 'muy', 'algo', 'algun',
  'quiero', 'necesito', 'busco', 'buscar', 'sirva', 'sirve', 'hacer', 'poder',
  'herramienta', 'herramientas', 'app', 'apps', 'programa', 'ia', 'ai',
  'mejor', 'mejores', 'bueno', 'buena', 'buenas', 'buenos',
]);

/* Cómo escribe la gente  ->  cómo está escrito en el catálogo.
   Evita que "transcribir reuniones" no encuentre la categoría "Transcripción y reuniones". */
const SINONIMOS = {
  transcribir: ['transcripcion'], transcribe: ['transcripcion'], transcripcion: ['transcripcion'],
  acta: ['transcripcion', 'reuniones'], actas: ['transcripcion', 'reuniones'],
  reunion: ['transcripcion', 'reuniones'], reuniones: ['transcripcion'],
  subtitulo: ['transcripcion'], subtitulos: ['transcripcion'], subtitular: ['transcripcion'],
  dictado: ['transcripcion'], entrevista: ['transcripcion'], entrevistas: ['transcripcion'],
  foto: ['imagen'], fotos: ['imagen'], fotografia: ['imagen'], imagenes: ['imagen'],
  ilustracion: ['imagen'], dibujar: ['imagen'], dibujo: ['imagen'], logo: ['imagen', 'diseno'],
  logos: ['imagen', 'diseno'], cartel: ['imagen', 'diseno'], carteles: ['imagen', 'diseno'],
  fondo: ['edicion-img'], retocar: ['edicion-img'], retoque: ['edicion-img'],
  escalar: ['edicion-img'], ampliar: ['edicion-img'], upscale: ['edicion-img'],
  videos: ['video'], clip: ['video'], clips: ['video'], pelicula: ['video'],
  reel: ['video'], reels: ['video'], tiktok: ['video'], youtube: ['video'],
  avatar: ['video'], avatares: ['video'], doblaje: ['video', 'audio'], doblar: ['video', 'audio'],
  voz: ['audio'], voces: ['audio'], locucion: ['audio'], narrar: ['audio'],
  podcast: ['audio'], audiolibro: ['audio'], sonido: ['audio'],
  cancion: ['musica'], canciones: ['musica'], musical: ['musica'], jingle: ['musica'],
  programar: ['codigo'], programacion: ['codigo'], codigo: ['codigo'], desarrollar: ['codigo'],
  copiloto: ['codigo'], copilot: ['codigo'], depurar: ['codigo'], refactorizar: ['codigo'],
  web: ['no-code'], webs: ['no-code'], pagina: ['no-code'], landing: ['no-code'],
  aplicacion: ['no-code'], aplicaciones: ['no-code'], prototipo: ['no-code', 'diseno'],
  escribir: ['escritura'], redactar: ['escritura'], redaccion: ['escritura'],
  corregir: ['escritura'], ortografia: ['escritura'], gramatica: ['escritura'],
  traducir: ['escritura'], traduccion: ['escritura'], parafrasear: ['escritura'],
  resumir: ['chat', 'investigacion'], resumen: ['chat', 'investigacion'],
  paper: ['investigacion'], papers: ['investigacion'], articulo: ['investigacion'],
  tesis: ['investigacion'], bibliografia: ['investigacion'], academico: ['investigacion'],
  estudiar: ['educacion', 'investigacion'], estudio: ['investigacion'],
  clase: ['educacion'], clases: ['educacion'], profesor: ['educacion'], docente: ['educacion'],
  alumno: ['educacion'], examen: ['educacion'], evaluar: ['educacion'],
  presentacion: ['presentaciones'], presentaciones: ['presentaciones'],
  diapositiva: ['presentaciones'], diapositivas: ['presentaciones'], slides: ['presentaciones'],
  automatizar: ['agentes'], automatizacion: ['agentes'], flujo: ['agentes'], flujos: ['agentes'],
  agente: ['agentes'], bot: ['agentes', 'chat'], chatbot: ['agentes', 'chat'],
  correo: ['productividad'], email: ['productividad'], agenda: ['productividad'],
  calendario: ['productividad'], notas: ['productividad'], tareas: ['productividad'],
  organizar: ['productividad'], excel: ['datos'], hoja: ['datos'], grafico: ['datos'],
  datos: ['datos'], analizar: ['datos'], estadistica: ['datos'],
  vender: ['marketing'], ventas: ['marketing'], publicidad: ['marketing'],
  anuncio: ['marketing'], anuncios: ['marketing'], campana: ['marketing'],
  redes: ['marketing'], seo: ['marketing'], copy: ['marketing', 'escritura'],
  buscar: ['busqueda'], busqueda: ['busqueda'], investigar: ['investigacion', 'busqueda'],
  modelado: ['3d'], mesh: ['3d'], render: ['3d'],
  offline: ['local'], privado: ['local'], privada: ['local'], privacidad: ['local'],
  propio: ['local'], autoalojado: ['local'], autoalojable: ['local'],
  libre: ['oss'], abierto: ['oss'], opensource: ['oss'],
  quitar: ['edicion-img'], eliminar: ['edicion-img'], borrar: ['edicion-img'],
  recortar: ['edicion-img'], limpiar: ['edicion-img'], mejorar: ['edicion-img'],
};

/**
 * Variantes de un término: él mismo, sus sinónimos y una raíz recortada.
 * La raíz permite que "quitar" encuentre "quita" y "redactar" encuentre "redacción".
 */
function variantes(t) {
  const vs = [{ t, peso: 1 }];
  // El sinónimo pesa poco a propósito: si pesara mucho, todas las herramientas de
  // la categoría empatarían y taparían a la que menciona la palabra literalmente.
  for (const s of SINONIMOS[t] || []) vs.push({ t: s, peso: 0.55 });
  if (t.length >= 6 && /(ar|er|ir)$/.test(t)) vs.push({ t: t.slice(0, -1), peso: 0.7 });
  if (t.length >= 7) vs.push({ t: t.slice(0, -2), peso: 0.55 });
  return vs;
}

function puntuarTermino(h, t) {
  let s = 0;
  const nom = norm(h.nombre);
  if (nom === t) s += 140;
  else if (nom.startsWith(t)) s += 95;
  else if (nom.includes(t)) s += 62;
  if (norm(h.empresa).includes(t)) s += 26;
  if (h.cat.some((c) => c.includes(t) || norm(catNom(c)).includes(t))) s += 32;
  if (h.usos.some((u) => norm(u).includes(t))) s += 30;
  if (norm(h.desc).includes(t)) s += 15;
  if (norm(h.gratis).includes(t)) s += 6;
  if (t === 'gratis' && (h.precio === 'gratis' || h.precio === 'oss')) s += 40;
  if ((t === 'local' || t === 'privado' || t === 'privacidad') && h.priv === 'local') s += 40;
  if ((t === 'abierto' || t === 'libre' || t === 'oss') && h.oss) s += 40;
  return s;
}

/** Puntuación de un término sumando lo que aportan sus variantes. */
function puntuarConSinonimos(h, t) {
  let total = 0;
  for (const v of variantes(t)) total += puntuarTermino(h, v.t) * v.peso;
  return total;
}

/**
 * Puntúa una herramienta contra la consulta.
 * `exigirTodos` en true pide que todos los términos coincidan; en false vale con uno,
 * y se premia a quien cubra más términos.
 */
function puntuarBusqueda(h, terminos, exigirTodos = true) {
  let total = 0;
  let cubiertos = 0;
  for (const t of terminos) {
    const s = puntuarConSinonimos(h, t);
    if (s === 0) {
      if (exigirTodos) return 0;
      continue;
    }
    cubiertos++;
    total += s;
  }
  if (!cubiertos) return 0;
  return exigirTodos ? total : total + cubiertos * 25;
}

/** Divide la consulta en términos útiles, descartando muletillas. */
function terminosDe(consulta) {
  const brutos = norm(consulta).split(/[^a-z0-9+#.]+/).filter(Boolean);
  const utiles = brutos.filter((t) => t.length > 1 && !VACIAS.has(t));
  return utiles.length ? utiles : brutos;
}

/* ---------- Filtrado y orden ---------- */

function filtrar() {
  const terminos = terminosDe(F.q);

  let lista = DB.herramientas.filter((h) => {
    if (F.cat.size && !h.cat.some((c) => F.cat.has(c))) return false;
    if (F.precio.size && !F.precio.has(h.precio)) return false;
    if (F.priv.size && !F.priv.has(h.priv)) return false;
    if (F.plat.size && !h.plat.some((p) => F.plat.has(p))) return false;
    if (F.nivel.size && !F.nivel.has(h.nivel)) return false;
    if (F.es && h.es < F.es) return false;
    if (F.max !== null && h.desde > F.max) return false;
    if (F.api && !h.api) return false;
    if (F.oss && !h.oss) return false;
    if (F.conGratis && !tieneGratis(h)) return false;
    if (F.nuevas && !esNueva(h)) return false;
    if (F.favs && !favoritos.has(h.id)) return false;
    return true;
  });

  if (terminos.length) {
    const buscar = (exigirTodos) => lista
      .map((h) => ({ h, s: puntuarBusqueda(h, terminos, exigirTodos) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s || b.h.score - a.h.score)
      .map((x) => x.h);

    // Primero las que cumplen todos los términos; si son pocas, se añaden
    // detrás las que cumplen alguno. Así la precisión manda y la cobertura ayuda.
    const estrictos = buscar(true);
    if (estrictos.length < 8 && terminos.length > 1) {
      const vistos = new Set(estrictos.map((h) => h.id));
      lista = [...estrictos, ...buscar(false).filter((h) => !vistos.has(h.id))];
    } else {
      lista = estrictos;
    }
  }

  const cmp = {
    relevancia: () => 0,
    destacados: (a, b) => (b.destacado - a.destacado) || (b.score - a.score),
    score: (a, b) => b.score - a.score,
    nuevas: (a, b) => Date.parse(b.agregado) - Date.parse(a.agregado) || b.score - a.score,
    'precio-asc': (a, b) => a.desde - b.desde || b.score - a.score,
    'precio-desc': (a, b) => b.desde - a.desde || b.score - a.score,
    nombre: (a, b) => a.nombre.localeCompare(b.nombre, 'es'),
  }[orden];

  // Con búsqueda activa, "relevancia" conserva el orden del puntaje.
  if (!(terminos.length && orden === 'relevancia')) lista.sort(cmp);

  resultados = lista;
  return lista;
}

/* ---------- Panel de filtros ---------- */

function cuentaSi(pred) {
  return DB.herramientas.filter(pred).length;
}

function grupoCheck(titulo, opciones, conjunto, tipoNum = false) {
  const filas = opciones.map(({ v, txt, n, extra }) => {
    const val = tipoNum ? Number(v) : v;
    const marcado = conjunto.has(val) ? ' checked' : '';
    const inhab = n === 0 && !conjunto.has(val) ? ' disabled' : '';
    return `<label class="opcion">
      <input type="checkbox" value="${esc(v)}"${marcado}${inhab}>
      <span class="op-txt">${extra || ''}${esc(txt)}</span>
      <span class="op-n">${n}</span>
    </label>`;
  }).join('');
  return `<div class="grupo"><h3>${esc(titulo)}</h3><div class="grupo-lista">${filas}</div></div>`;
}

function pintarFiltros() {
  const cuerpo = $('#filtros-cuerpo');

  const cats = DB.categorias
    .map((c) => ({ v: c.id, txt: c.nombre, n: cuentaSi((h) => h.cat.includes(c.id)), extra: `${c.emoji} ` }))
    .sort((a, b) => b.n - a.n);

  const precios = Object.entries(ETIQ_PRECIO)
    .map(([v, txt]) => ({ v, txt, n: cuentaSi((h) => h.precio === v) }));

  const privs = Object.entries(ETIQ_PRIV)
    .map(([v, txt]) => ({ v, txt, n: cuentaSi((h) => h.priv === v), extra: `${PRIV_ICONO[v]} ` }));

  const plats = Object.entries(ETIQ_PLAT)
    .map(([v, txt]) => ({ v, txt, n: cuentaSi((h) => h.plat.includes(v)) }))
    .sort((a, b) => b.n - a.n);

  const niveles = Object.entries(ETIQ_NIVEL)
    .map(([v, txt]) => ({ v, txt, n: cuentaSi((h) => h.nivel === Number(v)) }));

  cuerpo.innerHTML = `
    <div class="grupo">
      <h3>Presupuesto por herramienta</h3>
      <div class="rango">
        <input type="range" id="f-max" min="0" max="100" step="5" value="${F.max === null ? 100 : F.max}"
               aria-label="Precio máximo mensual por herramienta">
        <div class="rango-val">
          <span>$0</span>
          <span id="f-max-txt">${F.max === null ? 'Sin límite' : '$' + F.max + '/mes'}</span>
        </div>
      </div>
    </div>

    ${grupoCheck('Modelo de precio', precios, F.precio)}

    <div class="grupo">
      <h3>Requisitos</h3>
      <div class="grupo-lista">
        <label class="opcion"><input type="checkbox" id="f-gratis"${F.conGratis ? ' checked' : ''}>
          <span class="op-txt">🎁 Tiene plan gratuito</span><span class="op-n">${cuentaSi(tieneGratis)}</span></label>
        <label class="opcion"><input type="checkbox" id="f-api"${F.api ? ' checked' : ''}>
          <span class="op-txt">🔌 Ofrece API</span><span class="op-n">${cuentaSi((h) => h.api)}</span></label>
        <label class="opcion"><input type="checkbox" id="f-oss"${F.oss ? ' checked' : ''}>
          <span class="op-txt">📖 Código abierto</span><span class="op-n">${cuentaSi((h) => h.oss)}</span></label>
        <label class="opcion"><input type="checkbox" id="f-nuevas"${F.nuevas ? ' checked' : ''}>
          <span class="op-txt">✨ Novedades</span><span class="op-n">${cuentaSi(esNueva)}</span></label>
        <label class="opcion"><input type="checkbox" id="f-favs"${F.favs ? ' checked' : ''}>
          <span class="op-txt">❤️ Solo favoritos</span><span class="op-n">${favoritos.size}</span></label>
      </div>
    </div>

    <div class="grupo">
      <h3>Calidad en español</h3>
      <div class="rango">
        <input type="range" id="f-es" min="0" max="5" step="1" value="${F.es}"
               aria-label="Calidad mínima de soporte en español">
        <div class="rango-val">
          <span>Cualquiera</span>
          <span id="f-es-txt">${F.es === 0 ? 'Cualquiera' : 'Mínimo ' + '★'.repeat(F.es)}</span>
        </div>
      </div>
    </div>

    ${grupoCheck('Privacidad de tus datos', privs, F.priv)}
    ${grupoCheck('Categoría', cats, F.cat)}
    ${grupoCheck('Plataforma', plats, F.plat)}
    ${grupoCheck('Nivel requerido', niveles, F.nivel, true)}
  `;

  // Enlazado de eventos: cada grupo de casillas se localiza por su título.
  const grupos = $$('.grupo', cuerpo);
  const conjuntos = [
    ['Modelo de precio', F.precio, false],
    ['Privacidad de tus datos', F.priv, false],
    ['Categoría', F.cat, false],
    ['Plataforma', F.plat, false],
    ['Nivel requerido', F.nivel, true],
  ];
  for (const [titulo, conjunto, num] of conjuntos) {
    const g = grupos.find((x) => $('h3', x)?.textContent.trim() === titulo);
    if (!g) continue;
    for (const inp of $$('input[type=checkbox]', g)) {
      inp.addEventListener('change', () => {
        const v = num ? Number(inp.value) : inp.value;
        inp.checked ? conjunto.add(v) : conjunto.delete(v);
        actualizar();
      });
    }
  }

  $('#f-max').addEventListener('input', (e) => {
    const v = Number(e.target.value);
    F.max = v >= 100 ? null : v;
    $('#f-max-txt').textContent = F.max === null ? 'Sin límite' : `$${F.max}/mes`;
    actualizar({ soloResultados: true });
  });
  $('#f-es').addEventListener('input', (e) => {
    F.es = Number(e.target.value);
    $('#f-es-txt').textContent = F.es === 0 ? 'Cualquiera' : `Mínimo ${'★'.repeat(F.es)}`;
    actualizar({ soloResultados: true });
  });
  for (const [id, campo] of [['f-gratis', 'conGratis'], ['f-api', 'api'], ['f-oss', 'oss'], ['f-nuevas', 'nuevas'], ['f-favs', 'favs']]) {
    $('#' + id).addEventListener('change', (e) => { F[campo] = e.target.checked; actualizar(); });
  }
}

/* ---------- Chips rápidos ---------- */

const CHIPS = [
  { txt: '🎁 Con plan gratis', act: () => { F.conGratis = !F.conGratis; }, on: () => F.conGratis },
  { txt: '💸 Solo 100% gratis', act: () => { alternarPrecios(['gratis', 'oss']); }, on: () => F.precio.has('gratis') && F.precio.has('oss') },
  { txt: '🔒 Privadas / locales', act: () => { alternarPriv(['local']); }, on: () => F.priv.has('local') },
  { txt: '📖 Código abierto', act: () => { F.oss = !F.oss; }, on: () => F.oss },
  { txt: '🇪🇸 Buen español', act: () => { F.es = F.es >= 5 ? 0 : 5; }, on: () => F.es >= 5 },
  { txt: '🌱 Para empezar', act: () => { alternarNivel(1); }, on: () => F.nivel.has(1) },
  { txt: '🔌 Con API', act: () => { F.api = !F.api; }, on: () => F.api },
  { txt: '✨ Novedades', act: () => { F.nuevas = !F.nuevas; }, on: () => F.nuevas },
];

function alternarPrecios(vs) {
  const activo = vs.every((v) => F.precio.has(v));
  for (const v of vs) activo ? F.precio.delete(v) : F.precio.add(v);
}
function alternarPriv(vs) {
  const activo = vs.every((v) => F.priv.has(v));
  for (const v of vs) activo ? F.priv.delete(v) : F.priv.add(v);
}
function alternarNivel(n) {
  F.nivel.has(n) ? F.nivel.delete(n) : F.nivel.add(n);
}

function pintarChips() {
  const cont = $('#chips-rapidos');
  cont.innerHTML = '';
  CHIPS.forEach((c, i) => {
    const b = document.createElement('button');
    b.className = 'btn btn-sm';
    b.textContent = c.txt;
    b.setAttribute('aria-pressed', String(!!c.on()));
    b.addEventListener('click', () => { CHIPS[i].act(); actualizar(); });
    cont.appendChild(b);
  });

  const hoy = herramientaDelDia();
  if (hoy) {
    const b = document.createElement('button');
    b.className = 'btn btn-sm btn-pri';
    b.innerHTML = `✨ Descubrimiento del día: ${esc(hoy.nombre)}`;
    b.addEventListener('click', () => abrirDetalle(hoy.id));
    cont.appendChild(b);
  }
}

function herramientaDelDia() {
  if (!DB.herramientas.length) return null;
  const d = new Date();
  const semilla = d.getFullYear() * 1000 + d.getMonth() * 40 + d.getDate();
  return DB.herramientas[semilla % DB.herramientas.length];
}

/* ---------- Chips de filtros activos ---------- */

function pintarActivos() {
  const cont = $('#activos');
  const tags = [];
  const add = (txt, quitar) => tags.push({ txt, quitar });

  if (F.q) add(`"${F.q}"`, () => { F.q = ''; $('#q').value = ''; });
  for (const c of F.cat) add(`${catEmoji(c)} ${catNom(c)}`, () => F.cat.delete(c));
  for (const p of F.precio) add(ETIQ_PRECIO[p], () => F.precio.delete(p));
  for (const p of F.priv) add(`${PRIV_ICONO[p]} ${ETIQ_PRIV[p]}`, () => F.priv.delete(p));
  for (const p of F.plat) add(ETIQ_PLAT[p], () => F.plat.delete(p));
  for (const n of F.nivel) add(ETIQ_NIVEL[n], () => F.nivel.delete(n));
  if (F.es) add(`Español ${'★'.repeat(F.es)}`, () => { F.es = 0; });
  if (F.max !== null) add(`Hasta $${F.max}/mes`, () => { F.max = null; });
  if (F.api) add('Con API', () => { F.api = false; });
  if (F.oss) add('Código abierto', () => { F.oss = false; });
  if (F.conGratis) add('Con plan gratis', () => { F.conGratis = false; });
  if (F.nuevas) add('Novedades', () => { F.nuevas = false; });
  if (F.favs) add('Favoritos', () => { F.favs = false; });

  cont.innerHTML = '';
  if (!tags.length) return;
  for (const t of tags) {
    const el = document.createElement('span');
    el.className = 'tag-activo';
    el.innerHTML = `${esc(t.txt)} <button aria-label="Quitar filtro">✕</button>`;
    $('button', el).addEventListener('click', () => { t.quitar(); actualizar(); });
    cont.appendChild(el);
  }
  const limpiar = document.createElement('button');
  limpiar.className = 'btn btn-sm btn-fantasma';
  limpiar.textContent = 'Limpiar todo';
  limpiar.addEventListener('click', limpiarFiltros);
  cont.appendChild(limpiar);
}

function limpiarFiltros() {
  F.q = '';
  $('#q').value = '';
  F.cat.clear(); F.precio.clear(); F.priv.clear(); F.plat.clear(); F.nivel.clear();
  F.es = 0; F.max = null;
  F.api = F.oss = F.conGratis = F.nuevas = F.favs = false;
  pintarFiltros();
  actualizar();
}

/* ---------- Tarjetas ---------- */

function badgesHTML(h) {
  const b = [];
  b.push(`<span class="badge ${h.precio}">${ETIQ_PRECIO[h.precio]}</span>`);
  if (esNueva(h)) b.push('<span class="badge nuevo">✨ Nuevo</span>');
  if (h.priv === 'local') b.push('<span class="badge local">🔒 Local</span>');
  if (h.oss && h.precio !== 'oss') b.push('<span class="badge oss">📖 Abierto</span>');
  if (h.api) b.push('<span class="badge">🔌 API</span>');
  if (h.es >= 5) b.push('<span class="badge">🇪🇸 Español</span>');
  if (h.nivel === 1) b.push('<span class="badge">🌱 Fácil</span>');
  return b.join('');
}

function tarjeta(h) {
  const el = document.createElement('article');
  el.className = 'card' + (comparador.includes(h.id) ? ' en-comparador' : '');
  el.dataset.id = h.id;
  el.innerHTML = `
    <div class="card-top">
      ${logoHTML(h)}
      <div class="card-id">
        <h3><a href="${esc(h.url)}" target="_blank" rel="noopener noreferrer">${esc(h.nombre)}</a></h3>
        <span class="empresa">${esc(h.empresa)} · ${h.cat.slice(0, 2).map((c) => catNom(c)).join(' · ')}</span>
      </div>
      <button class="fav" data-fav aria-pressed="${favoritos.has(h.id)}"
              aria-label="${favoritos.has(h.id) ? 'Quitar de' : 'Añadir a'} favoritos">❤️</button>
    </div>
    <p class="desc">${esc(h.desc)}</p>
    <div class="badges">${badgesHTML(h)}</div>
    <div class="card-meta">
      <span class="precio-txt">${precioTexto(h)}</span>
      <span class="puntos" title="Valoración editorial: ${h.score}/10">
        <span class="puntos-barra"><i style="width:${h.score * 10}%"></i></span>
        <b>${h.score.toFixed(1)}</b>
      </span>
    </div>
    <div class="card-acciones">
      <button class="btn btn-sm" data-ver>Ver ficha</button>
      <button class="btn btn-sm" data-comp title="Añadir al comparador">⚖️ <span>Comparar</span></button>
      <button class="btn btn-sm" data-stack title="Añadir a mi stack">${stack.has(h.id) ? '✓' : '＋'} <span>Stack</span></button>
    </div>
  `;
  $('[data-fav]', el).addEventListener('click', () => alternarFavorito(h.id));
  $('[data-ver]', el).addEventListener('click', () => abrirDetalle(h.id));
  $('[data-comp]', el).addEventListener('click', () => alternarComparador(h.id));
  $('[data-stack]', el).addEventListener('click', () => alternarStack(h.id));
  return el;
}

function pintarTabla(lista) {
  const cont = $('#resultados');
  const filas = lista.map((h) => `
    <tr data-id="${esc(h.id)}">
      <td class="nom"><a href="${esc(h.url)}" target="_blank" rel="noopener noreferrer">${esc(h.nombre)}</a></td>
      <td>${esc(h.empresa)}</td>
      <td>${h.cat.map((c) => catNom(c)).join(', ')}</td>
      <td>${ETIQ_PRECIO[h.precio]}</td>
      <td class="num">${h.desde === 0 ? '—' : '$' + h.desde}</td>
      <td>${h.api ? 'Sí' : 'No'}</td>
      <td>${h.oss ? 'Sí' : 'No'}</td>
      <td>${'★'.repeat(h.es)}</td>
      <td>${PRIV_ICONO[h.priv]} ${ETIQ_PRIV[h.priv]}</td>
      <td>${ETIQ_NIVEL[h.nivel]}</td>
      <td class="num">${h.score.toFixed(1)}</td>
      <td><button class="btn btn-sm" data-ver>Ficha</button></td>
    </tr>`).join('');

  cont.innerHTML = `<table class="tabla-dir">
    <thead><tr>
      <th>Herramienta</th><th>Empresa</th><th>Categorías</th><th>Precio</th><th>Desde</th>
      <th>API</th><th>Abierto</th><th>Español</th><th>Privacidad</th><th>Nivel</th><th>Nota</th><th></th>
    </tr></thead>
    <tbody>${filas}</tbody></table>`;

  for (const b of $$('[data-ver]', cont)) {
    b.addEventListener('click', (e) => abrirDetalle(e.target.closest('tr').dataset.id));
  }
}

function pintarResultados() {
  const cont = $('#resultados');
  cont.className = vista;

  if (!resultados.length) {
    cont.innerHTML = `<div class="vacio">
      <span class="emoji">🔍</span>
      <h3>Ningún resultado con esos filtros</h3>
      <p>Prueba a quitar alguna condición o busca con otras palabras.</p>
      <button class="btn btn-pri" id="vacio-limpiar">Limpiar filtros</button>
    </div>`;
    $('#vacio-limpiar').addEventListener('click', limpiarFiltros);
    return;
  }

  if (vista === 'tabla') { pintarTabla(resultados); return; }

  cont.innerHTML = '';
  const frag = document.createDocumentFragment();
  for (const h of resultados) frag.appendChild(tarjeta(h));
  cont.appendChild(frag);
}

/* ---------- Ficha de detalle ---------- */

function abrirDetalle(id) {
  const h = PORID.get(id);
  if (!h) return;

  $('#detalle-titulo').textContent = h.nombre;
  const alts = (h.alt || []).map((a) => PORID.get(a)).filter(Boolean);

  $('#detalle-cuerpo').innerHTML = `
    <div class="ficha-top">
      ${logoHTML(h)}
      <div style="flex:1;min-width:180px">
        <h2>${esc(h.nombre)}</h2>
        <div class="empresa">${esc(h.empresa)}</div>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <a class="btn btn-pri" href="${esc(h.url)}" target="_blank" rel="noopener noreferrer">Ir al sitio ↗</a>
        <button class="btn" data-d-fav aria-pressed="${favoritos.has(h.id)}">❤️ ${favoritos.has(h.id) ? 'En favoritos' : 'Favorito'}</button>
        <button class="btn" data-d-stack>${stack.has(h.id) ? '✓ En mi stack' : '＋ A mi stack'}</button>
        <button class="btn" data-d-comp>⚖️ Comparar</button>
        <button class="btn btn-icono" data-d-link title="Copiar enlace a esta ficha">🔗</button>
      </div>
    </div>

    <div class="badges" style="margin-bottom:14px">${badgesHTML(h)}</div>
    <p class="ficha-lead">${esc(h.desc)}</p>

    <div class="ficha-rejilla">
      <div class="dato"><dt>Modelo de precio</dt><dd>${ETIQ_PRECIO[h.precio]}</dd></div>
      <div class="dato"><dt>Plan de pago desde</dt><dd>${h.desde === 0 ? 'No requiere pago' : '$' + h.desde + ' /mes'}</dd></div>
      <div class="dato"><dt>Privacidad</dt><dd>${PRIV_ICONO[h.priv]} ${ETIQ_PRIV[h.priv]}</dd></div>
      <div class="dato"><dt>Nivel requerido</dt><dd>${ETIQ_NIVEL[h.nivel]}</dd></div>
      <div class="dato"><dt>API para desarrolladores</dt><dd>${h.api ? 'Sí' : 'No'}</dd></div>
      <div class="dato"><dt>Código abierto</dt><dd>${h.oss ? 'Sí' : 'No'}</dd></div>
      <div class="dato">
        <dt>Calidad en español</dt>
        <dd class="medidor"><span class="medidor-barra"><i style="width:${h.es * 20}%"></i></span> ${h.es}/5</dd>
      </div>
      <div class="dato">
        <dt>Valoración editorial</dt>
        <dd class="medidor"><span class="medidor-barra"><i style="width:${h.score * 10}%"></i></span> ${h.score.toFixed(1)}/10</dd>
      </div>
    </div>

    ${h.gratis ? `<div class="ficha-seccion">
      <h4>Qué incluye el plan gratuito</h4>
      <p style="margin:0">${esc(h.gratis)}</p>
    </div>` : ''}

    <div class="ficha-seccion">
      <h4>Para qué sirve</h4>
      <div class="pastillas">${h.usos.map((u) => `<span class="pastilla">${esc(u)}</span>`).join('')}</div>
    </div>

    <div class="ficha-seccion">
      <h4>Categorías</h4>
      <div class="pastillas">${h.cat.map((c) => `<button class="pastilla enlace" data-cat="${esc(c)}">${catEmoji(c)} ${esc(catNom(c))}</button>`).join('')}</div>
    </div>

    <div class="ficha-seccion">
      <h4>Disponible en</h4>
      <div class="pastillas">${h.plat.map((p) => `<span class="pastilla">${esc(ETIQ_PLAT[p] || p)}</span>`).join('')}</div>
    </div>

    ${alts.length ? `<div class="ficha-seccion">
      <h4>Alternativas y equivalentes</h4>
      <div class="pastillas">${alts.map((a) => `<button class="pastilla enlace" data-alt="${esc(a.id)}">
        ${esc(a.nombre)} · ${a.desde === 0 ? 'gratis' : '$' + a.desde}</button>`).join('')}</div>
    </div>` : ''}

    <p style="color:var(--texto-3);font-size:12px;margin:16px 0 0">
      Ficha añadida el ${esc(h.agregado)}. Precio de referencia, verifica en el sitio oficial.
    </p>
  `;

  const cuerpo = $('#detalle-cuerpo');
  $('[data-d-fav]', cuerpo).addEventListener('click', () => { alternarFavorito(h.id); abrirDetalle(h.id); });
  $('[data-d-stack]', cuerpo).addEventListener('click', () => { alternarStack(h.id); abrirDetalle(h.id); });
  $('[data-d-comp]', cuerpo).addEventListener('click', () => { alternarComparador(h.id); abrirDetalle(h.id); });
  $('[data-d-link]', cuerpo).addEventListener('click', () => {
    const u = new URL(location.href);
    u.hash = 'h=' + h.id;
    navigator.clipboard?.writeText(u.toString()).then(
      () => aviso('Enlace copiado'),
      () => aviso('No se pudo copiar'));
  });
  for (const b of $$('[data-alt]', cuerpo)) {
    b.addEventListener('click', () => abrirDetalle(b.dataset.alt));
  }
  for (const b of $$('[data-cat]', cuerpo)) {
    b.addEventListener('click', () => {
      $('#dlg-detalle').close();
      F.cat.clear(); F.cat.add(b.dataset.cat);
      pintarFiltros(); actualizar();
      $('#resultados').scrollIntoView({ block: 'start' });
    });
  }

  const dlg = $('#dlg-detalle');
  if (!dlg.open) dlg.showModal();
  cuerpo.scrollTop = 0;
}

/* ---------- Comparador ---------- */

function alternarComparador(id) {
  const i = comparador.indexOf(id);
  if (i >= 0) comparador.splice(i, 1);
  else {
    if (comparador.length >= 4) { aviso('El comparador admite 4 herramientas'); return; }
    comparador.push(id);
  }
  const n = comparador.length;
  $('#comp-n').textContent = n || '';
  $('#comp-n').dataset.n = n;
  $('#btn-comparar').disabled = n < 2;
  for (const c of $$('.card')) c.classList.toggle('en-comparador', comparador.includes(c.dataset.id));
  if (n === 1) aviso('Añade otra herramienta para comparar');
  if ($('#dlg-comparar').open) abrirComparador();
  guardarURL();
}

function abrirComparador() {
  const hs = comparador.map((id) => PORID.get(id)).filter(Boolean);
  if (hs.length < 2) { aviso('Selecciona al menos dos herramientas'); return; }

  const minPrecio = Math.min(...hs.map((h) => h.desde));
  const maxScore = Math.max(...hs.map((h) => h.score));
  const maxEs = Math.max(...hs.map((h) => h.es));

  const filas = [
    ['Precio desde', (h) => (h.desde === 0 ? 'Sin coste' : `$${h.desde}/mes`), (h) => h.desde === minPrecio],
    ['Modelo', (h) => ETIQ_PRECIO[h.precio]],
    ['Plan gratuito', (h) => h.gratis || '—', (h) => !!h.gratis],
    ['Valoración', (h) => `${h.score.toFixed(1)}/10`, (h) => h.score === maxScore],
    ['Español', (h) => '★'.repeat(h.es) + '☆'.repeat(5 - h.es), (h) => h.es === maxEs],
    ['Privacidad', (h) => `${PRIV_ICONO[h.priv]} ${ETIQ_PRIV[h.priv]}`, (h) => h.priv === 'local' || h.priv === 'no-entrena'],
    ['Código abierto', (h) => (h.oss ? 'Sí' : 'No'), (h) => h.oss],
    ['API', (h) => (h.api ? 'Sí' : 'No'), (h) => h.api],
    ['Nivel', (h) => ETIQ_NIVEL[h.nivel], (h) => h.nivel === 1],
    ['Categorías', (h) => h.cat.map((c) => catNom(c)).join(', ')],
    ['Plataformas', (h) => h.plat.map((p) => ETIQ_PLAT[p]).join(', ')],
    ['Casos de uso', (h) => h.usos.join(' · ')],
  ];

  $('#comparar-cuerpo').innerHTML = `<table class="tabla-comp">
    <thead><tr><th></th>${hs.map((h) => `<th>
      <div class="comp-cabecera">${logoHTML(h)}
        <div><a href="${esc(h.url)}" target="_blank" rel="noopener noreferrer"><b>${esc(h.nombre)}</b></a>
        <div style="font-size:11px;color:var(--texto-3)">${esc(h.empresa)}</div></div>
      </div>
      <button class="btn btn-sm" data-quitar="${esc(h.id)}" style="margin-top:7px">Quitar</button>
    </th>`).join('')}</tr></thead>
    <tbody>${filas.map(([et, fn, mejor]) => `<tr><th>${esc(et)}</th>${hs.map((h) =>
      `<td class="${mejor && mejor(h) ? 'mejor' : ''}">${esc(fn(h))}</td>`).join('')}</tr>`).join('')}
    </tbody></table>
    <p style="color:var(--texto-3);font-size:12px;margin-top:12px">
      En verde, la opción más favorable de cada fila.
    </p>`;

  for (const b of $$('[data-quitar]', $('#comparar-cuerpo'))) {
    b.addEventListener('click', () => {
      alternarComparador(b.dataset.quitar);
      if (comparador.length < 2) $('#dlg-comparar').close();
    });
  }

  const dlg = $('#dlg-comparar');
  if (!dlg.open) dlg.showModal();
}

/* ---------- Favoritos ---------- */

function alternarFavorito(id) {
  favoritos.has(id) ? favoritos.delete(id) : favoritos.add(id);
  guardar(LS.fav, [...favoritos]);
  for (const c of $$(`.card[data-id="${CSS.escape(id)}"] [data-fav]`)) {
    c.setAttribute('aria-pressed', String(favoritos.has(id)));
  }
  if (F.favs) actualizar();
}

/* ---------- Mi stack ---------- */

function alternarStack(id) {
  stack.has(id) ? stack.delete(id) : stack.add(id);
  guardar(LS.stack, [...stack]);
  pintarStack();
  pintarResultados();
  guardarURL();
  aviso(stack.has(id) ? `${PORID.get(id).nombre} añadida a tu stack` : 'Quitada de tu stack');
}

function mejorAlternativaGratis(h) {
  const cands = (h.alt || []).map((a) => PORID.get(a)).filter(Boolean);
  const totalmenteGratis = cands.filter((c) => c.precio === 'gratis' || c.precio === 'oss');
  const conPlanGratis = cands.filter((c) => c.precio === 'freemium' && c.gratis);
  const pool = totalmenteGratis.length ? totalmenteGratis : conPlanGratis;
  if (!pool.length) return null;
  return pool.slice().sort((a, b) => b.score - a.score)[0];
}

function pintarStack() {
  const n = stack.size;
  $('#stack-n').textContent = n || '';
  $('#stack-n').dataset.n = n;

  const cuerpo = $('#stack-cuerpo');
  const pie = $('#stack-pie');

  if (!n) {
    cuerpo.innerHTML = `<div class="vacio" style="padding:44px 16px">
      <span class="emoji">🧰</span>
      <h3>Tu stack está vacío</h3>
      <p>Añade herramientas con el botón <b>＋ Stack</b> y calcularemos cuánto te costaría al mes,
      además de buscarte alternativas gratuitas equivalentes.</p>
    </div>`;
    pie.innerHTML = '';
    return;
  }

  const hs = [...stack].map((id) => PORID.get(id)).filter(Boolean);
  const total = hs.reduce((s, h) => s + h.desde, 0);
  const pagas = hs.filter((h) => h.desde > 0);
  const excedido = total > presupuesto;

  const ahorros = pagas
    .map((h) => ({ h, alt: mejorAlternativaGratis(h) }))
    .filter((x) => x.alt);
  const ahorroTotal = ahorros.reduce((s, x) => s + x.h.desde, 0);
  // Distinguimos lo que es gratis de verdad de lo que solo tiene plan gratuito:
  // prometer un ahorro que luego no existe sería engañoso.
  const totalmenteGratis = (t) => t.precio === 'gratis' || t.precio === 'oss';

  cuerpo.innerHTML = `
    <div class="total-caja">
      <div>
        <span class="cifra">$${dinero(total)}</span>
        <div style="font-size:11px;color:var(--texto-2)">al mes · ${plural(n, 'herramienta', 'herramientas')}</div>
      </div>
      <div class="anual"><b>$${dinero(total * 12)}</b><br>al año</div>
    </div>

    <div class="presu">
      <label for="presu-rango" style="font-size:12.5px;color:var(--texto-2)">
        Presupuesto mensual: <b>$${presupuesto}</b>
        ${excedido ? `<span style="color:var(--peligro)"> · te pasas $${dinero(total - presupuesto)}</span>`
                   : `<span style="color:var(--ok)"> · te queda $${dinero(presupuesto - total)}</span>`}
      </label>
      <input type="range" id="presu-rango" min="0" max="300" step="5" value="${presupuesto}" style="width:100%;accent-color:var(--acento)">
      <div class="presu-barra ${excedido ? 'excedido' : ''}">
        <i style="width:${Math.min(100, presupuesto ? (total / presupuesto) * 100 : 100)}%"></i>
      </div>
    </div>

    ${ahorros.length ? `<div class="ahorro">
      <h4>💸 Modo ahorro: ${plural(ahorros.length, 'sustitución posible', 'sustituciones posibles')}</h4>
      ${ahorros.map((x) => `<div class="ahorro-fila">
        <span>${esc(x.h.nombre)} <small style="color:var(--texto-3)">$${dinero(x.h.desde)}</small></span>
        <span class="flecha">→</span>
        <button class="btn btn-sm btn-fantasma" data-sust="${esc(x.h.id)}|${esc(x.alt.id)}">
          <b>${esc(x.alt.nombre)}</b>
          <small style="color:var(--texto-3);font-weight:600">${totalmenteGratis(x.alt) ? 'gratis' : 'plan gratis'}</small>
        </button>
      </div>`).join('')}
      <div class="ahorro-total">Dejarías de pagar $${dinero(ahorroTotal)}/mes · $${dinero(ahorroTotal * 12)}/año</div>
      <p style="font-size:11.5px;color:var(--texto-2);margin:6px 0 0">
        Las marcadas como <b>plan gratis</b> son de pago pero tienen un nivel gratuito que puede bastarte.
      </p>
      <button class="btn btn-sm" id="sustituir-todo" style="margin-top:9px">Aplicar todas las sustituciones</button>
    </div>` : ''}

    ${hs.map((h) => `<div class="stack-item">
      ${logoHTML(h)}
      <span class="si-nom"><b>${esc(h.nombre)}</b><small>${h.cat.map((c) => catNom(c)).slice(0, 2).join(' · ')}</small></span>
      <span class="si-precio">${h.desde === 0 ? 'Gratis' : '$' + dinero(h.desde)}</span>
      <button class="quitar" data-q="${esc(h.id)}" aria-label="Quitar ${esc(h.nombre)}">✕</button>
    </div>`).join('')}
  `;

  pie.innerHTML = `
    <div style="display:flex;gap:7px;flex-wrap:wrap">
      <button class="btn btn-sm" id="stack-md">⬇️ Markdown</button>
      <button class="btn btn-sm" id="stack-csv">⬇️ CSV</button>
      <button class="btn btn-sm" id="stack-link">🔗 Compartir</button>
      <button class="btn btn-sm" id="stack-print">🖨️</button>
      <span style="flex:1"></span>
      <button class="btn btn-sm" id="stack-vaciar">Vaciar</button>
    </div>`;

  $('#presu-rango').addEventListener('input', (e) => {
    presupuesto = Number(e.target.value);
    guardar(LS.presu, presupuesto);
    pintarStack();
  });
  for (const b of $$('[data-q]', cuerpo)) b.addEventListener('click', () => alternarStack(b.dataset.q));
  for (const b of $$('[data-sust]', cuerpo)) {
    b.addEventListener('click', () => {
      const [de, a] = b.dataset.sust.split('|');
      stack.delete(de); stack.add(a);
      guardar(LS.stack, [...stack]);
      pintarStack(); pintarResultados(); guardarURL();
      aviso(`${PORID.get(de).nombre} → ${PORID.get(a).nombre}`);
    });
  }
  $('#sustituir-todo')?.addEventListener('click', () => {
    for (const x of ahorros) { stack.delete(x.h.id); stack.add(x.alt.id); }
    guardar(LS.stack, [...stack]);
    pintarStack(); pintarResultados(); guardarURL();
    aviso(`Stack optimizado: dejas de pagar $${dinero(ahorroTotal)}/mes`);
  });
  $('#stack-vaciar').addEventListener('click', () => {
    stack.clear(); guardar(LS.stack, []);
    pintarStack(); pintarResultados(); guardarURL();
  });
  $('#stack-md').addEventListener('click', () => exportarStackMD(hs, total));
  $('#stack-csv').addEventListener('click', () => exportarCSV(hs, 'mi-stack-ia.csv'));
  $('#stack-print').addEventListener('click', () => window.print());
  $('#stack-link').addEventListener('click', () => {
    const u = new URL(location.href);
    u.hash = 'stack=' + [...stack].join(',');
    navigator.clipboard?.writeText(u.toString()).then(
      () => aviso('Enlace de tu stack copiado'),
      () => aviso('No se pudo copiar'));
  });
}

function exportarStackMD(hs, total) {
  const l = [
    '# Mi stack de IA',
    '',
    `Generado el ${new Date().toLocaleDateString('es')} · Coste: **$${dinero(total)}/mes** ($${dinero(total * 12)}/año)`,
    '',
    '| Herramienta | Empresa | Precio | Para qué | Enlace |',
    '| --- | --- | --- | --- | --- |',
    ...hs.map((h) => `| ${h.nombre} | ${h.empresa} | ${h.desde === 0 ? 'Gratis' : '$' + dinero(h.desde) + '/mes'} | ${h.usos.slice(0, 2).join(', ')} | ${h.url} |`),
    '',
    '## Alternativas sin coste',
    '',
  ];
  for (const h of hs.filter((x) => x.desde > 0)) {
    const a = mejorAlternativaGratis(h);
    if (!a) continue;
    const tipo = a.precio === 'gratis' || a.precio === 'oss' ? 'gratis' : 'plan gratuito';
    l.push(`- **${h.nombre}** ($${dinero(h.desde)}/mes) → ${a.nombre} (${tipo}) — ${a.url}`);
  }
  l.push('', '_Precios de referencia. Verifica en el sitio oficial._');
  descargar('mi-stack-ia.md', l.join('\n'), 'text/markdown;charset=utf-8');
  aviso('Markdown descargado');
}

function exportarCSV(lista, nombre = 'directorio-ia.csv') {
  const cab = ['Nombre', 'Empresa', 'Categorias', 'Precio', 'Desde USD/mes', 'Plan gratuito',
    'API', 'Codigo abierto', 'Espanol 1-5', 'Privacidad', 'Plataformas', 'Nivel', 'Nota', 'URL'];
  const cel = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const filas = lista.map((h) => [
    h.nombre, h.empresa, h.cat.map((c) => catNom(c)).join(' / '), ETIQ_PRECIO[h.precio], h.desde,
    h.gratis || '', h.api ? 'Si' : 'No', h.oss ? 'Si' : 'No', h.es, ETIQ_PRIV[h.priv],
    h.plat.map((p) => ETIQ_PLAT[p]).join(' / '), ETIQ_NIVEL[h.nivel], h.score, h.url,
  ].map(cel).join(','));
  // BOM para que Excel abra el CSV en UTF-8 sin romper las tildes.
  descargar(nombre, '\uFEFF' + [cab.map(cel).join(','), ...filas].join('\r\n'), 'text/csv;charset=utf-8');
  aviso(`${lista.length} herramientas exportadas`);
}

function abrirStack(abrir = true) {
  $('#cajon-stack').classList.toggle('abierto', abrir);
  $('#velo').classList.toggle('visible', abrir);
}

/* ---------- Asistente ---------- */

const PREGUNTAS = [
  {
    id: 'obj', multi: true,
    titulo: '¿Qué quieres hacer con la IA?',
    sub: 'Puedes elegir varias opciones.',
    ops: [
      { v: 'chat', ico: '💬', txt: 'Escribir y conversar', sub: 'Textos, ideas, resúmenes' },
      { v: 'imagen', ico: '🎨', txt: 'Crear imágenes', sub: 'Ilustración, diseño, fotos' },
      { v: 'video', ico: '🎬', txt: 'Hacer vídeo', sub: 'Clips, avatares, edición' },
      { v: 'audio', ico: '🎙️', txt: 'Audio y voz', sub: 'Locución, doblaje, música' },
      { v: 'codigo', ico: '💻', txt: 'Programar', sub: 'Código y desarrollo' },
      { v: 'transcripcion', ico: '📝', txt: 'Transcribir reuniones', sub: 'Actas y subtítulos' },
      { v: 'investigacion', ico: '🔬', txt: 'Investigar', sub: 'Papers, fuentes, estudio' },
      { v: 'productividad', ico: '⚡', txt: 'Organizarme mejor', sub: 'Notas, agenda, correo' },
      { v: 'marketing', ico: '📣', txt: 'Marketing y ventas', sub: 'Contenido y campañas' },
      { v: 'agentes', ico: '🤖', txt: 'Automatizar procesos', sub: 'Agentes y flujos' },
      { v: 'presentaciones', ico: '📊', txt: 'Presentaciones', sub: 'Slides y documentos' },
      { v: 'educacion', ico: '🎓', txt: 'Enseñar o estudiar', sub: 'Clases y material' },
    ],
  },
  {
    id: 'presu', multi: false,
    titulo: '¿Cuánto puedes gastar al mes?',
    sub: 'Por herramienta, en dólares.',
    ops: [
      { v: '0', ico: '🆓', txt: 'Nada, solo gratis', sub: 'Plan gratuito o código abierto' },
      { v: '20', ico: '💵', txt: 'Hasta $20', sub: 'Una suscripción estándar' },
      { v: '50', ico: '💳', txt: 'Hasta $50', sub: 'Varias herramientas' },
      { v: '999', ico: '🚀', txt: 'Sin límite', sub: 'Prioriza la calidad' },
    ],
  },
  {
    id: 'nivel', multi: false,
    titulo: '¿Cuál es tu nivel técnico?',
    sub: 'Para no recomendarte algo que te frustre.',
    ops: [
      { v: '1', ico: '🌱', txt: 'Principiante', sub: 'Quiero abrir y usar' },
      { v: '2', ico: '🌿', txt: 'Intermedio', sub: 'Me apaño configurando' },
      { v: '3', ico: '🌳', txt: 'Avanzado', sub: 'Terminal y APIs sin miedo' },
    ],
  },
  {
    id: 'prio', multi: true,
    titulo: '¿Qué es importante para ti?',
    sub: 'Opcional. Elige lo que más te pese.',
    ops: [
      { v: 'es', ico: '🇪🇸', txt: 'Buen español', sub: 'Interfaz y resultados' },
      { v: 'priv', ico: '🔒', txt: 'Privacidad', sub: 'Que no usen mis datos' },
      { v: 'oss', ico: '📖', txt: 'Código abierto', sub: 'Auditable y sin ataduras' },
      { v: 'api', ico: '🔌', txt: 'Tener API', sub: 'Para integrarlo' },
      { v: 'facil', ico: '✨', txt: 'Que sea fácil', sub: 'Cero curva de aprendizaje' },
    ],
  },
];

const respuestas = { obj: new Set(), presu: '20', nivel: '1', prio: new Set() };
let pasoActual = 0;

function abrirAsistente() {
  pasoActual = 0;
  pintarAsistente();
  $('#dlg-asistente').showModal();
}

function pintarAsistente() {
  const cont = $('#asis-pasos');
  const totalPasos = PREGUNTAS.length + 1;
  $('#asis-progreso').style.width = `${((pasoActual + 1) / totalPasos) * 100}%`;

  if (pasoActual === PREGUNTAS.length) { cont.innerHTML = ''; cont.appendChild(vistaRecomendaciones()); return; }

  const p = PREGUNTAS[pasoActual];
  const sel = respuestas[p.id];
  const activo = (v) => (p.multi ? sel.has(v) : sel === v);

  cont.innerHTML = `<div class="paso activo">
    <h3>${esc(p.titulo)}</h3>
    <p class="sub">${esc(p.sub)}</p>
    <div class="tarjetas-op">
      ${p.ops.map((o) => `<button class="tarjeta-op" data-v="${esc(o.v)}" aria-pressed="${activo(o.v)}">
        <span class="ico" aria-hidden="true">${o.ico}</span>
        <span><b>${esc(o.txt)}</b><small>${esc(o.sub)}</small></span>
      </button>`).join('')}
    </div>
    <div class="paso-nav">
      ${pasoActual > 0 ? '<button class="btn" data-atras>← Atrás</button>' : ''}
      <span class="sep"></span>
      <button class="btn btn-pri" data-siguiente>
        ${pasoActual === PREGUNTAS.length - 1 ? 'Ver recomendaciones →' : 'Siguiente →'}
      </button>
    </div>
  </div>`;

  for (const b of $$('[data-v]', cont)) {
    b.addEventListener('click', () => {
      const v = b.dataset.v;
      if (p.multi) { sel.has(v) ? sel.delete(v) : sel.add(v); }
      else { respuestas[p.id] = v; }
      pintarAsistente();
    });
  }
  $('[data-atras]', cont)?.addEventListener('click', () => { pasoActual--; pintarAsistente(); });
  $('[data-siguiente]', cont).addEventListener('click', () => {
    if (p.id === 'obj' && !sel.size) { aviso('Elige al menos una opción'); return; }
    pasoActual++; pintarAsistente();
  });
}

function recomendar() {
  const objetivos = [...respuestas.obj];
  const presu = Number(respuestas.presu);
  const nivel = Number(respuestas.nivel);
  const prio = respuestas.prio;

  return DB.herramientas.map((h) => {
    const razones = [];
    let s = h.score * 3;

    const coincidencias = h.cat.filter((c) => objetivos.includes(c)).length;
    if (!coincidencias) return null;
    s += 40 + (coincidencias - 1) * 12;

    if (presu === 0) {
      if (!tieneGratis(h)) return null;
      if (h.precio === 'gratis' || h.precio === 'oss') { s += 34; razones.push('Sin coste'); }
      else { s += 18; razones.push('Tiene plan gratuito'); }
    } else if (h.desde > presu) {
      return null;
    } else if (h.desde === 0) {
      s += 20; razones.push('Entra sin gastar');
    } else {
      s += 12; razones.push(`Cabe en tu presupuesto ($${h.desde})`);
    }

    if (h.nivel <= nivel) s += 14;
    else s -= 26 * (h.nivel - nivel);

    if (prio.has('es')) {
      if (h.es >= 5) { s += 16; razones.push('Español excelente'); }
      else if (h.es <= 3) s -= 12;
    }
    if (prio.has('priv')) {
      if (h.priv === 'local') { s += 20; razones.push('Corre en tu equipo'); }
      else if (h.priv === 'no-entrena') { s += 12; razones.push('No entrena con tus datos'); }
      else if (h.priv === 'entrena') s -= 18;
    }
    if (prio.has('oss')) {
      if (h.oss) { s += 18; razones.push('Código abierto'); }
      else s -= 10;
    }
    if (prio.has('api')) {
      if (h.api) { s += 14; razones.push('Tiene API'); }
      else s -= 14;
    }
    if (prio.has('facil')) {
      if (h.nivel === 1) { s += 16; razones.push('Fácil de empezar'); }
      else s -= 10 * (h.nivel - 1);
    }
    if (h.destacado) { s += 8; razones.push('Referencia de su categoría'); }

    return { h, s, razones };
  }).filter(Boolean).sort((a, b) => b.s - a.s).slice(0, 8);
}

function vistaRecomendaciones() {
  const recos = recomendar();
  const div = document.createElement('div');
  div.className = 'paso activo';

  if (!recos.length) {
    div.innerHTML = `<h3>No encontramos coincidencias</h3>
      <p class="sub">Con ese presupuesto y esos objetivos no hay nada en el directorio. Prueba a subir el presupuesto.</p>
      <div class="paso-nav"><button class="btn" data-atras>← Cambiar respuestas</button></div>`;
    $('[data-atras]', div).addEventListener('click', () => { pasoActual--; pintarAsistente(); });
    return div;
  }

  const totalGratis = recos.filter((r) => r.h.desde === 0).length;
  div.innerHTML = `
    <h3>Tus ${recos.length} recomendaciones</h3>
    <p class="sub">${totalGratis} de ellas no requieren pago. Ordenadas por encaje con tus respuestas.</p>
    <div class="reco">
      ${recos.map((r, i) => `<div class="reco-item">
        <span class="rank">${i + 1}</span>
        ${logoHTML(r.h)}
        <div style="flex:1;min-width:0">
          <b>${esc(r.h.nombre)}</b>
          <span style="color:var(--texto-3);font-size:12px"> · ${esc(r.h.empresa)} · ${r.h.desde === 0 ? 'gratis' : '$' + r.h.desde + '/mes'}</span>
          <div style="font-size:12.5px;color:var(--texto-2);margin-top:2px">${esc(r.h.desc)}</div>
          <p class="por-que">${r.razones.slice(0, 4).map((x) => `<span>${esc(x)}</span>`).join('')}</p>
        </div>
        <div style="display:flex;flex-direction:column;gap:5px">
          <button class="btn btn-sm" data-ficha="${esc(r.h.id)}">Ficha</button>
          <button class="btn btn-sm" data-add="${esc(r.h.id)}">＋ Stack</button>
        </div>
      </div>`).join('')}
    </div>
    <div class="paso-nav">
      <button class="btn" data-atras>← Cambiar respuestas</button>
      <span class="sep"></span>
      <button class="btn" data-todas>＋ Añadir todas a mi stack</button>
      <button class="btn btn-pri" data-filtrar>Ver estas categorías en el directorio</button>
    </div>`;

  $('[data-atras]', div).addEventListener('click', () => { pasoActual--; pintarAsistente(); });
  for (const b of $$('[data-ficha]', div)) b.addEventListener('click', () => abrirDetalle(b.dataset.ficha));
  for (const b of $$('[data-add]', div)) {
    b.addEventListener('click', () => { alternarStack(b.dataset.add); b.textContent = stack.has(b.dataset.add) ? '✓ En stack' : '＋ Stack'; });
  }
  $('[data-todas]', div).addEventListener('click', () => {
    for (const r of recos) stack.add(r.h.id);
    guardar(LS.stack, [...stack]);
    pintarStack(); pintarResultados(); guardarURL();
    $('#dlg-asistente').close();
    abrirStack(true);
  });
  $('[data-filtrar]', div).addEventListener('click', () => {
    F.cat.clear();
    for (const o of respuestas.obj) F.cat.add(o);
    const p = Number(respuestas.presu);
    F.max = p >= 999 ? null : p;
    F.nivel.clear();
    for (let i = 1; i <= Number(respuestas.nivel); i++) F.nivel.add(i);
    if (respuestas.prio.has('oss')) F.oss = true;
    if (respuestas.prio.has('api')) F.api = true;
    if (respuestas.prio.has('es')) F.es = 5;
    if (respuestas.prio.has('priv')) { F.priv.clear(); F.priv.add('local'); F.priv.add('no-entrena'); }
    $('#dlg-asistente').close();
    pintarFiltros();
    actualizar();
    $('#resultados').scrollIntoView({ block: 'start' });
  });
  return div;
}

/* ---------- Estadísticas ---------- */

function barras(titulo, datos, max) {
  const tope = max || Math.max(...datos.map((d) => d[1]), 1);
  return `<div class="stats-caja"><h4>${esc(titulo)}</h4>
    ${datos.map(([et, n]) => `<div class="barra-fila">
      <div class="bf-top"><span>${esc(et)}</span><b>${n}</b></div>
      <div class="barra-pista"><i style="width:${(n / tope) * 100}%"></i></div>
    </div>`).join('')}</div>`;
}

function abrirStats() {
  const hs = DB.herramientas;
  const n = hs.length;
  const conteo = (pred) => hs.filter(pred).length;

  const porPrecio = Object.entries(ETIQ_PRECIO).map(([v, t]) => [t, conteo((h) => h.precio === v)]);
  const porCat = DB.categorias
    .map((c) => [`${c.emoji} ${c.nombre}`, conteo((h) => h.cat.includes(c.id))])
    .sort((a, b) => b[1] - a[1]).slice(0, 12);
  const porPriv = Object.entries(ETIQ_PRIV).map(([v, t]) => [t, conteo((h) => h.priv === v)]);
  const porPlat = Object.entries(ETIQ_PLAT)
    .map(([v, t]) => [t, conteo((h) => h.plat.includes(v))]).sort((a, b) => b[1] - a[1]);
  const porNivel = Object.entries(ETIQ_NIVEL).map(([v, t]) => [t, conteo((h) => h.nivel === Number(v))]);
  const porEs = [5, 4, 3, 2, 1].map((v) => [`${'★'.repeat(v)}`, conteo((h) => h.es === v)]);

  const pagas = hs.filter((h) => h.desde > 0);
  const medio = pagas.reduce((s, h) => s + h.desde, 0) / (pagas.length || 1);
  const masBaratas = pagas.slice().sort((a, b) => a.desde - b.desde).slice(0, 5);

  $('#stats-cuerpo').innerHTML = `
    <div class="ficha-rejilla" style="margin-bottom:18px">
      <div class="dato"><dt>Herramientas</dt><dd style="font-size:22px">${n}</dd></div>
      <div class="dato"><dt>Usables sin pagar</dt><dd style="font-size:22px">${conteo(tieneGratis)} <small style="font-size:12px;color:var(--texto-3)">(${Math.round(conteo(tieneGratis) / n * 100)}%)</small></dd></div>
      <div class="dato"><dt>Código abierto</dt><dd style="font-size:22px">${conteo((h) => h.oss)}</dd></div>
      <div class="dato"><dt>Ejecutables en local</dt><dd style="font-size:22px">${conteo((h) => h.priv === 'local')}</dd></div>
      <div class="dato"><dt>Precio medio de pago</dt><dd style="font-size:22px">$${medio.toFixed(0)}<small style="font-size:12px">/mes</small></dd></div>
      <div class="dato"><dt>Con API</dt><dd style="font-size:22px">${conteo((h) => h.api)}</dd></div>
    </div>

    <div class="stats-rejilla">
      ${barras('Modelo de precio', porPrecio)}
      ${barras('Privacidad de tus datos', porPriv)}
      ${barras('Nivel requerido', porNivel)}
      ${barras('Calidad en español', porEs)}
      ${barras('Categorías con más opciones', porCat)}
      ${barras('Plataformas soportadas', porPlat)}
      <div class="stats-caja">
        <h4>Las de pago más asequibles</h4>
        ${masBaratas.map((h) => `<div class="barra-fila"><div class="bf-top">
          <span>${esc(h.nombre)}</span><b>$${h.desde}</b></div></div>`).join('')}
      </div>
      <div class="stats-caja">
        <h4>Mantenimiento</h4>
        <div class="barra-fila"><div class="bf-top"><span>Última actualización</span><b>${esc(DB.meta.actualizado)}</b></div></div>
        <div class="barra-fila"><div class="bf-top"><span>Novedades (${DIAS_NOVEDAD} días)</span><b>${conteo(esNueva)}</b></div></div>
        <div class="barra-fila"><div class="bf-top"><span>Versión de los datos</span><b>${esc(DB.meta.version || '—')}</b></div></div>
      </div>
    </div>
    <p style="color:var(--texto-3);font-size:12px;margin-top:14px">${esc(DB.meta.nota || '')}</p>`;

  $('#dlg-stats').showModal();
}

/* ---------- Paleta de comandos ---------- */

const ACCIONES = [
  { nombre: 'Abrir el asistente de elección', ico: '🧭', fn: () => abrirAsistente() },
  { nombre: 'Ver mi stack y su coste', ico: '🧰', fn: () => abrirStack(true) },
  { nombre: 'Abrir el comparador', ico: '⚖️', fn: () => abrirComparador() },
  { nombre: 'Ver estadísticas del directorio', ico: '📊', fn: () => abrirStats() },
  { nombre: 'Herramienta al azar', ico: '🎲', fn: () => sorpresa() },
  { nombre: 'Cambiar tema claro / oscuro', ico: '🌗', fn: () => alternarTema() },
  { nombre: 'Limpiar todos los filtros', ico: '🧹', fn: () => limpiarFiltros() },
  { nombre: 'Exportar resultados a CSV', ico: '⬇️', fn: () => exportarCSV(resultados) },
  { nombre: 'Solo herramientas gratuitas', ico: '🎁', fn: () => { F.conGratis = true; pintarFiltros(); actualizar(); } },
  { nombre: 'Solo herramientas locales / privadas', ico: '🔒', fn: () => { F.priv.clear(); F.priv.add('local'); pintarFiltros(); actualizar(); } },
];

let paletaItems = [];
let paletaSel = 0;

function abrirPaleta() {
  $('#paleta').classList.add('abierta');
  const inp = $('#paleta-q');
  inp.value = '';
  filtrarPaleta('');
  inp.focus();
}
function cerrarPaleta() { $('#paleta').classList.remove('abierta'); }

function filtrarPaleta(q) {
  const t = q.trim() ? terminosDe(q) : [];
  const acc = ACCIONES
    .filter((a) => !t.length || t.some((x) => norm(a.nombre).includes(x)))
    .map((a) => ({ tipo: 'accion', a }));

  const hs = (t.length
    ? DB.herramientas.map((h) => ({ h, s: puntuarBusqueda(h, t, false) })).filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s || b.h.score - a.h.score).map((x) => x.h)
    : DB.herramientas.filter((h) => h.destacado).sort((a, b) => b.score - a.score)
  ).slice(0, 12).map((h) => ({ tipo: 'tool', h }));

  paletaItems = [...acc.slice(0, t.length ? 4 : 5), ...hs];
  paletaSel = 0;
  pintarPaleta();
}

function pintarPaleta() {
  const cont = $('#paleta-lista');
  if (!paletaItems.length) {
    cont.innerHTML = '<div style="padding:20px;text-align:center;color:var(--texto-3)">Sin coincidencias</div>';
    return;
  }
  cont.innerHTML = paletaItems.map((it, i) => {
    const sel = i === paletaSel ? ' sel' : '';
    if (it.tipo === 'accion') {
      return `<div class="paleta-item${sel}" data-i="${i}">
        <span class="logo" style="background:var(--panel-hover);color:var(--texto)" aria-hidden="true">${it.a.ico}</span>
        <span class="pi-nom"><b>${esc(it.a.nombre)}</b><small>Acción</small></span></div>`;
    }
    const h = it.h;
    return `<div class="paleta-item${sel}" data-i="${i}">
      ${logoHTML(h)}
      <span class="pi-nom"><b>${esc(h.nombre)}</b><small>${esc(h.empresa)} · ${h.desde === 0 ? 'gratis' : '$' + h.desde + '/mes'} · ${esc(h.desc)}</small></span></div>`;
  }).join('');

  for (const el of $$('.paleta-item', cont)) {
    el.addEventListener('mouseenter', () => { paletaSel = Number(el.dataset.i); pintarPaleta(); });
    el.addEventListener('click', () => ejecutarPaleta(false));
  }
  cont.querySelector('.sel')?.scrollIntoView({ block: 'nearest' });
}

function ejecutarPaleta(irAlSitio) {
  const it = paletaItems[paletaSel];
  if (!it) return;
  cerrarPaleta();
  if (it.tipo === 'accion') { it.a.fn(); return; }
  if (irAlSitio) window.open(it.h.url, '_blank', 'noopener');
  else abrirDetalle(it.h.id);
}

/* ---------- Varios ---------- */

function sorpresa() {
  const pool = resultados.length ? resultados : DB.herramientas;
  const h = pool[Math.floor(Math.random() * pool.length)];
  abrirDetalle(h.id);
}

function alternarTema() {
  const nuevo = document.documentElement.dataset.tema === 'claro' ? 'oscuro' : 'claro';
  document.documentElement.dataset.tema = nuevo;
  $('#btn-tema').textContent = nuevo === 'claro' ? '☀️' : '🌙';
  guardar(LS.tema, nuevo);
}

function cambiarVista(v) {
  vista = v;
  guardar(LS.vista, v);
  for (const b of $$('.vistas button')) b.setAttribute('aria-pressed', String(b.dataset.vista === v));
  pintarResultados();
  guardarURL();
}

/* ---------- Estado en la URL ---------- */

function guardarURL() {
  const p = new URLSearchParams();
  if (F.q) p.set('q', F.q);
  if (F.cat.size) p.set('cat', [...F.cat].join(','));
  if (F.precio.size) p.set('precio', [...F.precio].join(','));
  if (F.priv.size) p.set('priv', [...F.priv].join(','));
  if (F.plat.size) p.set('plat', [...F.plat].join(','));
  if (F.nivel.size) p.set('nivel', [...F.nivel].join(','));
  if (F.es) p.set('es', F.es);
  if (F.max !== null) p.set('max', F.max);
  if (F.api) p.set('api', '1');
  if (F.oss) p.set('oss', '1');
  if (F.conGratis) p.set('gratis', '1');
  if (F.nuevas) p.set('nuevas', '1');
  if (F.favs) p.set('favs', '1');
  if (orden !== 'destacados') p.set('orden', orden);
  if (vista !== 'grid') p.set('vista', vista);
  if (comparador.length) p.set('comp', comparador.join(','));
  const s = p.toString();
  history.replaceState(null, '', s ? '?' + s : location.pathname);
}

function cargarURL() {
  const p = new URLSearchParams(location.search);
  const set = (clave, conjunto, num = false) => {
    const v = p.get(clave);
    if (!v) return;
    for (const x of v.split(',')) if (x) conjunto.add(num ? Number(x) : x);
  };
  F.q = p.get('q') || '';
  set('cat', F.cat); set('precio', F.precio); set('priv', F.priv);
  set('plat', F.plat); set('nivel', F.nivel, true);
  if (p.has('es')) F.es = Number(p.get('es')) || 0;
  if (p.has('max')) F.max = Number(p.get('max'));
  F.api = p.get('api') === '1';
  F.oss = p.get('oss') === '1';
  F.conGratis = p.get('gratis') === '1';
  F.nuevas = p.get('nuevas') === '1';
  F.favs = p.get('favs') === '1';
  if (p.has('orden')) orden = p.get('orden');
  if (p.has('vista')) vista = p.get('vista');
  if (p.has('comp')) comparador = p.get('comp').split(',').filter(Boolean).slice(0, 4);

  // Enlaces profundos por hash: #h=chatgpt  |  #stack=a,b,c
  // Se guarda aparte porque guardarURL() limpia el hash al reescribir la URL.
  hashInicial = decodeURIComponent(location.hash.replace(/^#/, ''));
  if (hashInicial.startsWith('stack=')) {
    for (const id of hashInicial.slice(6).split(',')) if (id) stack.add(id);
    guardar(LS.stack, [...stack]);
  }
}

/* ---------- Actualizar todo ---------- */

function actualizar({ soloResultados = false } = {}) {
  filtrar();
  pintarResultados();
  const n = resultados.length;
  $('#conteo').innerHTML = `<b>${n}</b> de ${DB.herramientas.length} herramientas`;
  if (!soloResultados) { pintarActivos(); pintarChips(); }
  guardarURL();
}

/* ---------- Arranque ---------- */

function pintarHeroStats() {
  const hs = DB.herramientas;
  const datos = [
    [hs.length, 'herramientas'],
    [hs.filter(tieneGratis).length, 'con plan gratis'],
    [hs.filter((h) => h.oss).length, 'código abierto'],
    [hs.filter((h) => h.priv === 'local').length, 'ejecutables en local'],
    [DB.categorias.length, 'categorías'],
  ];
  $('#hero-stats').innerHTML = datos
    .map(([b, s]) => `<div class="stat"><b>${b}</b><span>${esc(s)}</span></div>`).join('');
}

function conectarEventos() {
  // Búsqueda con rebote
  let t;
  $('#q').addEventListener('input', (e) => {
    clearTimeout(t);
    t = setTimeout(() => {
      F.q = e.target.value.trim();
      if (F.q && orden === 'destacados') { orden = 'relevancia'; $('#orden').value = 'relevancia'; }
      actualizar();
    }, 140);
  });

  $('#orden').addEventListener('change', (e) => { orden = e.target.value; actualizar({ soloResultados: true }); guardarURL(); });
  for (const b of $$('.vistas button')) b.addEventListener('click', () => cambiarVista(b.dataset.vista));

  $('#btn-tema').addEventListener('click', alternarTema);
  $('#btn-asistente').addEventListener('click', abrirAsistente);
  $('#btn-stats').addEventListener('click', abrirStats);
  $('#btn-comparar').addEventListener('click', abrirComparador);
  $('#btn-sorpresa').addEventListener('click', sorpresa);
  $('#btn-exportar').addEventListener('click', () => exportarCSV(resultados));
  $('#btn-limpiar').addEventListener('click', limpiarFiltros);
  $('#btn-atajos').addEventListener('click', () => $('#dlg-atajos').showModal());
  $('#btn-vaciar-comp').addEventListener('click', () => {
    comparador = [];
    $('#comp-n').textContent = ''; $('#comp-n').dataset.n = 0;
    $('#btn-comparar').disabled = true;
    for (const c of $$('.card')) c.classList.remove('en-comparador');
    $('#dlg-comparar').close();
    guardarURL();
  });

  $('#btn-stack').addEventListener('click', () => abrirStack(true));
  $('#cerrar-stack').addEventListener('click', () => abrirStack(false));
  $('#velo').addEventListener('click', () => { abrirStack(false); cerrarFiltrosMovil(); });

  $('#btn-filtros').addEventListener('click', () => {
    const abierto = $('#filtros').classList.toggle('abierto');
    $('#velo').classList.toggle('visible', abierto);
  });

  // Diálogos: botones de cierre y clic en el fondo
  for (const dlg of $$('dialog')) {
    for (const b of $$('[data-cerrar]', dlg)) b.addEventListener('click', () => dlg.close());
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  }

  // Paleta de comandos
  $('#paleta-q').addEventListener('input', (e) => filtrarPaleta(e.target.value));
  $('#paleta').addEventListener('click', (e) => { if (e.target.id === 'paleta') cerrarPaleta(); });
  $('#paleta-q').addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); paletaSel = Math.min(paletaSel + 1, paletaItems.length - 1); pintarPaleta(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); paletaSel = Math.max(paletaSel - 1, 0); pintarPaleta(); }
    else if (e.key === 'Enter') { e.preventDefault(); ejecutarPaleta(e.ctrlKey || e.metaKey); }
    else if (e.key === 'Escape') cerrarPaleta();
  });

  // Atajos globales
  document.addEventListener('keydown', (e) => {
    const enCampo = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); abrirPaleta(); return; }
    if (e.key === 'Escape') {
      cerrarPaleta();
      if ($('#cajon-stack').classList.contains('abierto')) abrirStack(false);
      cerrarFiltrosMovil();
      return;
    }
    if (enCampo || e.ctrlKey || e.metaKey || e.altKey) return;

    if (e.key === '/') { e.preventDefault(); $('#q').focus(); $('#q').select(); return; }
    if (e.key === '?') { $('#dlg-atajos').showModal(); return; }
    const k = e.key.toLowerCase();
    if (k === 'a') abrirAsistente();
    else if (k === 's') abrirStack(!$('#cajon-stack').classList.contains('abierto'));
    else if (k === 'c') { if (comparador.length >= 2) abrirComparador(); else aviso('Selecciona al menos dos herramientas'); }
    else if (k === 'r') sorpresa();
    else if (k === 't') alternarTema();
    else if (k === 'd') abrirStats();
    else if (k === 'x' && e.shiftKey) limpiarFiltros();
  });
}

function cerrarFiltrosMovil() {
  if ($('#filtros').classList.contains('abierto')) {
    $('#filtros').classList.remove('abierto');
    if (!$('#cajon-stack').classList.contains('abierto')) $('#velo').classList.remove('visible');
  }
}

async function iniciar() {
  // Tema
  const guardado = leer(LS.tema, null);
  const prefiereClaro = window.matchMedia?.('(prefers-color-scheme: light)').matches;
  const tema = guardado || (prefiereClaro ? 'claro' : 'oscuro');
  document.documentElement.dataset.tema = tema;
  $('#btn-tema').textContent = tema === 'claro' ? '☀️' : '🌙';

  // Datos
  try {
    const r = await fetch('data/tools.json', { cache: 'no-cache' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    DB = await r.json();
  } catch (err) {
    $('#resultados').innerHTML = `<div class="vacio">
      <span class="emoji">📡</span>
      <h3>No se pudieron cargar los datos</h3>
      <p>${location.protocol === 'file:'
        ? 'Estás abriendo el archivo directamente desde el disco y el navegador bloquea la lectura de <code>data/tools.json</code>.<br>Levanta un servidor local: <code>npx serve</code> o <code>python -m http.server</code>.'
        : esc(err.message)}</p></div>`;
    return;
  }

  PORID = new Map(DB.herramientas.map((h) => [h.id, h]));
  CATNOM = new Map(DB.categorias.map((c) => [c.id, c.nombre]));
  CATEMOJI = new Map(DB.categorias.map((c) => [c.id, c.emoji]));
  // Las "novedades" se calculan respecto a la fecha de actualización del catálogo,
  // no respecto a hoy: así el badge sigue siendo correcto meses después.
  const ref = Date.parse(DB.meta.actualizado);
  LIMITE_NOVEDAD = (Number.isNaN(ref) ? Date.now() : ref) - DIAS_NOVEDAD * 864e5;

  $('#pie-total').textContent = DB.herramientas.length;
  $('#pie-fecha').textContent = DB.meta.actualizado || '—';

  cargarURL();
  $('#q').value = F.q;
  $('#orden').value = orden;
  for (const b of $$('.vistas button')) b.setAttribute('aria-pressed', String(b.dataset.vista === vista));
  comparador = comparador.filter((id) => PORID.has(id));
  favoritos = new Set([...favoritos].filter((id) => PORID.has(id)));
  stack = new Set([...stack].filter((id) => PORID.has(id)));

  pintarHeroStats();
  pintarFiltros();
  pintarStack();
  conectarEventos();
  actualizar();

  const n = comparador.length;
  $('#comp-n').textContent = n || '';
  $('#comp-n').dataset.n = n;
  $('#btn-comparar').disabled = n < 2;

  // Enlace profundo a una ficha
  if (hashInicial.startsWith('h=')) abrirDetalle(hashInicial.slice(2));
  if (hashInicial.startsWith('stack=')) abrirStack(true);

  // Modo offline solo en producción: en local estorba más de lo que ayuda,
  // porque serviría la versión anterior de los archivos mientras editas.
  const enLocal = ['localhost', '127.0.0.1', '::1'].includes(location.hostname);
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    if (enLocal) {
      navigator.serviceWorker.getRegistrations?.()
        .then((rs) => rs.forEach((r) => r.unregister()))
        .catch(() => {});
      caches?.keys?.().then((ks) => ks.forEach((k) => caches.delete(k))).catch(() => {});
    } else {
      navigator.serviceWorker.register('sw.js').catch(() => { /* sin modo offline */ });
    }
  }
}

iniciar();
