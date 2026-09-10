/**
 * Versão do coletor para GitHub Actions: escreve JSON em public/dados/
 * em vez de gravar num banco.
 *
 * Roda no Action, commita o resultado, o Pages serve. Sem servidor.
 *
 *   node estatico/gerar.js
 */

const fs = require("fs");
const path = require("path");

const steam = require("../api/fontes/steam");
const epic = require("../api/fontes/epic");
const gog = require("../api/fontes/gog");

const SAIDA = path.join(__dirname, "..", "public", "dados");
const agora = () => new Date().toISOString();

const slug = t => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function ler(arquivo, padrao) {
  try { return JSON.parse(fs.readFileSync(path.join(SAIDA, arquivo), "utf8")); }
  catch { return padrao; }
}

function escrever(arquivo, dados) {
  fs.mkdirSync(SAIDA, { recursive: true });
  // 2 espaços de indentação: o diff do commit fica legível e o git
  // comprime bem. JSON numa linha só vira um diff inútil de milhares de chars.
  fs.writeFileSync(path.join(SAIDA, arquivo), JSON.stringify(dados, null, 2) + "\n");
}

async function main() {
  // uma fonte fora do ar não pode zerar o arquivo: mantém o que já existia
  const [rSteam, rGog, rEpic] = await Promise.allSettled([
    steam.specials(),
    gog.promocoes({ paginas: 2 }),
    epic.gratuitos(),
  ]);

  const anterior = ler("deals.json", { itens: [] });
  const porJogo = new Map();

  function juntar(itens, loja, mapear) {
    for (const i of itens) {
      const m = mapear(i);
      const id = m.id;
      const atual = porJogo.get(id) || { id, titulo: m.titulo, capa: m.capa, appid: m.appid || null, ofertas: [] };
      if (!atual.capa && m.capa) atual.capa = m.capa;
      atual.ofertas.push({ loja, de: m.de / 100, por: m.por / 100, url: m.url });
      porJogo.set(id, atual);
    }
  }

  if (rSteam.status === "fulfilled") {
    juntar(rSteam.value, "steam", i => ({
      id: slug(i.titulo), titulo: i.titulo, capa: i.capa, appid: i.appid,
      de: i.de, por: i.por, url: i.url,
    }));
  } else {
    console.warn("[steam] falhou:", rSteam.reason.message);
  }

  if (rGog.status === "fulfilled") {
    juntar(rGog.value, "gog", i => ({
      id: slug(i.titulo), titulo: i.titulo, capa: i.capa,
      de: i.de, por: i.por, url: i.url,
    }));
  } else {
    console.warn("[gog] falhou:", rGog.reason.message);
  }

  // as duas fontes caíram: preserva o arquivo anterior em vez de publicar vazio
  if (porJogo.size === 0 && anterior.itens.length) {
    console.warn("nenhuma fonte respondeu — mantendo deals.json anterior");
  } else {
    const itens = [...porJogo.values()]
      .map(j => {
        const melhor = j.ofertas.reduce((a, b) => b.por < a.por ? b : a);
        return { ...j, melhor, desconto: Math.round((1 - melhor.por / melhor.de) * 100) };
      })
      .sort((a, b) => b.desconto - a.desconto);

    escrever("deals.json", { atualizado: agora(), itens });
    atualizarHistorico(itens);
  }

  if (rEpic.status === "fulfilled") {
    escrever("gratis.json", {
      atualizado: agora(),
      itens: rEpic.value.map(g => ({
        id: slug(g.titulo), titulo: g.titulo, loja: g.loja,
        de: g.de / 100, capa: g.capa, url: g.url, acaba: g.acaba,
      })),
    });
  } else {
    console.warn("[epic] falhou:", rEpic.reason.message);
  }

  console.log(`ok — ${porJogo.size} jogos`);
}

/** Uma entrada por MUDANÇA de preço. É o que vira "menor preço já visto". */
function atualizarHistorico(itens) {
  const h = ler("historico.json", {});
  const hoje = agora();

  for (const j of itens) {
    const serie = h[j.id] || [];
    const ultimo = serie[serie.length - 1];
    if (!ultimo || ultimo.por !== j.melhor.por || ultimo.loja !== j.melhor.loja) {
      serie.push({ por: j.melhor.por, loja: j.melhor.loja, em: hoje });
    }
    // segura o arquivo: 200 mudanças por jogo já são anos de dado
    h[j.id] = serie.slice(-200);
  }

  escrever("historico.json", h);

  // mínimo por jogo, pré-calculado para o front não precisar do histórico todo
  const minimos = {};
  for (const [id, serie] of Object.entries(h)) {
    minimos[id] = Math.min(...serie.map(s => s.por));
  }
  escrever("minimos.json", minimos);
}

main().catch(e => { console.error(e); process.exit(1); });
