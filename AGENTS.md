# Repository Guidelines

## Project Structure & Module Organization
The FastAPI control plane lives in `app.py`, coordinating task orchestration via helpers such as `mission_manager.py`, `task_scheduler.py`, and `projects_manager.py`. UI assets, agent prompt templates, and client-side scripts sit in `static/` (`static/agents` for role definitions, `static/js` for widgets). Integration adapters are grouped under `mcp_services/`, each service keeping its own client code and templates. Runtime artifacts live in `mission/`, `mobile_results/`, and `tasks.json`; avoid committing them unless the change is deliberate. Reference media stays in `docs/screenshots/`.

## Build, Test, and Development Commands
Install dependencies before running anything:
```bash
pip install -r requirements.txt
```
Launch the local workspace UI:
```bash
python app.py
```
Use the deployment helper when you need to refresh the bundled digital employees:
```bash
python deploy_agents.py
```
Service integrations provide their own checks, e.g. the SMTP probe:
```bash
node mcp_services/smtp-mail/test-email.js
```

## Coding Style & Naming Conventions
Follow PEP 8 with four-space indentation for Python; new modules should use snake_case file names and type-annotated function signatures where practical. Mirror the concise module docstrings already present in core files. Front-end assets use kebab-case names and store styles in `static/css`; keep DOM hooks prefixed with `js-`. Configuration constants belong in `config.py`, while user overrides load through `user_config.py`.

## Testing Guidelines
There is no dedicated automated suite yet. Validate backend flows by running `python app.py`, exercising the new path through the UI or CLI hooks, and attaching key log excerpts. For service connectors, extend lightweight probes (mirroring `test-email.js`) and document the steps in your PR. When a change affects mobile dashboards, share an updated screenshot from `docs/screenshots/` or an emulator capture.

## Commit & Pull Request Guidelines
Commits follow a Conventional Commit style (`fix:`, `chore:`, `feat:`) as seen in history; keep each commit focused on one logical change. Pull requests should explain motivation, list verification steps (commands, manual flows, log captures), and attach screenshots for UI updates. Link to tracking issues or missions when applicable, and call out configuration changes so reviewers can update `user_config.py`.

## Security & Configuration Tips
Never commit live credentials—`user_config.py` and environment variables (`HELIKI_HOST`, `HELIKI_PORT`, SMTP secrets) must be sanitized before sharing diffs. Files written to `~/.claude/agents` by `deploy_agents.py` are user-specific; mention these side effects in your notes. When adding new MCP services, document required keys inside a README within the service folder to keep sensitive data out of source control.
