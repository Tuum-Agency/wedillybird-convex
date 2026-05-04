import unittest

from wedillybird_ai_ops.guardrails import approval_blockers, detect_public_claims


class GuardrailTests(unittest.TestCase):
    def test_detects_public_numbers(self):
        claims = detect_public_claims("Wedillybird affiche 98 % d'ouverture.\nNo number here.")
        self.assertEqual(len(claims), 1)

    def test_unsourced_claim_becomes_blocker(self):
        blockers = approval_blockers("Plus de 1200 mariages deja organises.")
        self.assertTrue(blockers)

    def test_sourced_claim_can_pass(self):
        claim = "Plus de 1200 mariages deja organises."
        blockers = approval_blockers(claim, sourced_claims=[claim])
        self.assertEqual(blockers, [])


if __name__ == "__main__":
    unittest.main()
