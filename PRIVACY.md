# Privacy Policy

**Last updated:** 2025-12-08

> 🇧🇷 [Versão em Português](PRIVACY-PT.md)

## Overview

AIOS (AI-Orchestrated System) is an open-source project maintained by AllFluence Inc. This privacy policy explains how we handle any data that may be collected when you use AIOS-FULLSTACK.

## Data Collection

### What We Don't Collect

AIOS-FULLSTACK does **NOT** collect:
- Personal identification information
- Usage analytics or telemetry data
- Code or project content from your repositories
- API keys or credentials
- Browsing history or tracking data

### What May Be Collected (Opt-in Only)

If you explicitly opt-in to telemetry features (disabled by default):
- Anonymous crash reports (no personally identifiable information)
- Anonymous usage statistics (feature usage patterns only)

You can disable any data collection at any time by setting `telemetryEnabled: false` in your configuration.

## Local Data Storage

AIOS-FULLSTACK stores some data locally on your machine:
- Configuration files (`.aios/`, `.aios-core/`)
- Project status cache (`.aios/project-status.yaml`)
- Decision logs (`.ai/` directory)
- Story files and documentation

This data never leaves your local machine unless you explicitly share it (e.g., by pushing to a Git repository).

## Third-Party Services

When using AIOS-FULLSTACK, you may interact with third-party services:

| Service | Purpose | Privacy Policy |
|---------|---------|----------------|
| **GitHub** | Repository hosting, issue tracking | [GitHub Privacy](https://docs.github.com/en/site-policy/privacy-policies/github-privacy-statement) |
| **npm** | Package distribution | [npm Privacy](https://docs.npmjs.com/policies/privacy) |
| **AI Providers** | Claude, OpenAI, etc. (configured by user) | See respective provider policies |
| **MCP Servers** | Tool integrations (user-configured) | Varies by server |

**Important:** Your interactions with these services are governed by their respective privacy policies. AIOS-FULLSTACK does not control or have access to data you share with these services.

## Your Rights

You have the right to:
- **Opt-out** of any data collection at any time
- **Delete** all local data by removing the `.aios/` and `.ai/` directories
- **Inspect** all stored data (it's stored in plain text/YAML format)
- **Request information** about any data collected (if telemetry is enabled)

## Open Source Transparency

As an open-source project, all code is publicly available for inspection:
- Repository: [github.com/Pedrovaleriolopez/aios-fullstack](https://github.com/Pedrovaleriolopez/aios-fullstack)
- No hidden data collection mechanisms
- All configuration options are documented

## Children's Privacy

AIOS-FULLSTACK is a development tool intended for professional use. We do not knowingly collect any information from children under 13 years of age.

## Security

We take security seriously:
- No sensitive data transmission by default
- Local-first architecture
- API keys and credentials are never stored by AIOS (users manage their own)
- Regular security audits of the codebase

For security vulnerabilities, please [open an issue](https://github.com/Pedrovaleriolopez/aios-fullstack/issues) or email security@allfluence.com.

## Contact

For privacy concerns or questions:
- **GitHub Issues:** [Open an issue](https://github.com/Pedrovaleriolopez/aios-fullstack/issues)
- **Email:** privacy@allfluence.com
- **Discord:** [Community Server](https://discord.gg/gk8jAdXWmj)

## Changes to This Policy

We will update this policy as needed. Changes will be:
- Documented in the [CHANGELOG](CHANGELOG.md)
- Reflected in the "Last updated" date above
- Announced in major releases if significant

## Attribution

This privacy policy is adapted from open-source privacy policy templates and follows best practices for open-source projects.

---

**Copyright (c) 2025 AllFluence Inc.**
