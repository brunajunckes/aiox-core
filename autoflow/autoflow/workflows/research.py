"""Research Workflow — Topic → Research → Validate → Output"""
import json
from langgraph.graph import StateGraph, END
from typing import TypedDict, Annotated
import operator

from .base import make_validation_node, should_retry, run_workflow
from ..core.router import call_llm_sync


class ResearchState(TypedDict):
    input: dict
    output: dict
    current_step: str
    retry_count: Annotated[int, operator.add]
    errors: Annotated[list[str], operator.add]
    status: str
    validation_feedback: str


RESEARCH_SYSTEM = """You are a thorough research analyst. Produce structured research output.
Always respond with valid JSON containing these exact fields:
- title: string (descriptive title, 10+ chars)
- summary: string (comprehensive summary, 100+ chars, 50+ words)
- findings: list of strings (at least 3 detailed findings, each 20+ chars)
- sources: list of strings (relevant sources or references)

Respond ONLY with the JSON object, no markdown, no extra text."""


def research_node(state: ResearchState) -> dict:
    topic = state["input"].get("topic", "")
    feedback = state.get("validation_feedback", "")

    prompt = f"Research the following topic thoroughly: {topic}"
    if feedback:
        prompt += f"\n\nPREVIOUS ATTEMPT FAILED. Fix these issues:\n{feedback}"
        prompt += f"\n\nPrevious output was:\n{json.dumps(state.get('output', {}), indent=2)}"

    raw = call_llm_sync(prompt, system=RESEARCH_SYSTEM)

    try:
        raw = raw.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        output = json.loads(raw)
    except json.JSONDecodeError:
        output = {
            "title": f"Research: {topic}",
            "summary": raw[:500] if len(raw) > 100 else "Failed to generate structured output",
            "findings": [raw[:200]] if raw else ["No findings generated"],
            "sources": [],
        }

    return {
        "output": output,
        "current_step": "researched",
        "status": "validating",
        "retry_count": 0,
        "errors": [],
        "validation_feedback": "",
    }


def output_node(state: ResearchState) -> dict:
    return {"status": "completed", "current_step": "completed",
            "retry_count": 0, "errors": [], "validation_feedback": ""}


def build_research_workflow() -> StateGraph:
    workflow = StateGraph(ResearchState)
    workflow.add_node("research", research_node)
    workflow.add_node("validate", make_validation_node("research"))
    workflow.add_node("output", output_node)
    workflow.set_entry_point("research")
    workflow.add_edge("research", "validate")
    workflow.add_conditional_edges("validate", should_retry,
        {"continue": "output", "retry": "research", "end": END})
    workflow.add_edge("output", END)
    return workflow


def run_research(topic: str, thread_id: str = None) -> dict:
    tid, result = run_workflow(build_research_workflow,
        {"input": {"topic": topic}, "output": {}, "current_step": "starting",
         "retry_count": 0, "errors": [], "status": "running", "validation_feedback": ""},
        thread_id)
    return {"thread_id": tid, "status": result.get("status", "unknown"),
            "output": result.get("output", {}), "errors": result.get("errors", [])}
