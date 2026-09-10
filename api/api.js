const express = require("express");
const d = require("./db");
const twitch = require("./fontes/twitch");

const app = express.Router();

// centavos -> reais, só na saída. Dentro do sistema é sempre inteiro.
const reais = c => c == null ? null : c / 100;

function formatar(l) {
  return {
    id: l.slug,
    titulo: l.titulo,
    capa: l.capa,
    appid: l.appid,
    loja: l.loja,
    de: reais(l.de),
    por: reais(l.por),
    desconto: l.desconto,
    url: l.url,
    minimo: reais(l.minimo),
    // o selo que diferencia o site de uma lista de descontos
    menorPreco: l.minimo != null && l.por <= l.minimo,
  };
}

/** GET /api/deals?loja=steam&teto=50&busca=elden&ordem=preco&pagina=0 */
app.get("/deals", (req, res) => {
  const { loja, busca, ordem } = req.query;
  const teto = req.query.teto != null ? Math.round(Number(req.query.teto) * 100) : null;
  const pagina = Math.max(0, Number(req.query.pagina) || 0);
  const limite = Math.min(100, Number(req.query.limite) || 60);

  if (teto != null && !Number.isFinite(teto)) {
    return res.status(400).json({ erro: "teto inválido" });
  }

  const linhas = d.listarDeals({
    loja: loja || null,
    teto,
    busca: busca || null,
    ordem: ordem || "desconto",
    limite,
    offset: pagina * limite,
  });

  res.set("Cache-Control", "public, max-age=300");
  res.json({ pagina, limite, itens: linhas.map(formatar) });
});

/** GET /api/gratis */
app.get("/gratis", (req, res) => {
  const linhas = d.listarGratuitos.all(new Date().toISOString());
  res.set("Cache-Control", "public, max-age=120");
  res.json(linhas.map(g => ({
    id: g.slug,
    titulo: g.titulo,
    loja: g.loja,
    de: reais(g.de),
    capa: g.capa,
    url: g.url,
    acaba: g.acaba,          // null = sem prazo; o front mostra "para sempre"
  })));
});

/** GET /api/jogo/:slug — todas as lojas e o histórico */
app.get("/jogo/:slug", (req, res) => {
  const j = d.jogoPorSlug.get(req.params.slug);
  if (!j) return res.status(404).json({ erro: "não encontrado" });

  const ofertas = d.ofertasDoJogo.all(j.id);
  const hist = d.historicoDoJogo.all(j.id);

  res.set("Cache-Control", "public, max-age=300");
  res.json({
    id: j.slug,
    titulo: j.titulo,
    capa: j.capa,
    appid: j.steam_appid,
    ofertas: ofertas.map(o => ({ loja: o.loja, de: reais(o.de), por: reais(o.por), url: o.url })),
    minimo: hist.length ? reais(Math.min(...hist.map(h => h.por))) : null,
    historico: hist.map(h => ({ loja: h.loja, por: reais(h.por), em: h.em })),
  });
});

/** GET /api/live */
app.get("/live", async (req, res) => {
  res.set("Cache-Control", "public, max-age=30");
  res.json(await twitch.status());
});

module.exports = app;
