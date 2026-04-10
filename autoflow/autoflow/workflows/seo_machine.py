"""SEO Content Machine Workflow — Site Audit → Keyword Research → Competitor Analysis
→ Content Plan → Content Generation → Validate → Output

Expanded SEO pipeline integrating patterns from recovered SEO/GEO skills
(keyword-research, competitor-analysis, ai-seo, content-strategy).
"""
import json
from langgraph.graph import StateGraph, END
from typing import TypedDict, Annotated
import operator

from .base import make_validation_node, should_retry, run_workflow
from ..core.router import call_llm_sync


class SEOMachineState(TypedDict):
    input: dict
    output: dict
    site_audit: dict
    keywords: list[str]
    competitor_data: dict
    content_plan: list[dict]
    current_step: str
    retry_count: Annotated[int, operator.add]
    errors: Annotated[list[str], operator.add]
    status: str
    validation_feedback: str


# ── System Prompts (informed by recovered SEO skills) ──

SITE_AUDIT_SYSTEM = """You are a technical SEO auditor. Given a URL or topic/niche, perform a site audit analysis.
Respond ONLY with a JSON object containing:
- url: string (the target URL or niche domain)
- page_structure: object with keys: h1_count, h2_count, meta_title_present, meta_description_present, has_schema_markup
- issues: list of strings (SEO issues found, e.g. missing H1, duplicate meta, thin content)
- opportunities: list of strings (quick wins for improvement)
- score: integer 0-100 (overall SEO health score)
- recommendations: list of strings (top 5 actionable recommendations)

If a URL is not provided, analyze the niche/topic and provide recommendations for an ideal site structure.
Be specific and actionable. No fluff."""

KEYWORD_RESEARCH_SYSTEM = """You are an expert SEO keyword researcher following the keyword-research skill framework.
Given a topic/niche, identify high-value keywords using this methodology:
- Classify search intent: informational, navigational, commercial, transactional
- Mix short-tail (1-2 words) and long-tail (3+ words) keywords
- Group keywords into topic clusters
- Estimate relative difficulty: low, medium, high
- Prioritize by business value and ranking opportunity

Respond ONLY with a JSON object:
{
  "primary_keyword": "main target keyword",
  "keywords": [
    {"keyword": "...", "intent": "informational|commercial|transactional|navigational", "difficulty": "low|medium|high", "cluster": "cluster name"}
  ],
  "topic_clusters": [
    {"name": "cluster name", "pillar": "pillar keyword", "supporting": ["kw1", "kw2"]}
  ]
}
Include at least 15 keywords across 3+ clusters."""

COMPETITOR_ANALYSIS_SYSTEM = """You are a competitive intelligence analyst for SEO/GEO following the competitor-analysis skill framework.
Analyze the competitive landscape for a given niche/topic.

Respond ONLY with a JSON object:
{
  "niche": "the niche analyzed",
  "top_competitors": [
    {"name": "competitor", "strengths": ["..."], "weaknesses": ["..."], "content_types": ["..."], "estimated_authority": "low|medium|high"}
  ],
  "content_gaps": ["topics competitors miss or cover poorly"],
  "keyword_opportunities": ["keywords where competition is beatable"],
  "ai_visibility": {"competitors_cited_in_ai": ["..."], "ai_optimization_gaps": ["..."]},
  "strategy_recommendations": ["actionable strategies to outcompete"]
}
Identify at least 3 competitors and 5+ content gaps."""

CONTENT_PLAN_SYSTEM = """You are a content strategist following the content-strategy skill framework.
Create a 30-article content plan optimized for SEO and AI visibility.

For each article, classify as searchable (targets keywords), shareable (novel insights), or both.
Prioritize: P1 (publish first, high impact), P2 (important), P3 (nice to have).

Respond ONLY with a JSON object:
{
  "plan": [
    {
      "number": 1,
      "title": "Article Title (SEO-optimized)",
      "target_keyword": "primary keyword",
      "intent": "informational|commercial|transactional",
      "type": "searchable|shareable|both",
      "priority": "P1|P2|P3",
      "cluster": "topic cluster name",
      "estimated_word_count": 1500,
      "brief": "2-3 sentence description of what the article covers"
    }
  ]
}
Generate exactly 30 articles. At least 10 should be P1."""

CONTENT_GENERATION_SYSTEM = """You are an expert SEO content writer following AI SEO best practices.
Write content optimized for both traditional search AND AI citation (GEO/AEO).

AI-optimized writing rules:
- Lead with clear, direct answers (AI systems extract these)
- Use structured headings (H2/H3) that mirror search queries
- Include statistics, data points, and specific examples (boosts AI citation 40%+)
- Write in a citeable style: authoritative, factual, well-sourced
- Include comparison tables where relevant (AI loves structured data)
- Add FAQ section at the end (targets featured snippets and AI answers)

Respond ONLY with a JSON object:
{
  "title": "SEO-optimized title (10-70 chars)",
  "meta_description": "Compelling description (50-160 chars)",
  "keywords": ["target", "keywords", "list"],
  "body": "Full article with ## headings, 500+ words, naturally includes keywords",
  "headings": ["H2 heading 1", "H2 heading 2"],
  "faq": [{"question": "...", "answer": "..."}],
  "internal_links_suggested": ["related topic 1", "related topic 2"],
  "schema_type": "Article|HowTo|FAQ"
}
Write naturally. No keyword stuffing. Target 0.5-2% keyword density."""


def _parse_json(raw: str) -> dict:
    """Parse JSON from LLM output, handling markdown code fences."""
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1].lstrip("json\n")
    return json.loads(raw)


# ── Step 1: Site Audit ──

def site_audit_node(state: SEOMachineState) -> dict:
    """Crawl and analyze URL structure, H1/H2/meta tags."""
    topic = state["input"].get("topic", "")
    url = state["input"].get("url", "")

    prompt = f"Perform a technical SEO audit for: {url or topic}"
    if url:
        prompt += f"\nTarget URL: {url}"
    prompt += f"\nNiche/Topic: {topic}"

    raw = call_llm_sync(prompt, system=SITE_AUDIT_SYSTEM)

    try:
        audit = _parse_json(raw)
    except (json.JSONDecodeError, IndexError):
        audit = {
            "url": url or topic,
            "page_structure": {"h1_count": 0, "h2_count": 0, "meta_title_present": False,
                               "meta_description_present": False, "has_schema_markup": False},
            "issues": ["Could not complete automated audit"],
            "opportunities": [f"Optimize content for {topic}"],
            "score": 50,
            "recommendations": [f"Create comprehensive content about {topic}"],
        }

    return {
        "site_audit": audit,
        "current_step": "site_audit_done",
        "status": "running",
        "retry_count": 0,
        "errors": [],
        "validation_feedback": "",
    }


# ── Step 2: Keyword Research ──

def keyword_research_node(state: SEOMachineState) -> dict:
    """Research keywords using recovered keyword-research skill patterns."""
    topic = state["input"].get("topic", "")
    audit = state.get("site_audit", {})

    prompt = f"Research SEO keywords for the niche: {topic}"
    if audit.get("opportunities"):
        prompt += f"\n\nSite audit found these opportunities: {', '.join(audit['opportunities'][:5])}"

    raw = call_llm_sync(prompt, system=KEYWORD_RESEARCH_SYSTEM)

    try:
        data = _parse_json(raw)
        keywords_list = [kw["keyword"] if isinstance(kw, dict) else kw for kw in data.get("keywords", [])]
        primary = data.get("primary_keyword", topic)
        if primary not in keywords_list:
            keywords_list.insert(0, primary)
    except (json.JSONDecodeError, IndexError, KeyError):
        keywords_list = [topic, f"{topic} guide", f"best {topic}", f"how to {topic}",
                         f"{topic} tips", f"{topic} strategy", f"{topic} 2026"]

    return {
        "keywords": keywords_list,
        "current_step": "keywords_done",
        "status": "running",
        "retry_count": 0,
        "errors": [],
        "validation_feedback": "",
    }


# ── Step 3: Competitor Analysis ──

def competitor_analysis_node(state: SEOMachineState) -> dict:
    """Analyze competitors using recovered competitor-analysis skill patterns."""
    topic = state["input"].get("topic", "")
    keywords = state.get("keywords", [])

    prompt = f"Analyze the competitive landscape for: {topic}"
    if keywords:
        prompt += f"\nTarget keywords: {', '.join(keywords[:10])}"

    raw = call_llm_sync(prompt, system=COMPETITOR_ANALYSIS_SYSTEM)

    try:
        competitor_data = _parse_json(raw)
    except (json.JSONDecodeError, IndexError):
        competitor_data = {
            "niche": topic,
            "top_competitors": [],
            "content_gaps": [f"Comprehensive guide to {topic}"],
            "keyword_opportunities": keywords[:5],
            "ai_visibility": {"competitors_cited_in_ai": [], "ai_optimization_gaps": []},
            "strategy_recommendations": [f"Create authoritative content about {topic}"],
        }

    return {
        "competitor_data": competitor_data,
        "current_step": "competitor_analysis_done",
        "status": "running",
        "retry_count": 0,
        "errors": [],
        "validation_feedback": "",
    }


# ── Step 4: Content Plan ──

def content_plan_node(state: SEOMachineState) -> dict:
    """Generate 30-article content plan with priorities."""
    topic = state["input"].get("topic", "")
    keywords = state.get("keywords", [])
    competitor_data = state.get("competitor_data", {})

    prompt = f"Create a 30-article SEO content plan for: {topic}"
    if keywords:
        prompt += f"\nTarget keywords: {', '.join(keywords[:15])}"
    if competitor_data.get("content_gaps"):
        prompt += f"\nContent gaps to fill: {', '.join(competitor_data['content_gaps'][:5])}"
    if competitor_data.get("strategy_recommendations"):
        prompt += f"\nStrategy notes: {', '.join(competitor_data['strategy_recommendations'][:3])}"

    raw = call_llm_sync(prompt, system=CONTENT_PLAN_SYSTEM, max_tokens=8192)

    try:
        data = _parse_json(raw)
        plan = data.get("plan", [])
    except (json.JSONDecodeError, IndexError):
        plan = [{"number": i + 1, "title": f"{topic} - Article {i + 1}", "target_keyword": keywords[i % len(keywords)] if keywords else topic,
                 "intent": "informational", "type": "searchable", "priority": "P2" if i > 9 else "P1",
                 "cluster": "general", "estimated_word_count": 1500, "brief": f"Article about {topic}"}
                for i in range(30)]

    return {
        "content_plan": plan,
        "current_step": "content_plan_done",
        "status": "running",
        "retry_count": 0,
        "errors": [],
        "validation_feedback": "",
    }


# ── Step 5: Content Generation (first P1 article) ──

def content_generation_node(state: SEOMachineState) -> dict:
    """Generate SEO-optimized article using AI SEO skill patterns."""
    topic = state["input"].get("topic", "")
    keywords = state.get("keywords", [])
    plan = state.get("content_plan", [])
    feedback = state.get("validation_feedback", "")

    # Pick the first P1 article from the plan
    target_article = next((a for a in plan if a.get("priority") == "P1"), plan[0] if plan else None)

    if target_article:
        prompt = f"Write an SEO-optimized article:\nTitle: {target_article.get('title', topic)}"
        prompt += f"\nTarget keyword: {target_article.get('target_keyword', topic)}"
        prompt += f"\nBrief: {target_article.get('brief', '')}"
        prompt += f"\nAll keywords to include: {', '.join(keywords[:10])}"
    else:
        prompt = f"Write an SEO-optimized article about: {topic}\nTarget keywords: {', '.join(keywords)}"

    if feedback:
        prompt += f"\n\nPREVIOUS ATTEMPT FAILED. Fix:\n{feedback}"
        prompt += f"\n\nPrevious output:\n{json.dumps(state.get('output', {}), indent=2)}"

    raw = call_llm_sync(prompt, system=CONTENT_GENERATION_SYSTEM, max_tokens=8192)

    try:
        output = _parse_json(raw)
        if "keywords" not in output:
            output["keywords"] = keywords
        # Flatten body if not string
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
    except (json.JSONDecodeError, IndexError):
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


# ── Step 6: Output ──

def output_node(state: SEOMachineState) -> dict:
    """Assemble final output with all pipeline data."""
    output = state.get("output", {})
    output["_pipeline"] = {
        "site_audit": state.get("site_audit", {}),
        "keywords_researched": state.get("keywords", []),
        "competitor_data": state.get("competitor_data", {}),
        "content_plan_count": len(state.get("content_plan", [])),
        "content_plan": state.get("content_plan", []),
    }
    return {
        "output": output,
        "status": "completed",
        "current_step": "completed",
        "retry_count": 0,
        "errors": [],
        "validation_feedback": "",
    }


# ── Graph Builder ──

def build_seo_machine_workflow() -> StateGraph:
    workflow = StateGraph(SEOMachineState)

    workflow.add_node("site_audit", site_audit_node)
    workflow.add_node("keyword_research", keyword_research_node)
    workflow.add_node("competitor_analysis", competitor_analysis_node)
    workflow.add_node("content_plan", content_plan_node)
    workflow.add_node("content_generation", content_generation_node)
    workflow.add_node("validate", make_validation_node("seo"))
    workflow.add_node("output", output_node)

    workflow.set_entry_point("site_audit")
    workflow.add_edge("site_audit", "keyword_research")
    workflow.add_edge("keyword_research", "competitor_analysis")
    workflow.add_edge("competitor_analysis", "content_plan")
    workflow.add_edge("content_plan", "content_generation")
    workflow.add_edge("content_generation", "validate")
    workflow.add_conditional_edges(
        "validate",
        should_retry,
        {
            "continue": "output",
            "retry": "content_generation",
            "end": END,
        }
    )
    workflow.add_edge("output", END)

    return workflow


# ── Runner ──

def run_seo_machine(topic: str, url: str = "", thread_id: str = None) -> dict:
    """Run the full SEO Content Machine pipeline."""
    tid, result = run_workflow(
        build_seo_machine_workflow,
        {
            "input": {"topic": topic, "url": url},
            "output": {},
            "site_audit": {},
            "keywords": [],
            "competitor_data": {},
            "content_plan": [],
            "current_step": "starting",
            "retry_count": 0,
            "errors": [],
            "status": "running",
            "validation_feedback": "",
        },
        thread_id,
    )
    return {
        "thread_id": tid,
        "status": result.get("status", "unknown"),
        "output": result.get("output", {}),
        "keywords": result.get("keywords", []),
        "content_plan_count": len(result.get("content_plan", [])),
        "errors": result.get("errors", []),
    }
