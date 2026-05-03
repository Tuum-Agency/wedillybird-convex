from __future__ import annotations

from wedillybird_ai_ops.drafts import build_weekly_growth_plan


class WeeklyGrowthTemplateFlow:
    def kickoff(self, week: str, goal: str):
        return build_weekly_growth_plan(week=week, goal=goal)


def build_crewai_weekly_flow_class():
    try:
        from crewai.flow.flow import Flow, listen, start
        from pydantic import BaseModel
    except ImportError as exc:
        raise RuntimeError("CrewAI is not installed. Run `uv sync` in agents/wedillybird_ai_ops.") from exc

    class WeeklyGrowthState(BaseModel):
        week: str
        goal: str
        plan_markdown: str = ""

    class WeeklyGrowthFlow(Flow[WeeklyGrowthState]):
        @start()
        def draft_plan(self):
            return build_weekly_growth_plan(week=self.state.week, goal=self.state.goal)

        @listen(draft_plan)
        def require_human_review(self, plan):
            plan.validate()
            return plan

    return WeeklyGrowthFlow
