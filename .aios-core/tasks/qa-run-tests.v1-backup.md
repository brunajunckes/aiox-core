---
name: run-tests
agent: qa
requires:
  - jest
  - coderabbit
---

# Run Tests (with Code Quality Gate)

Execute test suite and validate code quality before marking tests complete.

## Steps

### 1. Run Unit Tests
```bash
cd api
npm run test
```

**Expected**: All tests pass, coverage >= 80%

### 2. Run Integration Tests
```bash
npm run test:integration
```

### 3. Code Quality Review
```bash
# Review code that was tested
coderabbit --prompt-only -t uncommitted
```

**Parse output**:
- If CRITICAL or HIGH issues found → FAIL
- If only MEDIUM/LOW → WARN but PASS

### 4. Generate QA Report

Use template: `qa-gate-tmpl.yaml`

Include:
- Test results (pass/fail, coverage %)
- CodeRabbit summary (issues by severity)
- Recommendation (approve/reject story)

### 5. Update Story Status

If all pass:
- [ ] Mark story testing complete
- [ ] Add QA approval comment
- [ ] Move to "Ready for Deploy"

If failures:
- [ ] Document failures in story
- [ ] Create tech debt issues for MEDIUM
- [ ] Request fixes from @dev

## Integration with CodeRabbit

**CodeRabbit helps @qa agent**:
- Catch issues tests might miss (logic errors, race conditions)
- Validate security patterns (SQL injection, hardcoded secrets)
- Enforce coding standards automatically
- Generate quality metrics

## Config

```yaml
codeRabbit:
  enabled: true
  severity_threshold: high
  auto_fix: false  # QA reviews but doesn't auto-fix
  report_location: docs/qa/coderabbit-reports/
```
