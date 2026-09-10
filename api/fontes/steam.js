/**
 * Steam. Endpoints da loja, não da Web API oficial: sem chave, mas sem
 * contrato de estabilidade — se um dia mudarem o formato, é aqui que quebra.
 *
 * Tudo com cc=br, então os valores já vêm em centavos de real. Nada de
 * converter dólar.
 */

const UA = { "User-Agent": "pechincha/1.0 (+contato@seudominio.com.br)" };

// appdetails é limitado a cerca de 200 chamadas a cada 5 min por IP.
// 1,6s entre chamadas deixa margem confortável.
const ESPERA_MS = 1600;
const dormir = ms => new Promise(r => setTimeout(r, ms));

async function json(url) {
  const r = await fetch(url, { headers: UA });
  if (!r.ok) throw new Error(`steam ${r.status} em ${url}`);
  return r.json();
}

/**
 * Promoções em destaque, já com preço brasileiro.
 * Uma chamada traz dezenas de jogos — é o descobridor barato.
 */
async function specials() {
  const d = await json("https://store.steampowered.com/api/featuredcategories?cc=br&l=portuguese");
  const itens = (d.specials && d.specials.items) || [];

  return itens
    .filter(i => i.discounted && i.original_price > 0)
    .map(i => ({
      appid: i.id,
      titulo: i.name,
      de: i.original_price,        // já em centavos
      por: i.final_price,
      capa: i.header_image || i.large_capsule_image || null,
      url: `https://store.steampowered.com/app/${i.id}/?cc=br`,
    }));
}

/**
 * Detalhes de um app: preço BR confiável e a URL de capa correta.
 * Use header_image daqui em vez de montar a URL do CDN: parte do catálogo
 * tem hash no caminho e a URL montada dá 404.
 */
async function detalhes(appid) {
  const d = await json(
    `https://store.steampowered.com/api/appdetails?appids=${appid}&cc=br&l=portuguese&filters=basic,price_overview`);

  const bloco = d[String(appid)];
  if (!bloco || !bloco.success) return null;

  const dados = bloco.data;
  const p = dados.price_overview;

  return {
    appid,
    titulo: dados.name,
    capa: dados.header_image || null,
    gratuito: !!dados.is_free,
    de: p ? p.initial : null,
    por: p ? p.final : null,
    moeda: p ? p.currency : null,     // deve ser BRL; se vier USD, o cc não pegou
    url: `https://store.steampowered.com/app/${appid}/?cc=br`,
  };
}

/** Vários apps em fila, respeitando o limite. */
async function detalhesEmLote(appids, aoResolver) {
  const saida = [];
  for (const id of appids) {
    try {
      const d = await detalhes(id);
      if (d) { saida.push(d); if (aoResolver) aoResolver(d); }
    } catch (e) {
      console.warn(`[steam] appdetails ${id}: ${e.message}`);
    }
    await dormir(ESPERA_MS);
  }
  return saida;
}

module.exports = { specials, detalhes, detalhesEmLote };
