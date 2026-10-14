"""¿Qué tipografía de Google Fonts se parece más al rótulo del logo?

Para cada familia y peso, Chromium dibuja cada letra en un canvas; se escala a
la altura de la letra del logo (máscara x4 del original), se alinea por la
línea base y el centro, y se mide el IoU letra a letra. Se dan dos notas: la
de «NEIXÓN» (mayúsculas finas) y la de «Hotel Rural».

Uso: python -I scripts/logo_tipografia.py
Salida: scripts/_tmp/tipografias.json y marca/tipografias.png (comparación visual).
"""
import base64
import io
import json
import os
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from playwright.sync_api import sync_playwright

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from logo_mascara import ESCALA, campo_x4, cobertura_clara  # noqa: E402

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
TMP = os.path.join(AQUI, "_tmp")

FAMILIAS = {
    # familia: pesos a probar
    "Lato": [100, 300, 400, 700],
    "Mulish": [200, 300, 400, 500, 600],
    "Nunito Sans": [200, 300, 400, 500, 600],
    "Figtree": [300, 400, 500, 600],
    "Jost": [200, 300, 400, 500],
    "Josefin Sans": [100, 200, 300, 400, 500],
    "Raleway": [200, 300, 400, 500],
    "Montserrat": [200, 300, 400, 500],
    "Cabin": [400, 500],
    "Outfit": [200, 300, 400, 500],
    "Albert Sans": [200, 300, 400, 500],
    "Red Hat Display": [300, 400, 500],
    "Questrial": [400],
    "Urbanist": [200, 300, 400, 500],
    "Poppins": [200, 300, 400],
    "Work Sans": [200, 300, 400, 500],
    "Manrope": [200, 300, 400, 500],
    "Plus Jakarta Sans": [200, 300, 400, 500],
    "Lexend": [200, 300, 400],
    "DM Sans": [200, 300, 400, 500],
    "Inter": [200, 300, 400, 500],
    "Kumbh Sans": [200, 300, 400, 500],
    "Hanken Grotesk": [200, 300, 400, 500],
    "Onest": [200, 300, 400, 500],
    "Instrument Sans": [400, 500],
    "Sora": [200, 300, 400],
    "Gantari": [200, 300, 400, 500],
    "Golos Text": [400, 500],
    "Be Vietnam Pro": [200, 300, 400, 500],
    "Tenor Sans": [400],
    "Didact Gothic": [400],
    "Nunito": [200, 300, 400, 500],
    "Rubik": [300, 400],
    "Quicksand": [300, 400, 500],
}
CAJA_TEXTO = (440, 400, 1050, 700)
NEIXON = ["N", "E", "I", "X", "Ó", "N"]
HOTEL = ["H", "o", "t", "e", "l", "R", "u", "r", "a", "l"]


def letras_del_logo():
    cob = cobertura_clara(os.path.join(RAIZ, "ref", "logo", "logo-1536x1024.png"))
    m = campo_x4(cob) > 0.5
    n, lab, st, cen = cv2.connectedComponentsWithStats(m.astype(np.uint8), connectivity=4)
    letras = []
    for i in range(1, n):
        x, y, w, h, a = st[i]
        if a < 16 * 40:
            continue
        if (x / 4 >= CAJA_TEXTO[0] and y / 4 >= CAJA_TEXTO[1] and (x + w) / 4 <= CAJA_TEXTO[2]
                and (y + h) / 4 <= CAJA_TEXTO[3]):
            letras.append(i)
    arriba = sorted([i for i in letras if cen[i][1] / 4 < 590], key=lambda i: st[i][0])
    abajo = sorted([i for i in letras if cen[i][1] / 4 >= 590], key=lambda i: st[i][0])
    # Ó = O + tilde (componentes 5 y 6 de la fila de arriba)
    grupos_arriba = [[arriba[0]], [arriba[1]], [arriba[2]], [arriba[3]], [arriba[4], arriba[5]], [arriba[6]]]
    out = {}
    for fila, grupos, nombres in (("neixon", grupos_arriba, NEIXON), ("hotel", [[i] for i in abajo], HOTEL)):
        base = max(st[g[0]][1] + st[g[0]][3] for g in grupos if nombres[grupos.index(g)] in "NEIHlRl")
        lst = []
        for g, nm in zip(grupos, nombres):
            msk = np.isin(lab, g)
            ys, xs = np.nonzero(msk)
            lst.append(dict(nombre=nm, mask=msk[ys.min():ys.max() + 1, xs.min():xs.max() + 1],
                            top=ys.min(), bottom=ys.max() + 1, base=base, x=xs.min(), y=ys.min()))
        out[fila] = lst
    return out


JS = """
async ([fam, pesos, letras]) => {
  const out = {};
  const c = document.createElement('canvas'); c.width = 900; c.height = 700;
  const ctx = c.getContext('2d');
  for (const w of pesos) {
    await document.fonts.load(`${w} 400px "${fam}"`, letras.join(''));
    out[w] = [];
    for (const L of letras) {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 900, 700);
      ctx.fillStyle = '#fff'; ctx.font = `${w} 400px "${fam}"`; ctx.textBaseline = 'alphabetic';
      ctx.fillText(L, 150, 520);
      out[w].push(c.toDataURL('image/png'));
    }
    out[w + '_ok'] = document.fonts.check(`${w} 400px "${fam}"`);
  }
  return out;
}
"""


def decodifica(url):
    b = base64.b64decode(url.split(",", 1)[1])
    a = np.array(Image.open(io.BytesIO(b)).convert("L"))
    return a > 127


def iou_letra(ref, cand_mask, base_px=520):
    """Escala la letra candidata a la altura de la del logo (misma relación
    altura/línea base) y alinea centro horizontal y línea base."""
    ys, xs = np.nonzero(cand_mask)
    if len(ys) == 0:
        return 0.0, None
    c = cand_mask[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    h_ref = ref["mask"].shape[0]
    esc = h_ref / c.shape[0]
    cw = max(1, int(round(c.shape[1] * esc)))
    cs = cv2.resize(c.astype(np.float32), (cw, h_ref), interpolation=cv2.INTER_AREA) > 0.5
    r = ref["mask"]
    W = max(r.shape[1], cw) + 8
    A = np.zeros((h_ref, W), bool); B = np.zeros((h_ref, W), bool)
    A[:, (W - r.shape[1]) // 2:(W - r.shape[1]) // 2 + r.shape[1]] = r
    B[:, (W - cw) // 2:(W - cw) // 2 + cw] = cs
    return float((A & B).sum() / max(1, (A | B).sum())), cs


def main():
    ref = letras_del_logo()
    resultados = {}
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page()
        for fam, pesos in FAMILIAS.items():
            q = fam.replace(" ", "+")
            href = f"https://fonts.googleapis.com/css2?family={q}:wght@{';'.join(map(str, pesos))}&display=block"
            pg.set_content(f"<html><head><link rel='stylesheet' href='{href}'></head><body></body></html>",
                           wait_until="networkidle")
            letras = NEIXON + HOTEL
            res = pg.evaluate(JS, [fam, pesos, letras])
            resultados[fam] = {}
            for w in pesos:
                if not res.get(f"{w}_ok"):
                    print("  sin cargar", fam, w)
                    continue
                masks = [decodifica(u) for u in res[str(w)]]
                s_n = [iou_letra(r, mk)[0] for r, mk in zip(ref["neixon"], masks[:6])]
                s_h = [iou_letra(r, mk)[0] for r, mk in zip(ref["hotel"], masks[6:])]
                resultados[fam][w] = dict(neixon=float(np.mean(s_n)), hotel=float(np.mean(s_h)),
                                          por_letra_neixon=[round(v, 3) for v in s_n],
                                          por_letra_hotel=[round(v, 3) for v in s_h])
            if resultados[fam]:
                mejor_n = max(resultados[fam].items(), key=lambda kv: kv[1]["neixon"])
                mejor_h = max(resultados[fam].items(), key=lambda kv: kv[1]["hotel"])
                print(f"{fam:18s} NEIXON {mejor_n[1]['neixon']:.3f} (peso {mejor_n[0]})   "
                      f"Hotel Rural {mejor_h[1]['hotel']:.3f} (peso {mejor_h[0]})")
        b.close()
    with open(os.path.join(TMP, "tipografias.json"), "w", encoding="utf-8") as f:
        json.dump(resultados, f, indent=1, ensure_ascii=False)


def panel(candidatas):
    """marca/tipografias.png: el rótulo (gris) con cada letra de la candidata
    encima (contorno rojo), a la misma altura y centrada en la letra original."""
    ref = letras_del_logo()
    x0, y0, x1, y1 = 448 * ESCALA, 410 * ESCALA, 1042 * ESCALA, 690 * ESCALA
    k = 0.5  # x4 -> x2
    filas = []
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page()
        for fam, w_n, w_h, nota in candidatas:
            q = fam.replace(" ", "+")
            pesos = sorted({w_n, w_h})
            href = f"https://fonts.googleapis.com/css2?family={q}:wght@{';'.join(map(str, pesos))}&display=block"
            pg.set_content(f"<html><head><link rel='stylesheet' href='{href}'></head><body></body></html>",
                           wait_until="networkidle")
            res = pg.evaluate(JS, [fam, pesos, NEIXON + HOTEL])
            base = np.zeros((y1 - y0, x1 - x0), np.uint8)
            cand = np.zeros_like(base)
            letras = [(r, decodifica(res[str(w_n)][i])) for i, r in enumerate(ref["neixon"])] +                      [(r, decodifica(res[str(w_h)][6 + i])) for i, r in enumerate(ref["hotel"])]
            for r, mk in letras:
                _, cs = iou_letra(r, mk)
                h, wr = r["mask"].shape
                ry, rx = r["y"] - y0, r["x"] - x0
                base[ry:ry + h, rx:rx + wr] |= r["mask"].astype(np.uint8)
                cw = cs.shape[1]
                cx = rx + wr // 2 - cw // 2
                sub = cand[ry:ry + h, max(0, cx):cx + cw]
                sub |= cs[:, max(0, -cx):max(0, -cx) + sub.shape[1]].astype(np.uint8)
            base = cv2.resize(base, None, fx=k, fy=k, interpolation=cv2.INTER_AREA)
            cand = cv2.resize(cand, None, fx=k, fy=k, interpolation=cv2.INTER_AREA)
            img = np.zeros(base.shape + (3,), np.uint8); img[:] = (24, 26, 32)
            img[base > 0] = (200, 200, 196)
            borde = cv2.morphologyEx((cand > 0).astype(np.uint8), cv2.MORPH_GRADIENT, np.ones((3, 3), np.uint8)) > 0
            img[borde] = (235, 50, 50)
            filas.append((f"{fam}  ·  NEIXÓN {w_n}  ·  Hotel Rural {w_h}  ·  {nota}", img))
        b.close()
    ancho = filas[0][1].shape[1] + 40
    alto = sum(f[1].shape[0] + 50 for f in filas) + 70
    lienzo = Image.new("RGB", (ancho, alto), (14, 15, 19))
    dr = ImageDraw.Draw(lienzo)
    try:
        fnt = ImageFont.truetype("arial.ttf", 22); fnt2 = ImageFont.truetype("arial.ttf", 17)
    except OSError:
        fnt = fnt2 = ImageFont.load_default()
    dr.text((20, 16), "Rótulo del logo (gris) y candidata de Google Fonts (contorno rojo), letra a letra a la misma altura",
            fill=(235, 235, 235), font=fnt2)
    y = 50
    for titulo, img in filas:
        dr.text((20, y), titulo, fill=(220, 220, 220), font=fnt)
        y += 32
        lienzo.paste(Image.fromarray(img), (20, y))
        y += img.shape[0] + 18
    lienzo.save(os.path.join(RAIZ, "marca", "tipografias.png"), optimize=True)


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--panel":
        datos = json.load(open(os.path.join(TMP, "tipografias.json"), encoding="utf-8"))
        cands = []
        for fam in sys.argv[2:]:
            r = datos[fam]
            wn = max(r, key=lambda w: r[w]["neixon"]); wh = max(r, key=lambda w: r[w]["hotel"])
            cands.append((fam, int(wn), int(wh),
                          f"IoU medio por letra {r[wn]['neixon']:.3f} / {r[wh]['hotel']:.3f}"))
        panel(cands)
    else:
        main()
