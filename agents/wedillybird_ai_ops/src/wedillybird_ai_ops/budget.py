from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List


VEO_PRICES_USD_PER_SECOND = {
    "veo-3.1-lite-720p": 0.05,
    "veo-3.1-lite-1080p": 0.08,
    "veo-3.1-fast-1080p": 0.12,
    "veo-3.1-standard": 0.40,
}


@dataclass(frozen=True)
class VideoCostEstimate:
    provider: str
    video_count: int
    duration_seconds: int
    usd_per_second: float

    @property
    def cost_per_video_usd(self) -> float:
        return self.duration_seconds * self.usd_per_second

    @property
    def total_cost_usd(self) -> float:
        return self.video_count * self.cost_per_video_usd


@dataclass(frozen=True)
class LaunchBudgetPlan:
    total_budget_eur: int
    max_monthly_budget_eur: int
    days: int
    instagram_ads_eur: int
    tiktok_ads_eur: int
    retargeting_and_testing_eur: int
    video_generation_reserve_eur: int
    video: VideoCostEstimate
    weekly_actions: List[str]
    success_metrics: List[str]
    stop_rules: List[str]

    @property
    def daily_paid_media_budget_eur(self) -> float:
        paid_media = self.instagram_ads_eur + self.tiktok_ads_eur + self.retargeting_and_testing_eur
        return paid_media / self.days

    def allocations(self) -> Dict[str, int]:
        return {
            "Instagram Ads": self.instagram_ads_eur,
            "TikTok Ads": self.tiktok_ads_eur,
            "Retargeting / creative tests": self.retargeting_and_testing_eur,
            "AI video generation reserve": self.video_generation_reserve_eur,
        }


def build_launch_budget_plan(
    total_budget_eur: int = 150,
    max_monthly_budget_eur: int = 200,
    days: int = 30,
    video_provider: str = "veo-3.1-lite-1080p",
    video_count: int = 10,
    video_duration_seconds: int = 12,
) -> LaunchBudgetPlan:
    if total_budget_eur < 100:
        raise ValueError("total_budget_eur should be at least 100 for a useful launch test")
    if max_monthly_budget_eur < total_budget_eur:
        raise ValueError("max_monthly_budget_eur must be greater than or equal to total_budget_eur")
    if days <= 0:
        raise ValueError("days must be positive")
    if video_provider not in VEO_PRICES_USD_PER_SECOND:
        raise ValueError(f"unknown video provider: {video_provider}")
    if video_count <= 0 or video_duration_seconds <= 0:
        raise ValueError("video_count and video_duration_seconds must be positive")

    video = VideoCostEstimate(
        provider=video_provider,
        video_count=video_count,
        duration_seconds=video_duration_seconds,
        usd_per_second=VEO_PRICES_USD_PER_SECOND[video_provider],
    )

    if total_budget_eur <= 200:
        video_generation_reserve = max(10, min(20, round(total_budget_eur * 0.10)))
    else:
        video_generation_reserve = max(100, min(250, round(total_budget_eur * 0.06)))
    paid_media_budget = total_budget_eur - video_generation_reserve

    instagram_ads = round(paid_media_budget * 0.56)
    tiktok_ads = round(paid_media_budget * 0.35)
    retargeting = paid_media_budget - instagram_ads - tiktok_ads

    return LaunchBudgetPlan(
        total_budget_eur=total_budget_eur,
        max_monthly_budget_eur=max_monthly_budget_eur,
        days=days,
        instagram_ads_eur=instagram_ads,
        tiktok_ads_eur=tiktok_ads,
        retargeting_and_testing_eur=retargeting,
        video_generation_reserve_eur=video_generation_reserve,
        video=video,
        weekly_actions=[
            "Week 1: generate 8-10 vertical video drafts, publish organic posts, spend only on the 2 best hooks.",
            "Week 2: run one lean Instagram ad set and one lean TikTok ad set; avoid splitting by too many audiences.",
            "Week 3: pause weak hooks, keep the best platform active, and reserve a small amount for retargeting.",
            "Week 4: spend only on the best creative/platform pair; do not force scale if signal is weak.",
        ],
        success_metrics=[
            "Creative hook rate and 3-second video hold.",
            "Landing page click-through rate from Instagram and TikTok.",
            "Cost per qualified lead or signup.",
            "Premium/pro intent, not only cheap traffic.",
            "Whether the 150 EUR/month budget produces enough signal to justify moving toward 200 EUR.",
        ],
        stop_rules=[
            "Pause creatives with poor watch time after a fair spend test.",
            "Do not scale if signups are low-quality or no pricing intent appears.",
            "Do not exceed the 200 EUR/month ceiling without a clear winning creative and conversion signal.",
            "Do not publish videos with unsupported claims, fake testimonials or personal guest data.",
        ],
    )


def render_launch_budget_plan(plan: LaunchBudgetPlan) -> str:
    allocations = "\n".join(f"| {name} | {amount} EUR |" for name, amount in plan.allocations().items())
    weekly_actions = "\n".join(f"- {item}" for item in plan.weekly_actions)
    success_metrics = "\n".join(f"- {item}" for item in plan.success_metrics)
    stop_rules = "\n".join(f"- {item}" for item in plan.stop_rules)
    return f"""# Instagram + TikTok Launch Budget

Total budget: {plan.total_budget_eur} EUR
Maximum monthly ceiling: {plan.max_monthly_budget_eur} EUR
Duration: {plan.days} days
Average paid media spend: {plan.daily_paid_media_budget_eur:.2f} EUR/day

## Allocation

| Channel | Budget |
|---|---:|
{allocations}

## Video Generation Estimate

Provider: {plan.video.provider}
Videos: {plan.video.video_count}
Duration per video: {plan.video.duration_seconds} seconds
Price: {plan.video.usd_per_second:.2f} USD/second
Estimated cost per video: {plan.video.cost_per_video_usd:.2f} USD
Estimated total video generation: {plan.video.total_cost_usd:.2f} USD

The EUR reserve is intentionally larger than the API estimate because several drafts, retries,
alternate hooks and manual editing may be needed before a video is usable. With this lean budget,
avoid generating too many variants before the first organic signal.

## Weekly Execution

{weekly_actions}

## Success Metrics

{success_metrics}

## Stop Rules

{stop_rules}
"""
