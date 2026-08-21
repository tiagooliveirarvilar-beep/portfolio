# Especificação — Portfolio de Tiago Oliveira Ribeiro Vilar

## Objetivo
Site pessoal de portefólio + currículo. Mostra todos os trabalhos, não só arquitetura:
arquitetura académica e profissional, teatro, voluntariado, carpintaria/objetos, outras
experiências. Público-alvo indefinido (qualquer pessoa). Fortemente orientado a imagem.

## Requisitos técnicos inegociáveis
- **100% gratuito para sempre**, incluindo o domínio. Sem mensalidades (elimina Webflow,
  Adobe Portfolio). Sem domínio próprio pago — usar subdomínio grátis
  (ex. `tiagovilar.github.io` ou `tiagovilar.netlify.app`, nome à escolha do Tiago).
- **Editável sem código.** Solução: CMS baseado em Git (Decap CMS, antigo Netlify CMS).
  Painel de admin em `/admin`, login próprio, campos de texto + upload de imagem. Ao
  gravar, faz commit automático no repositório e o site republica-se sozinho.
- Hospedagem: Netlify, Cloudflare Pages ou GitHub Pages (grátis, mais que suficiente
  para tráfego pessoal).
- Categorias/tags devem existir como campo do projeto no CMS (para o futuro), mas
  **não são usadas para organizar a página agora** — ver estrutura abaixo.

## Estrutura do site
Três secções: **Projetos** (home) → **Sobre Mim** → **Contacto**. Sem mais nada.

## Prints do que ficou aprovado
Capturas geradas a partir do código exato de cada mockup final desta conversa (o Tiago
confirmou "perfeito" para todas). O motor usado para as capturas (wkhtmltopdf) é mais
antigo do que um browser normal — a fonte aparece como um sans-serif genérico em vez de
Jost, mas as proporções, posições e margens são fiéis ao código real.

**Home** — número a 1cm da margem, foto verdadeiramente centrada, nome+data a 1cm do
outro lado:
![home](prints/home.png)

**Página de projeto** — título fixo a 1cm da margem enquanto as imagens passam, ficha
técnica no fim:
![página de projeto](prints/pagina-projeto.png)

**Sobre Mim** — foto e texto alinhados ao fundo do ecrã, bloco horizontal:
![sobre mim](prints/sobre-mim.png)

**Contacto** — lista no canto inferior direito, sem rótulos:
![contacto](prints/contacto.png)

## Sistema visual
- **Fonte:** Jost (Google Fonts), pesos 400/500/600/700. É o equivalente gratuito da
  Century Gothic (pedido explícito do Tiago) — Century Gothic em si não é grátis para
  web (licença Monotype), por isso não usar.
- **Cor:** preto/branco/cinza como base (`--bg:#FAFAF8`, `--ink:#161514`,
  `--gray:#8a8578`). Uma única cor de destaque: **vermelho-vinho `#852321`**, usada
  *apenas* como cor de hover no nome do projeto na home (não no número, não em mais
  nenhum sítio por agora).
- **Sem separadores/linhas divisórias em lado nenhum** (nem horizontais na home, nem
  verticais na página de projeto). Regra forte, não voltar atrás nisto.
- **Margem padrão: 1cm** (usar mesmo a unidade CSS `cm`) em quase todos os elementos
  que encostam à borda do ecrã — número e texto na home, título na página de projeto,
  foto e texto no Sobre Mim, lista no Contacto.
- Títulos de projeto: **sempre em minúsculas**, mesmo a primeira letra.
- Imagens de projeto: **quadradas**, nunca retangulares.
- Datas na home: sempre por extenso, formato "mês de ano" (ex. "junho de 2025"), exceto
  projetos em curso, que mostram "em curso".
- Números de projeto: **arábicos simples** (01, 02, 03...), nunca romanos — não escala
  bem quando houver muitos projetos.

## Home (lista cronológica de projetos)
- **Sem categorias.** Decisão final. Fluxo único, cronológico, **mais recente primeiro**.
- Cada projeto ocupa **um ecrã inteiro** (100vh, sem scroll dentro dele) — só ao continuar
  a fazer scroll é que aparece o projeto seguinte.
- Layout de cada linha, três elementos posicionados de forma **independente** (não usar
  grid de colunas dependentes, porque a largura do texto varia e desalinha a imagem do
  centro real do ecrã):
  - Número: `position:absolute; left:1cm; top:50%; transform:translateY(-50%)`. Peso 700,
    tamanho ~`clamp(30px,4.6vw,46px)`. Cor preta sempre.
  - Foto: `position:absolute; left:50%; top:50%; transform:translate(-50%,-50%)`.
    Largura `min(32vw,300px)`, `aspect-ratio:1/1`, verdadeiramente centrada no ecrã
    (não entre número e texto).
  - Nome + data: `position:absolute; right:1cm; top:50%; transform:translateY(-50%)`,
    alinhado à direita. Nome peso 600, minúsculas. Data por baixo, cinza, tamanho ~10px,
    **muito pouco espaço entre nome e data** (quase coladas).
- Hover numa linha: o nome do projeto muda para `#852321`. Número mantém-se preto.
- Clicar num projeto abre a página desse projeto.

## Página de projeto
- **Não é uma caixa com scroll interno.** É a própria página do browser a rolar
  normalmente, scroll livre e suave (nunca scroll-snap/drag entre imagens — foi
  explicitamente rejeitado).
- **Título do projeto verdadeiramente fixo**: `position:fixed; top:50%; right:1cm;
  transform:translateY(-50%)`, minúsculas, ~13px. Fica sempre visível enquanto a página
  rola, não se move nunca.
- Imagens: contidas com margem (não full-bleed), tamanho moderado (~46% da largura da
  coluna de conteúdo), centradas, espaçamento generoso entre elas (~48px), clicáveis
  para abrir em full screen (lightbox simples).
- No fim das imagens, bloco de **ficha técnica** em colunas: texto descritivo curto à
  esquerda, dados do projeto (local, data, disciplina/tipo, área) e créditos
  (colaboração, fotografia, orientação) nas colunas seguintes. Texto pequeno (~11px),
  sem linhas a separar as colunas.

## Sobre Mim
- Um ecrã, **sem scroll**, conteúdo alinhado ao **fundo do ecrã** (não ao centro).
- Foto: canto inferior esquerdo, `left:1cm; bottom:1cm`, retrato (proporção 3:4), largura
  ~75px (pequena, texto e foto foram reduzidos a metade do tamanho inicial).
- Texto: começa a ~44% da largura do ecrã e estende-se até `right:1cm`, também
  `bottom:1cm` (mesma linha de fundo da foto). Bloco mais horizontal que vertical — texto
  pequeno (~8px), várias linhas curtas, não uma coluna estreita e alta.
- Título pequeno "sobre mim" antes do texto, cinza, minúsculas.
- **Texto real** (traduzido do PDF do Tiago, ajustar tom se ele quiser mudar):

  > Custa-me definir-me em poucas palavras. Interessa-me sobretudo o processo: aprender,
  > observar e compreender antes de desenhar. Acredito que a arquitetura se constrói
  > através da experiência vivida. Aprende-se tanto fora da disciplina como dentro dela —
  > num concerto, ao observar os fluxos de entrada e saída; numa exposição, pela relação
  > entre a luz e a disposição das obras; num jogo de futebol, ao perceber o impacto
  > cultural de um lugar; ou num café, ao ouvir como as pessoas falam do mundo. Estas
  > experiências moldam um modo de olhar para os lugares que informa as minhas decisões
  > de projeto e as questões espaciais que escolho perseguir.

- Download do CV em PDF: **não incluir agora**, fica para depois.

## Contacto
- Um ecrã, sem scroll. **Só a lista de contactos**, alinhada ao canto inferior direito
  (`right:1cm; bottom:1cm; text-align:right`), muito pequena (~9.5px), sem os rótulos
  "email"/"telefone" — só os valores.
- Pequena etiqueta "contacto" acima da lista, cinza, minúsculas.
- Conteúdo: email `tiagovilar@outlook.pt`, telefone `+351 961 301 403`, "porto, portugal".
- **Confirmar com o Tiago** antes de publicar: ele queria confirmar se email/telefone
  podem mesmo ficar públicos no site (eram originalmente só para um PDF enviado a
  ateliers).

## Conteúdo conhecido para os projetos (usar como base, placeholders onde falta)

### Arquitetura académica (FAUP)
1. **Doca de Pesca / Fish Market** — Design Studio 4, Matosinhos, 2024/2025. Conceito
   central: "a asa" (the wing), elemento que organiza programa e circulação; tudo o que
   é indústria do pescado vive por baixo, tudo o que é cidade acontece por cima.
2. **Torre Residencial, Lapa** — Design Studio 3, Porto, 2023/2024. Torre residencial
   sobre podium baixo de escritórios, tipologias estúdio a T3, módulo de dois pisos com
   pé-direito duplo.
3. **Reabilitação de casa burguesa do séc. XIX em escola** — Rua de Brito Capelo,
   Matosinhos, 2024/25. Trabalho de grupo: Ana Soares, Giulio Schiavon, Leonor Ribeiro,
   Mariana Reina, Raquel Guedes, Tiago Vilar.
4. **Margens do Rio Tedo** — análise territorial de Granja do Têdo, 2023/24. Trabalho de
   grupo: Beatriz Perdigoto, Beatriz Taborda, Francisca Sottomayor, Mariana Reina, Tiago
   Vilar.

### Arquitetura fora da faculdade
5. **Fração F** — remodelação de apartamento no 3º piso para família de 5 pessoas,
   colaboração com atelier (Juliano Ribas, Arq.), 2026, em curso.
6. **Aroeira** — composto volumétrico 3D de terreno para listagem imobiliária.
7. **Tese: Alberto Ponis** — investigação sobre a vida e obra do arquiteto, consulta
   prevista ao Archivio Ponis Zalaffi (Palau, Sardenha), em curso.

### Fora da arquitetura
8. Ator de teatro no TIC TAC, 2025.
9. Peça de teatro de caridade, Missão País 2024 (organização e atuação).
10. Voluntariado: Missão País 2023/2024/2025 (Castelo de Paiva), Open House Porto 2023.
11. Um móvel de carpintaria (feito recentemente — falta perceber se há mais peças).
12. Curso de 3 semanas de design de interiores de barcos, ESAD — por confirmar se há
    material visual.
13. Workshop "Arquitetura na Prática" — por confirmar se há material visual.
14. Academia de verão de Revit, Ventura Partners.
15. Aulas de vela — por confirmar se entra como peça visual ou só currículo.

## Currículo (para ficha do CV em PDF, futuro, não para já)
- **Nome completo:** Tiago Oliveira Ribeiro Vilar. Nascimento: 14 março 2003.
- **Formação:** Ensino secundário — Escola Martins Sarmento, Guimarães, Artes Visuais,
  2017-2021, Prémio de Mérito Académico 18/20. FAUP, Mestrado Integrado em Arquitetura,
  2021-presente, média 16/20, projeto selecionado para exposições anuais 2023 e 2024.
  Erasmus — Università degli Studi di Firenze, 2025-2026.
- **Experiência:** Menos é Mais Arquitectos (jul 2023), Nuno Valentim Arquitectura (jul
  2024), Juliano Ribas Arquitectura (jul 2025) — estágios de verão.
- **Software:** Revit, AutoCAD, InDesign.
- **Línguas:** Português (nativo), Inglês (avançado), Italiano (intermédio B1), Espanhol
  (básico).

## Estado da decisão
Design fechado em todas as secções. Pronto para construção. Falta apenas reunir/tratar
as fotografias e textos finais de cada projeto, o que **não bloqueia começar a construir**
— o site fica funcional com placeholders e vai-se substituindo cada um pela peça real
através do painel do CMS, sem tocar em código.
