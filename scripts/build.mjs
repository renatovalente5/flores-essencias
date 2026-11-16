#!/usr/bin/env node
// Gera o site da Flores & Essências em _site/, a partir de content/ e media/. Node 22, sem dependências.
// Por baixo, a infraestrutura dos sites do Renato: as regras dos dados (src/lib/regras.mjs, as mesmas
// do painel), as imagens do scripts/imagens.py, a biblioteca legal-comum e as guardas do fim. Por cima,
// os modelos e o CSS próprios (a página inicial com a estrutura da proposta B, «Destaques»).
//
//   node scripts/build.mjs                       local, em http://localhost:4880/
//   node scripts/build.mjs --base=/flores-essencias   pré-visualização numa subpasta (GitHub Pages)
//   node scripts/build.mjs --dominio             o domínio ANTES de abrir: na raiz, com o _headers, mas
//                                                fechado aos motores de busca e com o que falta
//                                                «[por confirmar]»
//   node scripts/build.mjs --producao            o domínio aberto: aos motores de busca, e RECUSA
//                                                publicar com dados legais por preencher (e lista os
//                                                artigos que ficam fora do site)
//   node scripts/build.mjs --sem-imagens         não corre o scripts/imagens.py (usa a cache)
//
// Os textos que a lei manda ter certos (identificação, NIF, morada, contactos, prazos) vêm todos de
// content/site.json por marcadores ({{email}}, {{empresa.identificacao}}…): nunca escritos à mão nas
// páginas, para não envelhecerem num sítio e ficarem certos noutro.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { esc, euros, hojeEmLisboa, markdown, numeroWhatsApp, numeroLegivel, notaChamada, moradaCompleta } from '../src/templates/util.mjs';
import { pagina } from '../src/templates/layout.mjs';
import * as R from '../src/lib/regras.mjs';
import * as paginas from '../src/templates/paginas.mjs';
import { pecaLegal, categoriasComArtigos, imagem, videoBastidores, setas } from '../src/templates/componentes.mjs';
/* As peças legais comuns aos sites do Renato (a cópia em legal-comum/; não se edita aqui): o CSS do
   Livro de Reclamações, os destinatários da política de privacidade, a lista dos centros de
   arbitragem, as guardas da identificação, das promoções e das fichas, e a conta do contraste. */
import { livroCss, destinatariosHtml, frasesPrivacidade, prazos as PRAZOS_LEGAIS, ralHtml, verificarIdentificacao, verificarPromocao, verificarProduto, contraste, VERSAO as LEGAL_COMUM_VERSAO } from '../legal-comum/index.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
// --conteudo=<pasta> e --saida=<pasta>: para os testes e o ensaio do painel gerarem o site a partir de
// outro conteúdo (o media/, os modelos e a cache das imagens são sempre os daqui).
const CONTEUDO = path.resolve(args.find((a) => a.startsWith('--conteudo='))?.slice(11) || path.join(RAIZ, 'content'));
const SAIDA = path.resolve(args.find((a) => a.startsWith('--saida='))?.slice(8) || path.join(RAIZ, '_site'));
const producao = args.includes('--producao');
const dominio = producao || args.includes('--dominio');   // na raiz do domínio (aberto ou ainda não)
const base = dominio ? '' : (args.find((a) => a.startsWith('--base='))?.slice(7) || '').replace(/\/$/, '');
const semImagens = args.includes('--sem-imagens');

/* O DOMÍNIO ainda não está escolhido (16 nov 2026): sem ele, --dominio e --producao param. Quando o
   houver, escreve-se aqui (sem «https://» nem «www.»): o canonical, o sitemap e os cartões de partilha
   seguem-no. */
const DOMINIO = '';
const ORIGEM = dominio ? `https://${DOMINIO}` : (base ? 'https://renatovalente5.github.io' : 'http://localhost:4880');

const erros = [];
const avisos = [];
// NO GITHUB ACTIONS, CADA PROBLEMA VAI TAMBÉM COMO ANOTAÇÃO (::error / ::warning): é o que o painel
// lê para dizer à dona porque é que a publicação parou. O título é o ecrã («A › B: mensagem»).
const NO_CI = process.env.GITHUB_ACTIONS === 'true';
const escaparDados = (s) => String(s).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
const escaparPropriedade = (s) => escaparDados(s).replace(/:/g, '%3A').replace(/,/g, '%2C');
function anotar(nivel, texto) {
  if (!NO_CI) return;
  const m = /^([^:]{3,80}?): (.+)$/s.exec(String(texto));
  console.log(m ? `::${nivel} title=${escaparPropriedade(m[1])}::${escaparDados(m[2])}` : `::${nivel}::${escaparDados(texto)}`);
}
/** Pára a publicação: a lista no registo e, no CI, uma anotação por problema (10 no máximo). `tecnico`:
 *  um defeito do gerador, e não do conteúdo — a anotação di-lo. */
function parar(titulo, lista, { tecnico = false, nota = '' } = {}) {
  console.error(`\n${titulo}\n`);
  for (const e of lista) console.error(`  ✗ ${e}`);
  if (nota) console.error(`\n${nota}`);
  for (const e of [...new Set(lista)].slice(0, 10)) anotar('error', tecnico ? `${e} (Só o Renato pode corrigir.)` : e);
  process.exit(1);
}
const existe = (rel) => fs.existsSync(path.join(RAIZ, rel));

// ---------------------------------------------------------------- conteúdo e regras
/* As regras dos dados estão em src/lib/regras.mjs, o MESMO ficheiro que o painel há de usar (cópia
   byte a byte): o que o painel deixa gravar é o que a publicação aceita. Classes: «bloqueia» pára a
   publicação; «neutraliza» esconde só aquele artigo (ou tira-lhe a fotografia que falta) na cópia que
   o gerador lê; «avisa» só avisa. */
// Os ficheiros de uma pasta com a extensão dada, sem a extensão; uma pasta que não existe é uma lista vazia.
const listar = (rel, ext) => (fs.existsSync(path.join(RAIZ, rel)) ? fs.readdirSync(path.join(RAIZ, rel)).filter((f) => f.endsWith(ext)).map((f) => f.slice(0, -ext.length)) : []);
const lerTexto = (rel) => fs.readFileSync(path.join(CONTEUDO, rel.replace(/^content\//, '')), 'utf8');
const dadosRegras = {
  site: lerTexto('content/site.json'),
  inicio: lerTexto('content/inicio.json'),
  categorias: lerTexto('content/categorias.json'),
  fotos: lerTexto('content/fotos.json'),
  videos: lerTexto('content/videos.json'),
  artigos: Object.fromEntries(fs.readdirSync(path.join(CONTEUDO, 'produtos')).filter((f) => f.endsWith('.json')).map((f) => [f.slice(0, -5), lerTexto(`content/produtos/${f}`)])),
  ficheirosFotos: listar('media/fotos', '.jpg'),
  // um vídeo conta com o .mp4 e a capa .jpg
  ficheirosVideos: listar('media/videos', '.mp4').filter((v) => existe(`media/videos/${v}.jpg`)),
  ficheirosIcones: listar('media/icones', '.png'),
};
const hoje = hojeEmLisboa();
const listaRegras = R.problemas(dadosRegras, { hoje, producao });
for (const p of listaRegras.filter((x) => x.classe === 'bloqueia')) erros.push(`${p.ecra}: ${p.mensagem}`);
if (dominio && !DOMINIO) erros.push('Gerador: falta o domínio do site (DOMINIO, em scripts/build.mjs): sem ele, o canonical, o sitemap e os cartões de partilha não têm para onde apontar.');
/* Em produção, o que fica de fora por falta de preço diz-se também quando a publicação pára: é a outra
   lista que os donos têm de ver. */
const semPrecoEmProducao = listaRegras.filter((p) => /:preco:producao$/.test(p.chave)).map((p) => p.slug);
const notaSemPreco = semPrecoEmProducao.length ? `E, quando publicar, ${semPrecoEmProducao.length} artigos ficam fora do site por não terem preço: ${semPrecoEmProducao.join(', ')}` : '';
if (erros.length) parar(`A publicação parou: ${erros.length} ${erros.length === 1 ? 'problema' : 'problemas'} no conteúdo.`, erros, { nota: notaSemPreco });

/* Os avisos das regras, juntos quando são muitos do mesmo género (a lista inteira está no painel). */
const lembretesArtigos = new Map();
for (const p of listaRegras.filter((x) => x.classe === 'avisa')) {
  if (p.slug && p.lembrete && /:preco:previa$/.test(p.chave)) { lembretesArtigos.set('preco', [...(lembretesArtigos.get('preco') || []), p.slug]); continue; }
  avisos.push(`${p.ecra}: ${p.mensagem}`);
}
if (lembretesArtigos.get('preco')) {
  const l = lembretesArtigos.get('preco');
  avisos.push(`Artigos: ${l.length} sem preço (na pré-visualização com «Preço por confirmar»; no site a sério ficam de fora até o terem): ${l.join(', ')}`);
}
const neutro = R.neutralizar(dadosRegras, listaRegras);
const foraPorPreco = [];
for (const e of neutro.efeitos) {
  if (producao && e.efeitos.includes('esconder') && e.motivos.length === 1 && /^Falta o preço/.test(e.motivos[0])) { foraPorPreco.push(e.slug); continue; }
  avisos.push(`Artigos › ${e.nome}: ${R.descreverEfeitos(e)} (${e.motivos.join(' ')})`);
  anotar('warning', `Artigos › ${e.nome}: ${R.descreverEfeitos(e)}.`);
}
if (foraPorPreco.length) {
  avisos.push(`Artigos: ${foraPorPreco.length} ficam fora do site por não terem preço: ${foraPorPreco.join(', ')}`);
  anotar('warning', `Artigos: ${foraPorPreco.length} ficam fora do site por não terem preço.`);
}

const site = JSON.parse(dadosRegras.site);
/* A entrega em mão só se oferece depois de os donos dizerem onde a fazem (entrega.emMao): na
   pré-visualização aparece com «[por confirmar]»; no domínio aberto, sem esse texto, não há entrega
   em mão (nem na encomenda, nem nas fichas, nem nos termos). */
if (producao && !R.dito(site.entrega.emMao)) site.entrega.zonas = site.entrega.zonas.filter((z) => z.morada);
const inicio = JSON.parse(dadosRegras.inicio);
const categorias = JSON.parse(dadosRegras.categorias).slice().sort((a, b) => (a.ordem ?? 999) - (b.ordem ?? 999));
const fotos = JSON.parse(dadosRegras.fotos);
const videos = JSON.parse(dadosRegras.videos);
const ordemCat = (p) => { const i = categorias.findIndex((c) => c.slug === p.categoria); return i < 0 ? 999 : i; };
// Os artigos como o gerador os lê: a cópia neutralizada (um artigo com problemas sai escondido).
const produtos = Object.entries(neutro.artigos)
  .map(([slug, a]) => ({ slug, ...a }))
  .filter((p) => p.publicado !== false && Array.isArray(p.fotos) && p.fotos.length)
  // pela posição na lista e, com a mesma posição, pela ordem das categorias
  .sort((a, b) => (a.ordem ?? 999) - (b.ordem ?? 999) || ordemCat(a) - ordemCat(b) || a.nome.localeCompare(b.nome, 'pt'));

// ---------------------------------------------------------------- as guardas legais (só avisam)
/* As guardas da biblioteca legal-comum, em modo AVISAR: nada pára nem se esconde por elas; o que
   dizem vai para os avisos do registo, juntos por género. A identificação (DL 7/2004, art. 10.º), as
   promoções (DL 70/2007, art. 5.º) e as fichas (Regulamento (UE) 2023/988, art. 19.º; CLP nas peças
   em cera perfumada com óleos essenciais). */
{
  const e = site.empresa || {};
  const FORMAS = [[/nome individual|\beni\b/i, 'eni'], [/unipessoal/i, 'unipessoal'], [/\blda\b|limitada/i, 'lda'], [/\bs\.?\s?a\b|an[óo]nima/i, 'sa']];
  const forma = FORMAS.find(([re]) => re.test(e.tipo || ''))?.[1] || (!e.nif ? 'sem-actividade' : undefined);
  const r = verificarIdentificacao({
    nome: e.nome, formaJuridica: forma, nif: e.nif,
    morada: [e.morada, [e.codigoPostal, e.localidade].filter(Boolean).join(' ')].filter(Boolean).join(', '),
    email: site.contactos?.email, telefone: site.contactos?.telefone || site.contactos?.whatsapp,
  }, { modo: 'avisar', ecra: 'Dados da loja › Dados legais' });
  for (const p of r.problemas) avisos.push(`Identificação (${p.campo}): ${p.mensagem}`);
}
{
  const porMensagem = new Map();
  const juntar = (m, slug) => porMensagem.set(m, [...(porMensagem.get(m) || []), slug]);
  for (const p of produtos) {
    if (typeof p.precoAnterior === 'number' && typeof p.preco === 'number' && p.precoAnterior > p.preco) {
      const r = verificarPromocao({ precoAntes: p.precoAnterior, precoAgora: p.preco, inicio: p.promocaoDesde, fim: p.promocaoAte, historico: [] }, { modo: 'avisar' });
      for (const x of r.problemas) avisos.push(`Promoção › ${p.nome}: ${x.mensagem}`);
    }
    const e = site.empresa || {};
    const fab = paginas.fabricanteDoArtigo(p) || { nome: e.nome, morada: moradaCompleta(e), email: site.contactos?.email };
    const texto = `${p.nome} ${p.descricao}`;
    const categoria = p.categoria !== 'artigos-3d' && /\b(vela|velas|wax ?melts?|cera|perfumad|óleos? essencia|aroma)/i.test(texto) ? 'mistura-clp' : 'geral';
    const r = verificarProduto({ nome: p.nome, preco: p.preco, fabricante: fab, referencia: p.referencia, avisos: paginas.avisosDoArtigo(p), perigos: paginas.perigosDoArtigo(p) }, { categoria, modo: 'avisar' });
    for (const x of r.problemas) juntar(x.mensagem, p.slug);
  }
  for (const [m, slugs] of porMensagem) avisos.push(`Fichas (${slugs.length}): ${m}${slugs.length <= 6 ? ` — ${slugs.join(', ')}` : ''}`);
}

// As páginas de texto (content/paginas/*.md): as alegações, as marcas de terceiros e as personagens.
for (const f of fs.readdirSync(path.join(CONTEUDO, 'paginas')).filter((x) => x.endsWith('.md'))) {
  const t = lerTexto(`content/paginas/${f}`);
  const m = t.match(R.RE_ALEGACOES);
  if (m) erros.push(`Páginas › ${f}: «${m[0]}» é uma alegação que a lei só deixa fazer com prova (ou uma certificação que não temos). Tire a palavra.`);
  const n = t.match(R.RE_TERCEIROS);
  if (n) erros.push(`Páginas › ${f}: «${n[0]}» é uma marca ou uma personagem de outros: fora do site.`);
}
if (erros.length) parar(`A publicação parou: ${erros.length} ${erros.length === 1 ? 'problema' : 'problemas'} no conteúdo.`, erros);

// ---------------------------------------------------------------- os contrastes da paleta
/* As cores do site, medidas aqui e não a olho: o texto a 4,5:1 e os contornos dos campos a 3:1. Lêem-se
   do :root do site.css: mudar uma cor e falhar o mínimo pára a construção. */
const CSS_FONTE = fs.readFileSync(path.join(RAIZ, 'src/estilos/site.css'), 'utf8');
{
  const raiz = CSS_FONTE.slice(CSS_FONTE.indexOf(':root {'), CSS_FONTE.indexOf('}', CSS_FONTE.indexOf(':root {')));
  const cor = Object.fromEntries([...raiz.matchAll(/--([\w-]+):\s*(#[0-9A-Fa-f]{6})\b/g)].map((m) => [m[1], m[2]]));
  const PARES = [
    // o texto no creme da página, nos cartões e nas pílulas
    ['cor-tinta', 'cor-fundo', 4.5], ['cor-suave', 'cor-fundo', 4.5], ['cor-tinta', 'cor-cartao', 4.5], ['cor-suave', 'cor-cartao', 4.5],
    ['cor-tinta', 'cor-areia', 4.5], ['cor-tinta', 'cor-areia-2', 4.5], ['cor-tinta', 'cor-branco', 4.5], ['cor-suave', 'cor-branco', 4.5],
    ['cor-suave', 'cor-areia', 4.5], ['cor-tinta', 'cor-folha', 4.5], ['cor-suave', 'cor-folha', 4.5],
    // o terracota: o branco dos botões e do rodapé, o creme claro do rodapé, as ligações no creme
    ['cor-branco', 'cor-marca', 4.5], ['cor-branco', 'cor-marca-escura', 4.5], ['cor-claro', 'cor-marca', 4.5], ['cor-marca-texto', 'cor-fundo', 4.5],
    ['cor-marca', 'cor-claro', 4.5], ['cor-marca-texto', 'cor-cartao', 4.5],
    // o verde do WhatsApp (só nos botões que enviam a encomenda), com o rato e sem ele
    ['cor-branco', 'cor-whatsapp', 4.5], ['cor-branco', 'cor-whatsapp-escura', 4.5],
    // os erros e os contornos dos campos
    ['cor-erro', 'cor-branco', 4.5], ['cor-erro', 'cor-fundo', 4.5], ['cor-erro', 'cor-cartao', 4.5],
    ['cor-linha-campo', 'cor-branco', 3], ['cor-linha-campo', 'cor-fundo', 3], ['cor-linha-campo', 'cor-cartao', 3], ['cor-linha-campo', 'cor-folha', 3],
    // a marca «[por confirmar]» da pré-visualização
    ['cor-tinta', 'cor-marcador', 4.5],
  ];
  const falham = [];
  for (const [a, b, min] of PARES) {
    if (!cor[a] || !cor[b]) { falham.push(`Gerador: a cor --${!cor[a] ? a : b} não está no :root do site.css`); continue; }
    const r = contraste(cor[a], cor[b]);
    if (r < min) falham.push(`Gerador: --${a} sobre --${b} tem ${r}:1 (o mínimo é ${min}:1)`);
  }
  if (falham.length) parar('A publicação parou: as cores do site não têm contraste que chegue.', falham, { tecnico: true });
}

// ---------------------------------------------------------------- imagens
if (!semImagens) execFileSync('python3', [path.join(RAIZ, 'scripts/imagens.py')], { stdio: 'inherit' });
const manifesto = JSON.parse(fs.readFileSync(path.join(RAIZ, '.cache/imagens/manifesto.json'), 'utf8'));
/* Só as que têm ficheiro: uma descrição sem fotografia não faz mal a nada, e o gerador nunca a usa. */
const semVersoes = Object.keys(fotos).filter((f) => dadosRegras.ficheirosFotos.includes(f) && !manifesto.fotos[f]);
if (semVersoes.length) parar('A publicação parou: faltam as versões web de fotografias.', semVersoes.map((f) => `Fotografias: «${f}» não tem as versões web (scripts/imagens.py)`), { tecnico: true });
const semCapa = dadosRegras.ficheirosVideos.filter((v) => !manifesto.posters[`video-${v}`]);
if (semCapa.length) parar('A publicação parou: faltam as capas de vídeos.', semCapa.map((v) => `Vídeos: «${v}» não tem a capa em versões web (scripts/imagens.py)`), { tecnico: true });
if (!manifesto.logo || !manifesto.marca['logo-horizontal']) parar('A publicação parou: falta o logótipo.', ['Gerador: media/marca/logo.png, logo-simbolo.png e logo-horizontal.png não têm as versões (scripts/imagens.py)'], { tecnico: true });
const semIcone = [...categorias.map((c) => c.icone), ...(inicio.comoEncomendar?.itens || []).map((x) => x.icone)].filter((i) => i && !manifesto.icones[i]);
if (semIcone.length) parar('A publicação parou: faltam ícones.', semIcone.map((i) => `Gerador: o ícone «${i}» não tem as versões (scripts/imagens.py)`), { tecnico: true });

// ---------------------------------------------------------------- saída
fs.rmSync(SAIDA, { recursive: true, force: true });
fs.mkdirSync(path.join(SAIDA, 'assets/img'), { recursive: true });
const copiar = (de, para) => { fs.mkdirSync(path.dirname(para), { recursive: true }); fs.copyFileSync(de, para); };
const resumo = (buf) => crypto.createHash('sha256').update(buf).digest('hex').slice(0, 10);

// as imagens todas da cache (as versões web, os cartões de partilha, o logótipo, os ícones e as
// miniaturas que o painel mostra, assets/img/miniatura-<nome>.webp)
for (const f of fs.readdirSync(path.join(RAIZ, '.cache/imagens'))) {
  if (f !== 'manifesto.json' && !f.endsWith('.resumo')) copiar(path.join(RAIZ, '.cache/imagens', f), path.join(SAIDA, 'assets/img', f));
}
/* As letras (src/fontes): só as que lá estão. A Young Serif ainda não chegou (LEIA.md): sem ela, os
   títulos ficam na Georgia, e o @font-face dela não se escreve. */
const LETRAS = [
  { familia: 'Outfit', peso: '300 700', ficheiro: 'outfit' },
  { familia: 'Young Serif', peso: '400', ficheiro: 'youngserif' },
];
const UNICODE = {
  latin: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD',
  'latin-ext': 'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF',
};
const faces = [];
const preCarregar = [];
for (const l of LETRAS) {
  for (const sub of ['latin-ext', 'latin']) {
    const f = `${l.ficheiro}-${sub}.woff2`;
    if (!existe(`src/fontes/${f}`)) continue;
    copiar(path.join(RAIZ, 'src/fontes', f), path.join(SAIDA, 'assets/fontes', f));
    faces.push(`@font-face { font-family: '${l.familia}'; font-style: normal; font-weight: ${l.peso}; font-display: swap; src: url(fontes/${f}) format('woff2'); unicode-range: ${UNICODE[sub]}; }`);
    if (sub === 'latin') preCarregar.push(f);
  }
}

// o aviso oficial da garantia: byte a byte o da Comissão (media/legal/LEIA.md)
const AVISO_SHA = {
  'aviso-garantia-legal-pt.svg': '9069bb0bc5e9f3cf655579038be5646181cc5447a25f3f8ccf2d018eacba0ac1',
  'aviso-garantia-legal-pt.pdf': 'b145a3014984f474d9bb81c60b5a492a376e64e55695eb089f0554adaa752877',
};
for (const [f, sha] of Object.entries(AVISO_SHA)) {
  const buf = fs.readFileSync(path.join(RAIZ, 'media/legal', f));
  if (crypto.createHash('sha256').update(buf).digest('hex') !== sha) parar('A publicação parou: o aviso da garantia foi alterado.', [`Garantia: media/legal/${f} foi alterado, e o aviso oficial da garantia não se pode editar`], { tecnico: true });
  copiar(path.join(RAIZ, 'media/legal', f), path.join(SAIDA, 'assets/legal', f));
}
const AVISO_ALT = 'GARANTIA LEGAL. Proteção da garantia legal mínima de dois anos para os bens vendidos na União Europeia. Os consumidores podem invocar os seus direitos ao abrigo da garantia legal de conformidade, por exemplo, se os bens: não corresponderem à descrição; não funcionarem como previsto. Os vendedores são responsáveis por qualquer falta de conformidade que exista no momento em que os bens forem entregues e se manifeste no período de garantia legal. Os vendedores nessa situação estão obrigados a oferecer: reparação gratuita ou substituição gratuita; em alguns casos, redução do preço ou reembolso integral. Alguns países têm um período de garantia legal mais longo. Para os bens em segunda mão, pode aplicar-se um período mais curto, mas não inferior a um ano. Para mais informações sobre os seus direitos num determinado país, digitalize o código QR abaixo ou consulte o vendedor. europa.eu/youreurope/garantias. O que fazer se receber bens não conformes: 1. Contactar o vendedor o mais rapidamente possível para expor o problema; 2. Apresentar uma prova de compra, como um recibo, uma fatura ou um extrato bancário. Os vendedores e os produtores também podem oferecer garantias comerciais, que se aplicam independentemente da garantia legal. Por exemplo, pode ver este rótulo GARAN, que representa uma garantia comercial de durabilidade oferecida pelo produtor sem custos adicionais e cobrindo a totalidade do bem.';

// os vídeos (media/videos/): nome com resumo, para a cache de um ano nunca servir um antigo
const ficheirosVideo = {};
for (const nome of dadosRegras.ficheirosVideos) {
  const buf = fs.readFileSync(path.join(RAIZ, 'media/videos', `${nome}.mp4`));
  ficheirosVideo[nome] = `video/${nome}-${resumo(buf)}.mp4`;
  copiar(path.join(RAIZ, 'media/videos', `${nome}.mp4`), path.join(SAIDA, 'assets', ficheirosVideo[nome]));
}

// CSS e JS: um ficheiro cada, com o resumo no nome
/* A folha leva primeiro o CSS do Livro de Reclamações da biblioteca legal-comum (a variante discreta,
   .lr-discreto) e as letras; as regras do site vêm depois e ganham. */
const css = Buffer.from(`/* legal-comum v${LEGAL_COMUM_VERSAO}: o Livro de Reclamações */\n${livroCss()}\n${faces.join('\n')}\n${CSS_FONTE}`);
const ORDEM_JS = ['nucleo.js', 'interface.js', 'carrinho.js', 'procura.js', 'juntar.js', 'loja.js'];
const soltos = fs.readdirSync(path.join(RAIZ, 'src/scripts')).filter((f) => f.endsWith('.js') && !ORDEM_JS.includes(f));
if (soltos.length) parar('A publicação parou: há scripts fora da lista.', soltos.map((f) => `Gerador: src/scripts/${f} não está em ORDEM_JS (scripts/build.mjs)`), { tecnico: true });
const js = Buffer.from(ORDEM_JS.map((f) => `// ${f}\n${fs.readFileSync(path.join(RAIZ, 'src/scripts', f), 'utf8')}`).join('\n'));
const ficheiros = { css: `site-${resumo(css)}.css`, js: `site-${resumo(js)}.js`, videos: ficheirosVideo, letras: preCarregar };
fs.writeFileSync(path.join(SAIDA, 'assets', ficheiros.css), css);
fs.writeFileSync(path.join(SAIDA, 'assets', ficheiros.js), js);

// ---------------------------------------------------------------- as páginas que vão existir
/* Antes de escrever: a lista dos caminhos. Uma ligação do conteúdo (a capa, o aviso) para uma página
   que não vai existir (uma categoria sem artigos) muda-se para a loja, em vez de partir. */
const PAGINAS_MD = fs.readdirSync(path.join(CONTEUDO, 'paginas')).filter((x) => x.endsWith('.md'));
const comArtigos = categorias.filter((c) => produtos.some((p) => p.categoria === c.slug));
const ctxBase = { site, inicio, categorias, produtos, fotos, videos, manifesto, hoje, producao, ficheiros };
const ocasiao = paginas.ocasiaoDaEpoca(ctxBase);
const caminhos = new Set([
  '/', '/loja/', '/encomenda/', '/contactos/',
  ...comArtigos.map((c) => `/loja/${c.slug}/`),
  ...(ocasiao ? [`/${ocasiao}/`] : []),
  ...produtos.map((p) => `/produtos/${p.slug}/`),
  ...PAGINAS_MD.map((f) => `/${f.replace(/\.md$/, '')}/`),
]);

// ---------------------------------------------------------------- contexto dos modelos
const numero = numeroWhatsApp(site.contactos.whatsapp);
const en = site.entrega;
const ctx = {
  ...ctxBase,
  url: (c) => (/^https?:|^mailto:|^tel:|^#/.test(c) ? c : `${base}${c}`),
  asset: (rel) => `${base}/assets/${rel}`,
  absoluto: (c) => `${ORIGEM}${base}${c}`,
  existe: (c) => caminhos.has(String(c || '').split(/[?#]/)[0]),
  // o wa.me com a mensagem já escrita (sem texto, só a conversa)
  whatsapp: (texto) => `https://wa.me/${numero}${texto ? `?text=${encodeURIComponent(texto)}` : ''}`,
  marcador: (desc) => `<mark class="por-confirmar">[por confirmar: ${esc(desc)}]</mark>`,
};
/* Na pré-visualização, o que falta dizer leva a marca «[por confirmar: …]»; no domínio aberto, as regras
   já pararam a construção antes do que a lei pede, e o resto diz «a confirmar» (ou cala-se). */
const porConfirmar = (desc, emProducao = 'a confirmar') => (producao ? esc(emProducao) : ctx.marcador(desc));
const zonaEmMao = () => en.zonas.find((z) => !z.morada);
const zonaCtt = () => en.zonas.find((z) => z.id === 'ctt');
ctx.textoEmMao = () => (R.dito(en.emMao) ? esc(en.emMao) : porConfirmar('onde fazemos entregas em mão e como se combina', ''));
function portesCtt() {
  const v = en.portes?.ctt;
  if (Number.isFinite(v)) return euros(v);
  return R.dito(en.portesNota) ? 'a confirmar' : porConfirmar('os portes dos CTT');
}
/* A primeira linha por baixo do botão da ficha: como se recebe, e o prazo. */
ctx.linhaEntrega = () => {
  const partes = [];
  if (zonaEmMao()) partes.push(`Entrega em mão (${ctx.textoEmMao()})`);
  if (zonaCtt()) partes.push(`${partes.length ? 'envio' : 'Envio'} pelos CTT (portes: ${portesCtt()})`);
  return `${partes.join(' ou ')}. Prazo: ${R.dito(en.prazo) ? esc(en.prazo) : porConfirmar('quanto tempo leva a fazer e a entregar', 'a combinar')}`;
};
/* Quem vende, numa linha: o nome, o NIF, a morada e (na ficha) o email. */
ctx.identificacaoCurta = ({ nif = true, email = false } = {}) => {
  const e = site.empresa;
  const partes = [R.dito(e.nome) ? esc(e.nome) : porConfirmar('o nome de quem vende', '')];
  if (nif) partes.push(R.dito(e.nif) ? `NIF ${esc(e.nif)}` : `NIF ${porConfirmar('o NIF', '')}`);
  partes.push(R.dito(e.morada) ? esc(moradaCompleta(e)) : porConfirmar('a morada (rua, número, código postal e localidade)', ''));
  if (email) partes.push(R.dito(site.contactos.email) ? esc(site.contactos.email) : porConfirmar('o email', ''));
  return partes.filter(Boolean).join(' · ');
};
/* A segunda linha da ficha: «Feito à mão pelo Martim» e, por baixo, em letra pequena, quem faz a peça
   (Regulamento (UE) 2023/988, art. 19.º: o nome, a morada e o email do fabricante — a lei pede-os na
   própria oferta). */
ctx.linhaFeitoAMao = (p) => {
  const fab = paginas.fabricanteDoArtigo(p);
  const quem = fab ? [fab.nome, fab.morada, fab.email].map(esc).join(' · ') : ctx.identificacaoCurta({ nif: false, email: true });
  return `${p.categoria === 'artigos-3d' ? 'Feito pelo Martim, na impressora 3D' : 'Feito à mão pelo Martim'}<span class="ficha__quem"><span class="so-leitor"> — </span>${quem}</span>`;
};
if (inicio.capa?.botao?.ligacao && !ctx.existe(inicio.capa.botao.ligacao)) avisos.push(`Página inicial › A capa: o botão «${inicio.capa.botao.texto}» leva a ${inicio.capa.botao.ligacao}, que não existe: vai para a loja.`);

// ---------------------------------------------------------------- catálogo (encomenda e procura)
/* O que o browser lê (assets/catalogo-*.json): os preços, as escolhas de cada artigo, a fotografia (as
   versões do imagens.py), a categoria, as formas de receber e os portes. A encomenda nunca guarda
   preços: lê-os sempre daqui. */
const fotoDoCatalogo = (f) => {
  const m = manifesto.fotos[f];
  return { n: f, r: m.resumo, l: m.larguras, f: m.formatos, w: m.largura, h: m.altura, foco: fotos[f]?.foco || '50% 50%', alt: fotos[f]?.alt || '' };
};
const catalogo = {
  v: 1,
  marca: site.marca,
  whatsapp: numero,
  assets: ctx.asset(''),
  encomenda: ctx.url('/encomenda/'),
  loja: ctx.url('/loja/'),
  pagamento: R.dito(site.pagamento) ? site.pagamento : '',
  zonas: en.zonas.map((z) => ({ id: z.id, nome: z.nome, curto: z.curto, morada: z.morada === true })),
  portes: {
    ...Object.fromEntries(R.ZONAS_ENVIO.map((z) => [z, Number.isFinite(en.portes?.[z]) ? en.portes[z] : null])),
    gratisAPartirDe: Number.isFinite(en.portes?.gratisAPartirDe) ? en.portes.gratisAPartirDe : null,
  },
  produtos: Object.fromEntries(produtos.map((p) => {
    const c = categorias.find((k) => k.slug === p.categoria);
    return [p.slug, {
      nome: p.nome, url: ctx.url(`/produtos/${p.slug}/`), cat: p.categoria, catNome: c ? c.nome : '',
      desc: p.descricao, ocasioes: R.ocasioesDe(p).map((o) => R.OCASIOES[o]).join(' '),
      preco: typeof p.preco === 'number' ? p.preco : null, precoAnterior: p.precoAnterior || null, promocaoAte: p.promocaoAte || '',
      desde: p.precoDesde === true, pers: R.personalizacaoDe(p),
      img: fotoDoCatalogo(p.fotos[0]),
    }];
  })),
};
const catalogoBuf = Buffer.from(JSON.stringify(catalogo));
ficheiros.catalogo = `catalogo-${resumo(catalogoBuf)}.json`;
fs.writeFileSync(path.join(SAIDA, 'assets', ficheiros.catalogo), catalogoBuf);

// ---------------------------------------------------------------- marcadores das páginas de texto
/* Os portes, numa frase: «Pelos CTT: 4,50 €.» Uma zona sem valor é «a confirmar»; com a nota (como se
   calculam), a frase segue-a. A entrega em mão só diz o que os donos escreverem (entrega.emMao): nada
   de «grátis» ou «sem custos» escrito por nós. */
function textoPortes() {
  const p = en.portes || {};
  const nota = R.dito(en.portesNota) ? String(en.portesNota).trim() : '';
  const partes = [];
  if (zonaCtt()) partes.push(`Envio pelos CTT: ${Number.isFinite(p.ctt) ? euros(p.ctt) : nota ? 'a confirmar' : porConfirmar('os portes dos CTT')}.${nota ? ` ${esc(nota)}` : ''}`);
  if (Number.isFinite(p.gratisAPartirDe)) partes.push(`Portes grátis a partir de ${euros(p.gratisAPartirDe)} em peças.`);
  if (zonaEmMao()) partes.push(`Entrega em mão: ${R.dito(en.emMao) ? esc(en.emMao) : porConfirmar('onde fazemos entregas em mão e como se combina')}.`);
  return partes.join(' ');
}

function identificacao() {
  const e = site.empresa;
  const partes = [];
  partes.push(R.dito(e.nome) ? `<strong>${esc(e.nome)}</strong>` : ctx.marcador('o nome de quem vende (a empresa ou o empresário em nome individual)'));
  if (R.dito(e.tipo)) partes.push(esc(e.tipo.charAt(0).toLowerCase() + e.tipo.slice(1)));
  partes.push(R.dito(e.nif) ? `NIF ${esc(e.nif)}` : `NIF ${ctx.marcador('o NIF')}`);
  partes.push(`com morada em ${R.dito(e.morada) ? esc(moradaCompleta(e)) : ctx.marcador('a morada (rua, número, código postal e localidade)')}`);
  return `${partes.join(', ')}, que vende com a marca ${esc(site.marca)}.`;
}

function botoesDesistencia() {
  const texto = 'Olá! Quero desistir da compra (direito de livre resolução).\n\nPeça: \nEncomendada em: \nRecebida em: \nNome: \nMorada: ';
  const b = [];
  if (numero) b.push(`<a class="botao botao--principal" href="${ctx.whatsapp(texto)}" target="_blank" rel="noopener">Desistir pelo WhatsApp</a>`);
  if (R.dito(site.contactos.email)) b.push(`<a class="botao botao--suave" href="mailto:${esc(site.contactos.email)}?subject=${encodeURIComponent('Desistência da compra (livre resolução)')}&amp;body=${encodeURIComponent(texto)}">Desistir por email</a>`);
  return `<div class="botoes">${b.join('')}</div><p class="nota">Respondemos a confirmar que recebemos a tua desistência.</p>`;
}

/* Quem recebe dados (destinatariosHtml, da legal-comum): o alojamento e o DNS (a Cloudflare, quando o
   site for para o domínio), o WhatsApp e o Instagram (a Meta) e a manutenção do site. O email ainda
   não está dito: entra quando o for. */
const CONFIG_PRIVACIDADE = {
  alojamento: 'cloudflare', dns: 'cloudflare',
  whatsapp: true, instagram: true,
  manutencao: { nome: 'Renato Valente', papel: 'subcontratante' },
};

/* Os vídeos de uma página de texto («videos:» no cabeçalho) e as fotografias («fotos:»), para os
   marcadores {{bastidores}} e {{galeria}}. */
const listaDe = (v) => String(v || '').split(',').map((x) => x.trim()).filter(Boolean);

function resolverMarcadores(fonte, onde, meta = {}) {
  const c = site.contactos;
  const tokens = [];
  const guardar = (html) => { tokens.push(html); return `\u0000${tokens.length - 1}\u0000`; };
  const tel = R.numeroPortugues(c.telefone);
  const valores = {
    /* O texto dos donos vai sempre por guardar(): o markdown() escaparia outra vez o que o esc() já
       escapou («MB WAY &amp;amp; transferência»). */
    marca: () => guardar(esc(site.marca)),
    email: () => (R.dito(c.email) ? guardar(`<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>`) : guardar(ctx.marcador('o email'))),
    // o WhatsApp só como ligação, sem o número; o telefone com o número e a nota
    whatsapp: () => guardar(`<a href="https://wa.me/${numero}" target="_blank" rel="noopener">WhatsApp</a>`),
    telefone: () => (tel ? guardar(`<a href="tel:+351${tel}">${esc(numeroLegivel(tel))}</a> ${notaChamada(tel)}`) : guardar(ctx.marcador('o telefone'))),
    /* Os contactos dos termos: o email, o WhatsApp e o telefone (DL 24/2014, art. 4.º, n.º 1, al. c)). */
    contactos: () => guardar([
      R.dito(c.email) ? `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : ctx.marcador('o email'),
      `<a href="https://wa.me/${numero}" target="_blank" rel="noopener">WhatsApp</a>`,
      tel ? `telefone <a href="tel:+351${tel}">${esc(numeroLegivel(tel))}</a> ${notaChamada(tel)}` : '',
    ].filter(Boolean).join(' · ')),
    'empresa.identificacao': () => guardar(identificacao()),
    'empresa.iva': () => guardar(R.dito(site.empresa.iva) ? esc(site.empresa.iva) : porConfirmar('se os preços incluem IVA ou se há isenção', '')),
    prazo: () => guardar(R.dito(en.prazo) ? esc(en.prazo) : ctx.marcador('quanto tempo leva a fazer e a entregar uma peça')),
    pagamento: () => guardar(R.dito(site.pagamento) ? esc(site.pagamento) : ctx.marcador('as formas de pagamento (MB WAY, transferência, na entrega…)')),
    portes: () => guardar(textoPortes()),
    botoesDesistencia: () => guardar(botoesDesistencia()),
    /* A política de privacidade (RGPD, art. 13.º), pela biblioteca legal-comum: os destinatários reais,
       os prazos e a frase das páginas da Meta. */
    'privacidade.destinatarios': () => guardar(pecaLegal('privacidade-destinatarios', `<div class="quadro" tabindex="0" role="region" aria-label="Quem recebe os dados">${destinatariosHtml(CONFIG_PRIVACIDADE)}</div>`)),
    'privacidade.prazos': () => guardar(pecaLegal('privacidade-prazos', `<ul>${[
      'Pedidos de informação que não chegam a encomenda: 12 meses depois da última mensagem.',
      'Conversas e dados de uma encomenda: enquanto forem precisos para ela e para a garantia, até 3 anos depois da entrega.',
      'Faturas e dados de faturação: 10 anos, por obrigação fiscal (artigo 52.º do Código do IVA).',
      PRAZOS_LEGAIS.registosTecnicos.texto,
    ].map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`)),
    'privacidade.frases': () => guardar(pecaLegal('privacidade-frases', frasesPrivacidade(CONFIG_PRIVACIDADE).map((t) => `<p>${esc(t)}</p>`).join(''))),
    avisoGarantia: () => guardar(`<figure class="aviso-garantia"><img src="${ctx.asset('legal/aviso-garantia-legal-pt.svg')}" width="600" height="848" alt="${esc(AVISO_ALT)}" loading="lazy" decoding="async"><figcaption><a href="${ctx.asset('legal/aviso-garantia-legal-pt.pdf')}">Descarregar o aviso oficial (PDF)</a> · <a href="https://europa.eu/youreurope/garantias" target="_blank" rel="noopener">europa.eu/youreurope/garantias</a></figcaption></figure>`),
    // os centros de arbitragem de consumo, da legal-comum (a lista nacional: a morada ainda não está dita)
    ral: () => guardar(pecaLegal('ral', ralHtml({ ambito: 'nacional' }))),
    // as fotografias e os vídeos da página (o cabeçalho do Markdown)
    galeria: () => {
      const lista = listaDe(meta.fotos).filter((f) => {
        if (!manifesto.fotos[f] || !fotos[f]) { erros.push(`${onde}: a fotografia «${f}» não existe`); return false; }
        return true;
      });
      return guardar(`<div class="galeria-texto" role="list">${lista.map((f) => `<figure class="galeria-texto__foto" role="listitem" data-revelar>${imagem(ctx, f, { tamanhos: '(min-width: 1376px) 302px, (min-width: 900px) calc(25vw - 36px), calc(50vw - 22px)', ate: 960, moldura: 1 })}</figure>`).join('')}</div>`);
    },
    bastidores: () => {
      const lista = listaDe(meta.videos).filter((v) => {
        if (!ficheiros.videos[v]) { erros.push(`${onde}: o vídeo «${v}» não existe`); return false; }
        return true;
      });
      // a fila desliza de lado; no computador, as setas por baixo (como a fila do Natal)
      return guardar(`<ul class="fila fila--videos fila--texto" id="fila-bastidores" role="list" data-revelar>${lista.map((v) => videoBastidores(ctx, v)).join('\n')}</ul>${setas('fila-bastidores', 'Vídeos dos bastidores')}`);
    },
  };
  const texto = fonte.replace(/\{\{([\w.]+)\}\}/g, (todo, chave) => {
    if (!valores[chave]) { erros.push(`${onde}: o marcador «${todo}» não existe (existem: ${Object.keys(valores).join(', ')})`); return todo; }
    return valores[chave]();
  });
  return { texto, tokens };
}

function paginaMarkdown(ficheiro) {
  const fonte = fs.readFileSync(path.join(CONTEUDO, 'paginas', ficheiro), 'utf8');
  const [cabeca, ...corpo] = fonte.split(/\n---\n/);
  const meta = Object.fromEntries(cabeca.split('\n').filter(Boolean).map((l) => { const i = l.indexOf(':'); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
  const { texto, tokens } = resolverMarcadores(corpo.join('\n---\n'), `Páginas › ${ficheiro}`, meta);
  /* Um marcador sozinho num parágrafo sai do <p> que o Markdown lhe põe quando é um bloco (quadro,
     figura, botões, lista); um marcador de texto (os portes, o pagamento, os contactos) fica no seu
     parágrafo. */
  const bloco = (h) => /^\s*<(?:div|figure|ul|ol|table|section|p|!--)/i.test(h);
  let html = markdown(texto, ctx.url).replace(/<p>\u0000(\d+)\u0000<\/p>/g, (todo, i) => (bloco(tokens[Number(i)]) ? tokens[Number(i)] : todo));
  html = html.replace(/\u0000(\d+)\u0000/g, (_, i) => tokens[Number(i)]);
  const slug = ficheiro.replace(/\.md$/, '');
  /* As páginas legais (com «atualizado» no cabeçalho) ficam fora do Google: noindex e fora do sitemap
     (o Renato, 13 nov 2026). «indexar: não» tira qualquer outra; «indexar: sim» repõe. */
  const legal = Boolean(meta.atualizado);
  const indexar = /^(sim|true)$/i.test(meta.indexar || '') ? true : /^(n[ãa]o|false)$/i.test(meta.indexar || '') ? false : !legal;
  return { caminho: `/${slug}/`, titulo: meta.titulo, tituloSeo: meta.tituloSeo, subtitulo: meta.subtitulo, modelo: meta.modelo, descricao: meta.descricao, atualizado: meta.atualizado, indexar, html };
}

// ---------------------------------------------------------------- páginas
const saidas = [];
saidas.push(paginas.inicio(ctx));
saidas.push(paginas.loja(ctx));
for (const c of comArtigos) saidas.push(paginas.loja(ctx, c.slug));   // as categorias vazias não têm página
if (ocasiao) saidas.push(paginas.ocasiao(ctx, ocasiao));
for (const p of produtos) saidas.push(paginas.produto(ctx, p));
saidas.push(paginas.encomenda(ctx));
saidas.push(paginas.contactos(ctx));
for (const f of PAGINAS_MD) saidas.push(paginas.texto(ctx, paginaMarkdown(f)));
saidas.push(paginas.erro404(ctx));

if (erros.length) parar(`A publicação parou: ${erros.length} ${erros.length === 1 ? 'problema' : 'problemas'}.`, erros, { tecnico: true });

for (const s of saidas) {
  const html = pagina(ctx, s);
  const destino = s.caminho.endsWith('.html') ? path.join(SAIDA, s.caminho) : path.join(SAIDA, s.caminho, 'index.html');
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, html);
}

// ---------------------------------------------------------------- robots, sitemap, _headers
const indexaveis = saidas.filter((s) => s.caminho !== '/404.html' && s.indexar !== false);
/* O sitemap só com as páginas de destino (as legais, a encomenda e a 404 ficam fora). A data de cada
   página sai do git (o conteúdo de que ela é feita), com a hora: duas publicações no mesmo dia. Na
   pré-visualização escreve-se também (é a lista das páginas para as provas), mas o robots.txt não o
   anuncia e fecha tudo. */
let lastmod = {};
try {
  const data = (ficheirosFonte) => execFileSync('git', ['log', '-1', '--format=%cI', '--', ...ficheirosFonte], { cwd: RAIZ, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  for (const s of indexaveis) {
    let fontes = ['content/site.json', 'src/templates'];
    if (s.caminho === '/') fontes = ['content/inicio.json', 'content/produtos', 'src/templates'];
    else if (s.caminho.startsWith('/produtos/')) fontes = [`content/produtos/${s.caminho.split('/')[2]}.json`, 'src/templates'];
    else if (s.caminho.startsWith('/loja/') || s.caminho === `/${ocasiao}/`) fontes = ['content/produtos', 'content/categorias.json', 'src/templates'];
    else if (existe(`content/paginas${s.caminho.replace(/\/$/, '')}.md`)) fontes = [`content/paginas${s.caminho.replace(/\/$/, '')}.md`, 'src/templates'];
    lastmod[s.caminho] = data(fontes) || hoje;
  }
} catch { lastmod = {}; }
fs.writeFileSync(path.join(SAIDA, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${indexaveis.map((s) => `  <url><loc>${ctx.absoluto(s.caminho)}</loc><lastmod>${lastmod[s.caminho] || hoje}</lastmod></url>`).join('\n')}
</urlset>
`);
// Pré-visualização: fechada aos motores de busca, mas aberta aos robôs que fazem a pré-visualização das
// ligações no WhatsApp e no Facebook (sem isto, partilhar o link mostra-se sem imagem). Em produção, as
// páginas legais NÃO se bloqueiam aqui: o Google tem de as ler para ver o noindex.
fs.writeFileSync(path.join(SAIDA, 'robots.txt'), producao
  ? `User-agent: *\nAllow: /\n\nSitemap: ${ctx.absoluto('/sitemap.xml')}\n`
  : 'User-agent: facebookexternalhit\nAllow: /\n\nUser-agent: WhatsApp\nAllow: /\n\nUser-agent: *\nDisallow: /\n');
// No domínio (Cloudflare): a cache dos ficheiros com o resumo no nome, e os cabeçalhos de segurança.
if (dominio) {
  const umAno = '  Cache-Control: public, max-age=31536000, immutable\n';
  const seguranca = '/*\n  X-Content-Type-Options: nosniff\n  X-Frame-Options: SAMEORIGIN\n  Content-Security-Policy: frame-ancestors \'self\'\n  Referrer-Policy: strict-origin-when-cross-origin\n  Strict-Transport-Security: max-age=86400\n';
  fs.writeFileSync(path.join(SAIDA, '_headers'), seguranca + ['/assets/site-*', '/assets/catalogo-*', '/assets/video/*', '/assets/fontes/*'].map((r) => `${r}\n${umAno}`).join(''));
}
fs.writeFileSync(path.join(SAIDA, '.nojekyll'), '');
// A chave do IndexNow (o aviso ao Bing de que uma página mudou), só no site aberto: é pública por desenho.
const INDEXNOW = 'b7c4d31e9a2f4c08b1e6d5a3f0c97e24';
if (producao) fs.writeFileSync(path.join(SAIDA, `${INDEXNOW}.txt`), INDEXNOW);

// ---------------------------------------------------------------- verificação do que saiu
const problemas = [];
const todos = [];
(function andar(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) andar(p); else todos.push(p); } })(SAIDA);
const todosHtml = todos.filter((p) => p.endsWith('.html'));
/* NADA DA DREAM ART (o site nasceu da infraestrutura dela; o aspeto e os textos são novos): nem o nome,
   nem o dono, nem a terra, nem a Mimices. Em todas as páginas e em todos os ficheiros de texto que
   saem (CSS, JS, catálogo, sitemap, robots). */
const RESTOS = /dream ?art|dreamart|luís|monteiro|rio tinto|gondomar|mimices/i;
for (const f of todos.filter((p) => /\.(html|css|js|json|xml|txt)$|_headers$/.test(p))) {
  const m = fs.readFileSync(f, 'utf8').match(RESTOS);
  if (m) problemas.push(`${path.relative(SAIDA, f)}: tem «${m[0]}» (resto de outro site)`);
}
const vistosTitulos = new Map();
const vistasDescricoes = new Map();
for (const f of todosHtml) {
  const html = fs.readFileSync(f, 'utf8');
  const onde = path.relative(SAIDA, f);
  for (const lixo of ['{{', 'undefined', 'NaN', '[object Object]']) if (html.includes(lixo)) problemas.push(`${onde}: contém «${lixo}»`);
  if (/obriga[çc][ãa]o de pagar/i.test(html)) problemas.push(`${onde}: tem a fórmula «obrigação de pagar», que o Renato não quer em nenhum site`);
  const terceiro = html.replace(/<[^>]+>/g, ' ').match(R.RE_TERCEIROS);
  if (terceiro) problemas.push(`${onde}: tem «${terceiro[0]}» (marca ou personagem de outros)`);
  if (producao && html.includes('por-confirmar')) problemas.push(`${onde}: ainda tem texto por confirmar`);
  if (!html.includes('<!-- legal-comum:livro ')) problemas.push(`${onde}: falta a ligação ao Livro de Reclamações`);
  if ((html.match(/<h1[\s>]/g) || []).length !== 1) problemas.push(`${onde}: tem ${(html.match(/<h1[\s>]/g) || []).length} títulos h1 (tem de ter um)`);
  const robots = /<meta name="robots" content="([^"]+)"/.exec(html)?.[1] || '';
  if (!producao && !/noindex/.test(robots)) problemas.push(`${onde}: a pré-visualização tem de ser noindex`);
  for (const m of html.matchAll(/<img\b[^>]*>/g)) {
    if (!/\salt="/.test(m[0])) problemas.push(`${onde}: imagem sem alt: ${m[0].slice(0, 80)}`);
    if (!/\swidth="\d+"/.test(m[0]) || !/\sheight="\d+"/.test(m[0])) problemas.push(`${onde}: imagem sem width/height: ${m[0].slice(0, 80)}`);
  }
  // os JSON-LD têm de se ler (um erro aqui e o Google ignora a página inteira)
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try { const j = JSON.parse(m[1]); if (!j['@context'] || !j['@type']) problemas.push(`${onde}: JSON-LD sem @context ou @type`); } catch (e) { problemas.push(`${onde}: JSON-LD que não se lê (${e.message})`); }
  }
  // ids repetidos partem as ligações dos rótulos e dos aria-controls
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  const repetidos = ids.filter((x, i) => ids.indexOf(x) !== i);
  if (repetidos.length) problemas.push(`${onde}: ids repetidos: ${[...new Set(repetidos)].join(', ')}`);
  // nada de terceiros: as páginas não carregam nada de fora (as letras e as imagens são do site)
  for (const m of html.matchAll(/<(?:script|link|img|source|iframe|video)\b[^>]*\s(?:src|srcset|href)="(https?:\/\/[^"]+)"/g)) {
    if (!/^<link[^>]*rel="canonical"/.test(m[0]) && !m[1].startsWith(ORIGEM)) problemas.push(`${onde}: carrega de fora: ${m[1].slice(0, 80)}`);
  }
  for (const m of html.matchAll(/\s(?:href|src|poster|action)="([^"]+)"/g)) {
    let u = m[1].replace(/&amp;/g, '&');
    if (/^(https?:|mailto:|tel:|#|data:)/.test(u)) continue;
    // nada de «?parametro=» nas ligações internas: para o Google, cada um é outra página
    if (u.includes('?')) problemas.push(`${onde}: ligação interna com parâmetros: ${u}`);
    if (base && !u.startsWith(base + '/')) { problemas.push(`${onde}: ligação sem o prefixo ${base}: ${u}`); continue; }
    u = u.slice(base.length).split(/[?#]/)[0];
    const alvo = path.join(SAIDA, decodeURIComponent(u));
    const ok = fs.existsSync(alvo) && (fs.statSync(alvo).isFile() || fs.existsSync(path.join(alvo, 'index.html')));
    if (!ok) problemas.push(`${onde}: ligação partida: ${m[1]}`);
  }
  for (const m of html.matchAll(/\ssrcset="([^"]+)"/g)) {
    for (const parte of m[1].split(',')) {
      const u = parte.trim().split(/\s+/)[0].slice(base.length);
      if (!fs.existsSync(path.join(SAIDA, u))) problemas.push(`${onde}: imagem em falta no srcset: ${u}`);
    }
  }
  const og = html.match(/property="og:image" content="([^"]+)"/)?.[1];
  if (!og) problemas.push(`${onde}: falta o cartão de partilha (og:image)`);
  if (og && !fs.existsSync(path.join(SAIDA, og.replace(ORIGEM + base, '')))) problemas.push(`${onde}: o cartão de partilha não existe: ${og}`);
  // título e descrição únicos em cada página de destino (o Google escolhe os sitelinks entre elas)
  if (!/noindex/.test(robots) || !producao) {
    const t = /<title>([^<]*)<\/title>/.exec(html)?.[1] || '';
    const d = /<meta name="description" content="([^"]*)"/.exec(html)?.[1] || '';
    if (onde !== '404.html' && !/encomenda\/|termos|privacidade|desistir|garantia|litigios/.test(onde)) {
      if (vistosTitulos.has(t)) problemas.push(`${onde}: o título «${t}» é igual ao de ${vistosTitulos.get(t)}`); else vistosTitulos.set(t, onde);
      if (vistasDescricoes.has(d)) problemas.push(`${onde}: a descrição é igual à de ${vistasDescricoes.get(d)}`); else vistasDescricoes.set(d, onde);
      if (!t || !d) problemas.push(`${onde}: falta o título ou a descrição`);
    }
  }
}
// as páginas legais: fora do sitemap e com noindex (em produção); continuam no site, ligadas no rodapé
const sitemap = fs.readFileSync(path.join(SAIDA, 'sitemap.xml'), 'utf8');
for (const s of saidas.filter((x) => x.indexar === false)) {
  if (sitemap.includes(`<loc>${ctx.absoluto(s.caminho)}</loc>`)) problemas.push(`sitemap.xml: tem ${s.caminho}, que é noindex`);
}
// as categorias vazias não têm página, nem ligação em lado nenhum
for (const c of categorias.filter((k) => !comArtigos.includes(k))) {
  if (fs.existsSync(path.join(SAIDA, 'loja', c.slug))) problemas.push(`loja/${c.slug}/: uma categoria sem artigos não pode ter página`);
}
if (problemas.length) parar(`A publicação parou: o site saiu com ${problemas.length} problemas.`, [...new Set(problemas)].slice(0, 60).map((p) => `Gerador: ${p}`), { tecnico: true });

for (const a of avisos) console.warn(`  ! ${a}`);
if (!existe('src/fontes/youngserif-latin.woff2')) console.warn('  ! Letras: falta a Young Serif (src/fontes/LEIA.md): os títulos estão na Georgia.');
console.log(`site: ${saidas.length} páginas em ${path.relative(RAIZ, SAIDA) || '.'}/ (${producao ? `produção, ${DOMINIO}` : dominio ? `${DOMINIO}, ainda fechado aos motores de busca` : base ? `pré-visualização, ${ORIGEM}${base}/` : 'local'}), ${produtos.length} artigos, ${comArtigos.length} categorias${ocasiao ? `, a ocasião /${ocasiao}/` : ''}, hoje ${hoje}`);
