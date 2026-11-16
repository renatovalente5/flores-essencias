#!/usr/bin/env python3
"""A IMPORTAÇÃO INICIAL (16 nov 2026): do material do cliente (_cliente/, fora do git) para content/ e media/.

Corre-se uma vez, à mão; depois o conteúdo muda no painel (ou à mão em content/), e este script já não
se corre — reescrevia o que a dona tivesse mudado. Fica no repositório para se saber de onde veio cada
coisa e como se recortou.

    python3 scripts/importar.py            # escreve content/produtos/, content/fotos.json, content/videos.json e media/
    python3 scripts/importar.py --sem-videos
    python3 scripts/importar.py --so-fotos   # só as fotografias com corte ou retoque (não toca no content/)

Lê:
  _cliente/catalogo/produtos.json      os 163 produtos (nome, categoria, preço, descrição, personalizável, ocasiões…)
  _cliente/catalogo/analise.json       a data de cada publicação (a ordem e as novidades)
  _cliente/instagram/media/            as fotografias e os vídeos das publicações
  _cliente/icones/                     os ícones das categorias e das secções (as capas dos destaques)
  propostas/comum/marca/               as peças do logótipo (só recortadas: nunca redesenhadas)
  propostas/comum/videos/              os quatro vídeos dos bastidores da página inicial, já sem som

O que se recorta (as notas do catálogo): o preço escrito por cima das fotografias antigas. Onde o preço
está no meio da peça, a fotografia fica de fora (OMITIR). Os vídeos ficam sem som, com 720 px de largura
no máximo e 20 s no máximo, com a capa (o fotograma de 0,5 s).
"""
import json
import os
import shutil
import subprocess
import sys

from PIL import Image, ImageOps

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
CLIENTE = os.path.join(RAIZ, '_cliente')
MEDIA_IG = os.path.join(CLIENTE, 'instagram', 'media')
PROPOSTAS = os.path.join(RAIZ, 'propostas', 'comum')
FOTOS = os.path.join(RAIZ, 'media', 'fotos')
VIDEOS = os.path.join(RAIZ, 'media', 'videos')
ICONES = os.path.join(RAIZ, 'media', 'icones')
MARCA = os.path.join(RAIZ, 'media', 'marca')
PRODUTOS = os.path.join(RAIZ, 'content', 'produtos')
LADO_MAXIMO = 1600   # o lado maior das fotografias guardadas (as versões web vão até 1600 de largura)

# --- os recortes: (x0, y0, x1, y1) em fracções da fotografia, vistos um a um numa folha com grelha ---
CORTES = {
    'DYEnb8JDD6L_01': (0, 0, .74, 1),        # «11€» no canto de cima, à direita
    'DW_cRfmDOvr_01': (0, .24, 1, 1),        # «Lembranças 1.5€» em cima
    'DXnw2pdDGo6_01': (0, .18, 1, 1),        # «Lembranças 1.5, cor à escolha» em cima
    'Dbs7GX3sOyn_01': (0, .31, 1, 1),        # «Valor 24€»
    'DboSpaxMxiI_01': (0, .22, 1, 1),        # «Valor 45€»
    'DX1RicRjLwB_01': (0, .28, 1, 1),        # «Um miminho 6€»
    'DXnxGNtjEEO_01': (0, .15, 1, 1),        # «12,5»
    'DXnw7WOjB7I_01': (0, .33, 1, 1),        # «15€» entre as asas do saco
    'DXkfmBuDKAh_01': (0, .18, 1, 1),        # «Decoração quarto ou centro de mesa 15»
    'DXc2vbdDLIq_01': (0, .19, 1, 1),        # «15€»
    'DW_cA7xjF0O_01': (0, 0, .765, 1),       # «10€» à direita
    'DfSlrzlMnZV_01': (0, 0, 1, .755),       # «Valor da peça: 15,90€»
    # (fase 2, 16 nov 2026) os cortes medidos na caixa preta do preço (a 1.ª passagem deixava a ponta dela)
    'DYC76LgDAcl_01': (0, 0, 1, .71),        # «10€» em baixo
    'DXnxdErjJBv_01': (0, 0, 1, .845),        # «12,5€»
    'DXnxKdtjD2R_01': (0, 0, 1, .81),        # «15€»
    'DXl706aDN4L_01': (0, 0, 1, .805),        # «12,50»
    'DXcHo7TDGMs_01': (0, 0, 1, .795),        # «12.50»
    'DXXc2nyDDjg_01': (0, 0, 1, .795),        # «15€»
    'DXXcw16jPTJ_01': (0, 0, 1, .785),        # «15€»
    'DXXcr1bDOD1_01': (0, 0, 1, .86),        # «15€»
    'DXAq2XaDKfa_01': (0, .15, 1, 1),        # «15€»
    'DW_bjTNDPqI_01': (0, 0, 1, .655),        # «10€» sobre a caixa
    # (fase 2) o logótipo por cima da fotografia e as legendas «Opção»: nada escrito por cima nos cartões
    'DeECuwUMPUO_01': (0, .22, 1, 1),        # o logótipo no canto de cima
    'Ddw_rzGM_FV_01': (0, .25, 1, 1),        # o logótipo no canto de cima
    'DeKbEnojCHi_02': (0, 0, 1, .82),        # «Opção 2» em baixo
    # uma linha preta de 2 px em cima do original
    'DcQvrVfMrLt_01': (0, .004, 1, 1),
    'Db6dIP2MySA_01': (0, .004, 1, 1),
    # a história
    'DfwhP6kMx40_01': (0, 0, 1, .62),        # o texto do vídeo em baixo
    'DZo5bDAMEFp_01': (0, .14, .70, 1),      # o texto em cima, o quadro com os apresentadores e a pessoa à direita
}
# O texto por cima de um fundo desfocado, onde um corte levaria a peça: apaga-se só o texto (o inpaint do
# OpenCV preenche os píxeis claros das letras com o fundo à volta). (x0, y0, x1, y1) em fracções.
RETOQUES = {
    'DeKbEnojCHi_01': [(.05, .095, .38, .195)],   # «Opção 1» em cima, sobre as luzes de Natal desfocadas
}
# o preço está no meio da peça (ou há outra fotografia limpa): a fotografia fica de fora
OMITIR = {'DW_b1GdjGnA_01', 'DXnxV2vjJh6_01', 'DXfFNd9CCjU_01'}
# vídeos de produtos com o preço, contactos antigos ou um pedido de um cliente escritos por cima
VIDEOS_FORA = {'DbdLegPsE0I_01', 'DcTjKxWMSwF_01', 'DceisrXMnIh_01', 'De6uitZMmsu_01', 'DfSlrzlMnZV_01', 'DerljAlMFwQ_01', 'DfA1B8QMpS6_01'}

# o preço «desde» e a nota curta junto do preço (das notas do catálogo, em texto para o cliente)
PRECOS = {
    'imagem-religiosa-aro-flores-terco': (True, '16 € a 18 €, conforme a imagem'),
    'nossa-senhora-arranjo-floral-grande': (True, '40 € a 55 €, conforme o modelo'),
    'calendario-advento-12-24-dias': (True, '12 dias: 8,99 €; 24 dias: 13,99 €'),
    'lembrancas-perfumadas-eventos': (True, '1,50 € a 2 € cada'),
    'saquinho-organza-8-pecas': (False, 'o saquinho com 8 peças'),
}
CADA = {'vela-gnomo-natal', 'wax-melt-vela-rosa-borboleta', 'vela-vasinho-laco', 'wax-melts-natal', 'wax-melts-boneco-neve',
        'pote-vidro-vela-laco', 'vela-natal-frasco-laco', 'placa-decorativa-corujas-flores', 'arranjo-natal-amarelo-ou-azul',
        'centro-natal-vela-prateado-dourado', 'mini-cupcakes-flores-rosa-nude', 'enfeite-natal-nome-3d'}
ALT_EXTRA = {
    'DeKbEnojCHi_01': 'Sagrada Família com rosas em cera, opção 1: rosas bordeaux e cor de pêssego, entre luzes de Natal',
    'DeKbEnojCHi_02': 'Sagrada Família com rosas em cera, opção 2: rosas cor de pêssego e brancas, entre luzes de Natal',
}

# --- a história e os bastidores ---
FOTOS_HISTORIA = {
    'historia-martim-mae-banca': ('Dbi-EgijGOM_01', 'O Martim e a mãe, Tatiana, atrás da banca da Flores & Essências, com as peças à frente', '50% 40%'),
    'historia-martim-sorriso': ('DfwhP6kMx40_01', 'O Martim a sorrir', '35% 45%'),
    'historia-familia-televisao': ('DZo5bDAMEFp_01', 'O Martim, a mãe e a irmã no dia em que foram ao «Dois às 10»', None),
    'historia-familia-banca': ('DcCPhbQstLM_01', 'A família na banca da Flores & Essências, à noite, com as peças iluminadas', None),
}
# (id, origem, legenda). As quatro primeiras vêm já preparadas das propostas (propostas/comum/videos).
VIDEOS_BASTIDORES = [
    ('bastidores-atelier', 'propostas:bastidores-atelier', 'No atelier, ao fim do dia'),
    ('bastidores-ctt', 'propostas:bastidores-ctt', 'A enviar as encomendas'),
    ('bastidores-mae', 'propostas:bastidores-mae', 'Centros de mesa com a mãe'),
    ('bastidores-encomendas', 'propostas:bastidores-encomendas', 'Encomendas prontas a seguir'),
    ('bastidores-dragao', 'DfSk_H-smAd_01', 'A montar o dragão articulado'),
    ('bastidores-embalar', 'DfqJtxas1mu_01', 'Encomendas pela casa toda'),
    ('bastidores-natal', 'DdjhJZkMLIW_01', 'As primeiras peças de Natal, com a mãe'),
    ('bastidores-tecnicas', 'DdUvR4iMaBq_01', 'A experimentar técnicas novas'),
    ('bastidores-caixas', 'Dci6uwRMB1I_01', 'A embalar os artigos'),
    ('bastidores-logistica', 'Db34FR_MZ1t_01', 'O Martim também trata da logística'),
    ('bastidores-cupcake', 'DdU2N7gMQQj_01', 'Um cupcake de flores, com a mãe'),
    ('bastidores-concentracao', 'De4u8c7Mgxp_01', 'Concentrado no trabalho'),
    ('bastidores-fornecedor', 'DbnW75NM5Fq_01', 'A escolher materiais novos'),
    ('bastidores-material', 'DdFXp3KMJvX_01', 'O material das bancas'),
]
ICONES_ORIGEM = {'religioso': '01-religioso', 'prendas': '02-prendas', 'eventos': '03-eventos', 'bastidores': '04-bastidores',
                 'arranjos': '05-arranjos', 'clientes': '06-clientes', 'entregas': '07-entregas', 'historia': '08-historia',
                 'artigos-3d': '09-artigos-3d-desenhado', 'aniversario': '10-aniversario', 'contactos': '11-contatos'}
NOVIDADES_DESDE = '2026-11-09'   # «Feitos esta semana»: a semana antes da importação


def retocar(im, caixas):
    """Apaga o texto claro dentro das caixas (só os píxeis das letras, alargados), com o fundo à volta."""
    import cv2
    import numpy as np
    a = np.array(im)
    mascara = np.zeros(a.shape[:2], np.uint8)
    for x0, y0, x1, y1 in caixas:
        X0, Y0, X1, Y1 = round(x0 * im.width), round(y0 * im.height), round(x1 * im.width), round(y1 * im.height)
        caixa = a[Y0:Y1, X0:X1]
        claros = (caixa.min(axis=2) > 200).astype(np.uint8) * 255
        mascara[Y0:Y1, X0:X1] = cv2.dilate(claros, np.ones((9, 9), np.uint8))
    b = cv2.inpaint(cv2.cvtColor(a, cv2.COLOR_RGB2BGR), mascara, 9, cv2.INPAINT_TELEA)
    return Image.fromarray(cv2.cvtColor(b, cv2.COLOR_BGR2RGB))


def guardar_foto(origem, nome):
    """Abre, retoca (RETOQUES), recorta (CORTES), reduz o lado maior a LADO_MAXIMO e grava media/fotos/<nome>.jpg."""
    codigo = os.path.splitext(os.path.basename(origem))[0]
    im = ImageOps.exif_transpose(Image.open(origem)).convert('RGB')
    if codigo in RETOQUES:
        im = retocar(im, RETOQUES[codigo])
    if codigo in CORTES:
        x0, y0, x1, y1 = CORTES[codigo]
        im = im.crop((round(x0 * im.width), round(y0 * im.height), round(x1 * im.width), round(y1 * im.height)))
    im.thumbnail((LADO_MAXIMO, LADO_MAXIMO), Image.LANCZOS)
    im.save(os.path.join(FOTOS, f'{nome}.jpg'), quality=84, optimize=True, progressive=True)


def primeira_frase(t):
    t = ' '.join(str(t).split())
    i = t.find('. ')
    return (t[:i + 1] if 0 < i < 240 else t)[:300]


def video(origem, nome, sem_videos):
    """media/videos/<nome>.mp4 (sem som, ≤ 720 px, ≤ 20 s) e a capa <nome>.jpg."""
    destino = os.path.join(VIDEOS, f'{nome}.mp4')
    capa = os.path.join(VIDEOS, f'{nome}.jpg')
    if origem.startswith('propostas:'):
        base = os.path.join(PROPOSTAS, 'videos', origem.split(':', 1)[1])
        shutil.copyfile(base + '.mp4', destino)
        shutil.copyfile(base + '.jpg', capa)
        return
    if sem_videos and os.path.exists(destino) and os.path.exists(capa):
        return
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', os.path.join(MEDIA_IG, origem + '.mp4'), '-t', '20', '-an',
                    '-vf', "scale='min(720,iw)':-2", '-c:v', 'libx264', '-crf', '27', '-preset', 'slow',
                    '-pix_fmt', 'yuv420p', '-movflags', '+faststart', destino], check=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', '0.5', '-i', destino, '-frames:v', '1', '-q:v', '3', capa], check=True)


def so_fotos():
    """Refaz só as fotografias com corte ou retoque (com os mesmos nomes), sem tocar no content/: o
    conteúdo já é dos donos (e do painel)."""
    catalogo = json.load(open(os.path.join(CLIENTE, 'catalogo', 'produtos.json'), encoding='utf-8'))
    feitas = 0
    for p in catalogo:
        boas = [f for f in p['fotos'] if os.path.splitext(f)[0] not in OMITIR]
        for i, f in enumerate(boas):
            codigo = os.path.splitext(f)[0]
            if codigo in CORTES or codigo in RETOQUES:
                guardar_foto(os.path.join(MEDIA_IG, f), p['slug'] if i == 0 else f'{p["slug"]}-{i + 1}')
                feitas += 1
    for nome, (codigo, _, _) in FOTOS_HISTORIA.items():
        if codigo in CORTES or codigo in RETOQUES:
            guardar_foto(os.path.join(MEDIA_IG, codigo + '.jpg'), nome)
            feitas += 1
    print(f'fotografias refeitas: {feitas}')


def principal():
    if '--so-fotos' in sys.argv:
        so_fotos()
        return
    sem_videos = '--sem-videos' in sys.argv
    for d in (FOTOS, VIDEOS, ICONES, MARCA, PRODUTOS):
        os.makedirs(d, exist_ok=True)
    catalogo = json.load(open(os.path.join(CLIENTE, 'catalogo', 'produtos.json'), encoding='utf-8'))
    datas = {x['code']: x['data'] for x in json.load(open(os.path.join(CLIENTE, 'catalogo', 'analise.json'), encoding='utf-8'))}
    fotos_json, videos_json = {}, {}

    # a ordem: as peças com boa fotografia primeiro, as mais recentes à frente
    def chave(p):
        data = max((datas.get(c, '') for c in p['origem']), default='')
        return (0 if p['qualidadeFoto'] == 3 else 1, ''.join(chr(255 - ord(ch)) for ch in data), p['slug'])
    ordenados = sorted(catalogo, key=chave)

    for n, p in enumerate(ordenados):
        slug = p['slug']
        data = max((datas.get(c, '') for c in p['origem']), default='')
        fotos = []
        boas = [f for f in p['fotos'] if os.path.splitext(f)[0] not in OMITIR]
        for i, f in enumerate(boas):
            nome = slug if i == 0 else f'{slug}-{i + 1}'
            guardar_foto(os.path.join(MEDIA_IG, f), nome)
            codigo = os.path.splitext(f)[0]
            if codigo in ALT_EXTRA:
                alt = ALT_EXTRA[codigo]
            elif i == 0:
                alt = primeira_frase(p['descricao'])
            else:
                alt = f'{p["nome"]} (fotografia {i + 1} de {len(boas)})'
            fotos_json[nome] = {'alt': alt}
            fotos.append(nome)
        v = p['video'] and os.path.splitext(p['video'])[0]
        nome_video = ''
        if v and v not in VIDEOS_FORA and fotos:
            nome_video = slug
            video(v, nome_video, sem_videos)
            videos_json[nome_video] = {'legenda': p['nome']}
        desde, nota = PRECOS.get(slug, (False, 'cada' if slug in CADA else ''))
        pers = set(p['personalizavel'])
        artigo = {
            'nome': p['nome'],
            'fotos': fotos,
            'descricao': ' '.join(p['descricao'].split()),
            'preco': p['preco'],
            'precoDesde': desde,
            'precoNota': nota,
            'personalizacao': {'nome': 'nome' in pers, 'cores': 'cores' in pers, 'aroma': 'aroma' in pers},
            'video': nome_video,
            'categoria': p['categoria'],
            'ocasioes': p['ocasioes'],
            'novidade': bool(fotos) and p['qualidadeFoto'] == 3 and data >= NOVIDADES_DESDE,
            'publicado': True,
            'ordem': (n + 1) * 10,
        }
        with open(os.path.join(PRODUTOS, f'{slug}.json'), 'w', encoding='utf-8') as fh:
            fh.write(json.dumps(artigo, ensure_ascii=False, indent=2) + '\n')

    for nome, (codigo, alt, foco) in FOTOS_HISTORIA.items():
        guardar_foto(os.path.join(MEDIA_IG, codigo + '.jpg'), nome)
        fotos_json[nome] = {'alt': alt, **({'foco': foco} if foco else {})}
    for nome, origem, legenda in VIDEOS_BASTIDORES:
        video(origem, nome, sem_videos)
        videos_json[nome] = {'legenda': legenda}
    for nome, f in ICONES_ORIGEM.items():
        shutil.copyfile(os.path.join(CLIENTE, 'icones', f + '.png'), os.path.join(ICONES, nome + '.png'))
    for f in ('logo.png', 'logo-horizontal.png', 'logo-simbolo.png', 'logo-nome.png'):
        shutil.copyfile(os.path.join(PROPOSTAS, 'marca', f), os.path.join(MARCA, f))

    with open(os.path.join(RAIZ, 'content', 'fotos.json'), 'w', encoding='utf-8') as fh:
        fh.write(json.dumps(dict(sorted(fotos_json.items())), ensure_ascii=False, indent=2) + '\n')
    with open(os.path.join(RAIZ, 'content', 'videos.json'), 'w', encoding='utf-8') as fh:
        fh.write(json.dumps(dict(sorted(videos_json.items())), ensure_ascii=False, indent=2) + '\n')
    print(f'importados: {len(catalogo)} produtos, {len(fotos_json)} fotografias, {len(videos_json)} vídeos, {len(ICONES_ORIGEM)} ícones')


if __name__ == '__main__':
    principal()
