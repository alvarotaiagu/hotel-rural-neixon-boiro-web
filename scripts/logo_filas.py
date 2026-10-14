"""Vista de control: cada piedra coloreada por fila (data-anillo) con su número.
Uso: python -I scripts/logo_filas.py  ->  scripts/_tmp/filas.png
"""
import json
import os

from playwright.sync_api import sync_playwright

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
js = json.load(open(os.path.join(RAIZ, "marca", "piedras.json"), encoding="utf-8"))
_, _, W, H = js["viewBox"]
cx, cy = js["centro"]
colores = ["#e8c547", "#4fa3d9", "#d9534f", "#7bc96f"]
partes = []
for p in js["piedras"]:
    partes.append(f'<path d="{p["d"]}" fill="{colores[p["anillo"] % 4]}"/>')
    n = p["id"].split("-")[1]
    partes.append(f'<text x="{p["cx"]}" y="{p["cy"] + 5}" font-size="15" text-anchor="middle" '
                  f'font-family="Arial" fill="#000">{n}</text>')
partes.append(f'<circle cx="{cx}" cy="{cy}" r="5" fill="#fff"/>')
partes.append(f'<circle cx="{cx}" cy="{cy}" r="{js["radioMedio"]}" fill="none" stroke="#fff" stroke-dasharray="4 6"/>')
svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">' + "".join(partes) + "</svg>"
html = f"<html><body style='margin:0;background:#222'>{svg}</body></html>"
with sync_playwright() as pw:
    b = pw.chromium.launch()
    pg = b.new_page(viewport={"width": W, "height": H})
    pg.set_content(html)
    pg.screenshot(path=os.path.join(AQUI, "_tmp", "filas.png"))
    b.close()
print("ok")
