/* Marca fixa "Tiago Vilar" + ecra de Sobre Mim e Contacto.
   Vive em todas as paginas: a marca esta sempre visivel e o ecra que ela abre
   nao faz scroll nem entra na cronologia de projetos. */

(async function () {
  const marca = document.getElementById('marca');
  const perfil = document.getElementById('perfil');

  if (!marca || !perfil) return;

  try {
    const sobre = await carregarJSON('content/sobre.json');
    document.getElementById('sobre-texto').textContent = sobre.texto || '';
    const foto = document.getElementById('sobre-foto');
    if (sobre.foto) { foto.src = sobre.foto; foto.hidden = false; }
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

  function mostrar(aberto) {
    perfil.hidden = !aberto;
    marca.setAttribute('aria-expanded', String(aberto));
    document.body.classList.toggle('sem-scroll', aberto);
  }

  marca.addEventListener('click', () => mostrar(perfil.hidden));

  document.addEventListener('keydown', evento => {
    if (evento.key === 'Escape') mostrar(false);
  });
})();
