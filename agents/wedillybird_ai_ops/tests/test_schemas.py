import unittest

from wedillybird_ai_ops.drafts import build_content_pack, build_weekly_growth_plan
from wedillybird_ai_ops.schemas import ApprovalGate, SocialPost


class SchemaTests(unittest.TestCase):
    def test_weekly_plan_is_valid(self):
        plan = build_weekly_growth_plan("2026-W19", "Launch")
        plan.validate()
        self.assertEqual(len(plan.content_calendar), 7)
        self.assertEqual(plan.approval.status, "needs_human_review")

    def test_content_pack_is_valid(self):
        pack = build_content_pack("Invitations WhatsApp", "Couples")
        pack.validate()
        self.assertGreaterEqual(len(pack.linkedin_posts), 5)
        self.assertGreaterEqual(len(pack.instagram_posts), 5)
        self.assertGreaterEqual(len(pack.short_video_scripts), 3)

    def test_auto_approval_is_rejected(self):
        with self.assertRaises(ValueError):
            ApprovalGate(status="approved", checklist=["Reviewed"]).validate()

    def test_social_auto_approval_is_rejected(self):
        post = SocialPost(channel="LinkedIn", title="Title", body="Body", cta="CTA", approval_status="approved")
        with self.assertRaises(ValueError):
            post.validate()


if __name__ == "__main__":
    unittest.main()
