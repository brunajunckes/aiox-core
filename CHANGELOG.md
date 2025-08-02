# Changelog

All notable changes to this project will be documented in this file.

## [4.31.0] - 2025-08-02

### Added
- Complete framework rebranding to AIOS-FULLSTACK
- Meta-Agent System with AIOS Developer, Master, and Orchestrator
- Memory Layer integration with LlamaIndex
- High-performance vector store (2.66M ops/sec)
- Security improvements - 100% vulnerability-free
- 2-minute installation via NPX
- IDE integration for Cursor, Windsurf, and Claude
- Docker-ready deployment configuration
- Private NPM package publication

### Changed
- Package namespace from legacy framework to `@aios-fullstack/*`
- Agent activation syntax updated to YAML format
- Memory layer API endpoints restructured
- Improved error handling and input validation

### Fixed
- All 18 security vulnerabilities (2 critical, 10 high, 6 medium)
- Module import issues in CI/CD pipeline
- Performance test failures
- GitHub Actions configuration
- Windows path handling

### Security
- Input sanitization across all entry points
- Path traversal protection
- SQL injection prevention
- XSS protection

## [4.30.0] - 2025-07-15

### Added
- Initial MVP release
- Core agent system
- Basic workflow management
- Installation wizard

## [4.0.0] - 2025-06-01

### Added
- Project inception
- Core architecture design
- Initial development team setup

---

For more detailed release notes, see [RELEASE-NOTES-v4.31.0.md](RELEASE-NOTES-v4.31.0.md)