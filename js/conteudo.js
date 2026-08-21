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
