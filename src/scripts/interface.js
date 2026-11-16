/* Flores & Essências — a interface: o menu do telemóvel, a procura numa folha, as setas da fila do
   Natal, os vídeos dos bastidores (só tocam à vista), o entrar ao descer, a galeria da ficha e o aviso
   do topo. Tudo o que está na página vê-se sem JavaScript; isto só junta o movimento. */
(function () {
  'use strict';
  const { $, $$, menosMovimento } = window.FE;
  const raiz = document.documentElement;

  /* ---------- O menu do telemóvel (ecrã inteiro, por baixo do cabeçalho) ---------- */
  const botaoMenu = $('#abrir-menu');
  const menu = $('#menu');
  function mostrarMenu(abrir, { foco = false } = {}) {
    if (!botaoMenu || !menu) return;
    menu.hidden = !abrir;
    botaoMenu.setAttribute('aria-expanded', String(abrir));
    botaoMenu.setAttribute('aria-label', abrir ? 'Fechar o menu' : 'Abrir o menu');
    raiz.classList.toggle('menu-aberto', abrir);
    if (!abrir && foco) botaoMenu.focus();
  }
  if (botaoMenu && menu) {
    botaoMenu.addEventListener('click', () => mostrarMenu(menu.hidden));
    menu.addEventListener('click', (ev) => { if (ev.target.closest('a')) mostrarMenu(false); });
    document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && !menu.hidden) mostrarMenu(false, { foco: true }); });
    const computador = window.matchMedia('(min-width: 860px)');
    if (computador.addEventListener) computador.addEventListener('change', (m) => { if (m.matches) mostrarMenu(false); });
    window.addEventListener('pageshow', (ev) => { if (ev.persisted) mostrarMenu(false); });
  }

  /* ---------- A procura (um <dialog>: o foco fica lá dentro e o Esc fecha) ---------- */
  // Um clique fora da folha fecha; ao fechar, a página fica onde estava e o foco volta à lupa. O
  // Chrome repõe um <dialog> aberto ao voltar atrás: fecha-se à chegada.
  const procura = $('#procura');
  const botaoProcura = $('#abrir-procura');
  let lugar = 0;
  function abrirProcura() {
    if (!procura || typeof procura.showModal !== 'function') return;
    mostrarMenu(false);
    lugar = window.scrollY;
    if (!procura.open) procura.showModal();
    if (botaoProcura) botaoProcura.setAttribute('aria-expanded', 'true');
    procura.dispatchEvent(new CustomEvent('fe:aberto'));
  }
  function fecharProcura() { if (procura && procura.open) procura.close(); }
  if (procura) {
    if (procura.open) procura.close();
    procura.addEventListener('click', (ev) => {
      if (ev.target.closest('[data-fechar]')) { fecharProcura(); return; }
      if (ev.target !== procura) return;
      const r = procura.getBoundingClientRect();
      if (ev.clientX < r.left || ev.clientX > r.right || ev.clientY < r.top || ev.clientY > r.bottom) fecharProcura();
    });
    procura.addEventListener('close', () => {
      if (botaoProcura) { botaoProcura.setAttribute('aria-expanded', 'false'); botaoProcura.focus({ preventScroll: true }); }
      if (Math.abs(window.scrollY - lugar) > 1) window.scrollTo({ top: lugar, behavior: 'auto' });
    });
    window.addEventListener('pageshow', (ev) => { if (ev.persisted) fecharProcura(); });
    // no telemóvel, a folha tem a altura que o teclado deixa (o teclado do iPhone não encolhe a página)
    const vv = window.visualViewport;
    if (vv) {
      const medir = () => raiz.style.setProperty('--altura-visivel', `${Math.round(vv.height)}px`);
      vv.addEventListener('resize', medir);
      medir();
    }
  }
  if (botaoProcura) botaoProcura.addEventListener('click', abrirProcura);
  window.FE.procuraFolha = { abrir: abrirProcura, fechar: fecharProcura };

  /* ---------- O aviso do topo com data: sai sozinho no dia seguinte ---------- */
  $$('.aviso[data-ate]').forEach((a) => { if (window.FE.hojeLisboa() > a.dataset.ate) a.hidden = true; });

  /* ---------- As setas da fila do Natal (computador) ---------- */
  $$('[data-setas-de]').forEach((grupo) => {
    const fila = document.getElementById(grupo.getAttribute('data-setas-de'));
    if (!fila) return;
    const botoes = $$('[data-seta]', grupo);
    const actualizar = () => {
      const maximo = fila.scrollWidth - fila.clientWidth;
      grupo.hidden = maximo <= 2;
      botoes[0].disabled = fila.scrollLeft <= 2;
      botoes[1].disabled = fila.scrollLeft >= maximo - 2;
    };
    botoes.forEach((botao) => botao.addEventListener('click', () => {
      const sentido = Number(botao.getAttribute('data-seta'));
      const item = $('li', fila);
      const intervalo = parseFloat(getComputedStyle(fila).columnGap) || 0;
      const passo = item ? (item.getBoundingClientRect().width + intervalo) * 2 : fila.clientWidth * 0.8;
      fila.scrollBy({ left: sentido * passo, behavior: menosMovimento.matches ? 'auto' : 'smooth' });
    }));
    fila.addEventListener('scroll', actualizar, { passive: true });
    window.addEventListener('resize', actualizar);
    actualizar();
  });

  /* ---------- Os vídeos dos bastidores: sem som, só a tocar quando estão à vista ---------- */
  // Com «reduzir movimento» fica a capa e o botão de tocar. Fora de vista, só toca se a pessoa
  // carregou no botão.
  const videos = $$('video[data-video]');
  const vigiar = videos.length && !menosMovimento.matches && 'IntersectionObserver' in window;
  const tocar = (v) => { const p = v.play(); if (p && p.catch) p.catch(() => { /* o browser recusou: fica a capa e o botão */ }); };
  videos.forEach((video) => {
    const item = video.closest('.video');
    const botao = item && $('.video__botao', item);
    const estado = () => {
      const aTocar = !video.paused && !video.ended;
      if (item) item.classList.toggle('a-tocar', aTocar);
      if (botao) botao.setAttribute('aria-label', aTocar ? 'Pausar o vídeo' : 'Reproduzir o vídeo');
    };
    if (menosMovimento.matches) { video.removeAttribute('autoplay'); if (!video.paused) video.pause(); }
    video.addEventListener('play', () => { if (vigiar && video.dataset.visivel !== '1' && video.dataset.pedido !== '1') video.pause(); estado(); });
    video.addEventListener('pause', estado);
    if (botao) {
      botao.hidden = false;
      botao.addEventListener('click', () => {
        if (video.paused) { delete video.dataset.parado; video.dataset.pedido = '1'; tocar(video); } else { video.dataset.parado = '1'; delete video.dataset.pedido; video.pause(); }
      });
    }
    estado();
  });
  if (vigiar) {
    const vigia = new IntersectionObserver((entradas) => {
      entradas.forEach((e) => {
        const v = e.target;
        v.dataset.visivel = e.isIntersecting ? '1' : '';
        if (e.isIntersecting) { if (e.intersectionRatio >= 0.25 && v.dataset.parado !== '1') tocar(v); } else { delete v.dataset.pedido; if (!v.paused) v.pause(); }
      });
    }, { threshold: [0, 0.25] });
    videos.forEach((v) => vigia.observe(v));
  }

  /* ---------- Entrar ao descer (só o que começa abaixo do primeiro ecrã) ---------- */
  if (!menosMovimento.matches && 'IntersectionObserver' in window) {
    const alvos = $$('.pagina-inicio .seccao').filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.top >= window.innerHeight; });
    const vigia = new IntersectionObserver((entradas) => {
      let ordem = 0;
      entradas.forEach((e) => {
        if (!e.isIntersecting) return;
        const el = e.target;
        vigia.unobserve(el);
        el.style.setProperty('--d', `${(Math.min(ordem, 5) * 0.08).toFixed(2)}s`);
        ordem += 1;
        el.classList.add('visivel');
        el.addEventListener('transitionend', function fim(ev) {
          if (ev.target !== el || ev.propertyName !== 'opacity') return;
          el.removeEventListener('transitionend', fim);
          el.classList.remove('revelar', 'visivel');
          el.style.removeProperty('--d');
        });
      });
    }, { rootMargin: '0px 0px -10% 0px' });
    alvos.forEach((el) => { el.classList.add('revelar'); vigia.observe(el); });
  }

  /* ---------- A galeria da ficha: as miniaturas escolhem a fotografia ---------- */
  $$('[data-galeria]').forEach((g) => {
    const pista = $('.ficha__pista', g);
    const minis = $$('[data-foto]', g);
    if (!pista || !minis.length) return;
    minis.forEach((b) => b.addEventListener('click', () => {
      pista.scrollTo({ left: Number(b.dataset.foto) * pista.clientWidth, behavior: menosMovimento.matches ? 'auto' : 'smooth' });
    }));
    pista.addEventListener('scroll', () => {
      const i = Math.round(pista.scrollLeft / pista.clientWidth);
      minis.forEach((b, n) => (n === i ? b.setAttribute('aria-current', 'true') : b.removeAttribute('aria-current')));
    }, { passive: true });
  });
})();
