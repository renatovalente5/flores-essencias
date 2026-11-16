#!/usr/bin/env node
// AS CAPTURAS PARA MOSTRAR AO DONO (o Chromium do Playwright que já está no Mac), sobre o _site construído:
//
//   node scripts/build.mjs && node scripts/capturas.mjs
//
// A página inteira da página inicial, da loja, de uma categoria (Religioso), de uma ficha com escolhas,
// da encomenda com duas peças, da nossa história e dos contactos — no computador (1440×900) e no
// telemóvel (390×844, com o dobro dos píxeis, como um iPhone) — em docs/capturas/ (fora do git: são
// pesadas). Com «reduzir movimento» (tudo parado e à vista), depois das letras e de todas as imagens.
// Uma página muito alta (a loja) sai em partes de 6000 px, pela ordem: -1, -2…
//
// O servidor é um `python3 -m http.server` temporário, numa porta livre, que pára no fim.
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.join(RAIZ, '_site');
const SAIDA = path.join(RAIZ, 'docs/capturas');
const PLAYWRIGHT = process.env.PLAYWRIGHT || '/Users/renatovalente/Websites/carimbo/node_modules/playwright';
const { chromium } = createRequire(import.meta.url)(PLAYWRIGHT);

const PAGINAS = [
  ['inicio', '/'],
  ['loja', '/loja/'],
  ['religioso', '/loja/religioso/'],
  ['ficha', '/produtos/enfeite-natal-nome-3d/'],
  ['encomenda', '/encomenda/'],
  ['historia', '/a-nossa-historia/'],
  ['contactos', '/contactos/'],
];
const APARELHOS = [
  ['computador', { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }],
  ['telemovel', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }],
];
// a encomenda das capturas: duas peças, uma com o nome escrito
const ENCOMENDA = { v: 1, zona: 'ctt', linhas: [{ produto: 'enfeite-natal-nome-3d', qtd: 2, pers: { nome: 'Leonor' } }, { produto: 'mini-arranjo-vaso-canelado', qtd: 1, pers: { cores: 'lilás' } }] };
const PARTE = 6000;

if (!fs.existsSync(path.join(SITE, 'index.html'))) { console.error('Falta o _site: corre primeiro node scripts/build.mjs'); process.exit(1); }
fs.mkdirSync(SAIDA, { recursive: true });

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

/* Na página: as letras e TODAS as imagens (as «lazy» passam a carregar já, e as capas dos vídeos). */
async function esperarTudo(p) {
  await p.evaluate(async () => {
    await document.fonts.ready;
    document.querySelectorAll('img[loading="lazy"]').forEach((i) => { i.loading = 'eager'; });
    const capas = [...document.querySelectorAll('video[poster]')].map((v) => new Promise((ok) => { const i = new Image(); i.onload = i.onerror = ok; i.src = v.poster; }));
    const fotos = [...document.images].map((i) => (i.complete ? null : new Promise((ok) => { i.addEventListener('load', ok, { once: true }); i.addEventListener('error', ok, { once: true }); })));
    await Promise.all([...capas, ...fotos]);
    await Promise.all([...document.images].map((i) => (i.decode ? i.decode().catch(() => {}) : null)));
  });
}

const feitas = [];
const browser = await chromium.launch();
try {
  for (const [aparelho, opcoes] of APARELHOS) {
    const ctx = await browser.newContext({ ...opcoes, reducedMotion: 'reduce', locale: 'pt-PT' });
    const p = await ctx.newPage();
    await p.goto(`${ORIGEM}/`, { waitUntil: 'load' });
    await p.evaluate((e) => localStorage.setItem('flores-essencias:encomenda', JSON.stringify(e)), ENCOMENDA);
    for (const [nome, caminho] of PAGINAS) {
      await p.goto(`${ORIGEM}${caminho}`, { waitUntil: 'networkidle' });
      if (nome === 'encomenda') await p.waitForSelector('[data-encomenda-cheia]:not([hidden])');
      await esperarTudo(p);
      await p.waitForTimeout(300);
      const alto = await p.evaluate(() => document.documentElement.scrollHeight);
      const largura = opcoes.viewport.width;
      if (alto <= PARTE) {
        const f = path.join(SAIDA, `${aparelho}-${nome}.png`);
        await p.screenshot({ path: f, fullPage: true });
        feitas.push(path.relative(RAIZ, f));
      } else {
        for (let y = 0, n = 1; y < alto; y += PARTE, n++) {
          const f = path.join(SAIDA, `${aparelho}-${nome}-${n}.png`);
          await p.screenshot({ path: f, fullPage: true, clip: { x: 0, y, width: largura, height: Math.min(PARTE, alto - y) } });
          feitas.push(path.relative(RAIZ, f));
        }
      }
    }
    await ctx.close();
  }
} finally {
  await browser.close();
  parar();
}
console.log(`${feitas.length} capturas em ${path.relative(RAIZ, SAIDA)}/:\n  ${feitas.join('\n  ')}`);
