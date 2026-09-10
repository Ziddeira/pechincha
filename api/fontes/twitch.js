/**
 * Status da live. Mesma lógica do rascunho anterior, agora com o mapeamento de
 * categoria e o histórico no banco em vez da memória do processo — reiniciar o
 * servidor não pode apagar a última live.
 */

const d = require("../db");

const CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;
const LOGIN = (process.env.TWITCH_LOGIN || "").toLowerCase();
const CACHE_MS = 60_000;

let token = null;
let cache = { em: 0, dados: null };

async function pegarToken(forcar = false) {
  if (!forcar && token && Date.now() < token.expiraEm) return token.valor;

  const r = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID, client_secret: CLIENT_SECRET, grant_type: "client_credentials",
    }),
  });
  if (!r.ok) throw new Error(`token twitch: ${r.status}`);

  const j = await r.json();
  token = { valor: j.access_token, expiraEm: Date.now() + (j.expires_in - 300) * 1000 };
  return token.valor;
}

async function helix(caminho, jaTentou = false) {
  const t = await pegarToken();
  const r = await fetch(`https://api.twitch.tv/helix${caminho}`, {
    headers: { "Client-Id": CLIENT_ID, Authorization: `Bearer ${t}` },
  });
  if (r.status === 401 && !jaTentou) { await pegarToken(true); return helix(caminho, true); }
  if (!r.ok) throw new Error(`helix ${caminho}: ${r.status}`);
  return r.json();
}

function offline() {
  const u = d.ultimaLive.get();
  return {
    aoVivo: false,
    canal: LOGIN,
    ultimaLive: u ? { categoria: u.titulo, jogoId: u.slug || null, em: u.em } : null,
  };
}

async function consultar() {
  if (!CLIENT_ID || !CLIENT_SECRET || !LOGIN) return offline();

  const j = await helix(`/streams?user_login=${encodeURIComponent(LOGIN)}`);
  const s = j.data && j.data[0];
  if (!s) return offline();

  // casa pelo id da categoria, nunca pelo nome
  const jogo = s.game_id ? d.jogoDaCategoria.get(String(s.game_id)) : null;
  d.registrarLive.run(String(s.game_id || ""), jogo ? jogo.id : null,
                      s.game_name || null, new Date().toISOString());

  let oferta = null;
  if (jogo) {
    const o = d.ofertasDoJogo.all(jogo.id)[0];
    if (o) oferta = { loja: o.loja, por: o.por / 100, url: o.url };
  }

  return {
    aoVivo: true,
    canal: LOGIN,
    titulo: s.title,
    categoria: s.game_name || null,
    categoriaId: s.game_id || null,
    jogoId: jogo ? jogo.slug : null,   // null: mostra "ao vivo" sem preço
    oferta,
    espectadores: s.viewer_count,
    desde: s.started_at,
  };
}

async function status() {
  try {
    if (Date.now() - cache.em > CACHE_MS) {
      cache = { em: Date.now(), dados: await consultar() };
    }
    return cache.dados;
  } catch (e) {
    console.error("[twitch]", e.message);
    return { ...offline(), degradado: true };   // a barra nunca derruba o site
  }
}

module.exports = { status, consultar };
