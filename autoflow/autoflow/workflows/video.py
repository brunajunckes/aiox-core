"""Video Pipeline Workflow — Script → TTS Spec → Visual Spec → Composite → Output

Generates production specs (not actual rendering — GPU is on desktop).
Each step checkpointed for crash recovery.
Uses task_router for intelligent model selection (Ollama for simple, Opus for complex).
"""
import json
import asyncio
from langgraph.graph import StateGraph, END
from typing import TypedDict, Annotated
import operator

from .base import make_validation_node, should_retry, run_workflow
from ..core.task_router import route_and_call


class VideoState(TypedDict):
    input: dict
    output: dict
    current_step: str
    retry_count: Annotated[int, operator.add]
    errors: Annotated[list[str], operator.add]
    status: str
    validation_feedback: str


SCRIPT_SYSTEM = """You are a video script writer. Create engaging scripts for short videos.
Respond ONLY with a JSON object:
- script: string (the narration script, 50+ chars)
- duration_seconds: int (15-600)
- voice: string (e.g. "pt-BR-female" or "en-US-male")
- style: string (e.g. "educational", "marketing", "entertainment")
- scenes: list of objects, each with:
  - description: string (visual description of the scene)
  - duration: int (seconds for this scene)
  - text_overlay: string (optional on-screen text)

Make the script engaging and appropriate for the target duration."""


def script_node(state: VideoState) -> dict:
    """Generate video script and scene breakdown."""
    topic = state["input"].get("topic", "")
    duration = state["input"].get("duration", 60)
    style = state["input"].get("style", "educational")
    language = state["input"].get("language", "pt-BR")
    feedback = state.get("validation_feedback", "")

    prompt = f"Create a {duration}-second {style} video script about: {topic}\nLanguage: {language}"
    if feedback:
        prompt += f"\n\nPREVIOUS ATTEMPT FAILED. Fix:\n{feedback}"
        prompt += f"\n\nPrevious output:\n{json.dumps(state.get('output', {}), indent=2)}"

    # Use task_router with code-generation category and validation
    raw = asyncio.run(
        route_and_call(
            prompt,
            system=SCRIPT_SYSTEM,
            category_hint="code-generation",
            output_type="video",  # Enable automatic validation & retry
        )
    )

    try:
        raw = raw.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1].lstrip("json\n")
        output = json.loads(raw)
    except json.JSONDecodeError:
        output = {
            "script": raw[:500] if raw else "Script generation failed",
            "duration_seconds": duration,
            "voice": f"{language}-female",
            "style": style,
            "scenes": [{"description": f"Main scene about {topic}", "duration": duration, "text_overlay": ""}],
        }

    return {
        "output": output,
        "current_step": "script_done",
        "status": "validating",
        "retry_count": 0,
        "errors": [],
        "validation_feedback": "",
    }


def enrich_spec_node(state: VideoState) -> dict:
    """Enrich the video spec with production details."""
    output = state.get("output", {})

    # Add production metadata
    output["production"] = {
        "tts_engine": "vibe-voice",
        "avatar_engine": "duix-avatar",
        "visual_engine": "pixelle-video",
        "subtitle_engine": "videolingo",
        "matting_engine": "robust-video-matting",
        "output_format": "mp4",
        "resolution": "1080x1920",
        "fps": 30,
    }

    # Add per-scene visual prompts for image generation
    for scene in output.get("scenes", []):
        if "visual_prompt" not in scene:
            scene["visual_prompt"] = f"High quality {output.get('style', 'professional')} scene: {scene.get('description', '')}"

    return {
        "output": output,
        "current_step": "enriched",
        "status": "completed",
        "retry_count": 0,
        "errors": [],
        "validation_feedback": "",
    }


def build_video_workflow() -> StateGraph:
    workflow = StateGraph(VideoState)

    workflow.add_node("script", script_node)
    workflow.add_node("validate", make_validation_node("video"))
    workflow.add_node("enrich", enrich_spec_node)

    workflow.set_entry_point("script")
    workflow.add_edge("script", "validate")
    workflow.add_conditional_edges(
        "validate",
        should_retry,
        {
            "continue": "enrich",
            "retry": "script",
            "end": END,
        }
    )
    workflow.add_edge("enrich", END)

    return workflow


def run_video(topic: str, duration: int = 60, style: str = "educational",
              language: str = "pt-BR", thread_id: str = None) -> dict:
    tid, result = run_workflow(build_video_workflow,
        {"input": {"topic": topic, "duration": duration, "style": style, "language": language},
         "output": {}, "current_step": "starting", "retry_count": 0,
         "errors": [], "status": "running", "validation_feedback": ""},
        thread_id)
    return {"thread_id": tid, "status": result.get("status", "unknown"),
            "output": result.get("output", {}), "errors": result.get("errors", [])}
