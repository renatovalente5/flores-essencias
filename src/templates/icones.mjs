// Os desenhos da Flores & Essências (os da proposta B, «Destaques»): traço de 1,7 em 24×24, pontas
// redondas. Vão uma vez por página, num <svg> escondido no topo do <body> (os <symbol>), e cada ícone é
// um <use href="#i-nome">: o JavaScript usa os mesmos (ico() no núcleo). Os das marcas (WhatsApp,
// Instagram, TikTok, Facebook) são os desenhos de sempre dessas marcas, numa cor só.
// Todos levam aria-hidden: o nome do botão ou da ligação é que diz o que fazem.

const S = {
  lupa: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/>',
  saco: '<path d="M5.5 8.5h13l-1 11.2a1.5 1.5 0 0 1-1.5 1.3H8a1.5 1.5 0 0 1-1.5-1.3l-1-11.2Z"/><path d="M9 10.5V7a3 3 0 0 1 6 0v3.5"/>',
  seta: '<path d="M5 12h13M13 7l5 5-5 5"/>',
  voltar: '<path d="M19 12H6M11 7l-5 5 5 5"/>',
  anterior: '<path d="m14.5 6-6 6 6 6"/>',
  seguinte: '<path d="m9.5 6 6 6-6 6"/>',
  fechar: '<path d="m6.5 6.5 11 11M17.5 6.5l-11 11"/>',
  mais: '<path d="M12 6.25v11.5M6.25 12h11.5"/>',
  menos: '<path d="M6.25 12h11.5"/>',
  lixo: '<path d="M4.75 7h14.5M10 10.75v5.75M14 10.75v5.75M6.6 7l.85 11.55a1.8 1.8 0 0 0 1.8 1.7h5.5a1.8 1.8 0 0 0 1.8-1.7L17.4 7M9.25 7V5.4a1.6 1.6 0 0 1 1.6-1.6h2.3a1.6 1.6 0 0 1 1.6 1.6V7"/>',
  certo: '<path d="m5.5 12.5 4.25 4.25L18.5 8"/>',
  pausa: '<path d="M9 7v10M15 7v10"/>',
  tocar: '<path fill="currentColor" stroke="none" d="M9 6.8v10.4a.6.6 0 0 0 .9.5l8-5.2a.6.6 0 0 0 0-1l-8-5.2a.6.6 0 0 0-.9.5Z"/>',
  telefone: '<path d="M6.8 4h2.6c.4 0 .7.3.8.6l.9 3.6a.9.9 0 0 1-.4.9l-1.5 1.1a11.3 11.3 0 0 0 4.9 4.9l1.1-1.5a.9.9 0 0 1 .9-.4l3.6.9c.4.1.6.4.6.8v2.6a1.8 1.8 0 0 1-1.8 1.8A15.6 15.6 0 0 1 5 5.8 1.8 1.8 0 0 1 6.8 4Z"/>',
  carta: '<rect x="3.5" y="5.5" width="17" height="13" rx="2.5"/><path d="m4 7.5 8 5.5 8-5.5"/>',
  // as marcas
  instagram: '<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.1" cy="6.9" r="1.1" fill="currentColor" stroke="none"/>',
  whatsapp: '<path d="M20.5 11.7a8.5 8.5 0 0 1-12.4 7.6l-4.6 1.2 1.2-4.4a8.5 8.5 0 1 1 15.8-4.4Z"/><path fill="currentColor" stroke="none" d="M9.1 8.2c.2-.4.4-.5.7-.5h.5c.2 0 .4.1.5.4l.7 1.7c.1.2 0 .4-.1.6l-.5.6c-.1.1-.2.3 0 .5.6 1 1.4 1.8 2.4 2.3.2.1.4.1.5-.1l.6-.7c.2-.2.4-.2.6-.1l1.6.8c.2.1.4.2.4.5 0 .5-.1 1-.5 1.3-.5.4-1.3.6-2 .4-2.6-.6-4.6-2.6-5.4-5.2-.2-.7-.1-1.5.4-2.2Z"/>',
  tiktok: '<path d="M14 3.5v11.2a3.8 3.8 0 1 1-3.3-3.8"/><path d="M14 3.5c.3 2.4 2 4.1 4.5 4.3"/>',
  facebook: '<path d="M15.5 3.5h-2.2a4 4 0 0 0-4 4v2.7H7v3.4h2.3v7h3.4v-7h2.5l.6-3.4h-3.1V7.8c0-.6.4-1 1-1h1.8Z"/>',
};

/** Os ícones que existem. */
export const NOMES_ICONES = Object.freeze(Object.keys(S));

/** O <svg> escondido com todos os desenhos: vai uma vez, no topo do <body>. */
export function sprite() {
  return `<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">${Object.entries(S).map(([n, d]) => `<symbol id="i-${n}" viewBox="0 0 24 24">${d}</symbol>`).join('')}</svg>`;
}

/** Um ícone: <svg class="ico"><use href="#i-nome"/></svg>. */
export function ico(nome, { classe = '' } = {}) {
  if (!S[nome]) throw new Error(`ícone «${nome}» não existe (existem: ${NOMES_ICONES.join(', ')})`);
  return `<svg class="ico${classe ? ` ${classe}` : ''}" aria-hidden="true" focusable="false"><use href="#i-${nome}"/></svg>`;
}
