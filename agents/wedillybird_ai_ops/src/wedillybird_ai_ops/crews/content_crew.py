from __future__ import annotations


def build_content_crew():
    try:
        from crewai import Agent, Crew, Process, Task
    except ImportError as exc:
        raise RuntimeError("CrewAI is not installed. Run `uv sync` in agents/wedillybird_ai_ops.") from exc

    strategist = Agent(
        role="Wedillybird Content Strategist",
        goal="Turn launch goals into channel-specific content plans for Wedillybird.",
        backstory=(
            "You understand wedding SaaS, WhatsApp-first user behavior, French copywriting "
            "and launch-stage marketing. You never publish automatically."
        ),
        allow_delegation=False,
        verbose=True,
    )
    producer = Agent(
        role="Wedillybird Social Media Producer",
        goal="Draft LinkedIn, Instagram and short-video content that stays concrete and useful.",
        backstory="You write practical launch content for couples and wedding professionals.",
        allow_delegation=False,
        verbose=True,
    )
    guardian = Agent(
        role="Wedillybird Brand Guardian",
        goal="Detect unsupported claims, invented proof and content that requires human approval.",
        backstory="You protect trust, compliance and brand voice before public release.",
        allow_delegation=False,
        verbose=True,
    )

    strategy_task = Task(
        description=(
            "Create a content strategy for {theme}. Include target audience, content pillars, "
            "channel angles and proof requirements."
        ),
        expected_output="A concise Markdown strategy with content pillars and proof notes.",
        agent=strategist,
        markdown=True,
    )
    production_task = Task(
        description=(
            "Draft 5 LinkedIn posts, 5 Instagram captions, 3 short-video scripts, "
            "1 newsletter and 2 SEO briefs for {theme}. Mark everything as draft."
        ),
        expected_output="A Markdown content pack ready for human review.",
        agent=producer,
        context=[strategy_task],
        markdown=True,
    )
    review_task = Task(
        description=(
            "Review the content pack. Flag unsupported statistics, testimonials, legal claims, "
            "pricing changes, personal-data risks and any publication blocker."
        ),
        expected_output="A Markdown approval checklist with blockers and revision notes.",
        agent=guardian,
        context=[production_task],
        markdown=True,
        human_input=True,
    )

    return Crew(
        agents=[strategist, producer, guardian],
        tasks=[strategy_task, production_task, review_task],
        process=Process.sequential,
        verbose=True,
    )
