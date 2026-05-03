from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable, List

from wedillybird_ai_ops.drafts import build_content_pack
from wedillybird_ai_ops.guardrails import APPROVAL_CHECKLIST, approval_blockers
from wedillybird_ai_ops.schemas import ContentPack, SocialPost


SUPPORTED_PLATFORMS = {"linkedin", "instagram", "tiktok"}
DEFAULT_SOCIAL_PLATFORMS = ("instagram", "tiktok")
APPROVABLE_STATUSES = {"needs_human_review", "revision_requested"}
PUBLISHABLE_STATUSES = {"approved"}


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _slug(value: str) -> str:
    normalized = "".join(ch.lower() if ch.isalnum() else "-" for ch in value)
    return "-".join(part for part in normalized.split("-") if part) or "campaign"


@dataclass
class SocialCampaignItem:
    id: str
    platform: str
    format: str
    title: str
    copy: str
    cta: str
    media_brief: str
    video_prompt: str = ""
    approval_status: str = "needs_human_review"
    guardrail_notes: List[str] = field(default_factory=list)
    approved_by: str = ""
    approved_at: str = ""
    published_at: str = ""
    platform_post_id: str = ""

    def validate(self) -> None:
        if self.platform not in SUPPORTED_PLATFORMS:
            raise ValueError(f"unsupported platform: {self.platform}")
        required = [self.id, self.platform, self.format, self.title, self.copy, self.cta, self.media_brief]
        if any(not value.strip() for value in required):
            raise ValueError(f"social campaign item {self.id} has empty required fields")
        if self.approval_status == "approved" and not self.approved_by:
            raise ValueError(f"social campaign item {self.id} is approved without approver")


@dataclass
class SocialCampaignQueue:
    campaign_id: str
    theme: str
    audience: str
    created_at: str
    items: List[SocialCampaignItem]
    checklist: List[str] = field(default_factory=lambda: list(APPROVAL_CHECKLIST))
    publication_enabled: bool = False

    def validate(self) -> None:
        if not self.campaign_id.strip() or not self.theme.strip():
            raise ValueError("campaign queue requires campaign_id and theme")
        if not self.items:
            raise ValueError("campaign queue requires at least one item")
        for item in self.items:
            item.validate()

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "SocialCampaignQueue":
        items = [SocialCampaignItem(**item) for item in data.get("items", [])]
        queue = cls(
            campaign_id=data["campaign_id"],
            theme=data["theme"],
            audience=data["audience"],
            created_at=data["created_at"],
            items=items,
            checklist=list(data.get("checklist", APPROVAL_CHECKLIST)),
            publication_enabled=bool(data.get("publication_enabled", False)),
        )
        queue.validate()
        return queue

    def approve(self, item_id: str, approved_by: str) -> None:
        if not approved_by.strip():
            raise ValueError("approved_by is required")
        item = self.find_item(item_id)
        if item.approval_status not in APPROVABLE_STATUSES:
            raise ValueError(f"item {item_id} cannot be approved from status {item.approval_status}")
        if item.guardrail_notes:
            raise ValueError(f"item {item_id} has guardrail blockers and needs revision")
        item.approval_status = "approved"
        item.approved_by = approved_by
        item.approved_at = utc_now()

    def request_revision(self, item_id: str, reason: str) -> None:
        item = self.find_item(item_id)
        item.approval_status = "revision_requested"
        if reason.strip():
            item.guardrail_notes.append(reason.strip())

    def find_item(self, item_id: str) -> SocialCampaignItem:
        for item in self.items:
            if item.id == item_id:
                return item
        raise ValueError(f"unknown item id: {item_id}")


def item_from_post(
    *,
    campaign_id: str,
    index: int,
    platform: str,
    post: SocialPost,
    post_format: str,
    media_brief: str,
    video_prompt: str = "",
) -> SocialCampaignItem:
    copy = post.body.strip()
    return SocialCampaignItem(
        id=f"{campaign_id}-{platform}-{index:02d}",
        platform=platform,
        format=post_format,
        title=post.title,
        copy=copy,
        cta=post.cta,
        media_brief=media_brief,
        video_prompt=video_prompt,
        guardrail_notes=approval_blockers(copy),
    )


def build_social_campaign_queue(
    theme: str,
    audience: str,
    campaign_id: str | None = None,
    content_pack: ContentPack | None = None,
    platforms: Iterable[str] = DEFAULT_SOCIAL_PLATFORMS,
) -> SocialCampaignQueue:
    pack = content_pack or build_content_pack(theme=theme, audience=audience)
    pack.validate()
    resolved_campaign_id = campaign_id or _slug(theme)
    selected_platforms = tuple(dict.fromkeys(platform.strip().lower() for platform in platforms))
    unknown_platforms = set(selected_platforms) - SUPPORTED_PLATFORMS
    if unknown_platforms:
        raise ValueError(f"unsupported platforms: {', '.join(sorted(unknown_platforms))}")

    items: List[SocialCampaignItem] = []

    if "linkedin" in selected_platforms:
        for index, post in enumerate(pack.linkedin_posts, start=1):
            items.append(
                item_from_post(
                    campaign_id=resolved_campaign_id,
                    index=index,
                    platform="linkedin",
                    post=post,
                    post_format="text_image",
                    media_brief="Create one sober product-led visual or founder photo crop. No fake metrics.",
                )
            )

    if "instagram" in selected_platforms:
        for index, post in enumerate(pack.short_video_scripts, start=1):
            items.append(
                item_from_post(
                    campaign_id=resolved_campaign_id,
                    index=index,
                    platform="instagram",
                    post=post,
                    post_format="reel_or_story",
                    media_brief="Create a 9:16 Instagram Reel/Story with captions, clean UI shots and no licensed music.",
                    video_prompt=(
                        "Vertical Instagram wedding SaaS ad. Show WhatsApp invitation, RSVP confirmation, "
                        "QR check-in and shared gallery as refined interface moments. Avoid real personal data."
                    ),
                )
            )

    if "tiktok" in selected_platforms:
        for index, post in enumerate(pack.short_video_scripts, start=1):
            items.append(
                item_from_post(
                    campaign_id=resolved_campaign_id,
                    index=index,
                    platform="tiktok",
                    post=post,
                    post_format="vertical_video_or_slides",
                    media_brief="Create a 9:16 TikTok video or photo-mode slideshow with captions and no licensed music.",
                    video_prompt=(
                        "Vertical TikTok wedding operations SaaS ad. Show WhatsApp invitation, RSVP confirmation, "
                        "QR check-in and shared gallery as clean interface moments. Avoid real personal data."
                    ),
                )
            )

    queue = SocialCampaignQueue(
        campaign_id=resolved_campaign_id,
        theme=theme,
        audience=audience,
        created_at=utc_now(),
        items=items,
    )
    queue.validate()
    return queue


def save_queue(queue: SocialCampaignQueue, path: Path) -> Path:
    queue.validate()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(queue.to_dict(), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return path


def load_queue(path: Path) -> SocialCampaignQueue:
    return SocialCampaignQueue.from_dict(json.loads(path.read_text(encoding="utf-8")))


def render_queue_markdown(queue: SocialCampaignQueue) -> str:
    queue.validate()
    sections = [
        f"# Social Approval Queue - {queue.campaign_id}",
        "",
        f"Theme: {queue.theme}",
        f"Audience: {queue.audience}",
        f"Created: {queue.created_at}",
        f"Publication enabled: {queue.publication_enabled}",
        "",
        "## Approval Checklist",
        "",
    ]
    sections.extend(f"- {item}" for item in queue.checklist)
    sections.append("")
    sections.append("## Items")
    for item in queue.items:
        blockers = "\n".join(f"- {note}" for note in item.guardrail_notes) or "- None"
        sections.append(
            f"""
### {item.id}

Platform: {item.platform}
Format: {item.format}
Status: {item.approval_status}
Title: {item.title}

Copy:

{item.copy}

CTA: {item.cta}

Media brief:

{item.media_brief}

Video prompt:

{item.video_prompt or "N/A"}

Guardrail notes:

{blockers}
"""
        )
    return "\n".join(sections).strip() + "\n"


def approved_items(items: Iterable[SocialCampaignItem]) -> List[SocialCampaignItem]:
    return [item for item in items if item.approval_status in PUBLISHABLE_STATUSES]
