"""As peças do logótipo com o traço mais grosso (o Renato, 16 nov 2026: «Ficou muito fino, tens de engrossar o
fio da letra»; e «o Logo na navbar também precisa de uma linha mais grossa como no rodapé»). Não redesenha:
parte de media/marca/logo-horizontal.png e alarga o traço pelo próprio desenho (o máximo da vizinhança na
opacidade, a 2×); a mancha creme atrás da chama não engrossa.
  logo-horizontal-cabecalho.png  o traço na cor dele (azul-petróleo), para o cabeçalho e o menu
  logo-horizontal-branco.png     o traço em branco e a mancha a 30 %, para o rodapé terracota
python3 scripts/logo-grosso.py"""
import os, sys
sys.path.append(os.path.expanduser('~/Library/Python/3.9/lib/python/site-packages'))
from PIL import Image, ImageFilter
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MARCA = os.path.join(RAIZ, 'media', 'marca')
im = Image.open(os.path.join(MARCA, 'logo-horizontal.png')).convert('RGBA')
px = im.load()
CREME, TRACO = (0xFB, 0xEF, 0xDE), (0x17, 0x48, 0x55)
d = lambda a, b: sum((x - y) ** 2 for x, y in zip(a, b))
traco = Image.new('L', im.size, 0); pt = traco.load()
mancha = Image.new('L', im.size, 0); pm = mancha.load()
cor_traco = None
for y in range(im.height):
    for x in range(im.width):
        r, g, b, a = px[x, y]
        if not a:
            continue
        if d((r, g, b), CREME) < d((r, g, b), TRACO):
            pm[x, y] = a
        else:
            pt[x, y] = a
            if a == 255 and cor_traco is None: cor_traco = (r, g, b)
GROSSO = 7   # lado da vizinhança, em px a 2×: ≈ +1,5 px de cada lado no ficheiro original
W2 = (im.width * 2, im.height * 2)
grosso = traco.resize(W2, Image.LANCZOS).filter(ImageFilter.MaxFilter(GROSSO)).resize(im.size, Image.LANCZOS)

def peca(cor_t, cor_m, opac_m, nome):
    camada_m = Image.new('RGBA', im.size, cor_m + (0,)); camada_m.putalpha(mancha.point(lambda v: round(v * opac_m)))
    camada_t = Image.new('RGBA', im.size, cor_t + (0,)); camada_t.putalpha(grosso)
    out = Image.alpha_composite(camada_m, camada_t)
    out.save(os.path.join(MARCA, nome)); print(nome, out.size)

peca(cor_traco or TRACO, CREME, 1.0, 'logo-horizontal-cabecalho.png')
peca((255, 255, 255), (255, 255, 255), 0.3, 'logo-horizontal-branco.png')
