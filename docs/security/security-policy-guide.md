# Security Policy and Disclosure Guidelines

## Reporting Vulnerabilities
If you discover a security vulnerability within Cyrus, please report it privately via GitHub Security Advisories or email security@cyrus.ai.

## Supported Versions
Only the latest version deployed on the default `main` branch receives official security updates.

## Secret Hygiene
- Never commit `.env.local` or API tokens to source control.
- Use GitHub Secrets for CI/CD workflows.
