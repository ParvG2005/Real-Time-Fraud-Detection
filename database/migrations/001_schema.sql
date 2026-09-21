CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE app_users (id UUID PRIMARY KEY, email VARCHAR(200) UNIQUE NOT NULL, password_hash VARCHAR(100) NOT NULL, role VARCHAR(20) NOT NULL CHECK(role IN ('ADMIN','ANALYST','VIEWER')), created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE users (id VARCHAR(80) PRIMARY KEY, account_created_at TIMESTAMPTZ NOT NULL DEFAULT now(), created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE transactions (
 id UUID PRIMARY KEY, user_id VARCHAR(80) NOT NULL REFERENCES users(id), amount NUMERIC(14,2) NOT NULL CHECK(amount>0),
 currency VARCHAR(3) NOT NULL, merchant_id VARCHAR(80) NOT NULL, device_id VARCHAR(80) NOT NULL,
 ip_hash VARCHAR(64), location VARCHAR(80) NOT NULL, transaction_type VARCHAR(30) NOT NULL,
 timestamp TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), status VARCHAR(20) NOT NULL,
 idempotency_key VARCHAR(100) UNIQUE, request_hash VARCHAR(64), processing_ms BIGINT NOT NULL DEFAULT 0, demo BOOLEAN NOT NULL DEFAULT false);
CREATE INDEX transactions_user_time ON transactions(user_id,timestamp DESC);
CREATE INDEX transactions_created ON transactions(created_at DESC);
CREATE TABLE transaction_features (transaction_id UUID PRIMARY KEY REFERENCES transactions(id), features JSONB NOT NULL);
CREATE TABLE fraud_scores (transaction_id UUID PRIMARY KEY REFERENCES transactions(id), ml_score DOUBLE PRECISION NOT NULL, rule_score DOUBLE PRECISION NOT NULL,
 behavior_score DOUBLE PRECISION NOT NULL, anomaly_score DOUBLE PRECISION NOT NULL, historical_score DOUBLE PRECISION NOT NULL,
 final_score DOUBLE PRECISION NOT NULL CHECK(final_score BETWEEN 0 AND 100), decision VARCHAR(10) NOT NULL,
 model_version VARCHAR(100) NOT NULL, factors JSONB NOT NULL, shap_values JSONB NOT NULL, shap_base_value DOUBLE PRECISION NOT NULL,
 explanation JSONB NOT NULL, similar_cases JSONB NOT NULL, embedding VECTOR(256), embedding_provider VARCHAR(120), degraded BOOLEAN NOT NULL DEFAULT false);
CREATE TABLE fraud_rules (id UUID PRIMARY KEY, name VARCHAR(100) NOT NULL, feature VARCHAR(50) NOT NULL, operator VARCHAR(5) NOT NULL CHECK(operator IN ('GT','EQ','LT')),
 threshold DOUBLE PRECISION NOT NULL, risk_weight DOUBLE PRECISION NOT NULL CHECK(risk_weight BETWEEN 0 AND 100), enabled BOOLEAN NOT NULL DEFAULT true, description VARCHAR(300) NOT NULL);
CREATE TABLE investigations (id UUID PRIMARY KEY, transaction_id UUID NOT NULL UNIQUE REFERENCES transactions(id), assigned_to UUID REFERENCES app_users(id),
 status VARCHAR(30) NOT NULL DEFAULT 'OPEN', notes VARCHAR(4000) NOT NULL DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE model_feedback (id UUID PRIMARY KEY, transaction_id UUID NOT NULL UNIQUE REFERENCES transactions(id), predicted_label VARCHAR(10) NOT NULL,
 actual_label VARCHAR(20) NOT NULL CHECK(actual_label IN ('FRAUD','LEGITIMATE')), analyst_id UUID NOT NULL REFERENCES app_users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE fraud_cases (id UUID PRIMARY KEY, transaction_id UUID UNIQUE REFERENCES transactions(id), fraud_type VARCHAR(100) NOT NULL, confirmed BOOLEAN NOT NULL,
 analyst_id UUID REFERENCES app_users(id), notes VARCHAR(4000) NOT NULL, synthetic BOOLEAN NOT NULL DEFAULT false, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE fraud_embeddings (fraud_case_id UUID PRIMARY KEY REFERENCES fraud_cases(id), embedding VECTOR(256) NOT NULL, provider VARCHAR(120) NOT NULL);
CREATE TABLE audit_logs (id BIGSERIAL PRIMARY KEY, user_id VARCHAR(200) NOT NULL, action VARCHAR(100) NOT NULL, resource_id VARCHAR(100) NOT NULL, timestamp TIMESTAMPTZ NOT NULL DEFAULT now(), metadata JSONB NOT NULL DEFAULT '{}');
