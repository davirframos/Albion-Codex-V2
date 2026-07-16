# Albion Codex V2

Ferramenta local para Albion Online focada em uma mecanica: comprar no mercado normal de Caerleon e vender imediatamente para a melhor buy order do Black Market.

## Sobre o projeto

Ferramenta de arbitragem de mercado em tempo real para o jogo Albion Online. Monitora continuamente as ordens de compra/venda entre duas pracas do mercado do jogo e calcula automaticamente oportunidades de lucro, aplicando taxas reais de venda.

**Stack:** Node.js, WebSocket (dados em tempo real), SQLite (persistencia local), integracao com API REST publica e NATS (streaming de eventos de mercado), arquitetura local-first (API + web + banco, tudo rodando na maquina do usuario sem depender de servidor externo).

**Destaques tecnicos:** ingestao de dados via dois canais (snapshot REST + stream NATS), calculo de margem liquida considerando taxas de mercado, diagnostico automatizado de ambiente (`npm run doctor`), e suporte a multiplos servidores do jogo via variavel de ambiente.

O projeto roda somente na maquina local por padrao. A API escuta em `127.0.0.1`, a web tambem abre em `127.0.0.1`, e os dados coletados ficam em um SQLite local dentro da pasta `db/`.

## Requisitos

- Windows 10/11
- Node.js `22.5.0` ou mais novo
- npm, que ja vem com o Node.js
- Albion Online instalado
- Opcional: Albion Data Client, para captura local privada

Para conferir a versao do Node:

```powershell
node --version
npm --version
```

Se o Node for antigo, instale uma versao recente em:

```text
https://nodejs.org/
```

## Instalacao limpa

Abra um PowerShell na pasta do projeto.

Exemplo:

```powershell
cd "C:\caminho\para\albion-codex\V2"
```

Instale as dependencias da API e da web:

```powershell
npm run setup
```

Se preferir rodar passo a passo:

```powershell
npm install
npm --prefix apps/web install
```

Depois, rode o diagnostico:

```powershell
npm run doctor
```

O diagnostico avisa se falta Node correto, dependencia instalada ou arquivo essencial.

## Como rodar

Use dois terminais, ambos abertos na pasta `V2`.

Terminal 1, API:

```powershell
npm run dev:api
```

Terminal 2, Web:

```powershell
npm run dev:web
```

Abra no navegador:

```text
http://127.0.0.1:5174
```

Enderecos locais:

- Web: `http://127.0.0.1:5174`
- API: `http://127.0.0.1:3867`
- Health check: `http://127.0.0.1:3867/health`
- WebSocket: `ws://127.0.0.1:3867/ws`

## Albion Data Client privado

Esta parte e opcional, mas melhora a qualidade dos dados porque envia para a API local as ordens vistas no seu client.

Com a API ligada, rode o Albion Data Client apontando para:

```text
http://127.0.0.1:3867/api/private
```

Se o executavel estiver instalado no caminho padrao:

```powershell
& "C:\Program Files\Albion Data Client\albiondata-client.exe" -i "http://127.0.0.1:3867/api/private"
```

Se voce esta dentro da pasta do executavel:

```powershell
.\albiondata-client.exe -i "http://127.0.0.1:3867/api/private"
```

Endpoints aceitos pela ingestao local:

- `GET /api/private/status`
- `POST /api/private/market-orders`
- `POST /api/private/market-histories`
- `POST /api/private/marketorders.ingest`
- `POST /api/private/markethistories.ingest`

Somente `Caerleon` (`3003`) e `Black Market` (`3005`) entram na base da V2.

## Variaveis de configuracao

Os defaults ja funcionam para rodar localmente:

```text
PORT=3867
WEB_ORIGIN=http://127.0.0.1:5174
ALBION_SERVER=west
SALES_TAX_RATE=0.08
MIN_PROFIT=0
MIN_MARGIN_PCT=0
MAX_AGE_MINUTES=120
MIN_QUANTITY=1
MARKET_ORDER_STALE_HOURS=6
MARKET_ORDERS_ENABLED=true
REQUIRE_REAL_ORDER_QUANTITIES=true
```

Para mudar uma variavel no PowerShell antes de ligar a API:

```powershell
$env:ALBION_SERVER="europe"
npm run dev:api
```

Servidores aceitos em `ALBION_SERVER`:

- `west`
- `east`
- `europe`

## Limpar dados coletados

Para apagar os dados locais e comecar do zero:

1. Pare a API com `Ctrl+C`.
2. Apague apenas os arquivos SQLite gerados:

```powershell
Remove-Item .\db\albion-codex-v2.sqlite*
```

3. Ligue a API de novo:

```powershell
npm run dev:api
```

Pode apagar:

- `db/albion-codex-v2.sqlite`
- `db/albion-codex-v2.sqlite-shm`
- `db/albion-codex-v2.sqlite-wal`

Nao apague:

- `db/schema.sql`
- `package.json`
- `package-lock.json`
- `apps/`

O catalogo de itens e recriado automaticamente quando a API sobe.

## Como funciona o calculo

```text
quantity = min(caerleon offer amount, black market request amount)
totalCost = caerleon unit price * quantity
grossRevenue = black market unit price * quantity
revenueAfterTax = grossRevenue - round(grossRevenue * salesTaxRate)
netProfit = revenueAfterTax - totalCost
marginPct = netProfit / totalCost * 100
```

O default de `SALES_TAX_RATE=0.08` segue a taxa de venda do mercado. A taxa de ordem de 2.5% aparece ao criar pedido de venda/compra; esta V2 calcula a mecanica de vender imediatamente para buy orders do Black Market.

## Dados usados

A API usa duas fontes:

- REST publico do Albion Data Project para um snapshot inicial.
- NATS publico `marketorders.deduped` para atualizacoes de ordens.
- Ingestao privada local do Albion Data Client, quando configurada.

As credenciais NATS usadas sao as publicas do Albion Data Project. Nao coloque tokens, senhas ou arquivos `.env` privados no projeto antes de compartilhar.

## Problemas comuns

Se a web mostrar que a API esta offline:

```powershell
npm run dev:api
```

Se `npm run dev:web` falhar dizendo que `vite` nao foi encontrado:

```powershell
npm --prefix apps/web install
```

Se aparecer aviso sobre SQLite experimental, isso vem do `node:sqlite`. Use Node.js `22.5.0` ou mais novo.

Se a porta `3867` ja estiver em uso:

```powershell
$env:PORT="3868"
npm run dev:api
```

Neste caso, a web atual ainda espera a API em `3867`, entao prefira liberar a porta `3867` para o uso normal.

## Comandos uteis

```powershell
npm run doctor
npm test
npm run build:web
npm run dev:api
npm run dev:web
```
