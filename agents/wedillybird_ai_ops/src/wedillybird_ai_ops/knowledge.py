from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, Iterable, List

from wedillybird_ai_ops.paths import knowledge_root, repo_root


CORE_REPO_FILES = [
    "messages/fr.json",
    "BACKLOG.md",
    ".context/wedillybird-ai-team.md",
]


def read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except FileNotFoundError:
        return ""


def load_repo_context(extra_files: Iterable[str] = ()) -> Dict[str, str]:
    root = repo_root()
    files = list(CORE_REPO_FILES) + list(extra_files)
    return {name: read_text(root / name) for name in files}


def load_knowledge_files() -> Dict[str, str]:
    root = knowledge_root()
    return {path.name: read_text(path) for path in sorted(root.glob("*.md"))}


def extract_public_facts() -> List[str]:
    messages_path = repo_root() / "messages" / "fr.json"
    try:
        messages = json.loads(messages_path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return []

    facts = [
        "Wedillybird is a SaaS for wedding organization.",
        "Core product: WhatsApp invitations, RSVP, QR check-in and shared photo gallery.",
    ]
    try:
        faq = messages["Faq"]["questions"]
        facts.append(f"Pricing FAQ: {faq['pricing']['a']}")
        facts.append(f"Offline check-in FAQ: {faq['checkin']['a']}")
        facts.append(f"Gallery FAQ: {faq['gallery']['a']}")
    except KeyError:
        pass
    return facts
