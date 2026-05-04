from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

from wedillybird_ai_ops.social import SocialCampaignItem


@dataclass(frozen=True)
class MediaAsset:
    item_id: str
    provider: str
    path: Path
    status: str = "draft_brief"


class VideoProvider(Protocol):
    name: str

    def create_brief(self, item: SocialCampaignItem, output_dir: Path) -> MediaAsset:
        ...


class StubVideoProvider:
    name = "stub"

    def create_brief(self, item: SocialCampaignItem, output_dir: Path) -> MediaAsset:
        output_dir.mkdir(parents=True, exist_ok=True)
        path = output_dir / f"{item.id}.md"
        path.write_text(
            f"""# Media Brief - {item.id}

Platform: {item.platform}
Format: {item.format}
Provider: {self.name}

## Visual Direction

{item.media_brief}

## Copy

{item.copy}

## Video Prompt

{item.video_prompt or "N/A"}

## Safety

- No real guest personal data.
- No licensed music unless rights are documented.
- No unsupported statistics or fake testimonials.
- Human approval required before publishing.
""",
            encoding="utf-8",
        )
        return MediaAsset(item_id=item.id, provider=self.name, path=path)


class GeminiVeoProvider:
    name = "gemini-veo"

    def create_brief(self, item: SocialCampaignItem, output_dir: Path) -> MediaAsset:
        raise NotImplementedError(
            "Gemini Veo generation is not wired yet. Use StubVideoProvider until Google billing, "
            "model choice, rights policy and asset review are configured."
        )


class OpenAIVideoProvider:
    name = "openai-video"

    def create_brief(self, item: SocialCampaignItem, output_dir: Path) -> MediaAsset:
        raise NotImplementedError(
            "OpenAI video generation is not wired yet. Use StubVideoProvider until the provider "
            "and moderation review are configured."
        )


def provider_from_name(name: str) -> VideoProvider:
    normalized = name.strip().lower()
    if normalized in {"stub", "brief", "dry-run"}:
        return StubVideoProvider()
    if normalized in {"gemini", "veo", "gemini-veo"}:
        return GeminiVeoProvider()
    if normalized in {"openai", "openai-video"}:
        return OpenAIVideoProvider()
    raise ValueError(f"unknown video provider: {name}")
