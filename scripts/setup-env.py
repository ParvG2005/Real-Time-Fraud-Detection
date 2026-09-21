"""Generate local secrets once. Never print them to logs."""

from pathlib import Path
import secrets

p = Path(__file__).resolve().parents[1] / ".env"
if not p.exists():
    s = p.with_name(".env.example").read_text()
    s = s.replace(
        "replace-with-at-least-32-random-characters", secrets.token_urlsafe(48)
    )
    while "replace-with-generated-value" in s:
        s = s.replace("replace-with-generated-value", secrets.token_urlsafe(24), 1)
    p.write_text(s)
    p.chmod(0o600)
    print(
        "Created .env with unique local secrets. See ADMIN_EMAIL and ADMIN_PASSWORD to sign in."
    )
else:
    print("Keeping existing .env.")
