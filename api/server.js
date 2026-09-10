require("dotenv").config();

const express = require("express");
const cron = require("node-cron");
const path = require("path");
const { coletar } = require("./coletor");

const app = express();
app.disable("x-powered-by");

app.use("/api", require("./api"));

// o front estático do mesmo processo; troque por nginx ou CDN quando crescer
app.use(express.static(path.join(__dirname, "public"), { maxAge: "1h" }));

app.get("/saude", (req, res) => res.json({ ok: true, em: new Date().toISOString() }));

const PORTA = process.env.PORT || 3000;

app.listen(PORTA, () => {
  console.log(`[api] http://localhost:${PORTA}`);

  // de 30 em 30 minutos. Mais frequente que isso não muda quase nada:
  // promoção da Steam entra em bloco, não a cada minuto.
  cron.schedule(process.env.CRON || "*/30 * * * *", coletar);

  if (process.env.COLETAR_AO_SUBIR === "1") coletar();
});
