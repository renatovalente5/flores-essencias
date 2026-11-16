/* Flores & Essências · Proposta A «Petróleo»
   Sem este ficheiro a página continua toda à vista: o menu do telemóvel, as setas,
   o comando dos vídeos e as entradas ao descer são acréscimos. */
(() => {
  'use strict';

  const raiz = document.documentElement;
  const reduzir = window.matchMedia('(prefers-reduced-motion: reduce)');
  const temObservador = 'IntersectionObserver' in window;

  // O WebKit pode correr este ficheiro antes de aplicar o estilo.css: o que mede a página espera por ele.
  const quandoHouverEstilo = (fn) => {
    const pronto = () => getComputedStyle(raiz).getPropertyValue('--fundo').trim() !== '';
    if (pronto()) { fn(); return; }
    const folha = document.querySelector('link[href$="estilo.css"]');
    let feito = false;
    const correr = () => { if (!feito && pronto()) { feito = true; requestAnimationFrame(fn); } };
    if (folha) folha.addEventListener('load', correr, { once: true });
    window.addEventListener('load', correr, { once: true });
  };

  /* ---------- Menu do telemóvel ---------- */
  const botaoMenu = document.querySelector('[data-menu-botao]');
  const menu = document.getElementById('menu');

  if (botaoMenu && menu) {
    const abrirMenu = (abrir) => {
      menu.hidden = !abrir;
      botaoMenu.setAttribute('aria-expanded', String(abrir));
      botaoMenu.setAttribute('aria-label', abrir ? 'Fechar o menu' : 'Abrir o menu');
      raiz.classList.toggle('menu-aberto', abrir);
    };
    botaoMenu.addEventListener('click', () => abrirMenu(menu.hidden));
    menu.addEventListener('click', (e) => { if (e.target.closest('a')) abrirMenu(false); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !menu.hidden) { abrirMenu(false); botaoMenu.focus({ preventScroll: true }); }
    });
    window.matchMedia('(min-width: 860px)').addEventListener('change', (e) => { if (e.matches) abrirMenu(false); });
    window.addEventListener('pageshow', (e) => { if (e.persisted) abrirMenu(false); });
  }

  /* ---------- Setas das filas (computador) ---------- */
  for (const setas of document.querySelectorAll('[data-setas]')) {
    const fila = document.getElementById(setas.dataset.setas);
    if (!fila) continue;
    const [anterior, seguinte] = setas.querySelectorAll('button');

    const passo = () => {
      const item = fila.querySelector(':scope > li');
      const espaco = parseFloat(getComputedStyle(fila).columnGap) || 0;
      return item ? item.getBoundingClientRect().width + espaco : fila.clientWidth;
    };
    const mover = (sentido) => fila.scrollBy({
      left: sentido * passo(),
      behavior: reduzir.matches ? 'auto' : 'smooth',
    });
    const actualizar = () => {
      const fim = fila.scrollWidth - fila.clientWidth - 2;
      anterior.disabled = fila.scrollLeft <= 2;
      seguinte.disabled = fila.scrollLeft >= fim;
    };

    anterior.addEventListener('click', () => mover(-1));
    seguinte.addEventListener('click', () => mover(1));
    fila.addEventListener('scroll', actualizar, { passive: true });
    window.addEventListener('resize', actualizar);
    window.addEventListener('load', actualizar);
    if ('ResizeObserver' in window) new ResizeObserver(actualizar).observe(fila);
    setas.hidden = false;
    actualizar();
  }

  /* ---------- Vídeos: só tocam à vista; com «reduzir movimento» fica a capa ---------- */
  const videos = [...document.querySelectorAll('video[data-video]')];
  const quer = new WeakMap(); // 'parado' = alguém o pôs em pausa (ou movimento reduzido)

  const botaoDe = (video) => video.closest('[data-video-quadro]')?.querySelector('[data-video-botao]');
  const pintar = (video) => {
    const botao = botaoDe(video);
    if (!botao) return;
    const aTocar = !video.paused;
    botao.dataset.estado = aTocar ? 'a-tocar' : 'em-pausa';
    botao.setAttribute('aria-label', aTocar ? 'Pausar o vídeo' : 'Reproduzir o vídeo');
  };
  const tocar = (video) => {
    const promessa = video.play();
    if (promessa && promessa.catch) promessa.catch(() => pintar(video));
  };

  for (const video of videos) {
    video.muted = true;
    // pause() antes de começar cancela o «autoplay»; quem decide é o observador abaixo
    video.pause();
    if (reduzir.matches || !temObservador) {
      if (reduzir.matches) {
        video.removeAttribute('autoplay');
        video.autoplay = false;
        quer.set(video, 'parado');
        if (video.currentTime > 0) video.load(); // volta a mostrar a capa
      } else {
        tocar(video);
      }
    }
    video.addEventListener('play', () => pintar(video));
    video.addEventListener('pause', () => pintar(video));

    const botao = botaoDe(video);
    if (botao) {
      botao.hidden = false;
      botao.addEventListener('click', () => {
        if (video.paused) { quer.set(video, 'tocar'); tocar(video); }
        else { quer.set(video, 'parado'); video.pause(); }
      });
    }
    pintar(video);
  }

  if (temObservador && videos.length) {
    const vista = new IntersectionObserver((entradas) => {
      for (const entrada of entradas) {
        const video = entrada.target;
        if (entrada.isIntersecting) {
          if (quer.get(video) !== 'parado') tocar(video);
        } else if (!video.paused) {
          video.pause();
        }
      }
    }, { threshold: 0.2 });
    videos.forEach((video) => vista.observe(video));
  }

  /* ---------- Entradas ao descer ---------- */
  if (!reduzir.matches && temObservador) quandoHouverEstilo(() => {
    const alvos = [...document.querySelectorAll('[data-revelar]')];
    const revelar = new IntersectionObserver((entradas) => {
      let ordem = 0;
      for (const entrada of entradas) {
        if (!entrada.isIntersecting) continue;
        const el = entrada.target;
        revelar.unobserve(el);
        el.style.setProperty('--d', `${Math.min(ordem, 5) * 90}ms`);
        el.classList.add('visivel');
        ordem += 1;
        const fim = (ev) => {
          if (ev.target !== el || ev.propertyName !== 'opacity') return;
          el.classList.remove('revelar', 'visivel');
          el.style.removeProperty('--d');
          el.removeEventListener('transitionend', fim);
        };
        el.addEventListener('transitionend', fim);
      }
    }, { rootMargin: '0px 0px -8% 0px' });

    for (const el of alvos) {
      const caixa = el.getBoundingClientRect();
      // só o que está abaixo do ecrã: o primeiro ecrã nunca pisca
      if (caixa.width > 0 && caixa.top >= window.innerHeight) {
        el.classList.add('revelar');
        revelar.observe(el);
      }
    }
  });
})();
