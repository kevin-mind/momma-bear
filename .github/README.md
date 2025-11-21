# CI/CD Workflows

This directory contains GitHub Actions workflows for continuous integration and deployment.

## Core Principles

### 1. Small, Composable Actions

Actions should be small, focused, and do one thing well. Each action should have a single responsibility and be reusable across multiple workflows.

### 2. No Action-to-Action Dependencies

**Actions should never call other actions.** Actions are atomic units of work. Workflows compose actions together, not actions themselves.

✅ **Good:**
```yaml
# Workflow composes actions
steps:
  - uses: ./.github/actions/setup-node
  - uses: ./.github/actions/check
  - uses: ./.github/actions/e2e-tests
```

❌ **Bad:**
```yaml
# Action calling another action
runs:
  using: 'composite'
  steps:
    - uses: ./.github/actions/setup-node  # Don't do this!
    - run: npm run lint
```

### 3. Workflows Compose Actions

Workflows are responsible for orchestrating actions in the correct order. They handle:
- Setting up prerequisites (checkout, Node.js setup)
- Calling actions in sequence
- Passing inputs and environment variables
- Handling conditional logic

## Available Actions

### `setup-node`

Sets up Node.js and installs dependencies.

**Inputs:**
- `node-version` (optional, default: `'18'`)
- `cache` (optional, default: `'npm'`)

**Usage:**
```yaml
- name: Setup Node.js
  uses: ./.github/actions/setup-node
  with:
    node-version: '18'
```

**What it does:**
- Configures Node.js using `actions/setup-node@v4`
- Runs `npm ci` to install dependencies

### `check`

Runs code quality checks and builds the application.

**Inputs:** None

**Usage:**
```yaml
- name: Check (lint and build)
  uses: ./.github/actions/check
```

**What it does:**
- Runs `npm run lint`
- Runs `npm run build`

### `e2e-tests`

Runs Playwright end-to-end tests.

**Inputs:**
- `base-url` (optional, default: `'http://localhost:3000'`)

**Usage:**
```yaml
- name: Run E2E tests
  uses: ./.github/actions/e2e-tests
  with:
    base-url: ${{ inputs.playwright-base-url }}
```

**What it does:**
- Installs Playwright browsers (`npx playwright install --with-deps`)
- Runs E2E tests (`npm run test`)
- Uses `PLAYWRIGHT_BASE_URL` environment variable

### `setup-shopify-cli`

Authenticates and configures Shopify CLI for deployment.

**Inputs:**
- `auth-token` (required): Shopify CLI authentication token
- `store-url` (optional): Shopify store URL
- `access-token` (optional): Shopify store access token

**Usage:**
```yaml
- name: Authenticate with Shopify CLI
  uses: ./.github/actions/setup-shopify-cli
  with:
    auth-token: ${{ secrets.SHOPIFY_CLI_AUTH_TOKEN }}
    store-url: ${{ secrets.SHOPIFY_STORE_URL }}
    access-token: ${{ secrets.SHOPIFY_ACCESS_TOKEN }}
```

**What it does:**
- Sets up environment variables for Shopify CLI authentication
- Exports credentials for use in subsequent steps

### `deploy`

Deploys the application using Shopify CLI.

**Inputs:**
- `preview` (optional, default: `false`, type: boolean): Deploy to preview environment

**Environment Variables Required:**
- `SHOPIFY_CLI_AUTH_TOKEN`
- `SHOPIFY_STORE_URL`
- `SHOPIFY_ACCESS_TOKEN`

**Usage:**
```yaml
- name: Deploy to production
  env:
    SHOPIFY_CLI_AUTH_TOKEN: ${{ secrets.SHOPIFY_CLI_AUTH_TOKEN }}
    SHOPIFY_STORE_URL: ${{ secrets.SHOPIFY_STORE_URL }}
    SHOPIFY_ACCESS_TOKEN: ${{ secrets.SHOPIFY_ACCESS_TOKEN }}
  uses: ./.github/actions/deploy
  with:
    preview: false
```

**What it does:**
- Deploys to production: `shopify hydrogen deploy` or `shopify app deploy`
- Deploys to preview: `shopify hydrogen deploy --preview` or `shopify app deploy --preview`
- Exits with error code on production deployment failure

## Workflows

### CI (`ci.yml`)

Reusable workflow that runs linting, tests, and builds. Can be called by other workflows.

**Triggers:**
- Called by other workflows via `workflow_call`

**Inputs:**
- `node-version` (optional, default: `'18'`)
- `playwright-base-url` (optional): Base URL for Playwright tests

**Jobs:**
- `ci`: Runs lint, test (if base URL provided), and build

**Pattern:**
```yaml
steps:
  - name: Checkout code
    uses: actions/checkout@v4

  - name: Setup Node.js
    uses: ./.github/actions/setup-node
    with:
      node-version: '18'

  - name: Check (lint and build)
    uses: ./.github/actions/check

  - name: Run E2E tests
    if: inputs.playwright-base-url != ''
    uses: ./.github/actions/e2e-tests
    with:
      base-url: ${{ inputs.playwright-base-url }}
```

### PR Preview Deployment (`pr-preview.yml`)

Deploys pull requests to a preview environment after CI passes.

**Triggers:**
- Pull request events (opened, synchronize, reopened)

**Jobs:**
- `ci`: Runs CI checks
- `deploy-preview`: Deploys to preview and comments PR with URL

**Pattern:**
```yaml
steps:
  - name: Setup Node.js
    uses: ./.github/actions/setup-node

  - name: Authenticate with Shopify CLI
    uses: ./.github/actions/setup-shopify-cli

  - name: Deploy to preview environment
    uses: ./.github/actions/deploy
    with:
      preview: true
```

### Merge Queue Deployment (`merge-queue.yml`)

Deploys to production via merge queue, runs E2E tests, and triggers rollback on failure.

**Triggers:**
- Merge group events (when PR enters merge queue)

**Jobs:**
- `ci`: Runs CI checks
- `deploy-production`: Deploys to production, runs E2E tests, triggers rollback on failure

**Pattern:**
```yaml
steps:
  - name: Setup Node.js
    uses: ./.github/actions/setup-node

  - name: Authenticate with Shopify CLI
    uses: ./.github/actions/setup-shopify-cli

  - name: Deploy to production
    uses: ./.github/actions/deploy
    with:
      preview: false

  - name: Run E2E tests against production
    uses: ./.github/actions/e2e-tests
    with:
      base-url: ${{ steps.production-url.outputs.url }}
```

### Rollback (`rollback.yml`)

Rolls back to a previous deployment version.

**Triggers:**
- `workflow_run`: Automatically triggered when merge queue deployment fails
- `workflow_dispatch`: Can be manually triggered

**Jobs:**
- `rollback`: Checks out previous commit and redeploys

## Required Secrets

Configure these secrets in your GitHub repository settings (Settings → Secrets and variables → Actions):

- `SHOPIFY_CLI_AUTH_TOKEN`: Shopify CLI authentication token
- `SHOPIFY_STORE_URL`: (Optional) Your Shopify store URL
- `SHOPIFY_ACCESS_TOKEN`: (Optional) Shopify store access token
- `PRODUCTION_URL`: (Optional) Production deployment URL for E2E tests

## Setup Instructions

1. **Configure GitHub Secrets:**
   - Go to your repository → Settings → Secrets and variables → Actions
   - Add the required secrets listed above

2. **Enable Merge Queue:**
   - Go to your repository → Settings → Branches
   - Enable merge queue for your main branch
   - Configure required status checks to include:
     - `CI` (from `ci.yml`)
     - `Deploy to Production` (from `merge-queue.yml`)

3. **Adjust Shopify CLI Commands:**
   - Review the deployment commands in the `deploy` action
   - Update them based on your Shopify CLI version and deployment method
   - Common commands:
     - `shopify hydrogen deploy` (for Hydrogen apps)
     - `shopify app deploy` (for Shopify apps)
     - `shopify hydrogen deploy --preview` (for preview deployments)

4. **Configure Production URL:**
   - Set the `PRODUCTION_URL` secret if your deployment doesn't output a URL
   - Or update the workflow to parse the URL from deployment output

## Creating New Actions

When creating a new action, follow these guidelines:

1. **Single Responsibility**: Each action should do one thing well
2. **No Dependencies**: Actions should not call other actions
3. **Clear Inputs**: Define inputs with descriptions and defaults where appropriate
4. **Documentation**: Add clear descriptions explaining what the action does
5. **Environment Variables**: Document required environment variables if any

**Action Template:**
```yaml
name: 'Action Name'
description: 'Clear description of what this action does'

inputs:
  input-name:
    description: 'Description of the input'
    required: false
    default: 'default-value'

runs:
  using: 'composite'
  steps:
    - name: Step description
      shell: bash
      run: |
        # Action implementation
```

## Best Practices

1. **Keep Actions Focused**: If an action is doing multiple unrelated things, split it into multiple actions
2. **Use Composite Actions**: All custom actions should use `composite` runs type
3. **Explicit Shell**: Always specify `shell: bash` for composite action steps
4. **Environment Variables**: Pass environment variables at the workflow level, not within actions
5. **Error Handling**: Let actions fail naturally - workflows handle error conditions
6. **Reusability**: Design actions to be reusable across different workflows

## Environment Variables

- `PLAYWRIGHT_BASE_URL`: Base URL for Playwright E2E tests (set automatically in workflows)

## Notes

- The merge queue workflow will automatically prevent merging if any step fails
- Rollback is triggered automatically when merge queue deployment fails
- Preview deployments are only created for PRs from the same repository (not forks)
- All workflows use Node.js 18+ as specified in `package.json`
- Workflows should be organized by purpose:
  - **CI workflows**: Run checks and tests
  - **Deployment workflows**: Handle deployments
  - **Utility workflows**: Reusable workflows called by other workflows
