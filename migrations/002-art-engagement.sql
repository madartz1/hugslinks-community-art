-- Apply to the isolated preview database first. Production needs explicit release approval.
CREATE TABLE IF NOT EXISTS hugs_art_appreciations (
 artwork_id text NOT NULL,
 voter_hash text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (artwork_id, voter_hash)
);
CREATE TABLE IF NOT EXISTS hugs_art_reports (
 id uuid PRIMARY KEY,
 artwork_id text NOT NULL,
 artwork_title text NOT NULL,
 artist_name text NOT NULL,
 reporter_hash text NOT NULL,
 report_day date NOT NULL DEFAULT CURRENT_DATE,
 category text NOT NULL CHECK (category IN ('rights','harmful','privacy','other')),
 details text NOT NULL CHECK (char_length(details) BETWEEN 10 AND 1000),
 status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewed','dismissed')),
 admin_note text NOT NULL DEFAULT '',
 version integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(),
 reviewed_at timestamptz,
 UNIQUE (artwork_id, reporter_hash, report_day)
);
CREATE INDEX IF NOT EXISTS hugs_art_reports_queue_idx ON hugs_art_reports(status, created_at DESC);
