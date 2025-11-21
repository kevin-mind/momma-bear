# CI/CD Setup Summary

This document summarizes the CI/CD setup that has been implemented for continuous deployment with merge queue integration.

## What Was Implemented

### 1. Playwright E2E Testing
- **Configuration**: `playwright.config.js` with environment variable support (`PLAYWRIGHT_BASE_URL`)
- **Tests**: `tests/e2e/critical.spec.js` with basic critical path tests:
  - App loads successfully
  - Homepage renders products
  - Product pages load and render
  - Collections pages load and display products
- **Scripts**: Added `test`, `test:ui`, and `test:report` scripts to `package.json`

### 2. GitHub Actions Workflows

#### CI Workflow (`.github/workflows/ci.yml`)
- Reusable workflow for lint, test, and build
- Can be called by other workflows
- Tests only run if `playwright-base-url` input is provided

#### PR Preview Workflow (`.github/workflows/pr-preview.yml`)
- Triggers on pull request events
- Runs CI checks first
- Deploys to preview environment using Shopify CLI
- Comments PR with preview URL

#### Merge Queue Workflow (`.github/workflows/merge-queue.yml`)
- Triggers on merge group events (when PR enters merge queue)
- Runs CI checks
- Deploys to production
- Runs E2E tests against production URL
- Automatically prevents merge if any step fails
- Triggers rollback workflow on failure

#### Rollback Workflow (`.github/workflows/rollback.yml`)
- Automatically triggered when merge queue deployment fails
- Can also be manually triggered via `workflow_dispatch`
- Checks out previous commit and redeploys

### 3. Reusable Actions

#### Setup Shopify CLI (`.github/actions/setup-shopify-cli/action.yml`)
- Handles Shopify CLI authentication
- Supports multiple authentication methods (token, store URL + access token)

#### Run CI (`.github/actions/run-ci/action.yml`)
- Reusable action for CI steps (lint, test, build)
- Can be used in composite workflows

## Required Setup Steps

### 1. Install Dependencies
```bash
npm install
npx playwright install --with-deps
```

### 2. Configure GitHub Secrets
Go to your repository → Settings → Secrets and variables → Actions and add:

- `SHOPIFY_CLI_AUTH_TOKEN`: Your Shopify CLI authentication token
- `SHOPIFY_STORE_URL`: (Optional) Your Shopify store URL
- `SHOPIFY_ACCESS_TOKEN`: (Optional) Shopify store access token
- `PRODUCTION_URL`: (Optional) Production deployment URL for E2E tests

### 3. Enable Merge Queue
1. Go to your repository → Settings → Branches
2. Enable merge queue for your main branch
3. Configure required status checks:
   - `CI` (from `ci.yml`)
   - `Deploy to Production` (from `merge-queue.yml`)

### 4. Adjust Shopify CLI Commands
Review and update the deployment commands in:
- `.github/workflows/pr-preview.yml` (line ~55)
- `.github/workflows/merge-queue.yml` (line ~57)
- `.github/workflows/rollback.yml` (line ~75)

Common commands:
- `shopify hydrogen deploy` (for Hydrogen apps)
- `shopify app deploy` (for Shopify apps)
- `shopify hydrogen deploy --preview` (for preview deployments)

### 5. Configure Production URL
The workflows need to know the production URL for E2E tests. Options:
- Set `PRODUCTION_URL` secret
- Update workflows to parse URL from deployment output
- Use `SHOPIFY_STORE_URL` if it matches your production URL

## How It Works

### PR Flow
1. Developer opens a PR
2. PR Preview workflow triggers
3. CI checks run (lint, build)
4. If CI passes, deploy to preview
5. Comment added to PR with preview URL

### Merge Queue Flow
1. PR is approved and enters merge queue
2. Merge Queue Deployment workflow triggers
3. CI checks run
4. If CI passes, deploy to production
5. Wait for deployment to be ready
6. Run E2E tests against production
7. If tests pass, merge proceeds automatically
8. If tests fail, merge is blocked and rollback triggers

### Rollback Flow
1. Triggered automatically when merge queue deployment fails
2. Can also be manually triggered
3. Checks out previous successful commit
4. Redeploys previous version
5. Creates notification

## Testing Locally

Run Playwright tests locally:
```bash
# Run tests (requires PLAYWRIGHT_BASE_URL env var)
PLAYWRIGHT_BASE_URL=http://localhost:3000 npm run test

# Run tests with UI
npm run test:ui

# View test report
npm run test:report
```

## Notes

- All workflows use Node.js 18+ as specified in `package.json`
- Preview deployments only work for PRs from the same repository (not forks)
- Merge queue automatically prevents merging if any check fails
- Rollback is triggered automatically on deployment failure
- E2E tests are skipped in CI workflow if no base URL is provided

## Troubleshooting

### Tests failing in CI
- Ensure `PLAYWRIGHT_BASE_URL` is set correctly
- Check that the deployment URL is accessible
- Review Playwright test output for specific failures

### Deployment commands not working
- Verify Shopify CLI is installed and authenticated
- Check that the correct deployment command is used for your Shopify setup
- Review Shopify CLI documentation for your version

### Rollback not triggering
- Check that the rollback workflow is enabled
- Verify `workflow_run` trigger is configured correctly
- Manually trigger rollback if needed via Actions tab


