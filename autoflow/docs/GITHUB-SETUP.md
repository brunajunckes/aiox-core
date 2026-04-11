# GitHub Setup & Branch Protection Rules

## Installation

### 1. Install Pre-commit Hooks (Local)

```bash
pip install pre-commit
pre-commit install
pre-commit run --all-files  # Run once to validate
```

Now, every commit will run:
- Black (formatting)
- flake8 (linting)
- mypy (type checking)
- bandit (security scanning)
- YAML/JSON validation

### 2. Enable GitHub Actions

```bash
git push origin main  # Pushes .github/workflows/ci.yml
```

Actions will trigger on:
- Every push to `main` or `develop`
- Every pull request

### 3. Configure Branch Protection (GitHub UI)

**Settings → Branches → Add Rule**

#### Branch name pattern: `main`

- ✅ Require a pull request before merging
  - Dismiss stale pull request approvals when new commits are pushed
  - Require code review from 1+ users
  
- ✅ Require status checks to pass before merging
  - Required checks:
    - `test` (pytest with coverage)
    - `lint` (flake8)
    - `typecheck` (mypy)
    - `security` (bandit)
    - `build` (Docker image builds)
  - Require branches to be up to date before merging

- ✅ Require code review from CODEOWNERS
  - File: `.github/CODEOWNERS`
  ```
  # CODEOWNERS
  * @devops
  autoflow/core/* @dev
  tests/* @qa
  docs/* @pm
  ```

- ✅ Allow auto-merge
  - Squash and merge (clean history)
  - Delete head branch on merge

---

## Quality Gates (Enforcement)

### Local (Pre-commit)

Runs **before** commit:
```
git add autoflow/
git commit -m "..."
  → black (format)
  → flake8 (lint)
  → mypy (type check)
  → bandit (security)
  → YAML validation
  → Commit created OR fails with error
```

### CI/CD (GitHub Actions)

Runs **on push/PR**:
```
git push origin feature/...
  → GitHub Actions triggered
  → .github/workflows/ci.yml runs
  → 5 parallel jobs:
    1. pytest (coverage)
    2. flake8 (lint)
    3. mypy (type check)
    4. bandit (security)
    5. docker build
  → All pass? Merge button available
  → Any fail? Merge button disabled
```

### Merge Gate

**Requirements to merge PR to main:**
- ✅ All CI/CD checks pass (5 jobs)
- ✅ 1+ code review approval
- ✅ Branches up to date with main
- ✅ No merge conflicts

---

## Workflow: Feature → Main

### Step 1: Feature Development

```bash
git checkout -b feature/my-feature
# ... write code ...

# Pre-commit hooks run automatically
git add autoflow/
git commit -m "feat: implement X [Story 4.9]"
# ↓ Hooks run: black, flake8, mypy, bandit
# ✅ Pass? Commit created
# ❌ Fail? Fix errors, retry
```

### Step 2: Push to Remote

```bash
git push origin feature/my-feature
# ↓ GitHub Actions triggered (.github/workflows/ci.yml)
# ↓ 5 jobs run in parallel:
#   1. test (pytest)
#   2. lint (flake8)
#   3. typecheck (mypy)
#   4. security (bandit)
#   5. build (docker)
# ✅ All pass? PR ready for review
```

### Step 3: Code Review

```
Create PR via GitHub UI or:
gh pr create --title "feat: ..." --body "## Summary..."

Reviewers notified (from CODEOWNERS)
- Review code
- Request changes or approve
```

### Step 4: Merge to Main

```bash
# After 1+ approvals and all checks passing:
gh pr merge --squash  # or merge via GitHub UI

# On merge:
- Automatic tests run
- If all pass: merge to main
- Delete feature branch (auto)
- Deploy to production (if enabled)
```

---

## Troubleshooting

### Pre-commit hook fails locally

```bash
# See what failed
git commit -m "..."  # Will show error

# Common fixes:
pre-commit run black --all-files  # Auto-format
pre-commit run flake8 --all-files  # Show lint errors

# Then:
git add <fixed files>
git commit -m "..."
```

### CI/CD job fails (GitHub Actions)

```
GitHub UI → Actions → <job name> → Logs

Common failures:
- test: pytest found errors → fix tests
- lint: flake8 violations → run black
- typecheck: mypy errors → add type hints
- security: bandit found issue → review code
- build: Docker build failed → check Dockerfile
```

### Can't merge PR (branch protection)

Checklist:
- [ ] All 5 CI/CD jobs passed (green ✅)
- [ ] At least 1 code review approval
- [ ] Branch up to date with main (`Merge branch...` button)
- [ ] No conflicts

If stuck:
```bash
git pull origin main  # Update local
git push origin feature/my-feature  # Re-run CI
```

---

## Monitoring

### Coverage Reports

After every test run:
```
GitHub UI → Actions → test job → Coverage report
- Current coverage: XX%
- Trend: ↑ or ↓
- Files below target: highlighted
```

Target: **> 80% coverage**

### Status Checks Dashboard

```
GitHub UI → Insights → Actions
- Test success rate
- Average build time
- Failure trends
```

---

## Files Generated

| File | Purpose |
|------|---------|
| `.github/workflows/ci.yml` | GitHub Actions pipeline (5 jobs) |
| `.pre-commit-config.yaml` | Local hooks (black, flake8, mypy, bandit) |
| `.github/CODEOWNERS` | Code ownership rules |
| `docs/GITHUB-SETUP.md` | This guide |

---

## Next Steps

1. Run locally:
   ```bash
   cd /root/autoflow
   pre-commit install
   pre-commit run --all-files
   ```

2. Push to GitHub:
   ```bash
   git add .github/ .pre-commit-config.yaml docs/GITHUB-SETUP.md
   git commit -m "ci: GitHub Actions + branch protection setup"
   git push origin main
   ```

3. Configure branch protection in GitHub UI (Settings → Branches)

---

**Status:** Article V (Quality First) remediated ✅
