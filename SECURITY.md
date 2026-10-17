# Security Policy

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| main    | ✅ actively maintained |
| older   | ❌ not supported    |

## Reporting a Vulnerability

If you discover a security vulnerability in **OpenFigma**, please report it responsibly:

- **Email:** xprimestudio26@gmail.com
- Or use **GitHub Private Vulnerability Reporting**: Security tab → Report a vulnerability

**Please do NOT open a public issue for security vulnerabilities.**

### What to include

1. Description of the vulnerability
2. Steps to reproduce (PoC)
3. Affected component (e.g. API route, MCP server, canvas, storage layer)
4. Potential impact
5. Any suggested fix (optional)

### What to expect

| Stage | Timeframe |
|---|---|
| Acknowledgement | within 72 hours |
| Initial assessment | within 7 days |
| Fix / mitigation | depends on severity, coordinated disclosure |

## Security Notes for Deployments

- Never commit `.env` files — they are git-ignored, keep it that way
- Do not expose the editor API routes publicly without authentication if designs are sensitive
- The MCP server trusts `EDITOR_API_URL` — run it only with trusted clients
- Rotate any credentials you accidentally expose (then report the incident)

## Scope

In scope:

- The Next.js app and its API routes (`src/app/api/`)
- The MCP server (`mcp-server/`)
- Persistence layers (`storage.ts`, `server-state.ts`)

Out of scope:

- Third-party dependencies vulnerabilities (report upstream)
- Social engineering / physical attacks
