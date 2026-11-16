// As páginas do site. Cada função devolve { caminho, titulo, descricao, conteudo, … } e o build.mjs
// veste-a com a moldura (layout.mjs). A página inicial tem a estrutura da proposta B, «Destaques»
// (escolhida pelo dono a 16 nov 2026); as outras são HTML semântico, com o essencial.
import { esc, euros, precoDe, markdown, textoSimples, resumir, numeroWhatsApp, numeroLegivel, notaChamada } from './util.mjs';
import { ico } from './icones.mjs';
import { numeroPortugues, personalizacaoDe, OCASIOES } from '../lib/regras.mjs';
import {
  imagem, preco, promocaoNota, grelha, fila, setas, circulos, pastilhas, cabecaDePagina, migalhasLd, botao,
  urlFoto, iconeDaMarca, videoBastidores, categoriasComArtigos,
} from './componentes.mjs';

const produtosDe = (ctx, cat) => ctx.produtos.filter((p) => p.categoria === cat);
const categoriaDe = (ctx, slug) => ctx.categorias.find((c) => c.slug === slug);
/* Uma ligação escrita no painel (a capa, o aviso) só se usa se a página existir. */
const ligacaoQueExiste = (ctx, c, alternativa = '/loja/') => (c && ctx.existe(c) ? c : alternativa);
/* Os artigos de uma ocasião (o campo «ocasioes»), pela ordem da loja. */
export const produtosDaOcasiao = (ctx, ocasiao) => ctx.produtos.filter((p) => Array.isArray(p.ocasioes) && p.ocasioes.includes(ocasiao));
/* A ocasião da época, quando o destaque está ligado e tem artigos (só então há página e secção). */
export function ocasiaoDaEpoca(ctx) {
  const d = ctx.inicio.destaque || {};
  return d.ligado === true && OCASIOES[d.ocasiao] && produtosDaOcasiao(ctx, d.ocasiao).length ? d.ocasiao : '';
}

// ---------------------------------------------------------------- a loja (JSON-LD)
export function organizacao(ctx) {
  const c = ctx.site.contactos;
  const e = ctx.site.empresa || {};
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Store',
    '@id': ctx.absoluto('/#loja'),
    name: ctx.site.marca,
    description: ctx.site.descricao,
    url: ctx.absoluto('/'),
    logo: ctx.absoluto(`/assets/img/${ctx.manifesto.logo.altura[256].png}`),
    image: ctx.absoluto(`/assets/img/${ctx.manifesto.partilha._site}`),
    currenciesAccepted: 'EUR',
    areaServed: 'PT',
    sameAs: [c.instagram, c.tiktok, c.facebook].filter(Boolean),
  };
  if (ctx.site.assinatura) ld.slogan = ctx.site.assinatura;
  if (e.morada && e.localidade) {
    ld.address = { '@type': 'PostalAddress', streetAddress: e.morada, ...(e.codigoPostal ? { postalCode: e.codigoPostal } : {}), addressLocality: e.localidade, addressCountry: 'PT' };
  }
  if (ctx.site.pagamento) ld.paymentAccepted = ctx.site.pagamento;
  if (c.email) ld.email = c.email;
  const tel = numeroPortugues(c.telefone) || numeroPortugues(c.whatsapp);
  if (tel) ld.telephone = `+351${tel}`;
  if (e.nif) ld.vatID = `PT${String(e.nif).replace(/\D/g, '')}`;
  return ld;
}

// ---------------------------------------------------------------- página inicial
/* A PÁGINA INICIAL (a proposta B): a capa num cartão grande de cantos redondos, com o texto num painel
   creme (por cima do canto de baixo, à esquerda, no computador; por baixo no telemóvel); as categorias
   em círculos, logo a seguir (como os destaques do Instagram); o Natal numa fila com setas; «Feitos esta
   semana» em grelha; a história com as duas fotografias; os bastidores numa fila de vídeos 9:16; e
   «Como encomendar» em quatro cartões. Tudo vem de content/inicio.json. */
export function inicio(ctx) {
  const h = ctx.inicio;
  const c = h.capa || {};
  const fundoCapa = c.video && ctx.ficheiros.videos[c.video]
    ? (() => {
      const poster = ctx.manifesto.posters[`video-${c.video}`];
      return `<video class="capa__video" muted loop playsinline autoplay preload="metadata" data-video${poster ? ` poster="${ctx.asset(`img/video-${c.video}-${poster.resumo}-${poster.larguras.at(-1)}.webp`)}"` : ''} aria-label="${esc(`Vídeo sem som: ${ctx.videos[c.video]?.legenda || ''}`)}"><source src="${ctx.asset(ctx.ficheiros.videos[c.video])}" type="video/mp4"></video>`;
    })()
    : imagem(ctx, c.foto, { classe: 'capa__foto', tamanhos: '(min-width: 1360px) 922px, (min-width: 960px) calc(72vw - 58px), calc(100vw - 32px)', prioridade: true, ate: 1600 });
  const botoes = [c.botao, c.botao2].filter((b) => b && b.texto);
  const capa = `<section class="capa contentor" aria-labelledby="capa-titulo">
  <div class="capa__cartao">${fundoCapa}</div>
  <div class="capa__painel">
    <h1 id="capa-titulo">${esc(c.titulo)}</h1>
    ${c.texto ? `<p>${esc(c.texto)}</p>` : ''}
    <div class="capa__botoes">${botoes.map((b, i) => botao(ctx.url(ligacaoQueExiste(ctx, b.ligacao)), b.texto, { classe: `botao ${i === 0 ? 'botao--principal' : 'botao--suave'}` })).join('')}</div>
  </div>
</section>`;

  const categorias = categoriasComArtigos(ctx).length ? `<section class="categorias contentor" aria-labelledby="categorias-titulo">
  <h2 class="so-leitor" id="categorias-titulo">${esc(h.categorias?.titulo || 'O que fazemos')}</h2>
  ${circulos(ctx, { cedo: true })}
</section>` : '';

  const o = ocasiaoDaEpoca(ctx);
  const d = h.destaque || {};
  const listaD = o ? produtosDaOcasiao(ctx, o).slice(0, 10) : [];
  const destaque = o ? `<section class="seccao destaque" aria-labelledby="destaque-titulo">
  <div class="seccao__cabeca contentor">
    <div>
      <h2 id="destaque-titulo">${esc(d.titulo)}</h2>
      ${d.texto ? `<p>${esc(d.texto)}</p>` : ''}
      <a class="ligacao-seta" href="${ctx.url(`/${o}/`)}"><span>Ver tudo</span>${ico('seta')}</a>
    </div>
    ${setas('fila-destaque', d.titulo)}
  </div>
  ${fila(ctx, 'fila-destaque', listaD)}
</section>` : '';

  /* As novidades: as marcadas «novidade», sem as que já estão na fila da época (a mesma peça duas
     vezes na mesma página é informação repetida). */
  const n = h.novidades || {};
  const naFila = new Set(listaD.map((p) => p.slug));
  const listaN = ctx.produtos.filter((p) => p.novidade === true && !naFila.has(p.slug)).slice(0, Number.isInteger(n.quantas) ? n.quantas : 8);
  const novidades = listaN.length ? `<section class="seccao novidades contentor" aria-labelledby="novidades-titulo">
  <div class="seccao__cabeca"><h2 id="novidades-titulo">${esc(n.titulo)}</h2></div>
  ${grelha(ctx, listaN)}
</section>` : '';

  const hi = h.historia || {};
  const [f1, f2] = Array.isArray(hi.fotos) ? hi.fotos : [];
  const historia = hi.titulo ? `<section class="seccao historia contentor" aria-labelledby="historia-titulo">
  <div class="historia__fotos">
    ${f1 && ctx.manifesto.fotos[f1] ? imagem(ctx, f1, { classe: 'historia__foto', tamanhos: '(min-width: 1360px) 616px, (min-width: 1080px) calc(51vw - 80px), calc(100vw - 32px)', ate: 1280, moldura: 1 }) : ''}
    ${f2 && ctx.manifesto.fotos[f2] ? imagem(ctx, f2, { classe: 'historia__foto2', tamanhos: '(min-width: 1080px) 222px, 38vw', ate: 720, moldura: 0.9 }) : ''}
  </div>
  <div class="historia__texto">
    <h2 id="historia-titulo">${esc(hi.titulo)}</h2>
    <p>${esc(hi.texto)}</p>
    ${hi.citacao ? `<figure class="citacao"><blockquote><p>${esc(hi.citacao)}</p></blockquote>${hi.autor ? `<figcaption>${esc(hi.autor)}</figcaption>` : ''}</figure>` : ''}
    ${ctx.existe('/a-nossa-historia/') ? botao(ctx.url('/a-nossa-historia/'), hi.botao || 'Ler a história', { classe: 'botao botao--suave' }) : ''}
  </div>
</section>` : '';

  const b = h.bastidores || {};
  const vids = (Array.isArray(b.videos) ? b.videos : []).filter((v) => ctx.ficheiros.videos[v]).slice(0, 8);
  const bastidores = vids.length ? `<section class="seccao bastidores contentor" aria-labelledby="bastidores-titulo">
  <div class="bastidores__texto">
    <h2 id="bastidores-titulo">${esc(b.titulo)}</h2>
    ${b.texto ? `<p>${esc(b.texto)}</p>` : ''}
  </div>
  <ul class="fila fila--videos" role="list">${vids.map((v) => videoBastidores(ctx, v)).join('\n')}</ul>
</section>` : '';

  const ce = h.comoEncomendar || {};
  const itens = (Array.isArray(ce.itens) ? ce.itens : []).filter((x) => x && x.titulo).slice(0, 4);
  const encomendar = itens.length ? `<section class="seccao encomendar contentor" aria-labelledby="encomendar-titulo">
  <div class="seccao__cabeca"><h2 id="encomendar-titulo">${esc(ce.titulo)}</h2></div>
  <ul class="passos" role="list">
    ${itens.map((x) => `<li class="passo">${ctx.manifesto.icones[x.icone] ? iconeDaMarca(ctx, x.icone, { classe: 'passo__icone' }) : ''}<div><h3>${esc(x.titulo)}</h3><p>${esc(x.texto)}</p></div></li>`).join('\n    ')}
  </ul>
</section>` : '';

  return {
    caminho: '/',
    titulo: h.seo?.titulo || ctx.site.marca,
    descricao: h.seo?.descricao || ctx.site.descricao,
    classe: 'pagina-inicio',
    jsonld: [
      { '@context': 'https://schema.org', '@type': 'WebSite', '@id': ctx.absoluto('/#site'), name: ctx.site.marca, alternateName: 'Flores e Essências', url: ctx.absoluto('/'), inLanguage: 'pt-PT', publisher: { '@id': ctx.absoluto('/#loja') } },
      organizacao(ctx),
    ],
    conteudo: [capa, categorias, destaque, novidades, historia, bastidores, encomendar].filter(Boolean).join('\n\n'),
  };
}

// ---------------------------------------------------------------- loja e categorias
/* A loja (/loja/): todos os artigos. Cada categoria com artigos tem a sua página (/loja/<slug>/).
   As pastilhas em cima e, por baixo, o painel (o título, a frase e os artigos): as pastilhas trocam só
   o painel, sem a página sair do sítio (loja.js, que o vai buscar à página da categoria). */
export function loja(ctx, slug = null) {
  const c = slug ? categoriaDe(ctx, slug) : null;
  const lista = c ? produtosDe(ctx, slug) : ctx.produtos;
  const caminho = c ? `/loja/${c.slug}/` : '/loja/';
  const conteudo = `<div class="loja contentor">
  ${pastilhas(ctx, caminho)}
  <div class="loja__painel" data-loja-painel>
    <div class="loja__cabeca">
      <h1>${esc(c ? c.nome : 'Loja')}</h1>
      <p>${esc(c ? c.frase : 'Arranjos, velas, wax melts e lembranças em cera perfumada, e as peças 3D do Martim.')}</p>
    </div>
    ${grelha(ctx, lista, { titulo: 'h2', cedo: 4 })}
  </div>
  <p class="so-leitor" aria-live="polite" data-loja-anuncio></p>
</div>`;
  return {
    caminho,
    titulo: c ? c.titulo : 'Loja: arranjos, velas e lembranças em cera perfumada',
    descricao: resumir(c ? `${c.frase} Feitos à mão pelo Martim, com óleos essenciais; encomendas pelo WhatsApp.` : `${ctx.site.descricao} Encomendas pelo WhatsApp.`),
    jsonld: [
      migalhasLd(ctx, [{ nome: 'Início', caminho: '/' }, { nome: 'Loja', caminho: '/loja/' }, ...(c ? [{ nome: c.nome, caminho }] : [])]),
      { '@context': 'https://schema.org', '@type': 'ItemList', name: c ? c.nome : 'Loja', itemListElement: lista.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: ctx.absoluto(`/produtos/${p.slug}/`), name: p.nome })) },
    ],
    conteudo,
  };
}

/* A página da ocasião da época (/natal/): os artigos dessa ocasião, com o título e o texto do destaque
   da página inicial. Só existe enquanto o destaque está ligado. */
export function ocasiao(ctx, o) {
  const d = ctx.inicio.destaque || {};
  const lista = produtosDaOcasiao(ctx, o);
  const caminho = `/${o}/`;
  const conteudo = `<div class="loja contentor">
  <div class="loja__cabeca">
    <h1>${esc(d.titulo || OCASIOES[o])}</h1>
    ${d.texto ? `<p>${esc(d.texto)}</p>` : ''}
  </div>
  ${grelha(ctx, lista, { titulo: 'h2', cedo: 4 })}
</div>`;
  return {
    caminho,
    titulo: `${OCASIOES[o]}: arranjos, velas e lembranças em cera perfumada`,
    descricao: resumir(`${d.texto || ''} ${lista.length} peças feitas à mão pelo Martim, com óleos essenciais. Encomendas pelo WhatsApp.`),
    jsonld: [
      migalhasLd(ctx, [{ nome: 'Início', caminho: '/' }, { nome: OCASIOES[o], caminho }]),
      { '@context': 'https://schema.org', '@type': 'ItemList', name: OCASIOES[o], itemListElement: lista.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: ctx.absoluto(`/produtos/${p.slug}/`), name: p.nome })) },
    ],
    conteudo,
  };
}

// ---------------------------------------------------------------- ficha do artigo
/* O fabricante de um artigo, quando o painel o diz por inteiro (nome, morada e email); senão null,
   e a ficha diz quem vende (Regulamento (UE) 2023/988, art. 19.º). */
export function fabricanteDoArtigo(p) {
  const f = p.fabricante;
  if (!f || typeof f !== 'object') return null;
  const ok = ['nome', 'morada', 'email'].every((k) => typeof f[k] === 'string' && f[k].trim());
  return ok ? { nome: f.nome.trim(), morada: f.morada.trim(), email: f.email.trim() } : null;
}
/* Os avisos de segurança (e os perigos) de um artigo: um por linha do campo. */
const linhasDe = (v) => String(typeof v === 'string' ? v : '').split(/\n+/).map((t) => t.trim()).filter(Boolean);
export const avisosDoArtigo = (p) => linhasDe(p.avisos);
export const perigosDoArtigo = (p) => linhasDe(p.perigos);

/* O formulário de «juntar à encomenda» da ficha: as escolhas que a peça deixa fazer (o nome, as cores,
   o aroma) e o botão. A quantidade muda-se na encomenda. */
export function formulario(ctx, p) {
  const id = (k) => `pz-${k}`;
  const campos = personalizacaoDe(p);
  const AJUDA = { cores: 'As da fotografia', aroma: 'Ex.: canela' };
  const marca = (k) => (k.obrigatorio ? ' <span class="campo__obrig" aria-hidden="true">*</span>' : '');
  const linhas = campos.map((k) => `<div class="campo">
      <label for="${id(k.id)}">${esc(k.rotulo)}${marca(k)}</label>
      <input id="${id(k.id)}" name="pers-${k.id}" type="text" maxlength="${k.id === 'nome' ? 40 : 60}" autocomplete="off"${k.id === 'nome' ? ' autocapitalize="words"' : ''} spellcheck="false"${AJUDA[k.id] ? ` placeholder="${esc(AJUDA[k.id])}"` : ''}${k.obrigatorio ? ' required' : ''}>
    </div>`).join('\n    ');
  return `<form class="juntar" data-juntar-form="${esc(p.slug)}" novalidate>
    ${campos.length ? `<fieldset class="juntar__escolhas"><legend>Escolhas</legend>
    ${linhas}
    </fieldset>` : ''}
    <p class="juntar__erro" data-erro role="alert" hidden></p>
    <button class="botao botao--principal botao--largo" type="submit">${ico('saco')}<span>Juntar à encomenda</span></button>
  </form>`;
}

export function produto(ctx, p) {
  const c = categoriaDe(ctx, p.categoria);
  const caminho = `/produtos/${p.slug}/`;
  const v = precoDe(p, ctx.hoje);
  const nome = esc(p.nome);

  // a galeria: as fotografias deslizam de lado, e as miniaturas escolhem; o vídeo, se houver, no fim
  const fotos = p.fotos.filter((f) => ctx.manifesto.fotos[f]);
  const temVideo = Boolean(p.video && ctx.ficheiros.videos[p.video]);
  const itens = fotos.length + (temVideo ? 1 : 0);
  const tamanhos = '(min-width: 1360px) 620px, (min-width: 860px) calc(50vw - 60px), calc(100vw - 32px)';
  const galeria = `<div class="ficha__galeria" data-galeria>
    <div class="ficha__pista"${itens > 1 ? ` tabindex="0" role="region" aria-label="Fotografias de ${nome}"` : ''}>
      ${fotos.map((f, i) => `<figure class="ficha__foto">${imagem(ctx, f, { tamanhos, prioridade: i === 0, moldura: 0.8 })}</figure>`).join('\n      ')}
      ${temVideo ? `<figure class="ficha__foto ficha__foto--video">${videoFicha(ctx, p)}</figure>` : ''}
    </div>
    ${itens > 1 ? `<ul class="ficha__miniaturas" role="list">${fotos.map((f, i) => `<li><button type="button" data-foto="${i}"${i === 0 ? ' aria-current="true"' : ''} aria-label="Fotografia ${i + 1} de ${itens}"><img src="${urlFoto(ctx, f, ctx.manifesto.fotos[f].larguras[0])}" width="64" height="64" alt="" loading="lazy" decoding="async"></button></li>`).join('')}${temVideo ? `<li><button type="button" data-foto="${fotos.length}" aria-label="O vídeo"><span class="ficha__mini-video">${ico('tocar')}</span></button></li>` : ''}</ul>` : ''}
  </div>`;

  /* A informação legal do artigo, só quando está preenchida: avisos de segurança e perigos (um por
     linha), a idade recomendada, «Não é um brinquedo» e a referência. */
  const avisos = avisosDoArtigo(p);
  const perigos = perigosDoArtigo(p);
  const infoLegal = avisos.length || perigos.length || p.idade || p.naoBrinquedo === true || p.referencia ? `<div class="ficha__legal">
      ${avisos.length ? `<p class="ficha__legal-titulo">Avisos de segurança</p><ul role="list">${avisos.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
      ${perigos.length ? `<p class="ficha__legal-titulo">Perigos</p><ul role="list">${perigos.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
      ${p.idade ? `<p><strong>Idade recomendada:</strong> ${esc(p.idade)}</p>` : ''}
      ${p.naoBrinquedo === true ? '<p>Não é um brinquedo.</p>' : ''}
      ${p.referencia ? `<p><strong>Referência:</strong> ${esc(p.referencia)}</p>` : ''}
    </div>` : '';

  const conteudo = `<section class="ficha contentor">
  ${galeria}
  <div class="ficha__info">
    ${c ? `<a class="ficha__categoria" href="${ctx.url(`/loja/${c.slug}/`)}">${esc(c.nome)}</a>` : ''}
    <h1 class="ficha__nome">${nome}</h1>
    ${preco(ctx, p, { classe: 'ficha__preco', nota: true })}
    ${promocaoNota(ctx, p)}
    <p class="ficha__descricao">${esc(p.descricao)}</p>
    ${infoLegal}
    ${formulario(ctx, p)}
    <noscript><p class="nota">A encomenda precisa de JavaScript. Podes sempre encomendar pelo <a href="${ctx.whatsapp(`Olá! Gostava de encomendar: ${p.nome}.`)}">WhatsApp</a>.</p></noscript>
    <ul class="ficha__linhas" role="list">
      <li>${ctx.linhaEntrega()}</li>
      <li>${ctx.linhaFeitoAMao(p)}</li>
    </ul>
  </div>
</section>`;

  const personalizada = personalizacaoDe(p).length > 0;
  const imagens = fotos.slice(0, 4).map((f) => ctx.absoluto(`/assets/img/${f}-${ctx.manifesto.fotos[f].resumo}-${ctx.manifesto.fotos[f].larguras.at(-1)}.webp`));
  const ldProduto = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.nome,
    description: p.descricao,
    image: imagens,
    brand: { '@type': 'Brand', name: ctx.site.marca },
    category: c ? c.nome : undefined,
    url: ctx.absoluto(caminho),
  };
  if (p.referencia) ldProduto.sku = p.referencia;
  if (v.atual !== null) {
    const devolucao = personalizada
      ? { '@type': 'MerchantReturnPolicy', applicableCountry: 'PT', returnPolicyCategory: 'https://schema.org/MerchantReturnNotPermitted' }
      : { '@type': 'MerchantReturnPolicy', applicableCountry: 'PT', returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow', merchantReturnDays: 14, returnMethod: 'https://schema.org/ReturnByMail', returnFees: 'https://schema.org/ReturnFeesCustomerResponsibility' };
    ldProduto.offers = p.precoDesde === true
      ? { '@type': 'AggregateOffer', priceCurrency: 'EUR', lowPrice: v.atual.toFixed(2), offerCount: 1, availability: 'https://schema.org/MadeToOrder', url: ctx.absoluto(caminho) }
      : {
        '@type': 'Offer',
        url: ctx.absoluto(caminho),
        priceCurrency: 'EUR',
        price: v.atual.toFixed(2),
        availability: 'https://schema.org/MadeToOrder', // tudo é feito por encomenda
        itemCondition: 'https://schema.org/NewCondition',
        seller: { '@id': ctx.absoluto('/#loja') },
        hasMerchantReturnPolicy: devolucao,
        ...(v.ate ? { priceValidUntil: v.ate } : {}),
      };
  }
  return {
    caminho,
    titulo: p.nome,
    descricao: resumir(`${p.descricao}${v.atual !== null ? ` ${p.precoDesde ? 'Desde ' : ''}${euros(v.atual)}.` : ''} Feito pelo Martim; encomendas pelo WhatsApp.`, 160),
    tipo: 'product',
    partilha: ctx.manifesto.partilha[p.slug],
    jsonld: [migalhasLd(ctx, [{ nome: 'Início', caminho: '/' }, { nome: 'Loja', caminho: '/loja/' }, ...(c ? [{ nome: c.nome, caminho: `/loja/${c.slug}/` }] : []), { nome: p.nome, caminho }]), ldProduto],
    conteudo,
  };
}

function videoFicha(ctx, p) {
  const poster = ctx.manifesto.posters[`video-${p.video}`];
  const posterUrl = poster ? ` poster="${ctx.asset(`img/video-${p.video}-${poster.resumo}-${poster.larguras.at(-1)}.webp`)}"` : '';
  return `<video controls muted playsinline preload="none"${posterUrl}${poster ? ` width="${poster.largura}" height="${poster.altura}"` : ''} aria-label="Vídeo sem som: ${esc(p.nome)}"><source src="${ctx.asset(ctx.ficheiros.videos[p.video])}" type="video/mp4"></video>`;
}

// ---------------------------------------------------------------- a encomenda
/* A ENCOMENDA (o saco do cabeçalho). Não há pagamentos no site: as peças (com as escolhas), as
   quantidades, a entrega, o nome e a morada seguem pelo WhatsApp, numa mensagem já escrita
   (carrinho.js). Antes do botão, o que a lei pede que se saiba antes de encomendar (DL 24/2014,
   art. 4.º): o prazo, o pagamento, os portes e que as peças personalizadas não têm livre resolução. */
export function encomenda(ctx) {
  const en = ctx.site.entrega || {};
  const zonas = en.zonas || [];
  const precoZona = (z) => (z.morada ? (Number.isFinite(en.portes?.[z.id]) ? euros(en.portes[z.id]) : 'portes a confirmar') : 'sem portes');
  const temTermos = ctx.existe('/termos-e-condicoes/');
  const obrig = '<span class="campo__obrig" aria-hidden="true">*</span>';
  const conteudo = `${cabecaDePagina({ titulo: 'A tua encomenda' })}
<section class="encomenda contentor" data-encomenda>
  <div class="encomenda__grelha" data-encomenda-cheia hidden>
    <div class="encomenda__pecas">
      <h2 class="so-leitor" id="t-pecas">As peças</h2>
      <ul class="linhas" role="list" aria-labelledby="t-pecas" data-linhas></ul>
      <a class="ligacao-seta" href="${ctx.url('/loja/')}">${ico('voltar')}<span>Continuar a ver a loja</span></a>
    </div>
    <form class="encomenda__form" data-encomenda-form novalidate>
      <div data-por-enviar>
        <h2 class="encomenda__titulo" id="t-encomenda" tabindex="-1">Entrega e dados</h2>
        <fieldset class="entregas">
          <legend>Como queres receber?</legend>
          ${zonas.map((z, i) => `<label class="entrega"><input type="radio" name="zona" value="${esc(z.id)}"${i === 0 ? ' checked' : ''}><span class="entrega__nome">${esc(z.nome)}</span><span class="entrega__preco">${precoZona(z)}</span></label>`).join('\n          ')}
        </fieldset>
        ${zonas.some((z) => !z.morada) ? `<p class="campo__ajuda" data-so-em-mao>${ctx.textoEmMao()}</p>` : ''}
        ${en.portesNota ? `<p class="campo__ajuda" data-so-portes-a-confirmar hidden>${esc(en.portesNota)}</p>` : ''}
        <div class="campo"><label for="e-nome">O teu nome ${obrig}</label><input id="e-nome" name="nome" type="text" autocomplete="name" required maxlength="80"></div>
        <div data-so-envio hidden>
          <div class="campo"><label for="e-morada">Morada ${obrig}</label><input id="e-morada" name="morada" type="text" autocomplete="address-line1" maxlength="160" data-obrigatorio-envio></div>
          <div class="campos-lado">
            <div class="campo"><label for="e-cp">Código postal ${obrig}</label><input id="e-cp" name="codigoPostal" type="text" inputmode="numeric" autocomplete="postal-code" maxlength="12" data-obrigatorio-envio></div>
            <div class="campo"><label for="e-local">Localidade ${obrig}</label><input id="e-local" name="localidade" type="text" autocomplete="address-level2" maxlength="60" data-obrigatorio-envio></div>
          </div>
        </div>
        <dl class="resumo" data-resumo aria-live="polite"></dl>
        <ul class="antes" role="list" aria-label="Antes de encomendar">
          <li><strong>Prazo:</strong> ${en.prazo ? esc(en.prazo) : ctx.marcador('quanto tempo leva a fazer e a entregar')}</li>
          <li><strong>Pagamento:</strong> ${ctx.site.pagamento ? esc(ctx.site.pagamento) : ctx.marcador('as formas de pagamento')}</li>
          <li>As peças feitas à tua medida (com um nome, ou com as cores e o aroma que pedires) não têm direito de livre resolução.${temTermos ? ` <a href="${ctx.url('/termos-e-condicoes/')}">Termos e condições</a>` : ''}</li>
        </ul>
        <p class="juntar__erro" data-erro-encomenda role="alert" hidden></p>
        <button class="botao botao--principal botao--largo" type="submit">${ico('whatsapp')}<span>Encomendar pelo WhatsApp</span></button>
        <p class="encomenda__nota">A encomenda fica feita quando a confirmarmos contigo pelo WhatsApp.</p>
      </div>
      <div class="enviada" data-enviada hidden>
        <h2 class="encomenda__titulo" id="t-enviada" tabindex="-1">Encomenda enviada</h2>
        <p>Abrimos o WhatsApp com a tua encomenda<span data-enviada-quando></span>. Se ainda não a enviaste, podes enviá-la agora: respondemos a confirmar.</p>
        <a class="botao botao--principal botao--largo" href="${ctx.whatsapp('')}" target="_blank" rel="noopener" data-continuar>${ico('whatsapp')}<span>Abrir o WhatsApp</span></a>
        <button class="botao botao--principal botao--largo" type="button" data-reenviar hidden>${ico('whatsapp')}<span>Enviar outra vez</span></button>
        <div class="enviada__mais">
          <button class="botao botao--suave" type="button" data-alterar>Alterar a encomenda</button>
          <button class="botao botao--texto" type="button" data-esvaziar>Fazer outra encomenda</button>
        </div>
      </div>
    </form>
  </div>
  <div class="vazio" data-encomenda-vazia hidden>
    <p class="vazio__titulo" tabindex="-1">A encomenda está vazia.</p>
    ${botao(ctx.url('/loja/'), 'Ver a loja')}
  </div>
  <p class="vazio" data-encomenda-carregar>A abrir a encomenda…</p>
  <noscript><p class="nota">A encomenda precisa de JavaScript. Podes sempre encomendar pelo <a href="${ctx.whatsapp('Olá! Gostava de fazer uma encomenda.')}">WhatsApp</a>.</p></noscript>
</section>`;
  return { caminho: '/encomenda/', titulo: 'A tua encomenda', descricao: 'Revê as peças, escolhe a entrega e envia-nos a encomenda pelo WhatsApp.', conteudo, classe: 'pagina-encomenda', indexar: false };
}

// ---------------------------------------------------------------- páginas de texto
/* As páginas de texto (content/paginas/*.md): a cabeça (o título e uma frase; nas legais, a data) e o
   texto numa coluna confortável de ler. O modelo «passos» (como encomendar) põe os passos numerados
   numa lista e o resto em notas; o «historia» deixa as fotografias e os vídeos ocupar mais largura. */
function seccoes(html) {
  const partes = html.split(/(?=<h2[ >])/);
  const intro = partes.length && !partes[0].startsWith('<h2') ? partes.shift().trim() : '';
  return { intro, lista: partes.map((x) => {
    const m = /^<h2(?: id="([^"]*)")?>([\s\S]*?)<\/h2>([\s\S]*)$/.exec(x.trim());
    return m ? { id: m[1] || '', titulo: m[2], corpo: m[3].trim() } : { id: '', titulo: '', corpo: x };
  }) };
}
function comoPassos(html) {
  const { intro, lista } = seccoes(html);
  const numerado = (x) => /^\d+\.\s/.test(textoSimples(x.titulo));
  const passos = lista.filter(numerado);
  const notas = lista.filter((x) => !numerado(x) && x.corpo.replace(/<[^>]+>/g, '').trim());
  return `${intro ? `<div class="prosa">${intro}</div>` : ''}
    <ol class="etapas" role="list">${passos.map((x, i) => `<li class="etapa"><span class="etapa__numero" aria-hidden="true">${i + 1}</span><div class="prosa"><h2 id="${x.id}">${x.titulo.replace(/^\d+\.\s*/, '')}</h2>${x.corpo}</div></li>`).join('')}</ol>
    ${notas.length ? `<div class="notas">${notas.map((x) => `<section class="nota-cartao prosa"><h2 id="${x.id}">${x.titulo}</h2>${x.corpo}</section>`).join('')}</div>` : ''}`;
}

export function texto(ctx, pag) {
  const legal = Boolean(pag.atualizado);
  const data = legal ? `Atualizado a ${new Date(`${pag.atualizado}T12:00:00Z`).toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Lisbon' })}` : '';
  const corpo = pag.modelo === 'passos' ? comoPassos(pag.html) : `<div class="prosa">${pag.html}</div>`;
  const conteudo = `${cabecaDePagina({ titulo: pag.titulo, sub: pag.subtitulo ? `<p>${esc(pag.subtitulo)}</p>` : '', data })}
<article class="leitura contentor${pag.modelo ? ` leitura--${esc(pag.modelo)}` : ''}">
  ${corpo}
</article>`;
  return {
    caminho: pag.caminho,
    titulo: pag.tituloSeo || pag.titulo,
    descricao: resumir(pag.descricao || textoSimples(pag.html.replace(/<[^>]+>/g, ' '))),
    indexar: pag.indexar,
    jsonld: [migalhasLd(ctx, [{ nome: 'Início', caminho: '/' }, { nome: pag.titulo, caminho: pag.caminho }])],
    classe: `pagina-texto${legal ? ' pagina-legal' : ''}`,
    conteudo,
  };
}

/* Os contactos: o WhatsApp à cabeça (é por lá que se combinam as encomendas; só a ligação, sem o
   número), e os outros caminhos numa lista. O telefone com a nota da chamada, pequena e entre
   parênteses (DL 59/2021). Por baixo, numa linha discreta, quem vende (DL 7/2004, art. 10.º): no
   rodapé nunca. */
export function contactos(ctx) {
  const c = ctx.site.contactos;
  const tel = numeroPortugues(c.telefone);
  const linha = (icone, titulo, corpo) => `<li class="contacto"><span class="contacto__icone">${ico(icone)}</span><div><h2>${titulo}</h2>${corpo}</div></li>`;
  const outros = [];
  if (tel) outros.push(linha('telefone', 'Telefone', `<p><a href="tel:+351${tel}">${esc(numeroLegivel(tel))}</a> ${notaChamada(tel)}</p>`));
  outros.push(linha('carta', 'Email', `<p>${c.email ? `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : ctx.marcador('o email')}</p>`));
  if (c.instagram) outros.push(linha('instagram', 'Instagram', `<p><a href="${esc(c.instagram)}" target="_blank" rel="noopener">@${esc(c.instagram.replace(/\/$/, '').split('/').pop())}</a></p>`));
  if (c.tiktok) outros.push(linha('tiktok', 'TikTok', `<p><a href="${esc(c.tiktok)}" target="_blank" rel="noopener">${esc(c.tiktok.replace(/\/$/, '').split('/').pop())}</a></p>`));
  if (c.facebook) outros.push(linha('facebook', 'Facebook', `<p><a href="${esc(c.facebook)}" target="_blank" rel="noopener">${esc(ctx.site.marca)}</a></p>`));
  const principal = c.whatsapp ? `<div class="contactos__principal">
    <h2>WhatsApp</h2>
    <p>É por aqui que combinamos as encomendas.</p>
    <a class="botao botao--principal" href="https://wa.me/${numeroWhatsApp(c.whatsapp)}" target="_blank" rel="noopener">${ico('whatsapp')}<span>Enviar mensagem</span></a>
  </div>` : '';
  const conteudo = `${cabecaDePagina({ titulo: 'Contactos', sub: '<p>Fala connosco como preferires.</p>' })}
<section class="contactos contentor">
  ${principal}
  <ul class="contactos__lista" role="list">${outros.join('')}</ul>
  <p class="contactos__quem">Quem vende: ${ctx.identificacaoCurta()}</p>
</section>`;
  return {
    caminho: '/contactos/',
    titulo: 'Contactos',
    descricao: resumir(`Fala com a ${ctx.site.marca}: WhatsApp${tel ? ', telefone' : ''}${c.email ? ', email' : ''} e Instagram. Encomendas pelo WhatsApp; entregas em mão ou pelos CTT.`),
    jsonld: [migalhasLd(ctx, [{ nome: 'Início', caminho: '/' }, { nome: 'Contactos', caminho: '/contactos/' }])],
    conteudo,
  };
}

export function erro404(ctx) {
  const conteudo = `${cabecaDePagina({ titulo: 'Esta página não existe', sub: '<p>Pode ter mudado de sítio, ou o endereço tem um erro.</p>' })}
<section class="categorias contentor" aria-label="Categorias">
  ${circulos(ctx)}
  <p class="erro__fim">${botao(ctx.url('/loja/'), 'Ver a loja')}</p>
</section>`;
  return { caminho: '/404.html', titulo: 'Página não encontrada', descricao: 'Esta página não existe.', conteudo, indexar: false };
}
