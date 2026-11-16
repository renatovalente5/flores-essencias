/* Flores & Essências — juntar à encomenda, na ficha do artigo. O cartão da loja não compra: só a ficha.
   O formulário tem as escolhas que a peça deixa fazer (o nome é obrigatório quando a peça o leva; as
   cores e o aroma, vazios, combinam-se pelo WhatsApp) e o botão. Depois de juntar: o saco do cabeçalho
   conta mais uma e aparece o recado com «Ver a encomenda». */
(function () {
  'use strict';
  const { $, $$, esc, catalogo, miniaturaHtml } = window.FE;
  const CAMPOS = ['nome', 'cores', 'aroma'];

  /* Depois de juntar: o recado com a fotografia e «Ver a encomenda» («Nova encomenda» quando a anterior
     já tinha seguido pelo WhatsApp). */
  async function juntou(slug, nova = false) {
    let cat = null;
    try { cat = await catalogo(); } catch (_) { /* sem catálogo, o recado vai sem fotografia */ }
    const p = cat && cat.produtos[slug];
    const encomenda = (cat && cat.encomenda) || `${document.body.dataset.base}encomenda/`;
    window.FE.recado(`${p ? miniaturaHtml(cat, p.img, 44) : ''}<span class="recado__texto"><strong>${nova ? 'Nova encomenda' : 'Juntou-se à encomenda'}</strong>${p ? `<span>${esc(p.nome)}</span>` : ''}</span><a href="${esc(encomenda)}">Ver a encomenda</a>`);
  }

  $$('form[data-juntar-form]').forEach((form) => {
    const slug = form.dataset.juntarForm;
    const erro = $('[data-erro]', form);
    const errar = (campo, texto) => {
      erro.textContent = texto;
      const sitio = campo && campo.closest('.campo');
      if (sitio) sitio.append(erro); else $('button[type="submit"]', form).before(erro);
      erro.hidden = false;
      if (campo) { campo.setAttribute('aria-invalid', 'true'); campo.focus(); }
    };
    form.addEventListener('input', (ev) => { if (ev.target.hasAttribute('aria-invalid')) ev.target.removeAttribute('aria-invalid'); erro.hidden = true; });
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      erro.hidden = true;
      $$('[aria-invalid]', form).forEach((i) => i.removeAttribute('aria-invalid'));
      const pers = {};
      for (const k of CAMPOS) {
        const i = form.elements[`pers-${k}`];
        if (!i) continue;
        const v = i.value.trim();
        const rotulo = ($(`label[for="${i.id}"]`, form).firstChild.textContent || '').trim();
        if (i.required && !v) { errar(i, `Falta preencher: ${rotulo.toLowerCase()}.`); return; }
        if (v) pers[k] = v;
      }
      const { nova } = window.FE.carrinho.juntar({ produto: slug, pers, qtd: 1 });
      for (const k of CAMPOS) if (form.elements[`pers-${k}`]) form.elements[`pers-${k}`].value = '';
      juntou(slug, nova);
    });
  });

  // o catálogo vem quando o browser está livre: o recado e a encomenda abrem logo
  const depois = window.requestIdleCallback || ((f) => window.setTimeout(f, 1200));
  depois(() => { catalogo().catch(() => {}); });
})();
