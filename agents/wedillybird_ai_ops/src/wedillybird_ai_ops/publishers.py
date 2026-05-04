from __future__ import annotations

import os
from dataclasses import dataclass
from typing import List

from wedillybird_ai_ops.social import SocialCampaignItem, SocialCampaignQueue, approved_items, utc_now


@dataclass(frozen=True)
class PublishResult:
    item_id: str
    platform: str
    status: str
    message: str


class DryRunPublisher:
    def publish(self, item: SocialCampaignItem) -> PublishResult:
        return PublishResult(
            item_id=item.id,
            platform=item.platform,
            status="dry_run",
            message=f"Would publish {item.format} to {item.platform}: {item.title}",
        )


def publication_enabled() -> bool:
    return os.getenv("WEDILLYBIRD_AI_PUBLICATION_ENABLED", "0") == "1"


def publish_approved(queue: SocialCampaignQueue, live: bool = False) -> List[PublishResult]:
    queue.validate()
    items = approved_items(queue.items)
    if not items:
        return [
            PublishResult(
                item_id="none",
                platform="none",
                status="skipped",
                message="No approved items to publish.",
            )
        ]

    if live:
        if not publication_enabled() or not queue.publication_enabled:
            raise PermissionError(
                "Live publication is disabled. Keep WEDILLYBIRD_AI_PUBLICATION_ENABLED=0 until "
                "OAuth, audit logs and human approval UI are configured."
            )
        raise NotImplementedError("Live platform publishers are not wired yet; use dry-run.")

    publisher = DryRunPublisher()
    results = [publisher.publish(item) for item in items]
    for item in items:
        item.published_at = utc_now()
    return results


def render_publish_results(results: List[PublishResult]) -> str:
    lines = ["# Publish Results", ""]
    for result in results:
        lines.append(f"- `{result.status}` {result.platform}/{result.item_id}: {result.message}")
    return "\n".join(lines) + "\n"
