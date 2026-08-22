/* Carregamento e normalizacao do conteudo editado no painel /admin.
   Nada aqui precisa de ser tocado para adicionar ou mudar projetos. */

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
               'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/* Datas sempre por extenso, "mes de ano"; projetos em curso mostram "em curso". */
function formatarData(projeto) {
  if (projeto.emCurso) return 'em curso';
  if (!projeto.data) return '';
  const [ano, mes] = String(projeto.data).split('-');
  if (!mes) return ano || '';
  const nome = MESES[Number(mes) - 1];
  return nome ? `${nome} de ${ano}` : ano;
}

function criarSlug(texto) {
  return String(texto || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/* Fluxo unico e cronologico: em curso primeiro, depois do mais recente
   para o mais antigo. O numero (01, 02, ...) vem desta ordem. */
function ordenarProjetos(lista) {
  return lista.slice().sort((a, b) => {
    if (a.emCurso !== b.emCurso) return a.emCurso ? -1 : 1;
    return String(b.data || '').localeCompare(String(a.data || ''));
  });
}

async function carregarJSON(caminho) {
  const resposta = await fetch(caminho, { cache: 'no-cache' });
  if (!resposta.ok) throw new Error(`Nao consegui ler ${caminho}`);
  return resposta.json();
}

async function carregarProjetos() {
  const dados = await carregarJSON('content/projetos.json');
  const lista = ordenarProjetos(dados.projetos || []);
  return lista.map((projeto, i) => ({
    ...projeto,
    slug: projeto.slug || criarSlug(projeto.titulo),
    numero: String(i + 1).padStart(2, '0'),
    dataTexto: formatarData(projeto)
  }));
}

/* --- Imagens com recorte -------------------------------------------------
   O painel guarda cada imagem como { imagem, x, y, w, h, proporcao }, em que
   x/y/w/h sao fracoes da foto original. Valores antigos, guardados apenas como
   texto com o caminho, continuam a funcionar. */

function fonteImagem(valor) {
  if (!valor) return '';
  return typeof valor === 'string' ? valor : (valor.imagem || '');
}

function recorteDe(valor) {
  if (!valor || typeof valor === 'string') return null;
  const w = Number(valor.w), h = Number(valor.h);
  if (!(w > 0 && w <= 1 && h > 0 && h <= 1)) return null;
  const x = Number(valor.x) || 0;
  const y = Number(valor.y) || 0;
  if (w === 1 && h === 1 && !x && !y) return null;   // foto inteira
  return { x, y, w, h, proporcao: Number(valor.proporcao) || 1 };
}

/* Constroi a imagem ja recortada. A caixa exterior fixa a proporcao e a imagem
   la dentro e ampliada e deslocada para so se ver o pedaco escolhido —
   sem nunca deformar a foto. */
function htmlImagem(valor, classe, alt, proporcaoFixa) {
  const src = fonteImagem(valor) || 'images/placeholder.svg';
  const r = recorteDe(valor);

  if (!r) {
    return proporcaoFixa
      ? `<span class="recorte ${classe}"><img src="${src}" alt="${alt}" class="recorte__cheia"></span>`
      : `<img class="${classe}" src="${src}" alt="${alt}">`;
  }

  const proporcao = proporcaoFixa || r.proporcao;
  const caixa = `aspect-ratio:${proporcao}`;
  const imagem = `width:${100 / r.w}%;height:${100 / r.h}%;` +
                 `left:${-r.x * 100 / r.w}%;top:${-r.y * 100 / r.h}%`;

  return `<span class="recorte ${classe}" style="${caixa}">` +
         `<img src="${src}" alt="${alt}" style="${imagem}"></span>`;
}
