/* Flores & Essências — o núcleo do JavaScript do site (sem dependências). Os outros ficheiros
   (interface, carrinho, procura, juntar, loja) vão a seguir a este, no mesmo ficheiro, e usam o que
   ele põe em window.FE: as contas do dinheiro, o armazenamento do browser (sempre dentro de
   try/catch: num separador privado ou com os dados do site bloqueados, o site continua a funcionar,
   só não se lembra), o catálogo publicado e o recado de «juntou-se à encomenda». */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* Euros com as duas casas, como no gerador (src/templates/util.mjs, euros): «17,00 €». */
  function euros(v) {
    const n = Math.round(Number(v) * 100) / 100;
    const [int, dec] = Math.abs(n).toFixed(2).split('.');
    return `${int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')},${dec} €`;
  }
  const hojeLisboa = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  /* Para procurar: sem acentos nem maiúsculas («Aniversário» = «aniversario»). */
  const normalizar = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const ico = (nome, classe = '') => `<svg class="ico${classe ? ` ${classe}` : ''}" aria-hidden="true" focusable="false"><use href="#i-${nome}"/></svg>`;
  const menosMovimento = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* O armazenamento do browser. Lê o que lá está (ou o valor por omissão); grava e diz se conseguiu. */
  const guardado = {
    ler(chave, omissao) {
      try { const v = JSON.parse(window.localStorage.getItem(chave) || 'null'); return v ?? omissao; } catch (_) { return omissao; }
    },
    gravar(chave, valor) {
      try { window.localStorage.setItem(chave, JSON.stringify(valor)); return true; } catch (_) { return false; }
    },
  };

  /* O preço que vale hoje: a MESMA regra das regras dos dados (src/lib/regras.mjs, precoDe) e do
     gerador. Acabada a promoção, volta o preço normal; sem preço, null («a confirmar»). */
  function precoDe(p, hoje = hojeLisboa()) {
    if (typeof p.preco !== 'number') return { atual: null, anterior: null };
    const emPromocao = Boolean(p.precoAnterior) && p.precoAnterior > p.preco && (!p.promocaoAte || hoje <= p.promocaoAte);
    if (emPromocao) return { atual: p.preco, anterior: p.precoAnterior };
    if (p.precoAnterior && p.promocaoAte && hoje > p.promocaoAte) return { atual: p.precoAnterior, anterior: null };
    return { atual: p.preco, anterior: null };
  }

  /* O catálogo publicado (assets/catalogo-<resumo>.json): os artigos, com os preços, as escolhas e as
     fotografias, as formas de receber e os portes. Pede-se uma vez; a encomenda nunca guarda preços. */
  let pedido = null;
  let pronto = null;
  function catalogo() {
    if (!pedido) {
      pedido = fetch(document.body.dataset.catalogo).then((r) => {
        if (!r.ok) throw new Error(`catálogo ${r.status}`);
        return r.json();
      }).then((c) => { pronto = c; return c; });
      pedido.catch(() => { pedido = null; });
    }
    return pedido;
  }

  /* As fotografias do catálogo: { n: nome, r: resumo, l: [larguras], f: [formatos], w, h, foco, alt }. */
  const urlFoto = (cat, img, w, fmt = 'webp') => `${cat.assets}img/${img.n}-${img.r}-${w}.${fmt}`;
  /* A fotografia pequena (as linhas da encomenda, a procura, o recado): só a versão de 360. */
  function miniaturaHtml(cat, img, lado) {
    const foco = img.foco && img.foco !== '50% 50%' ? ` style="object-position:${esc(img.foco)}"` : '';
    return `<img src="${urlFoto(cat, img, img.l[0])}" width="${lado}" height="${lado}" alt="" loading="lazy" decoding="async"${foco}>`;
  }

  /* O recado: uma linha a dizer o que aconteceu, por uns segundos (é uma região role="status": o leitor
     de ecrã lê-a). Pára enquanto o rato ou o foco estão nele. */
  const caixa = $('[data-recado]');
  let relogio = 0;
  function recado(html) {
    if (!caixa) return;
    window.clearTimeout(relogio);
    caixa.innerHTML = html;
    caixa.classList.add('is-visivel');
    const esconder = () => { caixa.classList.remove('is-visivel'); };
    const armar = () => { window.clearTimeout(relogio); relogio = window.setTimeout(esconder, 6000); };
    armar();
    caixa.onmouseenter = () => window.clearTimeout(relogio);
    caixa.onmouseleave = armar;
    caixa.onfocusin = () => window.clearTimeout(relogio);
    caixa.onfocusout = armar;
  }

  window.FE = {
    $, $$, esc, euros, hojeLisboa, normalizar, ico, menosMovimento, guardado, precoDe,
    catalogo, catalogoJa: () => pronto, urlFoto, miniaturaHtml, recado,
  };
})();
