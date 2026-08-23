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

async function carregarJSON(caminho) {
  const resposta = await fetch(caminho, { cache: 'no-cache' });
  if (!resposta.ok) throw new Error(`Nao consegui ler ${caminho}`);
  return resposta.json();
}

/* A ordem da home e exatamente a ordem da lista no painel: o que estiver em
   primeiro lugar no /admin aparece em primeiro lugar no site. Nada e
   reordenado automaticamente.

   O numero e o numero do projeto na carreira: 01 e o mais antigo e o numero
   mais alto e o mais recente. Como a lista esta pelo mais recente primeiro,
   a numeracao corre ao contrario da posicao. */
async function carregarProjetos() {
  const dados = await carregarJSON('content/projetos.json');
  const lista = dados.projetos || [];
  const total = lista.length;

  return lista.map((projeto, i) => ({
    ...projeto,
    slug: projeto.slug || criarSlug(projeto.titulo),
    numero: String(total - i).padStart(2, '0'),
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

/* w/h acima de 1 significam que a moldura e MAIOR do que a foto: ve-se a foto
   toda, com espaco a volta. E assim que uma foto vertical cabe inteira numa
   capa quadrada, sem ser cortada. */
function recorteDe(valor) {
  if (!valor || typeof valor === 'string') return null;
  const w = Number(valor.w), h = Number(valor.h);
  if (!(w > 0 && h > 0)) return null;
  const x = Number(valor.x) || 0;
  const y = Number(valor.y) || 0;
  if (w === 1 && h === 1 && !x && !y) return null;   // enquadramento por definir
  return { x, y, w, h, proporcao: Number(valor.proporcao) || 1 };
}

/* Posiciona a foto dentro da caixa de recorte.

   A LARGURA acompanha a caixa, a ALTURA fica automatica, e o deslocamento e
   feito por transform — cujas percentagens contam a partir da propria
   imagem, nao da caixa. Assim a foto mantem SEMPRE a sua proporcao natural:
   nunca pode aparecer esticada ou espalmada, mesmo que o valor de proporcao
   guardado esteja errado (nesse caso ve-se um pedaco maior ou menor do que
   o escolhido, mas a foto em si nunca deforma). */
function estiloRecorte(r) {
  return `left:0;top:0;width:${100 / r.w}%;height:auto;` +
         `transform:translate(${-r.x * 100}%, ${-r.y * 100}%)`;
}

/* Constroi a imagem ja recortada.

   Nunca ha placeholder: se ainda nao existe imagem, a caixa fica so em
   branco (cor de fundo do site), do tamanho certo, sem <img> nenhuma. */
function htmlImagem(valor, classe, alt, proporcaoFixa) {
  const src = fonteImagem(valor);

  if (!src) {
    return proporcaoFixa
      ? `<span class="recorte ${classe}" style="aspect-ratio:${proporcaoFixa}"></span>`
      : '';
  }

  const r = recorteDe(valor);

  if (!r) {
    return proporcaoFixa
      ? `<span class="recorte ${classe}"><img src="${src}" alt="${alt}" class="recorte__cheia"></span>`
      : `<img class="${classe}" src="${src}" alt="${alt}">`;
  }

  const proporcao = proporcaoFixa || r.proporcao;

  return `<span class="recorte ${classe}" style="aspect-ratio:${proporcao}">` +
         `<img src="${src}" alt="${alt}" style="${estiloRecorte(r)}"></span>`;
}
