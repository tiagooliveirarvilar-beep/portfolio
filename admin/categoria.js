/* Widget "categoria" — como um <select>, mas permite escrever um valor novo
   que ainda nao esteja na lista (um "creatable select"). Usa a <datalist>
   nativa do browser: leve, sem dependencias, funciona em qualquer browser
   moderno. */
(function () {
  var h = window.h;
  var createClass = window.createClass;

  if (!h || !createClass) {
    console.error('categoria.js: o Decap CMS nao expos "h"/"createClass".');
    return;
  }

  var SUGESTOES = [
    'arquitetura académica',
    'arquitetura profissional',
    'investigação',
    'objetos',
    'teatro',
    'voluntariado',
    'formação',
  ];

  var Controlo = createClass({
    render: function () {
      var props = this.props;
      var id = 'categoria-sugestoes-' + (props.forID || Math.random().toString(36).slice(2));

      return h('div', {}, [
        h('input', {
          key: 'input',
          type: 'text',
          list: id,
          className: props.classNameWrapper,
          value: props.value || '',
          onChange: function (e) { props.onChange(e.target.value); },
          placeholder: 'escolhe da lista ou escreve uma nova',
          style: { width: '100%', boxSizing: 'border-box' },
        }),
        h('datalist', { key: 'lista', id: id },
          SUGESTOES.map(function (s) { return h('option', { key: s, value: s }); })
        ),
      ]);
    },
  });

  var Previsualizacao = createClass({
    render: function () { return h('span', {}, this.props.value || ''); },
  });

  CMS.registerWidget('categoria', Controlo, Previsualizacao);
})();
