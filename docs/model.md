# Model card — synthetic-xgb-v1

## Intended use

An educational/interview prototype demonstrating a hybrid detection pipeline. Not validated for real lending authorization, creditworthiness, identity fraud classification, or decisions about real people.

## Training and evaluation

`ml-service/training/train.py` deterministically generates 18,000 synthetic examples (seed 42). Amounts are lognormal; rare behavioral changes affect device, city, velocity and failed attempts. Labels are sampled probabilistically from a nonlinear synthetic risk relationship, creating class overlap. Synthetic fraud prevalence is about 11%; it does **not** estimate real prevalence.

A stratified 60/20/20 split produces 10,800 training, 3,600 validation and 3,600 test examples. Candidate XGBoost depths 3 and 5 are evaluated using validation PR-AUC. The selected model is evaluated once on the untouched test partition. Class weighting uses only training counts. No feedback labels, predictions, or post-decision values enter model features.

Artifacts: XGBoost UBJ model, Isolation Forest joblib artifact, measured `metrics.json`. Training runs during the ML Docker image build. The model artifact is trusted local build output, not an uploaded pickle. API `/analytics/model` serves the exact measured report.

Observed results from the reproducible initial build:

| Metric | Value |
|---|---:|
| Precision | 0.8883 |
| Recall | 0.8838 |
| F1 | 0.8861 |
| PR-AUC | 0.9285 |
| ROC-AUC | 0.9779 |
| False positive rate | 0.01373 |
| False negative rate | 0.11616 |
| True negatives / false positives | 3160 / 44 |
| False negatives / true positives | 46 / 350 |

These are **synthetic holdout results**, not operational guarantees. Current generated metrics are authoritative if model code or dependencies change. XGBoost outputs are not independently calibrated to real-world fraud probabilities; class weighting and artificial prevalence limit such an interpretation.

## Features

Amount; legitimate-history mean; amount ratio; previous requests in 5 minutes, 1 hour, 24 hours; unrecognized device; new city; recent blocked requests; account age; prior analyst-confirmed fraud count; night-time flag (00:00–05:59 Asia/Kolkata).

The online service computes these from PostgreSQL and Redis. Clients cannot send model features to the public transaction API. The private ML endpoint strictly validates types, ranges and finite numbers.

Isolation Forest is fit to legitimate training examples only. Its score is mapped to a percentile relative to the legitimate training-score distribution. Anomaly percentile is **not** probability of fraud.

## Explanation and retrieval

XGBoost `pred_contribs=True` computes exact TreeSHAP contributions for the model. Values are in log-odds. Sum(feature contributions) + base = model margin; applying the logistic function reconstructs the prediction. Tests verify this identity.

Local retrieval embeds structured, identifier-free pattern text using scikit-learn `HashingVectorizer`, 256 dimensions, word unigrams/bigrams and L2 normalization. pgvector returns the five most similar confirmed cases, filtered by provider and minimum cosine similarity of 0.55. This is lexical vector similarity; no claim of neural semantic understanding is made.

Local explanation templates cite captured factors and disclose their source. Optional Bedrock uses structured evidence after the decision commits; JSON fields are validated and observed evidence is overwritten from server facts. Generated narratives remain untrusted aids to analysts. LLMs never set scores or decisions.

## Policy and monitoring

Weights 0.35/0.20/0.25/0.10/0.10 combine ML/rules/behavior/anomaly/history. These are prototype choices. A weighted score is not a calibrated probability. Missing ML forces at least REVIEW. Missing similarity contributes zero and is disclosed. Similarity is evaluated before aggregation so historical evidence is available to the final calculation, resolving an ordering ambiguity in the spec.

Model monitoring separates held-out training metrics from counts on the **selected analyst-reviewed subset**. Feature-mean standardized shifts describe the recent 500 records versus training means. They are not statistical drift alarms. No protected attributes are collected, so fairness across demographic groups has not been established.

Human labels can be exported as JSONL with original features/model version. They are not automatically used to retrain or modify live thresholds. Production work would need representative data, temporal/user-level validation, cost-sensitive threshold calibration, subgroup audits, monitoring, a model registry, durable jobs and rollback controls.

References: [XGBoost contribution API](https://xgboost.readthedocs.io/en/release_3.0.0/python/python_api.html), [Titan embeddings](https://docs.aws.amazon.com/bedrock/latest/userguide/titan-embedding-models.html).
