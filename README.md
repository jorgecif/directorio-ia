# Directorio IA

Directorio comparativo de herramientas de IA generativa: **148 herramientas** en 21 categorías,
con precios, política de privacidad, calidad en español, plataformas y alternativas equivalentes.

Sitio **estático puro**: sin framework, sin build, sin dependencias de npm. Todo el contenido vive
en un único archivo JSON que puedes editar a mano y publicar en cualquier hosting gratuito.

---

## Qué puede hacer quien lo visita

| Función | Qué resuelve |
| --- | --- |
| **Búsqueda en lenguaje natural** | Entiende frases como *"quitar el fondo de una foto"* o *"transcribir reuniones"*: quita muletillas, aplica sinónimos en español y recorta raíces (*quitar* encuentra *quita*). |
| **Filtros combinables** | Precio, presupuesto máximo por herramienta, privacidad de datos, calidad en español, plataforma, nivel técnico, API, código abierto, novedades y favoritos. Cada filtro indica cuántas herramientas cumple. |
| **Asistente de elección** | Cuatro preguntas y devuelve 8 recomendaciones puntuadas, **explicando por qué** encaja cada una. |
| **Mi stack con presupuesto** | Selecciona herramientas y calcula el coste mensual y anual, con barra de presupuesto. |
| **Modo ahorro** | Para cada herramienta de pago del stack propone la mejor alternativa sin coste y calcula lo que dejarías de pagar. Distingue lo gratis de verdad de lo que solo tiene plan gratuito. |
| **Comparador** | Hasta 4 herramientas lado a lado, resaltando la opción más favorable de cada fila. |
| **Tres vistas** | Tarjetas, lista compacta y tabla comparativa de 12 columnas. |
| **Paleta de comandos** | `Ctrl/⌘ K` para saltar a cualquier herramienta o ejecutar acciones. |
| **Radiografía del directorio** | Estadísticas del catálogo: reparto de precios, privacidad, niveles, categorías. |
| **Exportar** | Resultados a CSV (con BOM, abre bien en Excel) y el stack a Markdown. |
| **Enlaces compartibles** | El estado de filtros va en la URL. También `#h=chatgpt` para una ficha y `#stack=a,b,c` para un stack. |
| **Funciona sin conexión** | PWA instalable: el catálogo se guarda en caché tras la primera visita. |
| **Extras** | Tema claro/oscuro, favoritos persistentes, descubrimiento del día, herramienta al azar, atajos de teclado, impresión limpia. |

Atajos: `/` buscar · `Ctrl K` paleta · `A` asistente · `S` stack · `C` comparador · `R` azar ·
`T` tema · `D` datos · `Shift X` limpiar · `?` ayuda.

---

## Estructura

```
.
├── index.html                 # Toda la interfaz
├── assets/
│   ├── styles.css             # Estilos (tema oscuro y claro)
│   ├── app.js                 # Lógica: búsqueda, filtros, stack, asistente
│   └── icono*.svg             # Iconos de la PWA
├── data/
│   └── tools.json             # ← EL CATÁLOGO. Es lo único que tocarás normalmente.
├── scripts/
│   ├── validar.mjs            # Comprueba el JSON antes de publicar
│   ├── sellar.mjs             # Pone la fecha de actualización y sube la versión
│   └── servir.mjs             # Servidor local sin dependencias
├── sw.js                      # Service worker (modo sin conexión)
├── manifest.webmanifest
├── netlify.toml               # Config para Netlify / Cloudflare Pages
└── .github/workflows/deploy.yml   # Publicación automática en GitHub Pages
```

---

## Verlo en local

```bash
node scripts/servir.mjs
```

Abre <http://localhost:4321>. No hay que instalar nada: solo Node 18 o superior.

> **No abras `index.html` haciendo doble clic.** El navegador bloquea la lectura de
> `data/tools.json` desde `file://` y la página te lo avisará. Usa el servidor.

En `localhost` el service worker se desactiva solo, para que no te sirva la versión anterior
de los archivos mientras editas.

---

## Actualizar el catálogo

Todo el contenido está en [`data/tools.json`](data/tools.json). El flujo es siempre el mismo:

```bash
# 1. Editas data/tools.json (añades, corriges precios, retiras herramientas)
# 2. Marcas la fecha de actualización y subes la versión de datos
node scripts/sellar.mjs

# 3. Validas antes de publicar
node scripts/validar.mjs

# 4. Publicas
git add -A && git commit -m "Actualiza catálogo" && git push
```

También como scripts de npm: `npm run dev`, `npm run validar`, `npm run sellar`, `npm run publicar`.

### Añadir una herramienta

Copia esta plantilla dentro del array `herramientas`:

```json
{
  "id": "identificador-en-minusculas",
  "nombre": "Nombre visible",
  "empresa": "Quién la hace",
  "url": "https://ejemplo.com",
  "desc": "Qué hace y por qué merece estar aquí. Máximo 240 caracteres.",
  "cat": ["imagen", "diseno"],
  "precio": "freemium",
  "desde": 12,
  "gratis": "Qué incluye el plan gratuito, o null si no hay",
  "api": true,
  "oss": false,
  "es": 4,
  "priv": "opt-out",
  "plat": ["web", "ios"],
  "nivel": 1,
  "usos": ["Caso de uso 1", "Caso de uso 2"],
  "alt": ["otro-id", "otro-id-2"],
  "score": 8.5,
  "destacado": false,
  "agregado": "2026-08-15"
}
```

### Valores admitidos

| Campo | Valores | Significado |
| --- | --- | --- |
| `precio` | `gratis` | Sin plan de pago obligatorio |
| | `freemium` | Plan gratuito útil + planes de pago |
| | `pago` | Requiere pagar (puede tener prueba) |
| | `oss` | Código abierto, gratis y autoalojable |
| `desde` | número | Plan individual mensual de pago más barato, en USD. `0` si no hay que pagar |
| `priv` | `local` | Corre en el equipo del usuario, los datos no salen |
| | `no-entrena` | No entrena sus modelos con datos del usuario por defecto |
| | `opt-out` | Puede entrenar, pero se desactiva en ajustes |
| | `entrena` | Entrena con los datos salvo plan empresarial |
| `es` | 1 a 5 | Calidad del soporte en español |
| `nivel` | 1, 2, 3 | Principiante / intermedio / avanzado |
| `plat` | `web` `ios` `android` `win` `mac` `linux` `ext` `api` `cli` | Dónde se usa |
| `cat` | ids de `categorias` | Al menos una |
| `alt` | ids existentes | Alternativas; alimentan el modo ahorro |
| `score` | 0 a 10 | Valoración editorial, con un decimal |
| `destacado` | booleano | Sale primero en el orden por defecto |
| `agregado` | `YYYY-MM-DD` | Se marca como «nuevo» durante 45 días desde `meta.actualizado` |

### Qué comprueba el validador

Campos obligatorios, ids duplicados o con formato raro, categorías y plataformas inexistentes,
rangos de `es`/`nivel`/`score`, formato de fechas, URLs, coherencia entre `precio` y `desde`,
y referencias de `alt` que apunten a herramientas que no existen.

```bash
node scripts/validar.mjs                 # informe
node scripts/validar.mjs --arreglar-alt  # además limpia las referencias huérfanas
```

Devuelve código de salida distinto de cero si hay errores, así que **el despliegue automático
se detiene si el JSON está mal**.

### Añadir una categoría

En el array `categorias` de `data/tools.json`:

```json
{ "id": "robotica", "nombre": "Robótica", "emoji": "🦾" }
```

Aparece sola en los filtros, en el asistente no (esa lista está en `PREGUNTAS` de `app.js`)
y en las estadísticas.

---

## Publicar gratis

Las tres opciones son gratuitas para un sitio estático. **Cloudflare Pages** es la más
cómoda si no quieres tocar GitHub Actions.

### Opción A — GitHub Pages (ya configurado)

```bash
git init
git add -A
git commit -m "Directorio IA"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/directorio-ia.git
git push -u origin main
```

Luego en GitHub: **Settings → Pages → Source: GitHub Actions**. Con eso, cada `git push` a `main`
valida el JSON y publica. Queda en `https://TU-USUARIO.github.io/directorio-ia/`.

El flujo de trabajo está en [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).

### Opción B — Cloudflare Pages

1. Entra en el panel de Cloudflare → **Workers & Pages → Create → Pages**.
2. Conecta el repositorio de GitHub.
3. Build command: `node scripts/validar.mjs` · Output directory: `/` (raíz).

Sin límite de ancho de banda en el plan gratuito y con red global.

### Opción C — Netlify

Arrastra la carpeta a <https://app.netlify.com/drop> para una prueba rápida, o conecta el
repositorio para que se actualice con cada push. La configuración ya está en
[`netlify.toml`](netlify.toml).

### Después de desplegar

Si cambias `index.html`, `app.js` o `styles.css`, sube el número de `VERSION` en
[`sw.js`](sw.js). Sin eso, quien ya haya visitado el sitio verá los archivos antiguos
hasta la segunda recarga. **Los cambios de `data/tools.json` no necesitan nada**: el service
worker siempre pide el catálogo a la red antes de mirar la caché.

---

## Mantenimiento recomendado

Los precios de la IA cambian mucho. Un ritmo realista:

- **Cada mes** — repasar los precios de las herramientas marcadas como `destacado`, que son
  las más visibles. Ejecutar `sellar.mjs` para que la fecha del pie refleje la revisión.
- **Cada trimestre** — repasar todo el catálogo, retirar lo que haya cerrado y añadir lo nuevo.
- **Cuando añadas algo** — poner `agregado` con la fecha real: así aparece con la insignia
  ✨ Nuevo y en el filtro de novedades durante 45 días.

Si retiras una herramienta, ejecuta `node scripts/validar.mjs --arreglar-alt` para que ninguna
otra la siga referenciando como alternativa.

---

## Aviso sobre los precios

Las cifras son el **plan individual mensual de pago más barato en USD** en la fecha de
`meta.actualizado`, y sirven para comparar, no para presupuestar. Cambian con frecuencia,
varían por país e impuestos, y muchos productos ofrecen descuento anual. La interfaz lo
advierte en el pie y en cada ficha. Verifica siempre en el sitio oficial antes de contratar.

## Licencia

Código bajo MIT. El contenido del catálogo (descripciones y valoraciones) es trabajo editorial
propio; los nombres y marcas pertenecen a sus respectivos titulares.
