const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");

const db = new Database(process.env.DB_PATH || path.join(__dirname, "dados.db"));

db.pragma("journal_mode = WAL");   // leitura não trava durante a coleta
db.pragma("foreign_keys = ON");
db.exec(fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8"));

const agora = () => new Date().toISOString();

const slugificar = t => t
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/* ---------------- jogos ---------------- */

const acharPorApp = db.prepare("SELECT * FROM jogo WHERE steam_appid = ?");
const acharPorSlug = db.prepare("SELECT * FROM jogo WHERE slug = ?");

const inserirJogo = db.prepare(`
  INSERT INTO jogo (titulo, slug, steam_appid, capa, atualizado)
  VALUES (@titulo, @slug, @appid, @capa, @agora)`);

const atualizarJogo = db.prepare(`
  UPDATE jogo SET titulo = @titulo, capa = COALESCE(@capa, capa), atualizado = @agora
  WHERE id = @id`);

function salvarJogo({ titulo, appid = null, capa = null }) {
  let j = appid ? acharPorApp.get(appid) : null;
  if (!j) {
    // sem app id (exclusivo de Epic/GOG) o slug é a única chave estável
    const slugBase = slugificar(titulo);
    j = acharPorSlug.get(slugBase);
    if (!j) {
      const r = inserirJogo.run({ titulo, slug: slugBase, appid, capa, agora: agora() });
      return r.lastInsertRowid;
    }
  }
  atualizarJogo.run({ id: j.id, titulo, capa, agora: agora() });
  return j.id;
}

/* ---------------- ofertas e histórico ---------------- */

const ofertaAtual = db.prepare("SELECT por FROM oferta WHERE jogo_id = ? AND loja = ?");

const gravarOferta = db.prepare(`
  INSERT INTO oferta (jogo_id, loja, de, por, url, visto)
  VALUES (@jogo_id, @loja, @de, @por, @url, @visto)
  ON CONFLICT(jogo_id, loja) DO UPDATE SET
    de = @de, por = @por, url = @url, visto = @visto`);

const gravarHistorico = db.prepare(
  "INSERT INTO historico (jogo_id, loja, por, em) VALUES (?, ?, ?, ?)");

function salvarOferta(o) {
  const anterior = ofertaAtual.get(o.jogo_id, o.loja);
  gravarOferta.run({ ...o, visto: agora() });
  // só registra quando o valor muda de fato
  if (!anterior || anterior.por !== o.por) {
    gravarHistorico.run(o.jogo_id, o.loja, o.por, agora());
    return true;
  }
  return false;
}

/* ---------------- consultas da API ---------------- */

/**
 * Promoções ativas, já com o menor preço por jogo e o mínimo histórico.
 * Filtro e ordenação ficam no SQL: paginar em memória quebra quando o
 * catálogo cresce.
 */
function listarDeals({ loja = null, teto = null, busca = null, ordem = "desconto", limite = 60, offset = 0 }) {
  const cond = ["o.por < o.de"];
  const p = {};

  if (loja)  { cond.push("o.loja = @loja"); p.loja = loja; }
  if (teto != null) { cond.push("o.por <= @teto"); p.teto = teto; }
  if (busca) { cond.push("j.titulo LIKE @busca"); p.busca = `%${busca}%`; }

  // uma linha por jogo: a oferta mais barata entre as lojas que passaram no filtro
  const ordenacao = {
    desconto: "desconto DESC",
    preco: "por ASC",
    nome: "titulo COLLATE NOCASE ASC",
  }[ordem] || "desconto DESC";

  return db.prepare(`
    WITH melhores AS (
      SELECT o.jogo_id, o.loja, o.de, o.por, o.url,
             ROW_NUMBER() OVER (PARTITION BY o.jogo_id ORDER BY o.por ASC) AS rn
      FROM oferta o
      JOIN jogo j ON j.id = o.jogo_id
      WHERE ${cond.join(" AND ")}
    )
    SELECT j.id, j.titulo, j.slug, j.capa, j.steam_appid AS appid,
           m.loja, m.de, m.por, m.url,
           CAST(ROUND((1.0 - CAST(m.por AS REAL) / m.de) * 100) AS INTEGER) AS desconto,
           (SELECT MIN(por) FROM historico h WHERE h.jogo_id = j.id) AS minimo
    FROM melhores m
    JOIN jogo j ON j.id = m.jogo_id
    WHERE m.rn = 1
    ORDER BY ${ordenacao}
    LIMIT @limite OFFSET @offset
  `).all({ ...p, limite, offset });
}

const ofertasDoJogo = db.prepare(`
  SELECT loja, de, por, url FROM oferta WHERE jogo_id = ? ORDER BY por ASC`);

const jogoPorSlug = db.prepare("SELECT * FROM jogo WHERE slug = ?");

const historicoDoJogo = db.prepare(`
  SELECT loja, por, em FROM historico WHERE jogo_id = ? ORDER BY em ASC`);

const listarGratuitos = db.prepare(`
  SELECT g.*, j.slug FROM gratuito g
  LEFT JOIN jogo j ON j.id = g.jogo_id
  WHERE g.acaba IS NULL OR g.acaba > ?
  ORDER BY (g.acaba IS NULL), g.acaba ASC`);

const salvarGratuito = db.prepare(`
  INSERT INTO gratuito (jogo_id, titulo, loja, de, capa, url, comeca, acaba)
  VALUES (@jogo_id, @titulo, @loja, @de, @capa, @url, @comeca, @acaba)
  ON CONFLICT(titulo, loja, acaba) DO UPDATE SET
    de = @de, capa = COALESCE(@capa, capa), url = @url, jogo_id = COALESCE(@jogo_id, jogo_id)`);

/* ---------------- twitch ---------------- */

const jogoDaCategoria = db.prepare(`
  SELECT j.id, j.slug, j.titulo FROM twitch_categoria t
  JOIN jogo j ON j.id = t.jogo_id WHERE t.categoria_id = ?`);

const registrarLive = db.prepare(`
  INSERT INTO live_log (categoria_id, jogo_id, titulo, em) VALUES (?, ?, ?, ?)`);

const ultimaLive = db.prepare(`
  SELECT l.*, j.slug FROM live_log l LEFT JOIN jogo j ON j.id = l.jogo_id
  ORDER BY l.em DESC LIMIT 1`);

module.exports = {
  db, agora, slugificar,
  salvarJogo, salvarOferta, listarDeals, ofertasDoJogo, jogoPorSlug, historicoDoJogo,
  listarGratuitos, salvarGratuito,
  jogoDaCategoria, registrarLive, ultimaLive,
};
