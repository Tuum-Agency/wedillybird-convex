from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

from dotenv import load_dotenv

from wedillybird_ai_ops.budget import build_launch_budget_plan, render_launch_budget_plan
from wedillybird_ai_ops.drafts import build_content_pack, build_weekly_growth_plan, default_week
from wedillybird_ai_ops.media import provider_from_name
from wedillybird_ai_ops.paths import output_root
from wedillybird_ai_ops.publishers import publish_approved, render_publish_results
from wedillybird_ai_ops.renderer import render_content_pack, render_weekly_plan, write_markdown
from wedillybird_ai_ops.social import (
    build_social_campaign_queue,
    load_queue,
    render_queue_markdown,
    save_queue,
)


def _slug(value: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", value.strip().lower()).strip("-")
    return slug or "draft"


def run_weekly_growth(args: argparse.Namespace) -> Path:
    plan = build_weekly_growth_plan(week=args.week, goal=args.goal)
    path = output_root() / "weekly" / f"{args.week}.md"
    return write_markdown(path, render_weekly_plan(plan))


def run_content_factory(args: argparse.Namespace) -> Path:
    pack = build_content_pack(theme=args.theme, audience=args.audience)
    path = output_root() / "content" / f"{_slug(args.theme)}.md"
    return write_markdown(path, render_content_pack(pack))


def run_social_campaign(args: argparse.Namespace) -> Path:
    campaign_id = args.campaign_id or _slug(args.theme)
    platforms = [platform.strip() for platform in args.platforms.split(",") if platform.strip()]
    queue = build_social_campaign_queue(
        theme=args.theme,
        audience=args.audience,
        campaign_id=campaign_id,
        platforms=platforms,
    )
    queue_path = output_root() / "approvals" / f"{campaign_id}.json"
    save_queue(queue, queue_path)
    write_markdown(queue_path.with_suffix(".md"), render_queue_markdown(queue))

    provider = provider_from_name(args.video_provider)
    media_dir = output_root() / "media" / campaign_id
    for item in queue.items:
        if item.platform in {"instagram", "tiktok"} or item.format in {
            "vertical_video_or_slides",
            "carousel_or_slides",
            "reel_or_story",
        }:
            provider.create_brief(item, media_dir)
    return queue_path


def run_approve_item(args: argparse.Namespace) -> Path:
    queue_path = Path(args.queue).expanduser().resolve()
    queue = load_queue(queue_path)
    queue.approve(item_id=args.item_id, approved_by=args.approved_by)
    save_queue(queue, queue_path)
    write_markdown(queue_path.with_suffix(".md"), render_queue_markdown(queue))
    return queue_path


def run_publish_approved(args: argparse.Namespace) -> Path:
    queue_path = Path(args.queue).expanduser().resolve()
    queue = load_queue(queue_path)
    results = publish_approved(queue, live=args.live)
    save_queue(queue, queue_path)
    result_path = output_root() / "publishing" / f"{queue.campaign_id}-results.md"
    return write_markdown(result_path, render_publish_results(results))


def run_launch_budget(args: argparse.Namespace) -> Path:
    plan = build_launch_budget_plan(
        total_budget_eur=args.total_budget_eur,
        max_monthly_budget_eur=args.max_monthly_budget_eur,
        days=args.days,
        video_provider=args.video_provider,
        video_count=args.video_count,
        video_duration_seconds=args.video_duration_seconds,
    )
    path = output_root() / "budget" / "instagram-tiktok-launch-budget.md"
    return write_markdown(path, render_launch_budget_plan(plan))


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="wedillybird-ai")
    subparsers = parser.add_subparsers(dest="command", required=True)

    weekly = subparsers.add_parser("weekly-growth", help="Generate a weekly growth plan draft.")
    weekly.add_argument("--week", default=default_week(), help="ISO week, for example 2026-W19.")
    weekly.add_argument(
        "--goal",
        default="Preparer le lancement marketing de Wedillybird.",
        help="Business goal for the week.",
    )
    weekly.set_defaults(func=run_weekly_growth)

    content = subparsers.add_parser("content-factory", help="Generate a safe content pack draft.")
    content.add_argument("--theme", required=True, help="Content theme.")
    content.add_argument(
        "--audience",
        default="Couples qui organisent leur mariage et wedding planners francophones.",
        help="Target audience.",
    )
    content.set_defaults(func=run_content_factory)

    social = subparsers.add_parser(
        "social-campaign",
        help="Generate a social approval queue plus media briefs. Defaults to Instagram and TikTok.",
    )
    social.add_argument("--theme", required=True, help="Campaign theme.")
    social.add_argument(
        "--audience",
        default="Couples qui organisent leur mariage et wedding planners francophones.",
        help="Target audience.",
    )
    social.add_argument("--campaign-id", default="", help="Stable campaign id. Defaults to theme slug.")
    social.add_argument(
        "--platforms",
        default="instagram,tiktok",
        help="Comma-separated platforms. Default: instagram,tiktok.",
    )
    social.add_argument(
        "--video-provider",
        default="stub",
        choices=["stub", "gemini-veo", "openai-video"],
        help="Media provider. The default writes reviewable briefs only.",
    )
    social.set_defaults(func=run_social_campaign)

    approve = subparsers.add_parser("approve-item", help="Approve one social queue item locally.")
    approve.add_argument("--queue", required=True, help="Path to approval queue JSON.")
    approve.add_argument("--item-id", required=True, help="Queue item id to approve.")
    approve.add_argument("--approved-by", required=True, help="Human approver name or email.")
    approve.set_defaults(func=run_approve_item)

    publish = subparsers.add_parser(
        "publish-approved",
        help="Publish approved queue items. Defaults to dry-run; --live is blocked until configured.",
    )
    publish.add_argument("--queue", required=True, help="Path to approval queue JSON.")
    publish.add_argument("--live", action="store_true", help="Attempt real publication.")
    publish.set_defaults(func=run_publish_approved)

    budget = subparsers.add_parser(
        "launch-budget",
        help="Generate an Instagram/TikTok launch budget with video generation estimates.",
    )
    budget.add_argument("--total-budget-eur", type=int, default=150)
    budget.add_argument("--max-monthly-budget-eur", type=int, default=200)
    budget.add_argument("--days", type=int, default=30)
    budget.add_argument("--video-provider", default="veo-3.1-lite-1080p")
    budget.add_argument("--video-count", type=int, default=10)
    budget.add_argument("--video-duration-seconds", type=int, default=12)
    budget.set_defaults(func=run_launch_budget)

    return parser


def main(argv: list[str] | None = None) -> None:
    load_dotenv()
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        written = args.func(args)
    except (PermissionError, NotImplementedError, ValueError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc
    print(f"Wrote {written}")
