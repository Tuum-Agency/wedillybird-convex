from __future__ import annotations


def build_research_crew():
    try:
        from crewai import Agent, Crew, Process, Task
    except ImportError as exc:
        raise RuntimeError("CrewAI is not installed. Run `uv sync` in agents/wedillybird_ai_ops.") from exc

    researcher = Agent(
        role="Wedillybird Market Researcher",
        goal="Find launch-relevant insights for wedding SaaS, WhatsApp invitations and planners.",
        backstory=(
            "You research the wedding market in France and francophone Africa. You separate "
            "facts from hypotheses and never invent numbers."
        ),
        allow_delegation=False,
        verbose=True,
    )
    analyst = Agent(
        role="Wedillybird Growth Analyst",
        goal="Turn market findings into practical acquisition recommendations.",
        backstory="You prioritize actions that a small SaaS launch team can execute this week.",
        allow_delegation=False,
        verbose=True,
    )

    research_task = Task(
        description=(
            "Research {topic}. Identify audience pains, competitor patterns, objections and "
            "content opportunities. Every external claim must include a source."
        ),
        expected_output="A sourced Markdown research brief with hypotheses clearly marked.",
        agent=researcher,
        markdown=True,
    )
    synthesis_task = Task(
        description=(
            "Convert the research into 3 growth priorities, 3 content angles and 3 partnership "
            "opportunities for Wedillybird."
        ),
        expected_output="A concise Markdown synthesis for the Growth Lead.",
        agent=analyst,
        context=[research_task],
        markdown=True,
    )

    return Crew(
        agents=[researcher, analyst],
        tasks=[research_task, synthesis_task],
        process=Process.sequential,
        verbose=True,
    )
