/* Widget "recorte" — escolher a imagem e escolher que parte dela aparece.

   O recorte abre numa janela grande, por cima de tudo, para se poder ajustar
   com precisao: ve-se a foto inteira e arrasta-se um retangulo por cima dela
   (pelo meio para mover, pelos cantos para redimensionar), como recortar uma
   foto no telemovel.

   O enquadramento e guardado como fracoes da imagem original (x, y, w, h):
   x/y sao o canto superior esquerdo do retangulo, w/h o seu tamanho. O
   ficheiro carregado nunca e alterado, so estes numeros, por isso o recorte
   pode ser refeito as vezes que forem precisas sem perder qualidade.

   O retangulo pode sair dos limites da foto (x/y negativos, w/h acima de 1):
   e assim que uma foto vertical cabe inteira numa capa quadrada, com espaco
   a volta em vez de ser cortada.

   Opcoes do campo em config.yml:
     forcarQuadrado: true  -> o retangulo e sempre quadrado (usado na capa).
                              Sem esta opcao o recorte e livre: a altura e a
                              que se quiser, e no site as imagens saem todas
                              com a mesma largura, centradas.
*/
(function () {
  var h = window.h;
  var createClass = window.createClass;

  if (!h || !createClass) {
    console.error('recorte.js: o Decap CMS nao expos "h"/"createClass".');
    return;
  }

  var MINIMO = 0.04;
  var MAXIMO = 6;
  var MARGEM = 90;          /* folga a volta da foto, para o retangulo poder sair dela */
  var LADO_MINIATURA = 150; /* pre-visualizacao pequena, fora da janela de recorte */

  /* Roda a foto 90 graus (sentido horario) desenhando-a rodada num canvas e
     gravando o resultado como um ficheiro novo — mais simples e robusto do
     que tentar combinar rotacao com o recorte so em CSS. Devolve o caminho
     da nova imagem. */
  function rodarFicheiro(urlAtual, nomeAtual, onPersistMedia, field) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        var canvas = document.createElement('canvas');
        canvas.width = img.naturalHeight;
        canvas.height = img.naturalWidth;
        var ctx = canvas.getContext('2d');
        ctx.translate(canvas.width, 0);
        ctx.rotate(Math.PI / 2);
        ctx.drawImage(img, 0, 0);
        canvas.toBlob(function (blob) {
          if (!blob) { reject(new Error('canvas.toBlob devolveu vazio')); return; }
          var base = (nomeAtual || 'foto').replace(/\.[a-z0-9]+$/i, '');
          var ficheiro = new File([blob], base + '-r' + Date.now() + '.png', { type: 'image/png' });
          onPersistMedia(ficheiro, { field: field }).then(function (resultado) {
            var caminho = resultado && resultado.payload && resultado.payload.path;
            if (!caminho) { reject(new Error('onPersistMedia nao devolveu um caminho')); return; }
            resolve(caminho);
          }, reject);
        }, 'image/png');
      };
      img.onerror = function () { reject(new Error('falha ao carregar a imagem para rodar')); };
      img.src = urlAtual;
    });
  }

  function limitar(v, min, max) { return Math.min(max, Math.max(min, v)); }

  function num(v, omissao) {
    var n = parseFloat(v);
    return isFinite(n) ? n : omissao;
  }

  function normalizar(valor) {
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

  /* Tenta clicar sozinho no botao "Enviar novo" da biblioteca de media assim
     que ela abrir, para ir direto ao explorador de ficheiros do sistema.
     Se o botao mudar de texto numa versao futura do Decap, isto simplesmente
     nao encontra nada e usa-se a biblioteca normalmente. */
  function saltarParaExplorador() {
    var tentativas = 0;
    var intervalo = setInterval(function () {
      tentativas++;
      var botoes = document.querySelectorAll('[role="dialog"] button');
      for (var i = 0; i < botoes.length; i++) {
        if (/enviar novo|upload new/i.test(botoes[i].textContent || '')) {
          clearInterval(intervalo);
          botoes[i].click();
          return;
        }
      }
      if (tentativas > 20) clearInterval(intervalo);
    }, 50);
  }

  var Controlo = createClass({
    getInitialState: function () {
      return { larguraNatural: 0, alturaNatural: 0, aArrastar: null, aEditar: false, dispoW: 460, dispoH: 460 };
    },

    componentWillMount: function () {
      this.controlID = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Math.random());
    },

    componentWillUnmount: function () {
      this.pararArrasto();
      window.removeEventListener('keydown', this.aoTeclar);
      this.props.onRemoveMediaControl(this.controlID);
    },

    /* SEM ISTO A IMAGEM ESCOLHIDA NUNCA CHEGA AQUI.

       O componente Widget do Decap (que embrulha todos os widgets) so deixa
       passar props novas para baixo quando muda 'value', 'classNameWrapper'
       ou 'hasActiveStyle'. A imagem escolhida na biblioteca chega em
       'mediaPaths', que NAO esta nessa lista — por isso o Widget bloqueava a
       atualizacao e o componentDidUpdate aqui em baixo nunca via o caminho
       novo. O Decap resolve isto indo buscar o shouldComponentUpdate do
       proprio widget (processInnerControlRef em Widget.js) e usando-o em vez
       do dele; e o que o widget oficial de imagem faz.

       Cuidado com os dois chamadores, que tem assinaturas diferentes:
       o React chama (nextProps, nextState); o Widget do Decap chama so
       (nextProps). Dai o teste ao nextState — para nunca bloquear os
       re-renders do proprio controlo (ex. enquanto se arrasta o recorte). */
    shouldComponentUpdate: function (nextProps, nextState) {
      if (nextState !== undefined) return true;

      if (this.props.value !== nextProps.value) return true;
      if (this.props.classNameWrapper !== nextProps.classNameWrapper) return true;
      if (this.props.hasActiveStyle !== nextProps.hasActiveStyle) return true;
      if (this.props.getAsset !== nextProps.getAsset) return true;

      var mediaPath = nextProps.mediaPaths && nextProps.mediaPaths.get(this.controlID);
      return !!mediaPath;
    },

    /* Padrao oficial do Decap: depois de escolher/enviar uma imagem na
       biblioteca, o caminho fica disponivel em mediaPaths, indexado pelo
       controlID que passamos a onOpenMediaLibrary — nunca por forID. */
    componentDidUpdate: function () {
      var mediaPath = this.props.mediaPaths.get(this.controlID);
      var v = this.valor();
      if (mediaPath && mediaPath !== v.imagem) {
        this.setState({ larguraNatural: 0, alturaNatural: 0, ajustado: false });
        this.gravar({ imagem: mediaPath, x: 0, y: 0, w: 1, h: 1 });
      } else if (mediaPath && mediaPath === v.imagem) {
        this.props.onRemoveInsertedMedia(this.controlID);
      }
    },

    valor: function () { return normalizar(this.props.value); },

    /* Quadrado so na capa. Nas imagens do projeto o recorte e sempre livre:
       a altura e a que o recorte tiver, e o site trata de as por todas com a
       mesma largura, centradas. */
    ehQuadrado: function () {
      var campo = this.props.field;
      return !!(campo && campo.get && campo.get('forcarQuadrado'));
    },

    /* Disposicao dentro da janela de recorte: onde a foto e desenhada
       (tamanho e posicao fixos) e quanto espaco ha a volta.

       A escala sai do espaco disponivel nos DOIS eixos, nao do lado maior da
       foto: se fosse pelo lado maior, uma foto larga num ecra largo ficava
       desnecessariamente pequena por causa da altura. */
    disposicao: function () {
      var W = this.state.larguraNatural || 1, H = this.state.alturaNatural || 1;
      var escala = Math.min(this.state.dispoW / W, this.state.dispoH / H);
      var fotoW = W * escala;
      var fotoH = H * escala;
      return {
        fotoW: fotoW, fotoH: fotoH,
        fotoX: MARGEM, fotoY: MARGEM,
        palcoW: fotoW + MARGEM * 2, palcoH: fotoH + MARGEM * 2
      };
    },

    /* Retangulo que mostra a FOTO TODA (pode ser maior do que a foto). */
    ajusteTotal: function () {
      var W = this.state.larguraNatural, H = this.state.alturaNatural;
      if (!this.ehQuadrado() || !W || !H) return { w: 1, h: 1 };
      var lado = Math.max(W, H);
      return { w: lado / W, h: lado / H };
    },

    /* Retangulo que PREENCHE por completo, cortando o que sobra. */
    preenchimento: function () {
      var W = this.state.larguraNatural, H = this.state.alturaNatural;
      if (!this.ehQuadrado() || !W || !H) return { w: 1, h: 1 };
      var lado = Math.min(W, H);
      return { w: lado / W, h: lado / H };
    },

    gravar: function (novo) {
      var v = normalizar(novo);
      var W = this.state.larguraNatural, H = this.state.alturaNatural;
      /* Se as medidas da foto ainda nao sao conhecidas (imagem por carregar),
         mantem-se a proporcao ja guardada em vez de a substituir por 1 — que
         era uma forma silenciosa de estragar um recorte correto. */
      v.proporcao = (W && H)
        ? (v.w * W) / (v.h * H)
        : (normalizar(this.props.value).proporcao || 1);
      /* Sem limite apertado (o retangulo pode sair da foto de propósito),
         so um travao contra arrastos absurdos para fora da janela. */
      v.x = limitar(v.x, -MAXIMO, MAXIMO);
      v.y = limitar(v.y, -MAXIMO, MAXIMO);
      this.props.onChange(v);
    },

    aplicar: function (medida) {
      var v = this.valor();
      this.gravar({
        imagem: v.imagem, w: medida.w, h: medida.h,
        x: (1 - medida.w) / 2, y: (1 - medida.h) / 2
      });
    },

    verTudo: function (evento) { evento.preventDefault(); this.aplicar(this.ajusteTotal()); },
    preencher: function (evento) { evento.preventDefault(); this.aplicar(this.preenchimento()); },

    rodar90: function (evento) {
      evento.preventDefault();
      var self = this;
      var v = this.valor();
      var nome = (v.imagem || 'foto').split('/').pop();
      this.setState({ aRodar: true });
      rodarFicheiro(this.urlDaImagem(v.imagem), nome, this.props.onPersistMedia, this.props.field)
        .then(function (novoCaminho) {
          self.setState({ larguraNatural: 0, alturaNatural: 0, ajustado: false, aRodar: false });
          self.gravar({ imagem: novoCaminho, x: 0, y: 0, w: 1, h: 1 });
        })
        .catch(function (erro) {
          console.error('recorte.js: falha ao rodar a imagem.', erro);
          self.setState({ aRodar: false });
        });
    },

    aoCarregarImagem: function (evento) {
      var img = evento.target;
      var self = this;
      this.setState(
        { larguraNatural: img.naturalWidth, alturaNatural: img.naturalHeight },
        function () {
          var v = self.valor();
          /* Enquadramento ainda por definir: comeca a mostrar a foto toda,
             para nada ficar cortado sem ser por escolha. */
          if (!self.state.ajustado && v.w === 1 && v.h === 1 && !v.x && !v.y) {
            self.setState({ ajustado: true }, function () { self.aplicar(self.ajusteTotal()); });
          } else {
            self.gravar(v);
          }
        }
      );
    },

    /* --- Janela de recorte --------------------------------------------- */
    abrirEditor: function (evento) {
      evento.preventDefault();
      /* A foto ocupa o maximo que couber na janela do browser, deixando
         espaco para a margem de folga e para a barra de botoes. */
      var self = this;
      var dispo = {
        dispoW: Math.max(240, window.innerWidth - MARGEM * 2 - 60),
        dispoH: Math.max(240, window.innerHeight - MARGEM * 2 - 150)
      };

      /* Medir a foto ANTES de abrir. Sem as medidas reais, disposicao() cai
         num quadrado por omissao e a foto abria deformada ate o load chegar. */
      var medidor = new Image();
      medidor.onload = function () {
        self.setState(Object.assign({
          aEditar: true,
          larguraNatural: medidor.naturalWidth,
          alturaNatural: medidor.naturalHeight
        }, dispo));
      };
      medidor.onerror = function () {
        self.setState(Object.assign({ aEditar: true }, dispo));
      };
      medidor.src = this.urlDaImagem(this.valor().imagem);

      window.addEventListener('keydown', this.aoTeclar);
    },

    fecharEditor: function (evento) {
      if (evento) evento.preventDefault();
      this.pararArrasto();
      window.removeEventListener('keydown', this.aoTeclar);
      this.setState({ aEditar: false });
    },

    aoTeclar: function (evento) {
      if (evento.key === 'Escape') this.fecharEditor();
    },

    /* --- Arrastar o retangulo (mover ou redimensionar por um canto) ----- */
    aoPremirCorpo: function (evento) {
      evento.preventDefault();
      this.iniciarArrasto(evento, 'mover');
    },

    aoPremirCanto: function (canto) {
      var self = this;
      return function (evento) {
        evento.preventDefault();
        evento.stopPropagation();
        self.iniciarArrasto(evento, canto);
      };
    },

    iniciarArrasto: function (evento, modo) {
      this.arrasto = {
        modo: modo,
        xInicial: evento.clientX, yInicial: evento.clientY,
        v: this.valor()
      };
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
        this.gravar({ imagem: v.imagem, w: v.w, h: v.h, x: v.x + dxFracao, y: v.y + dyFracao });
        return;
      }

      /* Lados: so mexe num eixo de cada vez, mantendo o lado oposto fixo. */
      if (a.modo === 'topo') {
        var ancoraTopo = v.y + v.h;
        var novoYt = limitar(v.y + dyFracao, ancoraTopo - MAXIMO, ancoraTopo - MINIMO);
        this.gravar({ imagem: v.imagem, w: v.w, h: ancoraTopo - novoYt, x: v.x, y: novoYt });
        return;
      }
      if (a.modo === 'base') {
        this.gravar({ imagem: v.imagem, w: v.w, h: limitar(v.h + dyFracao, MINIMO, MAXIMO), x: v.x, y: v.y });
        return;
      }
      if (a.modo === 'esquerda') {
        var ancoraEsq = v.x + v.w;
        var novoXe = limitar(v.x + dxFracao, ancoraEsq - MAXIMO, ancoraEsq - MINIMO);
        this.gravar({ imagem: v.imagem, w: ancoraEsq - novoXe, h: v.h, x: novoXe, y: v.y });
        return;
      }
      if (a.modo === 'direita') {
        this.gravar({ imagem: v.imagem, w: limitar(v.w + dxFracao, MINIMO, MAXIMO), h: v.h, x: v.x, y: v.y });
        return;
      }

      /* Cantos: ancora = canto oposto ao que esta a ser arrastado, que fica
         fixo no sitio. dx/dy sao a distancia (com sinal) desde a ancora ate
         a posicao atual do rato, em fracao da foto. */
      var ancoraX, ancoraY, movX, movY;
      if (a.modo === 'br') { ancoraX = v.x; ancoraY = v.y; movX = v.x + v.w + dxFracao; movY = v.y + v.h + dyFracao; }
      if (a.modo === 'bl') { ancoraX = v.x + v.w; ancoraY = v.y; movX = v.x + dxFracao; movY = v.y + v.h + dyFracao; }
      if (a.modo === 'tr') { ancoraX = v.x; ancoraY = v.y + v.h; movX = v.x + v.w + dxFracao; movY = v.y + dyFracao; }
      if (a.modo === 'tl') { ancoraX = v.x + v.w; ancoraY = v.y + v.h; movX = v.x + dxFracao; movY = v.y + dyFracao; }

      var dx = movX - ancoraX;
      var dy = movY - ancoraY;

      /* "Quadrado" tem de comparar em pixeis REAIS da foto, nao em fracao
         de largura/altura: w e h sao fracoes de eixos com escalas
         diferentes sempre que a foto nao e quadrada (ex. w=0.5 numa foto
         1855x848 sao 927px, mas h=0.5 sao so 424px — nao dava um quadrado
         real so por w===h). Converte para pixeis, iguala pelo maior, depois
         volta a fracao em cada eixo. */
      if (this.ehQuadrado()) {
        var W = this.state.larguraNatural, H = this.state.alturaNatural;
        if (W && H) {
          var dxPx = dx * W, dyPx = dy * H;
          var maiorPx = Math.max(Math.abs(dxPx), Math.abs(dyPx));
          dx = (dx < 0 ? -1 : 1) * (maiorPx / W);
          dy = (dy < 0 ? -1 : 1) * (maiorPx / H);
        } else {
          var maior = Math.max(Math.abs(dx), Math.abs(dy));
          dx = (dx < 0 ? -1 : 1) * maior;
          dy = (dy < 0 ? -1 : 1) * maior;
        }
      }

      var novoW = limitar(Math.abs(dx), MINIMO, MAXIMO);
      var novoH = limitar(Math.abs(dy), MINIMO, MAXIMO);
      var novoX = dx < 0 ? ancoraX - novoW : ancoraX;
      var novoY = dy < 0 ? ancoraY - novoH : ancoraY;

      this.gravar({ imagem: v.imagem, w: novoW, h: novoH, x: novoX, y: novoY });
    },

    pararArrasto: function () {
      this.arrasto = null;
      window.removeEventListener('mousemove', this.aoMover);
      window.removeEventListener('mouseup', this.pararArrasto);
      if (this.state.aArrastar) this.setState({ aArrastar: null });
    },

    abrirBiblioteca: function (evento) {
      evento.preventDefault();
      var haviaImagem = !!this.valor().imagem;
      this.props.onOpenMediaLibrary({
        controlID: this.controlID,
        forImage: true,
        privateUpload: false,
        value: this.valor().imagem,
        field: this.props.field
      });
      /* So salta direto para o explorador quando ainda nao ha imagem
         nenhuma (primeira escolha). Ao trocar uma imagem ja existente o
         mais provavel e reaproveitar uma foto ja carregada. */
      if (!haviaImagem) saltarParaExplorador();
    },

    limpar: function (evento) {
      evento.preventDefault();
      this.setState({ larguraNatural: 0, alturaNatural: 0, ajustado: false });
      this.props.onChange({ imagem: '', x: 0, y: 0, w: 1, h: 1, proporcao: 1 });
    },

    urlDaImagem: function (caminho) {
      if (!caminho) return '';
      if (/^(https?:)?\/\//.test(caminho) || caminho.indexOf('data:') === 0) return caminho;
      var asset = this.props.getAsset ? this.props.getAsset(caminho, this.props.field) : null;
      return asset ? String(asset) : caminho;
    },

    /* Caixa que mostra so o pedaco escolhido, exatamente como sai no site. */
    janelaRecortada: function (v, larguraCaixa, extras) {
      var alturaCaixa = larguraCaixa / (v.proporcao || 1);
      return h('div', Object.assign({
        style: {
          position: 'relative', overflow: 'hidden',
          width: larguraCaixa + 'px', height: alturaCaixa + 'px',
          background: 'repeating-conic-gradient(#f0f0f0 0% 25%, #fff 0% 50%) 50%/14px 14px',
          border: '1px solid #ddd'
        }
      }, extras || {}), h('img', {
        src: this.urlDaImagem(v.imagem),
        onLoad: this.aoCarregarImagem,
        draggable: false,
        style: {
          position: 'absolute', maxWidth: 'none',
          /* Largura acompanha a caixa, altura automatica e deslocamento por
             transform (percentagens da propria imagem): assim a foto nunca
             pode aparecer esticada nem espalmada. */
          left: 0, top: 0,
          width: (100 / v.w) + '%', height: 'auto',
          transform: 'translate(' + (-v.x * 100) + '%, ' + (-v.y * 100) + '%)'
        }
      }));
    },

    render: function () {
      var self = this;
      var v = this.valor();
      var botao = {
        marginRight: '6px', marginTop: '6px', padding: '6px 12px', cursor: 'pointer',
        border: '1px solid #ccc', borderRadius: '4px', background: '#fff'
      };

      if (!v.imagem) {
        return h('div', { className: this.props.classNameWrapper },
          h('button', { style: botao, onClick: this.abrirBiblioteca }, 'Escolher imagem'));
      }

      var partes = [
        h('div', { key: 'mini' }, this.janelaRecortada(v, LADO_MINIATURA)),
        h('div', { key: 'botoes' }, [
          h('button', { key: 'recortar', style: Object.assign({}, botao, { fontWeight: 600 }), onClick: this.abrirEditor }, 'Recortar'),
          h('button', { key: 'trocar', style: botao, onClick: this.abrirBiblioteca }, 'Trocar imagem'),
          h('button', { key: 'limpar', style: botao, onClick: this.limpar }, 'Remover')
        ])
      ];

      if (this.state.aEditar) partes.push(this.renderEditor(v, botao));

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
          key: nome,
          onMouseDown: self.aoPremirCanto(nome),
          style: {
            position: 'absolute',
            left: esquerda - CANTO / 2, top: topo - CANTO / 2,
            width: CANTO, height: CANTO,
            background: '#fff', border: '2px solid #ad0000', borderRadius: '3px',
            cursor: (nome === 'tl' || nome === 'br') ? 'nwse-resize' : 'nesw-resize',
            boxShadow: '0 1px 3px rgba(0,0,0,.4)'
          }
        });
      }

      /* Pegas nos 4 lados: redimensionam so um eixo de cada vez, sem mexer
         no outro — so fazem sentido em modo livre (quadrado exigiria mexer
         nos dois eixos ao mesmo tempo). Barras finas ao longo de cada lado,
         com uma folga maior do que a largura visivel para serem faceis de
         agarrar com o rato. */
      var ESPESSURA = 10, FOLGA = 6;
      function lado(nome, esquerda, topo, largura, altura, cursor) {
        return h('div', {
          key: nome,
          onMouseDown: self.aoPremirCanto(nome),
          style: {
            position: 'absolute', left: esquerda, top: topo, width: largura, height: altura,
            cursor: cursor
          }
        });
      }

      var palco = h('div', {
        style: {
          position: 'relative',
          width: d.palcoW + 'px', height: d.palcoH + 'px',
          userSelect: 'none', margin: '0 auto'
        }
      }, [
        /* Foto inteira, esbatida: e a referencia do que existe. */
        h('img', {
          key: 'foto',
          src: this.urlDaImagem(v.imagem),
          onLoad: this.aoCarregarImagem,
          draggable: false,
          style: {
            position: 'absolute', left: d.fotoX, top: d.fotoY,
            /* So a LARGURA e imposta; a altura fica automatica. Assim a foto
               mantem sempre a proporcao natural — nunca pode esticar. */
            width: d.fotoW + 'px', height: 'auto', maxWidth: 'none', opacity: 0.3
          }
        }),
        /* A mesma foto a plena luz, mas so dentro do retangulo. */
        h('div', {
          key: 'janela',
          style: {
            position: 'absolute', left: retX, top: retY, width: retW, height: retH,
            overflow: 'hidden', boxShadow: '0 0 0 2px #ad0000'
          }
        }, h('img', {
          src: this.urlDaImagem(v.imagem),
          draggable: false,
          style: {
            position: 'absolute', left: d.fotoX - retX, top: d.fotoY - retY,
            width: d.fotoW + 'px', height: 'auto', maxWidth: 'none'
          }
        })),
        h('div', {
          key: 'corpo',
          onMouseDown: this.aoPremirCorpo,
          style: {
            position: 'absolute', left: retX, top: retY, width: retW, height: retH,
            cursor: this.state.aArrastar === 'mover' ? 'grabbing' : 'grab'
          }
        }),
        canto('tl', retX, retY),
        canto('tr', retX + retW, retY),
        canto('bl', retX, retY + retH),
        canto('br', retX + retW, retY + retH),
        this.ehQuadrado() ? null : lado('topo', retX + FOLGA, retY - ESPESSURA / 2, Math.max(0, retW - FOLGA * 2), ESPESSURA, 'ns-resize'),
        this.ehQuadrado() ? null : lado('base', retX + FOLGA, retY + retH - ESPESSURA / 2, Math.max(0, retW - FOLGA * 2), ESPESSURA, 'ns-resize'),
        this.ehQuadrado() ? null : lado('esquerda', retX - ESPESSURA / 2, retY + FOLGA, ESPESSURA, Math.max(0, retH - FOLGA * 2), 'ew-resize'),
        this.ehQuadrado() ? null : lado('direita', retX + retW - ESPESSURA / 2, retY + FOLGA, ESPESSURA, Math.max(0, retH - FOLGA * 2), 'ew-resize')
      ]);

      return h('div', {
        key: 'editor',
        onClick: function (e) { if (e.target === e.currentTarget) self.fecharEditor(e); },
        style: {
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,.75)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '20px', overflow: 'auto'
        }
      }, [
        h('p', {
          key: 'dica',
          style: { color: '#fff', fontSize: '14px', margin: '0 0 12px', textAlign: 'center' }
        }, this.ehQuadrado()
            ? 'Arrasta o retângulo para mover; puxa os cantos para redimensionar. A capa é sempre quadrada.'
            : 'Arrasta o retângulo para mover; puxa os cantos para redimensionar os dois lados, ou um lado para redimensionar só esse.'),
        h('div', { key: 'palco' }, palco),
        h('div', {
          key: 'acoes',
          style: { marginTop: '14px', display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }
        }, [
          h('button', { key: 'tudo', style: botao, onClick: this.verTudo }, 'Ver a foto toda'),
          this.ehQuadrado()
            ? h('button', { key: 'preencher', style: botao, onClick: this.preencher }, 'Preencher a moldura')
            : null,
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
      var v = normalizar(this.props.value);
      if (!v.imagem) return null;
      var asset = this.props.getAsset ? this.props.getAsset(v.imagem) : v.imagem;
      return h('div', {
        style: {
          position: 'relative', overflow: 'hidden',
          width: '240px', aspectRatio: String(v.proporcao || 1)
        }
      }, h('img', {
        src: String(asset),
        style: {
          position: 'absolute', maxWidth: 'none',
          /* Largura acompanha a caixa, altura automatica e deslocamento por
             transform (percentagens da propria imagem): assim a foto nunca
             pode aparecer esticada nem espalmada. */
          left: 0, top: 0,
          width: (100 / v.w) + '%', height: 'auto',
          transform: 'translate(' + (-v.x * 100) + '%, ' + (-v.y * 100) + '%)'
        }
      }));
    }
  });

  CMS.registerWidget('recorte', Controlo, Previsualizacao);
})();
