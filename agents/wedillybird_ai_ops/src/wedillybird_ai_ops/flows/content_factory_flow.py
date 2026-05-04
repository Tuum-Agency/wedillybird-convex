from __future__ import annotations

from wedillybird_ai_ops.drafts import build_content_pack


class ContentFactoryTemplateFlow:
    def kickoff(self, theme: str, audience: str):
        return build_content_pack(theme=theme, audience=audience)


def build_crewai_content_flow_class():
    try:
        from crewai.flow.flow import Flow, listen, start
        from pydantic import BaseModel
    except ImportError as exc:
        raise RuntimeError("CrewAI is not installed. Run `uv sync` in agents/wedillybird_ai_ops.") from exc

    class ContentFactoryState(BaseModel):
        theme: str
        audience: str

    class ContentFactoryFlow(Flow[ContentFactoryState]):
        @start()
        def draft_content(self):
            return build_content_pack(theme=self.state.theme, audience=self.state.audience)

        @listen(draft_content)
        def require_human_review(self, pack):
            pack.validate()
            return pack

    return ContentFactoryFlow
