/* Gera content/projetos.json a partir das fichas em content/projetos/.
 *
 * Porque e que isto existe: cada projeto passou a ser uma ficha propria, para
 * o painel /admin abrir um projeto de cada vez em pagina inteira. Mas um site
 * estatico nao consegue "ver" o conteudo de uma pasta — nao ha forma de o
 * browser perguntar "que ficheiros existem em content/projetos/?". Por isso
 * juntamos tudo num unico ficheiro que o site le de uma vez, tal como antes.
 *
 * Corre sozinho no GitHub Actions a cada gravacao no painel
 * (.github/workflows/gerar-lista.yml). Nao e preciso correr isto a mao.
 *
 * A ordem e pela data, do mais recente para o mais antigo. Projetos sem data
 * ficam no fim.
 */

const fs = require('fs');
const path = require('path');

const PASTA = path.join(__dirname, '..', 'content', 'projetos');
const DESTINO = path.join(__dirname, '..', 'content', 'projetos.json');

function criarSlug(texto) {
  return String(texto || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function lerFichas() {
  if (!fs.existsSync(PASTA)) return [];

  return fs.readdirSync(PASTA)
    .filter(nome => nome.endsWith('.json'))
    .map(nome => {
      const caminho = path.join(PASTA, nome);
      let dados;
      try {
        dados = JSON.parse(fs.readFileSync(caminho, 'utf8'));
      } catch (erro) {
        throw new Error(`Nao consegui ler ${nome}: ${erro.message}`);
      }
      /* O slug vem do nome do ficheiro, que e o que define o endereco da
         pagina do projeto — assim os links nunca mudam sozinhos. */
      dados.slug = dados.slug || nome.replace(/\.json$/, '') || criarSlug(dados.titulo);
      return dados;
    });
}

function ordenar(projetos) {
  return projetos.slice().sort((a, b) => {
    const da = String(a.data || '');
    const db = String(b.data || '');
    if (!da && !db) return String(a.titulo || '').localeCompare(String(b.titulo || ''));
    if (!da) return 1;   // sem data vai para o fim
    if (!db) return -1;
    return db.localeCompare(da);   // mais recente primeiro
  });
}

function principal() {
  const projetos = ordenar(lerFichas());

  const saida = {
    _gerado: 'Ficheiro gerado automaticamente por scripts/gerar-lista.js. Nao editar a mao — edita as fichas em content/projetos/ pelo painel /admin.',
    projetos: projetos
  };

  fs.writeFileSync(DESTINO, JSON.stringify(saida, null, 2) + '\n', 'utf8');
  console.log(`content/projetos.json gerado com ${projetos.length} projeto(s).`);
  projetos.forEach((p, i) => console.log(`  ${i + 1}. ${p.titulo} (${p.data || 'sem data'})`));
}

principal();
