"""Print credentials only when explicitly run by the local demo presenter."""

from pathlib import Path

env = dict(
    line.split("=", 1)
    for line in (Path(__file__).resolve().parents[1] / ".env").read_text().splitlines()
    if line and not line.startswith("#")
)
print("Local demo URL: http://localhost:3000")
print("Email:", env["ADMIN_EMAIL"])
print("Password:", env["ADMIN_PASSWORD"])
