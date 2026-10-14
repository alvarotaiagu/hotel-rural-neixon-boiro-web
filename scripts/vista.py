# -*- coding: utf-8 -*-
"""Render rapido de datos/barbanza.json a datos/barbanza-vista.png para comprobar la costa a ojo."""
import sys, os, json, math
sys.stdout.reconfigure(encoding="utf-8")
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
J = json.load(open(os.path.join(RAIZ, "datos", "barbanza.json"), encoding="utf-8"))
caja = J["caja"]
W_PX = 2600
s = W_PX / (caja["x1"] - caja["x0"])
H_PX = int((caja["y1"] - caja["y0"]) * s)
tr = lambda x, y: ((x - caja["x0"]) * s, (y - caja["y0"]) * s)


def pares(flat):
    return [tr(flat[i], flat[i + 1]) for i in range(0, len(flat), 2)]


org = J["origen"]
img = np.zeros((H_PX, W_PX, 3), np.uint8)
img[:] = (236, 230, 214)         # tierra
# tierra: se cierran las cadenas de costa (tierra a la izquierda) siguiendo el borde de la caja de recorte
X0, Y0, X1, Y1 = caja["x0"] - 800, caja["y0"] - 800, caja["x1"] + 800, caja["y1"] + 800
Wc, Hc = X1 - X0, Y1 - Y0


def param(x, y):
    """posicion en el perimetro, recorrido: abajo hacia el este, derecha hacia el norte (y decrece), arriba hacia el oeste, izquierda hacia el sur."""
    tol = 3
    if abs(y - Y1) <= tol: return (x - X0)
    if abs(x - X1) <= tol: return Wc + (Y1 - y)
    if abs(y - Y0) <= tol: return Wc + Hc + (X1 - x)
    if abs(x - X0) <= tol: return 2 * Wc + Hc + (y - Y0)
    return None


def esquina(t):
    t %= 2 * (Wc + Hc)
    if t < Wc: return (X0 + t, Y1)
    if t < Wc + Hc: return (X1, Y1 - (t - Wc))
    if t < 2 * Wc + Hc: return (X1 - (t - Wc - Hc), Y0)
    return (X0, Y0 + (t - 2 * Wc - Hc))


abiertas, anillos = [], []
for c in J["costa"]:
    pts = [(c[i], c[i + 1]) for i in range(0, len(c), 2)]
    if pts[0] == pts[-1]:
        anillos.append(pts)
    else:
        abiertas.append(pts)
polis = []
usada = [False] * len(abiertas)
inicios = sorted((param(*p[0]), i) for i, p in enumerate(abiertas) if param(*p[0]) is not None)
P_TOT = 2 * (Wc + Hc)
for i0 in range(len(abiertas)):
    if usada[i0] or param(*abiertas[i0][0]) is None or param(*abiertas[i0][-1]) is None:
        continue
    poli, i = [], i0
    while not usada[i]:
        usada[i] = True
        poli += abiertas[i]
        te = param(*abiertas[i][-1])
        # siguiente inicio en sentido de recorrido (ciclico)
        cand = sorted(((ts - te) % P_TOT, j) for ts, j in inicios)
        dist, j = cand[0]
        # esquinas intermedias
        esq = [0, Wc, Wc + Hc, 2 * Wc + Hc]
        for e in sorted(esq, key=lambda e: (e - te) % P_TOT):
            if 0 < (e - te) % P_TOT < dist:
                poli.append(esquina(e))
        i = j
    polis.append(poli)
print("poligonos de tierra:", len(polis), "anillos:", len(anillos), "abiertas sin cerrar:", sum(1 for u in usada if not u))
SC = s  # px por metro
big = Image.new("RGB", (int(Wc * SC), int(Hc * SC)), (176, 205, 222))
bd = ImageDraw.Draw(big)
tb = lambda x, y: ((x - X0) * SC, (y - Y0) * SC)
for poli in polis:
    bd.polygon([tb(*p) for p in poli], fill=(236, 230, 214))
for r in anillos:
    area = sum(r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1] for i in range(len(r) - 1))
    # y hacia el sur: tierra a la izquierda => area (en pantalla) negativa
    bd.polygon([tb(*p) for p in r], fill=(236, 230, 214) if area < 0 else (176, 205, 222))
ox, oy = (caja["x0"] - X0) * SC, (caja["y0"] - Y0) * SC
img = np.array(big.crop((int(ox), int(oy), int(ox) + W_PX, int(oy) + H_PX)))
im = Image.fromarray(img)
dr = ImageDraw.Draw(im)
try:
    f = ImageFont.truetype("arial.ttf", 22); fb = ImageFont.truetype("arialbd.ttf", 24); fs = ImageFont.truetype("arial.ttf", 17)
except Exception:
    f = fb = fs = ImageFont.load_default()

for r in J["rios"]:
    dr.line(pares(r), fill=(90, 140, 190), width=2)
col = {"motorway": ((200, 90, 60), 5), "trunk": ((210, 120, 60), 4), "primary": ((190, 150, 70), 3), "secondary": ((150, 140, 120), 2), "tertiary": ((190, 185, 170), 1)}
for c in reversed(J["carreteras"]):
    cc, w = col[c["nivel"]]
    dr.line(pares(c["p"]), fill=cc, width=w)
for c in J["costa"]:
    dr.line(pares(c), fill=(40, 60, 80), width=2)
# rejilla 5 km
for k in range(-30, 31):
    gx = k * 5000
    if caja["x0"] < gx < caja["x1"]:
        x, _ = tr(gx, 0); dr.line([(x, 0), (x, H_PX)], fill=(200, 200, 200), width=1)
    if caja["y0"] < gx < caja["y1"]:
        _, y = tr(0, gx); dr.line([(0, y), (W_PX, y)], fill=(200, 200, 200), width=1)

tcol = {"playa": (230, 160, 30), "castro": (150, 60, 40), "patrimonio": (120, 60, 140), "naturaleza": (40, 130, 60), "excursion": (200, 50, 50), "ciudad": (40, 40, 40)}
for L in J["lugares"]:
    x, y = tr(L["x"], L["y"])
    c = tcol.get(L["tipo"], (0, 0, 0))
    dr.ellipse([x - 9, y - 9, x + 9, y + 9], fill=c, outline="white", width=2)
    et = L["nombre"] + "  %.1f km / %d min" % (L["coche"]["km"], L["coche"]["min"])
    if "pie" in L:
        et += " (a pie %.1f km/%d min)" % (L["pie"]["km"], L["pie"]["min"])
    dr.text((x + 13, y - 12), et, font=fs, fill=(0, 0, 0), stroke_width=3, stroke_fill=(255, 255, 255))
hx, hy = tr(0, 0)
dr.polygon([(hx, hy - 22), (hx + 7, hy - 7), (hx + 22, hy - 7), (hx + 10, hy + 3), (hx + 14, hy + 19), (hx, hy + 9), (hx - 14, hy + 19), (hx - 10, hy + 3), (hx - 22, hy - 7), (hx - 7, hy - 7)], fill=(220, 0, 90), outline="white")
dr.text((hx + 26, hy - 30), "HOTEL RURAL NEIXON", font=fb, fill=(220, 0, 90), stroke_width=3, stroke_fill=(255, 255, 255))
dr.text((20, H_PX - 34), "(c) OpenStreetMap (ODbL) - rejilla cada 5 km - caja %d x %d m" % (caja["x1"] - caja["x0"], caja["y1"] - caja["y0"]), font=f, fill=(60, 60, 60))
im.save(os.path.join(RAIZ, "datos", "barbanza-vista.png"), optimize=True)
print("png", im.size)

# comprobacion numerica: de que lado de la costa (OSM: tierra a la izquierda) cae cada lugar
def lado(x, y):
    mejor = None
    for c in J["costa"]:
        for i in range(0, len(c) - 3, 2):
            ax, ay, bx, by = c[i], c[i + 1], c[i + 2], c[i + 3]
            dx, dy = bx - ax, by - ay
            L2 = dx * dx + dy * dy or 1
            t = max(0, min(1, ((x - ax) * dx + (y - ay) * dy) / L2))
            qx, qy = ax + t * dx, ay + t * dy
            d = math.hypot(x - qx, y - qy)
            if mejor is None or d < mejor[0]:
                mejor = (d, (x - ax) * dy * -1 + (y - ay) * dx * 0 + 0, dx, dy, ax, ay)
    d, _, dx, dy, ax, ay = mejor
    izq = (x - ax) * dy + (y - ay) * (-dx)   # producto con la normal izquierda (dy,-dx)
    return d, "tierra" if izq > 0 else "mar"
print("lado de la costa por lugar (distancia a la costa m):")
for L in J["lugares"]:
    if L["id"] in ("santiago", "scq"):
        continue
    d, l = lado(L["x"], L["y"])
    print("  %-22s %-6s %5d m" % (L["id"], l, d))
d, l = lado(0, 0)
print("  %-22s %-6s %5d m" % ("HOTEL", l, d))
