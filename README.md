# Directorio IA

Directorio comparativo de herramientas de IA generativa: **149 herramientas** en 22 categorías,
con precios, política de privacidad, calidad en español, plataformas y alternativas equivalentes.

Sitio **estático puro**: sin framework, sin build, sin dependencias de npm. Todo el contenido vive
en un único archivo JSON que puedes editar a mano y publicar en cualquier hosting gratuito.

---

## Qué puede hacer quien lo visita

| Función | Qué resuelve |
| --- | --- |
| **Búsqueda en lenguaje natural** | Entiende frases como *"quitar el fondo de una foto"* o *"transcribir reuniones"*: quita muletillas, aplica sinónimos en español y recorta raíces (*quitar* encuentra *quita*). |
| **Filtros combinables** | Precio, presupuesto máximo por herramienta, privacidad de datos, calidad en español, plataforma, nivel técnico, API, código abierto, novedades, precio comprobado y favoritos. Cada filtro indica cuántas herramientas cumple. |
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
| `desde` | número | Plan individual de referencia en USD/mes: el equivalente a «Pro» o «Plus», **no** el escalón más barato del catálogo del fabricante. Así el comparador enfrenta cosas comparables; los planes de entrada más baratos (ChatGPT Go, Google AI Plus) van en `desc`. `0` si no hay que pagar. Si el producto solo se vende por año, pon el equivalente mensual y di el precio anual real en `desc` |
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
| `verificado` | `YYYY-MM-DD` u omitido | **Opcional.** Día en que comprobaste precio y estado en el sitio oficial. La ficha lo muestra en verde; si falta, avisa de que el precio no se ha revisado desde el alta. Hay un filtro «Precio comprobado» y el validador avisa si pasa de 180 días |

### Qué comprueba el validador

Campos obligatorios, ids duplicados o con formato raro, categorías y plataformas inexistentes,
rangos de `es`/`nivel`/`score`, formato de fechas, URLs, coherencia entre `precio` y `desde`,
y referencias de `alt` que apunten a herramientas que no existen.

```bash
node scripts/validar.mjs                 # informe
node scripts/validar.mjs --arreglar-alt  # además limpia las referencias huérfanas
```

Devuelve código de salida distinto de cero si hay errores, para poder encadenarlo en un
despliegue automático (ver más abajo).

### Añadir una categoría

En el array `categorias` de `data/tools.json`:

```json
{ "id": "robotica", "nombre": "Robótica", "emoji": "🦾" }
```

Aparece sola en los filtros, en el asistente no (esa lista está en `PREGUNTAS` de `app.js`)
y en las estadísticas.

---

## Publicado en

**<https://jorgecif.github.io/directorio-ia/>**

Sirve directamente desde la rama `main` (GitHub Pages, modo *branch*). Como el sitio es
estático y no necesita compilarse, **cada `git push` a `main` lo actualiza en menos de un minuto**,
sin ningún paso extra:

```bash
node scripts/sellar.mjs && node scripts/validar.mjs
git add -A && git commit -m "Actualiza catálogo" && git push
```

### Pendiente opcional: validación automática antes de publicar

En el proyecto hay un flujo de GitHub Actions en `.github/workflows/deploy.yml` que **detiene el
despliegue si `data/tools.json` tiene errores**. Está sin subir porque el token de `gh` no tenía
permiso `workflow`. Para activarlo:

```bash
gh auth refresh -h github.com -s workflow
```

Después súbelo y cambia Pages al modo Actions:

```bash
git add .github/workflows/deploy.yml
git commit -m "Añade validación automática antes de publicar"
git push
gh api -X PUT repos/jorgecif/directorio-ia/pages -f build_type=workflow
```

Sin esto todo funciona igual; la única diferencia es que un JSON roto llegaría a producción,
así que conviene ejecutar `node scripts/validar.mjs` a mano antes de cada push.

### Otras opciones de hosting gratuito

**Cloudflare Pages** — panel de Cloudflare → *Workers & Pages → Create → Pages*, conecta el
repositorio, build command `node scripts/validar.mjs`, output directory `/`. Sin límite de ancho
de banda en el plan gratuito, red global y funciona también con repositorios privados.

**Netlify** — arrastra la carpeta a <https://app.netlify.com/drop> para una prueba rápida, o
conecta el repositorio para que se actualice con cada push. La configuración ya está en
[`netlify.toml`](netlify.toml).

### Al cambiar la interfaz

Si cambias `index.html`, `app.js` o `styles.css`, sube el número de `VERSION` en
[`sw.js`](sw.js). Sin eso, quien ya haya visitado el sitio verá los archivos antiguos
hasta la segunda recarga. **Los cambios de `data/tools.json` no necesitan nada**: el service
worker siempre pide el catálogo a la red antes de mirar la caché.

---

## Mantenimiento recomendado

Los precios de la IA cambian mucho, y algunos productos directamente desaparecen. Un ritmo realista:

- **Cada mes** — repasar los precios de las herramientas marcadas como `destacado`, que son
  las más visibles, y ponerles `verificado` con la fecha del día. Ejecutar `sellar.mjs`.
- **Cada trimestre** — repasar todo el catálogo, retirar lo que haya cerrado y añadir lo nuevo.
  El validador te dice cuántas fichas llevan más de 180 días sin verificar.
- **Cuando añadas algo** — poner `agregado` con la fecha real: así aparece con la insignia
  ✨ Nuevo y en el filtro de novedades durante 45 días.

Al retirar una herramienta, vale la pena mirar antes quién la referencia en `alt` y poner un
sustituto sensato a mano; `--arreglar-alt` solo borra la referencia, no la reemplaza.

Si retiras una herramienta, ejecuta `node scripts/validar.mjs --arreglar-alt` para que ninguna
otra la siga referenciando como alternativa.

---

## Aviso sobre los precios

Las cifras son el **plan individual de referencia en USD/mes** y sirven para comparar, no para
presupuestar. Cambian con frecuencia, varían por país e impuestos, y muchos productos ofrecen
descuento anual.

No todas las fichas están comprobadas al día. Las que sí lo están llevan el campo `verificado`
y lo dicen en verde; el resto avisa de que el precio no se ha revisado desde el alta. Puedes
filtrar por «Precio comprobado» para ver solo las primeras. Verifica siempre en el sitio oficial
antes de contratar.

## Historial de revisiones

### 13 de octubre de 2026 — v1.0.2 · 146 → 149 herramientas

**Categoría nueva: 🧪 Investigación de usuario**, con tres altas:

- **Synthetic Users** — entrevista participantes simulados por IA en vez de reclutar gente real.
  Solo planes anuales desde 12.500 $/año, sin prueba gratuita.
- **Maze** — tests de usabilidad sobre prototipos de Figma, con plan gratuito.
- **Lyssna** (antes UsabilityHub) — tests rápidos de diseño y card sorting, con plan gratuito.

**Cambios verificados:**

- **Gemini** — desde el 9-10-2026 el plan gratuito solo da acceso al modelo Flash-Lite.
- **Canva** 15 $ → 18 $, **Figma** 16 $ → 18 $, **Make** 9 $ → 12 $ (precio de facturación mensual).
- **Descript** — plan gratuito y escalones corregidos tras la reestructuración de 2026.

**Precio comprobado:** 30 de 149 fichas (eran 18 de 146). La estadística de precio pasó de media
a **mediana**, porque un plan de cuatro cifras distorsionaba el promedio.

### 24 de septiembre de 2026 — v1.0.1 · 148 → 146 herramientas

**Retiradas (4):**

- **Sora** — OpenAI cerró la app y la generación de vídeo en ChatGPT el 26-04-2026; la API se
  apagó el 24-09-2026.
- **Tome** — el producto de presentaciones cerró el 30-04-2025; el equipo hace ahora Lightfield.
- **Play.ht / PlayAI** — acquihire de Meta en jul-2025, plataforma cerrada el 31-12-2025.
- **Codeium** — la marca dejó de existir: pasó a Windsurf y hoy es el «Windsurf Plugin».

**Cambios de fondo:**

- **Galileo AI → Stitch** (Google). De 19 $/mes a gratuito en vista previa.
- **Windsurf → Devin Desktop** (Cognition). Ahora con plan gratuito, Pro 20 $ y Max 200 $.
- **NotebookLM → Gemini Notebook** (renombrado el 16-07-2026).
- **Udio** — tras el acuerdo con Universal ya no permite descargar ni publicar lo generado.
  Nota bajada de 8,4 a 6,2 y retirada de destacadas.
- **Suno** — modelos con licencia y topes mensuales de descarga; el plan gratis ya no descarga.
- **Manus** — sigue independiente: China bloqueó la compra de Meta en abr-2026.

**Altas (2):** Google Antigravity (agentes de código, plan individual gratuito) y Higgsfield
(agregador de más de quince modelos de vídeo).

**Nuevo campo `verificado`** con filtro propio: 18 de 146 fichas comprobadas en esta revisión.

### 29 de julio de 2026 — v1.0.0

Publicación inicial con 148 herramientas.

## Licencia

Código bajo MIT. El contenido del catálogo (descripciones y valoraciones) es trabajo editorial
propio; los nombres y marcas pertenecen a sus respectivos titulares.
