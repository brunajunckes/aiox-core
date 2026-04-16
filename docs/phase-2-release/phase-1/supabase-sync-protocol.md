# Supabase Memory Sync Protocol

## Overview
Bidirectional synchronization of agent memory between local `.md` files and Supabase PostgreSQL for durability and multi-session continuity.

## Tables

### `aiox.memories`
```sql
- id: UUID
- agent_id: TEXT
- topic: TEXT
- summary: TEXT (max 500 tokens)
- context: JSONB
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
- relevance_score: FLOAT
```

### `aiox.squad_memories`
```sql
- id: UUID
- squad_id: TEXT
- collective_summary: TEXT (max 1000 tokens)
- agent_contributions: JSONB
- decisions: JSONB[]
- created_at: TIMESTAMP
```

## Sync Flow

### Load Phase (Agent Startup)
1. Query Supabase: `SELECT * FROM memories WHERE agent_id = ? ORDER BY updated_at DESC LIMIT 5`
2. Compact recent 5 memories into <500 token summary
3. Inject into system prompt
4. Begin work with full context

### Save Phase (Task Complete)
1. Local: Write new memory to `.claude/projects/-root/memory/MEMORY.md`
2. Trigger: `post-tool-use` hook captures memory content
3. Supabase: INSERT/UPDATE via auto-sync webhook
4. Audit: Log to `aiox.audit_log`

## Implementation

```javascript
// Load memories
const loadMemories = async (agentId) => {
  const { data } = await supabase
    .from('memories')
    .select('*')
    .eq('agent_id', agentId)
    .order('updated_at', { ascending: false })
    .limit(5);
  
  return compactMemories(data); // <500 tokens
};

// Save memories
const saveMemories = async (agentId, memory) => {
  await supabase
    .from('memories')
    .upsert({
      agent_id: agentId,
      summary: memory.summary,
      context: memory.context,
      updated_at: new Date()
    });
};
```

## RLS Policies

Each tenant (Paperclip, Hermes, AIOX, etc.) can only see their own memories:

```sql
CREATE POLICY agent_memory_isolation ON aiox.memories
  USING (agent_id LIKE current_user_agent() || ':%')
  WITH CHECK (agent_id LIKE current_user_agent() || ':%');
```

