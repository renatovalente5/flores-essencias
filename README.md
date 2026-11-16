# Flores & Essências — o site

Loja da **Flores & Essências**: flores, arranjos, velas, wax melts e lembranças em cera perfumada com
óleos essenciais, feitos à mão pelo **Martim** (um jovem com autismo) com a mãe, Tatiana, e peças em
impressão 3D. As vendas revertem para as terapias do Martim. Instagram @essenciasflores1.

**Não há pagamentos no site.** A encomenda faz-se no site (as peças, as escolhas de cada uma — o nome,
as cores, o aroma —, as quantidades, a entrega em mão ou pelos CTT) e segue pelo WhatsApp
(«Encomendar pelo WhatsApp»), com a mensagem já escrita. A encomenda fica feita quando os donos a
confirmam por lá.

- **Fase 1 (16 nov 2026), feita:** a base técnica, o conteúdo e todas as páginas, com HTML semântico.
- **Fase 2 (16 nov 2026), feita:** a cara da proposta B, «Destaques» (a que o dono escolheu), em todas
  as páginas, com o movimento dela; as fotografias sem nada escrito por cima e os textos alternativos
  escritos à mão. As decisões e o que ficou por decidir estão em [docs/PLANO.md](docs/PLANO.md).
- **Ainda não está publicado em lado nenhum:** não há domínio nem repositório remoto. A
  pré-visualização é local.

## Correr

```bash
python3 scripts/imagens.py        # as versões web das fotografias e das capas dos vídeos (Pillow), em .cache/imagens
node scripts/build.mjs            # o site em _site/ (python3 -m http.server 4880 --directory _site)
node scripts/build.mjs --producao # como no domínio: PÁRA se faltar um dado que a lei pede (hoje pára: é o esperado)
node scripts/testar.mjs           # os testes do gerador e da encomenda (sem browser)
node scripts/provar.mjs           # a prova no browser (Chromium e WebKit), com um servidor temporário
node scripts/capturas.mjs         # as capturas para o dono (computador e telemóvel) em docs/capturas/ (fora do git)
```

O `build.mjs` corre o `imagens.py` sozinho (`--sem-imagens` salta-o). O `provar.mjs` e o `capturas.mjs`
usam o Playwright que já está no Mac (`PLAYWRIGHT=<pasta>` para outro), sobre o `_site/` construído, e
param o servidor no fim. A prova: a encomenda de ponta a ponta até ao wa.me, as categorias da loja a
trocar sem a página andar, nenhum transbordo a 320, 360, 375, 390 e 414 px (todas as páginas, a
encomenda com peças, o menu e a procura abertos), os alvos de toque com 44 px, nenhuma letra abaixo de
12 px, os campos a 16 px e o entrar ao descer.

## Onde está cada coisa

| | |
|---|---|
| `content/site.json` | a marca, os contactos, os dados legais, o aviso do topo, a entrega (em mão e CTT), os portes, o prazo, o pagamento |
| `content/categorias.json` | as 6 categorias (os destaques do Instagram): o nome, o título no Google, a frase, o ícone e a ordem |
| `content/produtos/*.json` | um ficheiro por artigo (o nome do ficheiro é o endereço `/produtos/<nome>/`) |
| `content/inicio.json` | a página inicial: a capa, as categorias, o destaque da época, as novidades, a história, os bastidores, «Como encomendar» |
| `content/paginas/*.md` | a história, «Como encomendar» e as legais, com marcadores `{{…}}` (vêm de `site.json`) |
| `content/fotos.json`, `content/videos.json` | o texto alternativo (e o ponto de foco) de cada fotografia; a legenda de cada vídeo |
| `media/fotos/`, `media/videos/`, `media/icones/`, `media/marca/` | as fotografias, os vídeos sem som (com a capa), os ícones das categorias e as peças do logótipo (só recortadas) |
| `src/lib/regras.mjs` | as regras dos dados: as mesmas no gerador e (há de ser) no painel, cópia byte a byte |
| `src/templates/`, `src/estilos/site.css`, `src/scripts/` | os modelos das páginas, o CSS e o JavaScript do browser |
| `legal-comum/` | as peças legais comuns aos sites do Renato (instalada pelo `_ferramentas/legal-comum`) |
| `scripts/importar.py` | a importação inicial, do material do cliente para `content/` e `media/` (já corrida; não se volta a correr) |
| `worker/www.js`, `wrangler.jsonc` | o Worker da Cloudflare, para quando houver domínio |

O material do cliente (o Instagram, as conversas, os originais) está em `_cliente/`, fora do git. As
propostas da página inicial estão em `propostas/` (a escolhida é a B).

## A encomenda

- O saco do cabeçalho leva a **/encomenda/**: as peças com as escolhas, a quantidade, a entrega (em mão,
  ou pelos CTT com a morada), o nome, e «Encomendar pelo WhatsApp» (`src/scripts/carrinho.js`).
- O cartão de um artigo não compra: compra-se só na ficha («Juntar à encomenda»).
- No browser fica só a encomenda (`flores-essencias:encomenda`): as peças, as escolhas, as quantidades e
  a entrega — nunca o nome nem a morada. O site não usa cookies.

## Os ganchos estáveis (para os testes e para o painel)

As classes podem mudar com o desenho; estes atributos não.

| Onde | Atributos |
|---|---|
| O cartão de um artigo (`li.produto`, nas grelhas e nas filas) | `data-produto="<slug>"` e `data-categoria="<slug>"`; `data-nome` no título; `data-preco` no preço |
| A ficha (`section.ficha`) | `data-ficha="<slug>"` e `data-categoria="<slug>"`; `data-nome` no `h1`; `data-preco` no preço |
| `data-preco` | o preço de hoje com ponto e duas casas (`14.00`; numa promoção, o promocional), ou `por-confirmar`; mais `data-desde` quando é «desde» |
| Os círculos das categorias (`a.categoria`) | `data-categoria="<slug>"` |
| As linhas da encomenda (`li.linha`, escritas pelo `carrinho.js`) | `data-produto="<slug>"` |
| O que entra ao descer | `data-revelar` (o `interface.js` põe e tira a classe `revelar`; sem JavaScript, nada fica escondido) |
