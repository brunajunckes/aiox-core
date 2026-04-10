#!/usr/bin/env python3
"""AutoFlow runner — use this to invoke workflows from CLI."""
import sys
import json

sys.path.insert(0, "/root/autoflow")

def main():
    if len(sys.argv) < 3:
        print("Usage: python run.py <workflow> <topic> [options]")
        print("Workflows: research, seo, video")
        sys.exit(1)

    wf_type = sys.argv[1]
    topic = sys.argv[2]

    if wf_type == "research":
        from workflows.research import run_research
        result = run_research(topic)
    elif wf_type == "seo":
        from workflows.seo import run_seo
        result = run_seo(topic)
    elif wf_type == "video":
        duration = int(sys.argv[3]) if len(sys.argv) > 3 else 60
        from workflows.video import run_video
        result = run_video(topic, duration=duration)
    else:
        print(f"Unknown workflow: {wf_type}")
        sys.exit(1)

    print(json.dumps(result, indent=2, ensure_ascii=False))

if __name__ == "__main__":
    main()
