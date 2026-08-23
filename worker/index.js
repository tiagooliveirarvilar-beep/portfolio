/**
 * Script de entrada do Worker (Cloudflare "Workers com static assets").
 *
 * Este projeto foi deploiado no Cloudflare como Worker, nao como Pages
 * classico — por isso nao existe a convencao /functions. Aqui e so a
 * ficheiro que decide o que e uma rota dinamica (so /api/auth) e o que e
 * um ficheiro estatico do site (index.html, css/, js/, admin/, ...).
 *
 * Por omissao (sem "run_worker_first"), o Cloudflare so chama este script
 * quando o pedido NAO corresponde a nenhum ficheiro estatico existente —
 * ou seja, todo o resto do site continua a ser servido diretamente, sem
 * passar por aqui.
 */

function paginaDeErro(mensagem) {
  return new Response(`<p>Erro na autenticação: ${mensagem}</p>`, {
    status: 400,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

function estadoAleatorio() {
  return crypto.randomUUID();
}

/* Autenticacao GitHub OAuth para o Decap CMS (painel /admin).
   O Decap abre este endpoint numa popup e espera um protocolo proprio
   (nao e um simples pedido/resposta JSON):

     1. Popup abre /api/auth sem "code" -> respondemos com um redirect (302)
        para o ecra de autorizacao do GitHub.
     2. GitHub reenvia o utilizador para /api/auth?code=...&state=... (o
        "Authorization callback URL" registado na OAuth App) -> trocamos o
        code por um token e devolvemos uma pagina HTML que faz o handshake
        via postMessage com a janela que abriu a popup.

   O "state" e guardado num cookie de curta duracao so para confirmar que a
   resposta do GitHub corresponde ao pedido que nos fizemos. */
async function autenticar(request, env) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const redirectUri = `${url.origin}/api/auth`;

  if (!code) {
    const state = estadoAleatorio();
    const autorizar = new URL('https://github.com/login/oauth/authorize');
    autorizar.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
    autorizar.searchParams.set('redirect_uri', redirectUri);
    autorizar.searchParams.set('scope', 'repo,user');
    autorizar.searchParams.set('state', state);

    return new Response(null, {
      status: 302,
      headers: {
        Location: autorizar.toString(),
        'Set-Cookie': `oauth_state=${state}; Path=/; Max-Age=600; Secure; HttpOnly; SameSite=Lax`,
      },
    });
  }

  const cookies = request.headers.get('Cookie') || '';
  const estadoGuardado = (cookies.match(/oauth_state=([^;]+)/) || [])[1];
  const estadoRecebido = url.searchParams.get('state');

  if (!estadoGuardado || estadoGuardado !== estadoRecebido) {
    return paginaDeErro('o pedido não corresponde (state inválido). Tenta entrar outra vez.');
  }

  let tokenData;
  try {
    const resposta = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: redirectUri,
      }),
    });
    tokenData = await resposta.json();
  } catch (erro) {
    return paginaDeErro(String(erro));
  }

  if (!tokenData || tokenData.error || !tokenData.access_token) {
    return paginaDeErro((tokenData && tokenData.error_description) || 'o GitHub não devolveu um token.');
  }

  const payload = JSON.stringify(JSON.stringify({ token: tokenData.access_token, provider: 'github' }));

  const html = `<!doctype html>
<html><body>
<script>
(function () {
  function receberMensagem(mensagem) {
    window.opener.postMessage('authorization:github:success:' + ${payload}, mensagem.origin);
    window.removeEventListener('message', receberMensagem, false);
  }
  window.addEventListener('message', receberMensagem, false);
  window.opener.postMessage('authorizing:github', '*');
})();
</script>
</body></html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Set-Cookie': 'oauth_state=; Path=/; Max-Age=0',
    },
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/api/auth') {
      return autenticar(request, env);
    }

    // Qualquer outro pedido que chegue aqui nao correspondeu a nenhum
    // ficheiro estatico; devolve o 404 normal do site de assets.
    return env.ASSETS.fetch(request);
  },
};
