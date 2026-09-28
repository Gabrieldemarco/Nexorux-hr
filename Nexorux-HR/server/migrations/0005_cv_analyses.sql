-- CV Analysis Results Table
-- Stores extracted and classified CV data from PDF uploads

CREATE TABLE IF NOT EXISTS cv_analyses (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  job_opening_id TEXT NOT NULL,
  candidate_id TEXT,
  original_filename TEXT NOT NULL,
  extracted_text TEXT NOT NULL,
  classification TEXT NOT NULL CHECK (classification IN ('elegible', 'descartado')),
  reasoning TEXT NOT NULL,
  nombre TEXT,
  correo TEXT,
  telefono TEXT,
  anos_experiencia REAL,
  habilidades_tecnicas TEXT,  -- JSON array
  educacion_superior TEXT,
  match_score REAL DEFAULT 0,  -- 0-100 compatibility score
  missing_requirements TEXT,   -- JSON array
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (job_opening_id) REFERENCES job_openings(id) ON DELETE CASCADE,
  FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_cv_analyses_job ON cv_analyses(tenant_id, job_opening_id);
CREATE INDEX IF NOT EXISTS idx_cv_analyses_candidate ON cv_analyses(candidate_id);
CREATE INDEX IF NOT EXISTS idx_cv_analyses_classification ON cv_analyses(classification);