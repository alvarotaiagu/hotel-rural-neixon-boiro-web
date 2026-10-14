# -*- coding: utf-8 -*-
"""Cliente Overpass con espejos, reintentos y cache en disco. UA generico."""
import hashlib, json, os, sys, time, urllib.request, urllib.parse

UA = "neixon-web-mapa/1.0"
ESPEJOS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://overpass.osm.ch/api/interpreter",
]
CACHE = os.environ.get("NEIXON_CACHE") or os.path.join(os.path.dirname(os.path.abspath(__file__)), ".cache")


def overpass(q, intentos=40, usar_cache=True):
    os.makedirs(CACHE, exist_ok=True)
    h = hashlib.sha1(q.encode("utf-8")).hexdigest()[:16]
    f = os.path.join(CACHE, "ovp_" + h + ".json")
    if usar_cache and os.path.exists(f):
        with open(f, encoding="utf-8") as fh:
            return json.load(fh)
    data = urllib.parse.urlencode({"data": q}).encode("utf-8")
    ult = None
    for i in range(intentos):
        # el principal es el unico que responde casi siempre; los demas, de vez en cuando
        url = ESPEJOS[[0, 0, 1, 0, 0, 2, 0, 0, 3][i % 9]]
        try:
            req = urllib.request.Request(url, data=data, headers={"User-Agent": UA, "Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=100) as r:
                txt = r.read().decode("utf-8")
            j = json.loads(txt)
            if "elements" not in j:
                raise ValueError("sin elements")
            # algun espejo devuelve un timestamp corrupto ("117725") y vacio: se descarta
            if "-" not in str(j.get("osm3s", {}).get("timestamp_osm_base", "")):
                raise ValueError("espejo con datos corruptos (timestamp %s)" % j.get("osm3s", {}).get("timestamp_osm_base"))
            if j.get("remark"):
                raise ValueError("remark: " + j["remark"][:100])
            with open(f, "w", encoding="utf-8") as fh:
                json.dump(j, fh)
            return j
        except Exception as e:
            ult = e
            print("  overpass fallo %s: %s" % (url.split("/")[2], str(e)[:90]), file=sys.stderr)
            time.sleep(min(30, 4 + 2 * i))
    raise RuntimeError("Overpass agotado: %s" % ult)


def http_json(url, intentos=4, pausa=1.1):
    ult = None
    for i in range(intentos):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=60) as r:
                j = json.loads(r.read().decode("utf-8"))
            time.sleep(pausa)
            return j
        except Exception as e:
            ult = e
            time.sleep(2 + 2 * i)
    raise RuntimeError("HTTP agotado %s: %s" % (url, ult))
