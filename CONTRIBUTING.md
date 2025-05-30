# Contributing to ChainSync

Thank you for your interest in contributing to ChainSync! This document provides guidelines and workflows to ensure smooth collaboration.

## Development Process

1. **Fork the repository** and create your branch from `main`.
2. **Install dependencies**: `npm install`
3. **Setup pre-commit hooks**: `pip install pre-commit && pre-commit install`
4. **Make your changes** and add tests if applicable.
5. **Run tests locally**: `npm test`
6. **Submit a pull request**

## Code Style and Quality

- Follow the ESLint configuration
- Write tests for new features
- Keep code modular and maintainable
- Use meaningful variable names and add comments for complex logic

## Git Workflow

1. Create feature branches from `develop` using naming convention: `feature/your-feature-name`
2. Create bugfix branches using: `bugfix/issue-description`
3. Keep commits small and focused
4. Write meaningful commit messages that explain *why* not just *what*

## CI/CD Pipeline

ChainSync uses GitHub Actions for CI/CD. When you submit a PR, these workflows will run:

### 1. Tests Workflow (`tests.yml`)
- Runs unit and integration tests
- Performs type checking
- Runs ESLint for code quality

### 2. Security Scan Workflow (`security-scan.yml`)
- Scans dependencies for vulnerabilities
- Performs static code analysis
- Checks for secrets accidentally committed

### 3. Workflow Validation (`validate-workflows.yml`)
- Validates all GitHub Actions workflow files
- Ensures no deprecated actions are used
- Checks for configuration errors

## Required Secrets for CI/CD

For maintainers who need to set up the CI/CD pipeline, these secrets are required in the GitHub repository:

- `SNYK_TOKEN` - For vulnerability scanning
- `SEMGREP_APP_TOKEN` - For code scanning
- `SLACK_WEBHOOK` - For Slack notifications

## Deployment

The project supports staged deployments:

1. **Staging**: Automatically deployed from the `main` branch
2. **Production**: Manually triggered via GitHub Actions workflow dispatch

## Troubleshooting CI/CD Issues

If you encounter CI/CD failures:

1. Check the GitHub Actions logs for specific error messages
2. Ensure all required secrets are properly configured
3. Validate your workflow files locally using pre-commit hooks
4. Test your changes with the latest dependencies

## Questions?

If you have any questions about the contribution process, please open an issue with the tag "question".
