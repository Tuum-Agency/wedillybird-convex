from __future__ import annotations

from dataclasses import dataclass, field
from typing import Iterable, List


def _require_items(name: str, values: Iterable[str], minimum: int = 1) -> List[str]:
    items = [value.strip() for value in values if value and value.strip()]
    if len(items) < minimum:
        raise ValueError(f"{name} must contain at least {minimum} item(s)")
    return items


@dataclass(frozen=True)
class ApprovalGate:
    required: bool = True
    status: str = "needs_human_review"
    checklist: List[str] = field(default_factory=list)
    blockers: List[str] = field(default_factory=list)

    def validate(self) -> None:
        if self.required and self.status == "approved":
            raise ValueError("automatic approval is not allowed")
        _require_items("approval checklist", self.checklist)


@dataclass(frozen=True)
class DayPlan:
    day: str
    channel: str
    asset: str
    angle: str
    owner: str = "AI Ops"

    def validate(self) -> None:
        _require_items("day plan", [self.day, self.channel, self.asset, self.angle, self.owner])


@dataclass(frozen=True)
class WeeklyGrowthPlan:
    week: str
    goal: str
    priorities: List[str]
    content_calendar: List[DayPlan]
    experiments: List[str]
    partnership_actions: List[str]
    landing_actions: List[str]
    risks: List[str]
    approval: ApprovalGate

    def validate(self) -> None:
        _require_items("priorities", self.priorities, minimum=3)
        if len(self.content_calendar) != 7:
            raise ValueError("content_calendar must contain exactly 7 days")
        for day in self.content_calendar:
            day.validate()
        _require_items("experiments", self.experiments)
        _require_items("partnership_actions", self.partnership_actions)
        _require_items("landing_actions", self.landing_actions)
        _require_items("risks", self.risks)
        self.approval.validate()


@dataclass(frozen=True)
class SocialPost:
    channel: str
    title: str
    body: str
    cta: str
    approval_status: str = "draft_needs_review"
    guardrail_notes: List[str] = field(default_factory=list)

    def validate(self) -> None:
        _require_items("social post", [self.channel, self.title, self.body, self.cta])
        if self.approval_status == "approved":
            raise ValueError("social posts cannot be auto-approved")


@dataclass(frozen=True)
class SeoBrief:
    title: str
    intent: str
    outline: List[str]
    internal_links: List[str]

    def validate(self) -> None:
        _require_items("seo brief", [self.title, self.intent])
        _require_items("outline", self.outline, minimum=3)
        _require_items("internal_links", self.internal_links)


@dataclass(frozen=True)
class ContentPack:
    theme: str
    audience: str
    linkedin_posts: List[SocialPost]
    instagram_posts: List[SocialPost]
    short_video_scripts: List[SocialPost]
    newsletter_subjects: List[str]
    newsletter_body: str
    seo_briefs: List[SeoBrief]
    approval: ApprovalGate

    def validate(self) -> None:
        _require_items("content pack", [self.theme, self.audience, self.newsletter_body])
        if len(self.linkedin_posts) < 5:
            raise ValueError("content pack must contain at least 5 LinkedIn posts")
        if len(self.instagram_posts) < 5:
            raise ValueError("content pack must contain at least 5 Instagram posts")
        if len(self.short_video_scripts) < 3:
            raise ValueError("content pack must contain at least 3 short video scripts")
        _require_items("newsletter_subjects", self.newsletter_subjects, minimum=3)
        if len(self.seo_briefs) < 2:
            raise ValueError("content pack must contain at least 2 SEO briefs")
        for item in self.linkedin_posts + self.instagram_posts + self.short_video_scripts:
            item.validate()
        for brief in self.seo_briefs:
            brief.validate()
        self.approval.validate()
