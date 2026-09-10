/**
 * Epic Games — os gratuitos semanais, com país BR para o preço cheio vir em real.
 *
 * A resposta mistura promoção ATUAL e PRÓXIMA no mesmo array. Ignorar isso é o
 * erro clássico: o site anuncia como grátis um jogo que só fica grátis semana
 * que vem, a pessoa clica, vê preço cheio e não volta mais.
 */

const URL = "https://store-site-backend-static.ak.epicgames.com/freeGamesPromotions?locale=pt-BR&country=BR&allowCountries=BR";

const centavos = p => (p && typeof p.discountPrice === "number")
  ? p.originalPrice : null;

async function gratuitos() {
  const r = await fetch(URL, { headers: { "User-Agent": "pechincha/1.0" } });
  if (!r.ok) throw new Error(`epic ${r.status}`);
  const d = await r.json();

  const itens = d?.data?.Catalog?.searchStore?.elements || [];
  const agora = Date.now();
  const saida = [];

  for (const e of itens) {
    const promos = e.promotions?.promotionalOffers || [];
    const ofertas = promos.flatMap(p => p.promotionalOffers || []);

    for (const o of ofertas) {
      const inicio = new Date(o.startDate).getTime();
      const fim = new Date(o.endDate).getTime();

      // só o que está valendo AGORA
      if (!(inicio <= agora && agora < fim)) continue;
      // desconto tem que ser de 100%: a Epic usa a mesma estrutura para -30%
      if (o.discountSetting?.discountPercentage !== 0) continue;

      const slug = e.catalogNs?.mappings?.[0]?.pageSlug || e.productSlug || e.urlSlug;
      const capa = (e.keyImages || []).find(i =>
        ["OfferImageWide", "DieselStoreFrontWide", "Thumbnail"].includes(i.type));

      saida.push({
        titulo: e.title,
        loja: "epic",
        de: centavos(e.price?.totalPrice) ?? 0,
        capa: capa ? capa.url : null,
        url: slug ? `https://store.epicgames.com/pt-BR/p/${slug}` : "https://store.epicgames.com/pt-BR/free-games",
        comeca: new Date(inicio).toISOString(),
        acaba: new Date(fim).toISOString(),
      });
    }
  }
  return saida;
}

module.exports = { gratuitos };
