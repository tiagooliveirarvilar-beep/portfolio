/**
 * Cloudflare Pages Function: autenticacao GitHub OAuth para o Decap CMS.
 *
 * Cloudflare Pages Functions vivem obrigatoriamente em /functions — este
 * ficheiro em /functions/api/auth.js fica disponivel em /api/auth.
 *
 * O Decap CMS abre este endpoint numa popup e espera um protocolo proprio
 * (nao e um simples pedido/resposta JSON):
 *
 *   1. Popup abre /api/auth sem "code" -> respondemos com um redirect (302)
 *      para o ecra de autorizacao do GitHub.
 *   2. GitHub reenvia o utilizador para /api/auth?code=...&state=... (o
 *      "Authorization callback URL" registado na OAuth App) -> trocamos o
 *      code por um token e devolvemos uma pagina HTML que faz o handshake
 *      via postMessage com a janela que abriu a popup.
 *
 * O "state" e guardado num cookie de curta duracao só para confirmar que a
 * resposta do GitHub corresponde ao pedido que nós fizemos.
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

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const redirectUri = `${url.origin}/api/auth`;

  // --- Passo 1: pedido inicial da popup do Decap, sem "code" ainda ---
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

  // --- Passo 2: o GitHub reenviou o utilizador com o "code" ---
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

  // Handshake por postMessage esperado pelo Decap CMS: a popup avisa que
  // esta pronta, espera uma resposta da janela principal e so ai envia o
  // token — evita a corrida entre a popup carregar e a janela principal
  // ainda nao ter o listener pronto.
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
