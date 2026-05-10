---
name: Albion Codex V2
description: Painel privado de arbitragem Caerleon para Black Market, tecnico, rapido e premium.
colors:
  abyss-bg: "#080b12"
  deep-shell: "#0d111b"
  ink-surface: "#0a0f19"
  panel-surface: "#0c111c"
  elevated-surface: "#131a2a"
  text-primary: "#e8edf2"
  text-strong: "#f7f9fb"
  text-muted: "#95a0ad"
  royal-gold: "#d8aa55"
  action-blue: "#75b8ff"
  signal-green: "#35d18b"
  profit-green: "#00f28a"
  risk-red: "#f06262"
  fee-red: "#ff5d76"
  private-violet: "#ad5cff"
typography:
  display:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "clamp(32px, 4vw, 54px)"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "0"
  headline:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "16px"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "0"
  title:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "15px"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "0"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "0"
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "11px"
    fontWeight: 900
    lineHeight: 1
    letterSpacing: "0"
rounded:
  xs: "4px"
  sm: "6px"
  md: "8px"
  pill: "999px"
spacing:
  xs: "6px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "18px"
  section: "28px"
components:
  button-primary:
    backgroundColor: "{colors.action-blue}"
    textColor: "{colors.ink-surface}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "0 12px"
    height: "34px"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.royal-gold}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "0 12px"
    height: "34px"
  input-field:
    backgroundColor: "{colors.ink-surface}"
    textColor: "{colors.text-primary}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "0 12px"
    height: "42px"
  summary-card:
    backgroundColor: "{colors.elevated-surface}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "18px"
  item-chip:
    backgroundColor: "{colors.panel-surface}"
    textColor: "{colors.royal-gold}"
    typography: "{typography.label}"
    rounded: "{rounded.xs}"
    padding: "0 8px"
    height: "24px"
---

# Design System: Albion Codex V2

## 1. Overview

**Creative North Star: "Mesa de Arbitragem Real"**

Albion Codex V2 deve parecer uma mesa privada de decisao: tecnica, rapida e premium, feita para quem ja entende a mecanica e precisa agir antes do dado envelhecer. A interface aceita densidade, mas a densidade precisa parecer intencional, com hierarquia nitida para lucro, margem, quantidade, origem dos dados, idade da ordem e risco.

O sistema visual e escuro por contexto de uso: o jogador esta com Albion Online, API local, cliente de coleta e painel web abertos ao mesmo tempo, provavelmente em uma sessao longa de jogo. O fundo profundo reduz fadiga, enquanto ouro, azul e verde aparecem como sinais raros para direcao, acao e lucro.

O design rejeita painel generico de SaaS, terminal de negociacao de cripto, planilha feia e fantasia medieval exagerada. Albion aparece por itens, cidades e linguagem de mercado, nao por ornamento.

**Key Characteristics:**
- Escuro, tecnico e compacto, com brilho usado como sinal e nao como decoracao.
- Densidade alta com separacao clara entre decisao, diagnostico e filtros.
- Hierarquia monetaria forte: lucro e preco precisam vencer o ruido.
- Estados de risco visiveis, incluindo dado velho, quantidade estimada, fonte publica/privada e falha de coleta.
- Premium contido: poucas cores, cantos pequenos, superficies em camadas discretas.

## 2. Colors

A paleta combina base abissal, superficies azuladas muito escuras e acentos raros de ouro, azul e verde para orientar decisao.

### Primary
- **Royal Gold** (`royal-gold`): usado em contexto Albion, item, foco e comandos secundarios. Deve parecer metal utilitario, nao luxo decorativo.
- **Action Blue** (`action-blue`): usado para a acao principal e pontos de selecao. Deve aparecer pouco, com funcao clara.

### Secondary
- **Signal Green** (`signal-green`): usado para status positivo e estados de sucesso.
- **Profit Green** (`profit-green`): reservado para lucro real. Esta cor nao deve ser usada em elementos comuns.

### Tertiary
- **Risk Red** (`risk-red`): usado para erro, offline e alertas que podem invalidar decisao.
- **Fee Red** (`fee-red`): usado em taxa e custo negativo, separado do vermelho de erro.
- **Private Violet** (`private-violet`): usado para fonte privada de dados, como um sinal de procedencia.

### Neutral
- **Abyss Background** (`abyss-bg`): fundo principal da aplicacao.
- **Deep Shell** (`deep-shell`): camada de fundo superior e faixas de estrutura.
- **Ink Surface** (`ink-surface`): campos, tabela e superficies de maior densidade.
- **Panel Surface** (`panel-surface`): cards e paineis de filtro/diagnostico.
- **Elevated Surface** (`elevated-surface`): cards de resumo e superficies que precisam subir um nivel.
- **Text Primary** (`text-primary`): texto padrao.
- **Text Strong** (`text-strong`): titulos, numeros e conteudo decisivo.
- **Text Muted** (`text-muted`): metadados, labels, timestamps e descricoes curtas.

### Named Rules

**The Rare Signal Rule.** Ouro, azul e verde existem para decisao. Se tudo esta acentuado, nada esta acentuado.

**The Profit Is Sacred Rule.** `profit-green` pertence a lucro e confirmacao financeira. Nao use essa cor para botoes comuns, decoracao ou estados neutros.

**The Dark Is Working Light Rule.** A base escura e operacional, nao dramatica. Evite preto puro e evite gradientes roxos ou neon.

## 3. Typography

**Display Font:** Inter com fallback para system-ui.  
**Body Font:** Inter com fallback para system-ui.  
**Label/Mono Font:** sem fonte mono distinta no sistema atual.

**Character:** A tipografia e unica, tecnica e sem friccao. A personalidade vem do peso, escala e organizacao, nao de uma fonte decorativa.

### Hierarchy
- **Display** (800, `clamp(32px, 4vw, 54px)`, `1`): usado no titulo principal da aplicacao. Grande o bastante para identidade, sem virar hero de marketing.
- **Headline** (800, `16px`, `1.2`): usado em secoes como filtros, diagnostico e oportunidades.
- **Title** (800, `15px`, `1.2`): usado em itens, cidades e nomes de componentes compactos.
- **Body** (400, `14px`, `1.4`): usado em tabela, descricoes e conteudo operacional. Paragrafos longos devem ficar abaixo de 75 caracteres por linha.
- **Label** (900, `10px-13px`, `0`, uppercase quando funcional): usado em chips, cabecalhos de tabela, filtros e metadados.

### Named Rules

**The No Marketing Type Rule.** Nao use tipografia de landing page em superficies de trabalho. O usuario precisa comparar e agir, nao ser convencido.

**The Number Wins Rule.** Valores de prata, lucro, margem, quantidade e idade da ordem devem ter prioridade visual sobre textos explicativos.

## 4. Elevation

O sistema usa camadas discretas: fundos tonais, bordas translucidas e sombras suaves. A elevacao deve separar grupos funcionais sem transformar a tela em uma pilha de cards flutuantes.

### Shadow Vocabulary
- **Status Lift** (`0 18px 42px rgba(0, 0, 0, 0.28)`): usado para status compacto ou superficie que precisa ser vista rapidamente.
- **Summary Lift** (`0 20px 60px rgba(0, 0, 0, 0.24)`): usado nos cards de resumo.
- **Panel Lift** (`0 18px 52px rgba(0, 0, 0, 0.22)`): usado em filtros e paineis principais.
- **Table Lift** (`0 24px 70px rgba(0, 0, 0, 0.32)`): usado no container de oportunidades, a superficie decisiva da tela.
- **Popover Lift** (`0 24px 60px rgba(0, 0, 0, 0.44)`): usado em dropdowns e sugestoes, com separacao mais forte.

### Named Rules

**The Discreet Layers Rule.** Use sombra para separar decisao, filtro e diagnostico. Nao use sombra para decorar.

**The No Floating Dashboard Rule.** Cards soltos demais fazem o produto parecer SaaS generico. Prefira faixas e superficies conectadas quando o conteudo pertence ao mesmo fluxo.

## 5. Components

### Buttons

- **Shape:** cantos pequenos e utilitarios (`6px`), nunca pill por padrao.
- **Primary:** fundo `action-blue`, texto escuro, peso alto, altura minima de `34px`. Use para aplicar, confirmar ou alternar uma funcao central.
- **Quiet:** fundo transparente, borda dourada translucida, texto `royal-gold`. Use para recarregar, limpar e comandos secundarios.
- **Hover / Focus:** hover pode elevar `translateY(-1px)` e ajustar fundo/borda. Focus deve usar borda dourada e halo suave.
- **Row Actions:** botoes de linha ficam neutros ate o hover. Eles nao devem competir com lucro e margem.

### Chips

- **Style:** chips usam fundo escuro translucido, borda fina e label uppercase.
- **State:** chips de item usam `royal-gold`; fonte privada usa violeta; fonte publica usa azul; legado/desconhecido usa neutro.
- **Rule:** chips sao metadados decisivos. Nao transforme chips em decoracao colorida.

### Cards / Containers

- **Corner Style:** canto contido (`8px`) para superficies principais e `4px-6px` para elementos internos.
- **Background:** base em `panel-surface`, cards elevados em `elevated-surface`, tabela em `ink-surface`.
- **Shadow Strategy:** seguir a elevacao discreta. Sombras fortes ficam reservadas para tabela e popovers.
- **Border:** bordas brancas translucidas com baixa opacidade. Bordas coloridas so quando comunicam fonte, foco ou status.
- **Internal Padding:** `12px-18px` na maioria dos paineis; `28px` para respiracao da shell.

### Inputs / Fields

- **Style:** fundo `ink-surface`, borda clara translucida, altura minima `42px`, radius `6px`.
- **Focus:** borda `royal-gold` com halo sutil. O foco deve ser visivel sem parecer neon.
- **Error / Disabled:** disabled reduz opacidade e mantem layout. Erro deve usar vermelho de risco com texto claro.

### Navigation

Nao existe navegacao global no V2 atual. A estrutura principal e uma shell de painel unico com topo, resumo, diagnostico, filtros e tabela. Se navegacao for adicionada, ela deve ser compacta e operacional, nunca uma barra de marketing.

### Opportunity Table

A tabela e o componente assinatura. Ela deve sustentar varredura rapida por item, compra, venda, taxa, quantidade e lucro. Item e lucro sao ancoras visuais; dados de idade e origem ficam perto do valor que qualificam.

### Diagnostics Panel

Diagnostico e confianca de coleta devem parecer parte do fluxo de decisao, nao uma area tecnica escondida. Use blocos compactos, contadores fortes e cores por fonte apenas quando a origem muda a interpretacao.

## 6. Do's and Don'ts

### Do:

- **Do** manter a tela tecnica, rapida e premium: pouca ornamentacao, alta legibilidade, decisao acima de explicacao.
- **Do** usar `profit-green` somente para lucro e confirmacao financeira.
- **Do** mostrar fonte, quantidade e idade da ordem perto dos valores de compra/venda.
- **Do** preservar densidade de tabela, mas com alinhamento, pesos e espacos suficientes para escanear.
- **Do** usar ouro como sinal raro de Albion/contexto/foco, nao como banho decorativo.
- **Do** manter cantos pequenos (`4px-8px`) e superficies em camadas discretas.
- **Do** garantir que status nao dependa apenas de cor: labels como privado, publico, offline e erro devem continuar legiveis.

### Don't:

- **Don't** criar painel generico de SaaS com cards intercambiaveis, metricas decorativas e texto de produtividade.
- **Don't** transformar a interface em terminal de negociacao de cripto: sem neon caotico, sem chart-wall, sem roxo futurista como reflexo.
- **Don't** deixar a tela virar planilha feia, raw table dump, admin template ou grade sem hierarquia.
- **Don't** usar fantasia medieval exagerada. Albion deve aparecer por itens, cidades e contexto de mercado, nao por ornamento cosplay.
- **Don't** usar gradiente em texto, glassmorphism decorativo, bokeh/orbs ou bordas laterais coloridas grossas.
- **Don't** usar sombras pesadas para tudo. Se todos os blocos flutuam, a decisao perde gravidade.
- **Don't** usar verde de lucro em estados neutros, filtros ou botoes secundarios.
