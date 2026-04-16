# Phase 2 Complete Runbook

## Pre-Deployment (Day 1)

1. ✅ Backup production database
2. ✅ Create feature branches
3. ✅ Validate all 7 Article VII gates
4. ✅ Notify stakeholders

## Deployment (Day 2, 06:00 UTC)

1. **Initialize Hermes Supervisor**
   ```bash
   npm run start:hermes
   ```

2. **Migrate PostgreSQL**
   ```bash
   npm run migrate:postgresql
   ```

3. **Deploy Central Monitor**
   ```bash
   npm run deploy:monitor
   ```

4. **Start 14 Autonomous Agents**
   ```bash
   npm run deploy:agents
   ```

5. **Enable RLS Policies**
   ```bash
   npm run enable:rls
   ```

## Post-Deployment Validation

- ✅ All 6 systems reporting UP
- ✅ Zero memory sync errors
- ✅ Health checks passing
- ✅ Incident responder armed

## Rollback Procedure

If critical issue:
1. Stop Hermes: `npm run stop:hermes`
2. Restore database snapshot
3. Rollback code: `git revert <commit>`
4. Notify team

