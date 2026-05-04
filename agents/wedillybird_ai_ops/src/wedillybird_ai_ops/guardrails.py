from __future__ import annotations

import re
from typing import Iterable, List


APPROVAL_CHECKLIST = [
    "No public claim without source or internal proof.",
    "No invented testimonial, customer logo or usage number.",
    "No personal guest data used for marketing.",
    "No automatic social, email or DM publication.",
    "No pricing or legal promise changed by an agent.",
]


_CLAIM_PATTERNS = [
    re.compile(r"\b\d+[,.]?\d*\s?%"),
    re.compile(r"\b\d+\s?(x|fois)\b", re.IGNORECASE),
    re.compile(r"\bplus de\s+\d+", re.IGNORECASE),
    re.compile(r"\b\d+\s?(mariages|clients|utilisateurs|invites)\b", re.IGNORECASE),
    re.compile(r"\b(test[eé]e?|mesur[eé]e?|prouv[eé]e?)\b", re.IGNORECASE),
]


def detect_public_claims(text: str) -> List[str]:
    claims: List[str] = []
    for line in text.splitlines():
        normalized = line.strip()
        if not normalized:
            continue
        if any(pattern.search(normalized) for pattern in _CLAIM_PATTERNS):
            claims.append(normalized)
    return claims


def approval_blockers(text: str, sourced_claims: Iterable[str] = ()) -> List[str]:
    sourced = {claim.strip() for claim in sourced_claims if claim.strip()}
    blockers = []
    for claim in detect_public_claims(text):
        if claim not in sourced:
            blockers.append(f"Source required before publication: {claim}")
    return blockers
