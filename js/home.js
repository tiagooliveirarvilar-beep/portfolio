/* Home: cronologia de projetos, mais recente primeiro. */

(async function () {
  const alvo = document.getElementById('projetos');

  try {
    const projetos = await carregarProjetos();

    alvo.innerHTML = projetos.map(p => `
      <a class="projeto" href="projeto.html?p=${encodeURIComponent(p.slug)}">
        <span class="projeto__num">${p.numero}</span>
        <img class="projeto__foto" src="${p.capa || 'images/placeholder.svg'}" alt="${p.titulo}">
        <span class="projeto__info">
          <span class="projeto__nome">${p.titulo}</span>
          <span class="projeto__data">${p.dataTexto}</span>
        </span>
      </a>
    `).join('');
  } catch (erro) {
    console.error(erro);
  }
})();
