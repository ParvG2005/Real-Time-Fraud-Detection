ALTER TABLE fraud_scores ADD COLUMN risk_weights JSONB NOT NULL DEFAULT '[0.35,0.20,0.25,0.10,0.10]'::jsonb;
