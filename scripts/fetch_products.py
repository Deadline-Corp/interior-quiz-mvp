"""
Каталог-пайплайн, этап B (POC): скачать фронтальные packshot'ы реальных
товаров тайских ритейлеров, вырезать фон через rembg, обрезать прозрачные
поля и сохранить PNG для elevation-вида приложения.

Запуск: python scripts/fetch_products.py
Требует: rembg, Pillow (уже установлены).
ВНИМАНИЕ: фото защищены копирайтом ритейлеров — только для прототипа/демо.
В прод — affiliate-фиды Involve Asia (лицензированные) или прямые договоры.
"""
import io, os, urllib.request
from rembg import remove
from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), "..", "app", "assets", "products")
OUT = os.path.abspath(OUT)
os.makedirs(OUT, exist_ok=True)

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"}

# (имя файла, ширина_см [известная], URL фронтального packshot)
PRODUCTS = [
    ("fridge-toshiba", 60,  "https://statice.homepro.co.th/homepro/ART_IMAGE/12/538/1253838/1000x1000/06022024_1253838$Imagec1.jpg"),
    ("sofa-koncept",   213, "https://statice.homepro.co.th/homepro/ART_IMAGE/11/534/1153426/1000x1000/08052026_1153426$Imagec1.jpg"),
    ("sofa-lamona",    214, "https://media.indexlivingmall.com/media/catalog/product/1/2/120026359_f_Lamona_3s_DGY.jpg"),
    ("wardrobe-maxi",  180, "https://media.indexlivingmall.com/media/catalog/product/1/1/110042942_f_Maxi_4D_TP.jpg"),
    ("bed-rotterdam",  165, "https://media.indexlivingmall.com/media/catalog/product/1/2/120025532_f_Rotterbam_LO_WT.jpg"),
]

def fetch(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=40) as r:
        return r.read()

rows = []
for sku, w_cm, url in PRODUCTS:
    try:
        raw = fetch(url)
    except Exception as e:
        print(f"[FAIL] {sku}: download — {e}")
        continue
    cut = remove(raw)                     # bytes PNG с альфа-каналом
    img = Image.open(io.BytesIO(cut)).convert("RGBA")
    # обрезка по ПОРОГУ прозрачности (не >0): убирает полупрозрачные поля/тень-ореол
    # после rembg — иначе товар «висит» над полом из-за невидимых пикселей снизу
    mask = img.split()[3].point(lambda p: 255 if p > 45 else 0)
    bbox = mask.getbbox()
    if bbox:
        img = img.crop(bbox)
    img.save(os.path.join(OUT, f"{sku}.png"))
    aspect = img.height / img.width
    h_cm = round(w_cm * aspect)
    rows.append((sku, w_cm, h_cm, img.width, img.height))
    print(f"[OK] {sku}: {img.width}x{img.height}px  → каталог w={w_cm} h={h_cm} см (aspect {aspect:.2f})")

# контактный лист для визуальной проверки качества вырезания
if rows:
    CW, pad = 260, 20
    sheet = Image.new("RGBA", (CW*len(rows), CW+50), (247, 246, 243, 255))
    for i, (sku, w_cm, h_cm, pw, ph) in enumerate(rows):
        thumb = Image.open(os.path.join(OUT, f"{sku}.png"))
        k = min((CW-pad*2)/thumb.width, (CW-pad*2)/thumb.height)
        thumb = thumb.resize((int(thumb.width*k), int(thumb.height*k)))
        ox = i*CW + (CW-thumb.width)//2
        oy = (CW-thumb.height)//2
        sheet.paste(thumb, (ox, oy), thumb)
    sheet.save(os.path.join(OUT, "_contactsheet.png"))
    print(f"\nКонтактный лист: app/assets/products/_contactsheet.png")
    print("\nДанные для каталога app/index.html:")
    for sku, w_cm, h_cm, pw, ph in rows:
        print(f"  {sku}: w={w_cm}, h={h_cm}, img='{sku}.png'")
