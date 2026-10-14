"""Enderezado de las letras calcadas.

Las rectas del rótulo salen del calco con temblores de medio píxel. Aquí:
1. Las Bézier casi rectas pasan a rectas y las rectas colineales se funden.
2. Rectas casi horizontales/verticales se ponen a eje.
3. En cada palabra, los bordes horizontales a la misma altura (altura de
   mayúscula, línea base, altura x…) se agrupan y toman el mismo valor.
4. Las astas (pares de verticales opuestas a distancia de asta) toman el
   grosor mediano de la palabra, conservando su eje; lo mismo con los
   trazos horizontales (brazos de la E, barra de la H, de la t…).
Las curvas de verdad (O, o, e, a, R, u, r) no se tocan salvo para seguir a
un vértice movido.

Representación: curva = (inicio, [("L", p) | ("C", c1, c2, p)]), en px a 1x.
"""
import math

import numpy as np

TOL_RECTA = 0.3      # px: control de una Bézier a menos de esto de su cuerda -> recta
TOL_EJE = 5.0        # grados: recta a menos de esto del eje -> a eje
TOL_GRUPO = 1.0      # px: bordes horizontales a menos de esto -> misma altura
LONG_MIN = 2.5       # px: rectas más cortas no se tocan
TOL_GROSOR = 0.6     # px: solo se iguala el temblor; un trazo de grosor distinto se respeta
DEPURAR = False


def _u(v):
    n = math.hypot(*v)
    return v / n if n > 1e-12 else v


def _dist_cuerda(p0, p3, c):
    d = p3 - p0
    n = math.hypot(*d)
    if n < 1e-9:
        return math.hypot(*(c - p0))
    return abs(d[0] * (c - p0)[1] - d[1] * (c - p0)[0]) / n


class Contorno:
    def __init__(self, ini, segs):
        # vértices V[k] y segmentos k: V[k] -> V[k+1]
        self.V = [np.array(ini, float)] + [np.array(s[-1], float) for s in segs[:-1]]
        self.T = []
        for s in segs:
            if s[0] == "L":
                self.T.append(["L"])
            else:
                self.T.append(["C", np.array(s[1], float), np.array(s[2], float)])
        self.n = len(segs)

    def fin(self, k):
        return self.V[(k + 1) % self.n]

    def a_rectas(self):
        for k in range(self.n):
            t = self.T[k]
            if t[0] == "C":
                p0, p3 = self.V[k], self.fin(k)
                if max(_dist_cuerda(p0, p3, t[1]), _dist_cuerda(p0, p3, t[2])) < TOL_RECTA:
                    # además los controles deben ir hacia delante
                    d = p3 - p0
                    if (t[1] - p0) @ d >= 0 and (p3 - t[2]) @ d >= 0:
                        self.T[k] = ["L"]

    def fundir(self):
        cambio = True
        while cambio and self.n > 3:
            cambio = False
            for k in range(self.n):
                k2 = (k + 1) % self.n
                if self.T[k][0] == "L" and self.T[k2][0] == "L":
                    a, b, c = self.V[k], self.V[k2], self.fin(k2)
                    v1, v2 = b - a, c - b
                    if math.hypot(*v1) < 1e-9 or math.hypot(*v2) < 1e-9:
                        continue
                    ang = abs(math.degrees(math.atan2(v1[0] * v2[1] - v1[1] * v2[0], v1 @ v2)))
                    if ang < 2.5:
                        # quitar el vértice k2 (b)
                        del self.V[k2]
                        del self.T[k2]
                        self.n -= 1
                        cambio = True
                        break

    def mover(self, k, nuevo):
        """Mueve el vértice k arrastrando los controles que lo tocan."""
        d = nuevo - self.V[k]
        self.V[k] = np.array(nuevo, float)
        prev = (k - 1) % self.n
        if self.T[prev][0] == "C":
            self.T[prev][2] = self.T[prev][2] + d
        if self.T[k][0] == "C":
            self.T[k][1] = self.T[k][1] + d

    def rectas(self):
        """(k, tipo 'h'|'v'|None, a, b) para cada recta."""
        out = []
        for k in range(self.n):
            if self.T[k][0] != "L":
                continue
            a, b = self.V[k], self.fin(k)
            v = b - a
            L = math.hypot(*v)
            if L < LONG_MIN:
                continue
            ang = math.degrees(math.atan2(abs(v[1]), abs(v[0])))
            tipo = "h" if ang < TOL_EJE else ("v" if ang > 90 - TOL_EJE else None)
            out.append((k, tipo, a.copy(), b.copy()))
        return out

    def con_esquinas(self, k):
        """¿La recta k acaba en esquina por los dos lados? (un remate plano o
        un brazo, no el tramo plano de una curva)."""
        a, b = self.V[k], self.fin(k)
        d = _u(b - a)
        prev = (k - 1) % self.n
        t_in = a - (self.V[prev] if self.T[prev][0] == "L" else self.T[prev][2])
        nxt = (k + 1) % self.n
        t_out = (self.fin(nxt) if self.T[nxt][0] == "L" else self.T[nxt][1]) - b
        ang_in = math.degrees(math.acos(max(-1, min(1, _u(t_in) @ d))))
        ang_out = math.degrees(math.acos(max(-1, min(1, _u(t_out) @ d))))
        return ang_in > 30 and ang_out > 30

    def salida(self):
        segs = []
        for k in range(self.n):
            p = self.fin(k)
            t = self.T[k]
            segs.append(("L", p.copy()) if t[0] == "L" else ("C", t[1].copy(), t[2].copy(), p.copy()))
        return (self.V[0].copy(), segs)


def _fijar(cont, k, eje, valor):
    """Fija la coordenada `eje` (0=x, 1=y) de los dos extremos de la recta k."""
    for j in (k, (k + 1) % cont.n):
        p = cont.V[j].copy()
        p[eje] = valor
        cont.mover(j, p)


def _grupos(valores, tol):
    orden = sorted(range(len(valores)), key=lambda i: valores[i][0])
    grupos, actual = [], []
    for i in orden:
        if actual and valores[i][0] - valores[actual[-1]][0] > tol:
            grupos.append(actual); actual = []
        actual.append(i)
    if actual:
        grupos.append(actual)
    return grupos


def enderezar_palabra(letras, pasos=(1, 2, 3, 4)):
    """letras: lista (una por letra) de listas de curvas. Devuelve lo mismo enderezado."""
    conts = [[Contorno(i, s) for i, s in letra] for letra in letras]
    if 1 not in pasos:
        return [[c.salida() for c in letra] for letra in conts]
    for letra in conts:
        for c in letra:
            c.a_rectas()
            c.fundir()
    if 2 not in pasos:
        return [[c.salida() for c in letra] for letra in conts]

    # 2. a eje (cada recta por su cuenta, valor medio)
    for letra in conts:
        for c in letra:
            for k, tipo, a, b in c.rectas():
                if tipo == "h":
                    _fijar(c, k, 1, (a[1] + b[1]) / 2)
                elif tipo == "v":
                    _fijar(c, k, 0, (a[0] + b[0]) / 2)

    if 3 not in pasos:
        return [[c.salida() for c in letra] for letra in conts]
    # 3. alturas comunes en la palabra (ponderadas por longitud)
    hs = []
    for li, letra in enumerate(conts):
        for ci, c in enumerate(letra):
            for k, tipo, a, b in c.rectas():
                if tipo == "h" and c.con_esquinas(k):
                    hs.append((a[1], abs(b[0] - a[0]), li, ci, k))
    alturas = []  # alturas compartidas por varias letras: no se mueven en el paso 4
    for g in _grupos(hs, TOL_GRUPO):
        if len(g) < 2:
            continue
        w = sum(hs[i][1] for i in g)
        y = sum(hs[i][0] * hs[i][1] for i in g) / w
        if len({hs[i][2] for i in g}) >= 2:
            alturas.append(y)
        for i in g:
            _, _, li, ci, k = hs[i]
            _fijar(conts[li][ci], k, 1, y)

    if 4 not in pasos:
        return [[c.salida() for c in letra] for letra in conts]
    # 4. grosores de asta: pares de rectas opuestas dentro de la misma letra
    for tipo, eje, otro in (("v", 0, 1), ("h", 1, 0)):
        pares = []
        for li, letra in enumerate(conts):
            rs = []
            for ci, c in enumerate(letra):
                for k, t, a, b in c.rectas():
                    if t == tipo:
                        rs.append((ci, k, a, b))
            usados = set()
            for i, (ci, k, a, b) in enumerate(rs):
                mejor = None
                for j, (cj, kj, a2, b2) in enumerate(rs):
                    if j == i:
                        continue
                    # sentido opuesto
                    if (b[otro] - a[otro]) * (b2[otro] - a2[otro]) >= 0:
                        continue
                    lo1, hi1 = sorted((a[otro], b[otro])); lo2, hi2 = sorted((a2[otro], b2[otro]))
                    solape = min(hi1, hi2) - max(lo1, lo2)
                    if solape < 0.7 * min(hi1 - lo1, hi2 - lo2):
                        continue
                    g = abs(a2[eje] - a[eje])
                    if 2.0 < g < 14.0 and (mejor is None or g < mejor[0]):
                        mejor = (g, j)
                if mejor and (min(i, mejor[1]), max(i, mejor[1])) not in usados:
                    usados.add((min(i, mejor[1]), max(i, mejor[1])))
                    pares.append((li, rs[i], rs[mejor[1]], mejor[0]))
        if not pares:
            continue
        med = float(np.median([p[3] for p in pares]))
        if DEPURAR:
            print("   grosor", tipo, "mediana", round(med, 2), [(li, round(g, 2)) for li, _, _, g in pares])
        for li, (ci, k, a, b), (cj, kj, a2, b2), g in pares:
            if abs(g - med) > TOL_GROSOR:
                continue
            c1, c2 = conts[li][ci], conts[li][cj]
            v1, v2 = c1.V[k][eje], c2.V[kj][eje]
            s = 1 if v1 < v2 else -1
            fijo1 = eje == 1 and any(abs(v1 - y) < 1e-6 for y in alturas)
            fijo2 = eje == 1 and any(abs(v2 - y) < 1e-6 for y in alturas)
            if fijo1 and fijo2:
                continue
            if fijo1:
                _fijar(c2, kj, eje, v1 + s * med)
            elif fijo2:
                _fijar(c1, k, eje, v2 - s * med)
            else:
                centro = (v1 + v2) / 2
                _fijar(c1, k, eje, centro - s * med / 2)
                _fijar(c2, kj, eje, centro + s * med / 2)

    return [[c.salida() for c in letra] for letra in conts]
