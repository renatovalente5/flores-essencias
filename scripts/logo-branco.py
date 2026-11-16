"""O logótipo horizontal em branco, para o rodapé terracota (pedido do Renato, 16 nov 2026: «O Logo no Rodapé
devia de estar branco»). Não redesenha: cada pixel fica branco com a opacidade que já tinha; a mancha creme
atrás da chama fica um branco translúcido (a 30 %), senão a chama, também branca, desaparecia dentro dela.
python3 scripts/logo-branco.py   (lê media/marca/logo-horizontal.png e escreve media/marca/logo-horizontal-branco.png)"""
import os, sys
sys.path.append(os.path.expanduser('~/Library/Python/3.9/lib/python/site-packages'))
from PIL import Image, ImageFilter
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
# «Ficou muito fino, tens de engrossar o fio da letra» (o Renato, 16 nov 2026): o traço (não a mancha) é
# alargado pelo próprio desenho — o máximo da vizinhança no canal de opacidade, a 2× para ficar suave.
GROSSO = 7   # lado da vizinhança, em px a 2×: ≈ +1,5 px de cada lado no ficheiro original
traco = Image.new('L', im.size, 0); pt = traco.load()
mancha = Image.new('L', im.size, 0); pm = mancha.load()
for y in range(im.height):
    for x in range(im.width):
        a = po[x, y][3] if po[x, y] else 0
        r, g, b, a0 = px[x, y]
        if not a0:
            continue
        if d((r, g, b), CREME) < d((r, g, b), TRACO): pm[x, y] = a
        else: pt[x, y] = a
W2 = (im.width * 2, im.height * 2)
traco = traco.resize(W2, Image.LANCZOS).filter(ImageFilter.MaxFilter(GROSSO)).resize(im.size, Image.LANCZOS)
alfa = Image.composite(traco, mancha, traco)  # onde há traço, o traço; senão, a mancha translúcida
out = Image.new('RGBA', im.size, (255, 255, 255, 0)); out.putalpha(Image.eval(alfa, lambda v: v))
out.save(sai)
print(sai, out.size)
