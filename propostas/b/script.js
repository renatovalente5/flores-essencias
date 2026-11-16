/* Flores & Essências — proposta B «Destaques».
   Tudo o que está na página vê-se sem JavaScript; isto só junta o menu, a procura,
   as setas da fila do Natal, os vídeos que tocam quando estão à vista e a entrada ao descer. */
(function () {
  'use strict';

  var raiz = document.documentElement;
  var reduzir = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* --- Menu do telemóvel --------------------------------------------------- */
  var botaoMenu = document.querySelector('.topo__menu');
  var menu = document.getElementById('menu');

  function mostrarMenu(abrir) {
    if (!botaoMenu || !menu) return;
    menu.hidden = !abrir;
    botaoMenu.setAttribute('aria-expanded', String(abrir));
    botaoMenu.setAttribute('aria-label', abrir ? 'Fechar o menu' : 'Menu');
    raiz.classList.toggle('menu-aberto', abrir);
  }

  if (botaoMenu && menu) {
    botaoMenu.addEventListener('click', function () { mostrarMenu(menu.hidden); });
    menu.addEventListener('click', function (e) { if (e.target.closest('a')) mostrarMenu(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !menu.hidden) { mostrarMenu(false); botaoMenu.focus(); }
    });
    var computador = window.matchMedia('(min-width: 860px)');
    var aoMudar = function (m) { if (m.matches) mostrarMenu(false); };
    if (computador.addEventListener) computador.addEventListener('change', aoMudar);
    window.addEventListener('pageshow', function (e) { if (e.persisted) mostrarMenu(false); });
  }

  /* --- Procura ------------------------------------------------------------- */
  var procura = document.querySelector('.procura');

  document.querySelectorAll('[data-abrir-procura]').forEach(function (botao) {
    botao.addEventListener('click', function () {
      if (!procura || typeof procura.showModal !== 'function') return;
      mostrarMenu(false);
      procura.showModal();
      var campo = procura.querySelector('input');
      if (campo) campo.focus();
    });
  });

  if (procura) {
    procura.addEventListener('click', function (e) {
      if (e.target.closest('[data-fechar-procura]')) { procura.close(); return; }
      if (e.target !== procura) return;
      var r = procura.getBoundingClientRect();
      var fora = e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
      if (fora) procura.close();
    });
  }

  /* --- Setas da fila do Natal (computador) ---------------------------------- */
  document.querySelectorAll('[data-setas-de]').forEach(function (grupo) {
    var fila = document.getElementById(grupo.getAttribute('data-setas-de'));
    if (!fila) return;
    var botoes = grupo.querySelectorAll('[data-seta]');

    function actualizar() {
      var maximo = fila.scrollWidth - fila.clientWidth;
      grupo.hidden = maximo <= 2;
      botoes[0].disabled = fila.scrollLeft <= 2;
      botoes[1].disabled = fila.scrollLeft >= maximo - 2;
    }

    botoes.forEach(function (botao) {
      botao.addEventListener('click', function () {
        var sentido = Number(botao.getAttribute('data-seta'));
        var item = fila.querySelector('li');
        var intervalo = parseFloat(getComputedStyle(fila).columnGap) || 0;
        var passo = item ? (item.getBoundingClientRect().width + intervalo) * 2 : fila.clientWidth * 0.8;
        fila.scrollBy({ left: sentido * passo, behavior: reduzir.matches ? 'auto' : 'smooth' });
      });
    });

    fila.addEventListener('scroll', actualizar, { passive: true });
    window.addEventListener('resize', actualizar);
    actualizar();
  });

  /* --- Vídeos dos bastidores: sem som, só a tocar quando estão à vista ------ */
  var videos = Array.prototype.slice.call(document.querySelectorAll('.bastidores video'));

  function tocar(video) {
    var pedido = video.play();
    if (pedido && pedido.catch) pedido.catch(function () { /* o browser recusou: fica a capa e o botão de tocar */ });
  }

  var vigiar = videos.length && !reduzir.matches && 'IntersectionObserver' in window;

  videos.forEach(function (video) {
    var item = video.closest('.video');
    var botao = item && item.querySelector('.video__botao');

    function estado() {
      var aTocar = !video.paused && !video.ended;
      if (item) item.classList.toggle('a-tocar', aTocar);
      if (botao) botao.setAttribute('aria-label', aTocar ? 'Pausar o vídeo' : 'Reproduzir o vídeo');
    }

    if (reduzir.matches) {
      video.removeAttribute('autoplay');
      if (!video.paused) video.pause();
    }

    // O `autoplay` pode arrancar um vídeo fora do ecrã depois da primeira leitura do vigia
    // (visto no WebKit): fora de vista, só toca se a pessoa carregou no botão.
    video.addEventListener('play', function () {
      if (vigiar && video.dataset.visivel !== '1' && video.dataset.pedido !== '1') video.pause();
      estado();
    });
    video.addEventListener('pause', estado);

    if (botao) {
      botao.hidden = false;
      botao.addEventListener('click', function () {
        if (video.paused) {
          delete video.dataset.parado;
          video.dataset.pedido = '1';
          tocar(video);
        } else {
          video.dataset.parado = '1';
          delete video.dataset.pedido;
          video.pause();
        }
      });
    }
    estado();
  });

  if (vigiar) {
    var vigiaVideos = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (entrada) {
        var video = entrada.target;
        video.dataset.visivel = entrada.isIntersecting ? '1' : '';
        if (entrada.isIntersecting) {
          if (entrada.intersectionRatio >= 0.25 && video.dataset.parado !== '1') tocar(video);
        } else {
          delete video.dataset.pedido;
          if (!video.paused) video.pause();
        }
      });
    }, { threshold: [0, 0.25] });
    videos.forEach(function (video) { vigiaVideos.observe(video); });
  }

  /* --- Entrar ao descer ------------------------------------------------------
     Só o que está abaixo do ecrã quando a página abre; as filas que deslizam entram inteiras. */
  if (!reduzir.matches && 'IntersectionObserver' in window) {
    var alvos = Array.prototype.slice.call(document.querySelectorAll('[data-revelar]')).filter(function (el) {
      var r = el.getBoundingClientRect();
      return r.width > 0 && r.top >= window.innerHeight;
    });

    var vigia = new IntersectionObserver(function (entradas) {
      var ordem = 0;
      entradas.forEach(function (entrada) {
        if (!entrada.isIntersecting) return;
        var el = entrada.target;
        vigia.unobserve(el);
        el.style.setProperty('--d', (Math.min(ordem, 5) * 0.08).toFixed(2) + 's');
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

    alvos.forEach(function (el) {
      el.classList.add('revelar');
      vigia.observe(el);
    });
  }
})();
