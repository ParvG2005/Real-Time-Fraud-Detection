"""Build a source submission without credentials, caches or development dependencies."""

from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parents[1]
excluded = {
    ".git",
    ".playwright-mcp",
    "node_modules",
    ".venv",
    "__pycache__",
    ".pytest_cache",
    "artifacts",
    "dist",
    "target",
    "test-results",
    "playwright-report",
    ".ruff_cache",
}
output = root / "artifacts" / "fraudshield-ai.zip"
output.parent.mkdir(exist_ok=True)
with ZipFile(output, "w", ZIP_DEFLATED) as archive:
    for p in sorted(root.rglob("*")):
        if not p.is_file():
            continue
        rel = p.relative_to(root)
        if any(part in excluded for part in rel.parts):
            continue
        if p.name.startswith(".env") and p.name != ".env.example":
            continue
        if p.name.endswith((".log", ".tsbuildinfo", ".pyc")) or p.name == ".DS_Store":
            continue
        archive.write(p, Path("fraudshield-ai") / rel)
print("Created artifacts/fraudshield-ai.zip (secrets and dependency folders excluded).")
