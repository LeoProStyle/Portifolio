# Design — Escritório de Pregão (prédio com 3 salas de robôs)

> Status: rascunho para aprovação · 2026-11-18
> Base: projeto atual `sistema-financeiro` (Fases 1–4 prontas, auditoria AUDIT-2026-11-18).
> Referências visuais: `referencia/Screenshot_20261118_163223.webp` (principal), `..._153855.webp`, `..._153943.webp`.

## 1. Intenção e porquê

O dono do projeto quer uma plataforma **de uso pessoal** para **ver um escritório de pregão em 3D** onde vários robôs operam, cada um com nome, mesa e uma placa mostrando **quanto está ganhando ou perdendo**. Há um painel geral com o resultado do escritório inteiro.

O porquê: **validar robôs em simulação, com rigor, antes de qualquer conta real.** A fase de conta real é uma etapa futura e separada. Ela só começa se a simulação provar, com números honestos, que algum robô merece. Por isso a estrutura tem prioridade sobre o visual: conta por robô, histórico completo, custos realistas, backtest sem look-ahead (usar dado que ainda não existia) e métricas comparadas a um benchmark (referência passiva, ex.: comprar e segurar o índice).

## 2. Objetivos, não-objetivos e anti-objetivos

**Objetivos**
- Prédio com **3 andares/salas**: **Ações B3**, **Criptomoedas**, **Minicontratos B3** (mini-índice e mini-dólar).
- **Vários robôs por sala**, cada um com **conta simulada própria** (caixa, posições, ordens, histórico de patrimônio) e P&L visível.
- **Diretoria** com o **CEO** (o dono) e o **Gerente Geral** (a IA), vendo o consolidado do prédio.
- Robôs rodando sozinhos no horário de cada mercado (agendador), sempre em **paper trading**.
- **Backtest/replay por robô**, com métricas e comparação a benchmark, para decidir quem "passa" para uma futura conta real.
- Visual no nível da referência principal: escritório escuro, filetes de luz dourada com brilho, mesas com vários monitores, placas de P&L flutuando, telão com curva de patrimônio.

**Não-objetivos (fora deste projeto)**
- Enviar ordem real a qualquer corretora ou exchange (regra inviolável nº 1). A estrutura fica pronta para isso, sem implementar.
- **Opções binárias**, nem simuladas (regra nº 2; proibidas pela CVM; a plataforma é a contraparte e controla o preço).
- Operar em segundos ou minutos. A decisão mínima é por **candle de 1h** (seção 10 do CLAUDE.md).
- Multiusuário, login, app mobile, hospedagem na nuvem.
- Usar o MongoDB existente do dono (ver seção 9).

**Anti-objetivos (falharia mesmo "funcionando")**
- P&L inflado por look-ahead, por custos ignorados ou por candle parcial tratado como fechado (achado DATA-001 da auditoria).
- Tela mostrando algo que o banco não comprova. **O 3D é teatro dos dados**; toda placa vem do ledger (o registro contábil das ordens).
- Linguagem de "lucro garantido". A gamificação, se houver, premia disciplina (stop respeitado, bater o benchmark), não ganho.
- Custo de LLM fora de controle por ter dezenas de robôs chamando modelo pago.

## 3. Restrições

- Regras invioláveis do `CLAUDE.md` (1–7) continuam valendo. Em especial: indicadores calculados em código; nada com timestamp maior que o instante simulado; segredos só no `.env`; assets próprios ou de licença livre; sem marcas de terceiros.
- Roda no **PC Windows do dono**, local. Python 3.12 + uv; Node 24; navegador com WebGL.
- **Somente bibliotecas e dados gratuitos.** Os únicos custos são opcionais: API de LLM, com orçamento diário.
- Fontes de dados gratuitas têm limitações. Elas ficam documentadas na tela de resultados (ex.: yfinance é atrasado e não oficial; o minicontrato usa proxy, ver 6.2).

## 4. Abordagens consideradas

| | Abordagem | Prós | Contras |
|---|---|---|---|
| **A (escolhida)** | Evoluir o sistema atual: um backend FastAPI + SQLite com contas por robô, agendador interno e migrações; motor de execução em módulo isolado | Mais rápido de ficar "redondo"; leve no PC; aproveita 104 testes e o contrato existente | Um processo só; a escala é limitada, mas suficiente para uso pessoal |
| B | API e motor separados, PostgreSQL, fila de tarefas, Docker | Mais robusto para dinheiro real | Mais manutenção e Docker no Windows antes de precisar |
| C | Motores prontos por mercado (ex.: Freqtrade para cripto) | Maduros | Três motores e formatos diferentes; unificar P&L por robô vira mais cola do que produto |

**Escolha do dono: A.** O motor fica isolado (`engine/`) para virar B antes da fase de conta real.

## 5. Personagens e papéis

| Personagem | Aparência (decidida pelo dono) | Papel no sistema |
|---|---|---|
| **CEO** (o dono) | Bonequinho **careca, de terno, óculos de lente clara** | Sala da diretoria; vê o consolidado do prédio. Não opera. |
| **Gerente Geral** (a IA) | **Pessoa padrão de terno** | Coordena o escritório: aplica as regras de risco do prédio (pode pausar robô/sala), comenta os resultados e escreve o resumo do dia. Genérico, **sem logo ou marca da Anthropic** (regra 7). |
| **Operadores** (um por robô) | **Pessoas simples**, roupa casual, variações de cabelo/cor | A "cara" de cada robô na mesa; anima conforme o robô analisa, decide e executa. |
| Mesa de Análise IA | Os 4 agentes atuais (Notícias, Gráfico, Risco, Gestor) | Vira **um robô especial** da sala de Ações (o único que usa LLM). |

## 6. Salas (andares)

Cada sala tem: mercado e calendário, moeda, modelo de custos, instrumentos, regras de lote e um benchmark.

### 6.1 Ações B3 (andar 1)
- Instrumentos: os tickers atuais (`PETR4.SA`, `VALE3.SA`, `ITUB4.SA`), ampliáveis por config.
- Dados: yfinance (já existe), candles de 1h e 1d.
- Pregão: 10h–17h BRT em dias úteis, com **feriados da B3**.
- Custos: taxa 0,03% + slippage 0,05% (já existem). Lote fracionário de 1 ação. Só compra (sem venda a descoberto), como hoje.
- Benchmark: `^BVSP` e buy-and-hold do próprio ativo.

### 6.2 Minicontratos B3 (andar 2), no lugar das binárias
- Instrumentos: **mini-índice (WIN)** e **mini-dólar (WDO)**.
- **Dados (limitação declarada):** não há fonte gratuita confiável de série contínua de WIN/WDO.
  - **Proxy do WIN:** `^BVSP` (pontos do índice).
  - **Proxy do WDO:** `USDBRL=X` × 1000.
  - **Diferenças em relação ao contrato real:** não há base (diferença entre o preço do futuro e o do à vista) nem rolagem de vencimento. A tela de resultados avisa isso.
  - **Fase de conta real:** exigirá dados reais de futuros, por exemplo via MT5.
- **Modelo de contrato:**
  - Contratos inteiros.
  - Multiplicador: WIN R$ 0,20/ponto; WDO R$ 10,00/ponto.
  - Custo fixo por contrato (configurável).
  - Margem de garantia simulada por contrato (configurável).
  - **Compra e venda a descoberto permitidas** (normal em derivativos).
- Pregão: horário de derivativos da B3 (configurável), com feriados.
- Benchmark: buy-and-hold de 1 contrato de WIN.

### 6.3 Criptomoedas (andar 3)
- Instrumentos: `BTC/USDT`, `ETH/USDT`, `SOL/USDT` (configurável).
- Dados: **dados públicos de exchange via ccxt** (biblioteca MIT, sem chave de API). Exchange padrão: Binance (configurável).
- Mercado 24/7; decisões em candles de 1h/4h/1d.
- Custos: taxa 0,1% + slippage configurável. **Quantidade fracionária** (decimal). Só compra (sem short) nesta etapa.
- Moeda da conta: USDT. O consolidado em BRL converte por `USDBRL=X`, com a cotação **do instante simulado**, sem look-ahead.
- Benchmark: buy-and-hold de BTC.

## 7. Robôs

**Robô = estratégia + parâmetros + instrumento(s) + capital inicial + conta simulada + personagem + mesa.**

- **Estratégias determinísticas, em código e sem custo** (a maioria dos robôs):

| Nome | Ideia |
|---|---|
| Cruzamento de médias | Compra quando a média curta cruza a longa para cima |
| Reversão por IFR | Compra em sobrevenda, vende na volta |
| Rompimento (Donchian) | Compra quando o preço rompe a máxima de N períodos |
| Tendência com ATR | Segue a tendência com stop móvel por ATR |

- Sinais e indicadores saem de `indicators/technical.py` (regra 4). Novas estratégias entram como plugins com a mesma interface.
- **Robô "Mesa de Análise IA":** reaproveita o grafo LangGraph atual (Notícias ∥ Gráfico → Gestor → Risco → Gestor). É o único que chama LLM e tem **orçamento diário próprio** (`MAX_COST_PER_DAY`, que hoje não é aplicado: achado SEC-003).
- **Risco em dois níveis, sempre em código:**
  - **Por robô:** as regras atuais (1% de risco por operação, 20% de exposição, stop por ATR, perda diária de 3%), adaptadas por sala. Exemplo: margem e contrato inteiro nos minicontratos.
  - **Do escritório (Gerente Geral):** limite de perda diária por sala e do prédio, exposição máxima por instrumento somando todos os robôs, botão "pausar sala" e "pausar tudo". Se um limite é atingido, os robôs da sala param até o próximo dia.
- **Configuração inicial (escolha minha, ajustável):** Ações com 4 robôs + a Mesa IA; Minicontratos com 3; Cripto com 4. Capital inicial: R$ 100 mil por robô em Ações/Minis e 20 mil USDT em Cripto.
- Cadastro de robôs: por arquivo de configuração versionado (YAML) nesta etapa. Uma tela de cadastro fica para depois.

## 8. Execução, agendamento e backtest

- **Motor (`engine/`):**
  - Para cada robô ativo, no **fechamento** de cada candle do seu timeframe, busca os dados completos até o instante, calcula o sinal, aplica o risco e envia a ordem à conta simulada.
  - A execução acontece na **abertura do próximo candle**, como no PaperBroker atual.
  - Corrige DATA-001 antes: candle incompleto nunca é gravado como completo.
- **Agendador:** APScheduler (MIT), dentro do processo. Respeita o calendário de cada sala; Cripto roda 24/7.
- **PC ou backend desligado (decidido pelo dono: recuperar ao ligar):**
  - Cada robô guarda um cursor persistido (último candle processado).
  - Ao religar, o motor percorre os candles perdidos **em ordem**, usando só dados até cada instante, como um replay curto, antes de voltar ao ritmo normal.
  - O processamento é idempotente: o mesmo candle nunca gera duas decisões.
  - O histórico fica contínuo e conta para os "3 meses de simulação ao vivo".
  - A Mesa IA também recupera, mas sem notícias antigas indisponíveis. Se o orçamento diário de LLM acabar no meio da recuperação, ela registra "sem análise" naquele candle e não opera.
- **Limite do escritório batido ou "pausar" (decidido pelo dono):**
  - **Só bloqueia ordens novas** até o dia seguinte.
  - As posições abertas continuam, com seus stops ativos.
  - O "dia" é meia-noite de Brasília para todas as salas, inclusive Cripto.
- **Replay/backtest:**
  - Roda **qualquer robô** num período, com o relógio simulado (`SimulatedClock` já existe).
  - **Separado do "ao vivo"** pelo identificador da execução (`run_id`, achado DATA-006).
  - **Métricas:** retorno, drawdown máximo (maior queda do pico ao vale), taxa de acerto, fator de lucro (ganhos ÷ perdas), nº de operações, custos pagos, comparação com o benchmark e custo de LLM.
  - O aviso de limitação do CLAUDE.md §10 aparece na tela de resultados.
- **Timeframe do backtest:** o do próprio robô. Robôs de Ações e Minis usam **candle diário** por padrão, porque o yfinance só guarda cerca de 730 dias de candles de 1h e os horários da B3 vêm irregulares. Cripto pode usar 1h.
- **Mesa IA fora do backtest:** não há notícias históricas, o LLM "conhece" o passado e o custo seria alto. Ela é avaliada **só pela simulação ao vivo**.
- **Configuração versionada:** cada execução grava o hash da configuração do robô. Mudar parâmetro, instrumento ou capital no YAML **abre uma nova execução (`run_id`)**, com conta nova, e reinicia a contagem dos "3 meses". O histórico anterior fica guardado para comparação.
- **Critério para um robô ser "candidato a conta real"** (só sinalização, sem ação):
  - pelo menos 3 meses de simulação ao vivo **com a mesma configuração**, e backtest de 2 anos (exceto Mesa IA);
  - bate o benchmark depois dos custos;
  - drawdown máximo dentro de um teto configurável.

## 9. Dados e persistência

- **SQLite continua** (local, transacional, sem servidor), com:
  - **Alembic** para migrações (achado DATA-007);
  - modo **WAL** (escrita sem travar leitura);
  - valores monetários em **Decimal/Numeric** (achado DATA-008).
- **Por que não MongoDB:** os dados existentes do dono são de outros projetos (nada a importar). Carteira e ordens precisam de transações atômicas. E evita passar credenciais. Na fase de conta real, o caminho previsto é **PostgreSQL**.
- **Entidades novas ou mudadas:** sala, instrumento, robô, conta (`account_id`), execução (`run_id`), ordem e preenchimento (fill) com `account_id`/`run_id`, histórico de patrimônio por conta, eventos com `robot_id` e sala.
- **Retenção do log de eventos:** configurável, para o banco não crescer sem limite (achado DATA-012).

## 10. API e eventos

- REST: `/api/building` (consolidado do prédio), `/api/rooms`, `/api/rooms/{room}/robots`, `/api/robots/{id}` (posições, ordens, curva de patrimônio, métricas), `/api/robots/{id}/backtest`, `/api/robots/{id}/pause|resume`, além das rotas atuais.
- WebSocket: os eventos atuais ganham `room` e `robot_id`. Entram eventos de P&L por robô e de pausa/limite do escritório.
- **Tipos TypeScript gerados do OpenAPI/JSON Schema** do backend, não mais copiados à mão (achado ARCH-005).
- Segurança local antes de tudo: `Host`/`Origin` validados (achado SEC-001).

## 11. Interface

**Navegação:** um HUD (barra fixa no topo da tela) como na referência principal.

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ ESCRITÓRIO · [Diretoria] [Ações] [Minis] [Cripto]   Hoje +R$ 1.234 ▲      │
│ Patrimônio total R$ 412.876,52   Fechados | Abertos | Ambos   ● simulado  │
├──────────────────────────────────────────────────────────────────────────┤
│                 (sala 3D do andar selecionado)          ┌──────────────┐ │
│   [ATLAS +R$ 106]   [SCALPER −R$ 330]                    │ painel do    │ │
│      mesa+monitores     mesa+monitores                   │ robô clicado │ │
│   [ORION +R$ 205]   [MESA IA +R$ 12]     telão: curva    │ posições,    │ │
│                                          de patrimônio   │ ordens, IA   │ │
│                                                          └──────────────┘ │
├──────────────────────────────────────────────────────────────────────────┤
│ Simulação educacional. Não é recomendação de investimento.               │
└──────────────────────────────────────────────────────────────────────────┘
```

- **Mesa IA no 3D:** continua com os 4 bonecos atuais (Notícias, Gráfico, Risco, Gestor) numa ilha própria do andar de Ações, reaproveitando a máquina de estados e o director atuais.
- **Diretoria:** sala do CEO (careca, terno, óculos claros), com o Gerente Geral ao lado; telão com o patrimônio de cada andar e o ranking dos robôs.
- **Andares:** escritório escuro com filetes dourados com brilho (bloom via `@react-three/postprocessing`, MIT), mesas pretas com 2–3 monitores cuja tela mostra a mini-curva do robô, operador sentado, placa flutuante **nome + P&L** (verde/vermelho), telão com a curva de patrimônio da sala.
- **Interação:** zoom e arrastar com limites; **clique no robô abre o painel lateral**, que reaproveita os painéis atuais (gráfico com marcadores, indicadores, notícias, linha do tempo com o raciocínio, carteira).
- **Modelos:** low-poly feitos em código (primitivas arredondadas). Pacotes CC0 (ex.: Kenney/Quaternius) são opcionais, verificando a licença de cada pacote. Sem marcas na cena.
- **Desempenho:** até cerca de 20 robôs por andar; geometria repetida via instancing (desenhar várias cópias do mesmo objeto numa chamada só).
- **Acessibilidade:** em cada andar, uma **tabela de robôs em texto** (nome, estratégia, P&L do dia e total, status) com o mesmo conteúdo do 3D; modo de movimento reduzido.
- **Gráficos:** melhorias da auditoria (ARCH-007) entram no painel do robô: volume, legenda OHLC no cursor, formato pt-BR, zoom preservado, linhas de preço médio e stop, painel de IFR/MACD.

## 12. Custos

| Item | Custo |
|---|---|
| Bibliotecas (Three.js, R3F, postprocessing, ccxt, APScheduler, Alembic, lightweight-charts) | Gratuitas (MIT/Apache) |
| Dados (yfinance, dados públicos de exchange via ccxt) | Gratuitos (com limitações declaradas) |
| LLM | Só a Mesa de Análise IA e o resumo do Gerente Geral. Opcional, com teto diário. Com `LLM_PROVIDER=mock`, custo zero |

## 13. Preparação para conta real (não implementada aqui)

- A interface `Broker` ganha uma implementação simulada **por sala** (ações, minis, cripto). As reais (B3 via MT5 no Windows; cripto via API de exchange) ficam **apenas descritas**, atrás de `LIVE_TRADING_ENABLED=false` e confirmação manual, conforme a regra 1.
- **Antes da fase real** (decisão futura do dono):
  - migrar para a abordagem B (motor separado + PostgreSQL);
  - dados reais de futuros;
  - auditoria de segurança e controle de credenciais;
  - revisão regulatória e tributária.

## 14. Ordem sugerida de construção

| Etapa | Entrega visível |
|---|---|
| 0. Correções da auditoria | DATA-001, ARCH-001, SEC-001, WAL, Alembic |
| 1. Domínio multi-robô | Salas, robôs, conta por robô, P&L por robô via API; sala de Ações com 2 robôs simples rodando em mock |
| 2. Estratégias + agendador | 4 estratégias; robôs rodando sozinhos no horário; Gerente Geral aplicando limites do prédio |
| 3. Backtest e métricas | Backtest por robô, comparação com benchmark, tela de resultados |
| 4. Escritório 3D v2 | HUD, andares, CEO, Gerente Geral, operadores, placas de P&L, bloom, painel do robô, tabela acessível |
| 5. Sala de Minicontratos | WIN/WDO com contratos, margem, short e proxy declarado |
| 6. Sala de Cripto | ccxt, 24/7, quantidade decimal, USDT→BRL |
| 7. Mesa IA com LLM real | Provedor real, orçamento aplicado, cache, debate (Fase 5 original) |
| 8. Polimento | Gráficos (2ª leva), sons, exportar CSV, ranking/conquistas |

O `CLAUDE.md` é atualizado na etapa 0 para o novo escopo (3 salas, multi-robô, minicontratos no lugar das binárias, ccxt, Alembic).

## 15. Deixado para quem constrói

- Geometria exata dos personagens e cores finas (seguindo as aparências da seção 5 e a paleta escuro + dourado).
- Parâmetros padrão de cada estratégia, valores de custo/margem dos minicontratos e horários exatos, desde que configuráveis.
- Nomes dos robôs.
- Estrutura interna de pastas, desde que o motor fique isolado em `engine/`.

## 16. Escolhas feitas por mim (para o dono revisar)

1. Minicontratos com **proxy** (`^BVSP` e `USDBRL=X`) e short permitido; cripto só compra.
2. Robôs cadastrados por **arquivo YAML** nesta etapa, sem tela de cadastro.
3. Capital inicial: R$ 100 mil por robô (Ações/Minis) e 20 mil USDT (Cripto); quantidade de robôs por sala como na seção 7.
4. A Mesa IA é o único robô com LLM; o Gerente Geral usa LLM só no resumo do dia (opcional).
5. Ordem de construção: estrutura (0–3) antes do visual novo (4).
6. Critério de "candidato a conta real" da seção 8.
7. Backtest em candle diário para Ações e Minis; 1h permitido em Cripto.
8. Mesa IA fora do backtest de 2 anos; avaliada só ao vivo.
9. Mudança de configuração do robô abre nova execução e reinicia a contagem.
10. Mesa IA mantém os 4 bonecos atuais no andar de Ações.

**Decidido pelo dono na revisão:** recuperar candles perdidos ao religar; limite batido só bloqueia ordens novas (posições e stops continuam); "dia" = meia-noite de Brasília.
