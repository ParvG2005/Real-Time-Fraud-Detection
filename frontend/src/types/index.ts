export type User = {
  id: string;
  email: string;
  role: "ADMIN" | "ANALYST" | "VIEWER";
};
export type Transaction = {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  merchantId: string;
  deviceId: string;
  location: string;
  transactionType: string;
  timestamp: string;
  createdAt: string;
  status: string;
  decision: "ALLOW" | "REVIEW" | "BLOCK";
  demo: boolean;
  processingMs: number;
  riskWeights: number[];
  riskLevel: string;
  risk: Record<string, number>;
  features: Record<string, number>;
  factors: string[];
  shapValues: { feature: string; value: number }[];
  shapBaseValue: number;
  modelVersion: string;
  embeddingProvider: string;
  degraded: boolean;
  explanation: {
    summary: string;
    evidence: string[];
    similar_cases: string[];
    recommended_investigation: string[];
    source: string;
    inference: string;
  };
  similarCases: {
    id: string;
    fraudType: string;
    notes: string;
    synthetic: boolean;
    similarity: number;
  }[];
  investigation: null | {
    id: string;
    status: string;
    notes: string;
    created_at: string;
    updated_at: string;
  };
};
export type Rule = {
  id: string;
  name: string;
  feature: string;
  operator: string;
  threshold: number;
  risk_weight: number;
  enabled: boolean;
  description: string;
};
