/* Widget "recorte" — escolher a imagem e decidir exatamente o que aparece,
   como um recorte de fotos no telemovel: ve-se a foto toda e arrasta-se um
   retangulo por cima dela para escolher a parte que fica visivel.

   O enquadramento e guardado como fracoes da imagem original (x, y, w, h):
   x/y sao a posicao do canto superior esquerdo do retangulo, w/h sao o seu
   tamanho — tudo em fracao da largura/altura da foto. O ficheiro carregado
   nunca e alterado, so estes numeros, por isso o recorte pode ser refeito as
   vezes que forem precisas sem perder qualidade.

   O retangulo pode sair dos limites da foto (x/y negativos, w/h acima de 1):
   e assim que uma foto vertical cabe toda numa moldura quadrada, com espaco
   vazio a volta em vez de ser cortada.

   Opcoes do campo em config.yml:
     forcarQuadrado: true  -> o retangulo e sempre quadrado (usado na capa)

   Como captura a imagem escolhida: segue exatamente o mesmo padrao do widget
   "image" oficial do Decap — gera um controlID proprio (nao usar forID, que e
   outra coisa), passa-o a onOpenMediaLibrary, e le o caminho escolhido em
   props.mediaPaths.get(controlID) quando o componente atualiza. Ao escolher
   pela primeira vez (campo ainda vazio), tenta ainda saltar logo para o
   explorador de ficheiros do sistema, clicando sozinho no botao "Enviar
   novo" — poupa navegar a galeria so para enviar uma foto nova. Ao trocar
   uma imagem ja existente isto nao acontece, porque nesse caso o mais
   provavel e escolher outra foto ja carregada. */
(function () {
  var h = window.h;
  var createClass = window.createClass;

  if (!h || !createClass) {
    console.error('recorte.js: o Decap CMS nao expos "h"/"createClass".');
    return;
  }

  var MINIMO = 0.04;
  var MAXIMO = 6;

  /* Tamanho do "palco" onde a foto e o retangulo sao desenhados: a foto
     ocupa no maximo DISPLAY_MAX px no lado maior, com MARGEM px de folga a
     volta para o retangulo poder ser arrastado para fora da foto. */
  var DISPLAY_MAX = 260;
  var MARGEM = 70;

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
     nao encontra nada e o utilizador usa a biblioteca normalmente — nunca
     parte a funcionalidade, so deixa de poupar o clique extra. */
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
      return { larguraNatural: 0, alturaNatural: 0, aArrastar: null };
    },

    componentWillMount: function () {
      this.controlID = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Math.random());
    },

    componentWillUnmount: function () {
      this.pararArrasto();
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

    forcaQuadrado: function () {
      var campo = this.props.field;
      return !!(campo && campo.get && campo.get('forcarQuadrado'));
    },

    /* So fica "quadrado" se o campo obrigar (capa) ou se a caixa "Manter
       quadrado" estiver mesmo marcada — nunca adivinhado a partir da
       proporcao guardada, porque essa por omissao e 1 (parece quadrado) e
       isso forcava o modo quadrado em campos livres sem ser essa a
       intencao. */
    ehQuadrado: function () {
      if (this.forcaQuadrado()) return true;
      return !!this.state.quadradoLivre;
    },

    /* Disposicao do "palco": onde a foto fica desenhada (tamanho e posicao
       fixos) dentro da area onde o retangulo pode ser arrastado. */
    disposicao: function () {
      var W = this.state.larguraNatural || 1, H = this.state.alturaNatural || 1;
      var maior = Math.max(W, H);
      var fotoW = DISPLAY_MAX * (W / maior);
      var fotoH = DISPLAY_MAX * (H / maior);
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
      v.proporcao = (W && H) ? (v.w * W) / (v.h * H) : 1;
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

    alternarQuadrado: function (evento) {
      var self = this;
      var ligar = evento.target.checked;
      this.setState({ quadradoLivre: ligar }, function () {
        if (!ligar) return;
        var v = self.valor();
        var lado = Math.max(v.w, v.h);
        self.gravar({ imagem: v.imagem, w: lado, h: lado, x: v.x, y: v.y });
      });
    },

    /* --- Arrastar o retangulo (mover ou redimensionar por um canto) -------
       'mover': desloca x/y sem mudar w/h.
       'tl'/'tr'/'bl'/'br': redimensiona a partir de um canto, mantendo o
       canto oposto fixo — e a mesma logica para os quatro, so muda qual e o
       canto fixo (ancora) e qual e o canto que se move com o rato. */
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
      if (!this.palco) return;
      var v = this.valor();
      var r = this.palco.getBoundingClientRect();
      this.arrasto = {
        modo: modo,
        xInicial: evento.clientX, yInicial: evento.clientY,
        v: v, r: r
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
      var quadrado = this.ehQuadrado();
      var v = a.v;

      if (a.modo === 'mover') {
        this.gravar({ imagem: v.imagem, w: v.w, h: v.h, x: v.x + dxFracao, y: v.y + dyFracao });
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
      if (quadrado) {
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
         nenhuma (primeira escolha). Ao "trocar imagem" ja existente, o mais
         provavel e reaproveitar uma foto ja carregada — saltar sozinho para
         "Enviar novo" competia com esse clique e tornava a escolha
         inconsistente. */
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

    render: function () {
      var self = this;
      var v = this.valor();
      var botao = {
        marginRight: '6px', marginTop: '6px', padding: '6px 10px', cursor: 'pointer',
        border: '1px solid #ccc', borderRadius: '4px', background: '#fff'
      };

      if (!v.imagem) {
        return h('div', { className: this.props.classNameWrapper },
          h('button', { style: botao, onClick: this.abrirBiblioteca }, 'Escolher imagem'));
      }

      var d = this.disposicao();
      var CANTO = 12;

      var handleCanto = function (canto, esquerda, topo) {
        return h('div', {
          key: canto,
          onMouseDown: self.aoPremirCanto(canto),
          style: {
            position: 'absolute',
            left: esquerda - CANTO / 2, top: topo - CANTO / 2,
            width: CANTO, height: CANTO,
            background: '#fff', border: '2px solid #333', borderRadius: '2px',
            cursor: (canto === 'tl' || canto === 'br') ? 'nwse-resize' : 'nesw-resize',
            boxShadow: '0 0 0 1px rgba(0,0,0,.3)'
          }
        });
      };

      var retX = d.fotoX + v.x * d.fotoW;
      var retY = d.fotoY + v.y * d.fotoH;
      var retW = v.w * d.fotoW;
      var retH = v.h * d.fotoH;

      var palco = h('div', {
        ref: function (el) { self.palco = el; },
        style: {
          position: 'relative',
          width: d.palcoW + 'px', height: d.palcoH + 'px',
          userSelect: 'none'
        }
      }, [
        /* A foto fica sempre no mesmo sitio, do mesmo tamanho: e o retangulo
           que se move e redimensiona por cima dela. */
        h('img', {
          key: 'foto',
          src: this.urlDaImagem(v.imagem),
          onLoad: this.aoCarregarImagem,
          draggable: false,
          style: {
            position: 'absolute', left: d.fotoX, top: d.fotoY,
            width: d.fotoW + 'px', height: d.fotoH + 'px',
            opacity: 0.35
          }
        }),
        /* Janela recortada da mesma foto, so visivel dentro do retangulo —
           da a ver exatamente o que vai aparecer no site. */
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
            width: d.fotoW + 'px', height: d.fotoH + 'px'
          }
        })),
        /* Area do retangulo: arrasta para mover; os quatro cantos redimensionam. */
        h('div', {
          key: 'corpo',
          onMouseDown: this.aoPremirCorpo,
          style: {
            position: 'absolute', left: retX, top: retY, width: retW, height: retH,
            cursor: this.state.aArrastar === 'mover' ? 'grabbing' : 'grab'
          }
        }),
        handleCanto('tl', retX, retY),
        handleCanto('tr', retX + retW, retY),
        handleCanto('bl', retX, retY + retH),
        handleCanto('br', retX + retW, retY + retH)
      ]);

      var controlos = [
        h('div', { key: 'b', style: { marginBottom: '4px' } }, [
          h('button', { key: 'tudo', style: botao, onClick: this.verTudo }, 'Ver a foto toda'),
          h('button', { key: 'preencher', style: botao, onClick: this.preencher }, 'Preencher a moldura')
        ])
      ];

      if (!this.forcaQuadrado()) {
        controlos.push(h('label', { key: 'l2', style: { display: 'block', margin: '8px 0', fontSize: '13px' } }, [
          h('input', {
            key: 'chk', type: 'checkbox', checked: this.ehQuadrado(),
            onChange: this.alternarQuadrado, style: { marginRight: '6px' }
          }),
          'Manter quadrado'
        ]));
      }

      return h('div', { className: this.props.classNameWrapper }, [
        h('p', { key: 'dica', style: { fontSize: '12px', color: '#666', margin: '0 0 6px' } },
          'Arrasta o retângulo para mover; puxa os cantos para redimensionar.'),
        h('div', { key: 'm' }, palco),
        h('div', { key: 'c' }, controlos),
        h('div', { key: 'f', style: { marginTop: '6px' } }, [
          h('button', { key: 'trocar', style: botao, onClick: this.abrirBiblioteca }, 'Trocar imagem'),
          h('button', { key: 'limpar', style: botao, onClick: this.limpar }, 'Remover')
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
          width: (100 / v.w) + '%', height: (100 / v.h) + '%',
          left: (-v.x * 100 / v.w) + '%', top: (-v.y * 100 / v.h) + '%'
        }
      }));
    }
  });

  CMS.registerWidget('recorte', Controlo, Previsualizacao);
})();
