# GitHub Secrets — Required Configuration

This project requires specific GitHub Actions secrets for CI/CD workflows.

## `MY_OWN_TOKEN` — GitHub Personal Access Token (PAT)

**Used by:**
- `.github/workflows/opencode-review.yml` — posts review comments on PRs
- `.github/workflows/release-please.yml` — creates release PRs and tags

**Why `GITHUB_TOKEN` cannot replace it:** The built-in `secrets.GITHUB_TOKEN` cannot trigger downstream workflow runs. `release-please.yml` creates PRs and tags that must trigger the `release.yml` workflow — only a PAT can accomplish this.

**Configuration:**
1. Generate a classic PAT at https://github.com/settings/tokens
   - Scopes required: `repo` (full control of private repositories)
   - Alternatively use a fine-grained PAT with: `Contents: write`, `Pull Requests: write`, `Issues: write`
2. Add it as a repository secret: Settings → Secrets and variables → Actions → New repository secret
   - Name: `MY_OWN_TOKEN`
   - Value: (your PAT)
3. The PAT must belong to a user with push access to this repository.

**Rotation:** This token should be rotated periodically following GitHub's security guidelines.
