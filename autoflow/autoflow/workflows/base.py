"""Base workflow infrastructure with PostgreSQL checkpointing."""
from langgraph.checkpoint.postgres import PostgresSaver
from langgraph.graph import StateGraph, END
from typing import TypedDict, Annotated
import uuid
import operator
from contextlib import contextmanager

from ..core import config


@contextmanager
def checkpointer_scope():
    """Context manager for PostgresSaver — use with `with` blocks."""
    with PostgresSaver.from_conn_string(config.DATABASE_URL) as cp:
        cp.setup()
        yield cp


def new_thread_id() -> str:
    return str(uuid.uuid4())


class WorkflowState(TypedDict):
    input: dict
    output: dict
    current_step: str
    retry_count: Annotated[int, operator.add]
    errors: Annotated[list[str], operator.add]
    status: str
    validation_feedback: str


def make_validation_node(output_type: str, max_retries: int = 3):
    from ..core.validator import validate_output

    def validate(state: WorkflowState) -> dict:
        result = validate_output(state["output"], output_type)
        if result.valid:
            return {
                "status": "validated",
                "validation_feedback": "",
                "current_step": "validated",
                "retry_count": 0,
                "errors": [],
            }
        total_retries = state.get("retry_count", 0) + 1
        if total_retries >= max_retries:
            return {
                "status": "failed",
                "errors": [f"Max retries ({max_retries}) exceeded: {result.feedback}"],
                "current_step": "failed",
                "retry_count": 1,
                "validation_feedback": "",
            }
        return {
            "status": "retry",
            "validation_feedback": result.retry_prompt,
            "current_step": "retrying",
            "retry_count": 1,
            "errors": [],
        }

    return validate


def should_retry(state: WorkflowState) -> str:
    status = state.get("status", "")
    if status == "validated":
        return "continue"
    elif status == "retry":
        return "retry"
    return "end"


def run_workflow(graph_builder, initial_state: dict, thread_id: str = None) -> dict:
    """Generic workflow runner with checkpointing."""
    tid = thread_id or new_thread_id()
    with checkpointer_scope() as cp:
        app = graph_builder().compile(checkpointer=cp)
        result = app.invoke(
            initial_state,
            config={"configurable": {"thread_id": tid}}
        )
    return tid, result
