import os
import math
from pathlib import Path
from psycopg_pool import ConnectionPool
from psycopg.rows import dict_row
import redis
import httpx

pool = ConnectionPool(
    conninfo="",
    kwargs=dict(
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", "5432")),
        dbname=os.getenv("DB_NAME", "fraudshield"),
        user=os.getenv("DB_USER", "fraudshield"),
        password=os.environ["DB_PASSWORD"],
        row_factory=dict_row,
    ),
    min_size=2,
    max_size=12,
    open=False,
)
cache = redis.Redis(
    host=os.getenv("REDIS_HOST", "localhost"),
    decode_responses=True,
    socket_connect_timeout=0.5,
    socket_timeout=0.5,
)
ml = httpx.Client(
    base_url=os.getenv("ML_URL", "http://localhost:8000"),
    headers={"X-Service-Token": os.environ["ML_SERVICE_TOKEN"]},
    timeout=3,
)
jwt_secret = os.environ["JWT_SECRET"]
if len(jwt_secret) < 32:
    raise RuntimeError("JWT_SECRET must have at least 32 characters")
demo_enabled = os.getenv("DEMO_ENABLED", "false").lower() == "true"
weights = [
    float(x) for x in os.getenv("RISK_WEIGHTS", "0.35,0.20,0.25,0.10,0.10").split(",")
]
if (
    len(weights) != 5
    or any(not math.isfinite(x) or x < 0 for x in weights)
    or abs(sum(weights) - 1) > 1e-6
):
    raise RuntimeError("Five non-negative risk weights must sum to 1")


def migrate():
    pool.open(wait=True)
    with pool.connection() as conn:
        conn.execute("SELECT pg_advisory_xact_lock(91001)")
        conn.execute(
            "CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT now())"
        )
        folder = (
            Path("/app/migrations")
            if Path("/app/migrations").exists()
            else Path(__file__).resolve().parents[2] / "database/migrations"
        )
        for file in sorted(folder.glob("*.sql")):
            if not conn.execute(
                "SELECT 1 FROM schema_migrations WHERE version=%s", (file.name,)
            ).fetchone():
                conn.execute(file.read_text())
                conn.execute(
                    "INSERT INTO schema_migrations(version) VALUES(%s)", (file.name,)
                )
