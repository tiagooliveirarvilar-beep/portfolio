# Portefólio — Tiago Oliveira Ribeiro Vilar

Site estático (HTML/CSS/JS puro, sem build) com painel de edição sem código
em `/admin` (Decap CMS). Ver `especificacao-portfolio.md` para o desenho
completo já fechado.

## Estrutura

```
index.html          → home (lista cronológica de projetos)
projeto.html         → página de um projeto (?p=slug)
css/style.css        → todo o sistema visual
js/conteudo.js        → carrega e ordena o conteúdo
js/home.js / projeto.js → montam cada página
content/projetos.json → todos os projetos (editável via /admin)
content/sobre.json    → texto e foto do Sobre Mim
content/contacto.json → email, telefone, local
images/uploads/       → onde o CMS guarda as imagens carregadas
admin/                → painel de edição (Decap CMS)
```

## Publicar (grátis, sem mensalidades)

1. **Criar o repositório no GitHub** (público ou privado) e enviar esta pasta.
   ```bash
   git init
   git add .
   git commit -m "Site inicial"
   git branch -M main
   git remote add origin git@github.com:<teu-utilizador>/<repo>.git
   git push -u origin main
   ```

2. **Ligar ao Netlify** (necessário para o login do `/admin` funcionar —
   GitHub Pages sozinho não tem isto):
   - Entrar em [app.netlify.com](https://app.netlify.com) com a conta GitHub.
   - "Add new site" → "Import an existing project" → escolher o repositório.
   - Build command: (vazio). Publish directory: `/` (raiz).
   - Deploy. O Netlify dá um subdomínio grátis tipo `nome-aleatorio.netlify.app`
     — em "Site settings → Change site name" escolhe um nome, ex.
     `tiagovilar.netlify.app`.

3. **Ativar Identity + Git Gateway** (é o "login próprio" do painel):
   - No site no Netlify: `Site settings → Identity → Enable Identity`.
   - `Registration preferences` → `Invite only` (para só tu poderes entrar).
   - `Identity → Services → Git Gateway → Enable Git Gateway`.
   - `Identity → Invite users` → convida o teu próprio email
     (tiagooliveirarvilar@gmail.com ou outro à tua escolha) → aceita o
     convite no email e define uma password.

4. **Atualizar `admin/config.yml`**: troca
   `SUBSTITUIR-PELO-TEU-SITE.netlify.app` pelo URL real do site (2 linhas,
   `site_url` e `display_url`), faz commit e push.

5. Pronto: `https://<o-teu-site>.netlify.app/admin/` é o painel de edição.
   Login com o email convidado, editar projetos/sobre/contacto, gravar —
   isso faz commit automático no GitHub e o site republica-se sozinho em
   menos de um minuto.

## Adicionar/editar um projeto sem código

No `/admin` → "Projetos" → editar a lista → adicionar item. Campos:
título (sempre minúsculas), data, imagem de capa, imagens da galeria,
descrição, local, período, disciplina, área, colaboração. O número
(01, 02...) e a posição na home calculam-se sozinhos pela data — não
precisas de reordenar nada à mão.

## Nota pendente

O ecrã de Contacto já está construído com email, telefone e localização,
mas a especificação pede para **confirmar contigo antes de publicar** se
esses dados podem mesmo ficar públicos (eram originalmente só para um PDF
enviado a ateliers). Se preferires, edita/apaga isso em `/admin → Contacto`
antes do primeiro deploy público, ou já cá diz-me e eu ajusto.
