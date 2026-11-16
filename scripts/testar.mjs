#!/usr/bin/env node
// Testes do site da Flores & Essências (Node 22, sem dependências nem browser). Hão de correr no CI antes
// de cada publicação.
//
//   node scripts/testar.mjs          (precisa da cache das imagens: python3 scripts/imagens.py)
//
// Cada guarda prova-se nos dois sentidos: o site normal passa, e uma cópia estragada de propósito pára
// com a mensagem certa. As construções fazem-se em cópias do repositório numa pasta temporária, com a
// cache das imagens reaproveitada (--sem-imagens, como no CI): nunca se mexe no repositório.
//
// O CONTEÚDO É DOS DONOS, QUE O MUDAM NO PAINEL. Nada aqui depende do que o content/ diz hoje:
//   · as regras provam-se com dados de ensaio escritos aqui;
//   · cada construção parte do conteúdo de agora, mas põe ela mesma o estado de que precisa: os dados
//     legais vazios ou preenchidos de faz-de-conta, e artigos de ensaio («ensaio-…», com preços e
//     escolhas conhecidos), na primeira categoria e com uma fotografia que exista;
//   · se o conteúdo de agora não constrói a pré-visualização, as construções saltam-se: no CI o passo
//     seguinte (o gerador) pára na mesma e dá as razões; fora do CI, falha aqui.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as R from '../src/lib/regras.mjs';
import { esc, euros, hojeEmLisboa, numeroWhatsApp } from '../src/templates/util.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NO_CI = process.env.GITHUB_ACTIONS === 'true';
const comeco = Date.now();
let passaram = 0;
let falharam = 0;
let saltados = 0;
/* Porque é que as construções se saltam (a pré-visualização do conteúdo de agora não constrói), ou null. */
let paragem = null;

/* No CI, uma linha que comece por «::» é um comando do GitHub: o que estes testes escrevem nunca começa assim. */
const seguro = (t) => String(t).replace(/^(\s*)::/gm, '$1: :');

/* Um teste. Devolver um texto é saltá-lo (o texto diz porquê). */
async function teste(nome, fn, { construcao = false } = {}) {
  if (construcao && paragem) { saltados++; console.log(`  – ${nome} (saltado)`); return; }
  try {
    const r = await fn();
    if (typeof r === 'string') { saltados++; console.log(`  – ${nome} (${r})`); return; }
    passaram++;
    console.log(`  ✓ ${nome}`);
  } catch (e) {
    falharam++;
    process.exitCode = 1;
    console.error(seguro(`  ✗ ${nome}\n${e.stack}`));
  }
}
const construcao = (nome, fn) => teste(nome, fn, { construcao: true });

const lerRaiz = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');
const ler = (pasta, rel) => fs.readFileSync(path.join(pasta, rel), 'utf8');
const vazio = (v) => v === null || v === undefined || (typeof v === 'string' && !v.trim());
const escaparRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* O conteúdo de uma pasta como as regras o lêem (a forma que o build.mjs lhes dá). */
function dadosDoConteudo(pasta) {
  const listar = (rel, ext) => (fs.existsSync(path.join(pasta, rel)) ? fs.readdirSync(path.join(pasta, rel)).filter((f) => f.endsWith(ext)).map((f) => f.slice(0, -ext.length)) : []);
  return {
    site: ler(pasta, 'content/site.json'),
    inicio: ler(pasta, 'content/inicio.json'),
    categorias: ler(pasta, 'content/categorias.json'),
    fotos: ler(pasta, 'content/fotos.json'),
    videos: ler(pasta, 'content/videos.json'),
    artigos: Object.fromEntries(listar('content/produtos', '.json').map((n) => [n, ler(pasta, `content/produtos/${n}.json`)])),
    ficheirosFotos: listar('media/fotos', '.jpg'),
    ficheirosVideos: listar('media/videos', '.mp4').filter((v) => fs.existsSync(path.join(pasta, 'media/videos', `${v}.jpg`))),
    ficheirosIcones: listar('media/icones', '.png'),
  };
}

// ---------------------------------------------------------------- regras (as mesmas do painel)
console.log('regras (src/lib/regras.mjs, com dados de ensaio)');
const HOJE = '2026-11-16';
const chaves = (lista, classe) => lista.filter((p) => !classe || p.classe === classe).map((p) => p.chave);
const ZONAS = [
  { id: 'em-mao', nome: 'Entrega em mão', curto: 'Em mão', morada: false },
  { id: 'ctt', nome: 'Envio pelos CTT', curto: 'Pelos CTT', morada: true },
];
/* Uns dados da loja completos (nada a lembrar, nada a parar, nem em produção); cada teste estraga o seu. */
function siteDeEnsaio(mudar = () => {}) {
  const s = {
    marca: 'Flores & Essências',
    descricao: 'Flores em cera.',
    assinatura: 'Flores com óleos essenciais.',
    contactos: { whatsapp: '933 000 000', telefone: '933 000 000', email: 'ensaio@exemplo.pt', instagram: 'https://www.instagram.com/ensaio/', tiktok: '', facebook: '' },
    empresa: { nome: 'Nome de Ensaio', tipo: 'Empresária em nome individual', nif: '123456789', morada: 'Rua do Ensaio, 1', codigoPostal: '2955-000', localidade: 'Pinhal Novo', concelho: 'Palmela', iva: 'Os preços incluem IVA à taxa legal em vigor.' },
    aviso: { texto: '', ate: '', ligacao: '' },
    entrega: { zonas: structuredClone(ZONAS), emMao: 'Pinhal Novo e Palmela; combinamos o dia.', portes: { ctt: 4.5, gratisAPartirDe: null }, portesNota: '', prazo: 'Uma semana.' },
    pagamento: 'MB WAY.',
  };
  mudar(s);
  return s;
}
function inicioDeEnsaio(mudar = () => {}) {
  const h = {
    seo: { titulo: 'Flores & Essências', descricao: 'Flores em cera.' },
    capa: { titulo: 'Flores que perfumam', texto: '', botao: { texto: 'Ver a loja', ligacao: '/loja/' }, botao2: { texto: 'Conhecer', ligacao: '/a-nossa-historia/' }, foto: 'foto-a', video: '' },
    categorias: { titulo: 'O que fazemos' },
    destaque: { ligado: true, ocasiao: 'natal', titulo: 'Natal', texto: '' },
    novidades: { titulo: 'Feitos esta semana', quantas: 8 },
    historia: { titulo: 'Uma vela', texto: 'O Martim.', citacao: '', autor: '', fotos: ['foto-a', 'foto-b'], botao: 'Ler a história' },
    bastidores: { titulo: 'Nos bastidores', texto: '', videos: ['video-a'] },
    comoEncomendar: { titulo: 'Como encomendar', itens: [{ titulo: 'Pelo WhatsApp', texto: 'Uma mensagem.', icone: 'contactos' }] },
  };
  mudar(h);
  return h;
}
const problemasDoInicio = (mudar) => R.problemasDoInicio(inicioDeEnsaio(mudar), { fotos: new Set(['foto-a', 'foto-b']), videos: new Set(['video-a']), icones: ['contactos'] });
const artigoDeEnsaio = (mais = {}) => ({ nome: 'Vela de ensaio', descricao: 'Uma vela de ensaio.', preco: 6, fotos: ['foto-a'], categoria: 'arranjos', ...mais });
const CTX_ARTIGO = { nome: 'vela-de-ensaio', categorias: ['arranjos'], fotos: new Set(['foto-a']), videos: new Set(['video-a']), hoje: HOJE };

await teste('precoDe: a promoção vale até ao último dia e depois volta o preço normal; um «anterior» mais baixo não é promoção; sem preço é null', () => {
  const p = { preco: 8, precoAnterior: 10, promocaoAte: '2026-12-01' };
  assert.deepEqual(R.precoDe(p, '2026-11-30'), { atual: 8, anterior: 10, ate: '2026-12-01' });
  assert.deepEqual(R.precoDe(p, '2026-12-01'), { atual: 8, anterior: 10, ate: '2026-12-01' });
  assert.deepEqual(R.precoDe(p, '2026-12-02'), { atual: 10, anterior: null, ate: '' });
  assert.deepEqual(R.precoDe({ preco: 5, precoAnterior: 4 }, HOJE), { atual: 5, anterior: null, ate: '' });
  for (const semPreco of [{}, { preco: null }, { preco: '17 €' }]) assert.deepEqual(R.precoDe(semPreco, HOJE), { atual: null, anterior: null, ate: '' }, JSON.stringify(semPreco));
});
await teste('nifValido: nove algarismos, sem começar por 0, e o de controlo (módulo 11)', () => {
  for (const bom of ['123456789', '123 456 789', '100000002']) assert.ok(R.nifValido(bom), bom);
  for (const mau of ['123456780', '12345678', '023456789', '', null]) assert.ok(!R.nifValido(mau), String(mau));
});
await teste('as escolhas de uma peça: pela ordem nome, cores, aroma; o rótulo do artigo ou o geral; só o nome é obrigatório', () => {
  assert.deepEqual(R.personalizacaoDe({ personalizacao: { aroma: true, cores: true, nome: true, rotuloNome: 'Nome no arco-íris', rotuloCores: '  ' } }), [
    { id: 'nome', rotulo: 'Nome no arco-íris', obrigatorio: true },
    { id: 'cores', rotulo: 'Cores', obrigatorio: false },
    { id: 'aroma', rotulo: 'Aroma', obrigatorio: false },
  ]);
  assert.deepEqual(R.personalizacaoDe({ personalizacao: { nome: 'sim', cores: false } }), []);
  assert.deepEqual(R.personalizacaoDe({}), []);
  assert.deepEqual(chaves(R.problemasDoArtigo(artigoDeEnsaio({ personalizacao: { nome: 'sim' } }), CTX_ARTIGO)), ['artigo:vela-de-ensaio:personalizacao.nome']);
});
await teste('as formas de receber: em mão e pelos CTT; sem uma delas (ou com outra a mais), a publicação pára', () => {
  assert.deepEqual(R.problemasDoSite(siteDeEnsaio(), { producao: true }), []);
  for (const id of R.ZONAS) {
    const p = R.problemasDoSite(siteDeEnsaio((s) => { s.entrega.zonas = s.entrega.zonas.filter((z) => z.id !== id); }));
    assert.ok(chaves(p, 'bloqueia').includes('site:entrega.zonas'), `sem «${id}» devia parar`);
  }
  assert.ok(chaves(R.problemasDoSite(siteDeEnsaio((s) => { s.entrega.zonas.push({ id: 'europa', nome: 'Europa', curto: 'Europa', morada: true }); })), 'bloqueia').includes('site:entrega.zonas'));
});
await teste('o que a lei pede: na pré-visualização lembra sem parar; em produção param o nome, o NIF, a morada, o email, o prazo e o pagamento', () => {
  const vazios = (s) => { s.contactos.email = ''; Object.assign(s.empresa, { nome: '', nif: '', morada: '', codigoPostal: '', localidade: '', iva: '' }); s.entrega.prazo = ''; s.pagamento = ''; };
  const previa = R.problemasDoSite(siteDeEnsaio(vazios));
  assert.deepEqual(chaves(previa, 'bloqueia'), []);
  for (const k of ['site:contactos.email:vazio', 'site:empresa.nome:vazio', 'site:empresa.nif:vazio', 'site:empresa.morada:incompleta', 'site:entrega.prazo:vazio', 'site:pagamento:vazio', 'site:empresa.iva:vazio']) {
    assert.ok(previa.some((p) => p.chave === k && p.lembrete === true), `falta o lembrete ${k}`);
  }
  const producao = R.problemasDoSite(siteDeEnsaio(vazios), { producao: true });
  assert.deepEqual(chaves(producao, 'bloqueia').sort(), ['site:contactos.email:vazio:producao', 'site:empresa.morada:incompleta:producao', 'site:empresa.nif:vazio:producao', 'site:empresa.nome:vazio:producao', 'site:entrega.prazo:vazio:producao', 'site:pagamento:vazio:producao']);
});
await teste('«[por confirmar]» escrito num dado vale o mesmo que vazio (a produção pára na mesma)', () => {
  const p = R.problemasDoSite(siteDeEnsaio((s) => { s.empresa.nif = '[por confirmar]'; s.pagamento = 'Por confirmar'; }), { producao: true });
  assert.deepEqual(chaves(p, 'bloqueia').sort(), ['site:empresa.nif:vazio:producao', 'site:pagamento:vazio:producao']);
});
await teste('os portes dos CTT por dizer lembram («a confirmar» na encomenda); com a nota de como se calculam, não; um que não é número avisa', () => {
  const l = R.problemasDoSite(siteDeEnsaio((s) => { s.entrega.portes.ctt = null; })).find((p) => p.chave === 'site:entrega.portes:por-preencher');
  assert.ok(l && l.lembrete === true && /CTT/.test(l.mensagem));
  assert.ok(!chaves(R.problemasDoSite(siteDeEnsaio((s) => { s.entrega.portes.ctt = null; s.entrega.portesNota = 'Pelo peso.'; }))).includes('site:entrega.portes:por-preencher'));
  assert.ok(chaves(R.problemasDoSite(siteDeEnsaio((s) => { s.entrega.portes.ctt = '4,50 €'; })), 'avisa').includes('site:entrega.portes.ctt'));
  assert.ok(chaves(R.problemasDoSite(siteDeEnsaio((s) => { s.entrega.emMao = ''; }))).includes('site:entrega.emMao:vazio'));
});
await teste('as redes: o endereço inteiro, do sítio certo; um nome solto avisa', () => {
  assert.ok(chaves(R.problemasDoSite(siteDeEnsaio((s) => { s.contactos.instagram = 'essenciasflores1'; }))).includes('site:contactos.instagram'));
  assert.ok(chaves(R.problemasDoSite(siteDeEnsaio((s) => { s.contactos.tiktok = 'https://www.tiktok.com/@conta'; }))).every((k) => !k.startsWith('site:contactos.tiktok')));
});
await teste('a página inicial (a estrutura da B): a capa, o destaque ligado com uma ocasião que existe, duas fotografias na história, os vídeos e até quatro cartões', () => {
  assert.deepEqual(problemasDoInicio(), []);
  assert.deepEqual(chaves(problemasDoInicio((h) => { h.capa.titulo = ''; }), 'bloqueia'), ['inicio:capa.titulo:vazio']);
  assert.deepEqual(chaves(problemasDoInicio((h) => { h.capa.foto = 'nao-existe'; }), 'bloqueia'), ['inicio:capa.foto:foto']);
  assert.deepEqual(chaves(problemasDoInicio((h) => { h.destaque.ocasiao = 'carnaval'; }), 'bloqueia'), ['inicio:destaque.ocasiao']);
  assert.deepEqual(problemasDoInicio((h) => { h.destaque.ligado = false; h.destaque.ocasiao = 'carnaval'; }), [], 'desligado, a ocasião não conta');
  assert.deepEqual(chaves(problemasDoInicio((h) => { h.historia.fotos = ['foto-a']; }), 'bloqueia'), ['inicio:historia.fotos']);
  assert.deepEqual(chaves(problemasDoInicio((h) => { h.bastidores.videos = ['video-x']; }), 'bloqueia'), ['inicio:bastidores.videos.0:video']);
  assert.deepEqual(chaves(problemasDoInicio((h) => { h.comoEncomendar.itens = [1, 2, 3, 4, 5].map(() => ({ titulo: 'a', texto: 'b', icone: 'contactos' })); })), ['inicio:comoEncomendar:muitos']);
  assert.deepEqual(chaves(problemasDoInicio((h) => { h.capa.botao.ligacao = 'https://exemplo.pt/'; })), ['inicio:capa.botao.ligacao']);
  assert.deepEqual(chaves(problemasDoInicio((h) => { delete h.bastidores; }), 'bloqueia'), ['inicio:bastidores:forma']);
});
await teste('um artigo sem nome é escondido (só na cópia que o gerador lê) e não pára os outros; um artigo são não tem problemas', () => {
  assert.deepEqual(R.problemasDoArtigo(artigoDeEnsaio(), CTX_ARTIGO), []);
  const semNome = R.problemasDoArtigo(artigoDeEnsaio({ nome: '' }), CTX_ARTIGO);
  assert.deepEqual(semNome.map((p) => [p.classe, p.efeito, p.chave]), [['neutraliza', 'esconder', 'artigo:vela-de-ensaio:nome']]);
  const texto = JSON.stringify(artigoDeEnsaio({ nome: '' }));
  const dados = { artigos: { 'vela-de-ensaio': texto } };
  const n = R.neutralizar(dados, semNome);
  assert.equal(n.artigos['vela-de-ensaio'].publicado, false);
  assert.equal(dados.artigos['vela-de-ensaio'], texto, 'o neutralizar mexeu no ficheiro do artigo');
});
await teste('sem preço: «Preço por confirmar» na pré-visualização e fora do site em produção; marcas de terceiros e alegações escondem; ocasiões e vídeos desconhecidos avisam', () => {
  const semPreco = artigoDeEnsaio({ preco: null });
  assert.deepEqual(R.problemasDoArtigo(semPreco, CTX_ARTIGO).map((p) => [p.classe, p.chave, p.lembrete]), [['avisa', 'artigo:vela-de-ensaio:preco:previa', true]]);
  assert.deepEqual(R.problemasDoArtigo(semPreco, { ...CTX_ARTIGO, producao: true }).map((p) => [p.classe, p.efeito, p.chave]), [['neutraliza', 'esconder', 'artigo:vela-de-ensaio:preco:producao']]);
  assert.deepEqual(chaves(R.problemasDoArtigo(artigoDeEnsaio({ nome: 'Caneca do Stitch' }), CTX_ARTIGO)), ['artigo:vela-de-ensaio:terceiros']);
  assert.deepEqual(chaves(R.problemasDoArtigo(artigoDeEnsaio({ descricao: 'Uma vela ecológica.' }), CTX_ARTIGO)), ['artigo:vela-de-ensaio:alegacoes']);
  assert.deepEqual(chaves(R.problemasDoArtigo(artigoDeEnsaio({ ocasioes: ['natal', 'carnaval'] }), CTX_ARTIGO)), ['artigo:vela-de-ensaio:ocasioes:desconhecida']);
  assert.deepEqual(chaves(R.problemasDoArtigo(artigoDeEnsaio({ video: 'video-x' }), CTX_ARTIGO)), ['artigo:vela-de-ensaio:video']);
  assert.deepEqual(R.problemasDoArtigo(artigoDeEnsaio({ ocasioes: ['natal'], video: 'video-a', precoDesde: true, precoNota: 'cada' }), CTX_ARTIGO), []);
});
await teste('o conteúdo do repositório não tem problemas que parem a pré-visualização, e cada dado que a lei pede e ainda falta tem o seu lembrete', () => {
  const dados = dadosDoConteudo(RAIZ);
  const lista = R.problemas(dados, { hoje: hojeEmLisboa(), producao: false });
  const param = lista.filter((p) => p.classe === 'bloqueia');
  if (param.length) {
    paragem = param.map((p) => `${p.ecra}: ${p.mensagem}`);
    return 'saltado: o conteúdo de agora pára a pré-visualização; ver o fim';
  }
  const s = JSON.parse(dados.site);
  const esperados = [];
  if (!R.dito(s.entrega.prazo)) esperados.push('site:entrega.prazo:vazio');
  if (!R.dito(s.pagamento)) esperados.push('site:pagamento:vazio');
  if (!R.dito(s.contactos.email)) esperados.push('site:contactos.email:vazio');
  if (!R.dito(s.empresa.nome)) esperados.push('site:empresa.nome:vazio');
  if (!R.dito(s.empresa.nif)) esperados.push('site:empresa.nif:vazio');
  if (!R.dito(s.empresa.morada) || !R.dito(s.empresa.codigoPostal) || !R.dito(s.empresa.localidade)) esperados.push('site:empresa.morada:incompleta');
  if (!R.dito(s.empresa.iva)) esperados.push('site:empresa.iva:vazio');
  const lembretes = new Set(lista.filter((p) => p.lembrete === true).map((p) => p.chave));
  assert.deepEqual(esperados.filter((k) => !lembretes.has(k)), [], 'faltam lembretes do que a lei pede');
});

// ---------------------------------------------------------------- os scripts do browser
console.log('\nscripts do browser (src/scripts)');
const SCRIPTS = fs.readdirSync(path.join(RAIZ, 'src/scripts')).filter((f) => f.endsWith('.js')).sort();
for (const f of SCRIPTS) {
  await teste(`${f} compila`, () => {
    const r = spawnSync(process.execPath, ['--check', path.join(RAIZ, 'src/scripts', f)], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
  });
}
await teste('o browser só guarda a encomenda («flores-essencias:encomenda»), como diz a política de privacidade; nada de cookies', () => {
  const js = Object.fromEntries(SCRIPTS.map((f) => [f, lerRaiz(`src/scripts/${f}`)]));
  assert.match(js['carrinho.js'], /const CHAVE = 'flores-essencias:encomenda';/);
  for (const [f, t] of Object.entries(js)) {
    assert.doesNotMatch(t, /document\.cookie|sessionStorage|indexedDB|caches\.open/, f);
    // o localStorage só pelo «guardado» do núcleo (sempre dentro de try/catch), e sempre com a CHAVE
    if (f !== 'nucleo.js') assert.doesNotMatch(t, /localStorage/, `${f} usa o localStorage sem o guardado do núcleo`);
    for (const m of t.matchAll(/guardado\.(?:ler|gravar)\(([^,)]+)/g)) assert.equal(m[1].trim(), 'CHAVE', `${f} guarda com «${m[1]}»`);
  }
  const usadas = new Set([...Object.values(js).join('\n').matchAll(/'(flores-essencias:[\w-]+)'/g)].map((m) => m[1]));
  assert.deepEqual([...usadas], ['flores-essencias:encomenda']);
  assert.match(lerRaiz('content/paginas/politica-de-privacidade.md'), /«flores-essencias:encomenda»/);
  assert.match(lerRaiz('content/paginas/politica-de-privacidade.md'), /sem o nome nem a morada/);
});
/* O núcleo do JavaScript (src/scripts/nucleo.js) num vm, sem página: as contas do dinheiro e o preço. */
function nucleoNoVm() {
  const janela = { document: { querySelector: () => null, querySelectorAll: () => [] }, matchMedia: () => ({ matches: false, addEventListener() {} }), console };
  janela.window = janela;
  vm.createContext(janela);
  vm.runInContext(lerRaiz('src/scripts/nucleo.js'), janela, { filename: 'nucleo.js' });
  return janela.FE;
}
await teste('o preço no browser é a regra das regras (precoDe), e todos os scripts a tiram do núcleo; os euros escrevem-se como no gerador', () => {
  const FE = nucleoNoVm();
  const casos = [
    [{ preco: 8, precoAnterior: 10, promocaoAte: '2026-12-01' }, ['2026-11-30', '2026-12-01', '2026-12-02']],
    [{ preco: 8, precoAnterior: 10 }, ['2000-01-01', '2999-12-31']],
    [{ preco: 5, precoAnterior: 4, promocaoAte: '2099-01-01' }, [HOJE]],
    [{ preco: null }, [HOJE]], [{}, [HOJE]],
  ];
  for (const [p, dias] of casos) {
    for (const dia of dias) {
      const a = R.precoDe(p, dia);
      const b = FE.precoDe(p, dia);
      assert.deepEqual([b.atual, b.anterior], [a.atual, a.anterior], `${JSON.stringify(p)} a ${dia}`);
    }
  }
  for (const f of SCRIPTS.filter((x) => x !== 'nucleo.js')) assert.doesNotMatch(lerRaiz(`src/scripts/${f}`), /function precoDe|precoAnterior/, `${f} tem uma regra de preço sua`);
  for (const v of [0, 1.5, 2.5, 8.99, 15.9, 17, 1234.5]) assert.equal(FE.euros(v), euros(v), String(v));
});
await teste('o que escreve as páginas (os modelos e os scripts do browser) nunca diz «obrigação de pagar»', () => {
  const ficheiros = [...SCRIPTS.map((f) => `src/scripts/${f}`), ...fs.readdirSync(path.join(RAIZ, 'src/templates')).map((f) => `src/templates/${f}`)];
  for (const f of ficheiros) assert.doesNotMatch(lerRaiz(f), /obriga[çc][ãa]o de pagar/i, f);
});

// ---------------------------------------------------------------- construções numa cópia
console.log('\nconstrução (em cópias do repositório, com a cache das imagens)');
const FICHEIRO_MANIFESTO = path.join(RAIZ, '.cache/imagens/manifesto.json');
if (!fs.existsSync(FICHEIRO_MANIFESTO)) {
  console.error('  ✗ Faltam as imagens (.cache/imagens): corra primeiro «python3 scripts/imagens.py».');
  process.exit(1);
}
const MANIFESTO = JSON.parse(fs.readFileSync(FICHEIRO_MANIFESTO, 'utf8'));

/* A base: o repositório sem o .git, o _site, o material do cliente, as propostas e a cache; a cache
   entra como ligação simbólica (o gerador com --sem-imagens só a lê). Cada teste copia a base e estraga
   a sua cópia. O media/ (pesado) também entra por ligação: nenhum teste lhe mexe. */
const temporaria = fs.mkdtempSync(path.join(os.tmpdir(), 'flores-teste-'));
process.on('exit', () => fs.rmSync(temporaria, { recursive: true, force: true }));
const base = path.join(temporaria, 'base');
const FORA = /^[\\/](\.git|_site|_cliente|_capturas|propostas|node_modules|\.wrangler|\.cache|media)([\\/]|$)/;
fs.cpSync(RAIZ, base, { recursive: true, filter: (f) => !FORA.test(f.slice(RAIZ.length)) });
fs.symlinkSync(path.join(RAIZ, '.cache'), path.join(base, '.cache'), 'dir');
fs.symlinkSync(path.join(RAIZ, 'media'), path.join(base, 'media'), 'dir');

function copia(nome, mexer = () => {}) {
  const destino = path.join(temporaria, nome);
  fs.cpSync(base, destino, { recursive: true, verbatimSymlinks: true });
  mexer(destino);
  return destino;
}
/* O gerador, como o CI o corre (--sem-imagens). Sem o GITHUB_ACTIONS (só quem o pede): as anotações
   ::error das cópias estragadas de propósito não podem chegar a lado nenhum. */
function construir(pasta, args = ['--base=/flores-essencias'], env = {}) {
  const r = spawnSync(process.execPath, ['scripts/build.mjs', '--sem-imagens', ...args], { cwd: pasta, encoding: 'utf8', env: { ...process.env, GITHUB_ACTIONS: '', ...env } });
  return { pasta, codigo: r.status, saida: `${r.stdout}\n${r.stderr}` };
}
function json(pasta, rel, mudar) {
  const f = path.join(pasta, rel);
  const dados = JSON.parse(fs.readFileSync(f, 'utf8'));
  mudar(dados);
  fs.writeFileSync(f, `${JSON.stringify(dados, null, 2)}\n`);
}
const acrescentar = (pasta, rel, texto) => fs.appendFileSync(path.join(pasta, rel), texto);
const existeSaida = (pasta, rel) => fs.existsSync(path.join(pasta, '_site', rel));
const lerSaida = (pasta, rel) => ler(pasta, path.join('_site', rel));
function paginasHtml(pasta) {
  const raiz = path.join(pasta, '_site');
  const out = [];
  (function andar(d) {
    for (const f of fs.readdirSync(d)) {
      const p = path.join(d, f);
      if (fs.statSync(p).isDirectory()) andar(p);
      else if (f.endsWith('.html')) out.push({ rel: path.relative(raiz, p), html: fs.readFileSync(p, 'utf8') });
    }
  })(raiz);
  return out;
}
/* Os endereços de uma página: href, src, srcset, poster e action. */
function enderecos(html) {
  const out = [];
  for (const m of html.matchAll(/\s(?:href|src|poster|action)="([^"]*)"/g)) out.push(m[1].replace(/&amp;/g, '&'));
  for (const m of html.matchAll(/\ssrcset="([^"]*)"/g)) for (const parte of m[1].split(',')) out.push(parte.trim().split(/\s+/)[0]);
  return out;
}
const interno = (u) => !/^(https?:|mailto:|tel:|#|data:)/.test(u);
function catalogoDe(pasta) {
  const html = lerSaida(pasta, 'index.html');
  const url = /data-catalogo="([^"]+)"/.exec(html)[1];
  const raiz = /data-base="([^"]+)"/.exec(html)[1];
  return JSON.parse(lerSaida(pasta, url.slice(raiz.length)));
}
/* Os artigos que vão para o site, como o gerador os escolhe. */
function publicados(pasta, producao = false) {
  const dados = dadosDoConteudo(pasta);
  const n = R.neutralizar(dados, R.problemas(dados, { hoje: hojeEmLisboa(), producao }));
  return Object.entries(n.artigos).map(([slug, a]) => ({ slug, ...a })).filter((a) => a.publicado !== false && Array.isArray(a.fotos) && a.fotos.length);
}
const precoDaFicha = (pasta, slug) => /<p class="ficha__preco[^"]*"[^>]*>([\s\S]*?)<\/p>/.exec(lerSaida(pasta, `produtos/${slug}/index.html`))?.[1] || '';
/* O cartão de um artigo, com os ganchos estáveis (data-produto, data-categoria). */
const RE_CARTAO = /<li class="produto" data-produto="([a-z0-9-]+)" data-categoria="([a-z0-9-]+)"(?: data-revelar)?>([\s\S]*?)<\/li>/g;
const DOMINIO_DE_ENSAIO = 'ensaio.pt';
/* O domínio do ensaio (o build.mjs da cópia): a produção não constrói sem um. */
const comDominio = (p) => {
  const f = path.join(p, 'scripts/build.mjs');
  const antes = fs.readFileSync(f, 'utf8');
  const depois = antes.replace("const DOMINIO = '';", `const DOMINIO = '${DOMINIO_DE_ENSAIO}';`);
  assert.notEqual(depois, antes, 'o teste não conseguiu pôr o domínio no build.mjs da cópia');
  fs.writeFileSync(f, depois);
};

/* Os dados legais que os donos ainda não deram, vazios, ou preenchidos de faz-de-conta. */
const PRAZO = 'Uma semana, depois de confirmada a encomenda.';
const PAGAMENTO = 'MB WAY ou transferência bancária.';
const EM_MAO = 'Pinhal Novo e Palmela; combinamos o dia pelo WhatsApp.';
function dadosLegaisVazios(s) {
  s.contactos.email = '';
  Object.assign(s.empresa, { nome: '', nif: '', morada: '', codigoPostal: '', localidade: '', iva: '' });
  Object.assign(s.entrega, { prazo: '', emMao: '', portesNota: '', portes: { ctt: null, gratisAPartirDe: null } });
  s.pagamento = '';
}
function dadosLegaisDeEnsaio(s) {
  s.contactos.email = 'ensaio@exemplo.pt';
  Object.assign(s.empresa, { nome: 'Nome de Ensaio', tipo: 'Empresária em nome individual', nif: '123456789', morada: 'Rua do Ensaio, 1', codigoPostal: '2955-000', localidade: 'Pinhal Novo', concelho: 'Palmela', iva: 'Os preços incluem IVA à taxa legal em vigor.' });
  Object.assign(s.entrega, { prazo: PRAZO, emMao: EM_MAO, portes: { ctt: 4.5, gratisAPartirDe: null } });
  s.pagamento = PAGAMENTO;
}
/* Os artigos de ensaio, com nomes que nenhum artigo verdadeiro terá («ensaio-…»): na primeira categoria e
   com a primeira fotografia que tem versões na cache. */
function artigosDeEnsaio(pasta) {
  const fotos = JSON.parse(ler(pasta, 'content/fotos.json'));
  const foto = Object.keys(fotos).find((f) => MANIFESTO.fotos[f] && fs.existsSync(path.join(pasta, 'media/fotos', `${f}.jpg`)));
  assert.ok(foto, 'não há nenhuma fotografia com versões na cache para os artigos de ensaio');
  const categoria = JSON.parse(ler(pasta, 'content/categorias.json'))[0].slug;
  const comum = { fotos: [foto], descricao: 'Uma peça dos testes do site.', categoria, publicado: true, ordem: 1 };
  const artigos = {
    'ensaio-vela': { ...comum, nome: 'Vela de ensaio', preco: 6, personalizacao: { nome: true, cores: true, aroma: true, rotuloNome: 'Nome na vela' }, ocasioes: ['natal'] },
    'ensaio-caixa': { ...comum, nome: 'Caixa de ensaio', preco: 10, precoDesde: true, precoNota: 'conforme o modelo' },
    'ensaio-sem-preco': { ...comum, nome: 'Peça sem preço', preco: null },
    'ensaio-promocao': { ...comum, nome: 'Peça em promoção', preco: 8, precoAnterior: 10, promocaoDesde: '2026-01-01', promocaoAte: '2999-12-31' },
    'ensaio-promocao-acabada': { ...comum, nome: 'Promoção acabada', preco: 8, precoAnterior: 10, promocaoDesde: '2000-01-01', promocaoAte: '2000-01-31' },
    'ensaio-sem-nome': { ...comum, nome: '', preco: 5 },
    'ensaio-escondido': { ...comum, nome: 'Peça escondida', preco: 5, publicado: false },
    'ensaio-terceiros': { ...comum, nome: 'Caneca do Stitch', preco: 5 },
    'ensaio-foto-em-falta': { ...comum, nome: 'Peça com fotografia em falta', preco: 5, fotos: ['fotografia-que-nao-existe', foto] },
  };
  for (const [slug, a] of Object.entries(artigos)) fs.writeFileSync(path.join(pasta, 'content/produtos', `${slug}.json`), `${JSON.stringify(a, null, 2)}\n`);
  return artigos;
}
/* As cópias que servem a vários testes: feitas e construídas uma vez. */
const RECEITAS = {
  // o conteúdo de agora, tal e qual: é também o portão (se não constrói, as construções saltam-se)
  agora: { args: ['--base=/flores-essencias'], mexer: () => {} },
  // a pré-visualização com o que falta dizer e os artigos de ensaio
  ensaio: { args: ['--base=/flores-essencias'], mexer: (p) => { json(p, 'content/site.json', dadosLegaisVazios); artigosDeEnsaio(p); acrescentar(p, 'content/paginas/garantia.md', '\n\n[Ver a loja](/loja/)\n'); } },
  // a produção com os dados legais de faz-de-conta, o domínio do ensaio e os artigos de ensaio
  producao: { args: ['--producao'], mexer: (p) => { json(p, 'content/site.json', dadosLegaisDeEnsaio); artigosDeEnsaio(p); comDominio(p); } },
};
const feitas = new Map();
function construida(nome) {
  if (!feitas.has(nome)) feitas.set(nome, construir(copia(nome, RECEITAS[nome].mexer), RECEITAS[nome].args));
  const r = feitas.get(nome);
  assert.equal(r.codigo, 0, `a cópia «${nome}» não construiu:\n${r.saida}`);
  return r;
}

// O PORTÃO: a pré-visualização do conteúdo de agora tem de construir; senão, saltam-se as construções.
if (!paragem) {
  const r = construir(copia('agora'), RECEITAS.agora.args);
  feitas.set('agora', r);
  if (r.codigo !== 0) {
    const razoes = r.saida.split('\n').filter((l) => /✗|Error|parou/.test(l)).slice(0, 12);
    paragem = razoes.length ? razoes : [`o gerador saiu com o código ${r.codigo}`];
  }
}
if (paragem) console.log(seguro(`  – as construções saltam-se: a pré-visualização do conteúdo de agora não constrói\n${paragem.map((l) => `      ${l.trim()}`).join('\n')}`));

await construcao('a pré-visualização (--base=/flores-essencias): fechada aos motores de busca, em português, todas as ligações com o prefixo, e o JavaScript é a junção dos src/scripts', () => {
  const { pasta } = construida('agora');
  const paginas = paginasHtml(pasta);
  for (const f of ['index.html', 'loja/index.html', 'encomenda/index.html', 'contactos/index.html', 'a-nossa-historia/index.html', 'como-encomendar/index.html', 'termos-e-condicoes/index.html', 'politica-de-privacidade/index.html', 'desistir/index.html', 'garantia/index.html', 'resolucao-de-litigios/index.html', '404.html']) assert.ok(paginas.some((x) => x.rel === f), `falta ${f}`);
  for (const { rel, html } of paginas) {
    assert.match(html, /<html lang="pt-PT">/, rel);
    assert.match(html, /<meta name="robots" content="noindex/, rel);
    for (const u of enderecos(html).filter(interno)) {
      assert.ok(u.startsWith('/flores-essencias/'), `${rel}: ligação sem o prefixo: ${u}`);
      assert.ok(!u.includes('?'), `${rel}: ligação interna com parâmetros: ${u}`);
    }
    assert.doesNotMatch(html, /obriga[çc][ãa]o de pagar/i, rel);
  }
  assert.match(lerSaida(pasta, 'robots.txt'), /User-agent: \*\nDisallow: \/\n/);
  assert.doesNotMatch(lerSaida(pasta, 'robots.txt'), /Sitemap:/);
  assert.ok(!existeSaida(pasta, '_headers'), '_headers não é da pré-visualização');
  const js = /src="\/flores-essencias\/(assets\/site-[0-9a-f]{10}\.js)"/.exec(lerSaida(pasta, 'index.html'))[1];
  const publicado = lerSaida(pasta, js);
  for (const f of SCRIPTS) assert.ok(publicado.includes(lerRaiz(`src/scripts/${f}`)), `o ${js} não leva o src/scripts/${f} tal e qual`);
});
await construcao('um só cabeçalho em todas as páginas (o logótipo, Loja, A nossa história, Contactos, a lupa e o saco; o menu do telemóvel fora dele), e o rodapé (a marca, a Loja com as categorias, a Ajuda e «Fala connosco»), sem o nome, o NIF, a morada nem o número', () => {
  const { pasta } = construida('producao');
  for (const { rel, html } of paginasHtml(pasta)) {
    assert.equal((html.match(/<header class="topo"/g) || []).length, 1, `${rel}: cabeçalhos`);
    const topo = html.slice(html.indexOf('<header class="topo"'), html.indexOf('</header>', html.indexOf('<header class="topo"')));
    for (const t of ['>Loja<', '>A nossa história<', '>Contactos<', 'id="abrir-procura"', 'id="saco"', 'id="abrir-menu"', 'class="topo__logo"']) assert.ok(topo.includes(t), `${rel}: o cabeçalho não tem ${t}`);
    assert.match(html, /<\/header>\s*<nav class="menu" id="menu" aria-label="Menu" hidden>/, `${rel}: o menu do telemóvel não está logo a seguir ao cabeçalho`);
    const rodape = html.slice(html.indexOf('<footer class="rodape">'), html.indexOf('</footer>'));
    for (const t of ['>Loja<', '>Ajuda<', '>Fala connosco<', '>Arranjos<', '>A nossa história<', '>Como encomendar<', '>A tua encomenda<', '>Contactos<', 'class="rodape__logo"', 'logo-horizontal-branco-', 'class="rodape__frase"', 'href="https://wa.me/351933007227"', 'WhatsApp</small>', '@essenciasflores1<small>Instagram</small>', '<!-- legal-comum:livro ', '>Termos e condições<', '>Privacidade<']) assert.ok(rodape.includes(t), `${rel}: o rodapé não tem ${t}`);
    assert.match(rodape, new RegExp(`<p>© ${hojeEmLisboa().slice(0, 4)} Flores &amp; Essências</p>`), `${rel}: a linha do ©`);
    for (const t of ['Nome de Ensaio', '123456789', 'Rua do Ensaio', '933', '351933']) assert.ok(!rodape.replace(/href="[^"]*"/g, '').includes(t), `${rel}: o rodapé tem «${t}»`);
  }
  // quem vende está nos Contactos (numa linha discreta), nos Termos e na Privacidade
  for (const rel of ['contactos/index.html', 'termos-e-condicoes/index.html', 'politica-de-privacidade/index.html']) {
    const html = lerSaida(pasta, rel);
    for (const t of ['Nome de Ensaio', '123456789', 'Rua do Ensaio, 1']) assert.ok(html.includes(t), `${rel}: falta «${t}»`);
  }
});
await construcao('na pré-visualização, cada dado legal por dizer está «[por confirmar: …]» nos termos, na encomenda e nos contactos, e o registo lembra-o', () => {
  const r = construida('ensaio');
  const MARCAS = {
    'termos-e-condicoes/index.html': ['o nome de quem vende', 'o NIF', 'a morada', 'o email', 'quanto tempo leva a fazer e a entregar', 'as formas de pagamento', 'os portes dos CTT', 'onde fazemos entregas em mão', 'se os preços incluem IVA'],
    'encomenda/index.html': ['quanto tempo leva a fazer e a entregar', 'as formas de pagamento', 'onde fazemos entregas em mão'],
    'contactos/index.html': ['o email', 'o nome de quem vende', 'o NIF', 'a morada'],
    'produtos/ensaio-vela/index.html': ['onde fazemos entregas em mão', 'os portes dos CTT', 'quanto tempo leva a fazer e a entregar', 'o nome de quem vende', 'a morada', 'o email'],
  };
  for (const [pagina, marcas] of Object.entries(MARCAS)) {
    const html = lerSaida(r.pasta, pagina);
    for (const m of marcas) assert.ok(html.includes(`<mark class="por-confirmar">[por confirmar: ${esc(m)}`), `${pagina}: falta «[por confirmar: ${m}…]»`);
  }
  for (const lembrete of ['Falta o prazo', 'Faltam as formas de pagamento', 'Faltam os portes', 'Falta o email', 'Falta o NIF', 'A morada está incompleta', 'Falta dizer onde fazem entregas em mão']) {
    assert.ok(r.saida.includes(lembrete), `o registo não lembra «${lembrete}»`);
  }
});
await construcao('uma ficha por artigo publicado (com o nome no h1); as categorias sem artigos não têm página nem ligações', () => {
  const { pasta } = construida('agora');
  const pub = publicados(pasta);
  assert.deepEqual(existeSaida(pasta, 'produtos') ? fs.readdirSync(path.join(pasta, '_site/produtos')).sort() : [], pub.map((p) => p.slug).sort());
  for (const p of pub) {
    const html = lerSaida(pasta, `produtos/${p.slug}/index.html`);
    assert.ok(html.includes(`<h1 class="ficha__nome" data-nome>${esc(p.nome)}</h1>`), `${p.slug}: o título não é o nome`);
    assert.ok(html.includes(`<section class="ficha contentor" data-ficha="${p.slug}" data-categoria="${p.categoria}">`), `${p.slug}: os ganchos da ficha`);
  }
  const todas = paginasHtml(pasta).map((x) => x.html).join('\n');
  for (const c of JSON.parse(ler(pasta, 'content/categorias.json'))) {
    const temArtigos = pub.some((p) => p.categoria === c.slug);
    assert.equal(existeSaida(pasta, `loja/${c.slug}/index.html`), temArtigos, `loja/${c.slug}/`);
    if (!temArtigos) assert.ok(!todas.includes(`/flores-essencias/loja/${c.slug}/`), `há uma ligação para a categoria vazia «${c.slug}»`);
  }
});
await construcao('a loja e cada categoria: as pastilhas em cima e, por baixo, o painel que elas trocam (o título, a frase e os artigos); a pastilha da página marcada', () => {
  const { pasta } = construida('agora');
  const pub = publicados(pasta);
  const comArtigos = JSON.parse(ler(pasta, 'content/categorias.json')).filter((c) => pub.some((p) => p.categoria === c.slug));
  for (const c of [null, ...comArtigos]) {
    const rel = c ? `loja/${c.slug}/index.html` : 'loja/index.html';
    const html = lerSaida(pasta, rel);
    const main = html.slice(html.indexOf('<main'), html.indexOf('</main>'));
    const painel = main.slice(main.indexOf('data-loja-painel'));
    assert.ok(main.indexOf('class="pastilhas"') > 0 && main.indexOf('class="pastilhas"') < main.indexOf('data-loja-painel'), `${rel}: as pastilhas não estão por cima do painel`);
    assert.ok(painel.includes(`<h1>${esc(c ? c.nome : 'Loja')}</h1>`), `${rel}: o título não está no painel`);
    const cartoes = [...painel.matchAll(RE_CARTAO)];
    assert.equal(cartoes.length, c ? pub.filter((p) => p.categoria === c.slug).length : pub.length, `${rel}: os artigos`);
    if (c) assert.ok(cartoes.every((m) => m[2] === c.slug), `${rel}: um cartão com a categoria errada`);
    assert.match(main, new RegExp(`<a href="/flores-essencias/loja/${c ? `${c.slug}/` : ''}" aria-current="page">`), `${rel}: a pastilha não está marcada`);
  }
});
await construcao('o cartão do artigo não compra: a fotografia, o nome, o preço e a mesma seta em todos; nenhum botão de juntar fora da ficha', () => {
  const { pasta } = construida('agora');
  for (const { rel, html } of paginasHtml(pasta)) {
    assert.equal((html.match(/<li class="produto"/g) || []).length, [...html.matchAll(RE_CARTAO)].length, `${rel}: um cartão sem os ganchos`);
    for (const m of html.matchAll(RE_CARTAO)) {
      assert.match(m[3], /class="produto__foto"/, rel);
      assert.match(m[3], new RegExp(`<h[23] class="produto__nome" data-nome><a class="produto__ligacao" href="/flores-essencias/produtos/${m[1]}/"`), rel);
      assert.match(m[3], /<p class="produto__preco[^"]*" data-preco="(?:\d+\.\d\d|por-confirmar)"/, `${rel}: o preço sem o gancho`);
      assert.match(m[3], /<span class="produto__seta" aria-hidden="true"><svg class="ico" aria-hidden="true" focusable="false"><use href="#i-seta"\/><\/svg><\/span>/, rel);
      assert.doesNotMatch(m[3], /<button|data-juntar/, `${rel}: um cartão com um botão`);
    }
    if (!rel.startsWith('produtos/')) assert.doesNotMatch(html, /data-juntar-form/, `${rel}: juntar à encomenda fora da ficha`);
  }
});
await construcao('a página inicial (a estrutura da B): a capa com o h1, as categorias em círculos, o Natal numa fila com setas, as novidades sem repetir o Natal, a história com duas fotografias, os bastidores e «Como encomendar»', () => {
  const { pasta } = construida('agora');
  const index = lerSaida(pasta, 'index.html');
  const h = JSON.parse(ler(pasta, 'content/inicio.json'));
  assert.match(index, new RegExp(`<h1 id="capa-titulo">${escaparRe(esc(h.capa.titulo))}</h1>`));
  assert.match(index, /<div class="capa__cartao"><picture class="capa__foto">/);
  const pub = publicados(pasta);
  for (const c of JSON.parse(ler(pasta, 'content/categorias.json')).filter((k) => pub.some((p) => p.categoria === k.slug))) {
    assert.match(index, new RegExp(`<a class="categoria" href="/flores-essencias/loja/${c.slug}/" data-categoria="${c.slug}"><span class="categoria__disco"><picture>`), `o círculo de ${c.slug}`);
  }
  // a ordem das secções
  const ordem = ['class="capa ', 'class="categorias ', 'id="destaque-titulo"', 'id="novidades-titulo"', 'id="historia-titulo"', 'id="bastidores-titulo"', 'id="encomendar-titulo"'].map((t) => index.indexOf(t));
  assert.ok(ordem.every((x, i) => x > 0 && (i === 0 || x > ordem[i - 1])), `as secções não estão pela ordem da B: ${ordem}`);
  assert.match(index, /<div class="setas" data-setas-de="fila-destaque" hidden>/);
  const fila = index.slice(index.indexOf('id="fila-destaque"'), index.indexOf('</ul>', index.indexOf('id="fila-destaque"')));
  const grelha = index.slice(index.indexOf('id="novidades-titulo"'), index.indexOf('</section>', index.indexOf('id="novidades-titulo"')));
  const slugs = (t) => [...t.matchAll(/\/produtos\/([a-z0-9-]+)\//g)].map((m) => m[1]);
  assert.ok(slugs(fila).length > 0 && slugs(grelha).length > 0);
  assert.deepEqual(slugs(grelha).filter((s) => slugs(fila).includes(s)), [], 'as novidades repetem peças da fila do Natal');
  assert.ok(slugs(grelha).length <= h.novidades.quantas);
  const hist = index.slice(index.indexOf('class="historia__fotos"'), index.indexOf('class="historia__texto"'));
  assert.equal((hist.match(/<picture class="historia__foto2?">/g) || []).length, 2, 'a história leva as duas fotografias');
  assert.equal((index.match(/<li class="video">/g) || []).length, h.bastidores.videos.length);
  assert.equal((index.match(/<li class="passo"[ >]/g) || []).length, h.comoEncomendar.itens.length);
  // os pontinhos da capa (só enfeite) e o entrar ao descer (só com JavaScript: no HTML, tudo à vista)
  assert.match(index, /<span class="pontos pontos--capa" aria-hidden="true">(?:<i><\/i>){4}<\/span>/);
  assert.ok((index.match(/ data-revelar/g) || []).length >= 8, 'o entrar ao descer');
  assert.doesNotMatch(index, /class="[^"]*\brevelar\b/, 'o «revelar» só o põe o JavaScript');
  assert.match(index, /"@type":"WebSite"/);
  assert.match(index, /"@type":"Store"/);
  assert.match(index, /<title>Flores &amp; Essências — Arranjos e velas em cera, feitos à mão pelo Martim<\/title>/);
});
await construcao('o destaque da época: com ele ligado, a página da ocasião (/natal/) só com as peças dela; desligado, nem a página, nem a secção, nem as ligações', () => {
  const { pasta } = construida('agora');
  const pub = publicados(pasta).filter((p) => (p.ocasioes || []).includes('natal'));
  const html = lerSaida(pasta, 'natal/index.html');
  assert.equal([...html.matchAll(RE_CARTAO)].length, pub.length);
  const desligado = copia('destaque-desligado', (p) => json(p, 'content/inicio.json', (h) => { h.destaque.ligado = false; }));
  const r = construir(desligado);
  assert.equal(r.codigo, 0, r.saida);
  assert.ok(!existeSaida(desligado, 'natal'), 'a página do Natal ficou');
  for (const { rel, html: x } of paginasHtml(desligado)) assert.ok(!x.includes('/flores-essencias/natal/'), `${rel} liga ao Natal`);
  assert.ok(!lerSaida(desligado, 'index.html').includes('id="destaque-titulo"'));
});
await construcao('o verde do WhatsApp só nos botões que enviam a encomenda; o resto do site é terracota', () => {
  const { pasta } = construida('agora');
  for (const { rel, html } of paginasHtml(pasta)) {
    const verdes = [...html.matchAll(/<(?:a|button) class="botao botao--whatsapp[^"]*"[^>]*>[\s\S]*?<span>([^<]*)<\/span>/g)].map((m) => m[1]);
    if (rel === 'encomenda/index.html') assert.deepEqual(verdes, ['Encomendar pelo WhatsApp', 'Abrir o WhatsApp', 'Enviar outra vez'], rel);
    else assert.deepEqual(verdes, [], `${rel}: um botão verde fora da encomenda`);
  }
});
await construcao('a ficha: a categoria, o nome, o preço (com «desde» e a nota), a descrição, as escolhas que a peça deixa, o botão, e as duas linhas (a entrega e quem faz), sem acordeões', () => {
  const { pasta } = construida('ensaio');
  const vela = lerSaida(pasta, 'produtos/ensaio-vela/index.html');
  const info = vela.slice(vela.indexOf('class="ficha__info"'), vela.indexOf('</section>', vela.indexOf('class="ficha__info"')));
  const ordem = ['class="ficha__categoria"', 'class="ficha__nome"', 'class="ficha__preco', 'class="ficha__descricao"', 'data-juntar-form', 'class="ficha__linhas"'].map((t) => info.indexOf(t));
  assert.ok(ordem.every((x, i) => x > 0 && (i === 0 || x > ordem[i - 1])), `a ficha não está pela ordem: ${ordem}`);
  assert.doesNotMatch(info, /<details/);
  assert.match(info, /<input id="pz-nome" name="pers-nome"[^>]* required>/);
  assert.match(info, /<label for="pz-nome">Nome na vela /);
  assert.match(info, /name="pers-cores"/);
  assert.match(info, /name="pers-aroma"/);
  assert.equal((info.match(/<li>/g) || []).length, 2, 'as duas linhas');
  assert.match(info, /Feito à mão pelo Martim/);
  const caixa = lerSaida(pasta, 'produtos/ensaio-caixa/index.html');
  assert.match(precoDaFicha(pasta, 'ensaio-caixa'), new RegExp(`Desde </span><span class="preco__valor">${escaparRe(euros(10))}</span> <span class="preco__nota">conforme o modelo</span>`));
  assert.doesNotMatch(caixa, /name="pers-/, 'uma peça sem escolhas não tem campos');
  assert.match(precoDaFicha(pasta, 'ensaio-promocao'), new RegExp(`${escaparRe(euros(8))}[\\s\\S]*<s class="preco__antes">[\\s\\S]*${escaparRe(euros(10))}`));
  const acabada = precoDaFicha(pasta, 'ensaio-promocao-acabada');
  assert.ok(acabada.includes(euros(10)) && !acabada.includes('<s '), acabada);
  assert.match(precoDaFicha(pasta, 'ensaio-sem-preco'), /Preço por confirmar/);
  // o gancho do preço: o de hoje, com ponto e duas casas; «desde» e «por confirmar» ditos
  const gancho = (slug) => /<p class="ficha__preco[^"]*"( data-preco="[^"]*"(?: data-desde)?)>/.exec(lerSaida(pasta, `produtos/${slug}/index.html`))?.[1];
  assert.equal(gancho('ensaio-caixa'), ' data-preco="10.00" data-desde');
  assert.equal(gancho('ensaio-promocao'), ' data-preco="8.00"');
  assert.equal(gancho('ensaio-promocao-acabada'), ' data-preco="10.00"');
  assert.equal(gancho('ensaio-sem-preco'), ' data-preco="por-confirmar"');
  assert.match(vela, /"@type":"Product"/);
  assert.match(vela, /"@type":"BreadcrumbList"/);
});
await construcao('os artigos escondidos (sem nome, publicado: não, com uma personagem de terceiros) saem do site sem parar a construção; uma fotografia em falta só tira essa fotografia', () => {
  const r = construida('ensaio');
  const cat = catalogoDe(r.pasta);
  const todas = paginasHtml(r.pasta).map((x) => x.html).join('\n');
  for (const slug of ['ensaio-sem-nome', 'ensaio-escondido', 'ensaio-terceiros']) {
    assert.ok(!existeSaida(r.pasta, `produtos/${slug}`), `${slug} não devia ter ficha`);
    assert.ok(!(slug in cat.produtos), `${slug} não devia estar no catálogo`);
    assert.ok(!todas.includes(`/produtos/${slug}/`), `há uma ligação para ${slug}`);
  }
  assert.doesNotMatch(todas, /Stitch/);
  assert.match(r.saida, /Artigos › ensaio-sem-nome: escondido do site \(Falta o nome do artigo/);
  assert.match(r.saida, /Artigos › Caneca do Stitch: escondido do site/);
  assert.ok(existeSaida(r.pasta, 'produtos/ensaio-foto-em-falta/index.html'));
  assert.doesNotMatch(lerSaida(r.pasta, 'produtos/ensaio-foto-em-falta/index.html'), /fotografia-que-nao-existe/);
});
await construcao('o catálogo da encomenda leva, de cada artigo publicado, o preço, o «desde», as escolhas e a fotografia; e as formas de receber e os portes', () => {
  const { pasta } = construida('ensaio');
  const cat = catalogoDe(pasta);
  const s = JSON.parse(ler(pasta, 'content/site.json'));
  assert.equal(cat.whatsapp, numeroWhatsApp(s.contactos.whatsapp));
  assert.deepEqual([cat.assets, cat.encomenda, cat.loja], ['/flores-essencias/assets/', '/flores-essencias/encomenda/', '/flores-essencias/loja/']);
  assert.deepEqual(cat.zonas.map((z) => z.id), ['em-mao', 'ctt']);
  assert.deepEqual(cat.portes, { ctt: null, gratisAPartirDe: null });
  const pub = publicados(pasta);
  assert.deepEqual(Object.keys(cat.produtos).sort(), pub.map((p) => p.slug).sort());
  for (const p of pub) {
    const c = cat.produtos[p.slug];
    assert.deepEqual([c.preco, c.desde], [typeof p.preco === 'number' ? p.preco : null, p.precoDesde === true], p.slug);
    assert.deepEqual(c.pers, R.personalizacaoDe(p), p.slug);
    assert.equal(c.img.n, p.fotos[0], p.slug);
  }
});
await construcao('a produção (--producao) pára sem os dados legais e diz quais; no CI, como anotações ::error com o ecrã', () => {
  const pasta = copia('producao-sem-dados', (p) => { json(p, 'content/site.json', dadosLegaisVazios); comDominio(p); });
  const r = construir(pasta, ['--producao'], { GITHUB_ACTIONS: 'true' });
  assert.notEqual(r.codigo, 0, 'a produção publicou sem os dados legais');
  assert.match(r.saida, /A publicação parou: 6 problemas no conteúdo\./);
  for (const m of ['Falta o email', 'Falta o nome de quem vende', 'Falta o NIF', 'A morada está incompleta', 'Falta o prazo', 'Faltam as formas de pagamento']) assert.match(r.saida, new RegExp(`✗ Dados da loja › [^:]+: ${m}`), m);
  assert.match(r.saida, /^::error title=Dados da loja › Entrega::Falta o prazo/m);
  assert.ok(!existeSaida(pasta, 'index.html'), 'parou depois de escrever o site');
  // sem o domínio, também pára (e diz porquê)
  const semDominio = construir(copia('producao-sem-dominio', (p) => json(p, 'content/site.json', dadosLegaisDeEnsaio)), ['--producao']);
  assert.notEqual(semDominio.codigo, 0);
  assert.match(semDominio.saida, /falta o domínio do site/);
});
await construcao('com os dados legais preenchidos (de faz-de-conta) e um domínio, a produção constrói: as páginas de destino abertas e no sitemap, as legais com noindex e fora dele, os artigos sem preço de fora e listados', () => {
  const r = construida('producao');
  const { pasta } = r;
  const locs = [...lerSaida(pasta, 'sitemap.xml').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const D = `https://${DOMINIO_DE_ENSAIO}`;
  for (const l of locs) assert.ok(l.startsWith(`${D}/`), l);
  for (const p of ['/', '/loja/', '/natal/', '/produtos/ensaio-vela/', '/a-nossa-historia/', '/como-encomendar/', '/contactos/']) assert.ok(locs.includes(`${D}${p}`), `o sitemap não tem ${p}`);
  for (const p of ['/encomenda/', '/404.html', '/termos-e-condicoes/', '/politica-de-privacidade/', '/desistir/', '/garantia/', '/resolucao-de-litigios/']) assert.ok(!locs.includes(`${D}${p}`), `o sitemap tem ${p}`);
  assert.match(lerSaida(pasta, 'robots.txt'), new RegExp(`User-agent: \\*\\nAllow: /\\n\\nSitemap: ${escaparRe(D)}/sitemap\\.xml`));
  assert.doesNotMatch(lerSaida(pasta, 'robots.txt'), /Disallow/, 'o robots.txt não pode bloquear as legais (o Google tem de ver o noindex)');
  assert.match(lerSaida(pasta, '_headers'), /X-Content-Type-Options: nosniff/);
  assert.ok(fs.readdirSync(path.join(pasta, '_site')).some((f) => /^[0-9a-f]{32}\.txt$/.test(f)), 'falta a chave do IndexNow');
  const titulos = new Map();
  for (const { rel, html } of paginasHtml(pasta)) {
    assert.doesNotMatch(html, /por confirmar|por-confirmar/, rel);
    const robots = /<meta name="robots" content="([^"]+)"/.exec(html)?.[1];
    if (locs.includes(`${D}/${rel.replace(/index\.html$/, '')}`)) {
      assert.equal(robots, undefined, `${rel} está no sitemap mas fechada aos motores de busca`);
      const t = /<title>([^<]+)<\/title>/.exec(html)[1];
      assert.ok(!titulos.has(t), `${rel}: o título repete o de ${titulos.get(t)}`);
      titulos.set(t, rel);
    } else assert.match(robots || '', /noindex/, `${rel} fora do sitemap mas aberta`);
  }
  assert.ok(!existeSaida(pasta, 'produtos/ensaio-sem-preco'), 'em produção, um artigo sem preço sai do site');
  assert.match(r.saida, /ficam fora do site por não terem preço: [^\n]*ensaio-sem-preco/);
  const termos = lerSaida(pasta, 'termos-e-condicoes/index.html');
  for (const t of [PRAZO, PAGAMENTO, EM_MAO, euros(4.5), 'Rua do Ensaio, 1']) assert.ok(termos.includes(esc(t)), `os termos não dizem «${t}»`);
});
await construcao('em produção, sem dizer onde fazem entregas em mão, a entrega em mão não se oferece (nem na encomenda, nem no catálogo, nem nas fichas)', () => {
  const pasta = copia('producao-sem-em-mao', (p) => { json(p, 'content/site.json', (s) => { dadosLegaisDeEnsaio(s); s.entrega.emMao = ''; }); comDominio(p); });
  const r = construir(pasta, ['--producao']);
  assert.equal(r.codigo, 0, r.saida);
  assert.ok(!lerSaida(pasta, 'encomenda/index.html').includes('value="em-mao"'));
  assert.deepEqual(catalogoDe(pasta).zonas.map((z) => z.id), ['ctt']);
  const p = publicados(pasta, true)[0];
  assert.doesNotMatch(lerSaida(pasta, `produtos/${p.slug}/index.html`), /Entrega em mão/);
});
await construcao('os restos da Dream Art (o nome, o dono, a terra, a Mimices) param a construção, numa página, no CSS ou no JavaScript', () => {
  const casos = [
    ['restos-pagina', (p) => acrescentar(p, 'content/paginas/como-encomendar.md', '\n\nComo na Dream Art.\n'), /como-encomendar\/index\.html: tem «Dream Art» \(resto de outro site\)/],
    ['restos-css', (p) => acrescentar(p, 'src/estilos/site.css', '\n/* Rio Tinto */\n'), /assets\/site-[0-9a-f]+\.css: tem «Rio Tinto» \(resto de outro site\)/],
    ['restos-js', (p) => acrescentar(p, 'src/scripts/procura.js', '\n// dreamart:carrinho\n'), /assets\/site-[0-9a-f]+\.js: tem «dreamart» \(resto de outro site\)/],
  ];
  for (const [nome, mexer, mensagem] of casos) {
    const r = construir(copia(nome, mexer));
    assert.notEqual(r.codigo, 0, `${nome}: construiu`);
    assert.match(r.saida, mensagem, nome);
  }
});
await construcao('uma marca de terceiros, uma alegação sem prova, «obrigação de pagar», um marcador {{…}} desconhecido e uma ligação partida, numa página de texto, param a construção', () => {
  const casos = [
    ['terceiros', '\n\nComo o Stitch.\n', /«Stitch» é uma marca ou uma personagem de outros/],
    ['alegacao', '\n\nUma vela sustentável.\n', /«sustentável» é uma alegação/],
    ['obrigacao', '\n\nEncomenda com obrigação de pagar.\n', /obriga[çc][ãa]o de pagar/i],
    ['marcador', '\n\n{{inexistente}}\n', /o marcador «\{\{inexistente\}\}» não existe/],
    ['ligacao', '\n\n[Ligação partida](/nao-existe/)\n', /ligação partida: \/flores-essencias\/nao-existe\//],
  ];
  for (const [nome, texto, mensagem] of casos) {
    const r = construir(copia(nome, (p) => acrescentar(p, 'content/paginas/garantia.md', texto)));
    assert.notEqual(r.codigo, 0, `${nome}: construiu`);
    assert.match(r.saida, mensagem, nome);
  }
  assert.ok(lerSaida(construida('ensaio').pasta, 'garantia/index.html').includes('<a href="/flores-essencias/loja/">Ver a loja</a>'));
});

// ---------------------------------------------------------------- a mensagem do WhatsApp
console.log('\na mensagem do WhatsApp (o nucleo.js e o carrinho.js num vm, com a página e o catálogo construídos)');
/* A ENCOMENDA, SEM BROWSER: o nucleo.js e o carrinho.js correm num vm, com o localStorage em memória, o
   catálogo que o gerador escreveu e a página /encomenda/ que ele escreveu, reduzida ao que o carrinho lá
   procura. «Encomendar pelo WhatsApp» abre o wa.me com a mensagem escrita: apanha-se no window.open. (A
   prova no browser, de ponta a ponta, é a do scripts/provar.mjs.) */
class Elemento {
  constructor(pagina, props = {}) {
    Object.assign(this, { hidden: false, innerHTML: '', textContent: '', value: '', required: false, checked: false, disabled: false, tabIndex: 0, href: '', id: '', name: '' }, props);
    this.pagina = pagina;
    this.dataset = {};
    this.style = {};
    this.ouvintes = {};
    this.atributos = {};
    this.firstChild = { textContent: '' };
    this.classList = { add() {}, remove() {}, toggle() {}, contains: () => false };
  }
  querySelector(s) { return this.pagina.um(s); }
  querySelectorAll(s) { return this.pagina.varios(s); }
  setAttribute(k, v) { this.atributos[k] = String(v); }
  getAttribute(k) { return k in this.atributos ? this.atributos[k] : null; }
  removeAttribute(k) { delete this.atributos[k]; }
  hasAttribute(k) { return k in this.atributos; }
  addEventListener(tipo, f) { (this.ouvintes[tipo] ||= []).push(f); }
  focus() {}
  closest() { return null; }
  before() {}
  append() {}
  reset() {}
}
/* Um seletor simples existe no HTML? ([data-x], #id, tag[attr="v"], tag; os compostos não se conferem) */
function noHtml(html, s) {
  let m;
  if ((m = /^\[([\w-]+)\]$/.exec(s))) return new RegExp(`\\s${m[1]}(?=[\\s=>])`).test(html);
  if ((m = /^#([\w-]+)$/.exec(s))) return html.includes(` id="${m[1]}"`);
  if ((m = /^(\w+)\[([\w-]+)="([^"]*)"\]$/.exec(s))) return new RegExp(`<${m[1]}\\b[^>]*\\s${m[2]}="${escaparRe(m[3])}"`).test(html);
  if (/^\w+$/.test(s)) return new RegExp(`<${s}\\b`).test(html);
  return true;
}
function paginaDaEncomenda(html) {
  const pedidos = new Set();
  const unicos = new Map();
  const campos = {};
  const radios = [];
  const envio = [];
  const pagina = {
    um(s) { pedidos.add(s); if (!unicos.has(s)) unicos.set(s, new Elemento(pagina)); return unicos.get(s); },
    varios(s) {
      if (s === 'input[name="zona"]') return radios;
      if (s === '[data-obrigatorio-envio]') return envio;
      if (s === '[aria-invalid]') return Object.values(campos).filter((e) => e.hasAttribute('aria-invalid'));
      return [];
    },
  };
  const i = html.indexOf('data-encomenda-form');
  assert.ok(i >= 0, 'a página da encomenda não tem o formulário');
  const tem = (a, nome) => new RegExp(`\\s${nome}(?=[\\s=/]|$)`).test(a);
  for (const m of html.slice(i, html.indexOf('</form>', i)).matchAll(/<(?:input|textarea)\b([^>]*)>/g)) {
    const a = m[1];
    const nome = /\sname="([^"]+)"/.exec(a)?.[1];
    if (!nome) continue;
    const el = new Elemento(pagina, { name: nome, id: /\sid="([^"]+)"/.exec(a)?.[1] || '', value: /\svalue="([^"]*)"/.exec(a)?.[1] || '', required: tem(a, 'required'), checked: tem(a, 'checked') });
    if (nome === 'zona') radios.push(el); else campos[nome] = el;
    if (tem(a, 'data-obrigatorio-envio')) envio.push(el);
  }
  assert.ok(envio.length >= 3 && campos.nome?.required, 'a página da encomenda já não marca os campos obrigatórios como o carrinho espera');
  const form = new Elemento(pagina, { elements: campos });
  unicos.set('[data-encomenda-form]', form);
  return { pagina, form, campos, radios, pedidos, unicos };
}
async function encomendar(pasta, { linhas, zona, dados = {}, mudarCatalogo = () => {}, estado = null, semEnviar = false }) {
  const html = lerSaida(pasta, 'encomenda/index.html');
  const urlCatalogo = /data-catalogo="([^"]+)"/.exec(html)[1];
  const raiz = /data-base="([^"]+)"/.exec(html)[1];
  const catalogo = JSON.parse(lerSaida(pasta, urlCatalogo.slice(raiz.length)));
  mudarCatalogo(catalogo);
  const p = paginaDaEncomenda(html);
  assert.deepEqual(p.radios.map((r) => r.value), catalogo.zonas.map((z) => z.id), 'as formas de receber da página não são as do catálogo');
  for (const [k, v] of Object.entries(dados)) { assert.ok(p.campos[k], `a página da encomenda não tem o campo «${k}»`); p.campos[k].value = v; }
  const armazem = new Map([['flores-essencias:encomenda', JSON.stringify(estado || { v: 1, linhas, zona })]]);
  const abertos = [];
  const janela = {
    document: { querySelector: (s) => p.pagina.um(s), querySelectorAll: (s) => p.pagina.varios(s), body: { dataset: { catalogo: urlCatalogo, base: raiz } }, activeElement: null },
    localStorage: { getItem: (k) => (armazem.has(k) ? armazem.get(k) : null), setItem: (k, v) => { armazem.set(k, String(v)); }, removeItem: (k) => { armazem.delete(k); } },
    matchMedia: (q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} }),
    fetch: async (u) => (u === urlCatalogo ? { ok: true, status: 200, json: async () => JSON.parse(JSON.stringify(catalogo)) } : { ok: false, status: 404 }),
    open: (u) => { abertos.push(u); return {}; },
    location: { href: '' },
    addEventListener() {},
    setTimeout,
    clearTimeout,
    console,
  };
  janela.window = janela;
  vm.createContext(janela);
  vm.runInContext(`${lerRaiz('src/scripts/nucleo.js')}\n${lerRaiz('src/scripts/carrinho.js')}`, janela, { filename: 'site.js' });
  await janela.FE.catalogo();
  await new Promise((r) => setImmediate(r));
  const enviar = p.form.ouvintes.submit?.[0];
  assert.ok(enviar, 'o carrinho.js não ligou o envio da encomenda');
  if (!semEnviar) {
    await enviar({ preventDefault() {}, target: p.form });
    await new Promise((r) => setImmediate(r));
  }
  assert.deepEqual([...p.pedidos].filter((s) => !noHtml(html, s)), [], 'o carrinho procura na página da encomenda o que ela não tem');
  const url = abertos[0] || '';
  const i = url.indexOf('?text=');
  return { url, mensagem: i < 0 ? '' : decodeURIComponent(url.slice(i + 6)), guardado: armazem.get('flores-essencias:encomenda'), catalogo, unicos: p.unicos, janela, armazem };
}
/* As linhas esperadas estão na mensagem, por esta ordem. */
function emOrdem(mensagem, esperadas) {
  const linhas = mensagem.split('\n');
  let i = -1;
  for (const e of esperadas) {
    const j = linhas.indexOf(e, i + 1);
    assert.ok(j > i, `falta a linha «${e}» (ou está fora de ordem) na mensagem:\n${mensagem}`);
    i = j;
  }
}
const NUNCA = /gr[áa]tis|gratuit|obriga[çc][ãa]o de pagar|undefined|NaN|null|\[object/i;
const CLIENTE = { nome: 'Maria Ensaio', morada: 'Rua do Ensaio, 1', codigoPostal: '2955-000', localidade: 'Pinhal Novo' };
const PECAS = [
  { produto: 'ensaio-vela', pers: { nome: 'Leonor', cores: 'rosa e lilás', aroma: 'baunilha' }, qtd: 3 },
  { produto: 'ensaio-caixa', pers: {}, qtd: 2 },
];

await construcao('pelos CTT, com os portes por dizer: as peças, as escolhas e os preços («desde» na caixa), «portes a confirmar», o total, o nome e a morada; e não inventa o pagamento', async () => {
  const { pasta } = construida('ensaio');
  const r = await encomendar(pasta, { linhas: PECAS, zona: 'ctt', dados: CLIENTE });
  assert.ok(r.url.startsWith(`https://wa.me/${numeroWhatsApp(JSON.parse(ler(pasta, 'content/site.json')).contactos.whatsapp)}?text=`), r.url);
  emOrdem(r.mensagem, [
    'Olá! Quero fazer esta encomenda:',
    `*3 × Vela de ensaio* — ${euros(18)}`,
    '- Nome na vela: Leonor',
    '- Cores: rosa e lilás',
    '- Aroma: baunilha',
    `*2 × Caixa de ensaio* — desde ${euros(20)}`,
    `Peças: desde ${euros(38)}`,
    'Entrega: Pelos CTT — portes a confirmar',
    `*Total: desde ${euros(38)} + portes*`,
    'Nome: Maria Ensaio',
    'Morada: Rua do Ensaio, 1, 2955-000 Pinhal Novo',
  ]);
  assert.doesNotMatch(r.mensagem, NUNCA);
  assert.doesNotMatch(r.mensagem, /Pagamento/, 'sem as formas de pagamento ditas, a mensagem não as inventa');
  assert.ok(r.unicos.get('[data-linhas]').innerHTML.includes('Vela de ensaio'));
  // o gancho estável de cada linha: o slug da peça
  assert.deepEqual([...r.unicos.get('[data-linhas]').innerHTML.matchAll(/<li class="linha" data-produto="([a-z0-9-]+)">/g)].map((m) => m[1]), ['ensaio-vela', 'ensaio-caixa']);
  assert.ok(r.unicos.get('[data-resumo]').innerHTML.includes(`desde ${euros(38)} + portes`));
});
await construcao('em mão: sem portes e sem morada', async () => {
  const r = await encomendar(construida('ensaio').pasta, { linhas: PECAS.slice(0, 1), zona: 'em-mao', dados: CLIENTE });
  emOrdem(r.mensagem, [`*3 × Vela de ensaio* — ${euros(18)}`, `Peças: ${euros(18)}`, 'Entrega: Em mão', `*Total: ${euros(18)}*`, 'Nome: Maria Ensaio']);
  assert.doesNotMatch(r.mensagem, /portes|^Morada:/m);
  assert.doesNotMatch(r.mensagem, NUNCA);
});
await construcao('com os portes e o pagamento ditos (a produção de ensaio), leva-os e soma os portes ao total', async () => {
  const r = await encomendar(construida('producao').pasta, { linhas: PECAS.slice(0, 1), zona: 'ctt', dados: CLIENTE });
  emOrdem(r.mensagem, [`Peças: ${euros(18)}`, `Entrega: Pelos CTT — portes ${euros(4.5)}`, `*Total: ${euros(22.5)}*`, `Pagamento: ${PAGAMENTO}`, 'Nome: Maria Ensaio']);
  assert.doesNotMatch(r.mensagem, NUNCA);
});
await construcao('o preço de cada peça é o da regra (a promoção até ao fim, depois o normal); sem preço, «preço a confirmar» até ao total; uma peça que saiu da loja não entra', async () => {
  const { pasta } = construida('ensaio');
  const linhas = [{ produto: 'ensaio-sem-preco', qtd: 3 }, { produto: 'ensaio-promocao', qtd: 2 }, { produto: 'ensaio-promocao-acabada', qtd: 1 }, { produto: 'ensaio-que-saiu-da-loja', qtd: 4 }];
  const r = await encomendar(pasta, { linhas, zona: 'em-mao', dados: CLIENTE });
  emOrdem(r.mensagem, [
    '*3 × Peça sem preço* — preço a confirmar',
    `*2 × Peça em promoção* — ${euros(16)}`,
    `*1 × Promoção acabada* — ${euros(10)}`,
    `Peças: ${euros(26)} + a confirmar`,
    '*Total: a confirmar convosco*',
  ]);
  assert.doesNotMatch(r.mensagem, /4 ×|ensaio-que-saiu/);
});
await construcao('o browser guarda a encomenda e a hora do envio, nunca o nome nem a morada (como promete a política de privacidade)', async () => {
  const r = await encomendar(construida('ensaio').pasta, { linhas: PECAS, zona: 'ctt', dados: CLIENTE });
  const g = JSON.parse(r.guardado);
  assert.deepEqual(g.linhas.map((l) => [l.produto, l.qtd]), [['ensaio-vela', 3], ['ensaio-caixa', 2]]);
  assert.ok(g.enviada && typeof g.enviada.em === 'string', 'falta a marca «enviada»');
  for (const v of Object.values(CLIENTE)) assert.ok(!r.guardado.includes(v), `o browser guardou «${v}»`);
});
await construcao('sem o nome (ou, pelos CTT, sem a morada), não abre o WhatsApp e diz o que falta', async () => {
  const { pasta } = construida('ensaio');
  const semNome = await encomendar(pasta, { linhas: PECAS, zona: 'em-mao', dados: { ...CLIENTE, nome: '' } });
  assert.equal(semNome.url, '');
  const erro = semNome.unicos.get('[data-erro-encomenda]');
  assert.ok(erro && erro.hidden === false && /^Falta preencher/.test(erro.textContent), 'não diz o que falta');
  const semMorada = await encomendar(pasta, { linhas: PECAS, zona: 'ctt', dados: { ...CLIENTE, morada: '' } });
  assert.equal(semMorada.url, '');
});
await construcao('depois de recarregar, a encomenda enviada não abre um WhatsApp vazio: «Enviar outra vez» volta ao formulário; uma peça nova começa outra encomenda', async () => {
  const { pasta } = construida('ensaio');
  const primeira = await encomendar(pasta, { linhas: PECAS, zona: 'ctt', dados: CLIENTE });
  assert.ok(primeira.unicos.get('[data-continuar]').href.includes('?text='), '«Abrir o WhatsApp» sem a mensagem');
  const r = await encomendar(pasta, { estado: JSON.parse(primeira.guardado), semEnviar: true });
  assert.equal(r.unicos.get('[data-enviada]').hidden, false, 'não diz «Encomenda enviada»');
  assert.equal(r.unicos.get('[data-continuar]').hidden, true, '«Abrir o WhatsApp» abria a conversa sem a mensagem');
  assert.equal(r.unicos.get('[data-reenviar]').hidden, false, 'falta «Enviar outra vez»');
  const { juntar } = r.janela.FE.carrinho;
  assert.equal(juntar({ produto: 'ensaio-vela', pers: { nome: 'Rita' } }).nova, true, 'não disse que é uma encomenda nova');
  assert.equal(juntar({ produto: 'ensaio-vela', pers: { nome: 'rita' } }).nova, false);
  const g = JSON.parse(r.armazem.get('flores-essencias:encomenda'));
  assert.deepEqual(g.linhas.map((l) => [l.produto, l.pers.nome, l.qtd]), [['ensaio-vela', 'Rita', 1], ['ensaio-vela', 'rita', 1]]);
  assert.equal(g.zona, 'ctt', 'a encomenda nova perdeu a entrega escolhida');
});

// ---------------------------------------------------------------- fim
console.log('');
if (paragem) {
  console.log(seguro(`As construções saltaram: a pré-visualização do conteúdo de agora não constrói.\n${paragem.map((l) => `  ${l.trim()}`).join('\n')}`));
  if (NO_CI) console.log('O passo seguinte (o gerador) pára e dá as razões.');
  else process.exitCode = 1;
}
const tempo = `${((Date.now() - comeco) / 1000).toFixed(1)} s`;
console.log(falharam ? `${falharam} ${falharam === 1 ? 'teste falhou' : 'testes falharam'} (${passaram} passaram, ${tempo}).` : `${passaram} testes passaram${saltados ? `, ${saltados} saltados` : ''} (${tempo}).`);
