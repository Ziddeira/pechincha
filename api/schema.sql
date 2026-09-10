-- Preços em CENTAVOS (inteiro). Float com dinheiro acumula erro de
-- arredondamento e um dia o total sai com um centavo a menos.

CREATE TABLE IF NOT EXISTS jogo (
  id           INTEGER PRIMARY KEY,
  titulo       TEXT NOT NULL,
  slug         TEXT NOT NULL UNIQUE,
  steam_appid  INTEGER UNIQUE,          -- null para exclusivos de Epic/GOG
  capa         TEXT,                    -- header_image vindo do appdetails
  atualizado   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS oferta (
  jogo_id      INTEGER NOT NULL REFERENCES jogo(id) ON DELETE CASCADE,
  loja         TEXT NOT NULL,           -- steam | epic | gog
  de           INTEGER NOT NULL,        -- preço cheio, em centavos
  por          INTEGER NOT NULL,        -- preço atual, em centavos
  url          TEXT NOT NULL,
  visto        TEXT NOT NULL,           -- último momento em que a fonte confirmou
  PRIMARY KEY (jogo_id, loja)
);

-- Uma linha por MUDANÇA de preço, não por coleta. Coletando de 30 em 30 min,
-- gravar sempre daria ~17 mil linhas por jogo por ano sem informação nova.
CREATE TABLE IF NOT EXISTS historico (
  id       INTEGER PRIMARY KEY,
  jogo_id  INTEGER NOT NULL REFERENCES jogo(id) ON DELETE CASCADE,
  loja     TEXT NOT NULL,
  por      INTEGER NOT NULL,
  em       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hist ON historico(jogo_id, loja, em);

CREATE TABLE IF NOT EXISTS gratuito (
  id       INTEGER PRIMARY KEY,
  jogo_id  INTEGER REFERENCES jogo(id) ON DELETE SET NULL,
  titulo   TEXT NOT NULL,               -- guardado à parte: nem todo grátis vira jogo
  loja     TEXT NOT NULL,
  de       INTEGER NOT NULL,
  capa     TEXT,
  url      TEXT NOT NULL,
  comeca   TEXT,
  acaba    TEXT,                        -- null = resgate sem prazo
  UNIQUE (titulo, loja, acaba)
);

-- Categoria da Twitch -> jogo. Preenchida à mão, uma linha por jogo.
-- Casar pelo nome erra em silêncio ("GTA V" x "Grand Theft Auto V").
CREATE TABLE IF NOT EXISTS twitch_categoria (
  categoria_id  TEXT PRIMARY KEY,
  jogo_id       INTEGER REFERENCES jogo(id) ON DELETE CASCADE,
  nome          TEXT
);

-- Alimenta o selo "joguei este ao vivo", que funciona com você offline
CREATE TABLE IF NOT EXISTS live_log (
  id            INTEGER PRIMARY KEY,
  categoria_id  TEXT,
  jogo_id       INTEGER REFERENCES jogo(id) ON DELETE SET NULL,
  titulo        TEXT,
  em            TEXT NOT NULL
);
