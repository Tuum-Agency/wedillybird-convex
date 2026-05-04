# Social Publishing Architecture

Wedillybird AI Ops must use official APIs and OAuth. Do not store LinkedIn, Instagram or TikTok account passwords.

## Flow

1. Generate content pack.
2. Convert pack into an approval queue.
3. Generate media briefs for carousels, slides and short videos.
4. Human reviews each item.
5. Human approves item in the queue.
6. Publisher runs in dry-run or live mode.
7. Live mode is allowed only after OAuth, token storage, audit logs and platform checks are configured.

## Launch Media Plan

Paid channels:

- Instagram Ads.
- TikTok Ads.

Excluded from launch paid media:

- LinkedIn.
- X/Twitter.
- Google Ads.
- broad newsletter sponsorships.

Budget principle:

- Start with a controlled 30-day test at 150 EUR/month.
- Keep a hard ceiling at 200 EUR/month including video generation costs.
- Spend mainly on paid distribution, not video generation.
- Use Veo 3.1 Lite/Fast for many cheap creative variants.
- Scale only the hooks that show retention and lead quality.

## Platforms

Launch focus:

- Instagram and TikTok only.
- Use AI-generated vertical video and photo-mode slides.
- Keep LinkedIn out of the launch workflow unless explicitly requested later.

LinkedIn:

- Use OAuth and official LinkedIn APIs.
- Not included in the default launch workflow.
- Start with text/image posts.
- Organization posting may require extra permissions and app review.

Instagram:

- Use Meta/Instagram Graph API.
- Requires Business or Creator account connected to a Facebook page for publishing.
- Start with carousel/image publishing before Reels.

TikTok:

- Use TikTok Content Posting API.
- Direct post flows require explicit user consent.
- Start with photo-mode/slides and short videos generated as reviewable MP4 assets.

## Video Providers

Provider abstraction:

- `stub`: writes briefs only, no generation cost.
- `gemini-veo`: future Google Veo integration.
- `openai-video`: future OpenAI video integration.

All generated media must be reviewed before publication.
