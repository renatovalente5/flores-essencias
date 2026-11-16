# Flores & Essências — plano e decisões

Escrito a 16 nov 2026, no fim da fase 1 (a base técnica), e posto em dia no fim da fase 2 (o aspeto).
Não sou advogado: o que está em «O que a lei pede» é a leitura dos diplomas citados.

## 1. Decisões

### Do Renato e do dono

- **Sem pagamentos no site.** A encomenda faz-se no site e segue pelo WhatsApp (351933007227), com a
  mensagem já escrita; a encomenda fica feita quando os donos a confirmam por lá.
- **O aspeto é o da proposta B, «Destaques»** (escolhida pelo dono a 16 nov 2026; `propostas/b/`), em
  todas as páginas (ver 4): a capa num cartão de cantos redondos (28 px) com o texto num painel creme por
  cima do canto de baixo, à esquerda (por baixo, no telemóvel); as categorias em círculos logo a seguir;
  o Natal numa fila com setas; «Feitos esta semana» em grelha; a história com as duas fotografias (a da
  banca e a do sorriso por cima); os bastidores em vídeos 9:16; «Como encomendar» em quatro cartões; e o
  rodapé na faixa terracota, com o logótipo numa placa clara. As cores são as da B (creme #F8F0E4, tinta
  #3B2A25, tinta suave #6B554B, terracota #A9512F, cartões #FFFAF3).
- **Letras: Young Serif nos títulos e Outfit no texto, servidas pelo próprio site** (nada do Google
  Fonts). A Outfit veio da cópia que já havia no Mac; a Young Serif é a do pacote
  `@fontsource/young-serif` 5.3.0 (OFL-1.1), que o Renato pôs em `src/fontes/` (ver o `LEIA.md`). O
  build escreve o `@font-face` das letras que lá estiverem.
- **Da Dream Art veio só o invisível**: o gerador, as regras dos dados, as imagens, os testes, os scripts
  da encomenda, da loja e da procura, o Worker e a `legal-comum`. Os modelos, o CSS e os textos são
  novos. O build pára se o nome, o dono ou a terra da Dream Art (ou a Mimices) aparecerem num ficheiro
  gerado.
- **As regras do Renato, aplicadas já:** um só cabeçalho; o cartão do artigo não compra (a mesma seta
  em todos); a ficha só com o essencial (a categoria, o nome, o preço, a descrição, as escolhas, o botão e
  duas linhas: a entrega e quem faz); as categorias da loja trocam sem a página sair do sítio; o rodapé
  curto, sem o nome, o NIF nem a morada (vão nos Contactos, nos Termos e na Privacidade); o WhatsApp só
  como ligação; o telefone com «(Chamada para a rede móvel nacional)»; o Livro de Reclamações discreto,
  só no rodapé; nada de «obrigação de pagar».
- **SEO:** as páginas legais com `noindex` e fora do sitemap (o robots.txt não as bloqueia); título e
  descrição únicos em cada página de destino (o build confere); JSON-LD WebSite e Store na página
  inicial, Product nas fichas e BreadcrumbList nas outras; a pré-visualização inteira com `noindex`; nada
  de `?parâmetros` nas ligações internas (o build pára).
- **Os textos tratam o cliente por «tu»**, como a marca no Instagram e as propostas («Escolhe as peças»),
  também nas páginas legais.
- **Sem política de cookies**: o site não usa cookies nem carrega nada de terceiros; o que fica no
  browser (a encomenda) está dito na política de privacidade.
- **As ofertas** («mimo grátis acima de 30 €», «portes grátis acima de 35 €») não entram enquanto os
  donos não as confirmarem. O modelo já aceita os portes grátis a partir de um valor
  (`entrega.portes.gratisAPartirDe`).

### Da fase 1 (minhas, a confirmar se for preciso)

- **A entrega:** duas formas, em mão e pelos CTT. Sem dizer onde fazem entregas em mão
  (`entrega.emMao`), no site a sério essa forma não se oferece (como o levantamento da Dream Art).
- **As escolhas de cada peça** (`personalizacao`): o nome (obrigatório quando a peça o leva), as cores e o
  aroma (opcionais: vazios, combinam-se pelo WhatsApp), conforme o `personalizavel` do catálogo. A
  quantidade muda-se na encomenda, não na ficha.
- **O preço «desde»** (`precoDesde`) e uma nota curta junto do preço (`precoNota`: «cada», «o saquinho com 8
  peças», «16 € a 18 €, conforme a imagem»). Na encomenda, uma peça «desde» faz o total «desde».
- **As ocasiões** (`ocasioes`: natal, outono, halloween, dia-da-mae…): a da época (`inicio.destaque`) tem
  página própria (`/natal/`) enquanto o destaque estiver ligado; desligado, a página e a secção saem.
- **«Feitos esta semana»:** os artigos marcados `novidade` (os publicados desde 9 nov), sem os que já
  estão na fila do Natal (a mesma peça duas vezes na página era informação repetida).
- **A ordem:** as peças com boa fotografia primeiro, as mais recentes à frente (`ordem`).
- **«[por confirmar]» escrito num dado vale o mesmo que vazio** nas regras: a produção pára na mesma.
- **O domínio ainda não existe**: `--dominio` e `--producao` param sem ele (`DOMINIO` em
  `scripts/build.mjs` e em `worker/www.js`).
- **Não há `publicar.yml`** (não há repositório remoto nem domínio): quando houver, vem o dos outros sites.

## 2. O conteúdo

- **163 produtos** importados do catálogo do Instagram (`scripts/importar.py`): 155 com fotografia
  aparecem na pré-visualização (Arranjos 99, Prendas 29, Religioso 17, Eventos 3, Aniversário 3, Artigos 3D
  4); **8 sem fotografia** ficam escondidos até a terem (wax melts de Natal, coração com asas, calendário
  de 12/24 dias, arranjo de Natal amarelo ou azul, abóbora de Halloween, arranjo compacto rosa — o
  ficheiro estava estragado —, arco-íris com nome — só havia imagem feita com IA — e porta-cartões).
- **31 dos publicados não têm preço**: na pré-visualização aparecem com «Preço por confirmar» (e vão na
  encomenda com «preço a confirmar»); em produção ficam de fora, e o build lista-os. Em produção ficariam
  124 artigos.
- **Fotografias:** 190 dos produtos e 4 da história, **nenhuma com texto ou preço por cima**. O preço das
  fotografias antigas foi cortado pela medida da caixa preta de cada uma; as legendas «Opção 1» e
  «Opção 2» (Sagrada Família) e o logótipo por cima de duas foram tirados; 3 ficaram de fora (o preço
  estava no meio da peça). O que ainda se lê nalgumas é da própria peça (a caixa «Merry Christmas», a
  placa «Bênção, paz, proteção», o nome no enfeite). O texto alternativo da primeira fotografia de cada
  artigo (as dos cartões) e das quatro da história está escrito à mão, a olhar para elas; as outras dizem
  «fotografia 2 de 3».
- **O dragão articulado (3D)** usa a fotografia DfSlrzlMnZV cortada por cima do texto que lá estava (as
  outras imagens dele também tinham texto): é a menos má. **O porta-cartões (3D)** não tem nenhuma limpa
  (a única tem o título e o preço por cima): está escondido até haver outra.
- **Vídeos** (sem som, 720 px e 20 s no máximo, com a capa): 18 de produtos e 14 dos bastidores. Ficaram
  de fora os vídeos de produtos com o preço, os contactos antigos ou um pedido de um cliente escritos por
  cima.
- **A história** com as palavras deles (a publicação afixada), e duas secções curtas: a televisão e o que
  cada encomenda faz. Quatro fotografias (só o Martim e a família) e os 12 vídeos dos bastidores.
- Fora do site: as personagens e as marcas de terceiros (o build esconde um artigo que as nomeie e pára
  uma página que as nomeie), os clientes e as outras crianças, a fotografia com a Cristina Ferreira (a
  frase do Martim ficou no texto), as mensagens dos clientes, os sorteios e os pontos de venda.

## 3. O que falta perguntar aos donos

O site mostra cada um destes com «[por confirmar: …]» na pré-visualização, e `--producao` pára pelos que a
lei pede.

| # | Falta | Onde se vê | Porquê |
|---|---|---|---|
| 1 | O nome (ou a firma) de quem vende, o NIF e a morada (rua, número, código postal, localidade) | Termos, privacidade, desistir, contactos, cada ficha | LEI: DL 7/2004, art. 10.º; o fabricante na ficha, Regulamento (UE) 2023/988, art. 19.º. Para a produção |
| 2 | O email | Contactos, termos, privacidade, ficha | LEI: DL 7/2004, art. 10.º (um contacto por escrito). Para a produção |
| 3 | O prazo de preparação e entrega | Encomenda, ficha, termos, como encomendar | LEI: DL 24/2014, art. 4.º, n.º 1, al. j). Para a produção |
| 4 | As formas de pagamento (um cartaz de abril dizia MB WAY ou numerário) | Encomenda, termos, a mensagem do WhatsApp | LEI: DL 24/2014, art. 4.º, n.º 1, al. j). Para a produção |
| 5 | Onde fazem entregas em mão, e como se combinam | Encomenda, ficha, termos | Sem isto, no site a sério só há CTT |
| 6 | Os portes dos CTT (ou como se calculam) | Encomenda, ficha, termos | LEI: o preço total com portes, ou o aviso de que podem variar (art. 4.º, n.º 1, als. e) e g)); hoje «a confirmar» |
| 7 | Se os preços incluem IVA ou se há isenção (art. 53.º do CIVA) | Termos | LEI quanto ao preço total |
| 8 | Os 33 preços em falta e as dúvidas de preço do catálogo (`_cliente/catalogo/resumo.md`) | As fichas | Sem preço, a peça fica fora do site a sério |
| 9 | Que número fica: 933 007 227 ou 960 414 282 | Todo o site (hoje 933 007 227) | — |
| 10 | As ofertas (mimo acima de 30 €, portes grátis acima de 35 €) | — | Só entram confirmadas |
| 11 | O Livro de Reclamações Eletrónico: já têm conta? | O rodapé liga ao livro | LEI: DL 156/2005, art. 5.º-B (a conta é deles) |
| 12 | Os avisos das velas e dos wax melts com óleos essenciais (as etiquetas) | As fichas (campos `avisos` e `perigos`) | LEI só se a fragrância classificar a peça (CLP, Reg. (CE) 1272/2008): o build lembra-o em 59 fichas |
| 13 | O dragão e o axolote articulados (3D): são para crianças? | As fichas | Se forem brinquedo, DL 43/2011 (marcação CE, avisos, idade) |
| 14 | Nomes nas fotografias: «Bruno» (enfeite de Natal), «Matilde» (arco com nuvem), «Margarida» e «Gonçalo» (vídeo do enfeite); o cartão com o número antigo (caixa redonda verde-água) | As fichas | RGPD, se forem nomes de clientes: autorização ou trocar a fotografia |
| 15 | O TikTok e o Facebook (as contas certas) | Os contactos e o rodapé | — |
| 16 | As fotografias que faltam (arco-íris com nome, arranjos de Natal amarelo e azul, porta-cartões, calendários, wax melts de Natal) | Os 8 escondidos | — |
| 17 | O domínio | — | Para publicar |

O cartaz «odisseias» aparece ao fundo do vídeo dos CTT (bastidores): é o balcão dos correios, não uma
peça; ficou, mas troca-se se o Renato preferir.

## 4. Fase 2 (feita a 16 nov 2026): a cara da B em todas as páginas

- **A página inicial é a `propostas/b`**, com o conteúdo do `content/`: os pontinhos coloridos com conta
  (quatro na capa, junto ao título no telemóvel e junto ao canto da fotografia no computador; e o ponto
  rosa da citação); os círculos das categorias com 88 px (o desenho com 80: o ícone tem 150 px e fica
  nítido num ecrã retina).
- **A loja e as categorias:** as pastilhas em cima e os artigos no creme da página, sem faixa nem moldura
  (a página do Natal igual, sem as pastilhas). As pastilhas continuam a trocar o painel sem a página andar.
- **A ficha:** duas colunas a partir dos 720 px (a galeria fica presa ao descer), as fotografias com
  cantos de 24 px (a miniatura do vídeo com a capa dele), a categoria numa pastilha, as escolhas, «Juntar à
  encomenda» e, por baixo, só duas linhas: a entrega e «Feito à mão pelo Martim» (nos 3D, «Feito pelo
  Martim, na impressora 3D»). Por baixo desta, em letra pequena, o nome, a morada e o email de quem faz a
  peça: a lei pede-os na própria oferta (Regulamento (UE) 2023/988, art. 19.º).
- **A encomenda:** as peças e o formulário em cartões #FFFAF3, os campos a 16 px ou mais. **O verde do
  WhatsApp só nos botões que enviam a encomenda** («Encomendar pelo WhatsApp» e, depois de enviada, «Abrir
  o WhatsApp» e «Enviar outra vez»): #1A7F45, com o branco a 5,04:1 (o #25D366 da marca, com letra
  branca, não chega a 2:1). O resto do site, e o WhatsApp dos contactos, é terracota.
- **A nossa história:** o texto numa coluna confortável (a primeira frase maior), as quatro fotografias, a
  citação em grande e os 12 vídeos dos bastidores numa fila com setas no computador. **A citação é a da
  página inicial** (`content/inicio.json`, a frase e o autor) e o modelo põe-na logo a seguir à secção que
  a conta (a da televisão): sem marcador novo, o texto da página não mudou.
- **Contactos** (o WhatsApp num cartão, os outros caminhos noutro), **Como encomendar** (os quatro passos
  numerados em cartões, e as notas da entrega, do pagamento e do prazo), **as legais** (uma coluna ao
  centro, de 46rem, com a letra a 17 px e a entrelinha a 1,65; o quadro da privacidade rola de lado no
  telemóvel) e **a 404** (ao centro, com as categorias e «Ver a loja»).
- **O movimento da B:** o entrar ao descer (o que tem `data-revelar` e começa abaixo do primeiro ecrã), os
  botões a afundar um pouco quando se carrega e as setas das filas. Com «reduzir movimento» nada mexe; sem
  JavaScript está tudo à vista.
- **Um marcador de texto sozinho num parágrafo** (`{{portes}}`, `{{pagamento}}`) fica no seu `<p>`; só os
  blocos (o quadro, a figura, os botões, as listas) saem dele.
- **Os ganchos estáveis** para os testes e para o painel (`data-produto`, `data-categoria`, `data-nome`,
  `data-preco`, `data-ficha`): ver o README. O modelo dos dados e o `src/lib/regras.mjs` não mudaram.
- **A prova:** o build e os 45 testes; no browser (Chromium e WebKit), a encomenda até ao wa.me, as
  categorias sem a página andar, nenhum transbordo a 320, 360, 375, 390 e 414 px nas 174 páginas (mais a
  encomenda com peças e o menu e a procura abertos), os alvos de toque com 44 px, nenhuma letra abaixo de
  12 px, os campos a 16 px e o entrar ao descer. Os contrastes estão no topo do `site.css` e o build
  mede-os (texto a 4,5:1).
- **As capturas para o dono:** `node scripts/capturas.mjs` (computador 1440×900 e telemóvel 390×844 ×2,
  com «reduzir movimento») em `docs/capturas/`, fora do git; a loja sai em partes de 6000 px.

### O que fica por decidir (o Renato e o dono)

- A fotografia do dragão (a cortada) e o porta-cartões escondido sem fotografia limpa (ver 2).
- A linha pequena da ficha com o nome, a morada e o email de quem faz: é a lei; pode ir para outro sítio
  da ficha, mas não sair dela.
- «Feito pelo Martim, na impressora 3D» nas peças 3D (em vez de «feito à mão»).
- O verde do WhatsApp (#1A7F45) nos três botões que enviam a encomenda.
- A citação da história em grande, logo a seguir à secção da televisão (repete a frase dita no texto).

### Depois

- O teclado e o zoom no Safari do simulador do iPhone (não se fez nesta fase).
- O painel (com `src/lib/regras.mjs` byte a byte), o repositório, o domínio, o `publicar.yml`, o Search
  Console e o IndexNow.

## 5. O que a lei pede (resumo)

Três classes: **LEI** (há norma e a falta é infração), **FORMA SEGURA** (não obrigatória) e **GOSTO**.

- **LEI**, já no site: o Livro de Reclamações na página de entrada (rodapé, peça da `legal-comum`); os
  centros de arbitragem (página de litígios, lista da `legal-comum`); a garantia de 3 anos e o aviso da UE;
  a informação antes da encomenda (prazo, pagamento, portes, desistência e a falta dela nas peças feitas à
  medida); o fecho pelo WhatsApp com o resumo que o cliente confirma (DL 24/2014, art. 5.º); a
  privacidade (RGPD, art. 13.º); a nota do custo da chamada junto do telefone (DL 59/2021). Faltam os
  dados do quadro acima.
- **LEI, fora do site** (só os donos): a confirmação de cada encomenda por escrito (PDF ou email) nos 5
  dias seguintes e antes da entrega (DL 24/2014, art. 6.º); a fatura de cada venda; os rótulos (CLP nas
  peças perfumadas, se classificadas; identificação e avisos nas velas).
- **FORMA SEGURA** (não se pediu): a garantia legal e «Desistir» no rodapé (os termos ligam a elas);
  uma referência em cada ficha.
- **GOSTO**: o Livro discreto, só no rodapé; o WhatsApp só como ligação; «(Chamada para a rede móvel
  nacional)» com o «a»; sem aviso de cookies; pouco texto.
