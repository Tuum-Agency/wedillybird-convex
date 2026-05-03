from __future__ import annotations

import os
from pathlib import Path


def package_root() -> Path:
    return Path(__file__).resolve().parents[2]


def repo_root() -> Path:
    configured = os.getenv("WEDILLYBIRD_REPO_ROOT")
    if configured:
        return Path(configured).expanduser().resolve()
    return Path(__file__).resolve().parents[4]


def knowledge_root() -> Path:
    return package_root() / "knowledge"


def output_root() -> Path:
    return repo_root() / ".context" / "ai-ops"
