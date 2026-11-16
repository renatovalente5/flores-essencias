/* Flores & Essências — Proposta C «Galeria»
   Sem JavaScript a página fica toda à vista: as filas deslizam com o dedo ou o
   trackpad e os vídeos tocam sozinhos (autoplay). Isto só acrescenta o menu do
   telemóvel, as setas das filas, os vídeos só à vista e a entrada ao descer. */
(() => {
  'use strict';

  const html = document.documentElement;
  const reduzir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* 1. Menu do telemóvel (ecrã inteiro por baixo do cabeçalho) ------------- */
  const botaoMenu = document.querySelector('.topo__menu');
  const menu = document.getElementById('menu');
  const largo = window.matchMedia('(min-width: 900px)');

  function definirMenu(aberto, devolverFoco) {
    html.classList.toggle('menu-aberto', aberto);
    botaoMenu.setAttribute('aria-expanded', String(aberto));
    botaoMenu.setAttribute('aria-label', aberto ? 'Fechar o menu' : 'Abrir o menu');
    if (aberto) {
      const primeira = menu.querySelector('a');
      if (primeira) primeira.focus();
    } else if (devolverFoco) {
      botaoMenu.focus();
    }
  }

  if (botaoMenu && menu) {
    botaoMenu.addEventListener('click', () => definirMenu(!html.classList.contains('menu-aberto')));
    menu.addEventListener('click', (e) => {
      if (e.target.closest('a') && html.classList.contains('menu-aberto')) definirMenu(false);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && html.classList.contains('menu-aberto')) definirMenu(false, true);
    });
    largo.addEventListener('change', (e) => { if (e.matches) definirMenu(false); });
    window.addEventListener('pageshow', (e) => { if (e.persisted) definirMenu(false); });
  }

  /* 2. Setas das filas (computador) --------------------------------------- */
  document.querySelectorAll('[data-fila]').forEach((fila) => {
    const setas = document.querySelector(`[data-setas="${fila.id}"]`);
    if (!setas) return;
    const anterior = setas.querySelector('[data-anterior]');
    const seguinte = setas.querySelector('[data-seguinte]');

    // anda o que está à vista menos um cartão (fica sempre um de referência)
    const passo = () => {
      const item = fila.firstElementChild;
      if (!item) return fila.clientWidth;
      const estilo = getComputedStyle(fila);
      const vao = parseFloat(estilo.columnGap) || 0;
      const largura = item.getBoundingClientRect().width + vao;
      const util = fila.clientWidth - parseFloat(estilo.paddingLeft) - parseFloat(estilo.paddingRight) + vao;
      const cabem = Math.max(1, Math.floor(util / largura + 0.02));
      return largura * Math.max(1, cabem - 1);
    };

    const actualizar = () => {
      const maximo = fila.scrollWidth - fila.clientWidth;
      setas.hidden = maximo <= 2;
      anterior.disabled = fila.scrollLeft <= 2;
      seguinte.disabled = fila.scrollLeft >= maximo - 2;
    };

    const mover = (sentido) => fila.scrollBy({ left: sentido * passo(), behavior: reduzir ? 'auto' : 'smooth' });
    anterior.addEventListener('click', () => mover(-1));
    seguinte.addEventListener('click', () => mover(1));

    let pedido = 0;
    const agendar = () => {
      if (pedido) return;
      pedido = requestAnimationFrame(() => { pedido = 0; actualizar(); });
    };
    fila.addEventListener('scroll', agendar, { passive: true });
    window.addEventListener('resize', agendar);
    actualizar();
  });

  /* 3. Vídeos: sem som, só a tocar quando estão à vista.
        Com «movimento reduzido» fica a capa (o botão deixa tocar). ------------ */
  const videos = Array.from(document.querySelectorAll('video[data-video]'));
  const estado = new WeakMap();

  function mostrarEstado(video) {
    const caixa = video.closest('.video');
    if (!caixa) return;
    const aTocar = !video.paused && !video.ended;
    caixa.dataset.estado = aTocar ? 'a-tocar' : 'parado';
    const botao = caixa.querySelector('.video__botao');
    if (botao) botao.setAttribute('aria-label', aTocar ? 'Pausar o vídeo' : 'Reproduzir o vídeo');
  }

  function tocar(video) {
    const promessa = video.play();
    if (promessa && promessa.catch) promessa.catch(() => mostrarEstado(video));
  }

  function decidir(video) {
    const e = estado.get(video);
    if (e.querTocar && e.visivel) tocar(video);
    else if (!video.paused) video.pause();
  }

  const temVigia = 'IntersectionObserver' in window;

  videos.forEach((video) => {
    video.muted = true;
    estado.set(video, { querTocar: !reduzir, visivel: !temVigia });

    // com o vigia, é ele que decide: o autoplay arrancava vídeos fora de vista (WebKit)
    if (reduzir || temVigia) {
      video.autoplay = false;
      video.removeAttribute('autoplay');
    }
    if (reduzir) {
      video.pause();
      video.load(); // volta à capa, mesmo que já tenha começado
    }

    video.addEventListener('play', () => mostrarEstado(video));
    video.addEventListener('pause', () => mostrarEstado(video));

    const caixa = video.closest('.video');
    const botao = caixa && caixa.querySelector('.video__botao');
    if (botao) {
      botao.hidden = false;
      botao.addEventListener('click', () => {
        const e = estado.get(video);
        e.querTocar = video.paused;
        if (e.querTocar) tocar(video);
        else video.pause();
      });
    }
    mostrarEstado(video);
  });

  if (temVigia && videos.length) {
    const vigia = new IntersectionObserver((entradas) => {
      entradas.forEach((entrada) => {
        estado.get(entrada.target).visivel = entrada.isIntersecting;
        decidir(entrada.target);
      });
    }, { threshold: 0.25 });
    videos.forEach((video) => vigia.observe(video));
  }

  /* 4. Entrar ao descer: só o que está abaixo do primeiro ecrã -------------- */
  if (!reduzir && 'IntersectionObserver' in window) {
    const ALVOS = [
      '.seccao__cabeca', '.categorias__titulo', '.categorias__lista', '.fila',
      '.historia__titulo', '.historia__foto', '.historia__texto',
      '.encomendar__titulo', '.passo'
    ].join(', ');

    const alvos = Array.from(document.querySelectorAll(ALVOS)).filter((el) => {
      if (el.parentElement && el.parentElement.closest(ALVOS)) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.top >= window.innerHeight;
    });

    const mostrar = (el) => {
      el.classList.remove('revelar', 'visivel');
      el.style.removeProperty('--d');
    };

    const entrar = (el, i) => {
      if (!el.classList.contains('revelar') || el.classList.contains('visivel')) return;
      entrada.unobserve(el);
      el.style.setProperty('--d', `${Math.min(i, 5) * 0.08}s`);
      el.addEventListener('animationend', function fim(ev) {
        if (ev.target !== el) return;
        el.removeEventListener('animationend', fim);
        mostrar(el);
      });
      el.classList.add('visivel');
    };

    const entrada = new IntersectionObserver((entradas) => {
      entradas.filter((e) => e.isIntersecting).forEach((e, i) => entrar(e.target, i));
    }, { rootMargin: '0px 0px -10% 0px' });

    alvos.forEach((el) => {
      el.classList.add('revelar');
      entrada.observe(el);
    });

    // no fim da página o que estiver nos últimos 10 % do ecrã já não sobe: entra tudo
    const noFim = () => {
      if (window.innerHeight + window.scrollY < document.documentElement.scrollHeight - 4) return;
      alvos.forEach((el, i) => entrar(el, i));
      window.removeEventListener('scroll', noFim);
    };
    window.addEventListener('scroll', noFim, { passive: true });

    window.addEventListener('beforeprint', () => alvos.forEach(mostrar));
  }
})();
