from __future__ import annotations

from pathlib import Path
from typing import Iterable

from wedillybird_ai_ops.schemas import ContentPack, WeeklyGrowthPlan


def _lines(items: Iterable[str]) -> str:
    return "\n".join(f"- {item}" for item in items)


def render_weekly_plan(plan: WeeklyGrowthPlan) -> str:
    plan.validate()
    calendar = "\n".join(
        f"| {day.day} | {day.channel} | {day.asset} | {day.angle} |"
        for day in plan.content_calendar
    )
    blockers = _lines(plan.approval.blockers) if plan.approval.blockers else "- None"
    return f"""# Weekly Growth Plan - {plan.week}

Goal: {plan.goal}

## Priorities

{_lines(plan.priorities)}

## Content Calendar

| Day | Channel | Asset | Angle |
|---|---|---|---|
{calendar}

## Experiments

{_lines(plan.experiments)}

## Partnership Actions

{_lines(plan.partnership_actions)}

## Landing / Product Actions

{_lines(plan.landing_actions)}

## Risks

{_lines(plan.risks)}

## Human Approval

Status: {plan.approval.status}

Checklist:

{_lines(plan.approval.checklist)}

Blockers:

{blockers}
"""


def render_content_pack(pack: ContentPack) -> str:
    pack.validate()

    def render_posts(title: str, posts) -> str:
        sections = [f"## {title}"]
        for index, post in enumerate(posts, start=1):
            notes = _lines(post.guardrail_notes) if post.guardrail_notes else "- None"
            sections.append(
                f"""### {index}. {post.title}

Channel: {post.channel}
Status: {post.approval_status}

{post.body}

CTA: {post.cta}

Guardrail notes:

{notes}
"""
            )
        return "\n".join(sections)

    briefs = []
    for index, brief in enumerate(pack.seo_briefs, start=1):
        briefs.append(
            f"""### {index}. {brief.title}

Intent: {brief.intent}

Outline:

{_lines(brief.outline)}

Internal links:

{_lines(brief.internal_links)}
"""
        )

    blockers = _lines(pack.approval.blockers) if pack.approval.blockers else "- None"
    rendered_briefs = "\n".join(briefs)
    return f"""# Content Pack - {pack.theme}

Audience: {pack.audience}

{render_posts("LinkedIn", pack.linkedin_posts)}

{render_posts("Instagram", pack.instagram_posts)}

{render_posts("Short Video Scripts", pack.short_video_scripts)}

## Newsletter

Subject options:

{_lines(pack.newsletter_subjects)}

{pack.newsletter_body}

## SEO Briefs

{rendered_briefs}

## Human Approval

Status: {pack.approval.status}

Checklist:

{_lines(pack.approval.checklist)}

Blockers:

{blockers}
"""


def write_markdown(path: Path, content: str) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    return path
