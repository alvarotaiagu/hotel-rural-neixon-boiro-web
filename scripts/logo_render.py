"""Comprobación independiente: Chromium pinta marca/logo.svg y se compara
con la máscara del original (IoU a 2x). También guarda vistas ampliadas.

Uso: python -I scripts/logo_render.py [zoom_x zoom_y zoom_w zoom_h escala]
"""
import json
import os
import sys

import numpy as np
import cv2
from PIL import Image
from playwright.sync_api import sync_playwright

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from logo_mascara import ESCALA, campo_x4, cobertura_clara  # noqa: E402

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
MARCA = os.path.join(RAIZ, "marca")
TMP = os.path.join(AQUI, "_tmp")


def pintar(pagina, svg, w, h, escala, vista=None):
    vb = f"{vista[0]} {vista[1]} {vista[2]} {vista[3]}" if vista else None
    if vb:
        svg = svg.replace('viewBox="', 'data-vb="', 1).replace("<svg ", f'<svg viewBox="{vb}" ', 1)
    svg = svg.replace(f'width="{W0}" height="{H0}"', f'width="{w}" height="{h}"', 1)
    html = f"<html><body style='margin:0;background:#000;color:#fff'>{svg}</body></html>"
    pagina.set_viewport_size({"width": w, "height": h})
    pagina.set_content(html)
    png = pagina.screenshot(clip={"x": 0, "y": 0, "width": w, "height": h})
    return np.array(Image.open(__import__("io").BytesIO(png)).convert("L"))


if __name__ == "__main__":
    res = json.load(open(os.path.join(TMP, "resultado.json"), encoding="utf-8"))
    ox, oy = res["origen_en_imagen"]
    _, _, W0, H0 = res["viewBox"]
    svg = open(os.path.join(MARCA, "logo.svg"), encoding="utf-8").read()
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page()
        # IoU a 2x con el renderizado del navegador
        E = 2
        img = pintar(pg, svg, W0 * E, H0 * E, E)
        cob = cobertura_clara(os.path.join(RAIZ, "ref", "logo", "logo-1536x1024.png"))
        campo = campo_x4(cob)
        ref = cv2.resize(campo[oy * ESCALA:(oy + H0) * ESCALA, ox * ESCALA:(ox + W0) * ESCALA],
                         (W0 * E, H0 * E), interpolation=cv2.INTER_AREA) > 0.5
        ren = img > 127
        iou = (ren & ref).sum() / (ren | ref).sum()
        print("IoU Chromium 2x (logo completo):", round(float(iou), 4))
        if len(sys.argv) >= 6:
            x, y, w, h, esc = map(float, sys.argv[1:6])
            z = pintar(pg, svg, int(w * esc), int(h * esc), esc, (x, y, w, h))
            Image.fromarray(z).save(os.path.join(TMP, "zoom_svg.png"))
            # contorno del SVG (rojo) sobre el original ampliado
            im = Image.open(os.path.join(RAIZ, "ref", "logo", "logo-1536x1024.png")).convert("RGBA")
            fondo = Image.new("RGBA", im.size, (40, 40, 48, 255)); fondo.alpha_composite(im)
            orig = np.array(fondo.crop((int(x + ox), int(y + oy), int(x + ox + w), int(y + oy + h)))
                            .resize((z.shape[1], z.shape[0]), Image.BICUBIC).convert("RGB"))
            borde = cv2.morphologyEx((z > 127).astype(np.uint8), cv2.MORPH_GRADIENT, np.ones((2, 2), np.uint8)) > 0
            orig[borde] = (255, 30, 30)
            Image.fromarray(orig).save(os.path.join(TMP, "zoom_sobre.png"))
            print("vista guardada en scripts/_tmp/zoom_svg.png")
        b.close()
