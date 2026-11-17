# Agent Skills Specification

## Manifest Structure
Each agent skill repository must provide a valid `SKILL.md` or manifest object containing:
- `name`: Kebab-case identifier.
- `description`: Single sentence summary of agent capabilities.
- `tools`: Array of accessible tool function names.
- `entrypoint`: Script or executable command line.
