import unittest

from wedillybird_ai_ops.budget import build_launch_budget_plan


class BudgetTests(unittest.TestCase):
    def test_default_budget_allocates_to_instagram_and_tiktok(self):
        plan = build_launch_budget_plan()
        plan_allocations = plan.allocations()
        self.assertGreater(plan_allocations["Instagram Ads"], plan_allocations["TikTok Ads"])
        self.assertEqual(sum(plan_allocations.values()), 150)
        self.assertEqual(plan.max_monthly_budget_eur, 200)

    def test_video_cost_estimate(self):
        plan = build_launch_budget_plan(
            total_budget_eur=150,
            video_provider="veo-3.1-lite-1080p",
            video_count=10,
            video_duration_seconds=12,
        )
        self.assertEqual(plan.video.cost_per_video_usd, 0.96)
        self.assertEqual(plan.video.total_cost_usd, 9.6)

    def test_small_budget_rejected(self):
        with self.assertRaises(ValueError):
            build_launch_budget_plan(total_budget_eur=99)

    def test_max_budget_must_cover_starting_budget(self):
        with self.assertRaises(ValueError):
            build_launch_budget_plan(total_budget_eur=150, max_monthly_budget_eur=120)


if __name__ == "__main__":
    unittest.main()
