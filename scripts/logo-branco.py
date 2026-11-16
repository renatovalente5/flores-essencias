"""O logótipo horizontal em branco, para o rodapé terracota (pedido do Renato, 16 nov 2026: «O Logo no Rodapé
devia de estar branco»). Não redesenha: cada pixel fica branco com a opacidade que já tinha; a mancha creme
atrás da chama fica um branco translúcido (a 30 %), senão a chama, também branca, desaparecia dentro dela.
python3 scripts/logo-branco.py   (lê media/marca/logo-horizontal.png e escreve media/marca/logo-horizontal-branco.png)"""
import os, sys
sys.path.append(os.path.expanduser('~/Library/Python/3.9/lib/python/site-packages'))
from PIL import Image
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ent = os.path.join(RAIZ, 'media', 'marca', 'logo-horizontal.png')
sai = os.path.join(RAIZ, 'media', 'marca', 'logo-horizontal-branco.png')
im = Image.open(ent).convert('RGBA')
px = im.load()
out = Image.new('RGBA', im.size); po = out.load()
CREME, TRACO = (0xFB, 0xEF, 0xDE), (0x17, 0x48, 0x55)
d = lambda a, b: sum((x - y) ** 2 for x, y in zip(a, b))
for y in range(im.height):
    for x in range(im.width):
        r, g, b, a = px[x, y]
        if not a:
            continue
        mancha = d((r, g, b), CREME) < d((r, g, b), TRACO)
        po[x, y] = (255, 255, 255, round(a * 0.3) if mancha else a)
out.save(sai)
print(sai, out.size)
