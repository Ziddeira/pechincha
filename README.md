# Pechincha

Agregador de promoções de jogos de PC com preço em real, destaque para os
gratuitos e integração com a live na Twitch.

    public/           site (servido pelo GitHub Pages)
    public/dados/     JSON gerados pelo robô — não editar à mão
    estatico/         coletor que roda no GitHub Actions
    api/              backend completo, para quando sair do Pages

## Como funciona

O GitHub Actions roda `estatico/gerar.js` de meia em meia hora, busca as
promoções na Steam, GOG e Epic, grava os JSON em `public/dados/` e commita.
O Pages serve o site, que lê esses arquivos. Nenhum servidor no meio.

## Limites deste modelo

- A barra de live atualiza junto com a coleta, não em tempo real
- Sem busca no servidor: o filtro roda no navegador, o que funciona bem
  até algumas centenas de jogos
- O histórico de preço vive em `public/dados/historico.json`

Quando qualquer um desses incomodar, a pasta `api/` já tem o backend
completo com banco — ver [api/README.md](api/README.md).
