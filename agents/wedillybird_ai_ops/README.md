# Wedillybird AI Ops

CrewAI workspace for running a small AI operations team around Wedillybird launch, marketing, content, SEO, partnerships and product feedback.

The first version is intentionally approval-first:

- drafts are generated as Markdown files under `.context/ai-ops/`;
- nothing is published automatically;
- social posts, emails, prospect messages, pricing changes and production actions require human approval.

## Setup

CrewAI requires Python `>=3.10,<3.14`. This workspace pins Python `3.12`.

```bash
cd agents/wedillybird_ai_ops

# Install uv if needed:
# curl -LsSf https://astral.sh/uv/install.sh | sh

uv sync
cp .env.example .env
```

Add model credentials in `.env`, for example `OPENAI_API_KEY`.

## Commands

The CLI can already produce safe deterministic drafts without calling an LLM:

```bash
PYTHONPATH=src python -m wedillybird_ai_ops weekly-growth \
  --week 2026-W19 \
  --goal "Preparer le lancement marketing de Wedillybird"

PYTHONPATH=src python -m wedillybird_ai_ops content-factory \
  --theme "Invitations WhatsApp et RSVP mariage"
```

Outputs are written to the repo-level `.context/ai-ops/` directory.

After installing the package, the same commands are available through:

```bash
wedillybird-ai weekly-growth --week 2026-W19
wedillybird-ai content-factory --theme "Invitations WhatsApp et RSVP mariage"
```

Instagram/TikTok campaign approval queue:

```bash
wedillybird-ai social-campaign \
  --theme "Invitations WhatsApp et RSVP mariage" \
  --campaign-id launch-whatsapp-rsvp
```

This writes:

- `.context/ai-ops/approvals/launch-whatsapp-rsvp.json`
- `.context/ai-ops/approvals/launch-whatsapp-rsvp.md`
- media briefs under `.context/ai-ops/media/launch-whatsapp-rsvp/`

Approve one item after review:

```bash
wedillybird-ai approve-item \
  --queue ../../.context/ai-ops/approvals/launch-whatsapp-rsvp.json \
  --item-id launch-whatsapp-rsvp-instagram-01 \
  --approved-by "human@example.com"
```

Dry-run publication:

```bash
wedillybird-ai publish-approved \
  --queue ../../.context/ai-ops/approvals/launch-whatsapp-rsvp.json
```

Live publication is intentionally blocked until OAuth apps, token storage, audit logs and approval UI are configured.

Instagram/TikTok launch budget:

```bash
wedillybird-ai launch-budget \
  --total-budget-eur 150 \
  --max-monthly-budget-eur 200 \
  --video-provider veo-3.1-lite-1080p \
  --video-count 10 \
  --video-duration-seconds 12
```

## CrewAI Extension Points

The package includes CrewAI crew factories in `src/wedillybird_ai_ops/crews/`. They are not called by default yet. Wire them into the flows once the model credentials, tool permissions and approval UI are ready.

## Safety Rules

Agents may prepare, analyze and propose. They must not:

- publish on social channels;
- send emails or DMs;
- spend ad budget;
- change pricing;
- deploy code;
- use guest personal data for marketing;
- invent testimonials, customer logos or statistics.
