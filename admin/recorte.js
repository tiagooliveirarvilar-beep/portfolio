/* Widget "recorte" — escolher uma imagem e decidir que parte dela aparece.

   O recorte e guardado como fracoes da imagem original (x, y, w, h entre 0 e 1)
   e nunca se mexe no ficheiro carregado: pode ser refeito as vezes que forem
   precisas sem perder qualidade, e a foto original fica sempre intacta.

   Opcoes do campo em config.yml:
     forcarQuadrado: true  -> tranca o recorte em quadrado (usado na capa)
*/
(function () {
  var h = window.h;
  var createClass = window.createClass;

  if (!h || !createClass) {
    console.error('recorte.js: o Decap CMS nao expos "h"/"createClass".');
    return;
  }

  var LADO_MINIMO = 0.05;

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
      x: limitar(num(valor.x, 0), 0, 1),
      y: limitar(num(valor.y, 0), 0, 1),
      w: limitar(num(valor.w, 1), LADO_MINIMO, 1),
      h: limitar(num(valor.h, 1), LADO_MINIMO, 1),
      proporcao: num(valor.proporcao, 1)
    };
  }

  var Controlo = createClass({
    getInitialState: function () {
      return { larguraNatural: 0, alturaNatural: 0, aArrastar: false };
    },

    componentWillUnmount: function () { this.pararArrasto(); },

    /* Quando se escolhe um ficheiro na biblioteca de media, o caminho chega
       por mediaPaths — e ai que o valor do campo e atualizado. */
    componentDidUpdate: function (propsAnteriores) {
      var props = this.props;
      var caminho = props.mediaPaths && props.mediaPaths.get
        ? props.mediaPaths.get(props.forID)
        : null;
      var anterior = propsAnteriores.mediaPaths && propsAnteriores.mediaPaths.get
        ? propsAnteriores.mediaPaths.get(propsAnteriores.forID)
        : null;

      if (caminho && caminho !== anterior) {
        if (caminho.toJS) caminho = caminho.toJS();
        if (Array.isArray(caminho)) caminho = caminho[0];
        if (caminho && caminho !== this.valor().imagem) {
          /* Imagem nova: recomeca com a foto inteira. */
          this.gravar({ imagem: caminho, x: 0, y: 0, w: 1, h: 1, proporcao: 1 });
          this.setState({ larguraNatural: 0, alturaNatural: 0 });
        }
      }
    },

    valor: function () { return normalizar(this.props.value); },

    forcaQuadrado: function () {
      var campo = this.props.field;
      return !!(campo && campo.get && campo.get('forcarQuadrado'));
    },

    gravar: function (novo) {
      var v = normalizar(novo);
      var W = this.state.larguraNatural, H = this.state.alturaNatural;
      v.proporcao = (W && H) ? (v.w * W) / (v.h * H) : 1;
      v.x = limitar(v.x, 0, 1 - v.w);
      v.y = limitar(v.y, 0, 1 - v.h);
      this.props.onChange(v);
    },

    aoCarregarImagem: function (evento) {
      var img = evento.target;
      var self = this;
      this.setState(
        { larguraNatural: img.naturalWidth, alturaNatural: img.naturalHeight },
        function () {
          /* Primeira vez: se o campo e de capa, arranca ja com um quadrado. */
          var v = self.valor();
          if (self.forcaQuadrado() && v.w === 1 && v.h === 1) self.definirTamanho(1);
          else self.gravar(v);
        }
      );
    },

    /* tamanho = fracao da largura ocupada pelo recorte. Em quadrado, a altura
       e calculada para dar o mesmo numero de pixeis dos dois lados. */
    definirTamanho: function (largura) {
      var v = this.valor();
      var W = this.state.larguraNatural, H = this.state.alturaNatural;
      var w = limitar(largura, LADO_MINIMO, 1);
      var alturaNova = v.h;

      if (this.ehQuadrado()) {
        if (!W || !H) return;
        alturaNova = (w * W) / H;
        if (alturaNova > 1) { alturaNova = 1; w = (H / W); }
      }

      this.gravar({
        imagem: v.imagem, w: w, h: limitar(alturaNova, LADO_MINIMO, 1),
        x: limitar(v.x + (v.w - w) / 2, 0, 1),
        y: limitar(v.y + (v.h - alturaNova) / 2, 0, 1)
      });
    },

    definirAltura: function (altura) {
      var v = this.valor();
      var hNova = limitar(altura, LADO_MINIMO, 1);
      this.gravar({
        imagem: v.imagem, w: v.w, h: hNova,
        x: v.x, y: limitar(v.y + (v.h - hNova) / 2, 0, 1)
      });
    },

    ehQuadrado: function () {
      if (this.forcaQuadrado()) return true;
      if (typeof this.state.quadradoLivre === 'boolean') return this.state.quadradoLivre;
      /* Por omissao a preferencia e quadrado; um recorte ja gravado com outra
         proporcao reabre com a opcao desligada. */
      return Math.abs((this.valor().proporcao || 1) - 1) < 0.02;
    },

    alternarQuadrado: function (evento) {
      var self = this;
      var ligar = evento.target.checked;
      this.setState({ quadradoLivre: ligar }, function () {
        if (ligar) self.definirTamanho(self.valor().w);
      });
    },

    /* --- arrastar o recorte --- */
    aoPremir: function (evento) {
      evento.preventDefault();
      var caixa = this.caixa;
      if (!caixa) return;
      var v = this.valor();
      var r = caixa.getBoundingClientRect();
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
        x: limitar(a.x + (evento.clientX - a.xInicial) / a.largura, 0, 1 - v.w),
        y: limitar(a.y + (evento.clientY - a.yInicial) / a.altura, 0, 1 - v.h)
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
        controlID: this.props.forID,
        forImage: true,
        privateUpload: false,
        value: this.valor().imagem,
        field: this.props.field
      });
    },

    limpar: function (evento) {
      evento.preventDefault();
      this.setState({ larguraNatural: 0, alturaNatural: 0 });
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
        marginRight: '6px', padding: '6px 10px', cursor: 'pointer',
        border: '1px solid #ccc', borderRadius: '4px', background: '#fff'
      };

      if (!v.imagem) {
        return h('div', { className: this.props.classNameWrapper },
          h('button', { style: botao, onClick: this.abrirBiblioteca }, 'Escolher imagem')
        );
      }

      var pct = function (n) { return (n * 100) + '%'; };

      var moldura = h('div', {
        ref: function (el) { self.caixa = el; },
        style: {
          position: 'relative', display: 'inline-block', maxWidth: '100%',
          userSelect: 'none', lineHeight: 0
        }
      }, [
        h('img', {
          key: 'img',
          src: this.urlDaImagem(v.imagem),
          onLoad: this.aoCarregarImagem,
          draggable: false,
          style: { display: 'block', maxWidth: '100%', height: 'auto' }
        }),
        h('div', {
          key: 'rect',
          onMouseDown: this.aoPremir,
          title: 'Arrasta para escolher a parte da foto que aparece',
          style: {
            position: 'absolute',
            left: pct(v.x), top: pct(v.y), width: pct(v.w), height: pct(v.h),
            border: '1px solid #fff',
            boxShadow: '0 0 0 1px rgba(0,0,0,.5), 0 0 0 9999px rgba(0,0,0,.45)',
            cursor: this.state.aArrastar ? 'grabbing' : 'grab'
          }
        })
      ]);

      var linhas = [
        h('label', { key: 'l1', style: { display: 'block', margin: '10px 0 2px', fontSize: '13px' } },
          'Tamanho do recorte'),
        h('input', {
          key: 'tamanho', type: 'range', min: 5, max: 100, step: 1,
          value: Math.round(v.w * 100),
          onChange: function (e) { self.definirTamanho(Number(e.target.value) / 100); },
          style: { width: '100%' }
        })
      ];

      if (!this.forcaQuadrado()) {
        linhas.push(h('label', { key: 'l2', style: { display: 'block', margin: '10px 0', fontSize: '13px' } }, [
          h('input', {
            key: 'chk', type: 'checkbox',
            checked: this.ehQuadrado(),
            onChange: this.alternarQuadrado,
            style: { marginRight: '6px' }
          }),
          'Manter quadrado'
        ]));

        if (!this.ehQuadrado()) {
          linhas.push(h('label', { key: 'l3', style: { display: 'block', margin: '4px 0 2px', fontSize: '13px' } },
            'Altura do recorte'));
          linhas.push(h('input', {
            key: 'altura', type: 'range', min: 5, max: 100, step: 1,
            value: Math.round(v.h * 100),
            onChange: function (e) { self.definirAltura(Number(e.target.value) / 100); },
            style: { width: '100%' }
          }));
        }
      }

      return h('div', { className: this.props.classNameWrapper }, [
        h('div', { key: 'moldura' }, moldura),
        h('div', { key: 'controlos' }, linhas),
        h('div', { key: 'botoes', style: { marginTop: '10px' } }, [
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
