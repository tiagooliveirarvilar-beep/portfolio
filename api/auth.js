/**
 * Cloudflare Pages Function para autenticação do Decap CMS com GitHub OAuth.
 *
 * O Decap CMS envia o código do GitHub para este endpoint, que o troca por um
 * token de acesso. O token é enviado de volta ao CMS num localStorage.
 */

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);

  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  // GET /api/auth?code=xyz
  if (request.method === 'GET') {
    const code = url.searchParams.get('code');
    if (!code) {
      return new Response(JSON.stringify({ error: 'Missing code' }), { status: 400 });
    }

    // Trocar o código por um token do GitHub
    try {
      const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: context.env.GITHUB_CLIENT_ID,
          client_secret: context.env.GITHUB_CLIENT_SECRET,
          code: code,
        }),
      });

      const tokenData = await tokenResponse.json();

      if (tokenData.error) {
        return new Response(JSON.stringify({ error: tokenData.error }), { status: 400 });
      }

      // Devolver o token para o CMS
      return new Response(JSON.stringify({
        token: tokenData.access_token,
        provider: 'github',
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
  }

  return new Response('Not Found', { status: 404 });
}
