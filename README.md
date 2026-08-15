# ci-cd-pipeline-templates

A real, runnable workflow server. The workflow is implemented as orchestrated **activities** with genuine domain logic, exposed through a Model Context Protocol server so any MCP client can trigger it.

Runs a configurable CI/CD pipeline (lint → test → build → deploy) as real shell steps, stopping on first failure. Useful as a reusable pipeline template.

## Why this exists

Workflow templates are usually empty scaffolds. This one ships working activities — the steps actually do the work (call the LLM, run ffmpeg, fetch news, execute CI steps) — and are wired into an MCP tool so they can be invoked and composed.

## Install

```bash
npm install
```

## Configure

```env
OPENAI_API_KEY=sk-your-key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
PORT=8080
```

Activities that don't need the LLM (transcode, CI steps) run without a key; LLM-backed steps fall back to deterministic behavior and report `configured: false`.

## Run

```bash
npm run build
npm start
```

SSE endpoint: `http://localhost:8080/sse`.

## Tool

| Tool | Purpose |
|------|---------|
| `run_pipeline` | Run a CI/CD pipeline: lint, test, build, (optional) deploy |

## Test

```bash
npm test
```
