/* Home: um ecra inteiro por projeto, mais recente primeiro. */

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

  try {
    const sobre = await carregarJSON('content/sobre.json');
    document.getElementById('sobre-texto').textContent = sobre.texto || '';
    if (sobre.foto) document.getElementById('sobre-foto').src = sobre.foto;
  } catch (erro) {
    console.error(erro);
  }

  try {
    const contacto = await carregarJSON('content/contacto.json');
    const linhas = [
      contacto.email ? `<a href="mailto:${contacto.email}">${contacto.email}</a>` : '',
      contacto.telefone ? `<a href="tel:${contacto.telefone.replace(/\s/g, '')}">${contacto.telefone}</a>` : '',
      contacto.local || ''
    ].filter(Boolean);
    document.getElementById('contacto-lista').innerHTML =
      linhas.map(linha => `<li>${linha}</li>`).join('');
  } catch (erro) {
    console.error(erro);
  }
})();
