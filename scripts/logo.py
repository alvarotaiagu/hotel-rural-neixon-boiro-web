"""Calco del logo del Hotel Rural Neixón: una <path> por piedra + texto calcado.

Uso:  python -I scripts/logo.py
Fuente: ref/logo/logo-1536x1024.png (RGBA).
Salida: marca/anillo.svg, texto.svg, logo.svg, piedras.json, comparacion.png

Método
1. Cobertura de «material claro» = alfa x claridad (las juntas y el filo oscuro
   de cada piedra cuentan como hueco). Ampliación x4 bicúbica, desenfoque
   suave y umbral al 50 %.
2. Componentes conexas (4-vecindad): cada piedra sale suelta; las del recuadro
   central son las letras.
3. Contorno subpíxel (cruce 0,5 del campo continuo) y ajuste de Bézier
   cúbicas con error máximo fijo (curvas.py). Letras: esquinas detectadas,
   tramos rectos como rectas y enderezado (ver enderezado.py).
4. Centro del anillo por ajuste de circunferencia (Kasa) al borde exterior,
   ángulo de cada piedra desde el centro (0 = arriba, horario) y fila por
   rayos desde el centroide hacia fuera.
"""
import json
import math
import os
import sys
import xml.etree.ElementTree as ET

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from logo_mascara import ESCALA, campo_x4, cobertura_clara  # noqa: E402
from curvas import ajustar_cerrada, contornos_subpixel, esquinas, trazar_letra  # noqa: E402
from enderezado import enderezar_palabra  # noqa: E402

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
MARCA = os.path.join(RAIZ, "marca")
FUENTE = os.path.join(RAIZ, "ref", "logo", "logo-1536x1024.png")
MARGEN = 4  # px (a 1x) alrededor del logo dentro del viewBox

# Ajuste (en píxeles de la imagen x4: 1 px x4 = 0,25 px del original)
PIEDRA = dict(suavizado=3.5, ventana=10, umbral=75, tol=1.2, recta_tol=None, recta_min=0)
LETRA = dict(letra=True, suavizado=3.0, ventana=7, umbral=38, tol=1.6, recta_tol=1.0, recta_min=10)

# recuadro (a 1x) que contiene el texto y ninguna piedra
PASOS = tuple(int(c) for c in os.environ.get("PASOS", "1234"))
CAJA_TEXTO = (440, 400, 1050, 700)
NOMBRES_NEIXON = ["n", "e", "i", "x", "o", "tilde", "n-2"]
NOMBRES_HOTEL = ["h", "o", "t", "e", "l", "r", "u", "r-2", "a", "l-2"]


# ---------------------------------------------------------------- calco
def trazar(mask, x0, y0, params, campo):
    """Curvas cerradas en coordenadas x4 globales:
    (inicio, [("L", p) | ("C", c1, c2, p), ...])."""
    curvas = []
    for p in contornos_subpixel(mask, campo, x0, y0, suavizado=params["suavizado"]):
        if params.get("letra"):
            curvas.append(trazar_letra(p, tol=params["tol"]))
            continue
        cortes, _ = esquinas(p, params["ventana"], params["umbral"])
        curvas.append(ajustar_cerrada(p, params["tol"], cortes,
                                      recta_tol=params["recta_tol"], recta_min=params["recta_min"]))
    return curvas


def a_unidades(curvas, ox, oy):
    """x4 -> unidades del viewBox (px a 1x con el origen desplazado)."""
    o = np.array([ox, oy], float)
    f = lambda q: q / ESCALA - o
    res = []
    for ini, segs in curvas:
        res.append((f(ini), [(s[0],) + tuple(f(q) for q in s[1:]) for s in segs]))
    return res


# ------------------------------------------------------------- serializar
def num(v):
    s = f"{v:.1f}"
    if s.endswith(".0"):
        s = s[:-2]
    if s.startswith("0."):
        s = s[1:]
    elif s.startswith("-0."):
        s = "-" + s[2:]
    return "0" if s in ("-0", "") else s


def unir(nums):
    out = ""
    for v in nums:
        s = num(v)
        if out and not s.startswith("-"):
            out += " "
        out += s
    return out


def path_d(curvas):
    """Comandos relativos sobre coordenadas absolutas ya redondeadas (sin deriva)."""
    r = lambda q: np.round(q, 1)
    partes = []
    for ini, segs in curvas:
        cur = r(ini)
        trozos = ["M" + unir(cur)]
        ultimo = None
        for s in segs:
            if s[0] == "L":
                p = r(s[1])
                d = p - cur
                if abs(d[0]) < 1e-9 and abs(d[1]) < 1e-9:
                    continue
                if abs(d[1]) < 1e-9:
                    trozos.append("h" + unir([d[0]])); ultimo = "h"
                elif abs(d[0]) < 1e-9:
                    trozos.append("v" + unir([d[1]])); ultimo = "v"
                else:
                    cmd = "" if ultimo == "l" else "l"
                    trozos.append(cmd + unir(d) if cmd else " " + unir(d)); ultimo = "l"
                cur = p
            else:
                c1, c2, p = r(s[1]), r(s[2]), r(s[3])
                vals = list(c1 - cur) + list(c2 - cur) + list(p - cur)
                cmd = "" if ultimo == "c" else "c"
                trozos.append(cmd + unir(vals) if cmd else " " + unir(vals)); ultimo = "c"
                cur = p
        trozos.append("z")
        partes.append("".join(trozos).replace(" -", "-"))
    return "".join(partes)


# ------------------------------------------------------------ rasterizar
def poligonos(curvas, escala, n_bez=24):
    polys = []
    for ini, segs in curvas:
        pts = [ini]
        cur = ini
        for s in segs:
            if s[0] == "L":
                pts.append(s[1]); cur = s[1]
            else:
                t = np.linspace(0, 1, n_bez + 1)[1:, None]
                b = ((1 - t) ** 3) * cur + 3 * ((1 - t) ** 2) * t * s[1] + 3 * (1 - t) * t * t * s[2] + t ** 3 * s[3]
                pts.extend(b); cur = s[3]
        polys.append((np.array(pts) * escala * 16).round().astype(np.int32))
    return polys


def rasterizar(lista_curvas, shape, escala, ox=0.0, oy=0.0):
    """Pinta (par-impar dentro de cada path, unión entre paths) a la escala pedida.
    Las curvas vienen en unidades del viewBox; ox, oy devuelven al marco de la imagen."""
    out = np.zeros(shape, bool)
    for curvas in lista_curvas:
        cs = [(i + np.array([ox, oy]), [(s[0],) + tuple(q + np.array([ox, oy]) for q in s[1:]) for s in segs])
              for i, segs in curvas]
        polys = [p / 16.0 for p in poligonos(cs, escala)]
        out |= relleno_par_impar(polys, shape)
    return out


def relleno_par_impar(polys, shape):
    """Muestreo exacto en el centro de cada píxel (regla par-impar), sin el
    medio píxel de más que añade cv2.fillPoly en los bordes."""
    H, W = shape
    filas, xs = [], []
    for P in polys:
        P = np.asarray(P, float)
        A, B = P, np.roll(P, -1, 0)
        y0, y1 = A[:, 1], B[:, 1]
        ok = y0 != y1
        A, B, y0, y1 = A[ok], B[ok], y0[ok], y1[ok]
        lo, hi = np.minimum(y0, y1), np.maximum(y0, y1)
        r0 = np.ceil(lo - 0.5).astype(int)
        r1 = np.ceil(hi - 0.5).astype(int)
        cnt = np.maximum(r1 - r0, 0)
        if cnt.sum() == 0:
            continue
        e = np.repeat(np.arange(len(cnt)), cnt)
        r = r0[e] + (np.arange(cnt.sum()) - np.repeat(np.cumsum(cnt) - cnt, cnt))
        yc = r + 0.5
        x = A[e, 0] + (yc - A[e, 1]) * (B[e, 0] - A[e, 0]) / (B[e, 1] - A[e, 1])
        filas.append(r); xs.append(x)
    out = np.zeros(shape, bool)
    if not filas:
        return out
    r = np.concatenate(filas); x = np.concatenate(xs)
    o = np.lexsort((x, r))
    r, x = r[o], x[o]
    # emparejar cortes consecutivos de la misma fila
    a, b = r[0::2], r[1::2]
    assert np.all(a == b), "cortes impares en una fila"
    xa, xb = x[0::2], x[1::2]
    c0 = np.clip(np.ceil(xa - 0.5).astype(int), 0, W)
    c1 = np.clip(np.ceil(xb - 0.5).astype(int), 0, W)
    ok = (a >= 0) & (a < H) & (c1 > c0)
    dif = np.zeros((H, W + 1), np.int32)
    np.add.at(dif, (a[ok], c0[ok]), 1)
    np.add.at(dif, (a[ok], c1[ok]), -1)
    return np.cumsum(dif, axis=1)[:, :W] > 0


def iou(a, b):
    return float((a & b).sum() / max(1, (a | b).sum()))


# ------------------------------------------------------------ geometría
def ajuste_circulo(x, y):
    A = np.c_[2 * x, 2 * y, np.ones_like(x)]
    sol, *_ = np.linalg.lstsq(A, x * x + y * y, rcond=None)
    cx, cy = sol[0], sol[1]
    return cx, cy, math.sqrt(sol[2] + cx * cx + cy * cy)


def angulo(dx, dy):
    """0 = arriba, sentido horario (y hacia abajo en la imagen)."""
    return (math.degrees(math.atan2(dx, -dy)) + 360) % 360


def main():
    os.makedirs(MARCA, exist_ok=True)
    cob = cobertura_clara(FUENTE)
    campo = campo_x4(cob)
    m = campo > 0.5
    H4, W4 = m.shape
    n, lab, st, cen = cv2.connectedComponentsWithStats(m.astype(np.uint8), connectivity=4)

    # caja del logo -> viewBox
    ys, xs = np.nonzero(m)
    x_min, x_max = xs.min() / ESCALA, (xs.max() + 1) / ESCALA
    y_min, y_max = ys.min() / ESCALA, (ys.max() + 1) / ESCALA
    ox, oy = math.floor(x_min) - MARGEN, math.floor(y_min) - MARGEN
    W, H = math.ceil(x_max) + MARGEN - ox, math.ceil(y_max) + MARGEN - oy
    print("viewBox", 0, 0, W, H, "origen en la imagen", ox, oy)

    piedras, letras = [], []
    for i in range(1, n):
        x, y, w, h, area = st[i]
        if area < 16 * 40:
            print("  mota descartada", i, area / 16)
            continue
        bx, by = x / ESCALA, y / ESCALA
        dentro = (bx >= CAJA_TEXTO[0] and by >= CAJA_TEXTO[1] and
                  (x + w) / ESCALA <= CAJA_TEXTO[2] and (y + h) / ESCALA <= CAJA_TEXTO[3])
        (letras if dentro else piedras).append(i)
    print("piedras", len(piedras), "letras", len(letras))

    # ---------- centro y radio: Kasa sobre el borde exterior del anillo
    anillo4 = np.isin(lab, piedras)
    peq = cv2.resize(anillo4.astype(np.uint8), (W4 // ESCALA, H4 // ESCALA), interpolation=cv2.INTER_AREA)
    cerr = cv2.morphologyEx(peq, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (21, 21)))
    cs, _ = cv2.findContours(cerr, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    cont = max(cs, key=cv2.contourArea)[:, 0, :].astype(float) + 0.5
    cx0, cy0, _ = ajuste_circulo(cont[:, 0], cont[:, 1])
    # iterar: quedarse con los puntos del contorno que miran hacia fuera (r grande)
    for _ in range(3):
        r = np.hypot(cont[:, 0] - cx0, cont[:, 1] - cy0)
        ang = np.degrees(np.arctan2(cont[:, 0] - cx0, -(cont[:, 1] - cy0))) % 360
        sel = np.zeros(len(r), bool)
        for b in range(0, 360, 2):
            k = np.nonzero((ang >= b) & (ang < b + 2))[0]
            if len(k):
                sel[k[np.argmax(r[k])]] = True
        cx0, cy0, rext = ajuste_circulo(cont[sel, 0], cont[sel, 1])
    cxi, cyi = cx0, cy0  # en px de la imagen a 1x

    # perfiles radiales por grado: radio interior y exterior de la banda
    yy, xx = np.nonzero(peq)
    pr = np.hypot(xx + .5 - cxi, yy + .5 - cyi)
    pa = (np.degrees(np.arctan2(xx + .5 - cxi, -(yy + .5 - cyi))) % 360).astype(int)
    rin = np.full(360, np.nan); rout = np.full(360, np.nan)
    for b in range(360):
        k = pa == b
        if k.sum() > 5:
            rin[b] = pr[k].min(); rout[b] = pr[k].max()
    cubierto = ~np.isnan(rin)
    # hueco: el tramo descubierto más largo
    hueco = []
    b = 0
    while b < 360:
        if not cubierto[b]:
            e = b
            while e < 360 and not cubierto[e]:
                e += 1
            hueco.append((b, e))
            b = e
        else:
            b += 1
    hb, he = max(hueco, key=lambda t: t[1] - t[0])
    # extremos finos del hueco con los píxeles reales a x4
    yy4, xx4 = np.nonzero(anillo4)
    a4 = np.degrees(np.arctan2((xx4 + .5) / ESCALA - cxi, -((yy4 + .5) / ESCALA - cyi))) % 360
    ext_der = float(a4[(a4 > hb - 15) & (a4 < hb + 1)].max())   # fin del anillo por la derecha
    ext_izq = float(a4[(a4 > he - 1) & (a4 < he + 15)].min())   # comienzo por la izquierda
    medio_hueco = (ext_der + ext_izq) / 2
    print(f"centro ({cxi:.1f},{cyi:.1f}) rext {rext:.1f} hueco {ext_der:.2f}..{ext_izq:.2f}")

    # ---------- trazar piedras
    datos = []
    for i in piedras:
        x, y, w, h, area = st[i]
        msk = lab[y:y + h, x:x + w] == i
        curvas = trazar(msk, x, y, PIEDRA, campo)
        cu = a_unidades(curvas, ox, oy)
        pcx, pcy = cen[i][0] / ESCALA + .5 / ESCALA, cen[i][1] / ESCALA + .5 / ESCALA
        ang = angulo(pcx - cxi, pcy - cyi)
        datos.append(dict(lab=i, curvas=cu, cx=pcx - ox, cy=pcy - oy, angulo=ang,
                          area=area / ESCALA ** 2, r=math.hypot(pcx - cxi, pcy - cyi)))

    # ---------- fila: rayos desde el centroide hacia fuera; cuántas piedras cruza
    lab1 = lab  # x4
    for d in datos:
        i = d["lab"]
        x, y, w, h, _ = st[i]
        sub = lab1[y:y + h, x:x + w] == i
        yy_, xx_ = np.nonzero(sub)
        angs = np.degrees(np.arctan2((xx_ + x + .5) / ESCALA - cxi, -((yy_ + y + .5) / ESCALA - cyi))) % 360
        # abanico de rayos dentro del arco que ocupa la piedra (zona central)
        lo, hi = np.percentile((angs - d["angulo"] + 540) % 360 - 180, [25, 75])
        cuentas = []
        for da in np.linspace(lo, hi, 5):
            th = math.radians(d["angulo"] + da)
            ux, uy = math.sin(th), -math.cos(th)
            # partir del punto de la piedra sobre ese rayo más alejado del centro
            vistos = set()
            r0 = d["r"] - 60
            fuera = 0
            dentro_propia = False
            for rr in np.arange(r0, r0 + 260, 0.5):
                px = int((cxi + ux * rr) * ESCALA); py = int((cyi + uy * rr) * ESCALA)
                if not (0 <= px < W4 and 0 <= py < H4):
                    break
                l = lab1[py, px]
                if l == i:
                    dentro_propia = True
                    vistos.clear()
                    fuera = 0
                    continue
                if not dentro_propia:
                    continue
                if l in piedras:
                    vistos.add(int(l)); fuera = 0
                else:
                    fuera += 1
                    if fuera > 4 * 2 * 6:   # 12 px seguidos sin piedra: fuera del anillo
                        break
            if dentro_propia:
                cuentas.append(len(vistos))
        # 0 = toca el borde exterior; 1 = segunda fila; 2 = tercera fila (solo
        # donde el anillo es más grueso). Con más de 2 por delante cuenta como 2.
        d["anillo"] = min(2, int(np.median(cuentas))) if cuentas else 0

    clave = lambda d: (d["angulo"] - medio_hueco) % 360
    datos.sort(key=clave)
    for k, d in enumerate(datos, 1):
        d["id"] = f"piedra-{k:02d}"
        d["d"] = path_d(d["curvas"])

    # ---------- letras
    filas = {"neixon": [], "hotel-rural": []}
    for i in letras:
        cyl = cen[i][1] / ESCALA
        (filas["neixon"] if cyl < 590 else filas["hotel-rural"]).append(i)
    letras_out = {}
    for nombre, ids in filas.items():
        ids.sort(key=lambda i: st[i][0])
        nombres = NOMBRES_NEIXON if nombre == "neixon" else NOMBRES_HOTEL
        assert len(ids) == len(nombres), (nombre, len(ids))
        lst = []
        for i, nm in zip(ids, nombres):
            x, y, w, h, _ = st[i]
            msk = lab[y:y + h, x:x + w] == i
            cu = a_unidades(trazar(msk, x, y, LETRA, campo), ox, oy)
            lst.append((f"{nombre}-{nm}", cu))
        enderezadas = enderezar_palabra([cu for _, cu in lst], PASOS)
        letras_out[nombre] = [(lid, cu) for (lid, _), cu in zip(lst, enderezadas)]
        # IoU por letra: antes y después de enderezar
        for (lid, antes), despues, i in zip(lst, enderezadas, ids):
            x, y, w, h, _ = st[i]
            sl = (slice(y - 12, y + h + 12), slice(x - 12, x + w + 12))
            ref = (lab == i)[sl]
            r0 = rasterizar([antes], m.shape, ESCALA, ox, oy)[sl]
            r1 = rasterizar([despues], m.shape, ESCALA, ox, oy)[sl]
            print(f"  {lid:16s} IoU calco {iou(r0, ref):.4f}  enderezada {iou(r1, ref):.4f}")

    # ---------- SVG
    vb = f"0 0 {W} {H}"
    def svg_abre(extra=""):
        return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" width="{W}" height="{H}"{extra}>\n')

    g_anillo = ['<g id="anillo" fill="currentColor">']
    for d in datos:
        g_anillo.append(f'<path id="{d["id"]}" data-angulo="{d["angulo"]:.1f}" data-anillo="{d["anillo"]}" d="{d["d"]}"/>')
    g_anillo.append("</g>")
    g_texto = ['<g id="texto" fill="currentColor" fill-rule="evenodd">']
    for nombre, lst in letras_out.items():
        g_texto.append(f'<g id="{nombre}">')
        for lid, cu in lst:
            g_texto.append(f'<path id="{lid}" d="{path_d(cu)}"/>')
        g_texto.append("</g>")
    g_texto.append("</g>")

    titulo = "<title>Hotel Rural Neixón</title>\n"
    ficheros = {
        "anillo.svg": svg_abre(' role="img" aria-label="Anillo de piedras de Neixón"') + "\n".join(g_anillo) + "\n</svg>\n",
        "texto.svg": svg_abre(' role="img" aria-label="Neixón Hotel Rural"') + "\n".join(g_texto) + "\n</svg>\n",
        "logo.svg": svg_abre(' role="img" aria-label="Hotel Rural Neixón"') + titulo + "\n".join(g_anillo) + "\n" + "\n".join(g_texto) + "\n</svg>\n",
    }
    for nombre, txt in ficheros.items():
        ET.fromstring(txt)  # valida
        with open(os.path.join(MARCA, nombre), "w", encoding="utf-8", newline="\n") as f:
            f.write(txt)
        print(nombre, len(txt.encode("utf-8")), "bytes")

    # ---------- JSON
    rmed = float(np.nanmean((rin + rout) / 2))
    js = dict(
        viewBox=[0, 0, W, H],
        centro=[round(cxi - ox, 2), round(cyi - oy, 2)],
        radioMedio=round(rmed, 2),
        radioExterior=round(float(np.nanmedian(rout)), 2),
        radioInterior=round(float(np.nanmedian(rin)), 2),
        abertura=dict(extremoIzquierdo=round(ext_izq, 2), extremoDerecho=round(ext_der, 2)),
        notas="angulo en grados desde el centro, 0 = arriba, sentido horario; anillo 0 = fila exterior; orden horario desde el extremo izquierdo de la abertura",
        piedras=[dict(id=d["id"], d=d["d"], cx=round(d["cx"], 2), cy=round(d["cy"], 2),
                      angulo=round(d["angulo"], 2), area=round(d["area"], 1), anillo=d["anillo"])
                 for d in datos],
    )
    with open(os.path.join(MARCA, "piedras.json"), "w", encoding="utf-8", newline="\n") as f:
        json.dump(js, f, ensure_ascii=False, indent=1)

    # ---------- IoU (a x4, contra la máscara umbralizada)
    ren_p = rasterizar([d["curvas"] for d in datos], m.shape, ESCALA, ox, oy)
    ren_t = rasterizar([cu for lst in letras_out.values() for _, cu in lst], m.shape, ESCALA, ox, oy)
    ref_p = np.isin(lab, piedras)
    ref_t = np.isin(lab, letras)
    iou_g = iou(ren_p | ren_t, ref_p | ref_t)
    iou_t = iou(ren_t, ref_t)
    iou_p = iou(ren_p, ref_p)
    filas_cnt = {}
    for d in datos:
        filas_cnt[d["anillo"]] = filas_cnt.get(d["anillo"], 0) + 1
    res = dict(iou_global=iou_g, iou_texto=iou_t, iou_anillo=iou_p, piedras=len(datos), filas=filas_cnt,
               centro=js["centro"], radioMedio=js["radioMedio"], radioExterior=js["radioExterior"],
               radioInterior=js["radioInterior"], abertura=js["abertura"], viewBox=js["viewBox"],
               origen_en_imagen=[ox, oy])
    print(json.dumps(res, indent=1))
    with open(os.path.join(AQUI, "_tmp", "resultado.json"), "w", encoding="utf-8") as f:
        json.dump(res, f, indent=1)

    comparacion(cob, m, ren_p | ren_t, ref_p | ref_t, ren_t, ref_t, iou_g, iou_t, iou_p, len(datos), ox, oy)


def comparacion(cob, m, ren, ref, ren_t, ref_t, iou_g, iou_t, iou_p, npiedras, ox, oy):
    """Original sobre oscuro, con lo que pinta el SVG encima:
    gris = coinciden, rojo = solo SVG, cian = solo original. A 3x."""
    im = np.array(Image.open(FUENTE).convert("RGBA")).astype(np.float32)
    al = im[..., 3:] / 255
    fondo = np.array([28, 30, 36], np.float32)
    base = im[..., :3] * al + fondo * (1 - al)
    zonas = [("Anillo (parte superior)", (450, 55, 1040, 300)),
             ("Texto", (450, 412, 1040, 690))]
    paneles = []
    for titulo, (x0, y0, x1, y1) in zonas:
        k = 3
        orig = cv2.resize(base[y0:y1, x0:x1], ((x1 - x0) * k, (y1 - y0) * k), interpolation=cv2.INTER_CUBIC)
        # máscaras x4 -> x3
        def rec(b):
            s = b[y0 * ESCALA:y1 * ESCALA, x0 * ESCALA:x1 * ESCALA].astype(np.float32)
            return cv2.resize(s, ((x1 - x0) * k, (y1 - y0) * k), interpolation=cv2.INTER_AREA) > 0.5
        r_, o_ = rec(ren), rec(ref)
        izq = np.clip(orig, 0, 255).astype(np.uint8)
        der = np.zeros_like(izq); der[:] = (28, 30, 36)
        der[r_ & o_] = (225, 225, 222)
        der[r_ & ~o_] = (255, 60, 60)
        der[~r_ & o_] = (0, 220, 255)
        # contorno del SVG sobre el original
        borde = cv2.morphologyEx(r_.astype(np.uint8), cv2.MORPH_GRADIENT, np.ones((2, 2), np.uint8)) > 0
        sobre = izq.copy(); sobre[borde] = (255, 40, 40)
        paneles.append((titulo, sobre, der))
    ancho = max(p[1].shape[1] * 2 + 30 for p in paneles)
    alto = sum(p[1].shape[0] + 50 for p in paneles) + 110
    lienzo = Image.new("RGB", (ancho + 40, alto), (18, 19, 23))
    dr = ImageDraw.Draw(lienzo)
    try:
        fnt = ImageFont.truetype("arial.ttf", 26); fnt2 = ImageFont.truetype("arial.ttf", 20)
    except OSError:
        fnt = fnt2 = ImageFont.load_default()
    dr.text((20, 18), f"Neixón - calco SVG vs original (3x)   IoU global {iou_g:.4f} · anillo {iou_p:.4f} · texto {iou_t:.4f} · {npiedras} piedras",
            fill=(240, 240, 240), font=fnt)
    dr.text((20, 56), "Izquierda: original con el contorno del SVG en rojo. Derecha: gris = coinciden, rojo = solo SVG, cian = solo original.",
            fill=(170, 170, 170), font=fnt2)
    y = 100
    for titulo, a, b in paneles:
        dr.text((20, y), titulo, fill=(200, 200, 200), font=fnt2)
        y += 30
        lienzo.paste(Image.fromarray(a), (20, y))
        lienzo.paste(Image.fromarray(b), (20 + a.shape[1] + 30, y))
        y += a.shape[0] + 20
    lienzo.quantize(colors=256, method=Image.Quantize.MEDIANCUT).save(os.path.join(MARCA, "comparacion.png"), optimize=True)


if __name__ == "__main__":
    main()
