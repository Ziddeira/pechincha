/**
 * GOG — catálogo com desconto, preço em real.
 *
 * A GOG devolve preço como string ("R$ 39,99" ou "39.99" conforme o campo),
 * então tudo passa por uma normalização antes de virar centavos. Preço vindo
 * como string é a origem mais comum de erro de um centavo em site de preço.
 */

const BASE = "https://catalog.gog.com/v1/catalog";

function paraCentavos(v) {
  if (v == null) return null;
  if (typeof v === "number") return Math.round(v * 100);
  const limpo = String(v).replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
  const n = Number.parseFloat(limpo);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

async function promocoes({ paginas = 2 } = {}) {
  const saida = [];

  for (let p = 1; p <= paginas; p++) {
    const url = `${BASE}?limit=48&page=${p}&countryCode=BR&locale=pt-BR&currencyCode=BRL`
      + `&discounted=eq:true&order=desc:discount&productType=in:game`;

    const r = await fetch(url, { headers: { "User-Agent": "pechincha/1.0" } });
    if (!r.ok) throw new Error(`gog ${r.status}`);
    const d = await r.json();

    for (const p of d.products || []) {
      const de = paraCentavos(p.price?.baseMoney?.amount ?? p.price?.base);
      const por = paraCentavos(p.price?.finalMoney?.amount ?? p.price?.final);
      if (de == null || por == null || por >= de) continue;

      saida.push({
        titulo: p.title,
        loja: "gog",
        de, por,
        capa: p.coverHorizontal || p.screenshots?.[0] || null,
        url: p.storeLink || `https://www.gog.com/pt/game/${p.slug}`,
      });
    }

    if (!d.products || d.products.length < 48) break;
  }
  return saida;
}

module.exports = { promocoes, paraCentavos };
