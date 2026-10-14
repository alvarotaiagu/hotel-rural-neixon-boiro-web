# Neixón · Hotel Rural · Boiro · «El castro»

Rediseño de `ruralneixon.com`. La web actual es WordPress con Divi, MotoPress Hotel Booking y WooCommerce, hecha por Doezos (2025-2026). Esta versión está **en local**, con `noindex` en todas las páginas, y **no está publicada**.

- **Datos y fuentes:** `../hotel-rural-neixon-boiro-bocetos/DATOS-NEIXON.md`
- **Decisión (2026-10-14):** dirección A «El castro», con el mapa del Barbanza de B y el selector de habitaciones de C. Fotos de su web, **también las regeneradas con IA**: hay que avisar al hotel. Solo en castellano. Reserva por consulta (WhatsApp o correo), sin motor.

## Concepto

El logo es un **anillo de piedras de mampostería casi cerrado, abierto por abajo**, como la planta de un castro. El de Neixón está a un paseo. El anillo es el sistema de toda la web:

1. **Cortina:** las 71 piedras se asientan una a una en sentido horario, empezando por el extremo izquierdo de la abertura. Aparecen «NEIXÓN · Hotel Rural» y «Boiro · ría de Arousa», y dentro del anillo, la casa. Después el anillo vuela a su sitio en el hero, se aclara y el hueco crece desde allí hasta destapar la página.
2. **Hero, «el dial»:** la foto va dentro del anillo y **el anillo se gira con el dedo**. Cada quinto de vuelta cambia la vista: la casa, el balcón al pinar, el jacuzzi, la chimenea del bungalow y la cafetería. Lleva inercia y se asienta en la vista más cercana.
3. **Habitaciones, «el muro»:** las 10 unidades (8 habitaciones y 2 bungalows) son 10 piedras. Cada foto lleva la forma de una piedra del logo, con un `clipPath` en `objectBoundingBox`. Hay filtros por terraza, jacuzzi, tres o más personas y cocina, y una **ficha** (`<dialog>`) con camas, capacidad y la opción «Consultar fechas para esta».
4. **Hileras:** separadores hechos con una fila de piedras del anillo.
5. **El Barbanza:** una lámina en canvas con la costa, las carreteras y los ríos de OpenStreetMap. La costa se traza desde el hotel hacia fuera y lleva ondas grabadas del lado del agua (en OSM la tierra queda a la izquierda del trazo). Cada lugar tiene sus minutos en coche (y a pie si está cerca), calculados con OSRM.
   - **La lámina es `sticky`** mientras se lee la lista, que es más alta que ella. En escritorio va al lado y se resalta un lugar al pasar el ratón o con el foco.
   - En el móvil va arriba, bajo la cabecera, con como mucho el 38 % del alto. Al hacer scroll se resalta en el mapa el lugar que se está leyendo: el que cruza el primer tercio de la pantalla que queda bajo la lámina.
6. **Pie:** el anillo del logo se completa piedra a piedra al llegar al final, y el botón «Consultar fechas» es **la piedra que falta**: ocupa la abertura y cierra el círculo.

### Paleta

| Token | Color | De dónde sale |
|---|---|---|
| granito | `#171a17` | noche de piedra (hero, cafetería, consulta, pie) |
| piedra | `#e7e4dd` | las piedras del logo |
| cal | `#f4f1ea` | fondos claros |
| musgo | `#3e5a3a` / `#b4c7a3` | acento, sobre claro y sobre oscuro |
| ría | `#2f4c58` / `#d6e0e1` | el agua del mapa |
| teja | `#b65a36` | solo el hotel en el mapa y los avisos de las páginas legales |

`verificar.mjs` mide los contrastes; todos superan 6,4:1.

### Letras

- **Fraunces** con el eje `SOFT` al 100 para los títulos: los remates redondeados recuerdan a piedra gastada.
- **Figtree** para el texto. El agente del logo comparó 34 familias letra a letra y es la que más se parece al «Hotel Rural» del rótulo.
- El logo **no se redibuja**: es un calco SVG con un 99,15 % de coincidencia (IoU) con el original. El método está en `marca/LEEME.md`.
- La cabecera usa solo el anillo, porque a 46 px el texto del logo no se lee, con «Neixón · Hotel Rural» escrito al lado. El logo entero sale en la cortina y en el pie.

## Mapa de secciones

1. Cortina «el castro»
2. Hero con el dial, el dato en vivo (la hora de Boiro y si es hora de llegadas) y las coordenadas
3. La casa: 8 · 2 · 1 y los servicios
4. Habitaciones: el muro, los filtros y la ficha (en la «Sobria», además, una tabla)
5. Bungalows
6. Cafetería
7. El Barbanza: la lámina y la lista de lugares con filtros
8. Opiniones: 5 reseñas reales de Google tomadas de su widget de Trustindex, **sin nota numérica**
9. Consultar fechas: un formulario que **abre WhatsApp o el correo** con el mensaje escrito
10. Cómo llegar: rutas y el mapa de Google solo bajo clic
11. *Galería* (solo en la «Sobria»)
12. Pie «el anillo se cierra»
13. Barra fija en el móvil: «Consultar fechas» y WhatsApp

## §5 bis «Nivel»

- **Se quitan del kit común:** la pila sticky, la marquesina, el cursor propio y los botones magnéticos.
- **Se añaden:** el dial que se gira y el muro de piedras con su forma.
- **Gesto táctil del hero:** girar el anillo con el dedo. Usa `touch-action: pan-y`, así que el scroll vertical sigue funcionando. El ángulo se acumula vuelta tras vuelta y la inercia sale de las últimas 6 muestras. En teclado, flechas con el anillo enfocado; además hay botones anterior y siguiente. La primera vez, el anillo se balancea 16° para enseñar el gesto; no guarda nada.
- **El objeto se completa en el pie:** el botón cierra la abertura del anillo.
- **Foco con la forma del motivo:** un canto rodado (`border-radius` irregular) alrededor de lo enfocado, en musgo sobre claro y en musgo claro sobre oscuro.
- **Opción de menú elegida: dato en vivo.** La hora de Boiro y si es hora de llegadas (17:00–22:00). Es un dato real del hotel, publicado en su web.

## Mando de densidades (solo con `?revision`)

- **«Castro»:** fotos del muro con forma de piedra, hileras de piedras entre secciones y fotos de bungalows y cafetería en canto rodado.
- **«Sobria»:** la piedra queda solo en la cortina, el dial y el pie; las fotos van rectas y las hileras pasan a ser una línea. **Añade** la tabla «Las diez, de un vistazo» (cambia dibujo por dato) y una galería de 12 fotos.

No guarda nada en el navegador: la URL lleva `&densidad=sobria`.

### Receta de borrado del mando

1. En `index.src.html`:
   - borra el bloque entre `<!-- ============ MANDO DE MAQUETA` y `fin del MANDO DE MAQUETA ============ -->`;
   - en el script del `<head>`, borra el bloque `// MANDO DE MAQUETA` (el `try { … }`).
2. En `js/main.js`, borra el bloque `16. MANDO DE MAQUETA` hasta `fin del MANDO DE MAQUETA`.
3. Opcional: en `css/estilos.css`, borra el bloque `.mando`. Las reglas `densidad-sobria`, la tabla y la galería quedan inertes.
4. Ejecuta `node construir.mjs`.

## Cómo se trabaja

- **Edita siempre los `*.src.html`.** `node construir.mjs` genera los `.html`:
  - cada `<img data-foto>` pasa a `<picture>` con AVIF, WebP y JPG;
  - mete en línea los SVG de `marca/` **sin sus `id`**, porque el anillo va varias veces en la página; el JS usa `data-angulo` y el orden;
  - pone `?v=<huella>` a CSS y JS.
- **Las legales** salen de `node scripts/legales.mjs`, que escribe los `*.src.html`.
- **`node scripts/marca.mjs`** deja `anillo.svg`, `texto.svg` y `logo.svg` con el **mismo viewBox cuadrado centrado en el anillo**, que es lo que hace casar la cortina, el dial y el pie. También escribe `js/geometria.js` (centro y radios) y los favicons y `img/og.jpg`.
- **`node scripts/fotos.mjs <carpeta de descargas>`** gradúa y redimensiona las fotos desde la biblioteca de medios de su WordPress (`ref/media.json`). Nunca amplía.
- **`node verificar.mjs [--capturas]`** sirve la web en el puerto **8762**, con GSAP y Lenis desde una copia local. Comprueba:
  - los archivos y que no haya `id` repetidos;
  - la cortina, con fotogramas a medias registrados en la página: las piedras a medio asentar, la foto dentro, el vuelo, el agujero sin fondo opaco y la retirada; también con movimiento reducido, sin CDN y con CDN lento;
  - el dial: flechas, teclado, arrastre con asentamiento y que la foto llene el hueco;
  - el muro: las formas, los cuatro filtros con su contador, la ficha (Escape y foco) y «Consultar esta»;
  - el formulario: los errores y el mensaje de WhatsApp;
  - las cookies, la cabecera clara u oscura, el pie que se cierra y la lámina (que dibuja, que las etiquetas no se pisan y los filtros);
  - el móvil de 360 a 768: solapes, scroll horizontal, menú, barra, carril del muro y 0 `refresh` al subir y bajar la barra del navegador;
  - las densidades y el contraste.

## La lámina del Barbanza (datos de OSM)

- **Origen:** el nodo de OpenStreetMap `node/11091306436` «Hotel Rural Neixón», en 42,66718 · −8,84409. **Está 219 m al este del pin de su web** (42,6672 · −8,84677); se usa el de OSM en las coordenadas, el JSON-LD y los enlaces a Google Maps.
- **Archivos:**
  - `js/barbanza.js` (38,6 KB, `window.BARBANZA`, funciona en `file://`);
  - `datos/barbanza.json`, con las consultas, las rutas de OSRM y **15 dudas**;
  - `datos/barbanza-vista.png`.
- **Se regenera** con `python -I mapa.py` y después `python -I vista.py`, desde `scripts/`. Overpass falla mucho; `ovp.py` reintenta con espejos y descarta `overpass.osm.ch`, que devuelve datos corruptos.
- **Tiempos:** en coche con OSRM y a pie solo si la ruta baja de 3 km. Así salen:
  - el Centro Arqueolóxico, a 2 min a pie;
  - el **castro de Neixón, a 7 min a pie**, que es la cifra del hero.
- **Fuera de la lista:** «Ruta das Mámoas». No existe como ruta en OSM, y los 43 min para 16 km por pistas no son fiables.
- **Con matiz:**
  - Cortegada: el coche llega hasta O Carril y a la isla se va en barco;
  - Baroña y Corrubedo: el último tramo es a pie.
- **«Cómo llegar»** mantiene las cifras de su web (Santiago 40 min, aeropuerto 45 min). OSRM da 54 y 53 min, porque es conservador con la velocidad en autovía. Hay que confirmarlo con el hotel.

## Rendimiento (medido el 2026-10-14)

Pixel 7 emulado, 4G lento (1,6 Mbps, 150 ms), CPU ×4, CDN reales, 3 pasadas:

| Medida | Resultado |
|---|---|
| **LCP** | **1,22 / 1,33 / 1,48 s**. Es la foto de la fachada del dial (`fachada-800.avif`), precargada. |
| Antes del ajuste | 3,75–3,87 s. El `sizes` decía 86vw, pero la ventana redonda es el 68 % del dial (unos 240 px), y el móvil bajaba la de 1200. |
| Peticiones | 18 |
| Cortina fuera | ~3,9–4,1 s |
| Tareas largas | una de 130–150 ms (arranque). Las formas del muro y las hileras se montan en un rato libre **después** de la cortina, para no entrecortarla. |

## Fotos

Salen de su biblioteca de medios (`wp-json/wp/v2/media`, 222 archivos), con una gradación común: algo menos de saturación y un punto cálido.

- **Real:** `fachada` (P1010061, 2560 px).
- **Regeneradas con IA** en su web (`ChatGPT-Image-…` y PNG de 2026): todas las demás (`"ia": true` en `img/fotos/fotos.json`). Se usan por decisión de Álvaro; **el hotel tiene que saberlo**.
- **No se usan:**
  - las de banco de imágenes de la plantilla Divi (`bed-and-breakfast-*`, la casa de EE. UU.);
  - las de la cafetería con gente, porque son personas generadas.

## Pendientes para el hotel

- [ ] Avisar de que casi todas sus fotos son **regeneradas con IA** y pedir los originales o una sesión de fotos (fachada, jardín, bungalows, cafetería, entorno).
- [ ] Si quiere salir **Marisa** con nombre: las reseñas la nombran y aquí se cita literal.
- [ ] **Cancelación:** la política publicada solo recoge la tarifa no reembolsable, pero las fichas dicen «cancelación gratuita». ¿Qué tarifas hay?
- [ ] Qué correo usan, `info@` o `hotel@` (la web usa `info@` y la página legal `hotel@`).
- [ ] Si hay **spa** y **ascensor panorámico** (los cita su portada; aquí no se mencionan).
- [ ] Si el desayuno va incluido siempre (lo dice una reseña) y el horario de la cafetería.
- [ ] «Vistas privilegiadas al mar»: sale en casi todas las fichas, parece copiado de una plantilla y aquí no se usa.
- [ ] El texto exacto de la ayuda NextGenerationEU y si obliga a poner el logo de la UE.
- [ ] Dominio y paso de su WordPress: hoy el motor MotoPress hace las reservas y aquí no se sustituye.
