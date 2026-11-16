#!/usr/bin/env node
// A PROVA NO BROWSER (Chromium e WebKit, com o Playwright que já está no Mac), sobre o _site construído:
//
//   node scripts/build.mjs && node scripts/provar.mjs
//
// 1. A encomenda de ponta a ponta: a ficha (as escolhas e «Juntar à encomenda»), o saco, a encomenda
//    (a entrega pelos CTT, o nome e a morada) e «Encomendar pelo WhatsApp», até ao endereço do wa.me
//    com a mensagem certa — e o browser só guarda a encomenda, nunca o nome nem a morada.
// 2. As categorias da loja trocam SEM A PÁGINA ANDAR: toca-se numa pastilha por coordenadas (um dedo
//    não rola até ao elemento, o page.tap sim), a fila fica no mesmo sítio do ecrã, a página não
//    recarrega (uma marca na window), e o «voltar» devolve a categoria de antes.
// 3. Nenhum transbordo a 320, 360, 375, 390 e 414 px em todas as páginas do sitemap (e nas que estão
//    fora dele: a encomenda, as legais e a 404), na encomenda com peças e com o menu e a procura
//    abertos; e nenhum erro na consola.
// 4. No telemóvel, em todas essas páginas (e na encomenda com peças, no menu e na procura): os alvos de
//    toque com 44 px (as ligações dentro do texto ficam como texto, como a WCAG deixa), nenhuma letra
//    abaixo de 12 px e os campos a 16 px ou mais (abaixo disso o iPhone aproxima a página).
// 5. O entrar ao descer (como na proposta B): com o movimento ligado, o que está abaixo do primeiro
//    ecrã começa escondido e, descendo até ao fim, fica tudo à vista (nada preso a meio). Sem
//    JavaScript não há nada escondido (os testes conferem que o HTML não traz o «revelar»).
//
// O servidor é um `python3 -m http.server` temporário, numa porta livre, que pára no fim (também com um
// erro ou um Ctrl-C): não fica nenhum servidor esquecido.
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.join(RAIZ, '_site');
const PLAYWRIGHT = process.env.PLAYWRIGHT || '/Users/renatovalente/Websites/carimbo/node_modules/playwright';
const { chromium, webkit } = createRequire(import.meta.url)(PLAYWRIGHT);
const LARGURAS = [320, 360, 375, 390, 414];

let falhas = 0;
const falhou = (t) => { falhas++; console.error(`  ✗ ${t}`); };
const passou = (t) => console.log(`  ✓ ${t}`);

// ---------------------------------------------------------------- o servidor temporário
const portaLivre = () => new Promise((ok, mal) => {
  const s = net.createServer();
  s.once('error', mal);
  s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => ok(port)); });
});
const porta = await portaLivre();
const servidor = spawn('python3', ['-m', 'http.server', String(porta), '--bind', '127.0.0.1', '--directory', SITE], { stdio: 'ignore' });
const parar = () => { if (servidor.exitCode === null) servidor.kill(); };
process.on('exit', parar);
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => { parar(); process.exit(130); });
const ORIGEM = `http://127.0.0.1:${porta}`;
for (let i = 0; i < 50; i++) {
  try { if ((await fetch(`${ORIGEM}/`)).ok) break; } catch { /* ainda a arrancar */ }
  await new Promise((r) => setTimeout(r, 100));
}

// as páginas: as do sitemap (o caminho, sem a origem) e as que estão fora dele
const sitemap = fs.readFileSync(path.join(SITE, 'sitemap.xml'), 'utf8');
const doSitemap = [...sitemap.matchAll(/<loc>[a-z]+:\/\/[^/]+([^<]*)<\/loc>/g)].map((m) => m[1]);
const foraDoSitemap = ['/encomenda/', '/termos-e-condicoes/', '/politica-de-privacidade/', '/desistir/', '/garantia/', '/resolucao-de-litigios/', '/404.html'];
const PAGINAS = [...new Set([...doSitemap, ...foraDoSitemap])];
const catalogo = JSON.parse(fs.readFileSync(path.join(SITE, 'assets', fs.readdirSync(path.join(SITE, 'assets')).find((f) => /^catalogo-.*\.json$/.test(f))), 'utf8'));

async function contexto(browser, { largura, alto = 844, telemovel = true }) {
  return browser.newContext({ viewport: { width: largura, height: alto }, isMobile: telemovel, hasTouch: telemovel, deviceScaleFactor: 1, reducedMotion: 'reduce', locale: 'pt-PT' });
}

// ---------------------------------------------------------------- 1. a encomenda de ponta a ponta
async function provarEncomenda(browser, nomeMotor, telemovel) {
  const largura = telemovel ? 375 : 1280;
  const ctx = await contexto(browser, { largura, alto: telemovel ? 812 : 900, telemovel });
  let whatsapp = '';
  // o wa.me não se abre: apanha-se o endereço (a janela nova do computador ou a navegação do telemóvel)
  await ctx.route('https://wa.me/**', (r) => { whatsapp = r.request().url(); r.abort(); });
  const p = await ctx.newPage();
  const erros = [];
  p.on('pageerror', (e) => erros.push(String(e)));
  // uma peça com o nome, as cores e o aroma (ou o que houver), e uma sem escolhas, ambas com preço
  const entradas = Object.entries(catalogo.produtos);
  const [slugA, a] = entradas.find(([, x]) => x.preco !== null && x.pers.some((k) => k.id === 'nome')) || entradas.find(([, x]) => x.pers.length);
  const [slugB, b] = entradas.find(([, x]) => x.preco !== null && !x.pers.length && !x.desde);
  await p.goto(`${ORIGEM}${a.url}`, { waitUntil: 'load' });
  const escolhas = { nome: 'Leonor', cores: 'rosa e lilás', aroma: 'baunilha' };
  // sem o nome, não junta e diz o que falta
  if (a.pers.some((k) => k.id === 'nome')) {
    await p.click('form[data-juntar-form] button[type="submit"]');
    const erro = await p.textContent('[data-erro]');
    if (!/^Falta preencher/.test(erro || '')) falhou(`${nomeMotor} ${largura}: a ficha juntou sem o nome («${erro}»)`);
  }
  for (const k of a.pers) await p.fill(`[name="pers-${k.id}"]`, escolhas[k.id]);
  await p.click('form[data-juntar-form] button[type="submit"]');
  await p.waitForSelector('.recado.is-visivel');
  await p.goto(`${ORIGEM}${b.url}`, { waitUntil: 'load' });
  await p.click('form[data-juntar-form] button[type="submit"]');
  await p.waitForFunction(() => document.querySelector('#saco [data-conta]')?.textContent === '2');
  // a encomenda
  await p.click('#saco');
  await p.waitForSelector('[data-encomenda-cheia]:not([hidden])');
  // duas da segunda peça (o «+» da linha)
  await p.click(`[data-linha="1"] [data-mais]`);
  await p.waitForFunction(() => document.querySelector('[data-linha="1"] input')?.value === '2');
  await p.check('input[name="zona"][value="ctt"]');
  await p.waitForSelector('[data-so-envio]:not([hidden])');
  const dados = { nome: 'Maria Ensaio', morada: 'Rua do Ensaio, 1', codigoPostal: '2955-000', localidade: 'Pinhal Novo' };
  // sem a morada, não abre o WhatsApp
  await p.fill('#e-nome', dados.nome);
  await p.click('[data-encomenda-form] button[type="submit"]');
  await p.waitForTimeout(300);
  if (whatsapp) falhou(`${nomeMotor} ${largura}: abriu o WhatsApp sem a morada`);
  await p.fill('#e-morada', dados.morada);
  await p.fill('#e-cp', dados.codigoPostal);
  await p.fill('#e-local', dados.localidade);
  await p.click('[data-encomenda-form] button[type="submit"]');
  for (let i = 0; i < 40 && !whatsapp; i++) await p.waitForTimeout(100);
  const i = whatsapp.indexOf('?text=');
  const mensagem = i < 0 ? '' : decodeURIComponent(whatsapp.slice(i + 6).replace(/\+/g, ' '));
  const euros = (v) => `${v.toFixed(2).replace('.', ',')} €`;
  const esperadas = [
    'Olá! Quero fazer esta encomenda:',
    `*1 × ${a.nome}* — ${a.preco === null ? 'preço a confirmar' : `${a.desde ? 'desde ' : ''}${euros(a.preco)}`}`,
    ...a.pers.map((k) => `- ${k.rotulo}: ${escolhas[k.id]}`),
    `*2 × ${b.nome}* — ${euros(b.preco * 2)}`,
    `Entrega: ${catalogo.zonas.find((z) => z.id === 'ctt').curto} — portes ${catalogo.portes.ctt === null ? 'a confirmar' : euros(catalogo.portes.ctt)}`,
    `Nome: ${dados.nome}`,
    `Morada: ${dados.morada}, ${dados.codigoPostal} ${dados.localidade}`,
  ];
  const linhas = mensagem.split('\n');
  let pos = -1;
  const faltam = [];
  for (const e of esperadas) { const j = linhas.indexOf(e, pos + 1); if (j < 0) faltam.push(e); else pos = j; }
  if (!whatsapp.startsWith(`https://wa.me/${catalogo.whatsapp}?text=`)) falhou(`${nomeMotor} ${largura}: o WhatsApp não abriu (${whatsapp || 'nada'})`);
  else if (faltam.length) falhou(`${nomeMotor} ${largura}: a mensagem não tem ${faltam.map((x) => `«${x}»`).join(', ')}:\n${mensagem}`);
  else passou(`${nomeMotor} ${largura}: a encomenda de ponta a ponta (${slugA}, ${slugB}) até ao wa.me, com a mensagem certa`);
  // no telemóvel a própria página seguiu para o wa.me (que não se abriu): volta-se à encomenda, que diz
  // «Encomenda enviada»; e o browser guarda só a encomenda
  if (!p.url().startsWith(`${ORIGEM}/encomenda/`)) await p.goto(`${ORIGEM}/encomenda/`, { waitUntil: 'load' });
  const guardado = await p.evaluate(() => Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)])));
  const chaves = Object.keys(guardado);
  if (chaves.join() !== 'flores-essencias:encomenda') falhou(`${nomeMotor} ${largura}: o browser guarda ${chaves.join(', ')}`);
  else if (Object.values(dados).some((v) => guardado['flores-essencias:encomenda'].includes(v))) falhou(`${nomeMotor} ${largura}: o browser guardou o nome ou a morada`);
  else passou(`${nomeMotor} ${largura}: no browser só a encomenda, sem o nome nem a morada`);
  await p.waitForSelector('[data-enviada]:not([hidden])');
  if (erros.length) falhou(`${nomeMotor} ${largura}: erros na consola: ${erros.join(' | ')}`);
  await ctx.close();
}

// ---------------------------------------------------------------- 2. as categorias trocam sem a página andar
async function provarSeparadores(browser, nomeMotor, telemovel) {
  const largura = telemovel ? 375 : 1280;
  const falhasAntes = falhas;
  const ctx = await contexto(browser, { largura, alto: telemovel ? 812 : 900, telemovel });
  const p = await ctx.newPage();
  const erros = [];
  p.on('pageerror', (e) => erros.push(String(e)));
  await p.goto(`${ORIGEM}/loja/arranjos/`, { waitUntil: 'load' });
  await p.evaluate(() => { window.__mesmaPagina = true; });
  const cats = await p.$$eval('.pastilhas a', (as) => as.map((a) => a.getAttribute('href')));
  // desce um pouco (a fila fica a meio do ecrã por baixo do cabeçalho) e toca nas pastilhas, uma a uma
  await p.evaluate(() => window.scrollTo(0, 30));
  for (const destino of [...cats.filter((c) => c !== '/loja/arranjos/'), '/loja/arranjos/']) {
    // na fila que rola de lado, a pastilha tem de estar à vista antes do toque
    await p.evaluate((d) => { const a = document.querySelector(`.pastilhas a[href="${d}"]`); const ul = a.closest('ul'); const r = a.getBoundingClientRect(); const f = ul.getBoundingClientRect(); if (r.left < f.left || r.right > f.right) ul.scrollLeft += r.left - f.left - 16; }, destino);
    await p.waitForTimeout(150);
    const antes = await p.evaluate((d) => { const a = document.querySelector(`.pastilhas a[href="${d}"]`).getBoundingClientRect(); return { fila: document.querySelector('.pastilhas').getBoundingClientRect().top, y: scrollY, x: a.left + a.width / 2, alvo: a.top + a.height / 2 }; }, destino);
    if (telemovel) await p.touchscreen.tap(antes.x, antes.alvo); else await p.mouse.click(antes.x, antes.alvo);
    await p.waitForFunction((d) => location.pathname === d && document.querySelector(`.pastilhas a[href="${d}"]`).getAttribute('aria-current') === 'page', destino);
    await p.waitForTimeout(250);
    const depois = await p.evaluate(() => ({ fila: document.querySelector('.pastilhas').getBoundingClientRect().top, y: scrollY, mesma: window.__mesmaPagina === true, h1: document.querySelector('[data-loja-painel] h1')?.textContent }));
    if (!depois.mesma) falhou(`${nomeMotor} ${largura}: a pastilha ${destino} recarregou a página`);
    else if (Math.abs(depois.fila - antes.fila) > 1) falhou(`${nomeMotor} ${largura}: com ${destino}, a fila das pastilhas mexeu ${(depois.fila - antes.fila).toFixed(1)} px (scrollY ${antes.y} → ${depois.y})`);
  }
  // o «voltar» do browser devolve a categoria de antes, no mesmo sítio
  const antes = await p.evaluate(() => document.querySelector('.pastilhas').getBoundingClientRect().top);
  await p.goBack();
  await p.waitForTimeout(500);
  const voltou = await p.evaluate(() => ({ caminho: location.pathname, fila: document.querySelector('.pastilhas').getBoundingClientRect().top, mesma: window.__mesmaPagina === true, marcada: document.querySelector('.pastilhas a[aria-current="page"]')?.getAttribute('href') }));
  if (!voltou.mesma || voltou.marcada !== voltou.caminho || Math.abs(voltou.fila - antes) > 1) falhou(`${nomeMotor} ${largura}: o «voltar» (${JSON.stringify(voltou)})`);
  if (erros.length) falhou(`${nomeMotor} ${largura}: erros na consola: ${erros.join(' | ')}`);
  if (falhas === falhasAntes) passou(`${nomeMotor} ${largura}: as ${cats.length} categorias trocam sem a página andar nem recarregar, e o «voltar» também`);
  await ctx.close();
}

// ---------------------------------------------------------------- 4. os alvos, a letra e os campos
/* Corre na página: o que se vê e se toca. Um alvo é uma ligação, um botão ou um campo; as ligações
   «inline» (no meio de uma frase) não contam, e um botão de rádio conta com a etiqueta que o envolve. */
function medirToque() {
  const visivel = (e) => {
    if (e.closest('.so-leitor, [hidden], dialog:not([open])')) return false;
    const r = e.getBoundingClientRect();
    const cs = getComputedStyle(e);
    return r.width > 1 && r.height > 1 && cs.visibility !== 'hidden' && cs.display !== 'none';
  };
  const nome = (e) => `${e.tagName.toLowerCase()}${e.className && typeof e.className === 'string' ? `.${e.className.trim().split(/\s+/).join('.')}` : ''}${e.getAttribute('href') ? `[${e.getAttribute('href').slice(0, 40)}]` : ''}`;
  const alvos = [];
  for (const e of document.querySelectorAll('a[href], button, input:not([type="hidden"]), select, textarea')) {
    if (!visivel(e) || e.classList.contains('saltar')) continue;
    if (e.tagName === 'A' && getComputedStyle(e).display === 'inline') continue;
    const caixa = e.matches('input[type="radio"], input[type="checkbox"]') && e.closest('label') ? e.closest('label') : e;
    const r = caixa.getBoundingClientRect();
    if (r.width < 43.5 || r.height < 43.5) alvos.push(`${nome(e)} ${Math.round(r.width)}×${Math.round(r.height)}`);
  }
  const letras = [];
  for (const e of document.querySelectorAll('body *')) {
    if (!visivel(e) || e.closest('svg')) continue;
    if (![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
    const t = parseFloat(getComputedStyle(e).fontSize);
    if (t < 12) letras.push(`${nome(e)} ${t}px`);
  }
  const campos = [];
  for (const e of document.querySelectorAll('input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]), select, textarea')) {
    if (!visivel(e)) continue;
    const t = parseFloat(getComputedStyle(e).fontSize);
    if (t < 16) campos.push(`${nome(e)} ${t}px`);
  }
  return { alvos, letras, campos };
}

// ---------------------------------------------------------------- 3. nenhum transbordo
async function provarTransbordo(browser, nomeMotor) {
  const ctx = await contexto(browser, { largura: 375 });
  const p = await ctx.newPage();
  const erros = new Map();
  p.on('pageerror', (e) => erros.set(p.url(), String(e)));
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) erros.set(p.url(), m.text()); });
  const largos = [];
  const toque = { alvos: new Map(), letras: new Map(), campos: new Map() };
  const medeToque = async (onde) => {
    const r = await p.evaluate(medirToque);
    for (const k of Object.keys(toque)) for (const x of r[k]) if (!toque[k].has(x)) toque[k].set(x, onde);
  };
  const mede = () => p.evaluate(() => {
    const w = document.documentElement.clientWidth;
    if (document.documentElement.scrollWidth <= w) return null;
    const culpados = [...document.querySelectorAll('body *')].filter((e) => { const r = e.getBoundingClientRect(); return r.width && r.right > w + 1 && !e.closest('.fila, .categorias__fila, .pastilhas ul, .ficha__pista, .ficha__miniaturas, .quadro, dialog:not([open])'); })
      .slice(0, 3).map((e) => `${e.tagName.toLowerCase()}.${[...e.classList].join('.')}`);
    return `${document.documentElement.scrollWidth}px (${culpados.join(', ')})`;
  });
  for (const c of PAGINAS) {
    await p.setViewportSize({ width: 375, height: 812 });
    await p.goto(`${ORIGEM}${c}`, { waitUntil: 'load' });
    await medeToque(c);
    for (const w of LARGURAS) {
      await p.setViewportSize({ width: w, height: 812 });
      const r = await mede();
      if (r) largos.push(`${c} a ${w}: ${r}`);
    }
  }
  // a encomenda com peças (as linhas, as escolhas e os campos da morada à vista)
  const comEscolhas = Object.entries(catalogo.produtos).find(([, x]) => x.pers.length);
  const semEscolhas = Object.entries(catalogo.produtos).find(([, x]) => !x.pers.length);
  const encomenda = { v: 1, zona: 'ctt', linhas: [{ produto: comEscolhas[0], qtd: 12, pers: { nome: 'Maria Leonor de Albuquerque', cores: 'rosa-velho, lilás e verde-água', aroma: 'baunilha com canela' } }, { produto: semEscolhas[0], qtd: 1, pers: {} }] };
  await p.evaluate((e) => localStorage.setItem('flores-essencias:encomenda', JSON.stringify(e)), encomenda);
  for (const w of LARGURAS) {
    await p.setViewportSize({ width: w, height: 812 });
    await p.goto(`${ORIGEM}/encomenda/`, { waitUntil: 'load' });
    await p.waitForSelector('[data-encomenda-cheia]:not([hidden]) [data-so-envio]:not([hidden])');
    const r = await mede();
    if (r) largos.push(`/encomenda/ (com peças) a ${w}: ${r}`);
    if (w === 375) await medeToque('/encomenda/ (com peças)');
  }
  await p.evaluate(() => localStorage.clear());
  // na página inicial, com o menu e com a procura abertos
  for (const w of LARGURAS) {
    await p.setViewportSize({ width: w, height: 812 });
    await p.goto(`${ORIGEM}/`, { waitUntil: 'load' });
    await p.click('#abrir-menu');
    const menu = await p.evaluate(() => { const m = document.querySelector('#menu'); return m.hidden ? 'fechado' : (m.scrollWidth > m.clientWidth ? `${m.scrollWidth}px` : ''); });
    if (menu) largos.push(`o menu a ${w}: ${menu}`);
    if (w === 375) await medeToque('o menu aberto');
    await p.click('#abrir-menu');
    await p.click('#abrir-procura');
    await p.fill('#procura input[name="q"]', 'nossa senhora');
    await p.waitForSelector('#procura .resultado');
    const proc = await p.evaluate(() => { const d = document.querySelector('#procura'); const i = d.querySelector('.procura__interior'); return [d, i].some((e) => e.scrollWidth > e.clientWidth + 1) ? `${i.scrollWidth}px` : ''; });
    if (proc) largos.push(`a procura a ${w}: ${proc}`);
    if (w === 375) await medeToque('a procura aberta');
    await p.keyboard.press('Escape');
  }
  if (largos.length) falhou(`${nomeMotor}: transbordo em ${largos.length} sítios:\n      ${largos.slice(0, 20).join('\n      ')}`);
  else passou(`${nomeMotor}: nenhum transbordo a ${LARGURAS.join(', ')} px em ${PAGINAS.length} páginas (${doSitemap.length} do sitemap), na encomenda com peças, no menu e na procura`);
  const lista = (m) => [...m].slice(0, 12).map(([x, onde]) => `${x} (${onde})`).join('\n      ');
  if (toque.alvos.size) falhou(`${nomeMotor}: alvos de toque com menos de 44 px (${toque.alvos.size}):\n      ${lista(toque.alvos)}`);
  else passou(`${nomeMotor}: no telemóvel, todos os alvos de toque com 44 px ou mais (as ligações no meio do texto ficam como texto)`);
  if (toque.letras.size) falhou(`${nomeMotor}: letra abaixo de 12 px (${toque.letras.size}):\n      ${lista(toque.letras)}`);
  else passou(`${nomeMotor}: no telemóvel, nenhuma letra abaixo de 12 px`);
  if (toque.campos.size) falhou(`${nomeMotor}: campos abaixo de 16 px (${toque.campos.size}):\n      ${lista(toque.campos)}`);
  else passou(`${nomeMotor}: no telemóvel, os campos a 16 px ou mais`);
  if (erros.size) falhou(`${nomeMotor}: erros na consola em ${erros.size} páginas: ${[...erros].slice(0, 5).map(([u, e]) => `${u.replace(ORIGEM, '')}: ${e}`).join(' | ')}`);
  await ctx.close();
}

// ---------------------------------------------------------------- 5. o entrar ao descer
async function provarMovimento(browser, nomeMotor) {
  const falhasAntes = falhas;
  for (const telemovel of [true, false]) {
    const largura = telemovel ? 390 : 1280;
    const ctx = await browser.newContext({ viewport: { width: largura, height: telemovel ? 844 : 900 }, isMobile: telemovel, hasTouch: telemovel, reducedMotion: 'no-preference', locale: 'pt-PT' });
    const p = await ctx.newPage();
    for (const c of ['/', '/loja/religioso/', '/a-nossa-historia/', '/como-encomendar/']) {
      await p.goto(`${ORIGEM}${c}`, { waitUntil: 'load' });
      const escondidos = await p.evaluate(() => document.querySelectorAll('.revelar').length);
      if (c === '/' && !escondidos) falhou(`${nomeMotor} ${largura}: na página inicial nada entra ao descer`);
      const alto = await p.evaluate(() => document.documentElement.scrollHeight);
      for (let y = 0; y <= alto; y += 300) { await p.evaluate((yy) => window.scrollTo(0, yy), y); await p.waitForTimeout(40); }
      await p.waitForTimeout(1600);
      const presos = await p.evaluate(() => [...document.querySelectorAll('[data-revelar]')].filter((e) => parseFloat(getComputedStyle(e).opacity) < 0.99).map((e) => e.className || e.tagName));
      if (presos.length) falhou(`${nomeMotor} ${largura} ${c}: ${presos.length} ficaram por mostrar (${presos.slice(0, 3).join(', ')})`);
    }
    await ctx.close();
  }
  if (falhas === falhasAntes) passou(`${nomeMotor}: o entrar ao descer — começa escondido abaixo do ecrã e, descendo, fica tudo à vista (telemóvel e computador)`);
}

try {
  for (const [nomeMotor, motor] of [['Chromium', chromium], ['WebKit', webkit]]) {
    console.log(`\n${nomeMotor}`);
    const browser = await motor.launch();
    for (const telemovel of [true, false]) {
      await provarEncomenda(browser, nomeMotor, telemovel);
      await provarSeparadores(browser, nomeMotor, telemovel);
    }
    await provarTransbordo(browser, nomeMotor);
    await provarMovimento(browser, nomeMotor);
    await browser.close();
  }
} finally {
  parar();
}
console.log(falhas ? `\n${falhas} ${falhas === 1 ? 'prova falhou' : 'provas falharam'}.` : '\nTodas as provas passaram.');
process.exitCode = falhas ? 1 : 0;
