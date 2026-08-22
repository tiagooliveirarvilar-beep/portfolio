/* Home: cronologia de projetos, mais recente primeiro. */

(async function () {
  const alvo = document.getElementById('projetos');

  try {
    const projetos = await carregarProjetos();

    alvo.innerHTML = projetos.map(p => `
      <div class="projeto">
        <span class="projeto__num">${p.numero}</span>
        <a class="projeto__link" href="projeto.html?p=${encodeURIComponent(p.slug)}" aria-label="${p.titulo}">
          <img class="projeto__foto" src="${p.capa || 'images/placeholder.svg'}" alt="${p.titulo}">
        </a>
        <span class="projeto__info">
          <span class="projeto__nome">${p.titulo}</span>
          <span class="projeto__data">${p.dataTexto}</span>
        </span>
      </div>
    `).join('');
  } catch (erro) {
    console.error(erro);
  }
})();
