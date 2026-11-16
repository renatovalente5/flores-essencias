/* AS REGRAS DOS DADOS DA FLORES & ESSÊNCIAS, NUM SÓ SÍTIO.
 *
 * Três leitores, e os três têm de ouvir o mesmo:
 *   · o gerador do site (scripts/build.mjs), antes de escrever as páginas;
 *   · o painel, no browser (o erro aparece por baixo do campo, antes de gravar);
 *   · o Worker do painel, ao gravar (recusa os problemas NOVOS que não sejam
 *     lembretes).
 * O painel há de usar uma CÓPIA BYTE A BYTE deste ficheiro, com um teste de
 * SHA-256 que falha se divergirem. Por isso é um ES module puro: nenhum import,
 * nada de node:*, fs, process ou require. Corre tal e qual no browser, num
 * Worker e no Node.
 * (A forma vem das regras dos outros sites do Renato; o modelo é o da Flores &
 * Essências, 16 nov 2026: entrega em mão ou pelos CTT, a personalização com o
 * nome, as cores e o aroma, e as ocasiões.)
 *
 * CADA PROBLEMA TEM UMA CLASSE:
 *   · bloqueia   — a publicação pára e o site fica como estava. Só a estrutura
 *                  (um JSON que não se lê, um ficheiro sem a forma que o gerador
 *                  precisa) e o que todas as páginas usam (contactos, zonas de
 *                  entrega, a página inicial). Em PRODUÇÃO, também os dados que a
 *                  lei pede (identificação, NIF, morada, email — DL 7/2004,
 *                  art. 10.º; prazo e pagamento — DL 24/2014, art. 4.º).
 *   · neutraliza — um artigo, só na cópia que o gerador lê (o ficheiro do
 *                  repositório não muda — ver neutralizar()): sem nome, sem texto,
 *                  sem fotografia, numa categoria que não existe, com uma marca ou
 *                  personagem de terceiros — e, em produção, sem preço — fica
 *                  escondido do site; uma fotografia que não existe não aparece.
 *                  Um problema de UM artigo nunca pára a publicação dos outros.
 *   · avisa      — só aviso. No painel, os que não são lembrete são erro de campo
 *                  (valor fora da lista, número fora dos limites, texto comprido de
 *                  mais): o painel não os deixa gravar. Os LEMBRETES (lembrete:
 *                  true) não são erro de ninguém: o painel grava na mesma e
 *                  mostra-os no Início.
 *
 * dados = {
 *   site:       texto | objecto | null,               content/site.json
 *   inicio:     texto | objecto | null,               content/inicio.json
 *   categorias: texto | objecto | null,               content/categorias.json
 *   fotos:      texto | objecto | null,               content/fotos.json
 *   videos:     texto | objecto | null,               content/videos.json
 *   artigos:    { <nome>: texto | objecto | null },   content/produtos/<nome>.json
 *   ficheirosFotos:  [nome],  os nomes (sem .jpg) dos ficheiros em media/fotos/
 *   ficheirosVideos: [nome],  os nomes (sem .mp4) dos vídeos em media/videos/ (com a capa .jpg)
 *   ficheirosIcones: [nome],  os nomes (sem .png) dos ícones em media/icones/
 * }
 *   <nome> é o nome do ficheiro sem «.json», que é o endereço da página
 *   (/produtos/<nome>/). texto = o conteúdo do ficheiro; null = não existe.
 *   Uma chave de topo AUSENTE não se confere (o painel pode conferir só um
 *   artigo); presente e null é «falta o ficheiro».
 *
 * problema = {
 *   classe:   'bloqueia' | 'neutraliza' | 'avisa',
 *   chave:    estável ('artigo:<slug>:<regra>', 'site:<campo>[:<regra>]'…). O Worker
 *             compara as chaves do HEAD com as da gravação e recusa só as novas;
 *             por isso UMA CHAVE TEM SEMPRE A MESMA CLASSE (o que muda com a
 *             produção tem uma chave própria, com «:producao» ou «:previa»).
 *   ficheiro: o caminho do ficheiro;
 *   ecra:     o ecrã do painel onde se corrige («Artigos › Vela fantasminha»);
 *   mensagem: para a dona, em português simples, sem caminhos de JSON;
 *   campo?:   o campo onde o painel mostra o erro ('preco', 'personalizacao.nome');
 *   efeito?:  só nos «neutraliza»: 'esconder' | 'sem_fotografia';
 *   slug?, foto?, indice?, lembrete?
 * }
 *
 * «NÃO FOI DITO», NULL E «[POR CONFIRMAR]» SÃO O MESMO. E o vazio testa-se ANTES
 * de converter: Number(null) é 0, e 0 é uma escolha.
 */

/* ------------------------------------------------------------------ */
/* Onde estão as coisas                                                */
/* ------------------------------------------------------------------ */

export const FICHEIROS = Object.freeze({
  site: 'content/site.json',
  inicio: 'content/inicio.json',
  categorias: 'content/categorias.json',
  fotos: 'content/fotos.json',
  videos: 'content/videos.json',
});
export const PASTAS = Object.freeze({ artigos: 'content/produtos', fotos: 'media/fotos', videos: 'media/videos', icones: 'media/icones' });
export const ficheiroDoArtigo = (nome) => `${PASTAS.artigos}/${nome}.json`;
export const ficheiroDaFoto = (nome) => `${PASTAS.fotos}/${nome}.jpg`;

/* As duas formas de receber (content/site.json, entrega.zonas): em mão, sem morada, e pelos CTT, com
   a morada. Os portes são da encomenda (entrega.portes), não de cada artigo. */
export const ZONAS = Object.freeze(['em-mao', 'ctt']);
export const ZONAS_ENVIO = Object.freeze(['ctt']);
export const NOMES_ZONAS = Object.freeze({ 'em-mao': 'a entrega em mão', ctt: 'o envio pelos CTT' });

/* As ocasiões (o campo «ocasioes» dos artigos). A da época (inicio.destaque.ocasiao) tem página própria
   (/<ocasião>/) enquanto o destaque estiver ligado. */
export const OCASIOES = Object.freeze({
  natal: 'Natal', pascoa: 'Páscoa', 'dia-da-mae': 'Dia da Mãe', 'dia-do-pai': 'Dia do Pai', namorados: 'Dia dos Namorados',
  outono: 'Outono', halloween: 'Halloween', professores: 'Professores', aniversario: 'Aniversário',
  batizado: 'Batizado', comunhao: 'Comunhão', casamento: 'Casamento',
});

/* Os campos de um artigo, PELA ORDEM DO FORMULÁRIO. Uma chave nova entra por esta
   ordem (ordenarComo()); as que já estão no ficheiro ficam onde estão. */
export const CAMPOS_ARTIGO = Object.freeze([
  'nome', 'fotos', 'descricao',
  'preco', 'precoDesde', 'precoNota', 'precoAnterior', 'promocaoDesde', 'promocaoAte',
  'personalizacao', 'video',
  'referencia', 'fabricante', 'avisos', 'perigos', 'idade', 'naoBrinquedo',
  'categoria', 'ocasioes', 'novidade', 'publicado', 'ordem',
]);
/* A informação legal de cada artigo, toda opcional e só mostrada na ficha quando está preenchida: a
   referência e o fabricante (Regulamento (UE) 2023/988, art. 19.º: nome, morada e email — vazio, a ficha
   diz os dados da loja), os avisos de segurança e os perigos de uma mistura (velas e wax melts com óleos
   essenciais: Regulamento (CE) 1272/2008, CLP; um por linha), a idade recomendada e «Não é um brinquedo»
   (DL 43/2011: as peças 3D articuladas). */
export const CAMPOS_FABRICANTE = Object.freeze(['nome', 'morada', 'email']);
/* Sempre escritos pelo painel, com o valor explícito. Ausentes valem o valor por omissão. */
export const BOOLEANOS_ARTIGO = Object.freeze(['precoDesde', 'novidade', 'publicado']);
export const POR_OMISSAO = Object.freeze({ publicado: true, novidade: false, precoDesde: false, ordem: 500 });

export const NOMES_CAMPOS = Object.freeze({
  nome: 'Nome do artigo', fotos: 'Fotografias', descricao: 'Descrição',
  preco: 'Preço', precoDesde: 'Preço «desde»', precoNota: 'Nota do preço', precoAnterior: 'Preço anterior',
  promocaoAte: 'Fim da promoção', promocaoDesde: 'Início da promoção',
  personalizacao: 'Escolhas', video: 'Vídeo',
  referencia: 'Referência', fabricante: 'Fabricante', avisos: 'Avisos de segurança', perigos: 'Perigos (misturas)', idade: 'Idade recomendada', naoBrinquedo: 'Não é um brinquedo',
  categoria: 'Categoria', ocasioes: 'Ocasiões', novidade: 'Novidade', publicado: 'Publicado no site', ordem: 'Posição na lista',
});

/* As escolhas de uma peça, que cada artigo liga ou desliga: o nome a escrever (obrigatório, quando
   ligado), as cores e o aroma (opcionais: vazios, combinam-se pelo WhatsApp). Os rótulos mudam-se por
   artigo (rotuloNome: «Nome no arco-íris»). */
export const CAMPOS_PERSONALIZACAO = Object.freeze(['nome', 'cores', 'aroma']);
export const ROTULOS_PERSONALIZACAO = Object.freeze({ nome: 'Nome na peça', cores: 'Cores', aroma: 'Aroma' });
export const ROTULOS_CHAVES = Object.freeze({ nome: 'rotuloNome', cores: 'rotuloCores', aroma: 'rotuloAroma' });

/* ------------------------------------------------------------------ */
/* Limites                                                             */
/* ------------------------------------------------------------------ */

/* Os números: [mínimo, máximo]. */
export const LIMITES = Object.freeze({ preco: [0.01, 100000], portes: [0, 10000], ordem: [0, 9999], novidades: [0, 24] });
/* Tamanhos máximos dos textos, em caracteres. */
export const TAMANHOS = Object.freeze({
  nome: 120, descricao: 1200, precoNota: 80,
  referencia: 40, avisos: 600, perigos: 400, idade: 80, fabricanteNome: 120, fabricanteMorada: 200,
  rotulo: 40, ocasioes: 12,
  fotos: 16, nomeFoto: 120, alt: 300, legenda: 120,
  marca: 60, descricaoSite: 300, assinatura: 100, email: 160, telefone: 20, rede: 200,
  empresaNome: 160, empresaTipo: 80, nif: 20, morada: 160, codigoPostal: 12, localidade: 60, concelho: 60, iva: 200,
  avisoTexto: 140, ligacao: 200, prazo: 400, pagamento: 400, emMao: 300, portesNota: 300,
  catNome: 40, catTitulo: 80, catFrase: 200,
  inicioCurto: 60, inicioTitulo: 120, inicioTexto: 600, inicioLongo: 1200,
});
/* O que o Worker do painel aceita gravar (recusa acima); aqui só se lembra, a
   partir de 80 %. */
export const TECTOS = Object.freeze({ artigoBytes: 64 * 1024, siteBytes: 64 * 1024, aviso: 0.8 });

/* As palavras que a lei só deixa usar com prova (Diretiva (UE) 2024/825,
   aplicável desde 27 set 2026: alegações ambientais genéricas) e as
   certificações que não nos mostraram (CE, EN 71, FSC). */
export const RE_ALEGACOES = /\b(ecol[óo]gic[oa]s?|sustent[áa]ve(l|is)|sustentabilidade|amig[oa]s? do ambiente|eco-?friendly|biodegrad[áa]ve(l|is)|neutr[oa]s? em carbono|certificad[oa]s?|FSC|EN ?71|marca[çc][ãa]o CE)\b/i;
/* Personagens e marcas de terceiros (o Renato, 16 nov 2026: fora do site). Um artigo que as nomeie fica
   escondido; uma página de texto que as nomeie pára a publicação. */
export const RE_TERCEIROS = /\b(stitch|disney|frozen|hello kitty|minnie|mickey|marvel|pok[eé]mon|patrulha pata|paw patrol|barbie|benfica|sporting|fc porto|pingo doce|littlest pet shop|lego)\b/i;
/* O que se escreve no lugar de um dado que ainda não se sabe: vale o mesmo que vazio. */
const RE_POR_CONFIRMAR = /^\s*\[?\s*(por confirmar|por indicar|a confirmar|a indicar)\b/i;

/* ------------------------------------------------------------------ */
/* Ajudantes que o painel e o Worker também usam                      */
/* ------------------------------------------------------------------ */

const eObjecto = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const ausente = (x) => x === null || x === undefined;
const vazio = (x) => ausente(x) || (typeof x === 'string' && (x.trim() === '' || RE_POR_CONFIRMAR.test(x))) || (Array.isArray(x) && x.length === 0);
const temTexto = (x) => typeof x === 'string' && x.trim() !== '' && !RE_POR_CONFIRMAR.test(x);
const tem = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const duasCasas = (n) => Math.abs(Math.round(n * 100) - n * 100) < 1e-6;
const bytesDe = (s) => new TextEncoder().encode(s).length;
const RE_DATA = /^\d{4}-\d{2}-\d{2}$/;
export const dataValida = (s) => {
  if (typeof s !== 'string' || !RE_DATA.test(s)) return false;
  const [a, m, d] = s.split('-').map(Number);
  const x = new Date(Date.UTC(a, m - 1, d));
  return x.getUTCFullYear() === a && x.getUTCMonth() === m - 1 && x.getUTCDate() === d;
};
/* Um texto dito: com letras, e não «[por confirmar]». */
export const dito = temTexto;

export const terminacaoDe = (texto) => (typeof texto === 'string' && texto.endsWith('\n') ? '\n' : '');
/* Como os ficheiros estão escritos: 2 espaços e a terminação de cada um (todos
   com \n no fim). Abrir e gravar sem mexer deixa o ficheiro igual, byte a byte. */
export function serializar(obj, terminacao = '\n') { return JSON.stringify(obj, null, 2) + (terminacao || ''); }

/* O endereço da página, a partir do nome do ficheiro — IGUAL ao do gerador, que
   usa o nome tal e qual. */
export const slugDoFicheiro = (nome) => String(nome).replace(/\.json$/, '');
const RE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const slugValido = (s) => typeof s === 'string' && s.length <= 100 && RE_SLUG.test(s);

/* NIF português: 9 algarismos (com ou sem espaços), o primeiro nunca é 0, e o de
   controlo (módulo 11). */
export function nifValido(nif) {
  const s = String(nif ?? '').replace(/\s/g, '');
  if (!/^[1-9][0-9]{8}$/.test(s)) return false;
  let soma = 0;
  for (let i = 0; i < 8; i++) soma += Number(s[i]) * (9 - i);
  const resto = soma % 11;
  return (resto < 2 ? 0 : 11 - resto) === Number(s[8]);
}

/* O SLUG DE UM ARTIGO NOVO: gerado UMA vez, ao criar, a partir do nome, e nunca
   mais muda — é o endereço da página que a loja partilha no WhatsApp e no
   Instagram. Minúsculas, sem acentos, o resto passa a hífen. Repetido: -2, -3… */
export function gerarSlug(nome, existentes = []) {
  const ja = existentes instanceof Set ? existentes : new Set(existentes);
  let base = String(ausente(nome) ? '' : nome)
    .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+/, '').slice(0, 80).replace(/-+$/, '');
  if (!base) base = 'artigo';
  let slug = base;
  for (let n = 2; ja.has(slug); n++) slug = `${base}-${n}`;
  return slug;
}

/* O NOME DE UMA FOTOGRAFIA (ou de um vídeo, ou de um ícone): o do ficheiro, sem a
   extensão. Só minúsculas, algarismos e hífens (um espaço num nome parte o srcset). */
export const nomeDeFotoValido = (n) => typeof n === 'string' && n.length <= TAMANHOS.nomeFoto && RE_SLUG.test(n);

/* Caracteres de controlo, por escape e nunca literais no código. */
const RE_CONTROLO_LINHA = /[\u0000-\u001F\u007F]/;
const RE_CONTROLO_TEXTO = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
/* «</script» e «<!--»: dentro de um <script> do JSON-LD, um fecha o elemento a
   meio e o outro muda a forma como o browser o lê. Não há texto honesto que os
   precise. */
const RE_PARTE_A_PAGINA = /<\/script|<!--/i;

export const RE_EMAIL = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
export const emailValido = (v) => typeof v === 'string' && v.length <= TAMANHOS.email && RE_EMAIL.test(v.trim());

/* Um número português de 9 algarismos, ou com o indicativo (+351, 00351, 351).
   → os 9 algarismos, ou null. O WhatsApp das encomendas é um telemóvel. */
export function numeroPortugues(v) {
  if (typeof v !== 'string' && typeof v !== 'number') return null;
  let d = String(v).replace(/[\s.-]/g, '');
  if (d.startsWith('+351')) d = d.slice(4); else if (d.startsWith('00351')) d = d.slice(5); else if (/^351\d{9}$/.test(d)) d = d.slice(3);
  return /^[29]\d{8}$/.test(d) ? d : null;
}
export const eTelemovel = (v) => /^9[1236]\d{7}$/.test(numeroPortugues(v) ?? '');

/* As redes: o endereço inteiro, do sítio certo. */
export const REDES = Object.freeze({
  instagram: { rotulo: 'Instagram', re: /^https:\/\/(www\.)?instagram\.com\/[A-Za-z0-9._]{1,30}\/?$/, exemplo: 'https://www.instagram.com/essenciasflores1/' },
  tiktok: { rotulo: 'TikTok', re: /^https:\/\/(www\.)?tiktok\.com\/@[A-Za-z0-9._]{1,30}\/?$/, exemplo: 'https://www.tiktok.com/@conta' },
  facebook: { rotulo: 'Facebook', re: /^https:\/\/(www\.)?facebook\.com\/[A-Za-z0-9.\-_/?=]{1,100}$/, exemplo: 'https://www.facebook.com/pagina' },
});

/* O preço que vale num dia («AAAA-MM-DD», em Lisboa). «preco» é o preço de venda
   (o da promoção, quando há uma) e «precoAnterior» o normal. Acabada a promoção,
   volta o preço normal. Sem preço (ainda por dizer), atual é null. A MESMA regra
   está no núcleo do site (src/scripts/nucleo.js, precoDe): o site e o carrinho
   nunca discordam. */
export function precoDe(p, hoje) {
  if (typeof p.preco !== 'number') return { atual: null, anterior: null, ate: '' };
  const emPromocao = Boolean(p.precoAnterior) && p.precoAnterior > p.preco && (!p.promocaoAte || hoje <= p.promocaoAte);
  if (emPromocao) return { atual: p.preco, anterior: p.precoAnterior, ate: p.promocaoAte || '' };
  if (p.precoAnterior && p.promocaoAte && hoje > p.promocaoAte) return { atual: p.precoAnterior, anterior: null, ate: '' };
  return { atual: p.preco, anterior: null, ate: '' };
}

/* As escolhas de um artigo, já limpas: os campos ligados, pela ordem nome, cores, aroma, com o rótulo
   (o do artigo ou o geral) e se é obrigatório (só o nome). */
export function personalizacaoDe(a) {
  const p = eObjecto(a) && eObjecto(a.personalizacao) ? a.personalizacao : {};
  return CAMPOS_PERSONALIZACAO.filter((c) => p[c] === true).map((c) => {
    const r = p[ROTULOS_CHAVES[c]];
    return { id: c, rotulo: temTexto(r) ? r.trim() : ROTULOS_PERSONALIZACAO[c], obrigatorio: c === 'nome' };
  });
}

/* As ocasiões de um artigo, só as que existem. */
export const ocasioesDe = (a) => (eObjecto(a) && Array.isArray(a.ocasioes) ? a.ocasioes.filter((o) => typeof o === 'string' && tem(OCASIOES, o)) : []);

/* Igualdade de valores lidos de JSON, com null ≡ ausente e sem ligar à ordem
   das chaves. */
export function mesmoValor(a, b) {
  if (ausente(a) && ausente(b)) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => mesmoValor(x, b[i]));
  }
  if (eObjecto(a) || eObjecto(b)) {
    if (!eObjecto(a) || !eObjecto(b)) return false;
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) if (!mesmoValor(a[k], b[k])) return false;
    return true;
  }
  return a === b;
}

/* Os textos de um valor (em profundidade), com o caminho de cada um. */
function textosDe(v, caminho = '') {
  if (typeof v === 'string') return [[caminho, v]];
  const filhos = Array.isArray(v) ? Array.from(v, (x, i) => [i, x]) : eObjecto(v) ? Object.entries(v) : [];
  return filhos.flatMap(([k, x]) => textosDe(x, caminho ? `${caminho}.${k}` : String(k)));
}

/* Lê um ficheiro: o TEXTO (string), o objecto já lido, ou null/undefined. */
function lerJson(valor) {
  if (ausente(valor)) return { ausente: true };
  if (typeof valor !== 'string') return { obj: valor, texto: null };
  try { return { obj: JSON.parse(valor), texto: valor }; } catch (e) { return { ilegivel: String((e && e.message) || e).slice(0, 120), texto: valor }; }
}

/* As categorias de content/categorias.json: [{ slug, nome }], ou null se não se lê. */
export function categoriasDe(valor) {
  const l = lerJson(valor);
  if (!Array.isArray(l.obj)) return null;
  return l.obj.filter((c) => eObjecto(c) && temTexto(c.slug)).map((c) => ({ slug: c.slug, nome: temTexto(c.nome) ? c.nome.trim() : c.slug }));
}

/* As fotografias que existem para o site: as que têm ficheiro em media/fotos/ E
   entrada em content/fotos.json (o gerador precisa das duas: o ficheiro para as
   versões web, a entrada para o texto alternativo). → Set de nomes, ou null se
   não se sabe (sem a lista dos ficheiros). */
export function fotosQueExistem(dados) {
  const d = eObjecto(dados) ? dados : {};
  if (!Array.isArray(d.ficheirosFotos)) return null;
  const f = lerJson(d.fotos);
  const meta = eObjecto(f.obj) ? f.obj : {};
  return new Set(d.ficheirosFotos.filter((n) => eObjecto(meta[n])));
}
/* Os vídeos que existem: com o ficheiro (e a capa) em media/videos/ E a entrada em content/videos.json. */
export function videosQueExistem(dados) {
  const d = eObjecto(dados) ? dados : {};
  if (!Array.isArray(d.ficheirosVideos)) return null;
  const f = lerJson(d.videos);
  const meta = eObjecto(f.obj) ? f.obj : {};
  return new Set(d.ficheirosVideos.filter((n) => eObjecto(meta[n])));
}

/* ------------------------------------------------------------------ */
/* Um artigo                                                            */
/* ------------------------------------------------------------------ */

/* No site, como o gerador decide: tudo menos `publicado: false`. */
export const noSite = (a) => eObjecto(a) && a.publicado !== false;
/* O nome que o ecrã mostra, numa linha só, cortado a 80. */
export const nomeDoArtigo = (a, slug) => {
  const n = eObjecto(a) && temTexto(a.nome) ? a.nome.replace(/[\u0000-\u001F\u007F]+/g, ' ').replace(/\s+/g, ' ').trim() : '';
  const curto = n.length > 80 ? `${n.slice(0, 79)}…` : n;
  return curto || slug || 'artigo sem nome';
};
const ecraDoArtigo = (a, slug) => `Artigos › ${nomeDoArtigo(a, slug)}`;

/* Os problemas de UM artigo. O painel usa-o campo a campo.
   ctx = { nome, categorias?: [slug] | null, fotos?: Set | null (as que existem),
           videos?: Set | [nome] | null, hoje?: 'AAAA-MM-DD', producao?: boolean }
   O que falta no ctx não se confere. */
export function problemasDoArtigo(a, ctx = {}) {
  const nome = typeof ctx.nome === 'string' ? ctx.nome : '';
  const slug = slugDoFicheiro(nome);
  const ficheiro = ficheiroDoArtigo(nome);
  const categorias = Array.isArray(ctx.categorias) ? ctx.categorias : null;
  const fotosExistem = ctx.fotos instanceof Set ? ctx.fotos : null;
  const videos = ctx.videos instanceof Set ? ctx.videos : Array.isArray(ctx.videos) ? new Set(ctx.videos) : null;
  const out = [];
  const ecra = ecraDoArtigo(a, slug);
  const base = { ficheiro, ecra, slug };
  const chave = (regra) => `artigo:${slug}:${regra}`;
  const neutraliza = (regra, efeito, campo, mensagem, extra = {}) => out.push({ classe: 'neutraliza', chave: chave(regra), campo, efeito, mensagem, ...base, ...extra });
  const avisa = (regra, campo, mensagem, extra = {}) => out.push({ classe: 'avisa', chave: chave(regra), campo, mensagem, ...base, ...extra });
  const lembra = (regra, campo, mensagem, extra = {}) => avisa(regra, campo, mensagem, { lembrete: true, ...extra });
  if (!eObjecto(a)) return out;   // a forma do ficheiro é do problemas(): bloqueia

  // --- neutraliza: o que o site não pode mostrar --------------------------
  for (const [campo, falta, genero] of [['nome', 'o nome do artigo', 'o'], ['descricao', 'a descrição', 'a']]) {
    const x = a[campo];
    if (vazio(x)) neutraliza(campo, 'esconder', campo, `Falta ${falta}: o artigo fica escondido do site até estar preenchid${genero}.`);
    else if (typeof x !== 'string') neutraliza(campo, 'esconder', campo, `«${NOMES_CAMPOS[campo]}» tem de ser texto: o artigo fica escondido do site até ser corrigido.`);
  }
  const cat = a.categoria;
  if (vazio(cat)) neutraliza('categoria', 'esconder', 'categoria', 'Falta a categoria: o artigo fica escondido do site até escolher uma.');
  else if (typeof cat !== 'string' || (categorias && !categorias.includes(cat))) neutraliza('categoria', 'esconder', 'categoria', 'A categoria não é nenhuma das do site: o artigo fica escondido até escolher uma da lista.');

  /* O preço: sem ele, na pré-visualização o artigo aparece com «Preço por confirmar» (e pode ir na
     encomenda, com «preço a confirmar» na mensagem); no domínio fica escondido até haver um. */
  const p = a.preco;
  if (vazio(p)) {
    if (ctx.producao) neutraliza('preco:producao', 'esconder', 'preco', 'Falta o preço: o artigo fica escondido do site até o escrever.');
    else lembra('preco:previa', 'preco', 'Falta o preço: na pré-visualização aparece «Preço por confirmar», e no site a sério o artigo fica escondido até o escrever.');
  } else if (typeof p !== 'number' || !Number.isFinite(p) || p < LIMITES.preco[0] || p > LIMITES.preco[1] || !duasCasas(p)) {
    neutraliza('preco', 'esconder', 'preco', 'O preço é só o número, sem € (ex.: 17 ou 15,90): o artigo fica escondido do site até ser corrigido.');
  }

  const partem = [];
  for (const [caminho, t] of textosDe(a)) if (RE_PARTE_A_PAGINA.test(t)) partem.push(caminho.split('.')[0]);
  if (partem.length) {
    const campos = [...new Set(partem)];
    neutraliza('partia-a-pagina', 'esconder', campos[0], `${campos.map((c) => `«${NOMES_CAMPOS[c] || c}»`).join(', ')}: tem «</script» ou «<!--», que não podem ir para o site. O artigo fica escondido do site até isso ser corrigido.`, { campos });
  }
  const alegam = [];
  const terceiros = [];
  for (const [caminho, t] of textosDe(a)) {
    const m = t.match(RE_ALEGACOES); if (m) alegam.push([caminho.split('.')[0], m[0]]);
    const n = t.match(RE_TERCEIROS); if (n) terceiros.push([caminho.split('.')[0], n[0]]);
  }
  if (alegam.length) {
    neutraliza('alegacoes', 'esconder', alegam[0][0], `«${alegam[0][1]}» é uma palavra que a lei só deixa usar com prova (ou uma certificação que não temos): o artigo fica escondido do site até a tirar.`, { campos: [...new Set(alegam.map((x) => x[0]))] });
  }
  if (terceiros.length) {
    neutraliza('terceiros', 'esconder', terceiros[0][0], `«${terceiros[0][1]}» é uma marca ou uma personagem de outros: o artigo fica escondido do site até a tirar.`, { campos: [...new Set(terceiros.map((x) => x[0]))] });
  }

  // --- fotografias ---------------------------------------------------------
  const fotos = a.fotos;
  const lista = Array.isArray(fotos) ? fotos : [];
  if (!ausente(fotos) && !Array.isArray(fotos)) avisa('fotos', 'fotos', 'As fotografias não estão gravadas como uma lista. Escolha-as outra vez.');
  const vistos = new Set();
  let boas = 0;
  lista.forEach((f, indice) => {
    const extra = { foto: f, indice };
    if (!nomeDeFotoValido(f)) {
      neutraliza(`foto-invalida:${String(f).slice(0, 80)}`, 'sem_fotografia', 'fotos', `«${String(f).slice(0, 60)}» não é uma fotografia da biblioteca: não aparece no site. Tire-a do artigo e escolha-a outra vez.`, extra);
      return;
    }
    if (vistos.has(f)) { avisa(`foto-repetida:${f}`, 'fotos', 'Há uma fotografia duas vezes no artigo. Tire uma delas.', extra); return; }
    vistos.add(f);
    if (fotosExistem && !fotosExistem.has(f)) {
      neutraliza(`foto-em-falta:${f}`, 'sem_fotografia', 'fotos', 'Uma das fotografias já não está na biblioteca: não aparece no site. Tire-a do artigo, ou carregue-a outra vez.', extra);
      return;
    }
    boas++;
  });
  if (lista.length > TAMANHOS.fotos) avisa('fotos-a-mais', 'fotos', `O artigo tem ${lista.length} fotografias; o máximo é ${TAMANHOS.fotos}. Tire as que estão a mais.`);
  /* Sem nenhuma fotografia boa, o cartão da loja e o cartão de partilha não têm imagem: o artigo fica
     escondido até ter uma. */
  if (!boas) neutraliza('sem-fotos', 'esconder', 'fotos', 'O artigo não tem fotografias: fica escondido do site até ter pelo menos uma (a primeira é a capa).');

  // --- interruptores -----------------------------------------------------------
  for (const b of BOOLEANOS_ARTIGO) {
    if (!ausente(a[b]) && typeof a[b] !== 'boolean') avisa(b, b, `«${NOMES_CAMPOS[b]}» tem de ser sim ou não.`);
  }
  if (!ausente(a.naoBrinquedo) && typeof a.naoBrinquedo !== 'boolean') avisa('naoBrinquedo', 'naoBrinquedo', '«Não é um brinquedo» tem de ser sim ou não.');

  // --- números ----------------------------------------------------------------
  const pa = a.precoAnterior;
  if (!ausente(pa) && pa !== '') {
    if (typeof pa !== 'number' || !Number.isFinite(pa) || !duasCasas(pa) || pa > LIMITES.preco[1]) avisa('precoAnterior', 'precoAnterior', 'O preço anterior é só o número, sem € (ex.: 20).');
    else if (typeof p === 'number' && pa <= p) avisa('precoAnterior', 'precoAnterior', 'O preço anterior tem de ser maior do que o preço de agora (ou fica vazio, sem promoção).');
    else if (vazio(p)) avisa('precoAnterior:sem-preco', 'precoAnterior', 'Há preço anterior mas não há preço: escreva o preço de agora, ou apague o anterior.');
  }
  const ate = a.promocaoAte;
  if (!ausente(ate) && ate !== '') {
    if (!dataValida(ate)) avisa('promocaoAte', 'promocaoAte', 'A data do fim da promoção não é uma data válida.');
    else if (vazio(pa)) avisa('promocaoAte', 'promocaoAte', 'Há data de fim da promoção, mas não há preço anterior: escreva o preço anterior, ou apague a data.');
    else if (typeof ctx.hoje === 'string' && ate < ctx.hoje && noSite(a)) lembra('promocao-acabou', 'promocaoAte', `A promoção acabou a ${ate.split('-').reverse().join('/')}: o site já mostra o preço normal (${pa} €). Pode apagar o preço anterior e a data, ou pôr uma data nova.`);
  }
  /* O INÍCIO DA PROMOÇÃO (DL 70/2007, art. 5.º: a lei pede o período e o preço mais baixo dos 30
     dias anteriores ao início; o riscado tem de ser esse preço). */
  const desde = a.promocaoDesde;
  const emPromocao = typeof p === 'number' && typeof pa === 'number' && pa > p;
  const acabou = dataValida(ate) && typeof ctx.hoje === 'string' && ate < ctx.hoje;
  if (!ausente(desde) && desde !== '') {
    if (!dataValida(desde)) avisa('promocaoDesde', 'promocaoDesde', 'A data de início da promoção não é uma data válida.');
    else if (vazio(pa)) avisa('promocaoDesde', 'promocaoDesde', 'Há data de início da promoção, mas não há preço anterior: escreva o preço anterior, ou apague a data.');
    else if (dataValida(ate) && desde > ate) avisa('promocaoDesde', 'promocaoDesde', 'A promoção começa depois de acabar: confira as duas datas.');
  } else if (emPromocao && !acabou && noSite(a)) {
    lembra('promocao-sem-inicio', 'promocaoDesde', 'Falta a data de início da promoção: a lei pede o período e o preço mais baixo dos 30 dias anteriores (DL 70/2007).');
  }
  if (emPromocao && vazio(ate) && noSite(a)) lembra('promocao-sem-fim', 'promocaoAte', 'Falta a data de fim da promoção: a lei pede o período da promoção (DL 70/2007). Escolha o último dia.');
  const o = a.ordem;
  if (!ausente(o) && o !== '' && (typeof o !== 'number' || !Number.isInteger(o) || o < LIMITES.ordem[0] || o > LIMITES.ordem[1])) {
    avisa('ordem', 'ordem', `A posição é um número inteiro de 0 a ${LIMITES.ordem[1]} (mais baixo aparece primeiro).`);
  }

  // --- as escolhas (nome, cores, aroma) ------------------------------------------
  const pers = a.personalizacao;
  if (!ausente(pers)) {
    if (!eObjecto(pers)) avisa('personalizacao', 'personalizacao', 'As escolhas não estão gravadas como deve ser: ligue ou desligue outra vez.');
    else {
      for (const c of CAMPOS_PERSONALIZACAO) if (!ausente(pers[c]) && typeof pers[c] !== 'boolean') avisa(`personalizacao.${c}`, `personalizacao.${c}`, `«${ROTULOS_PERSONALIZACAO[c]}» tem de ser sim ou não.`);
      for (const k of Object.values(ROTULOS_CHAVES)) {
        const v = pers[k];
        if (ausente(v) || v === '') continue;
        if (typeof v !== 'string' || v.length > TAMANHOS.rotulo || RE_CONTROLO_LINHA.test(v)) avisa(`personalizacao.${k}`, `personalizacao.${k}`, `O nome do campo tem de ser texto curto (até ${TAMANHOS.rotulo} caracteres), ou fica vazio.`);
      }
    }
  }

  // --- as ocasiões ---------------------------------------------------------------
  const oc = a.ocasioes;
  if (!ausente(oc)) {
    if (!Array.isArray(oc)) avisa('ocasioes', 'ocasioes', 'As ocasiões não estão gravadas como uma lista. Escolha-as outra vez.');
    else {
      const mas = oc.filter((x) => typeof x !== 'string' || !tem(OCASIOES, x));
      if (mas.length) avisa('ocasioes:desconhecida', 'ocasioes', `${mas.length === 1 ? 'Uma ocasião não é' : 'Há ocasiões que não são'} das do site (${mas.map((x) => `«${String(x).slice(0, 20)}»`).join(', ')}): escolha da lista.`);
      if (oc.length > TAMANHOS.ocasioes) avisa('ocasioes:quantas', 'ocasioes', `O artigo tem ${oc.length} ocasiões; o máximo é ${TAMANHOS.ocasioes}.`);
    }
  }

  const v = a.video;
  if (!ausente(v) && v !== '' && (typeof v !== 'string' || (videos && !videos.has(v)))) avisa('video', 'video', 'O vídeo escolhido não existe: escolha outro, ou nenhum.');

  // --- textos -------------------------------------------------------------
  const texto = (campo, max, { linha = true } = {}) => {
    const x = a[campo];
    if (ausente(x) || typeof x !== 'string') return;
    if (x.length > max) avisa(`${campo}:tamanho`, campo, `«${NOMES_CAMPOS[campo]}» tem mais de ${max} caracteres (tem ${x.length}).`);
    if ((linha ? RE_CONTROLO_LINHA : RE_CONTROLO_TEXTO).test(x)) avisa(`${campo}:controlo`, campo, `«${NOMES_CAMPOS[campo]}» tem caracteres invisíveis${linha ? ' (ex.: uma mudança de linha)' : ''}. Escreva-o outra vez.`);
  };
  texto('nome', TAMANHOS.nome);
  texto('descricao', TAMANHOS.descricao, { linha: false });
  texto('precoNota', TAMANHOS.precoNota);
  if (!ausente(a.precoNota) && a.precoNota !== '' && typeof a.precoNota !== 'string') avisa('precoNota:tipo', 'precoNota', '«Nota do preço» tem de ser texto.');

  // --- a informação legal do artigo (opcional) --------------------------------
  const fab = a.fabricante;
  if (!ausente(fab)) {
    if (!eObjecto(fab)) avisa('fabricante', 'fabricante', 'O fabricante não está gravado como deve ser: escreva-o outra vez.');
    else {
      for (const [k, max, rotulo] of [['nome', TAMANHOS.fabricanteNome, 'Nome do fabricante'], ['morada', TAMANHOS.fabricanteMorada, 'Morada do fabricante']]) {
        const x = fab[k];
        if (ausente(x) || x === '') continue;
        if (typeof x !== 'string' || x.length > max || RE_CONTROLO_LINHA.test(x)) avisa(`fabricante.${k}`, `fabricante.${k}`, `«${rotulo}» tem de ser um texto numa linha, até ${max} caracteres.`);
      }
      if (!vazio(fab.email) && !emailValido(fab.email)) avisa('fabricante.email', 'fabricante.email', 'O email do fabricante não parece estar certo (ex.: nome@exemplo.pt).');
      const dados = CAMPOS_FABRICANTE.filter((k) => temTexto(fab[k]));
      if (dados.length && dados.length < CAMPOS_FABRICANTE.length && noSite(a)) {
        lembra('fabricante:incompleto', `fabricante.${CAMPOS_FABRICANTE.find((k) => !temTexto(fab[k]))}`, 'O fabricante está incompleto: a lei pede o nome, a morada e o email (Regulamento (UE) 2023/988, art. 19.º). Até estar completo, a ficha mostra os dados da loja.');
      }
    }
  }
  texto('referencia', TAMANHOS.referencia);
  texto('avisos', TAMANHOS.avisos, { linha: false });
  texto('perigos', TAMANHOS.perigos, { linha: false });
  texto('idade', TAMANHOS.idade);
  for (const campo of ['referencia', 'avisos', 'perigos', 'idade']) {
    if (!ausente(a[campo]) && a[campo] !== '' && typeof a[campo] !== 'string') avisa(`${campo}:tipo`, campo, `«${NOMES_CAMPOS[campo]}» tem de ser texto.`);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* content/site.json                                                   */
/* ------------------------------------------------------------------ */

export const SECCOES_SITE = Object.freeze({ contactos: 'Contactos', aviso: 'Aviso do topo', entrega: 'Entrega', pagamento: 'Pagamento', empresa: 'Dados legais', marca: 'A marca' });
/* O que o painel nunca muda: a marca (o nome comercial, nos textos legais e no
   Google) e as formas de receber. */
export const BLOQUEADOS_SITE = Object.freeze(['marca', 'entrega.zonas']);

export function problemasDoSite(d, { producao = false } = {}) {
  const ficheiro = FICHEIROS.site;
  const out = [];
  const ecraDe = (s) => `Dados da loja › ${SECCOES_SITE[s] || s}`;
  const bloqueia = (chave, s, campo, mensagem) => out.push({ classe: 'bloqueia', chave: `site:${chave}`, ficheiro, ecra: ecraDe(s), campo, mensagem });
  const avisa = (chave, s, campo, mensagem, extra = {}) => out.push({ classe: 'avisa', chave: `site:${chave}`, ficheiro, ecra: ecraDe(s), campo, mensagem, ...extra });
  /* O que a lei pede: na pré-visualização lembra; no domínio aberto pára. */
  const legal = (chave, s, campo, mensagem) => (producao ? bloqueia(`${chave}:producao`, s, campo, mensagem) : avisa(chave, s, campo, mensagem, { lembrete: true }));
  if (!eObjecto(d)) { bloqueia('forma', 'marca', undefined, 'Os dados da loja não têm a forma certa. Só o Renato os pode corrigir.'); return out; }

  if (!temTexto(d.marca)) bloqueia('marca', 'marca', 'marca', 'Falta o nome da marca. Só o Renato o pode repor.');
  for (const s of ['contactos', 'empresa', 'entrega']) {
    if (!eObjecto(d[s])) bloqueia(`${s}:forma`, s, s, `A secção «${SECCOES_SITE[s] || s}» não está gravada, e sem ela o site não se consegue gerar. Só o Renato a pode repor.`);
  }
  const c = eObjecto(d.contactos) ? d.contactos : {};
  const e = eObjecto(d.empresa) ? d.empresa : {};
  const en = eObjecto(d.entrega) ? d.entrega : {};

  /* Textos simples: tamanho, caracteres invisíveis, «</script», alegações, terceiros. */
  const textoSimples = (v, chave, s, campo, rotulo, max, { linha = true } = {}) => {
    if (ausente(v)) return;
    if (typeof v !== 'string') { avisa(`${chave}:tipo`, s, campo, `«${rotulo}» tem de ser texto.`); return; }
    if (v.length > max) avisa(`${chave}:tamanho`, s, campo, `«${rotulo}» tem mais de ${max} caracteres (tem ${v.length}).`);
    if ((linha ? RE_CONTROLO_LINHA : RE_CONTROLO_TEXTO).test(v)) avisa(`${chave}:controlo`, s, campo, `«${rotulo}» tem caracteres invisíveis. Escreva-o outra vez.`);
    if (RE_PARTE_A_PAGINA.test(v)) bloqueia(`${chave}:parte`, s, campo, `«${rotulo}» tem «</script» ou «<!--», que não podem ir para o site.`);
    const m = v.match(RE_ALEGACOES);
    if (m) bloqueia(`${chave}:alegacao`, s, campo, `«${rotulo}»: «${m[0]}» é uma palavra que a lei só deixa usar com prova (ou uma certificação que não temos). Tire-a.`);
  };

  // --- contactos ---------------------------------------------------------------
  if (!vazio(c.email) && !emailValido(c.email)) bloqueia('contactos.email', 'contactos', 'contactos.email', 'O email não parece estar certo (ex.: nome@exemplo.pt).');
  if (vazio(c.email)) legal('contactos.email:vazio', 'contactos', 'contactos.email', 'Falta o email: a lei pede um endereço de email no site (DL 7/2004, art. 10.º).');
  if (!vazio(c.whatsapp) && !eTelemovel(c.whatsapp)) bloqueia('contactos.whatsapp', 'contactos', 'contactos.whatsapp', 'O WhatsApp tem de ser um telemóvel português de 9 algarismos (ex.: 933 007 227).');
  if (vazio(c.whatsapp)) bloqueia('contactos.whatsapp:vazio', 'contactos', 'contactos.whatsapp', 'Falta o número de WhatsApp: é para lá que a encomenda segue.');
  if (!vazio(c.telefone) && !numeroPortugues(c.telefone)) avisa('contactos.telefone', 'contactos', 'contactos.telefone', 'O telefone tem de ser um número português de 9 algarismos; até lá, a página de contactos não o mostra.');
  for (const [k, r] of Object.entries(REDES)) {
    const v = c[k];
    if (!vazio(v) && (typeof v !== 'string' || v.length > TAMANHOS.rede || !r.re.test(v.trim()))) avisa(`contactos.${k}`, 'contactos', `contactos.${k}`, `${r.rotulo}: escreva o endereço inteiro da conta (ex.: ${r.exemplo}).`);
  }

  // --- empresa (os dados que a lei pede: DL 7/2004, art. 10.º) ----------------------
  if (vazio(e.nome)) legal('empresa.nome:vazio', 'empresa', 'empresa.nome', 'Falta o nome de quem vende (a empresa ou o empresário em nome individual): a lei pede-o no site.');
  if (!vazio(e.nif) && !nifValido(e.nif)) bloqueia('empresa.nif', 'empresa', 'empresa.nif', 'O NIF não é um NIF português válido: confira os 9 algarismos.');
  if (vazio(e.nif)) legal('empresa.nif:vazio', 'empresa', 'empresa.nif', 'Falta o NIF de quem vende: a lei pede-o no site (DL 7/2004, art. 10.º).');
  if (vazio(e.morada) || vazio(e.codigoPostal) || vazio(e.localidade)) legal('empresa.morada:incompleta', 'empresa', vazio(e.morada) ? 'empresa.morada' : vazio(e.codigoPostal) ? 'empresa.codigoPostal' : 'empresa.localidade', 'A morada está incompleta: a lei pede a morada geográfica, com a rua, o número, o código postal e a localidade (DL 7/2004, art. 10.º).');
  if (!vazio(e.codigoPostal) && !/^\d{4}-\d{3}$/.test(String(e.codigoPostal).trim())) avisa('empresa.codigoPostal', 'empresa', 'empresa.codigoPostal', 'O código postal tem a forma 2955-000.');
  if (vazio(e.iva)) avisa('empresa.iva:vazio', 'empresa', 'empresa.iva', 'Falta dizer se os preços incluem IVA ou se há isenção (art. 53.º do CIVA): os termos dizem-no ao cliente.', { lembrete: true });
  for (const [k, max, rotulo] of [['nome', TAMANHOS.empresaNome, 'Nome'], ['tipo', TAMANHOS.empresaTipo, 'Tipo'], ['morada', TAMANHOS.morada, 'Morada'], ['localidade', TAMANHOS.localidade, 'Localidade'], ['concelho', TAMANHOS.concelho, 'Concelho'], ['iva', TAMANHOS.iva, 'IVA']]) {
    textoSimples(e[k], `empresa.${k}`, 'empresa', `empresa.${k}`, rotulo, max);
  }

  // --- aviso do topo ------------------------------------------------------------
  const av = d.aviso;
  if (!ausente(av)) {
    if (!eObjecto(av)) avisa('aviso:forma', 'aviso', 'aviso', 'O aviso do topo não está gravado como deve ser: escreva-o outra vez.');
    else {
      textoSimples(av.texto, 'aviso.texto', 'aviso', 'aviso.texto', 'Texto do aviso', TAMANHOS.avisoTexto);
      if (!vazio(av.ate) && !dataValida(av.ate)) avisa('aviso.ate', 'aviso', 'aviso.ate', 'A data até quando o aviso aparece não é uma data válida.');
      if (!vazio(av.ligacao) && (typeof av.ligacao !== 'string' || !/^\/[a-z0-9/-]*$/.test(av.ligacao))) avisa('aviso.ligacao', 'aviso', 'aviso.ligacao', 'A ligação do aviso tem de ser uma página do site (ex.: /natal/).');
    }
  }

  // --- entrega -------------------------------------------------------------------
  const zonas = en.zonas;
  if (!Array.isArray(zonas) || zonas.length !== ZONAS.length || !ZONAS.every((id) => zonas.some((z) => eObjecto(z) && z.id === id && temTexto(z.nome) && temTexto(z.curto) && typeof z.morada === 'boolean'))) {
    bloqueia('entrega.zonas', 'entrega', 'entrega.zonas', 'As formas de receber (em mão e pelos CTT) não estão como deviam. Só o Renato as pode corrigir.');
  }
  const portes = eObjecto(en.portes) ? en.portes : {};
  if (!ausente(en.portes) && !eObjecto(en.portes)) avisa('entrega.portes', 'entrega', 'entrega.portes', 'Os portes não estão gravados como deve ser. Escreva-os outra vez.');
  const faltamPortes = [];
  for (const z of ZONAS_ENVIO) {
    const v = portes[z];
    if (ausente(v) || v === '') { faltamPortes.push(z); continue; }
    if (typeof v !== 'number' || !Number.isFinite(v) || v < LIMITES.portes[0] || v > LIMITES.portes[1] || !duasCasas(v)) avisa(`entrega.portes.${z}`, 'entrega', `entrega.portes.${z}`, `Portes (${NOMES_ZONAS[z]}): só o número, sem € (ex.: 4,50), ou vazio («a confirmar»).`);
  }
  const gratis = portes.gratisAPartirDe;
  if (!ausente(gratis) && gratis !== '' && (typeof gratis !== 'number' || !Number.isFinite(gratis) || gratis < 0 || gratis > LIMITES.portes[1] || !duasCasas(gratis))) {
    avisa('entrega.portes.gratisAPartirDe', 'entrega', 'entrega.portes.gratisAPartirDe', 'Portes grátis a partir de: só o número, sem € (ex.: 35), ou vazio (sem portes grátis).');
  }
  /* Uns portes por dizer são «a confirmar». Com a nota (entrega.portesNota: como se calculam), é a
     resposta: já não se lembra. */
  if (faltamPortes.length && vazio(en.portesNota)) avisa('entrega.portes:por-preencher', 'entrega', `entrega.portes.${faltamPortes[0]}`, `Faltam os portes para ${faltamPortes.map((z) => NOMES_ZONAS[z]).join(' e ')}: na encomenda aparece «a confirmar».`, { lembrete: true });
  if (vazio(en.emMao)) avisa('entrega.emMao:vazio', 'entrega', 'entrega.emMao', 'Falta dizer onde fazem entregas em mão (as localidades, e como se combina): no site a sério, sem isto, a entrega em mão não se oferece.', { lembrete: true });
  if (vazio(en.prazo)) legal('entrega.prazo:vazio', 'entrega', 'entrega.prazo', 'Falta o prazo de preparação e entrega: a lei pede que o cliente o saiba antes de encomendar (DL 24/2014, art. 4.º).');
  textoSimples(en.prazo, 'entrega.prazo', 'entrega', 'entrega.prazo', 'Prazo', TAMANHOS.prazo, { linha: false });
  textoSimples(en.emMao, 'entrega.emMao', 'entrega', 'entrega.emMao', 'Entrega em mão', TAMANHOS.emMao, { linha: false });
  textoSimples(en.portesNota, 'entrega.portesNota', 'entrega', 'entrega.portesNota', 'Como se calculam os portes «a confirmar»', TAMANHOS.portesNota, { linha: false });

  // --- pagamento -------------------------------------------------------------------
  if (vazio(d.pagamento)) legal('pagamento:vazio', 'pagamento', 'pagamento', 'Faltam as formas de pagamento: a lei pede que o cliente as saiba antes de encomendar (DL 24/2014, art. 4.º).');
  textoSimples(d.pagamento, 'pagamento', 'pagamento', 'pagamento', 'Pagamento', TAMANHOS.pagamento, { linha: false });

  // --- a marca ----------------------------------------------------------------------
  textoSimples(d.descricao, 'descricao', 'marca', 'descricao', 'Descrição da marca', TAMANHOS.descricaoSite, { linha: false });
  textoSimples(d.assinatura, 'assinatura', 'marca', 'assinatura', 'Assinatura do rodapé', TAMANHOS.assinatura);
  return out;
}

/* ------------------------------------------------------------------ */
/* content/categorias.json                                             */
/* ------------------------------------------------------------------ */

export function problemasDasCategorias(valor, { icones = null } = {}) {
  const ficheiro = FICHEIROS.categorias;
  const out = [];
  const bloqueia = (chave, campo, mensagem) => out.push({ classe: 'bloqueia', chave: `categorias:${chave}`, ficheiro, ecra: 'Categorias', campo, mensagem });
  const avisa = (chave, campo, mensagem) => out.push({ classe: 'avisa', chave: `categorias:${chave}`, ficheiro, ecra: 'Categorias', campo, mensagem });
  const l = lerJson(valor);
  if (!Array.isArray(l.obj) || !l.obj.length) { bloqueia('forma', undefined, 'As categorias não se conseguem ler: sem elas o site não se consegue gerar. Só o Renato as pode corrigir.'); return out; }
  const slugs = new Set();
  l.obj.forEach((c, i) => {
    if (!eObjecto(c) || !slugValido(c.slug)) { bloqueia(`${i}:forma`, `${i}`, `A categoria ${i + 1} não tem a forma certa. Só o Renato a pode corrigir.`); return; }
    if (slugs.has(c.slug)) bloqueia(`${c.slug}:repetida`, `${i}`, `A categoria «${c.slug}» está repetida. Só o Renato a pode corrigir.`);
    slugs.add(c.slug);
    for (const [k, max, rotulo] of [['nome', TAMANHOS.catNome, 'Nome'], ['titulo', TAMANHOS.catTitulo, 'Título no Google'], ['frase', TAMANHOS.catFrase, 'Frase curta']]) {
      const v = c[k];
      if (vazio(v)) { bloqueia(`${c.slug}.${k}:vazio`, `${i}.${k}`, `«${rotulo}» da categoria ${c.nome || c.slug} está vazio.`); continue; }
      if (typeof v !== 'string') { bloqueia(`${c.slug}.${k}:tipo`, `${i}.${k}`, `«${rotulo}» da categoria ${c.slug} tem de ser texto.`); continue; }
      if (v.length > max) avisa(`${c.slug}.${k}:tamanho`, `${i}.${k}`, `«${rotulo}» da categoria ${c.nome || c.slug} tem mais de ${max} caracteres.`);
      if (RE_CONTROLO_TEXTO.test(v) || RE_PARTE_A_PAGINA.test(v)) bloqueia(`${c.slug}.${k}:controlo`, `${i}.${k}`, `«${rotulo}» da categoria ${c.nome || c.slug} tem caracteres que não podem ir para o site.`);
      const m = v.match(RE_ALEGACOES);
      if (m) bloqueia(`${c.slug}.${k}:alegacao`, `${i}.${k}`, `«${rotulo}» da categoria ${c.nome || c.slug}: «${m[0]}» é uma palavra que a lei só deixa usar com prova. Tire-a.`);
    }
    if (!nomeDeFotoValido(c.icone) || (icones && !icones.includes(c.icone))) bloqueia(`${c.slug}.icone`, `${i}.icone`, `O ícone da categoria ${c.nome || c.slug} não existe: escolha outro.`);
    if (!ausente(c.ordem) && (typeof c.ordem !== 'number' || !Number.isInteger(c.ordem))) avisa(`${c.slug}.ordem`, `${i}.ordem`, `A posição da categoria ${c.nome || c.slug} é um número inteiro.`);
  });
  return out;
}

/* ------------------------------------------------------------------ */
/* content/inicio.json                                                 */
/* ------------------------------------------------------------------ */

/* As secções da página inicial, pela ordem da página (a proposta B, «Destaques», escolhida pelo dono a
   16 nov 2026): a capa (o título é o h1 da página, o texto, dois botões e a fotografia ou o vídeo), as
   categorias em círculos (como os destaques do Instagram), o destaque da época (uma ocasião, numa fila
   com setas; ligado ou desligado), as novidades («Feitos esta semana»), a história (com duas
   fotografias e a citação), os bastidores (vídeos 9:16) e «Como encomendar» (quatro cartões). */
export const SECCOES_INICIO = Object.freeze(['seo', 'capa', 'categorias', 'destaque', 'novidades', 'historia', 'bastidores', 'comoEncomendar']);
export const LIMITES_INICIO = Object.freeze({ bastidores: [0, 8], comoEncomendar: [0, 4] });

/* As fotografias que a página inicial usa (para saber se uma se pode apagar). */
export function fotosDoInicio(h) {
  if (!eObjecto(h)) return [];
  const out = [];
  if (eObjecto(h.capa)) out.push(h.capa.foto);
  if (eObjecto(h.historia) && Array.isArray(h.historia.fotos)) out.push(...h.historia.fotos);
  return out.filter((x) => typeof x === 'string');
}
/* Os vídeos que a página inicial usa. */
export function videosDoInicio(h) {
  if (!eObjecto(h)) return [];
  const out = [];
  if (eObjecto(h.capa)) out.push(h.capa.video);
  if (eObjecto(h.bastidores) && Array.isArray(h.bastidores.videos)) out.push(...h.bastidores.videos);
  return out.filter((x) => typeof x === 'string' && x);
}

export function problemasDoInicio(valor, { fotos = null, videos = null, icones = null } = {}) {
  const ficheiro = FICHEIROS.inicio;
  const out = [];
  const ecra = 'Página inicial';
  const bloqueia = (chave, campo, mensagem) => out.push({ classe: 'bloqueia', chave: `inicio:${chave}`, ficheiro, ecra, campo, mensagem });
  const avisa = (chave, campo, mensagem, extra = {}) => out.push({ classe: 'avisa', chave: `inicio:${chave}`, ficheiro, ecra, campo, mensagem, ...extra });
  const l = lerJson(valor);
  if (l.ilegivel || !eObjecto(l.obj)) { bloqueia('forma', undefined, 'A página inicial não se consegue ler. Só o Renato a pode corrigir.'); return out; }
  const h = l.obj;
  for (const k of SECCOES_INICIO) {
    if (!eObjecto(h[k])) bloqueia(`${k}:forma`, k, `A secção «${k}» da página inicial não está gravada. Só o Renato a pode repor.`);
  }
  if (out.length) return out;
  const valorEm = (caminho) => caminho.split('.').reduce((o, k) => (eObjecto(o) || Array.isArray(o) ? o[k] : undefined), h);
  const umTexto = (caminho, max, obrigatorio) => {
    const v = valorEm(caminho);
    if (vazio(v)) { if (obrigatorio) bloqueia(`${caminho}:vazio`, caminho, 'Este texto da página inicial está vazio: escreva-o.'); return; }
    if (typeof v !== 'string') { bloqueia(`${caminho}:tipo`, caminho, 'Este texto da página inicial não está gravado como texto.'); return; }
    if (v.length > max) avisa(`${caminho}:tamanho`, caminho, `Este texto tem mais de ${max} caracteres (tem ${v.length}).`);
    if (RE_CONTROLO_TEXTO.test(v) || RE_PARTE_A_PAGINA.test(v)) bloqueia(`${caminho}:controlo`, caminho, 'Este texto tem caracteres que não podem ir para o site. Escreva-o outra vez.');
    const m = v.match(RE_ALEGACOES);
    if (m) bloqueia(`${caminho}:alegacao`, caminho, `«${m[0]}» é uma palavra que a lei só deixa usar com prova (ou uma certificação que não temos). Tire-a.`);
  };
  const umaLigacao = (caminho, obrigatoria) => {
    const v = valorEm(caminho);
    if (vazio(v)) { if (obrigatoria) bloqueia(`${caminho}:vazio`, caminho, 'Falta a página para onde o botão leva.'); return; }
    if (typeof v !== 'string' || !/^\/[a-z0-9/-]*$/.test(v)) avisa(`${caminho}`, caminho, 'A ligação do botão tem de ser uma página do site (ex.: /loja/).');
  };
  const umaFoto = (caminho, f) => {
    if (!nomeDeFotoValido(f) || (fotos && !fotos.has(f))) bloqueia(`${caminho}:foto`, caminho, 'Esta fotografia já não está na biblioteca: escolha outra.');
  };
  const umVideo = (caminho, v) => {
    if (!nomeDeFotoValido(v) || (videos && !videos.has(v))) bloqueia(`${caminho}:video`, caminho, 'Este vídeo já não está na biblioteca: escolha outro.');
  };

  // --- a capa --------------------------------------------------------------------------------------
  for (const [c, max, ob] of [
    ['seo.titulo', TAMANHOS.inicioTitulo, true], ['seo.descricao', TAMANHOS.inicioTexto, true],
    ['capa.titulo', TAMANHOS.inicioTitulo, true], ['capa.texto', TAMANHOS.inicioTexto, false],
    ['capa.botao.texto', TAMANHOS.inicioCurto, true], ['capa.botao2.texto', TAMANHOS.inicioCurto, false],
    ['categorias.titulo', TAMANHOS.inicioTitulo, true],
    ['destaque.titulo', TAMANHOS.inicioTitulo, true], ['destaque.texto', TAMANHOS.inicioTexto, false],
    ['novidades.titulo', TAMANHOS.inicioTitulo, true],
    ['historia.titulo', TAMANHOS.inicioTitulo, true], ['historia.texto', TAMANHOS.inicioLongo, true],
    ['historia.citacao', TAMANHOS.inicioTexto, false], ['historia.autor', TAMANHOS.inicioCurto, false], ['historia.botao', TAMANHOS.inicioCurto, true],
    ['bastidores.titulo', TAMANHOS.inicioTitulo, true], ['bastidores.texto', TAMANHOS.inicioTexto, false],
    ['comoEncomendar.titulo', TAMANHOS.inicioTitulo, true],
  ]) umTexto(c, max, ob);
  umaLigacao('capa.botao.ligacao', true);
  if (eObjecto(h.capa.botao2) && !vazio(h.capa.botao2.texto)) umaLigacao('capa.botao2.ligacao', true);
  umaFoto('capa.foto', h.capa.foto);
  if (!vazio(h.capa.video)) umVideo('capa.video', h.capa.video);

  // --- o destaque da época ---------------------------------------------------------------------------
  if (typeof h.destaque.ligado !== 'boolean') bloqueia('destaque.ligado', 'destaque.ligado', 'O destaque da época tem de estar ligado ou desligado.');
  if (h.destaque.ligado === true && (typeof h.destaque.ocasiao !== 'string' || !tem(OCASIOES, h.destaque.ocasiao))) bloqueia('destaque.ocasiao', 'destaque.ocasiao', 'O destaque da época aponta para uma ocasião que não existe: escolha uma da lista.');

  // --- as novidades -----------------------------------------------------------------------------------
  const q = h.novidades.quantas;
  if (typeof q !== 'number' || !Number.isInteger(q) || q < LIMITES.novidades[0] || q > LIMITES.novidades[1]) avisa('novidades.quantas', 'novidades.quantas', `Quantas novidades mostrar: um número inteiro de ${LIMITES.novidades[0]} a ${LIMITES.novidades[1]}.`);

  // --- a história: duas fotografias (a grande e a pequena por cima) ----------------------------------------
  const fh = h.historia.fotos;
  if (!Array.isArray(fh) || fh.length !== 2) bloqueia('historia.fotos', 'historia.fotos', 'A história da página inicial leva duas fotografias.');
  else fh.forEach((f, i) => umaFoto(`historia.fotos.${i}`, f));

  // --- os bastidores ------------------------------------------------------------------------------------
  const vs = h.bastidores.videos;
  if (!Array.isArray(vs)) bloqueia('bastidores.videos', 'bastidores.videos', 'Os vídeos dos bastidores não estão gravados como uma lista.');
  else {
    if (vs.length > LIMITES_INICIO.bastidores[1]) avisa('bastidores:muitos', 'bastidores.videos', `Há ${vs.length} vídeos nos bastidores; o máximo é ${LIMITES_INICIO.bastidores[1]} (os outros não aparecem).`);
    vs.forEach((v, i) => umVideo(`bastidores.videos.${i}`, v));
  }

  // --- como encomendar: até quatro cartões -------------------------------------------------------------------
  const it = h.comoEncomendar.itens;
  if (!Array.isArray(it)) bloqueia('comoEncomendar.itens', 'comoEncomendar.itens', 'Os cartões de «Como encomendar» não estão gravados como uma lista.');
  else {
    if (it.length > LIMITES_INICIO.comoEncomendar[1]) avisa('comoEncomendar:muitos', 'comoEncomendar.itens', `Há ${it.length} cartões em «Como encomendar»; o máximo é ${LIMITES_INICIO.comoEncomendar[1]} (os outros não aparecem).`);
    it.forEach((x, i) => {
      if (!eObjecto(x)) { bloqueia(`comoEncomendar.itens.${i}:forma`, `comoEncomendar.itens.${i}`, `O cartão ${i + 1} de «Como encomendar» não está gravado como deve ser.`); return; }
      umTexto(`comoEncomendar.itens.${i}.titulo`, TAMANHOS.inicioCurto, true);
      umTexto(`comoEncomendar.itens.${i}.texto`, TAMANHOS.inicioTexto, true);
      if (!nomeDeFotoValido(x.icone) || (icones && !icones.includes(x.icone))) avisa(`comoEncomendar.itens.${i}.icone`, `comoEncomendar.itens.${i}.icone`, 'Este ícone não existe: escolha um da lista.');
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* content/fotos.json e content/videos.json                            */
/* ------------------------------------------------------------------ */

/* Cada fotografia tem o texto alternativo (o que um leitor de ecrã diz, e o que o
   Google lê) e o ponto de foco (onde se corta, em «x% y%»). */
const RE_FOCO = /^(\d{1,3})% (\d{1,3})%$/;
export const focoValido = (f) => { const m = RE_FOCO.exec(String(f ?? '')); return Boolean(m) && Number(m[1]) <= 100 && Number(m[2]) <= 100; };

export function problemasDasFotos(valor, ficheirosFotos = null) {
  const ficheiro = FICHEIROS.fotos;
  const out = [];
  const bloqueia = (chave, campo, mensagem, extra = {}) => out.push({ classe: 'bloqueia', chave: `fotos:${chave}`, ficheiro, ecra: 'Fotografias', campo, mensagem, ...extra });
  const avisa = (chave, campo, mensagem, extra = {}) => out.push({ classe: 'avisa', chave: `fotos:${chave}`, ficheiro, ecra: 'Fotografias', campo, mensagem, ...extra });
  const l = lerJson(valor);
  if (l.ilegivel || !eObjecto(l.obj)) { bloqueia('forma', undefined, 'A lista das fotografias não se consegue ler. Só o Renato a pode corrigir.'); return out; }
  for (const [nome, f] of Object.entries(l.obj)) {
    if (!nomeDeFotoValido(nome)) { bloqueia(`${nome.slice(0, 60)}:nome`, nome, `«${nome.slice(0, 60)}» não é um nome de fotografia válido. Só o Renato o pode corrigir.`); continue; }
    if (!eObjecto(f)) { bloqueia(`${nome}:forma`, nome, `A fotografia «${nome}» não tem a forma certa.`); continue; }
    if (!temTexto(f.alt)) bloqueia(`${nome}:alt`, `${nome}.alt`, 'Uma fotografia não tem descrição (o que um leitor de ecrã diz): escreva-a.', { foto: nome });
    else {
      if (f.alt.length > TAMANHOS.alt) avisa(`${nome}:alt:tamanho`, `${nome}.alt`, `A descrição de uma fotografia tem mais de ${TAMANHOS.alt} caracteres.`, { foto: nome });
      if (RE_CONTROLO_LINHA.test(f.alt) || RE_PARTE_A_PAGINA.test(f.alt)) bloqueia(`${nome}:alt:controlo`, `${nome}.alt`, 'A descrição de uma fotografia tem caracteres que não podem ir para o site.', { foto: nome });
    }
    if (!ausente(f.foco) && !focoValido(f.foco)) avisa(`${nome}:foco`, `${nome}.foco`, 'O ponto de foco de uma fotografia não está como devia.', { foto: nome });
  }
  if (Array.isArray(ficheirosFotos)) {
    for (const n of ficheirosFotos) {
      if (!nomeDeFotoValido(n)) { bloqueia(`${String(n).slice(0, 60)}:nome-do-ficheiro`, undefined, `Há uma fotografia na biblioteca com um nome que o site não aceita («${String(n).slice(0, 60)}»: só minúsculas, algarismos e hífens). Só o Renato a pode corrigir.`, { foto: n }); continue; }
      if (!tem(l.obj, n)) bloqueia(`${n}:sem-entrada`, n, `A fotografia «${n}» não tem descrição: escreva-a.`, { foto: n });
    }
  }
  return out;
}

/* Cada vídeo tem a legenda (o que se lê por baixo dele nos bastidores, e o que um leitor de ecrã diz). */
export function problemasDosVideos(valor, ficheirosVideos = null) {
  const ficheiro = FICHEIROS.videos;
  const out = [];
  const bloqueia = (chave, campo, mensagem) => out.push({ classe: 'bloqueia', chave: `videos:${chave}`, ficheiro, ecra: 'Vídeos', campo, mensagem });
  const avisa = (chave, campo, mensagem) => out.push({ classe: 'avisa', chave: `videos:${chave}`, ficheiro, ecra: 'Vídeos', campo, mensagem });
  const l = lerJson(valor);
  if (l.ilegivel || !eObjecto(l.obj)) { bloqueia('forma', undefined, 'A lista dos vídeos não se consegue ler. Só o Renato a pode corrigir.'); return out; }
  for (const [nome, v] of Object.entries(l.obj)) {
    if (!nomeDeFotoValido(nome) || !eObjecto(v)) { bloqueia(`${nome.slice(0, 60)}:forma`, nome, `O vídeo «${nome.slice(0, 60)}» não tem a forma certa. Só o Renato o pode corrigir.`); continue; }
    if (!temTexto(v.legenda)) bloqueia(`${nome}:legenda`, `${nome}.legenda`, 'Um vídeo não tem legenda: escreva-a.');
    else {
      if (v.legenda.length > TAMANHOS.legenda) avisa(`${nome}:legenda:tamanho`, `${nome}.legenda`, `A legenda de um vídeo tem mais de ${TAMANHOS.legenda} caracteres.`);
      if (RE_CONTROLO_LINHA.test(v.legenda) || RE_PARTE_A_PAGINA.test(v.legenda)) bloqueia(`${nome}:legenda:controlo`, `${nome}.legenda`, 'A legenda de um vídeo tem caracteres que não podem ir para o site.');
    }
  }
  if (Array.isArray(ficheirosVideos)) {
    for (const n of ficheirosVideos) {
      if (!nomeDeFotoValido(n)) { bloqueia(`${String(n).slice(0, 60)}:nome-do-ficheiro`, undefined, `Há um vídeo com um nome que o site não aceita («${String(n).slice(0, 60)}»). Só o Renato o pode corrigir.`); continue; }
      if (!tem(l.obj, n)) bloqueia(`${n}:sem-entrada`, n, `O vídeo «${n}» não tem legenda: escreva-a.`);
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Todos                                                               */
/* ------------------------------------------------------------------ */

/* problemas(dados, opcoes) → [problema]
 *   opcoes: { hoje?: 'AAAA-MM-DD', producao?: boolean } */
export function problemas(dados = {}, opcoes = {}) {
  const lista = [];
  const d = eObjecto(dados) ? dados : {};
  const fotos = fotosQueExistem(d);
  const videos = videosQueExistem(d);
  const icones = Array.isArray(d.ficheirosIcones) ? d.ficheirosIcones : null;
  let categorias = null;
  if (tem(d, 'categorias')) { const cs = categoriasDe(d.categorias); if (cs) categorias = cs.map((c) => c.slug); }

  const umFicheiro = (k, rotulo, fn) => {
    if (!tem(d, k)) return;
    const l = lerJson(d[k]);
    const ficheiro = FICHEIROS[k];
    if (l.ausente) lista.push({ classe: 'bloqueia', chave: `${k}:ausente`, ficheiro, ecra: rotulo, mensagem: `Falta o ficheiro ${ficheiro}: sem ele o site não se consegue gerar. Só o Renato o pode repor.` });
    else if (l.ilegivel) lista.push({ classe: 'bloqueia', chave: `${k}:ilegivel`, ficheiro, ecra: rotulo, mensagem: `${rotulo}: o ficheiro não se consegue ler (JSON inválido: ${l.ilegivel}). Só o Renato o pode corrigir.` });
    else lista.push(...fn(l.obj));
  };
  umFicheiro('site', 'Dados da loja', (o) => problemasDoSite(o, { producao: Boolean(opcoes.producao) }));
  umFicheiro('fotos', 'Fotografias', (o) => problemasDasFotos(o, Array.isArray(d.ficheirosFotos) ? d.ficheirosFotos : null));
  umFicheiro('videos', 'Vídeos', (o) => problemasDosVideos(o, Array.isArray(d.ficheirosVideos) ? d.ficheirosVideos : null));
  umFicheiro('categorias', 'Categorias', (o) => problemasDasCategorias(o, { icones }));
  umFicheiro('inicio', 'Página inicial', (o) => problemasDoInicio(o, { fotos, videos, icones }));

  const mapa = d.artigos;
  if (eObjecto(mapa)) {
    for (const nome of Object.keys(mapa).sort()) {
      const valor = mapa[nome];
      if (ausente(valor)) continue;
      const slug = slugDoFicheiro(nome);
      const ficheiro = ficheiroDoArtigo(nome);
      const ecra = `Artigos › ${slug}`;
      const base = { ficheiro, slug };
      const l = lerJson(valor);
      if (l.ilegivel) { lista.push({ classe: 'bloqueia', chave: `artigo:${slug}:ilegivel`, ecra, ...base, mensagem: `O ficheiro deste artigo não se consegue ler (JSON inválido: ${l.ilegivel}). Só o Renato o pode corrigir.` }); continue; }
      if (!eObjecto(l.obj)) { lista.push({ classe: 'bloqueia', chave: `artigo:${slug}:forma`, ecra, ...base, mensagem: 'O ficheiro deste artigo não tem a forma de um artigo. Só o Renato o pode corrigir.' }); continue; }
      if (!slugValido(slug)) { lista.push({ classe: 'bloqueia', chave: `artigo:${slug}:endereco`, ecra, ...base, mensagem: `O nome do ficheiro («${nome}») não é um endereço válido (só minúsculas, algarismos e hífenes). Só o Renato o pode corrigir.` }); continue; }
      lista.push(...problemasDoArtigo(l.obj, { nome, categorias, fotos, videos, hoje: opcoes.hoje, producao: Boolean(opcoes.producao) }));
      const bytes = l.texto !== null ? bytesDe(l.texto) : bytesDe(serializar(l.obj));
      if (bytes > TECTOS.artigoBytes * TECTOS.aviso) lista.push({ classe: 'avisa', lembrete: true, chave: `artigo:${slug}:tecto`, ecra: ecraDoArtigo(l.obj, slug), ...base, mensagem: `Este artigo está a chegar ao limite do painel (${Math.round(bytes / 1024)} de ${TECTOS.artigoBytes / 1024} KB): encurte a descrição.` });
    }
  }
  return lista;
}

/* ------------------------------------------------------------------ */
/* A cópia que o gerador lê                                            */
/* ------------------------------------------------------------------ */

/* neutralizar(dados, lista) → { artigos: { <nome>: objecto }, efeitos, mudou }
 *   Os problemas «neutraliza» aplicados a uma CÓPIA dos artigos (o repositório
 *   não muda):
 *     · esconder       — publicado: false (sai do site, como um rascunho);
 *     · sem_fotografia — a fotografia sai da lista.
 *   efeitos: o que muda NO SITE, por artigo: [{ ficheiro, slug, nome, efeitos, motivos }] */
export function neutralizar(dados = {}, lista = []) {
  const d = eObjecto(dados) ? dados : {};
  const porFicheiro = new Map();
  for (const p of Array.isArray(lista) ? lista : []) {
    if (p && p.classe === 'neutraliza' && typeof p.ficheiro === 'string') porFicheiro.set(p.ficheiro, [...(porFicheiro.get(p.ficheiro) || []), p]);
  }
  const artigos = {};
  const efeitos = [];
  let mudou = false;
  const mapa = eObjecto(d.artigos) ? d.artigos : {};
  for (const nome of Object.keys(mapa).sort()) {
    const l = lerJson(mapa[nome]);
    if (!eObjecto(l.obj)) continue;
    const a = JSON.parse(JSON.stringify(l.obj));
    const prs = porFicheiro.get(ficheiroDoArtigo(nome)) || [];
    const feitos = []; const motivos = [];
    if (prs.some((p) => p.efeito === 'esconder')) {
      if (a.publicado !== false) { a.publicado = false; feitos.push('esconder'); mudou = true; }
      motivos.push(...prs.filter((p) => p.efeito === 'esconder').map((p) => p.mensagem));
    }
    const tirar = new Set(prs.filter((p) => p.efeito === 'sem_fotografia').map((p) => String(p.foto)));
    if (tirar.size && Array.isArray(a.fotos)) {
      a.fotos = a.fotos.filter((f) => !tirar.has(String(f)));
      mudou = true;
      if (!feitos.includes('esconder')) { feitos.push('sem_fotografia'); motivos.push(...prs.filter((p) => p.efeito === 'sem_fotografia').map((p) => p.mensagem)); }
    }
    artigos[nome] = a;
    if (feitos.length) efeitos.push({ ficheiro: ficheiroDoArtigo(nome), slug: slugDoFicheiro(nome), nome: nomeDoArtigo(l.obj, slugDoFicheiro(nome)), efeitos: feitos, motivos });
  }
  return { artigos, efeitos, mudou };
}

const DESCRICAO_EFEITOS = { esconder: 'escondido do site', sem_fotografia: 'com fotografias que não aparecem' };
export const descreverEfeitos = (e) => e.efeitos.map((x) => DESCRICAO_EFEITOS[x] || x).join(' e ');

/* ------------------------------------------------------------------ */
/* O que o painel não pode mudar ao gravar                             */
/* ------------------------------------------------------------------ */

const valorEmCaminho = (o, caminho) => caminho.split('.').reduce((x, k) => (eObjecto(x) ? x[k] : undefined), o);

/* mudancasBloqueadas(antes, depois, qual) → [{ caminho, motivo }] ([] = pode gravar)
 *   'artigo':     as chaves que não são CAMPOS_ARTIGO não mudam;
 *   'site':       BLOQUEADOS_SITE não mudam, e não aparecem secções novas;
 *   'categorias': as categorias são as mesmas, pela mesma ordem (o slug);
 *   'inicio':     não aparecem nem desaparecem secções. */
export function mudancasBloqueadas(antes, depois, qual = 'site') {
  const out = [];
  if (qual === 'artigo') {
    const a = eObjecto(antes) ? antes : {}; const d = eObjecto(depois) ? depois : {};
    for (const k of new Set([...Object.keys(a), ...Object.keys(d)])) {
      if (CAMPOS_ARTIGO.includes(k) || mesmoValor(a[k], d[k])) continue;
      out.push({ caminho: k, motivo: tem(a, k) ? 'mudou' : 'chave_nova' });
    }
    return out;
  }
  if (qual === 'categorias') {
    const a = Array.isArray(antes) ? antes : []; const d = Array.isArray(depois) ? depois : [];
    if (a.length !== d.length) return [{ caminho: 'categorias', motivo: 'quantas' }];
    a.forEach((c, i) => {
      if (!mesmoValor(eObjecto(c) ? c.slug : null, eObjecto(d[i]) ? d[i].slug : null)) out.push({ caminho: `${i}.slug`, motivo: 'mudou' });
    });
    return out;
  }
  const a = eObjecto(antes) ? antes : {}; const d = eObjecto(depois) ? depois : {};
  if (qual === 'inicio') {
    for (const k of new Set([...Object.keys(a), ...Object.keys(d)])) if (!tem(a, k) || !tem(d, k)) out.push({ caminho: k, motivo: tem(a, k) ? 'saiu' : 'chave_nova' });
    return out;
  }
  for (const caminho of BLOQUEADOS_SITE) if (!mesmoValor(valorEmCaminho(a, caminho), valorEmCaminho(d, caminho))) out.push({ caminho, motivo: 'mudou' });
  const conhecidas = new Set([...Object.keys(a), ...Object.keys(SECCOES_SITE), 'descricao', 'assinatura']);
  for (const k of Object.keys(d)) if (!conhecidas.has(k)) out.push({ caminho: k, motivo: 'chave_nova' });
  return out;
}

/* A ORDEM DAS CHAVES AO GRAVAR: as que já estavam no ficheiro ficam onde
   estavam; uma nova entra antes da primeira que, na ordem do formulário, vem
   depois dela (e no fim, se nenhuma vier); as que o formulário não conhece vão
   para o fim. As que saíram, saem. */
export function ordenarComo(antes, depois, ordem = CAMPOS_ARTIGO) {
  if (!eObjecto(depois)) return depois;
  const a = eObjecto(antes) ? antes : {};
  const chaves = Object.keys(a).filter((k) => tem(depois, k));
  const novas = Object.keys(depois).filter((k) => !chaves.includes(k));
  for (const k of novas.filter((x) => ordem.includes(x))) {
    const i = ordem.indexOf(k);
    const j = chaves.findIndex((x) => ordem.includes(x) && ordem.indexOf(x) > i);
    if (j < 0) chaves.push(k); else chaves.splice(j, 0, k);
  }
  chaves.push(...novas.filter((x) => !ordem.includes(x)));
  const out = {};
  for (const k of chaves) out[k] = depois[k];
  return out;
}

/* As fotografias e os vídeos de cada página de texto (content/paginas/*.md): as linhas «foto: <nome>»,
   «fotos: <a>, <b>» e «videos: <a>, <b>» do cabeçalho, antes do «---». `paginas`: { <nome>: texto }. */
function listaDoCabecalho(paginas, chaves) {
  const out = [];
  for (const t of Object.values(eObjecto(paginas) ? paginas : {})) {
    if (typeof t !== 'string') continue;
    const cabeca = t.split(/\n---\n/)[0];
    for (const k of chaves) {
      const m = new RegExp(`^${k}:\\s*(.+?)\\s*$`, 'm').exec(cabeca);
      if (m) out.push(...m[1].split(',').map((x) => x.trim()).filter(Boolean));
    }
  }
  return out;
}
export const fotosDasPaginas = (paginas = {}) => listaDoCabecalho(paginas, ['foto', 'fotos']);
export const videosDasPaginas = (paginas = {}) => listaDoCabecalho(paginas, ['videos']);

/* AS FOTOGRAFIAS EM USO, em todo o conteúdo: as dos artigos, da página inicial e das páginas de texto
   (dados.paginas). Uma fotografia só sai da biblioteca se não estiver aqui. → Set */
export function fotosEmUso(dados = {}, extra = []) {
  const d = eObjecto(dados) ? dados : {};
  const usadas = new Set();
  /* Um nome com espaços à volta (escrito à mão) não aparece no site, mas conta como usado: na
     dúvida, uma fotografia nunca sai da biblioteca. */
  const juntar = (f) => { if (typeof f === 'string') { usadas.add(f); usadas.add(f.trim()); } };
  [...extra, ...fotosDasPaginas(d.paginas)].forEach(juntar);
  if (eObjecto(d.artigos)) for (const v of Object.values(d.artigos)) { const a = lerJson(v).obj; if (eObjecto(a) && Array.isArray(a.fotos)) a.fotos.forEach(juntar); }
  fotosDoInicio(lerJson(d.inicio).obj).forEach(juntar);
  return usadas;
}
