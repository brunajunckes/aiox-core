# IDE Compatibility Matrix

> Quick reference for AIOX agent activation across IDEs
> Full details: docs/ide-integration.md

## Agent Activation by IDE

| Agent | Claude Code | Gemini CLI | Codex | Cursor | Copilot |
|-------|------------|-----------|-------|--------|--------|
| @dev | @dev | /aiox-dev | /skills | @dev rules | chat |
| @qa | @qa | /aiox-qa | /skills | @qa rules | chat |
| @architect | @architect | /aiox-architect | /skills | @architect | chat |
| @pm | @pm | /aiox-pm | /skills | @pm rules | chat |
| @po | @po | /aiox-po | /skills | @po rules | chat |
| @sm | @sm | /aiox-sm | /skills | @sm rules | chat |
| @analyst | @analyst | /aiox-analyst | /skills | @analyst | chat |
| @data-eng | @data-engineer | /aiox-data | /skills | @data-eng | chat |
| @ux | @ux-design-expert | /aiox-ux | /skills | @ux rules | chat |
| @devops | @devops | /aiox-devops | /skills | @devops | chat |

## Feature Support

| Feature | Claude Code | Gemini | Codex | Cursor | Copilot |
|---------|------------|--------|-------|--------|--------|
| Agent activation | Full | Full | Partial | Limited | Limited |
| Auto checks | Full | High | Partial | None | None |
| Story tracking | Full | Full | Manual | Manual | Manual |
| Quality gates | Auto | Auto | Manual | Manual | Manual |
| Constitutional | Auto | Auto | Manual | Manual | Manual |
| MCP tools | Full | Full | Limited | Config | Config |
| Session state | Full | Partial | None | None | None |

## Recommended IDE

| Use Case | Best IDE |
|----------|--------|
| New to AIOX | Claude Code |
| Cursor user | Cursor + sync |
| Web access | Gemini CLI |
| VS Code | Copilot + MCP |

## Validation

npm run validate:parity
npm run sync:ide
npm run sync:ide:check
