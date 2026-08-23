/* Widget "galeria" — imagens do projeto, com carregamento multiplo direto do
   computador.

   Ao contrario do recorte (uma imagem), este widget guarda uma LISTA de
   { imagem: <objeto de recorte>, legenda }. O botao "Adicionar fotos" abre
   o explorador de ficheiros do sistema em modo de selecao multipla — nao a
   biblioteca de media do Decap — e cada ficheiro escolhido e enviado
   diretamente via onPersistMedia (a mesma acao que o Decap usa por baixo do
   pano quando se carrega um ficheiro novo na biblioteca), criando uma
   entrada nova na lista por cada foto.

   O recorte de cada foto abre na mesma janela grande do widget "recorte",
   reconstruida aqui para o item da lista que estiver a ser editado.
*/
(function () {
  var h = window.h;
  var createClass = window.createClass;

  if (!h || !createClass) {
    console.error('galeria.js: o Decap CMS nao expos "h"/"createClass".');
    return;
  }

  var MINIMO = 0.04;
  var MAXIMO = 6;
  var MARGEM = 90;
  var LADO_MINIATURA = 130;

  /* Roda a foto 90 graus (sentido horario) desenhando-a rodada num canvas e
     gravando o resultado.

     Grava no MESMO formato do original. Antes gravava sempre em PNG, o que
     tornava a rotacao muito lenta: comprimir uma fotografia grande em PNG
     demora e produz um ficheiro varias vezes maior, que ainda tem de ser
     enviado a seguir. Um JPEG volta a sair JPEG; so as imagens PNG, que podem
     ter fundo transparente, continuam em PNG.

     Devolve tambem as medidas novas (as antigas trocadas): quem chama precisa
     delas para recalcular a proporcao sem esperar por outro carregamento. */
  function rodarFicheiro(urlAtual, nomeAtual, onPersistMedia, field) {
    return new Promise(function (resolve, reject) {
      var ehPNG = /\.png$/i.test(nomeAtual || '');
      var tipo = ehPNG ? 'image/png' : 'image/jpeg';
      var extensao = ehPNG ? '.png' : '.jpg';

      var img = new Image();
      img.onload = function () {
        var W = img.naturalWidth, H = img.naturalHeight;
        var canvas = document.createElement('canvas');
        canvas.width = H;
        canvas.height = W;
        var ctx = canvas.getContext('2d');
        ctx.translate(canvas.width, 0);
        ctx.rotate(Math.PI / 2);
        ctx.drawImage(img, 0, 0);

        canvas.toBlob(function (blob) {
          if (!blob) { reject(new Error('canvas.toBlob devolveu vazio')); return; }
          /* Tira um "-r<numero>" anterior, para rodar varias vezes nao ir
             acumulando sufixos no nome do ficheiro. */
          var base = (nomeAtual || 'foto').replace(/\.[a-z0-9]+$/i, '').replace(/-r\d+$/, '');
          var ficheiro = new File([blob], base + '-r' + Date.now() + extensao, { type: tipo });
          onPersistMedia(ficheiro, { field: field }).then(function (resultado) {
            var caminho = resultado && resultado.payload && resultado.payload.path;
            if (!caminho) { reject(new Error('onPersistMedia nao devolveu um caminho')); return; }
            resolve({ caminho: caminho, largura: H, altura: W });
          }, reject);
        }, tipo, ehPNG ? undefined : 0.92);
      };
      img.onerror = function () { reject(new Error('falha ao carregar a imagem para rodar')); };
      img.src = urlAtual;
    });
  }

  /* Roda o proprio recorte junto com a foto, para o enquadramento escolhido
     nao se perder. Ao rodar 90 graus no sentido horario o que estava a
     esquerda passa para cima: um ponto (fx, fy) da foto passa a (1 - fy, fx).
     Aplicando isso aos cantos do retangulo obtem-se o retangulo novo. */
  function rodarRecorte(v) {
    return { x: 1 - v.y - v.h, y: v.x, w: v.h, h: v.w };
  }

  function limitar(v, min, max) { return Math.min(max, Math.max(min, v)); }
  function num(v, omissao) { var n = parseFloat(v); return isFinite(n) ? n : omissao; }

  function normalizarImagem(valor) {
    if (valor && typeof valor.toJS === 'function') valor = valor.toJS();
    if (typeof valor === 'string') valor = { imagem: valor };
    valor = valor || {};
    return {
      imagem: valor.imagem || '',
      x: num(valor.x, 0),
      y: num(valor.y, 0),
      w: limitar(num(valor.w, 1), MINIMO, MAXIMO),
      h: limitar(num(valor.h, 1), MINIMO, MAXIMO),
      proporcao: num(valor.proporcao, 1)
    };
  }

  function normalizarLista(valor) {
    if (valor && typeof valor.toJS === 'function') valor = valor.toJS();
    if (!Array.isArray(valor)) return [];
    return valor.map(function (item) {
      if (item && typeof item.toJS === 'function') item = item.toJS();
      item = item || {};
      return { imagem: normalizarImagem(item.imagem), legenda: item.legenda || '' };
    });
  }

  var Controlo = createClass({
    getInitialState: function () {
      return {
        aEnviar: 0, totalAEnviar: 0,           /* progresso do carregamento */
        indiceEditar: -1, larguraNatural: 0, alturaNatural: 0,
        aArrastar: null, dispoW: 460, dispoH: 460
      };
    },

    componentWillUnmount: function () {
      this.pararArrasto();
      window.removeEventListener('keydown', this.aoTeclar);
    },

    lista: function () { return normalizarLista(this.props.value); },

    gravarLista: function (nova) { this.props.onChange(nova); },

    /* --- Carregar varias fotos de uma vez ------------------------------- */
    escolherFicheiros: function (evento) {
      evento.preventDefault();
      var self = this;
      var input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.multiple = true;
      input.onchange = function () {
        var ficheiros = [].slice.call(input.files || []);
        if (ficheiros.length) self.enviarFicheiros(ficheiros);
      };
      input.click();
    },

    enviarFicheiros: function (ficheiros) {
      var self = this;
      /* Acumula-se numa variavel local, nunca voltando a ler this.props.value
         entre ficheiros: depois de um onChange, o React so atualiza as props
         no proximo render, que pode nao ter acontecido ainda quando o
         ficheiro seguinte comeca — reler props.value nesse intervalo perdia
         os ficheiros anteriores (cada gravacao substituia a anterior em vez
         de se somar). Confirmado com um teste isolado antes desta correcao. */
      var acumulado = this.lista();
      this.setState({ aEnviar: 0, totalAEnviar: ficheiros.length });

      /* Um de cada vez, para nao sobrecarregar o backend nem embaralhar a
         ordem com pedidos em paralelo. */
      function proximo(i) {
        if (i >= ficheiros.length) {
          self.setState({ aEnviar: 0, totalAEnviar: 0 });
          return;
        }
        self.props.onPersistMedia(ficheiros[i], { field: self.props.field })
          .then(function (resultado) {
            var caminho = resultado && resultado.payload && resultado.payload.path;
            if (!caminho) {
              console.error('galeria.js: onPersistMedia nao devolveu um caminho.', resultado);
            } else {
              acumulado = acumulado.concat([{ imagem: normalizarImagem({ imagem: caminho }), legenda: '' }]);
              self.gravarLista(acumulado);
            }
            self.setState({ aEnviar: i + 1 });
            proximo(i + 1);
          })
          .catch(function (erro) {
            console.error('galeria.js: falha ao enviar ' + ficheiros[i].name, erro);
            self.setState({ aEnviar: i + 1 });
            proximo(i + 1);
          });
      }
      proximo(0);
    },

    removerItem: function (indice) {
      var lista = this.lista();
      lista.splice(indice, 1);
      this.gravarLista(lista);
    },

    moverItem: function (indice, direcao) {
      var lista = this.lista();
      var alvo = indice + direcao;
      if (alvo < 0 || alvo >= lista.length) return;
      var tmp = lista[indice];
      lista[indice] = lista[alvo];
      lista[alvo] = tmp;
      this.gravarLista(lista);
    },

    mudarLegenda: function (indice, texto) {
      var lista = this.lista();
      lista[indice] = { imagem: lista[indice].imagem, legenda: texto };
      this.gravarLista(lista);
    },

    /* --- Editor de recorte de um item ------------------------------------ */
    abrirEditor: function (indice) {
      var self = this;
      return function (evento) {
        evento.preventDefault();
        var dispo = {
          dispoW: Math.max(240, window.innerWidth - MARGEM * 2 - 60),
          dispoH: Math.max(240, window.innerHeight - MARGEM * 2 - 150)
        };

        /* Medir a foto ANTES de abrir. Sem as medidas reais, disposicao()
           cai num quadrado por omissao e a foto abria deformada ate o load
           chegar — era isto que se via como "foto esticada". */
        var lista = self.lista();
        var caminho = lista[indice] ? lista[indice].imagem.imagem : '';
        var medidor = new Image();
        medidor.onload = function () {
          self.setState(Object.assign({
            indiceEditar: indice,
            larguraNatural: medidor.naturalWidth,
            alturaNatural: medidor.naturalHeight
          }, dispo));
        };
        medidor.onerror = function () {
          self.setState(Object.assign({ indiceEditar: indice, larguraNatural: 0, alturaNatural: 0 }, dispo));
        };
        medidor.src = self.urlDaImagem(caminho);

        window.addEventListener('keydown', self.aoTeclar);
      };
    },

    fecharEditor: function (evento) {
      if (evento) evento.preventDefault();
      this.pararArrasto();
      window.removeEventListener('keydown', this.aoTeclar);
      this.setState({ indiceEditar: -1 });
    },

    aoTeclar: function (evento) {
      if (evento.key === 'Escape') this.fecharEditor();
    },

    valorEmEdicao: function () {
      var lista = this.lista();
      return lista[this.state.indiceEditar] ? lista[this.state.indiceEditar].imagem : normalizarImagem();
    },

    gravarEmEdicao: function (novo) {
      var v = normalizarImagem(novo);
      var W = this.state.larguraNatural, H = this.state.alturaNatural;
      v.proporcao = (W && H) ? (v.w * W) / (v.h * H) : (this.valorEmEdicao().proporcao || 1);
      v.x = limitar(v.x, -MAXIMO, MAXIMO);
      v.y = limitar(v.y, -MAXIMO, MAXIMO);

      var lista = this.lista();
      var i = this.state.indiceEditar;
      if (!lista[i]) return;
      lista[i] = { imagem: v, legenda: lista[i].legenda };
      this.gravarLista(lista);
    },

    disposicao: function () {
      var W = this.state.larguraNatural || 1, H = this.state.alturaNatural || 1;
      var escala = Math.min(this.state.dispoW / W, this.state.dispoH / H);
      var fotoW = W * escala, fotoH = H * escala;
      return { fotoW: fotoW, fotoH: fotoH, fotoX: MARGEM, fotoY: MARGEM, palcoW: fotoW + MARGEM * 2, palcoH: fotoH + MARGEM * 2 };
    },

    ajusteTotal: function () {
      var W = this.state.larguraNatural, H = this.state.alturaNatural;
      if (!W || !H) return { w: 1, h: 1 };
      var lado = Math.max(W, H);
      return { w: lado / W, h: lado / H };
    },

    verTudo: function (evento) {
      evento.preventDefault();
      var m = this.ajusteTotal();
      var v = this.valorEmEdicao();
      this.gravarEmEdicao({ imagem: v.imagem, w: m.w, h: m.h, x: (1 - m.w) / 2, y: (1 - m.h) / 2 });
    },

    rodar90: function (evento) {
      evento.preventDefault();
      var self = this;
      var v = this.valorEmEdicao();
      var nome = (v.imagem || 'foto').split('/').pop();
      this.setState({ aRodar: true });
      rodarFicheiro(this.urlDaImagem(v.imagem), nome, this.props.onPersistMedia, this.props.field)
        .then(function (novo) {
          /* As medidas novas sao gravadas no estado ANTES de guardar o valor.
             Antes punha-se aqui 0 e o recorte ficava logo a seguir a zero: sem
             medidas, gravarEmEdicao nao conseguia calcular a proporcao e
             reaproveitava a ANTIGA, que ja nao correspondia a foto rodada — era
             isto que deixava o recorte errado depois de rodar. */
          var r = rodarRecorte(v);
          self.setState({ larguraNatural: novo.largura, alturaNatural: novo.altura, aRodar: false }, function () {
            self.gravarEmEdicao({ imagem: novo.caminho, x: r.x, y: r.y, w: r.w, h: r.h });
          });
        })
        .catch(function (erro) {
          console.error('galeria.js: falha ao rodar a imagem.', erro);
          self.setState({ aRodar: false });
        });
    },

    aoCarregarImagem: function (evento) {
      var img = evento.target;
      var self = this;
      this.setState({ larguraNatural: img.naturalWidth, alturaNatural: img.naturalHeight }, function () {
        var v = self.valorEmEdicao();
        if (v.w === 1 && v.h === 1 && !v.x && !v.y) {
          var m = self.ajusteTotal();
          self.gravarEmEdicao({ imagem: v.imagem, w: m.w, h: m.h, x: (1 - m.w) / 2, y: (1 - m.h) / 2 });
        }
      });
    },

    aoPremirCorpo: function (evento) { evento.preventDefault(); this.iniciarArrasto(evento, 'mover'); },

    aoPremirCanto: function (canto) {
      var self = this;
      return function (evento) { evento.preventDefault(); evento.stopPropagation(); self.iniciarArrasto(evento, canto); };
    },

    iniciarArrasto: function (evento, modo) {
      this.arrasto = { modo: modo, xInicial: evento.clientX, yInicial: evento.clientY, v: this.valorEmEdicao() };
      window.addEventListener('mousemove', this.aoMover);
      window.addEventListener('mouseup', this.pararArrasto);
      this.setState({ aArrastar: modo });
    },

    aoMover: function (evento) {
      var a = this.arrasto;
      if (!a) return;
      var d = this.disposicao();
      var dxFracao = (evento.clientX - a.xInicial) / d.fotoW;
      var dyFracao = (evento.clientY - a.yInicial) / d.fotoH;
      var v = a.v;

      if (a.modo === 'mover') {
        this.gravarEmEdicao({ imagem: v.imagem, w: v.w, h: v.h, x: v.x + dxFracao, y: v.y + dyFracao });
        return;
      }

      /* Lados: so mexe num eixo de cada vez, mantendo o lado oposto fixo. */
      if (a.modo === 'topo') {
        var ancoraTopo = v.y + v.h;
        var novoYt = limitar(v.y + dyFracao, ancoraTopo - MAXIMO, ancoraTopo - MINIMO);
        this.gravarEmEdicao({ imagem: v.imagem, w: v.w, h: ancoraTopo - novoYt, x: v.x, y: novoYt });
        return;
      }
      if (a.modo === 'base') {
        this.gravarEmEdicao({ imagem: v.imagem, w: v.w, h: limitar(v.h + dyFracao, MINIMO, MAXIMO), x: v.x, y: v.y });
        return;
      }
      if (a.modo === 'esquerda') {
        var ancoraEsq = v.x + v.w;
        var novoXe = limitar(v.x + dxFracao, ancoraEsq - MAXIMO, ancoraEsq - MINIMO);
        this.gravarEmEdicao({ imagem: v.imagem, w: ancoraEsq - novoXe, h: v.h, x: novoXe, y: v.y });
        return;
      }
      if (a.modo === 'direita') {
        this.gravarEmEdicao({ imagem: v.imagem, w: limitar(v.w + dxFracao, MINIMO, MAXIMO), h: v.h, x: v.x, y: v.y });
        return;
      }

      var ancoraX, ancoraY, movX, movY;
      if (a.modo === 'br') { ancoraX = v.x; ancoraY = v.y; movX = v.x + v.w + dxFracao; movY = v.y + v.h + dyFracao; }
      if (a.modo === 'bl') { ancoraX = v.x + v.w; ancoraY = v.y; movX = v.x + dxFracao; movY = v.y + v.h + dyFracao; }
      if (a.modo === 'tr') { ancoraX = v.x; ancoraY = v.y + v.h; movX = v.x + v.w + dxFracao; movY = v.y + dyFracao; }
      if (a.modo === 'tl') { ancoraX = v.x + v.w; ancoraY = v.y + v.h; movX = v.x + dxFracao; movY = v.y + dyFracao; }

      var dx = movX - ancoraX;
      var dy = movY - ancoraY;

      var novoW = limitar(Math.abs(dx), MINIMO, MAXIMO);
      var novoH = limitar(Math.abs(dy), MINIMO, MAXIMO);
      var novoX = dx < 0 ? ancoraX - novoW : ancoraX;
      var novoY = dy < 0 ? ancoraY - novoH : ancoraY;

      this.gravarEmEdicao({ imagem: v.imagem, w: novoW, h: novoH, x: novoX, y: novoY });
    },

    pararArrasto: function () {
      this.arrasto = null;
      window.removeEventListener('mousemove', this.aoMover);
      window.removeEventListener('mouseup', this.pararArrasto);
      if (this.state.aArrastar) this.setState({ aArrastar: null });
    },

    urlDaImagem: function (caminho) {
      if (!caminho) return '';
      if (/^(https?:)?\/\//.test(caminho) || caminho.indexOf('data:') === 0) return caminho;
      var asset = this.props.getAsset ? this.props.getAsset(caminho, this.props.field) : null;
      return asset ? String(asset) : caminho;
    },

    /* --- Render ----------------------------------------------------------- */
    janelaRecortada: function (v, largura, key) {
      var altura = largura / (v.proporcao || 1);
      return h('span', {
        key: key,
        style: {
          position: 'relative', display: 'block', overflow: 'hidden',
          width: largura + 'px', height: altura + 'px',
          background: 'repeating-conic-gradient(#f0f0f0 0% 25%, #fff 0% 50%) 50%/12px 12px',
          border: '1px solid #ddd'
        }
      }, h('img', {
        src: this.urlDaImagem(v.imagem),
        draggable: false,
        style: {
          position: 'absolute', left: 0, top: 0, maxWidth: 'none',
          width: (100 / v.w) + '%', height: 'auto',
          transform: 'translate(' + (-v.x * 100) + '%, ' + (-v.y * 100) + '%)'
        }
      }));
    },

    render: function () {
      var self = this;
      var lista = this.lista();
      var botao = {
        marginRight: '6px', marginTop: '6px', padding: '6px 12px', cursor: 'pointer',
        border: '1px solid #ccc', borderRadius: '4px', background: '#fff'
      };

      var itens = lista.map(function (item, i) {
        return h('div', {
          key: i,
          style: {
            display: 'flex', alignItems: 'flex-start', gap: '10px',
            padding: '10px 0', borderTop: i > 0 ? '1px solid #eee' : 'none'
          }
        }, [
          h('button', {
            key: 'thumb', onClick: self.abrirEditor(i),
            style: { padding: 0, border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer', background: 'none' },
            title: 'Recortar'
          }, self.janelaRecortada(item.imagem, LADO_MINIATURA, 'img')),
          h('div', { key: 'campos', style: { flex: 1, minWidth: 0 } }, [
            h('input', {
              key: 'legenda', type: 'text', placeholder: 'Legenda (opcional)',
              value: item.legenda,
              onChange: function (e) { self.mudarLegenda(i, e.target.value); },
              style: { width: '100%', boxSizing: 'border-box', padding: '5px 7px', border: '1px solid #ccc', borderRadius: '4px', marginBottom: '6px' }
            }),
            h('div', {}, [
              h('button', { key: 'up', style: botao, onClick: function (e) { e.preventDefault(); self.moverItem(i, -1); }, disabled: i === 0 }, '↑'),
              h('button', { key: 'down', style: botao, onClick: function (e) { e.preventDefault(); self.moverItem(i, 1); }, disabled: i === lista.length - 1 }, '↓'),
              h('button', { key: 'del', style: botao, onClick: function (e) { e.preventDefault(); self.removerItem(i); } }, 'Remover')
            ])
          ])
        ]);
      });

      var progresso = this.state.totalAEnviar > 0
        ? h('p', { key: 'progresso', style: { fontSize: '13px', color: '#666' } },
            'A enviar ' + this.state.aEnviar + ' de ' + this.state.totalAEnviar + '…')
        : null;

      var partes = [
        h('div', { key: 'itens' }, itens),
        progresso,
        h('button', { key: 'add', style: Object.assign({}, botao, { fontWeight: 600 }), onClick: this.escolherFicheiros },
          'Adicionar fotos')
      ];

      if (this.state.indiceEditar >= 0 && lista[this.state.indiceEditar]) {
        partes.push(this.renderEditor(lista[this.state.indiceEditar].imagem, botao));
      }

      return h('div', { className: this.props.classNameWrapper }, partes);
    },

    renderEditor: function (v, botao) {
      var self = this;
      var d = this.disposicao();
      var CANTO = 16;

      var retX = d.fotoX + v.x * d.fotoW;
      var retY = d.fotoY + v.y * d.fotoH;
      var retW = v.w * d.fotoW;
      var retH = v.h * d.fotoH;

      function canto(nome, esquerda, topo) {
        return h('div', {
          key: nome, onMouseDown: self.aoPremirCanto(nome),
          style: {
            position: 'absolute', left: esquerda - CANTO / 2, top: topo - CANTO / 2,
            width: CANTO, height: CANTO, background: '#fff', border: '2px solid #ad0000', borderRadius: '3px',
            cursor: (nome === 'tl' || nome === 'br') ? 'nwse-resize' : 'nesw-resize',
            boxShadow: '0 1px 3px rgba(0,0,0,.4)'
          }
        });
      }

      /* Pegas nos 4 lados: redimensionam so um eixo de cada vez. Barras finas
         com uma folga maior do que a largura visivel, para serem faceis de
         agarrar com o rato. */
      var ESPESSURA = 10, FOLGA = 6;
      function lado(nome, esquerda, topo, largura, altura, cursor) {
        return h('div', {
          key: nome, onMouseDown: self.aoPremirCanto(nome),
          style: { position: 'absolute', left: esquerda, top: topo, width: largura, height: altura, cursor: cursor }
        });
      }

      var palco = h('div', {
        style: { position: 'relative', width: d.palcoW + 'px', height: d.palcoH + 'px', userSelect: 'none', margin: '0 auto' }
      }, [
        /* So a LARGURA e imposta; a altura fica automatica. Assim a foto
           mantem sempre a proporcao natural, aconteca o que acontecer ao
           resto do estado — nunca pode esticar nem espalmar. */
        h('img', {
          key: 'foto', src: this.urlDaImagem(v.imagem), onLoad: this.aoCarregarImagem, draggable: false,
          style: { position: 'absolute', left: d.fotoX, top: d.fotoY, width: d.fotoW + 'px', height: 'auto', maxWidth: 'none', opacity: 0.3 }
        }),
        h('div', {
          key: 'janela',
          style: { position: 'absolute', left: retX, top: retY, width: retW, height: retH, overflow: 'hidden', boxShadow: '0 0 0 2px #ad0000' }
        }, h('img', {
          src: this.urlDaImagem(v.imagem), draggable: false,
          style: { position: 'absolute', left: d.fotoX - retX, top: d.fotoY - retY, width: d.fotoW + 'px', height: 'auto', maxWidth: 'none' }
        })),
        h('div', {
          key: 'corpo', onMouseDown: this.aoPremirCorpo,
          style: { position: 'absolute', left: retX, top: retY, width: retW, height: retH, cursor: this.state.aArrastar === 'mover' ? 'grabbing' : 'grab' }
        }),
        canto('tl', retX, retY), canto('tr', retX + retW, retY),
        canto('bl', retX, retY + retH), canto('br', retX + retW, retY + retH),
        lado('topo', retX + FOLGA, retY - ESPESSURA / 2, Math.max(0, retW - FOLGA * 2), ESPESSURA, 'ns-resize'),
        lado('base', retX + FOLGA, retY + retH - ESPESSURA / 2, Math.max(0, retW - FOLGA * 2), ESPESSURA, 'ns-resize'),
        lado('esquerda', retX - ESPESSURA / 2, retY + FOLGA, ESPESSURA, Math.max(0, retH - FOLGA * 2), 'ew-resize'),
        lado('direita', retX + retW - ESPESSURA / 2, retY + FOLGA, ESPESSURA, Math.max(0, retH - FOLGA * 2), 'ew-resize')
      ]);

      return h('div', {
        key: 'editor',
        onClick: function (e) { if (e.target === e.currentTarget) self.fecharEditor(e); },
        style: {
          position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,.75)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '20px', overflow: 'auto'
        }
      }, [
        h('p', { key: 'dica', style: { color: '#fff', fontSize: '14px', margin: '0 0 12px', textAlign: 'center' } },
          'Arrasta o retângulo para mover; puxa um lado para redimensionar só esse, ou um canto para os dois de uma vez.'),
        h('div', { key: 'palco' }, palco),
        h('div', { key: 'acoes', style: { marginTop: '14px', display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' } }, [
          h('button', { key: 'tudo', style: botao, onClick: this.verTudo }, 'Ver a foto toda'),
          h('button', {
            key: 'rodar', style: botao, onClick: this.rodar90, disabled: !!this.state.aRodar
          }, this.state.aRodar ? 'A rodar…' : 'Rodar 90°'),
          h('button', {
            key: 'fechar',
            style: Object.assign({}, botao, { fontWeight: 600, background: '#ad0000', color: '#fff', borderColor: '#ad0000' }),
            onClick: this.fecharEditor
          }, 'Concluir')
        ])
      ]);
    }
  });

  var Previsualizacao = createClass({
    render: function () {
      var lista = normalizarLista(this.props.value);
      return h('div', {}, lista.length + ' imagem(ns)');
    }
  });

  CMS.registerWidget('galeria', Controlo, Previsualizacao);
})();
