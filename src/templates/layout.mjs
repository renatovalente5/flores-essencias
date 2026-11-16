// A moldura de todas as páginas (a da proposta B, «Destaques»): UM SÓ CABEÇALHO, claro e preso em cima
// (o logótipo, Loja, A nossa história, Contactos, a lupa e o saco; no telemóvel, o menu de ecrã
// inteiro, fora do cabeçalho), a faixa do aviso (só com uma campanha), o rodapé na faixa terracota (a
// marca com o logótipo em branco e três colunas: Loja, Ajuda e «Fala connosco»; em baixo o «©», os Termos, a
// Privacidade e o Livro de Reclamações discreto), a procura
// numa folha e o recado de «juntou-se à encomenda».
import { esc, numeroWhatsApp } from './util.mjs';
import { sprite, ico } from './icones.mjs';
import { logotipo, livroBotao, categoriasComArtigos } from './componentes.mjs';

const wa = (ctx) => (ctx.site.contactos.whatsapp ? `https://wa.me/${numeroWhatsApp(ctx.site.contactos.whatsapp)}` : '');

/* As três ligações do cabeçalho (e do menu do telemóvel). «Loja» fica marcada também nas categorias
   e nas fichas (aria-current="true": a secção, não a página). */
const PRINCIPAIS = [['/loja/', 'Loja'], ['/a-nossa-historia/', 'A nossa história'], ['/contactos/', 'Contactos']];
function marca(caminho, alvo) {
  if (caminho === alvo) return ' aria-current="page"';
  if (alvo === '/loja/' && (caminho.startsWith('/loja/') || caminho.startsWith('/produtos/'))) return ' aria-current="true"';
  return '';
}

/* O aviso do topo (content/site.json, «aviso»): uma faixa fina por baixo do cabeçalho, só com uma
   campanha, até ao dia que a dona escolher (o interface.js esconde-a no dia seguinte, mesmo sem
   publicar). */
function aviso(ctx) {
  const a = ctx.site.aviso || {};
  if (!a.texto || (a.ate && ctx.hoje > a.ate)) return '';
  const texto = esc(a.texto);
  const destino = a.ligacao && ctx.existe(a.ligacao) ? a.ligacao : '';
  return `<div class="aviso"${a.ate ? ` data-ate="${esc(a.ate)}"` : ''}><p class="contentor">${destino ? `<a href="${ctx.url(destino)}">${texto}</a>` : texto}</p></div>`;
}

function cabecalho(ctx, caminho) {
  const nome = ctx.site.marca;
  return `<header class="topo" id="topo">
  <div class="topo__barra contentor">
    <a class="topo__marca" href="${ctx.url('/')}"${caminho === '/' ? ' aria-current="page"' : ''}>${logotipo(ctx, { peca: 'logo-horizontal-cabecalho', alto: 50, classe: 'topo__logo', alt: `${nome} — página inicial`, prioridade: true, tamanhos: `(min-width: 860px) ${Math.round((ctx.manifesto.marca['logo-horizontal-cabecalho'].w * 50) / ctx.manifesto.marca['logo-horizontal-cabecalho'].h)}px, ${Math.round((ctx.manifesto.marca['logo-horizontal-cabecalho'].w * 40) / ctx.manifesto.marca['logo-horizontal-cabecalho'].h)}px` })}</a>
    <nav class="topo__nav" aria-label="Principal">
      <ul role="list">
        ${PRINCIPAIS.filter(([c]) => ctx.existe(c)).map(([c, t]) => `<li><a href="${ctx.url(c)}"${marca(caminho, c)}>${esc(t)}</a></li>`).join('\n        ')}
      </ul>
    </nav>
    <div class="topo__accoes">
      <button class="botao-icone" type="button" id="abrir-procura" aria-label="Procurar" aria-haspopup="dialog" aria-controls="procura" aria-expanded="false">${ico('lupa')}</button>
      <a class="botao-icone saco" href="${ctx.url('/encomenda/')}" id="saco" aria-label="A encomenda"${caminho === '/encomenda/' ? ' aria-current="page"' : ''}>${ico('saco')}<span class="saco__n" data-conta hidden></span></a>
      <button class="botao-icone topo__menu" type="button" id="abrir-menu" aria-label="Abrir o menu" aria-expanded="false" aria-controls="menu"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path class="l1" d="M4.5 9h15"/><path class="l2" d="M4.5 15h15"/></svg></button>
    </div>
  </div>
</header>
<nav class="menu" id="menu" aria-label="Menu" hidden>
  <ul role="list">
    ${PRINCIPAIS.filter(([c]) => ctx.existe(c)).map(([c, t]) => `<li><a href="${ctx.url(c)}"${marca(caminho, c)}>${esc(t)}</a></li>`).join('\n    ')}
  </ul>
</nav>`;
}

/* O RODAPÉ (o Renato, 16 nov 2026: «tem pouca informação»; «o Logo no Rodapé devia de estar branco»):
   a marca (o logótipo em branco, sem placa, a
   frase e os pontinhos dos ícones), e três colunas com título — a Loja (as categorias e o Natal), a
   Ajuda (as páginas) e «Fala connosco» (o WhatsApp e o Instagram, com o nome à vista e sem o número).
   Em baixo, «© ano Marca» e as legais. Nunca o nome do dono, o NIF nem a morada (vão nos Contactos,
   nos Termos e na Privacidade); as garantias da encomenda ficam só no fim da página inicial. */
function rodape(ctx) {
  const ligacao = (caminho, texto) => (ctx.existe(caminho) ? `<li><a href="${ctx.url(caminho)}">${esc(texto)}</a></li>` : '');
  const c = ctx.site.contactos;
  const w = wa(ctx);
  const arroba = (c.instagram || '').replace(/\/+$/, '').split('/').pop();
  const falar = [
    w ? `<li><a class="rodape__contacto" href="${w}" target="_blank" rel="noopener">${ico('whatsapp')}<span>Enviar mensagem<small>WhatsApp</small></span></a></li>` : '',
    c.instagram ? `<li><a class="rodape__contacto" href="${esc(c.instagram)}" target="_blank" rel="noopener">${ico('instagram')}<span>@${esc(arroba)}<small>Instagram</small></span></a></li>` : '',
    c.tiktok ? `<li><a class="rodape__contacto" href="${esc(c.tiktok)}" target="_blank" rel="noopener">${ico('tiktok')}<span>TikTok<small>As lives do Martim</small></span></a></li>` : '',
    c.facebook ? `<li><a class="rodape__contacto" href="${esc(c.facebook)}" target="_blank" rel="noopener">${ico('facebook')}<span>Facebook</span></a></li>` : '',
  ].join('');
  return `<footer class="rodape">
  <div class="rodape__cima contentor">
    <div class="rodape__marca">
      <a class="rodape__logo" href="${ctx.url('/')}">${logotipo(ctx, { peca: 'logo-horizontal-branco', alto: 72, alt: `${ctx.site.marca} — página inicial` })}</a>
      <p class="rodape__frase">${esc(ctx.site.assinatura || '')}</p>
      <span class="rodape__pontos" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
    </div>
    <nav class="rodape__coluna" aria-labelledby="rodape-loja">
      <h2 class="rodape__titulo" id="rodape-loja">Loja</h2>
      <ul role="list">
        ${categoriasComArtigos(ctx).map((cat) => ligacao(`/loja/${cat.slug}/`, cat.nome)).join('\n        ')}
        ${ligacao('/natal/', 'Natal')}
      </ul>
    </nav>
    <nav class="rodape__coluna" aria-labelledby="rodape-ajuda">
      <h2 class="rodape__titulo" id="rodape-ajuda">Ajuda</h2>
      <ul role="list">
        ${ligacao('/como-encomendar/', 'Como encomendar')}
        ${ligacao('/encomenda/', 'A tua encomenda')}
        ${ligacao('/a-nossa-historia/', 'A nossa história')}
        ${ligacao('/contactos/', 'Contactos')}
      </ul>
    </nav>
    ${falar ? `<div class="rodape__coluna rodape__coluna--falar">
      <h2 class="rodape__titulo">Fala connosco</h2>
      <ul role="list">${falar}</ul>
    </div>` : ''}
  </div>
  <div class="rodape__baixo contentor">
    <p>© ${ctx.hoje.slice(0, 4)} ${esc(ctx.site.marca)}</p>
    <ul class="rodape__legais" role="list">
      ${ligacao('/termos-e-condicoes/', 'Termos e condições')}
      ${ligacao('/politica-de-privacidade/', 'Privacidade')}
      <li>${livroBotao()}</li>
    </ul>
  </div>
</footer>`;
}

/* A procura, numa folha (um <dialog>: o foco fica lá dentro e o Esc fecha): o campo e, por baixo, os
   resultados (o procura.js procura no catálogo). Vazia, mostra as categorias. O texto do campo nunca
   leva «iPhone», «telefone», «nome» nem «email» (o Safari mostrava o preenchimento de contactos). */
function procura(ctx) {
  return `<dialog class="procura" id="procura" aria-label="Procurar">
  <div class="procura__interior">
    <form class="procura__form" role="search" data-procura>
      <label class="procura__campo">
        <span class="so-leitor">Procurar na loja</span>
        ${ico('lupa')}
        <input type="search" name="q" placeholder="O que procuras?" autocomplete="off" enterkeyhint="search" spellcheck="false" aria-controls="procura-resultados">
      </label>
      <button class="procura__fechar" type="button" data-fechar>Cancelar</button>
    </form>
    <p class="so-leitor" role="status" data-procura-estado></p>
    <div class="procura__resultados" id="procura-resultados" data-procura-resultados hidden></div>
    <div class="procura__inicio" data-procura-inicio>
      <p class="procura__rotulo">Categorias</p>
      <ul class="procura__categorias" role="list">
        ${categoriasComArtigos(ctx).map((c) => `<li><a href="${ctx.url(`/loja/${c.slug}/`)}">${esc(c.nome)}</a></li>`).join('\n        ')}
      </ul>
    </div>
  </div>
</dialog>`;
}

export function pagina(ctx, { titulo, descricao, caminho, conteudo, partilha, tipo = 'website', jsonld = [], classe = '', indexar = true }) {
  const marcaNome = ctx.site.marca;
  const tituloCompleto = titulo.includes(marcaNome) ? titulo : `${titulo} | ${marcaNome}`;
  const cartaoPartilha = partilha || ctx.manifesto.partilha._site;
  const l = ctx.manifesto.logo;
  const robots = !ctx.producao ? 'noindex, nofollow' : indexar === false ? 'noindex' : '';
  return `<!doctype html>
<html lang="pt-PT">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(tituloCompleto)}</title>
<meta name="description" content="${esc(descricao)}">
<link rel="canonical" href="${ctx.absoluto(caminho)}">
${robots ? `<meta name="robots" content="${robots}">\n` : ''}<meta property="og:type" content="${tipo}">
<meta property="og:site_name" content="${esc(marcaNome)}">
<meta property="og:locale" content="pt_PT">
<meta property="og:title" content="${esc(tituloCompleto)}">
<meta property="og:description" content="${esc(descricao)}">
<meta property="og:url" content="${ctx.absoluto(caminho)}">
<meta property="og:image" content="${ctx.absoluto(`/assets/img/${cartaoPartilha}`)}">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(marcaNome)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#F8F0E4">
<link rel="icon" type="image/png" sizes="32x32" href="${ctx.asset(`img/${l.icones[32]}`)}">
<link rel="icon" type="image/png" sizes="48x48" href="${ctx.asset(`img/${l.icones[48]}`)}">
<link rel="apple-touch-icon" href="${ctx.asset(`img/${l.icones.apple}`)}">
${ctx.ficheiros.letras.map((f) => `<link rel="preload" href="${ctx.asset(`fontes/${f}`)}" as="font" type="font/woff2" crossorigin>`).join('\n')}
<link rel="stylesheet" href="${ctx.asset(ctx.ficheiros.css)}">
<script>document.documentElement.classList.add('js')</script>
${jsonld.map((j) => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, '\\u003c')}</script>`).join('\n')}
<script src="${ctx.asset(ctx.ficheiros.js)}" defer></script>
</head>
<body${classe ? ` class="${esc(classe)}"` : ''} data-catalogo="${ctx.asset(ctx.ficheiros.catalogo)}" data-base="${ctx.url('/')}">
${sprite()}
<a class="saltar" href="#conteudo">Saltar para o conteúdo</a>
${cabecalho(ctx, caminho)}
${aviso(ctx)}
<main id="conteudo" tabindex="-1">
${conteudo}
</main>
${rodape(ctx)}
${procura(ctx)}
<div class="recado" role="status" aria-live="polite" data-recado></div>
</body>
</html>
`;
}
