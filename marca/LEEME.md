# Marca de Neixón: calco vectorial del logo

Origen: `ref/logo/logo-1536x1024.png`, el RGBA grande. Todo se regenera con:

```
python -I scripts/logo.py            # SVG, piedras.json, comparacion.png
python -I scripts/logo_render.py     # IoU medido con Chromium (comprobación)
python -I scripts/logo_filas.py      # scripts/_tmp/filas.png: piedras numeradas y coloreadas por fila
python -I scripts/logo_tipografia.py [--panel Familia ...]   # comparación con Google Fonts
```

## Ficheros

| Fichero | Contenido |
|---|---|
| `anillo.svg` (29 KB) | `<g id="anillo">` con 71 `<path id="piedra-NN" data-angulo data-anillo>`, `fill="currentColor"` |
| `texto.svg` (3 KB) | `<g id="texto">` → `<g id="neixon">` (n, e, i, x, o, tilde, n-2) y `<g id="hotel-rural">` (h, o, t, e, l, r, u, r-2, a, l-2), un path por letra, `fill-rule="evenodd"` |
| `logo.svg` (32 KB) | los dos grupos juntos |
| `piedras.json` | `viewBox`, `centro`, `radioMedio` (más `radioExterior`, `radioInterior` y `abertura`) y `piedras[]` en orden horario |
| `comparacion.png` | el original con el contorno del SVG encima y el mapa de diferencias, a 3x |
| `tipografias.png` | el rótulo con las candidatas de Google Fonts encima, letra a letra |

Los cuatro SVG comparten `viewBox="0 0 951 907"`, y 1 unidad equivale a 1 px del PNG original. El origen (0,0) corresponde al píxel (267, 52) del PNG.

## Cómo se hizo

1. **Máscara.** Se calcula la cobertura de «material claro» como alfa × claridad. Las juntas oscuras y el filo oscuro de cada piedra y de cada letra cuentan como hueco. Se amplía ×4 en bicúbico, se suaviza (σ 1,2 px a ×4) y se corta al 50 %.
2. **Piedras.** Las componentes conexas salen ya separadas: las 71 piedras se separan por sus juntas sin necesidad de erosionar. A cada una se le saca el contorno subpíxel (cruce 0,5 del campo continuo) y se ajusta con Bézier cúbicas (Schneider, error máximo 0,3 px). Solo se respetan como esquinas los giros de más de 75°: así se conserva la muesca de la piedra 30.
3. **Letras.** Los tramos rectos se detectan y se ajustan por mínimos cuadrados. Las esquinas se reconstruyen como cruce de rectas y los remates cortos (cabeza de la l, brazo de la t, pies) como esquina, recta y esquina. Luego se enderezan:
   - rectas a eje;
   - bordes horizontales a la misma altura en toda la palabra (altura de mayúscula, línea base, altura x);
   - astas emparejadas al grosor mediano (unos 13,0 px en NEIXÓN y 8,4 px en Hotel Rural; solo se corrige el temblor de menos de 0,6 px).

   Las curvas siguen el calco con suavizado alto. La O y la o se suavizan con un paso bajo de Fourier de 12 armónicos.
4. **Centro.** Sale de ajustar una circunferencia (Kasa) al borde exterior del anillo. El ángulo de cada piedra es el de su centroide visto desde ese centro.
5. **Fila.** Desde el centroide de cada piedra se lanzan rayos hacia fuera y se cuentan las piedras que cruzan hasta salir del anillo.

No se usa potrace: el `potracer` instalado devolvía trazados en escalera de píxeles, de 117 KB.

## Resultado

- **IoU global: 0,9915.** Anillo 0,9929 y **texto 0,9793**. Se mide a ×4 contra la máscara, muestreando el centro de cada píxel. El IoU global medido pintando `logo.svg` con Chromium a 2x es 0,9908.
- Por letra, el IoU va de 0,92 (la tilde, muy pequeña) a 0,99. El enderezado cuesta unas décimas en las letras finas de «Hotel Rural».
- **71 piedras**, numeradas en sentido horario desde el extremo izquierdo de la abertura (abajo a la izquierda).
- **Centro:** (477,29; 467,44). **Radio medio:** 395,4 (exterior 468,3; interior 323,3; banda de unos 145).
- **Abertura:** el anillo empieza en 200,1° (extremo izquierdo) y acaba en 163,6° (extremo derecho), con 0 = arriba y sentido horario. El hueco es de unos 36,5° centrado abajo.

### Filas (`data-anillo` = cuántas piedras hay entre ella y el borde exterior)

- **0, exterior (32):** 02 04 06 08 10 12 14 16 19 21 24 26 28 30 33 35 38 41 43 44 46 48 50 52 53 56 59 61 64 66 68 71
- **1, segunda fila (32):** 01 03 05 07 09 11 13 15 17 20 22 23 25 27 29 34 37 40 42 45 47 49 51 54 55 58 62 63 65 67 69 70
- **2, tercera fila (7):** 18 31 32 36 39 57 60

La tercera fila de verdad está arriba (31, 32, 36, 39). Las piedras 18, 57 y 60 son piedras interiores que tienen dos por delante porque las de fuera están escalonadas.

## Rarezas del original

- Arriba hay tres hiladas; en los costados, dos; en los extremos de la abertura, dos piedras por hilada. No es un anillo de filas regulares.
- La piedra 30 (arriba a la izquierda) tiene una muesca en ángulo agudo, que se ha respetado.
- La 03 es diminuta (849 px²): está encajada entre la 01, la 02 y la 05. La más grande es la 29 (7991 px²).
- Piedras y letras llevan un filo oscuro de aproximadamente 1 px y un brillo blanco interior (relieve). El calco toma el borde del material claro, así que a fondo claro el logo queda un pelo más fino que la silueta alfa.
- Las letras del PNG tienen temblor de medio píxel en las rectas: viene del original, no del calco. La «u» y la «a» llevan espolón abajo a la derecha, que es del diseño.

## Tipografía que hace juego (solo para los textos de la web; el rótulo no se sustituye)

Se compararon 34 familias en varios pesos, letra a letra a la misma altura (IoU medio por letra; `scripts/_tmp/tipografias.json`).

| Candidata | NEIXÓN (peso) | Hotel Rural (peso) |
|---|---|---|
| Montserrat | **0,823** (400) | 0,749 (500) |
| Red Hat Display | 0,810 (400) | 0,788 (500) |
| Figtree | 0,779 (400) | **0,821** (500) |
| Albert Sans | 0,696 (400) | **0,826** (500) |
| Lato | 0,771 (400) | 0,783 (400) |

Josefin Sans, Raleway, Mulish, Questrial y otras quedan por debajo. Raleway falla en la «a» y la «l»; Josefin, en la «a».

**Recomendación:**

- **Montserrat 400** en mayúsculas espaciadas para titulares que deban recordar a «NEIXÓN». Comparte la O casi circular, la N y la E.
- **Figtree 500/400** para el texto corrido y los rótulos tipo «Hotel Rural».
- Si se quiere una sola familia, **Figtree**: es la mejor en el conjunto de los dos renglones.

Ninguna clava la «t» del logo, que es estrecha y con el corte superior recto.
