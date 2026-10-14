"""Paso 1: mascara de «material claro» a x4 y componentes conexas.

Uso: python -I scripts/logo_mascara.py
Deja en scripts/_tmp/ la mascara binaria (npz) y una vista de etiquetas.
"""
import os
import numpy as np
import cv2
from PIL import Image

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
TMP = os.path.join(AQUI, "_tmp")
os.makedirs(TMP, exist_ok=True)

ESCALA = 4          # ampliacion para precision subpixel
OSCURO, CLARO = 25.0, 200.0   # luminancia de junta / de piedra


def cobertura_clara(ruta):
    """0..1: cuanto 'material claro' hay en cada pixel (alfa x claridad)."""
    im = np.array(Image.open(ruta).convert("RGBA")).astype(np.float32)
    alfa = im[..., 3] / 255.0
    lum = im[..., :3] @ np.array([0.2126, 0.7152, 0.0722], np.float32)
    claridad = np.clip((lum - OSCURO) / (CLARO - OSCURO), 0, 1)
    return alfa * claridad


def campo_x4(cob):
    """Cobertura ampliada x4 (bicúbica) y suavizada: campo continuo 0..1."""
    h, w = cob.shape
    big = cv2.resize(cob, (w * ESCALA, h * ESCALA), interpolation=cv2.INTER_CUBIC)
    return cv2.GaussianBlur(big, (0, 0), sigmaX=0.6 * ESCALA / 2)


def mascara_x4(cob):
    return campo_x4(cob) > 0.5


if __name__ == "__main__":
    cob = cobertura_clara(os.path.join(RAIZ, "ref", "logo", "logo-1536x1024.png"))
    m = mascara_x4(cob)
    np.savez_compressed(os.path.join(TMP, "mascara.npz"), m=m, cob=cob)
    n, lab, st, cen = cv2.connectedComponentsWithStats(m.astype(np.uint8), connectivity=4)
    print("componentes", n - 1)
    areas = st[1:, cv2.CC_STAT_AREA] / ESCALA ** 2
    orden = np.argsort(-areas)
    for i in orden:
        x, y, w, h = st[i + 1, :4] / ESCALA
        print(f"{i+1:4d} area={areas[i]:8.1f} bbox=({x:6.1f},{y:6.1f},{w:6.1f},{h:6.1f}) c=({cen[i+1][0]/ESCALA:6.1f},{cen[i+1][1]/ESCALA:6.1f})")
    rng = np.random.default_rng(1)
    col = rng.integers(60, 255, (n, 3)).astype(np.uint8); col[0] = 0
    vis = col[lab[::2, ::2]]
    Image.fromarray(vis).save(os.path.join(TMP, "etiquetas.png"))
