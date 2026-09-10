# Pechincha

Agregador de promoções de jogos de PC com preço em real, destaque para os
gratuitos e integração com a live na Twitch.

    public/     front (protótipo, ainda com dados falsos)
    api/        backend: coletor, banco e rotas

## Rodar

    cd api
    cp .env.example .env
    npm install
    COLETAR_AO_SUBIR=1 npm start

Abre em `http://localhost:3000`. Detalhes das rotas e das decisões de
arquitetura em [api/README.md](api/README.md).

## Estado

- [x] Front: lista, filtros, teto de gasto, contador dos gratuitos, capas
- [x] Backend: coletor Steam/Epic/GOG, histórico de preço, rotas
- [x] Barra de live da Twitch
- [ ] Ligar o front às rotas (hoje usa mock)
- [ ] Páginas por loja para SEO
- [ ] Bot de Discord e Telegram
