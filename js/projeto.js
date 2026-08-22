/* Pagina de projeto: scroll normal da pagina, titulo fixo, lightbox simples. */

(async function () {
  const slug = new URLSearchParams(location.search).get('p');
  const projetos = await carregarProjetos();
  const projeto = projetos.find(p => p.slug === slug);

  if (!projeto) { location.replace('index.html'); return; }

  document.title = `${projeto.titulo} — Tiago Oliveira Ribeiro Vilar`;
  document.getElementById('titulo').textContent = projeto.titulo;

  const imagens = (projeto.imagens && projeto.imagens.length)
    ? projeto.imagens
    : [{ imagem: projeto.capa || 'images/placeholder.svg', legenda: '' }];

  /* Todas as imagens saem com a mesma largura; so a altura acompanha o
     recorte escolhido no painel. */
  document.getElementById('galeria').innerHTML = imagens.map(img => `
    <figure>
      ${htmlImagem(img.imagem, 'galeria__foto', projeto.titulo)}
      ${img.legenda ? `<figcaption>${img.legenda}</figcaption>` : ''}
    </figure>
  `).join('');

  /* Ficha tecnica: descricao a esquerda, dados e creditos nas colunas seguintes. */
  const dados = [
    ['local', projeto.local],
    ['data', projeto.periodo || projeto.dataTexto],
    ['disciplina', projeto.disciplina],
    ['área', projeto.area]
  ].filter(([, valor]) => valor);

  const creditos = [
    ['colaboração', projeto.colaboracao],
    ['fotografia', projeto.fotografia],
    ['orientação', projeto.orientacao]
  ].filter(([, valor]) => valor);

  const coluna = pares => pares.length
    ? `<dl>${pares.map(([r, v]) => `<dt>${r}</dt><dd>${v}</dd>`).join('')}</dl>`
    : '<div></div>';

  document.getElementById('ficha').innerHTML = `
    <h2>ficha técnica</h2>
    <p>${projeto.descricao || ''}</p>
    ${coluna(dados)}
    ${coluna(creditos)}
  `;

  /* Lightbox */
  const lightbox = document.getElementById('lightbox');
  const grande = lightbox.querySelector('img');

  document.getElementById('galeria').addEventListener('click', evento => {
    if (evento.target.tagName !== 'IMG') return;
    grande.src = evento.target.src;
    lightbox.classList.add('aberta');
  });

  lightbox.addEventListener('click', () => lightbox.classList.remove('aberta'));
  document.addEventListener('keydown', evento => {
    if (evento.key === 'Escape') lightbox.classList.remove('aberta');
  });
})();
