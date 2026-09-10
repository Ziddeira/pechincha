/**
 * Roda periodicamente e é a única parte que escreve preço no banco.
 *
 * Princípio: uma fonte que falha nunca apaga o que já existe. Se a Steam cair,
 * o site continua mostrando o último preço conhecido com a data de "visto",
 * em vez de ficar vazio. Site de promoção vazio é pior do que desatualizado.
 */

const steam = require("./fontes/steam");
const epic = require("./fontes/epic");
const gog = require("./fontes/gog");
const { salvarJogo, salvarOferta, salvarGratuito, db } = require("./db");

let rodando = false;

async function coletarSteam() {
  const itens = await steam.specials();
  let mudou = 0;

  const gravar = db.transaction(lista => {
    for (const i of lista) {
      const jogoId = salvarJogo({ titulo: i.titulo, appid: i.appid, capa: i.capa });
      if (salvarOferta({ jogo_id: jogoId, loja: "steam", de: i.de, por: i.por, url: i.url })) mudou++;
    }
  });

  gravar(itens);
  return { fonte: "steam", itens: itens.length, mudou };
}

async function coletarGog() {
  const itens = await gog.promocoes({ paginas: 2 });
  let mudou = 0;

  const gravar = db.transaction(lista => {
    for (const i of lista) {
      const jogoId = salvarJogo({ titulo: i.titulo, capa: i.capa });
      if (salvarOferta({ jogo_id: jogoId, loja: "gog", de: i.de, por: i.por, url: i.url })) mudou++;
    }
  });

  gravar(itens);
  return { fonte: "gog", itens: itens.length, mudou };
}

async function coletarGratuitos() {
  const itens = await epic.gratuitos();

  const gravar = db.transaction(lista => {
    for (const i of lista) {
      // vincula ao jogo se ele já existir no catálogo; senão fica solto
      const jogoId = salvarJogo({ titulo: i.titulo, capa: i.capa });
      salvarGratuito({ ...i, jogo_id: jogoId });
    }
  });

  gravar(itens);
  return { fonte: "epic-gratis", itens: itens.length, mudou: itens.length };
}

async function coletar() {
  if (rodando) { console.log("[coletor] já em execução, pulando"); return null; }
  rodando = true;
  const t0 = Date.now();

  // allSettled de propósito: uma fonte fora do ar não pode abortar as outras
  const r = await Promise.allSettled([coletarSteam(), coletarGog(), coletarGratuitos()]);

  const relatorio = r.map((x, i) =>
    x.status === "fulfilled"
      ? x.value
      : { fonte: ["steam", "gog", "epic-gratis"][i], erro: x.reason.message });

  rodando = false;
  console.log(`[coletor] ${((Date.now() - t0) / 1000).toFixed(1)}s`, JSON.stringify(relatorio));
  return relatorio;
}

module.exports = { coletar, coletarSteam, coletarGog, coletarGratuitos };

if (require.main === module) {
  coletar().then(() => process.exit(0));
}
