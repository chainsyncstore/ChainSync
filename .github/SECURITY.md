# Security Policy

## Supported Versions

Use this section to tell people about which versions of your project are currently being supported with security updates.

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

To report a security vulnerability in ChainSync:

1. **Do not disclose the vulnerability publicly**
2. Email security@example.com with details about the vulnerability
3. Include steps to reproduce the issue
4. We will acknowledge receipt within 48 hours
5. We aim to provide a timeline for resolution within 1 week
6. Once resolved, we will notify you and provide credit if appropriate

## Repository Secrets Configuration

For the CI/CD pipeline to function correctly, the following secrets must be configured in your GitHub repository settings:

1. **SNYK_TOKEN** - API token for Snyk vulnerability scanning
   - Sign up at [Snyk.io](https://snyk.io/)
   - Get your API token from Account Settings > API Token
   
2. **SEMGREP_APP_TOKEN** - API token for Semgrep scanning
   - Sign up at [Semgrep.dev](https://semgrep.dev/)
   - Get your API token from Settings > API Token
   
3. **SLACK_WEBHOOK** - Webhook URL for Slack notifications
   - Create a Slack app in your workspace
   - Enable Incoming Webhooks
   - Create a webhook for the desired channel

To add these secrets:
1. Go to your GitHub repository
2. Navigate to Settings > Secrets and variables > Actions
3. Click "New repository secret"
4. Add each secret with the exact name shown above

## Security Scanning

Our CI/CD pipeline includes multiple security scanning tools:

1. **npm audit** - For scanning npm dependencies
2. **Snyk** - For dependency and code scanning
3. **CodeQL** - GitHub's semantic code analysis engine
4. **Semgrep** - For pattern-based code scanning
5. **TruffleHog** - For secret scanning

Results from these scans are available in the GitHub Actions workflow runs.
