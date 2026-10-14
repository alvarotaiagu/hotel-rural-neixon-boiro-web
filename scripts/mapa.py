# -*- coding: utf-8 -*-
"""
Mapa ilustrado del Barbanza para Hotel Rural Neixon (Boiro).
Saca de OpenStreetMap (Overpass + OSRM) costa, carreteras, rios y lugares, los proyecta a metros
desde el hotel y escribe js/barbanza.js y datos/barbanza.json.

Uso (desde la carpeta scripts, con python -I):
    python -I mapa.py            # todo (usa cache de Overpass si existe)
Variable NEIXON_CACHE: carpeta de cache de Overpass/OSRM (por defecto scripts/.cache).
"""
import sys, os, json, math, time, urllib.request

sys.stdout.reconfigure(encoding="utf-8")
AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
from ovp import overpass, CACHE, UA  # noqa

RAIZ = os.path.dirname(AQUI)
FECHA = "2026-10-14"
PIN_WEB = (42.66720, -8.84677)
HOTEL_NODO = 11091306436  # "Hotel Rural Neixon" (tourism=chalet) en OSM

# caja de descarga (grados) algo mayor que la caja del mapa
DESCARGA = (42.49, -9.16, 42.80, -8.64)  # S, W, N, E

# ---------------------------------------------------------------- lugares
# id, nombre es, nombre gl, tipo, ref OSM, extra
LUGARES = [
    ("barrana", "Playa de Barraña", "Praia de Barraña", "playa", ("way", 649425621), {"punto": "borde"}),
    ("carragueiros", "Playa de Carragueiros", "Praia de Carragueiros", "playa", ("way", 108818579), {"punto": "borde"}),
    ("manons", "Playa de Mañóns", "Praia de Mañóns", "playa", ("way", 247273533), {"punto": "borde"}),
    ("castro-neixon", "Castro de Neixón", "Castros de Neixón", "castro", ("way", 1537692895), {}),
    ("centro-arqueoloxico", "Centro Arqueológico del Barbanza", "Centro Arqueolóxico do Barbanza", "patrimonio", ("way", 1245603802), {}),
    ("castro-achadizo", "Castro de Achadizo", "Castro do Achadizo", "castro", ("node", 8189071694), {}),
    ("mamoas", "Mámoas de la sierra del Barbanza", "Mámoas da Serra do Barbanza", "patrimonio", ("node", 12053020843),
     {"nota": "no existe una ruta \"Ruta das Mámoas\" en OSM; punto = Mámoa da Cavada (Cures, Boiro), una de las ~14 mámoas cartografiadas en la sierra al norte de Boiro; el tiempo en coche (velocidad media ~22 km/h) indica carreteras de montaña o pistas"}),
    ("santa-baia", "Iglesia de Santa Baia", "Igrexa de Santa Baia", "patrimonio", ("way", 141772168), {}),
    ("iroite", "Monte Iroite", "Monte Iroite", "naturaleza", ("node", 7040973284),
     {"nota": "cumbre de la Serra do Barbanza (687 m); OSM la sitúa en el límite de Porto do Son/Lousame, no en Boiro; el coche llega hasta la pista más cercana"}),
    ("coroño", "Estuario del río Coroño", "Estuario do río Coroño", "naturaleza", ("relation", 20723195), {"punto": "desembocadura"}),
    ("barona", "Castro de Baroña", "Castro de Baroña", "excursion", ("node", 444451262),
     {"nota": "está en Porto do Son; los últimos ~500 m hasta el castro son a pie desde el aparcamiento"}),
    ("cortegada", "Isla de Cortegada", "Illa de Cortegada", "excursion", ("way", 4889752),
     {"coche_a": ("way", 235475679), "acceso": "barco desde el puerto de O Carril; el tiempo en coche es hasta ese puerto"}),
    ("torres-oeste", "Torres del Oeste (Catoira)", "Torres do Oeste (Catoira)", "excursion", ("way", 948857474),
     {"nota": "está en Catoira (Pontevedra), al otro lado del Ulla"}),
    ("corrubedo", "Parque Natural Dunas de Corrubedo", "Parque Natural das Dunas de Corrubedo", "excursion", ("way", 80672768),
     {"nota": "punto = centro del sistema dunar (Ribeira); la carretera queda a ~800 m, el último tramo es a pie"}),
    ("boiro", "Boiro (centro)", "Boiro (centro)", "ciudad", ("node", 985207682), {}),
    ("santiago", "Santiago de Compostela", "Santiago de Compostela", "ciudad", ("node", 998649870), {"fuera_caja": True}),
    ("scq", "Aeropuerto de Santiago (SCQ)", "Aeroporto de Santiago (SCQ)", "ciudad", ("way", 71837861), {"fuera_caja": True}),
]

consultas = []  # (descripcion, texto) para el JSON


def ovp(desc, q):
    consultas.append({"para": desc, "consulta": q})
    return overpass(q)


def ovp_teselas(desc, filtro, caja, nx, ny):
    """Overpass se atraganta con cajas grandes: se parte en teselas y se deduplican las vias por id."""
    S, W, N, E = caja
    vistos, elementos = set(), []
    ejemplo = None
    for i in range(ny):
        for k in range(nx):
            s, n = S + (N - S) * i / ny, S + (N - S) * (i + 1) / ny
            w, e = W + (E - W) * k / nx, W + (E - W) * (k + 1) / nx
            q = "[out:json][timeout:90];%s(%.4f,%.4f,%.4f,%.4f);out body geom;" % (filtro, s, w, n, e)
            ejemplo = ejemplo or q
            j = overpass(q)
            print("  tesela %d,%d: %d vias" % (i, k, len(j["elements"])), flush=True)
            for el in j["elements"]:
                if (el["type"], el["id"]) not in vistos:
                    vistos.add((el["type"], el["id"])); elementos.append(el)
    consultas.append({"para": desc + " (en %dx%d teselas; se muestra la primera)" % (nx, ny), "consulta": ejemplo})
    return {"elements": elementos}


# ---------------------------------------------------------------- geometria
def proy(lat, lon, lat0, lon0):
    return ((lon - lon0) * 111320 * math.cos(math.radians(lat0)), -(lat - lat0) * 111320)


def haversine(lat1, lon1, lat2, lon2):
    R = 6371000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    a = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lon2 - lon1) / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def dp(pts, eps):
    """Douglas-Peucker iterativo sobre lista [(x,y)]; extremos fijos."""
    n = len(pts)
    if n < 3:
        return list(pts)
    keep = [False] * n
    keep[0] = keep[-1] = True
    pila = [(0, n - 1)]
    while pila:
        a, b = pila.pop()
        ax, ay = pts[a]; bx, by = pts[b]
        dx, dy = bx - ax, by - ay
        L2 = dx * dx + dy * dy
        dmax, imax = -1.0, -1
        for i in range(a + 1, b):
            px, py = pts[i]
            if L2 == 0:
                d = math.hypot(px - ax, py - ay)
            else:
                t = ((px - ax) * dx + (py - ay) * dy) / L2
                t = max(0.0, min(1.0, t))
                d = math.hypot(px - (ax + t * dx), py - (ay + t * dy))
            if d > dmax:
                dmax, imax = d, i
        if dmax > eps:
            keep[imax] = True
            pila.append((a, imax)); pila.append((imax, b))
    return [p for p, k in zip(pts, keep) if k]


def dp_linea(pts, eps):
    """DP que trata los anillos cerrados: parte por el vertice mas lejano al primero."""
    if len(pts) >= 4 and pts[0] == pts[-1]:
        x0, y0 = pts[0]
        k = max(range(1, len(pts) - 1), key=lambda i: (pts[i][0] - x0) ** 2 + (pts[i][1] - y0) ** 2)
        a = dp(pts[:k + 1], eps)
        b = dp(pts[k:], eps)
        return a + b[1:]
    return dp(pts, eps)


def redondea(pts):
    out = []
    for x, y in pts:
        p = (int(round(x)), int(round(y)))
        if not out or out[-1] != p:
            out.append(p)
    return out


def recorta_segmento(p, q, caja):
    """Liang-Barsky. Devuelve (t0, t1) o None."""
    x0, y0, x1, y1 = caja
    dx, dy = q[0] - p[0], q[1] - p[1]
    t0, t1 = 0.0, 1.0
    for pp, qq in ((-dx, p[0] - x0), (dx, x1 - p[0]), (-dy, p[1] - y0), (dy, y1 - p[1])):
        if pp == 0:
            if qq < 0:
                return None
        else:
            r = qq / pp
            if pp < 0:
                if r > t1: return None
                if r > t0: t0 = r
            else:
                if r < t0: return None
                if r < t1: t1 = r
    return t0, t1


def recorta_linea(pts, caja):
    """Parte una polilinea en tramos dentro de la caja."""
    runs, cur = [], []
    for i in range(len(pts) - 1):
        p, q = pts[i], pts[i + 1]
        r = recorta_segmento(p, q, caja)
        if r is None:
            if len(cur) > 1: runs.append(cur)
            cur = []
            continue
        t0, t1 = r
        a = (p[0] + t0 * (q[0] - p[0]), p[1] + t0 * (q[1] - p[1]))
        b = (p[0] + t1 * (q[0] - p[0]), p[1] + t1 * (q[1] - p[1]))
        if t0 > 0 or not cur:
            if len(cur) > 1: runs.append(cur)
            cur = [a]
        cur.append(b)
        if t1 < 1:
            if len(cur) > 1: runs.append(cur)
            cur = []
    if len(cur) > 1: runs.append(cur)
    return runs


def une_dirigido(ways):
    """ways: lista de (nodes, pts). Une por extremos respetando el sentido (costa)."""
    por_ini = {}
    for i, (nodes, pts) in enumerate(ways):
        por_ini.setdefault(nodes[0], []).append(i)
    usados = [False] * len(ways)
    fines = {nodes[-1] for nodes, _ in ways}
    cadenas = []

    def seguir(i):
        nodes, pts = ways[i]
        usados[i] = True
        cn, cp = list(nodes), list(pts)
        while True:
            sig = [j for j in por_ini.get(cn[-1], []) if not usados[j]]
            if not sig:
                break
            j = sig[0]
            usados[j] = True
            cn += ways[j][0][1:]
            cp += ways[j][1][1:]
        return cn, cp

    # primero las cadenas que empiezan en un nodo que no es final de otra
    for i, (nodes, _) in enumerate(ways):
        if not usados[i] and nodes[0] not in fines:
            cadenas.append(seguir(i))
    for i in range(len(ways)):
        if not usados[i]:
            cadenas.append(seguir(i))
    return cadenas


def une_sin_sentido(ways):
    """Une tramos por extremos sin importar el sentido. ways: lista de (nodes, pts)."""
    ends = {}
    for i, (nodes, _) in enumerate(ways):
        ends.setdefault(nodes[0], []).append(i)
        ends.setdefault(nodes[-1], []).append(i)
    usados = [False] * len(ways)
    cadenas = []
    for i in range(len(ways)):
        if usados[i]:
            continue
        usados[i] = True
        cp = list(ways[i][1]); cn = list(ways[i][0])
        for lado in (0, 1):
            while True:
                extremo = cn[-1]
                sig = [j for j in ends.get(extremo, []) if not usados[j]]
                if not sig:
                    break
                j = sig[0]
                usados[j] = True
                nn, pp = ways[j]
                if nn[0] == extremo:
                    cn += list(nn[1:]); cp += list(pp[1:])
                else:
                    cn += list(reversed(nn))[1:]; cp += list(reversed(pp))[1:]
            cn.reverse(); cp.reverse()
        cadenas.append((cn, cp))
    return cadenas


def plano(pts):
    return [c for p in pts for c in p]


# ---------------------------------------------------------------- lugares OSM
def centro_bounds(b):
    return ((b["minlat"] + b["maxlat"]) / 2, (b["minlon"] + b["maxlon"]) / 2)


def coger_lugares():
    ids = {"node": [], "way": [], "relation": []}
    for _, _, _, _, ref, extra in LUGARES:
        ids[ref[0]].append(ref[1])
        if "coche_a" in extra:
            ids[extra["coche_a"][0]].append(extra["coche_a"][1])
    ids["node"].append(HOTEL_NODO)
    partes = []
    for t, v in ids.items():
        if v:
            partes.append("%s(id:%s);" % (t, ",".join(str(x) for x in sorted(set(v)))))
    q = "[out:json][timeout:90];(" + "".join(partes) + ");out body geom;"
    j = ovp("lugares y hotel, por id (verificacion de etiquetas y geometria)", q)
    return {(e["type"], e["id"]): e for e in j["elements"]}


def punto_de(e, modo=None):
    """(lat, lon) del elemento. modo 'borde': vertice del contorno mas cercano al centro del bbox."""
    if e["type"] == "node":
        return e["lat"], e["lon"]
    if e["type"] == "way":
        g = e["geometry"]
        clat, clon = centro_bounds(e["bounds"])
        if modo == "borde":
            v = min(g, key=lambda p: (p["lat"] - clat) ** 2 + ((p["lon"] - clon) * 0.74) ** 2)
            return v["lat"], v["lon"]
        return clat, clon
    # relacion: centro de bounds
    return centro_bounds(e["bounds"])


def desembocadura_coro():
    """Desembocadura = ultimo nodo del rio segun el sentido de las vias (el agua fluye hacia el final)."""
    q = "[out:json][timeout:90];rel(id:20723195);way(r);out body geom;"
    j = ovp("rio Coroño: vias de la relacion para hallar la desembocadura", q)
    ways = [(e["nodes"], [(p["lat"], p["lon"]) for p in e["geometry"]]) for e in j["elements"] if e["type"] == "way"]
    cad = une_dirigido(ways)
    cad.sort(key=lambda c: -len(c[1]))
    return cad[0][1][-1], len(j["elements"])


# ---------------------------------------------------------------- OSRM
def osrm(perfil, a, b, intentos=5):
    url = "https://routing.openstreetmap.de/routed-%s/route/v1/driving/%.6f,%.6f;%.6f,%.6f?overview=false" % (perfil, a[1], a[0], b[1], b[0])
    ult = None
    for i in range(intentos):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=60) as r:
                j = json.loads(r.read().decode("utf-8"))
            time.sleep(0.4)
            if j.get("code") != "Ok":
                raise ValueError(j.get("code"))
            rt = j["routes"][0]
            snaps = [w.get("distance") for w in j["waypoints"]]
            return rt["distance"], rt["duration"], snaps, url
        except Exception as e:
            ult = e
            time.sleep(2 + 2 * i)
    raise RuntimeError("OSRM fallo %s: %s" % (url, ult))


def minutos(seg):
    return max(2, math.ceil(seg / 60))


# ---------------------------------------------------------------- capas
def tramos_osm(j):
    """elementos way con geometry -> [(nodes, [(lat,lon)], tags)]"""
    out = []
    for e in j["elements"]:
        if e["type"] == "way" and e.get("geometry") and e.get("nodes"):
            out.append((e["nodes"], [(p["lat"], p["lon"]) for p in e["geometry"]], e.get("tags", {})))
    return out


def main():
    S, W, N, E = DESCARGA
    print("cache:", CACHE)

    # ---- hotel
    datos = coger_lugares()
    nodo = datos.get(("node", HOTEL_NODO))
    if nodo:
        LAT0, LON0 = nodo["lat"], nodo["lon"]
        origen = {"lat": LAT0, "lon": LON0, "fuente": "OSM node/%d (\"%s\", tourism=%s)" % (HOTEL_NODO, nodo["tags"].get("name"), nodo["tags"].get("tourism")),
                  "osm": "node/%d" % HOTEL_NODO, "pinWeb": {"lat": PIN_WEB[0], "lon": PIN_WEB[1]},
                  "distPinWebM": round(haversine(LAT0, LON0, *PIN_WEB))}
    else:
        LAT0, LON0 = PIN_WEB
        origen = {"lat": LAT0, "lon": LON0, "fuente": "pin del mapa de la web (no hay nodo OSM)", "osm": None}
    print("origen", origen)
    P = lambda lat, lon: proy(lat, lon, LAT0, LON0)

    # ---- lugares
    cor_fin, _ = desembocadura_coro()
    lugares = []
    for lid, nes, ngl, tipo, ref, extra in LUGARES:
        e = datos.get(ref)
        if e is None:
            print("!! no encontrado", ref); continue
        if extra.get("punto") == "desembocadura":
            lat, lon = cor_fin
        else:
            lat, lon = punto_de(e, extra.get("punto"))
        destino = (lat, lon)
        notas = [extra["nota"]] if "nota" in extra else []
        if "coche_a" in extra:
            ec = datos[extra["coche_a"]]
            destino = punto_de(ec)
            notas.append(extra["acceso"])
        lugares.append({"id": lid, "nombre": nes, "nombreGl": ngl, "nombreOsm": e["tags"].get("name"), "tipo": tipo,
                        "lat": round(lat, 6), "lon": round(lon, 6),
                        "osm": "%s/%d" % ref, "_destino": destino, "_notas": notas, "_extra": extra,
                        "_osm_tags": {k: e["tags"][k] for k in ("name", "natural", "historic", "archaeological_site", "tourism", "place", "aeroway", "ele") if k in e["tags"]}})
    # rutas
    ruta_urls = []
    for L in lugares:
        d = L["_destino"]
        km, seg, snaps, url = osrm("car", (LAT0, LON0), d)
        L["coche"] = {"km": round(km / 1000, 1), "min": minutos(seg)}
        L["_snapM"] = round(snaps[1])
        ruta_urls.append(url)
        if L["_snapM"] > 400:
            L["_notas"].append("el punto cae a %d m de la carretera mas cercana (OSRM)" % L["_snapM"])
        recta = haversine(LAT0, LON0, L["lat"], L["lon"])
        L["_recta_m"] = round(recta)
        if recta < 3000:
            try:
                kmp, segp, snp, urlp = osrm("foot", (LAT0, LON0), d)
                ruta_urls.append(urlp)
                if kmp < 3000:
                    L["pie"] = {"km": round(kmp / 1000, 1), "min": minutos(segp)}
            except Exception as ex:
                print("pie fallo", L["id"], ex)
        print("%-20s coche %5.1f km %3d min  pie %s  snap %d m  recta %d m" % (L["id"], L["coche"]["km"], L["coche"]["min"], L.get("pie"), L["_snapM"], recta))

    # ---- caja del mapa (metros): lugares salvo Santiago/SCQ + margen
    xs, ys = [], []
    for L in lugares:
        L["x"], L["y"] = (int(round(v)) for v in P(L["lat"], L["lon"]))
        if not L["_extra"].get("fuera_caja"):
            xs.append(L["x"]); ys.append(L["y"])
    MARGEN = 2500
    caja = {"x0": min(xs) - MARGEN, "y0": min(ys) - MARGEN, "x1": max(xs) + MARGEN, "y1": max(ys) + MARGEN}
    caja_clip = (caja["x0"] - 800, caja["y0"] - 800, caja["x1"] + 800, caja["y1"] + 800)
    print("caja", caja)

    # ---- costa
    jc = ovp_teselas("costa (natural=coastline) con geometria", 'way["natural"="coastline"]', DESCARGA, 3, 3)
    vias = [(n, g) for n, g, _ in tramos_osm(jc)]
    cadenas = une_dirigido(vias)
    print("costa: %d vias -> %d cadenas" % (len(vias), len(cadenas)))
    costa, n_pts_costa_bruto = [], 0
    EPS_COSTA = 30
    for cn, cp in cadenas:
        pts = [P(la, lo) for la, lo in cp]
        n_pts_costa_bruto += len(pts)
        cerrada = len(cn) > 3 and cn[0] == cn[-1]
        dentro = all(caja_clip[0] <= x <= caja_clip[2] and caja_clip[1] <= y <= caja_clip[3] for x, y in pts)
        if cerrada and dentro:
            tramos = [dp_linea(pts, EPS_COSTA)]
        else:
            tramos = [dp(t, EPS_COSTA) for t in recorta_linea(pts, caja_clip)]
        for t in tramos:
            t = redondea(t)
            if len(t) >= (4 if (cerrada and dentro) else 2):
                if cerrada and dentro and len(t) < 4:
                    continue
                costa.append(t)
    print("costa tras DP: %d tramos, %d puntos (bruto %d)" % (len(costa), sum(len(t) for t in costa), n_pts_costa_bruto))

    # ---- carreteras
    jr = ovp_teselas("carreteras principales: motorway|trunk|primary|secondary, con geometria", 'way["highway"~"^(motorway|trunk|primary|secondary)$"]', DESCARGA, 3, 3)
    q = ('[out:json][timeout:120];way["highway"="tertiary"](around:4000,%.6f,%.6f);out body geom;' % (LAT0, LON0))
    jt = ovp("carreteras terciarias en 4 km del hotel", q)
    grupos = {}
    for nodes, geom, tags in tramos_osm(jr) + tramos_osm(jt):
        nivel = tags.get("highway")
        ref = tags.get("ref") or ""
        clave = (nivel, ref or tags.get("name") or "")
        grupos.setdefault(clave, []).append((nodes, geom))
    carreteras = []
    EPS_RD = 35
    for (nivel, nombre), vs in grupos.items():
        for cn, cp in une_sin_sentido(vs):
            pts = [P(la, lo) for la, lo in cp]
            for t in recorta_linea(pts, caja_clip):
                t = redondea(dp(t, EPS_RD))
                if len(t) >= 2:
                    carreteras.append({"ref": nombre, "nivel": nivel, "p": plano(t), "_len": sum(math.hypot(t[i + 1][0] - t[i][0], t[i + 1][1] - t[i][1]) for i in range(len(t) - 1))})
    # quita fragmentos muy cortos (<250 m) salvo que sean principales
    carreteras = [c for c in carreteras if c["_len"] >= 250 or c["nivel"] in ("motorway", "trunk")]
    orden = {"motorway": 0, "trunk": 1, "primary": 2, "secondary": 3, "tertiary": 4}
    carreteras.sort(key=lambda c: (orden[c["nivel"]], c["ref"]))
    for c in carreteras:
        del c["_len"]
    print("carreteras: %d tramos" % len(carreteras), {n: sum(1 for c in carreteras if c["nivel"] == n) for n in orden})

    # ---- rios
    jw = ovp_teselas("rios (waterway=river) con geometria", 'way["waterway"="river"]', DESCARGA, 3, 3)
    gr = {}
    for nodes, geom, tags in tramos_osm(jw):
        gr.setdefault(tags.get("name") or "id%d" % nodes[0], []).append((nodes, geom))
    rios, rios_meta = [], []
    for nombre, vs in gr.items():
        for cn, cp in une_sin_sentido(vs):
            pts = [P(la, lo) for la, lo in cp]
            for t in recorta_linea(pts, caja_clip):
                largo = sum(math.hypot(t[i + 1][0] - t[i][0], t[i + 1][1] - t[i][1]) for i in range(len(t) - 1))
                if largo < 1500:
                    continue
                t = redondea(dp(t, 30))
                if len(t) >= 2:
                    rios.append(t); rios_meta.append({"nombre": nombre, "m": round(largo)})
    print("rios: %d tramos" % len(rios), rios_meta)

    # ---- salida
    for L in lugares:
        L["x"], L["y"] = (int(round(v)) for v in P(L["lat"], L["lon"]))
    publicos = []
    for L in lugares:
        d = {k: v for k, v in L.items() if not k.startswith("_")}
        if L["_notas"]:
            d["nota"] = "; ".join(L["_notas"])
        d["recta_m"] = L["_recta_m"]
        publicos.append(d)

    dudas = construir_dudas(origen, lugares)
    cost_flat = [plano(t) for t in costa]
    ox, oy = 0, 0
    barbanza = {
        "origen": {"lat": origen["lat"], "lon": origen["lon"], "fuente": origen["fuente"]},
        "caja": caja,
        "costa": cost_flat,
        "carreteras": carreteras,
        "rios": [plano(t) for t in rios],
        "lugares": publicos,
        "fuente": "© OpenStreetMap (ODbL)",
        "fecha": FECHA,
    }
    js = ("/* Mapa ilustrado del Barbanza. Metros desde el hotel (x este, y sur). "
          "Costa en sentido OSM: tierra a la izquierda. Generado por scripts/mapa.py. © OpenStreetMap (ODbL) */\n"
          "window.BARBANZA=" + json.dumps(barbanza, ensure_ascii=False, separators=(",", ":")) + ";\n")
    os.makedirs(os.path.join(RAIZ, "js"), exist_ok=True)
    os.makedirs(os.path.join(RAIZ, "datos"), exist_ok=True)
    with open(os.path.join(RAIZ, "js", "barbanza.js"), "w", encoding="utf-8") as f:
        f.write(js)
    legible = dict(barbanza)
    legible["origen"] = origen
    legible["proyeccion"] = "equirectangular: x=(lon-LON0)*111320*cos(LAT0), y=-(lat-LAT0)*111320; metros desde el origen"
    legible["simplificacion"] = {"costa_eps_m": EPS_COSTA, "carreteras_eps_m": EPS_RD, "rios_eps_m": 30}
    legible["rios_meta"] = rios_meta
    legible["consultas"] = consultas
    legible["rutas_osrm"] = ruta_urls
    legible["dudas"] = dudas
    legible["costa_sentido"] = "las lineas siguen el sentido de OSM: tierra a la izquierda, mar a la derecha"
    with open(os.path.join(RAIZ, "datos", "barbanza.json"), "w", encoding="utf-8") as f:
        json.dump(legible, f, ensure_ascii=False, indent=1)
    kb = os.path.getsize(os.path.join(RAIZ, "js", "barbanza.js")) / 1024
    print("barbanza.js %.1f KB; costa %d, carreteras %d, rios %d" % (kb, len(costa), len(carreteras), len(rios)))


def construir_dudas(origen, lugares):
    d = []
    if origen.get("distPinWebM"):
        d.append("Origen: el nodo OSM del hotel (node/%d, tourism=chalet, web ruralneixon.com) esta a %d m del pin del mapa de su web (42.66720, -8.84677). Se usa el nodo OSM; el pin cae ~220 m al oeste. No hay ningun elemento con addr:housenumber=58 ni con calle Neixon en OSM." % (HOTEL_NODO, origen["distPinWebM"]))
    d += [
        "Castro de Neixon: en OSM es el area way/1537692895 \"Castros de Neixon\" (plural; ademas hay un panel informativo node/14006378568 a 90 m). Se usa el centro del area.",
        "Carragueiros: en OSM el nombre es \"Praia de Carregueiros\" (alt_name \"Praia de Carragueiros\"), way/108818579, en Castro (O Cabo da Cruz, Boiro). Solo hay una playa; el node/8139600650 es un panel informativo en el paseo maritimo.",
        "Barrana y Manons: una sola playa de cada nombre, ambas en Boiro. El punto es el vertice del contorno mas cercano al centro del poligono, para que no caiga en el agua.",
        "Centro Arqueoloxico do Barbanza: way/1245603802 (tourism=museum), a ~110 m del hotel, en Neixon (Cespon, Boiro).",
        "Mamoas: no existe en OSM una ruta ni un area llamada \"Ruta das Mamoas\". Hay ~14 mamoas sueltas (archaeological_site=tumulus) en la sierra al norte/oeste de Boiro (Cures, A Graña, A Casota do Paramo, Raña, Montemuino). Se usa Mamoa da Cavada (node/12053020843, Boiro) como representante; el tiempo en coche (43 min para 16 km, ~22 km/h de media) apunta a carreteras de montaña o pistas; conviene revisarlo antes de publicarlo.",
        "Monte Iroite: dos nodos peak, node/7040973284 (687 m, con wikidata) y node/13799514300 (684 m, 90 m al norte). Se usa el primero. OSM los sitúa en Porto do Son/Lousame (Serra do Barbanza), no en el concello de Boiro.",
        "Estuario del Coroño: no es un punto en OSM; es el rio (relacion 20723195). Punto = ultimo nodo del rio segun el sentido del agua (desembocadura).",
        "Santa Baia: way/141772168, iglesia en el casco de Boiro.",
        "Illa de Cortegada: es una isla del Parque Nacional das Illas Atlanticas (concello de Vilagarcia, Pontevedra), sin carretera. Los km/min en coche son hasta el puerto de O Carril (way/235475679, leisure=marina); en OSM no hay un embarcadero propio. No es aconsejable decir 'a X minutos en coche' sin aclararlo.",
        "Torres do Oeste: en OSM figuran como \"Torres de Oeste\" (way/948857474 archaeological_site; tambien relation/17708935 castle). Estan en Catoira (Pontevedra).",
        "Dunas de Corrubedo: se usa way/80672768 (natural=sand, access=no); el poligono del parque (way/290520341) tiene el centro unos 1,5 km al sureste, sobre las lagunas. La carretera queda a ~800 m del punto.",
        "Castro de Baroña: Porto do Son, no Boiro (es excursion, como indicaba la lista); la carretera queda a ~530 m.",
        "Santiago de Compostela y aeropuerto SCQ quedan fuera de la caja del mapa; llevan x,y proyectados igualmente (para flechas de 'como llegar').",
        "Costa: las lineas siguen el sentido de OSM (tierra a la izquierda, mar a la derecha) y estan recortadas al borde de la caja ampliada 800 m; los anillos cerrados (islas) estan completos.",
    ]
    return d


if __name__ == "__main__":
    main()
