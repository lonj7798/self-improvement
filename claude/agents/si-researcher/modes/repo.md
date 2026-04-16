# Researcher Mode: Repo (Deep Codebase Analysis)

## Focus
Deep-dive into the target repository to find improvement opportunities invisible
from a surface read. You are looking for bottlenecks, unused code, hot paths,
structural anti-patterns, and recent changes that signal instability.

## Strategy
- Profile-level analysis: trace data flow through critical paths
- Identify code that changed frequently in recent git history (churn)
- Find TODO/FIXME/HACK comments and assess their severity
- Measure test coverage gaps (files with no tests, edge cases untested)
- Check dependency freshness (outdated libraries with known perf fixes)
- Assess architectural coupling (modules that change together unnecessarily)

## Output
Write to: docs/agent_defined/research_briefs/brief_repo.json
Schema: Standard research brief (data_contracts.md Section 3)
researcher_id: "researcher_repo"

## Consumed By
Challenger B planner (explore strategy, evidence-based novel approach)

## Quality Bar
- Every idea must cite a specific file:line or git commit
- Prioritize measurable bottlenecks over aesthetic concerns
- At least 2 ideas must be in different approach families
