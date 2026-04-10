"""SEO Content Workflow — Keywords → Content → Optimize → Validate → Output

Multi-step content generation with SEO optimization.
"""
import json
from langgraph.graph import StateGraph, END
from typing import TypedDict, Annotated
import operator

from .base import make_validation_node, should_retry, run_workflow
from ..core.router import call_llm_sync


class SEOState(TypedDict):
    input: dict
    output: dict
    keywords: list[str]
    current_step: str
    retry_count: Annotated[int, operator.add]
    errors: Annotated[list[str], operator.add]
    status: str
    validation_feedback: str


KEYWORD_SYSTEM = """You are an SEO keyword researcher. Given a topic, identify the best keywords.
Respond ONLY with a JSON object: {"keywords": ["keyword1", "keyword2", ...]}
Include at least 5 keywords, mix of short-tail and long-tail."""

CONTENT_SYSTEM = """You are an expert SEO content writer. Write high-quality, optimized content.
Respond ONLY with a JSON object containing:
- title: string (SEO-optimized, 10-70 chars)
- meta_description: string (compelling, 50-160 chars)
- keywords: list of strings (the target keywords, 3+)
- body: string (well-structured article, 300+ words, use headings with ##)
- headings: list of strings (H2 headings used in the body)

Write naturally. Include keywords organically. No keyword stuffing."""


def keyword_node(state: SEOState) -> dict:
    """Research keywords for the topic."""
    topic = state["input"].get("topic", "")
    raw = call_llm_sync(f"Find SEO keywords for: {topic}", system=KEYWORD_SYSTEM)

    try:
        raw = raw.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1].lstrip("json\n")
        data = json.loads(raw)
        keywords = data.get("keywords", [])
    except (json.JSONDecodeError, KeyError):
        keywords = [topic, f"{topic} guide", f"best {topic}", f"how to {topic}", f"{topic} 2026"]

    return {
        "keywords": keywords,
        "current_step": "keywords_done",
        "status": "running",
        "retry_count": 0,
        "errors": [],
        "validation_feedback": "",
    }


def content_node(state: SEOState) -> dict:
    """Generate SEO-optimized content."""
    topic = state["input"].get("topic", "")
    keywords = state.get("keywords", [])
    feedback = state.get("validation_feedback", "")

    prompt = f"Write an SEO-optimized article about: {topic}\nTarget keywords: {', '.join(keywords)}"
    if feedback:
        prompt += f"\n\nPREVIOUS ATTEMPT FAILED. Fix:\n{feedback}"
        prompt += f"\n\nPrevious output:\n{json.dumps(state.get('output', {}), indent=2)}"

    raw = call_llm_sync(prompt, system=CONTENT_SYSTEM)

    try:
        raw = raw.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1].lstrip("json\n")
        output = json.loads(raw)
        if "keywords" not in output:
            output["keywords"] = keywords
        # Fix: if body is not a string (LLM returned nested object), flatten it
        if not isinstance(output.get("body"), str):
            body_obj = output.get("body", "")
            if isinstance(body_obj, dict):
                parts = []
                for k, v in body_obj.items():
                    if isinstance(v, dict):
                        parts.append(f"## {v.get('title', k)}\n\n{v.get('content', str(v))}")
                    else:
                        parts.append(f"## {k}\n\n{str(v)}")
                output["body"] = "\n\n".join(parts)
            else:
                output["body"] = str(body_obj)
    except json.JSONDecodeError:
        output = {
            "title": f"{topic} - Complete Guide",
            "meta_description": f"Learn everything about {topic}. Expert guide with tips and best practices.",
            "keywords": keywords,
            "body": raw if len(raw) > 300 else f"# {topic}\n\n{raw}",
            "headings": [],
        }

    return {
        "output": output,
        "current_step": "content_done",
        "status": "validating",
        "retry_count": 0,
        "errors": [],
        "validation_feedback": "",
    }


def output_node(state: SEOState) -> dict:
    return {
        "status": "completed",
        "current_step": "completed",
        "retry_count": 0,
        "errors": [],
        "validation_feedback": "",
    }


def build_seo_workflow() -> StateGraph:
    workflow = StateGraph(SEOState)

    workflow.add_node("keywords", keyword_node)
    workflow.add_node("content", content_node)
    workflow.add_node("validate", make_validation_node("seo"))
    workflow.add_node("output", output_node)

    workflow.set_entry_point("keywords")
    workflow.add_edge("keywords", "content")
    workflow.add_edge("content", "validate")
    workflow.add_conditional_edges(
        "validate",
        should_retry,
        {
            "continue": "output",
            "retry": "content",
            "end": END,
        }
    )
    workflow.add_edge("output", END)

    return workflow


def run_seo(topic: str, thread_id: str = None) -> dict:
    tid, result = run_workflow(build_seo_workflow,
        {"input": {"topic": topic}, "output": {}, "keywords": [],
         "current_step": "starting", "retry_count": 0, "errors": [],
         "status": "running", "validation_feedback": ""},
        thread_id)
    return {"thread_id": tid, "status": result.get("status", "unknown"),
            "output": result.get("output", {}), "keywords": result.get("keywords", []),
            "errors": result.get("errors", [])}
