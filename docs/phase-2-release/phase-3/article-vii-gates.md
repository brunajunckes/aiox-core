# Article VII: Delivery Quality Assurance (7 Gates)

## Gate 1: Constitutional Compliance
- **Check:** Does the code violate AIOX Constitution?
- **Enforcement:** Automatic scan + human review
- **Blocker:** YES — Cannot proceed if violated

## Gate 2: Security Validation
- **Check:** OWASP Top 10, credential exposure, RLS policies
- **Enforcement:** Security reviewer agent scan
- **Blocker:** YES (CRITICAL only)

## Gate 3: Test Coverage
- **Check:** >= 80% unit + integration coverage
- **Enforcement:** Jest + c8 reports
- **Blocker:** YES if < 80%

## Gate 4: Performance Baseline
- **Check:** No regressions vs baseline, CWV < targets
- **Enforcement:** Lighthouse + custom benchmarks
- **Blocker:** YES if > 10% regression

## Gate 5: Accessibility (A11y)
- **Check:** WCAG AA compliance
- **Enforcement:** axe-core scan
- **Blocker:** NO (warning only)

## Gate 6: Documentation
- **Check:** README, API docs, migration guides complete
- **Enforcement:** Markdown linting + examples
- **Blocker:** NO (warning only)

## Gate 7: Deployment Readiness
- **Check:** Infrastructure, monitoring, rollback plan
- **Enforcement:** Deployment checklist
- **Blocker:** YES

**Summary:** All 7 gates automated. Any BLOCKER gate = cannot merge.

