# Pechincha — API

Backend do agregador. Coleta promoções com preço em real, guarda histórico
e serve o que o front consome.

## Subir

    cp .env.example .env      # preencha as credenciais da Twitch
    npm install
    COLETAR_AO_SUBIR=1 npm start

`http://localhost:3000/saude` deve responder. A primeira coleta leva alguns
segundos; o histórico só começa a valer depois de alguns dias rodando.

## Rotas

| Rota | O que devolve |
|---|---|
| `GET /api/deals` | promoções ativas, uma linha por jogo, com o menor preço entre as lojas |
| `GET /api/gratis` | gratuitos com prazo ativo |
| `GET /api/jogo/:slug` | todas as lojas de um jogo + histórico de preço |
| `GET /api/live` | status da live na Twitch, com a oferta do jogo atual |

`/api/deals` aceita `loja`, `teto` (em reais), `busca`, `ordem`
(`desconto`, `preco`, `nome`), `pagina` e `limite`.

## Decisões que valem saber

**Preço em centavos.** Sempre inteiro dentro do sistema; a divisão por 100
acontece só na resposta. Float com dinheiro erra centavo.

**Histórico só grava quando o preço muda.** Coletando de 30 em 30 min e
gravando sempre, seriam ~17 mil linhas por jogo por ano sem informação nova.

**Fonte que falha não apaga dado.** As coletas rodam em `allSettled`. Steam
fora do ar mantém o último preço conhecido, com a data em `oferta.visto`.

**Só lojas com preço brasileiro real.** Steam, Epic e GOG. Fanatical, GMG e
Humble ficam de fora até haver como buscar o valor em real — dólar convertido
mostra preço errado, e o filtro de orçamento torna isso indefensável.

**Twitch casa pelo id da categoria**, nunca pelo nome. Preencha à mão:

    INSERT INTO twitch_categoria (categoria_id, jogo_id, nome)
    VALUES ('1245620', (SELECT id FROM jogo WHERE slug='elden-ring'), 'Elden Ring');

Para achar o id: `GET https://api.twitch.tv/helix/games?name=Elden%20Ring`.

## Ainda falta

- Ligar o front a `/api/deals` e `/api/gratis` (hoje ele usa mock)
- Páginas evergreen por loja, que são o canal de SEO
- Bot de Discord/Telegram lendo `/api/gratis`
- Backup do `dados.db` — é o histórico, e ele não se recupera
