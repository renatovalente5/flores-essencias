// As peças que se repetem: fotografias, o logótipo, os ícones da marca, preços, cartões de artigo, as
// filas e as grelhas, os círculos das categorias, as pastilhas da loja, os vídeos, as cabeças das
// páginas e as peças legais comuns.
import { esc, euros, precoDe, dataPorExtenso } from './util.mjs';
import { ico } from './icones.mjs';
import { livroReclamacoes, VERSAO as LEGAL_COMUM_VERSAO } from '../../legal-comum/index.mjs';

/* AS PEÇAS DA BIBLIOTECA legal-comum (a cópia está em legal-comum/; não se edita aqui), entre os
   marcadores que o verificar-versoes.mjs dela procura nas páginas publicadas:
   <!-- legal-comum:<peça> v<versão> --> … <!-- /legal-comum:<peça> --> */
export const pecaLegal = (nome, html) => `<!-- legal-comum:${nome} v${LEGAL_COMUM_VERSAO} -->${html}<!-- /legal-comum:${nome} -->`;

/* O Livro de Reclamações Eletrónico na variante DISCRETA da biblioteca (ícone e texto, a letra e a cor
   das ligações vizinhas, sem caixa), e só no rodapé. */
export const livroBotao = () => pecaLegal('livro', livroReclamacoes());

// ---------------------------------------------------------------- fotografias
/** O endereço de uma versão web de uma fotografia (scripts/imagens.py). */
export function urlFoto(ctx, nome, largura, fmt = 'webp') {
  const m = ctx.manifesto.fotos[nome] || ctx.manifesto.posters[nome];
  const w = largura ?? m.larguras[m.larguras.length - 1];
  return ctx.asset(`img/${nome}-${m.resumo}-${w}.${fmt}`);
}

/* O sizes de uma fotografia cortada numa moldura (object-fit: cover): uma fotografia mais larga do que a
   moldura mostra-se mais larga do que a caixa (os lados ficam de fora) e precisa de mais píxeis. */
export function escalarSizes(sizes, f) {
  if (!(f > 1.01)) return sizes;
  const partes = [];
  let fundo = 0;
  let atual = '';
  for (const ch of sizes) {
    if (ch === '(') fundo++;
    if (ch === ')') fundo--;
    if (ch === ',' && fundo === 0) { partes.push(atual.trim()); atual = ''; } else atual += ch;
  }
  partes.push(atual.trim());
  const k = f.toFixed(3);
  return partes.map((x) => {
    const m = /^(\([^()]*\))\s+(.+)$/.exec(x);
    return m ? `${m[1]} calc(${m[2]} * ${k})` : `calc(${x} * ${k})`;
  }).join(', ');
}

/* <picture> com AVIF e WebP em várias larguras (só as que a fotografia tem: o imagens.py nunca
   aumenta). «tamanhos» é o atributo sizes (a largura a que a fotografia aparece): é com ele que o
   browser escolhe a versão. Fora do primeiro ecrã, loading="lazy". O ponto de foco
   (content/fotos.json) diz onde se corta quando a moldura é de outra forma. */
export function imagem(ctx, nome, { tamanhos = '100vw', classe = '', prioridade = false, alt, foco, ate = Infinity, moldura = 0, cedo = false } = {}) {
  const m = ctx.manifesto.fotos[nome] || ctx.manifesto.posters[nome];
  if (!m) throw new Error(`imagem «${nome}» não existe em media/fotos`);
  if (moldura) tamanhos = escalarSizes(tamanhos, (m.largura / m.altura) / moldura);
  const info = ctx.fotos[nome] || {};
  const texto = alt ?? info.alt ?? '';
  const ponto = foco ?? info.foco ?? '50% 50%';
  const larguras = m.larguras.filter((w, i) => w <= ate || i === 0 || m.larguras[i - 1] < ate);
  const srcset = (fmt) => larguras.map((w) => `${ctx.asset(`img/${nome}-${m.resumo}-${w}.${fmt}`)} ${w}w`).join(', ');
  const fontes = m.formatos.filter((f) => f !== 'webp').map((f) => `<source type="image/${f}" srcset="${srcset(f)}" sizes="${tamanhos}">`).join('');
  const meio = larguras.find((w) => w >= 720) || larguras[larguras.length - 1];
  const estilo = ponto !== '50% 50%' ? ` style="object-position:${esc(ponto)}"` : '';
  const carga = prioridade ? ' fetchpriority="high"' : cedo ? '' : ' loading="lazy"';
  return `<picture${classe ? ` class="${esc(classe)}"` : ''}>${fontes}<img src="${ctx.asset(`img/${nome}-${m.resumo}-${meio}.webp`)}" srcset="${srcset('webp')}" sizes="${tamanhos}" width="${m.largura}" height="${m.altura}" alt="${esc(texto)}"${carga} decoding="async"${estilo}></picture>`;
}

/* Uma fotografia pequena (as linhas da encomenda, a procura): só a versão de 360. */
export function miniatura(ctx, nome, { lado = 56, classe = '' } = {}) {
  const m = ctx.manifesto.fotos[nome];
  const ponto = ctx.fotos[nome]?.foco || '50% 50%';
  return `<img${classe ? ` class="${esc(classe)}"` : ''} src="${urlFoto(ctx, nome, m.larguras[0])}" width="${lado}" height="${lado}" alt="" loading="lazy" decoding="async"${ponto !== '50% 50%' ? ` style="object-position:${esc(ponto)}"` : ''}>`;
}

// ---------------------------------------------------------------- a marca
/* O logótipo horizontal (o símbolo ao lado do nome), como a cliente o tem: só recortado. «alto» é a
   altura em CSS; «tamanhos» troca o sizes quando a altura muda com o ecrã. */
export function logotipo(ctx, { alto = 40, classe = '', alt = '', prioridade = false, tamanhos = '' } = {}) {
  const m = ctx.manifesto.marca['logo-horizontal'];
  const alturas = Object.keys(m.altura).map(Number).sort((a, b) => a - b);
  const largo = Math.round((m.w * alto) / m.h);
  const src = m.altura[alturas.find((h) => h >= alto * 2) || alturas[alturas.length - 1]];
  const srcset = alturas.map((h) => `${ctx.asset(`img/${m.altura[h].webp}`)} ${m.altura[h].largura}w`).join(', ');
  const carga = prioridade ? ' fetchpriority="high"' : ' loading="lazy"';
  return `<img${classe ? ` class="${esc(classe)}"` : ''} src="${ctx.asset(`img/${src.webp}`)}" srcset="${srcset}" sizes="${tamanhos || `${largo}px`}" width="${largo}" height="${alto}" alt="${esc(alt)}"${carga} decoding="async">`;
}

/* Um ícone da marca (as capas dos destaques do Instagram), decorativo: o texto ao lado diz o que é. */
export function iconeDaMarca(ctx, nome, { lado = 150, classe = '', cedo = false } = {}) {
  const i = ctx.manifesto.icones[nome];
  if (!i) throw new Error(`o ícone «${nome}» não existe em media/icones`);
  return `<picture${classe ? ` class="${esc(classe)}"` : ''}><source type="image/webp" srcset="${ctx.asset(`img/${i.webp}`)}"><img src="${ctx.asset(`img/${i.png}`)}" width="${lado}" height="${lado}" alt=""${cedo ? '' : ' loading="lazy"'} decoding="async"></picture>`;
}

// ---------------------------------------------------------------- preços
/* O preço como se mostra: o de hoje, e o anterior riscado quando há promoção. «Desde» quando o preço
   muda conforme o modelo (precoDesde). Sem preço (ainda não dito): «Preço por confirmar» (no domínio
   aberto o artigo nem chega aqui: as regras escondem-no). */
export function preco(ctx, p, { classe = 'preco', nota = false } = {}) {
  const v = precoDe(p, ctx.hoje);
  if (v.atual === null) return `<p class="${classe} ${classe}--confirmar">Preço por confirmar</p>`;
  const desde = p.precoDesde === true ? '<span class="preco__desde">Desde </span>' : '';
  const n = nota && typeof p.precoNota === 'string' && p.precoNota.trim() ? ` <span class="preco__nota">${esc(p.precoNota.trim())}</span>` : '';
  const atual = `${desde}<span class="preco__valor">${euros(v.atual)}</span>`;
  if (!v.anterior) return `<p class="${classe}">${atual}${n}</p>`;
  return `<p class="${classe} ${classe}--promocao">${atual} <s class="preco__antes"><span class="so-leitor">em vez de </span>${euros(v.anterior)}</s>${n}</p>`;
}

/* A nota legal da promoção, por baixo do preço da ficha (DL 70/2007, art. 5.º): o período e o preço
   mais baixo dos 30 dias anteriores ao início — que é, por lei, o preço riscado. Só com a data de
   início (promocaoDesde). */
export function promocaoNota(ctx, p) {
  const v = precoDe(p, ctx.hoje);
  const desde = typeof p.promocaoDesde === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.promocaoDesde) ? p.promocaoDesde : '';
  if (!v.anterior || !v.ate || !desde) return '';
  const mesmoAno = desde.slice(0, 4) === v.ate.slice(0, 4);
  return `<p class="ficha__promocao">Promoção de ${dataPorExtenso(desde, !mesmoAno)} a ${dataPorExtenso(v.ate, true)} · preço mais baixo nos 30 dias anteriores: ${euros(v.anterior)}</p>`;
}

// ---------------------------------------------------------------- cartões de artigo
/* O CARTÃO DE UM ARTIGO NÃO COMPRA (o Renato, 13 nov 2026): a fotografia, o nome, o preço e a mesma
   setinha num círculo em todos. O cartão inteiro leva à ficha (a ligação do nome estende-se por cima
   dele, ::after); compra-se só na ficha. */
export const TAMANHOS_GRELHA = '(min-width: 1360px) 296px, (min-width: 900px) calc(25vw - 38px), (min-width: 600px) calc(50vw - 34px), calc(50vw - 22px)';
export const TAMANHOS_FILA = '(min-width: 1200px) 262px, (min-width: 860px) calc(28.6vw - 30px), (min-width: 600px) calc(38.5vw - 24px), calc(62.5vw - 18px)';
export function cartao(ctx, p, { titulo = 'h3', tamanhos = TAMANHOS_GRELHA, cedo = false } = {}) {
  return `<li class="produto">
  <div class="produto__foto">${imagem(ctx, p.fotos[0], { tamanhos, cedo, ate: 1280, moldura: 0.8 })}</div>
  <${titulo} class="produto__nome"><a class="produto__ligacao" href="${ctx.url(`/produtos/${p.slug}/`)}">${esc(p.nome)}</a></${titulo}>
  <div class="produto__fim">${preco(ctx, p, { classe: 'produto__preco' })}<span class="produto__seta" aria-hidden="true">${ico('seta')}</span></div>
</li>`;
}
/* «cedo»: quantos cartões, do princípio, estão no primeiro ecrã (sem «lazy»). */
export const grelha = (ctx, lista, { cedo = 0, ...opcoes } = {}) => `<ul class="grelha-produtos" role="list">${lista.map((p, i) => cartao(ctx, p, { ...opcoes, cedo: i < cedo })).join('\n')}</ul>`;

/* Uma fila que desliza (o Natal da página inicial), com as setas no computador. */
export const fila = (ctx, id, lista, opcoes = {}) => `<ul class="fila fila--produtos" id="${esc(id)}" role="list">${lista.map((p) => cartao(ctx, p, { tamanhos: TAMANHOS_FILA, ...opcoes })).join('\n')}</ul>`;
export function setas(id, nome) {
  return `<div class="setas" data-setas-de="${esc(id)}" hidden>
  <button class="seta-botao" type="button" aria-controls="${esc(id)}" aria-label="${esc(`${nome}: anteriores`)}" data-seta="-1">${ico('anterior')}</button>
  <button class="seta-botao" type="button" aria-controls="${esc(id)}" aria-label="${esc(`${nome}: seguintes`)}" data-seta="1">${ico('seguinte')}</button>
</div>`;
}

// ---------------------------------------------------------------- categorias
/* As categorias que têm artigos (as vazias não aparecem em lado nenhum até terem artigos). */
export const categoriasComArtigos = (ctx) => ctx.categorias.filter((c) => ctx.produtos.some((p) => p.categoria === c.slug));

/* Os círculos das categorias (como os destaques do Instagram): o ícone da capa do destaque e o nome. */
export function circulos(ctx, { cedo = false } = {}) {
  return `<ul class="categorias__fila" role="list">${categoriasComArtigos(ctx).map((c) => `<li><a class="categoria" href="${ctx.url(`/loja/${c.slug}/`)}"><span class="categoria__disco">${iconeDaMarca(ctx, c.icone, { cedo })}</span>${esc(c.nome)}</a></li>`).join('')}</ul>`;
}

/* As pastilhas da loja: «Tudo» e cada categoria; a página em que se está fica marcada. */
export function pastilhas(ctx, atual = '') {
  const itens = [{ caminho: '/loja/', nome: 'Tudo' }, ...categoriasComArtigos(ctx).map((c) => ({ caminho: `/loja/${c.slug}/`, nome: c.nome }))];
  return `<nav class="pastilhas" aria-label="Categorias"><ul role="list">${itens.map((i) => `<li><a href="${ctx.url(i.caminho)}"${i.caminho === atual ? ' aria-current="page"' : ''}>${esc(i.nome)}</a></li>`).join('')}</ul></nav>`;
}

// ---------------------------------------------------------------- vídeos
/* Um vídeo dos bastidores (9:16, sem som): toca sozinho só quando está à vista e sem «reduzir
   movimento» (interface.js); o botão pára e retoma. A capa é a do imagens.py. */
export function videoBastidores(ctx, nome, { etiqueta = 'li' } = {}) {
  const v = ctx.videos[nome] || {};
  const poster = ctx.manifesto.posters[`video-${nome}`];
  const capa = poster ? ` poster="${ctx.asset(`img/video-${nome}-${poster.resumo}-${poster.larguras.find((w) => w >= 540) || poster.larguras.at(-1)}.webp`)}"` : '';
  return `<${etiqueta} class="video">
  <figure>
    <div class="video__moldura">
      <video${capa} muted loop playsinline preload="none" data-video aria-label="${esc(`Vídeo sem som: ${v.legenda || ''}`)}"><source src="${ctx.asset(ctx.ficheiros.videos[nome])}" type="video/mp4"></video>
      <button class="video__botao" type="button" aria-label="Reproduzir o vídeo" hidden>${ico('pausa', { classe: 'i-pausa' })}${ico('tocar', { classe: 'i-tocar' })}</button>
    </div>
    <figcaption>${esc(v.legenda || '')}</figcaption>
  </figure>
</${etiqueta}>`;
}

// ---------------------------------------------------------------- cabeças e botões
/* A cabeça de uma página: o título (o h1) e uma frase curta; nas páginas legais, a data. */
export function cabecaDePagina({ titulo, sub = '', data = '', classe = '' }) {
  return `<header class="cabeca-pagina contentor${classe ? ` ${classe}` : ''}">
  <h1>${esc(titulo)}</h1>
  ${sub ? `<div class="cabeca-pagina__sub">${sub}</div>` : ''}
  ${data ? `<p class="cabeca-pagina__data">${esc(data)}</p>` : ''}
</header>`;
}

export function botao(href, texto, { classe = 'botao botao--principal', externo = false } = {}) {
  return `<a class="${classe}" href="${esc(href)}"${externo ? ' target="_blank" rel="noopener"' : ''}>${esc(texto)}</a>`;
}

// ---------------------------------------------------------------- JSON-LD
export function migalhasLd(ctx, itens) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: itens.map((i, n) => ({ '@type': 'ListItem', position: n + 1, name: i.nome, item: ctx.absoluto(i.caminho) })),
  };
}
