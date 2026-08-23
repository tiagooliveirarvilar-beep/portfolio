/* Pagina de projeto: scroll normal da pagina, titulo fixo, lightbox simples. */

(async function () {
  const slug = new URLSearchParams(location.search).get('p');
  const projetos = await carregarProjetos();
  const projeto = projetos.find(p => p.slug === slug);

  if (!projeto) { location.replace('index.html'); return; }

  document.title = `${projeto.titulo} — Tiago Oliveira Ribeiro Vilar`;
  document.getElementById('titulo').textContent = projeto.titulo;

  /* Sem imagens proprias, usa a capa como unica foto da galeria; sem
     nenhuma das duas, a galeria fica vazia — nunca ha placeholder. */
  const imagens = (projeto.imagens && projeto.imagens.length)
    ? projeto.imagens
    : (fonteImagem(projeto.capa) ? [{ imagem: projeto.capa, legenda: '' }] : []);

  /* Todas as imagens saem com a mesma largura; so a altura acompanha o
     recorte escolhido no painel. */
  document.getElementById('galeria').innerHTML = imagens.map((img, i) => `
    <figure data-indice="${i}">
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

  /* Ampliacao: mostra exatamente o mesmo recorte que esta na pagina, so
     maior — nunca a fotografia inteira. */
  const lightbox = document.getElementById('lightbox');
  const caixaGrande = lightbox.querySelector('.lightbox__foto');

  document.getElementById('galeria').addEventListener('click', evento => {
    const figura = evento.target.closest('figure');
    if (!figura) return;

    const valor = imagens[Number(figura.dataset.indice)].imagem;
    const src = fonteImagem(valor);
    if (!src) return;

    const r = recorteDe(valor);
    const proporcao = r ? r.proporcao : 0;

    /* O tamanho e calculado aqui porque so agora se sabe a proporcao do
       recorte: escolhe-se o maior que caiba no ecra sem cortar nada. */
    const margem = 40;
    const dispW = window.innerWidth - margem * 2;
    const dispH = window.innerHeight - margem * 2;

    if (proporcao > 0) {
      const largura = Math.min(dispW, dispH * proporcao);
      caixaGrande.style.width = largura + 'px';
      caixaGrande.style.height = (largura / proporcao) + 'px';
      caixaGrande.innerHTML = `<img src="${src}" alt="" style="${estiloRecorte(r)}">`;
    } else {
      /* Imagem sem recorte definido: mostra-se inteira, encaixada no ecra. */
      caixaGrande.style.width = dispW + 'px';
      caixaGrande.style.height = dispH + 'px';
      caixaGrande.innerHTML = `<img src="${src}" alt="" class="recorte__cheia">`;
    }

    lightbox.classList.add('aberta');
  });

  function fecharAmpliacao() {
    lightbox.classList.remove('aberta');
    caixaGrande.innerHTML = '';
  }

  lightbox.addEventListener('click', fecharAmpliacao);
  document.addEventListener('keydown', evento => {
    if (evento.key === 'Escape') fecharAmpliacao();
  });
})();
