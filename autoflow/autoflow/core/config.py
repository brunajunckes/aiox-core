"""AutoFlow Configuration — single source of truth for all connections."""
import os

# PostgreSQL (system Postgres 16, port 5432)
DB_USER = os.getenv("AUTOFLOW_DB_USER", "autoflow")
DB_PASS = os.getenv("AUTOFLOW_DB_PASS", "autoflow_secure_2026")
DB_HOST = os.getenv("AUTOFLOW_DB_HOST", "localhost")
DB_PORT = os.getenv("AUTOFLOW_DB_PORT", "5432")
DB_NAME = os.getenv("AUTOFLOW_DB_NAME", "autoflow")
DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

# LLM Router AIOX (already running on port 3000)
LLM_ROUTER_URL = os.getenv("LLM_ROUTER_URL", "http://localhost:3000")

# Ollama ONLINE ONLY — ampcast.site (NEVER use local VPS)
OLLAMA_URL = "http://ollama.ampcast.site"  # HARDCODED — ALWAYS ONLINE (port 80)
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:7b")  # Default: qwen2.5

# Note: No Claude API key - using OAuth/Claude.ai only
# Claude fallback not available (use Ollama only)

# AutoFlow API
API_HOST = os.getenv("AUTOFLOW_API_HOST", "0.0.0.0")
API_PORT = int(os.getenv("AUTOFLOW_API_PORT", "8080"))

# Validation
MAX_RETRIES = int(os.getenv("AUTOFLOW_MAX_RETRIES", "3"))

# Resource monitor log
MONITOR_LOG = "/var/log/autoflow-monitor.jsonl"
