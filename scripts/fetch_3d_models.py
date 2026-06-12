"""
Скачивает CC0 3D-модели мебели (Poly Haven, лицензия CC0 — можно в коммерцию)
для 3D-спайка конструктора: glTF 1k + текстуры, с сохранением относительных путей.
Запуск: PYTHONUTF8=1 python scripts/fetch_3d_models.py
"""
import json, os, urllib.request

OUT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "app", "assets", "3d"))
UA = {"User-Agent": "Mozilla/5.0 Chrome/124.0 Safari/537.36"}

MODELS = [
    "sofa_03",                 # современный диван
    "modern_arm_chair_01",     # кресло
    "modern_coffee_table_01",  # журнальный стол
    "round_wooden_table_01",   # обеденный стол
    "dining_chair_02",         # обеденный стул (вокруг стола!)
    "modern_wooden_cabinet",   # комод/шкаф
    "side_table_tall_01",      # тумба
]
FLOOR_TEX = "wood_floor_deck"  # паркет

def get(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60).read()

def dl(url, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if os.path.exists(path):
        return
    open(path, "wb").write(get(url))

for mid in MODELS:
    try:
        files = json.loads(get(f"https://api.polyhaven.com/files/{mid}"))
        g = files["gltf"]["1k"]["gltf"]
        base = os.path.join(OUT, mid)
        dl(g["url"], os.path.join(base, f"{mid}.gltf"))
        total = 0
        for rel, info in g.get("include", {}).items():
            dl(info["url"], os.path.join(base, rel.replace("/", os.sep)))
            total += info.get("size", 0)
        print(f"[OK] {mid}: gltf + {len(g.get('include',{}))} files (~{total//1024} KB)")
    except Exception as e:
        print(f"[FAIL] {mid}: {e}")

# паркет: diffuse + roughness 2k jpg
try:
    tex = json.loads(get(f"https://api.polyhaven.com/files/{FLOOR_TEX}"))
    for kind, name in (("Diffuse", "floor_diff.jpg"), ("Rough", "floor_rough.jpg")):
        node = tex.get(kind, {}).get("2k", {}).get("jpg", {})
        if node.get("url"):
            dl(node["url"], os.path.join(OUT, "textures", name))
            print(f"[OK] {FLOOR_TEX} {kind} 2k")
except Exception as e:
    print(f"[FAIL] floor texture: {e}")
print("DONE ->", OUT)
