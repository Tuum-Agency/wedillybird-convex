import tempfile
import unittest
from pathlib import Path

from wedillybird_ai_ops.publishers import publish_approved
from wedillybird_ai_ops.social import build_social_campaign_queue, load_queue, save_queue


class SocialQueueTests(unittest.TestCase):
    def test_social_queue_contains_platform_items(self):
        queue = build_social_campaign_queue("Invitations WhatsApp", "Couples", "test-campaign")
        queue.validate()
        platforms = {item.platform for item in queue.items}
        self.assertEqual(platforms, {"instagram", "tiktok"})
        self.assertTrue(any(item.format == "reel_or_story" for item in queue.items))
        self.assertTrue(any(item.format == "vertical_video_or_slides" for item in queue.items))

    def test_linkedin_can_be_explicitly_requested(self):
        queue = build_social_campaign_queue(
            "Invitations WhatsApp",
            "Couples",
            "test-campaign",
            platforms=("linkedin", "instagram", "tiktok"),
        )
        platforms = {item.platform for item in queue.items}
        self.assertEqual(platforms, {"linkedin", "instagram", "tiktok"})

    def test_queue_roundtrip_and_approval(self):
        queue = build_social_campaign_queue("Invitations WhatsApp", "Couples", "test-campaign")
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "queue.json"
            save_queue(queue, path)
            loaded = load_queue(path)
            loaded.approve("test-campaign-instagram-01", "owner@example.com")
            save_queue(loaded, path)
            reloaded = load_queue(path)
            item = reloaded.find_item("test-campaign-instagram-01")
            self.assertEqual(item.approval_status, "approved")
            self.assertEqual(item.approved_by, "owner@example.com")

    def test_dry_run_publish_only_publishes_approved_items(self):
        queue = build_social_campaign_queue("Invitations WhatsApp", "Couples", "test-campaign")
        queue.approve("test-campaign-instagram-01", "owner@example.com")
        results = publish_approved(queue)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0].status, "dry_run")

    def test_live_publish_is_blocked_by_default(self):
        queue = build_social_campaign_queue("Invitations WhatsApp", "Couples", "test-campaign")
        queue.approve("test-campaign-instagram-01", "owner@example.com")
        with self.assertRaises(PermissionError):
            publish_approved(queue, live=True)


if __name__ == "__main__":
    unittest.main()
