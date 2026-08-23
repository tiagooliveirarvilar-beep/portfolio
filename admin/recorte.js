/* Widget "recorte" — escolher a imagem e decidir exatamente o que aparece.

   O enquadramento e guardado como fracoes da imagem original (x, y, w, h) e o
   ficheiro carregado nunca e alterado: pode ser refeito as vezes que forem
   precisas sem perder qualidade.

   w/h podem passar de 1: nesse caso a moldura e MAIOR do que a foto e ve-se a
   foto inteira, com espaco a volta. E assim que uma foto vertical cabe toda
   numa capa quadrada sem ficar cortada.

   Opcoes do campo em config.yml:
     forcarQuadrado: true  -> a moldura e sempre quadrada (usado na capa)

   Como captura a imagem escolhida: segue exatamente o mesmo padrao do widget
   "image" oficial do Decap — gera um controlID proprio (nao usar forID, que e
   outra coisa), passa-o a onOpenMediaLibrary, e le o caminho escolhido em
   props.mediaPaths.get(controlID) quando o componente atualiza. Ao abrir a
   biblioteca, tenta ainda saltar logo para o explorador de ficheiros do
   sistema, clicando sozinho no botao "Enviar novo" assim que a janela abre —
   evita ter de navegar a galeria para carregar uma imagem nova. */
(function () {
  var h = window.h;
  var createClass = window.createClass;

  if (!h || !createClass) {
    console.error('recorte.js: o Decap CMS nao expos "h"/"createClass".');
    return;
  }

  var MINIMO = 0.05;
  var MAXIMO = 5;

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
      return { larguraNatural: 0, alturaNatural: 0, aArrastar: false };
    },

    componentWillMount: function () {
      this.controlID = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Math.random());
    },

    componentWillUnmount: function () {
      this.pararArrasto();
      this.props.onRemoveMediaControl(this.controlID);
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

    ehQuadrado: function () {
      if (this.forcaQuadrado()) return true;
      if (typeof this.state.quadradoLivre === 'boolean') return this.state.quadradoLivre;
      return Math.abs((this.valor().proporcao || 1) - 1) < 0.02;
    },

    /* Moldura que mostra a FOTO TODA (pode ser maior do que a foto). */
    ajusteTotal: function () {
      var W = this.state.larguraNatural, H = this.state.alturaNatural;
      if (!this.ehQuadrado() || !W || !H) return { w: 1, h: 1 };
      var lado = Math.max(W, H);
      return { w: lado / W, h: lado / H };
    },

    /* Moldura que PREENCHE por completo, cortando o que sobra. */
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
      /* w<=1: a moldura anda dentro da foto. w>1: a foto anda dentro da
         moldura. Os dois casos cabem nestes limites. */
      v.x = limitar(v.x, Math.min(0, 1 - v.w), Math.max(0, 1 - v.w));
      v.y = limitar(v.y, Math.min(0, 1 - v.h), Math.max(0, 1 - v.h));
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

    definirTamanho: function (largura) {
      var v = this.valor();
      var W = this.state.larguraNatural, H = this.state.alturaNatural;
      var w = limitar(largura, MINIMO, MAXIMO);
      var alturaNova = v.h;

      if (this.ehQuadrado()) {
        if (!W || !H) return;
        alturaNova = (w * W) / H;
      }

      this.gravar({
        imagem: v.imagem, w: w, h: limitar(alturaNova, MINIMO, MAXIMO),
        x: v.x + (v.w - w) / 2,
        y: v.y + (v.h - alturaNova) / 2
      });
    },

    definirAltura: function (altura) {
      var v = this.valor();
      var hNova = limitar(altura, MINIMO, MAXIMO);
      this.gravar({
        imagem: v.imagem, w: v.w, h: hNova,
        x: v.x, y: v.y + (v.h - hNova) / 2
      });
    },

    alternarQuadrado: function (evento) {
      var self = this;
      var ligar = evento.target.checked;
      this.setState({ quadradoLivre: ligar }, function () {
        if (ligar) self.definirTamanho(self.valor().w);
      });
    },

    /* --- arrastar --- */
    aoPremir: function (evento) {
      evento.preventDefault();
      if (!this.caixa) return;
      var v = this.valor();
      var r = this.caixa.getBoundingClientRect();
      this.arrasto = {
        xInicial: evento.clientX, yInicial: evento.clientY,
        x: v.x, y: v.y, largura: r.width, altura: r.height
      };
      window.addEventListener('mousemove', this.aoMover);
      window.addEventListener('mouseup', this.pararArrasto);
      this.setState({ aArrastar: true });
    },

    aoMover: function (evento) {
      var a = this.arrasto;
      if (!a) return;
      var v = this.valor();
      this.gravar({
        imagem: v.imagem, w: v.w, h: v.h,
        x: a.x + (evento.clientX - a.xInicial) / a.largura,
        y: a.y + (evento.clientY - a.yInicial) / a.altura
      });
    },

    pararArrasto: function () {
      this.arrasto = null;
      window.removeEventListener('mousemove', this.aoMover);
      window.removeEventListener('mouseup', this.pararArrasto);
      if (this.state.aArrastar) this.setState({ aArrastar: false });
    },

    abrirBiblioteca: function (evento) {
      evento.preventDefault();
      this.props.onOpenMediaLibrary({
        controlID: this.controlID,
        forImage: true,
        privateUpload: false,
        value: this.valor().imagem,
        field: this.props.field
      });
      saltarParaExplorador();
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

      /* A pre-visualizacao mostra a moldura tal como vai aparecer no site: a
         foto la dentro, encolhida e deslocada conforme o enquadramento. */
      var LARGURA = 260;
      var alturaCaixa = LARGURA / (v.proporcao || 1);

      var moldura = h('div', {
        ref: function (el) { self.caixa = el; },
        onMouseDown: this.aoPremir,
        title: 'Arrasta para mover a foto dentro da moldura',
        style: {
          position: 'relative', overflow: 'hidden',
          width: LARGURA + 'px', height: alturaCaixa + 'px',
          border: '1px solid #ccc',
          background: 'repeating-conic-gradient(#f0f0f0 0% 25%, #fff 0% 50%) 50%/16px 16px',
          cursor: this.state.aArrastar ? 'grabbing' : 'grab',
          userSelect: 'none'
        }
      }, h('img', {
        src: this.urlDaImagem(v.imagem),
        onLoad: this.aoCarregarImagem,
        draggable: false,
        style: {
          position: 'absolute', maxWidth: 'none',
          width: (100 / v.w) + '%', height: (100 / v.h) + '%',
          left: (-v.x * 100 / v.w) + '%', top: (-v.y * 100 / v.h) + '%'
        }
      }));

      var controlos = [
        h('div', { key: 'b', style: { marginBottom: '4px' } }, [
          h('button', { key: 'tudo', style: botao, onClick: this.verTudo }, 'Ver a foto toda'),
          h('button', { key: 'preencher', style: botao, onClick: this.preencher }, 'Preencher a moldura')
        ]),
        h('label', { key: 'l1', style: { display: 'block', margin: '8px 0 2px', fontSize: '13px' } },
          'Aproximar / afastar'),
        h('input', {
          key: 'tamanho', type: 'range', min: 5, max: 300, step: 1,
          value: Math.round(v.w * 100),
          onChange: function (e) { self.definirTamanho(Number(e.target.value) / 100); },
          style: { width: LARGURA + 'px' }
        })
      ];

      if (!this.forcaQuadrado()) {
        controlos.push(h('label', { key: 'l2', style: { display: 'block', margin: '8px 0', fontSize: '13px' } }, [
          h('input', {
            key: 'chk', type: 'checkbox', checked: this.ehQuadrado(),
            onChange: this.alternarQuadrado, style: { marginRight: '6px' }
          }),
          'Manter quadrado'
        ]));

        if (!this.ehQuadrado()) {
          controlos.push(h('label', { key: 'l3', style: { display: 'block', margin: '4px 0 2px', fontSize: '13px' } },
            'Altura da moldura'));
          controlos.push(h('input', {
            key: 'altura', type: 'range', min: 5, max: 300, step: 1,
            value: Math.round(v.h * 100),
            onChange: function (e) { self.definirAltura(Number(e.target.value) / 100); },
            style: { width: LARGURA + 'px' }
          }));
        }
      }

      return h('div', { className: this.props.classNameWrapper }, [
        h('div', { key: 'm' }, moldura),
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
