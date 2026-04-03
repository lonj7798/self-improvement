# Harness Rules

> Harness rules are guardrails that prevent agents from being lazy, repetitive, or over-confident.
> Critics enforce these rules — plans violating any rule are rejected before execution.

## Rule Format

Each rule has:
- **rule_id**: unique identifier (H001, H002, ...)
- **category**: repetition_prevention | approach_diversity | scope_limiting
- **description**: what the rule prevents
- **enforcement**: how the critic checks compliance

## Default Rules (always active)

### H001: One Hypothesis Per Plan
- **category**: approach_diversity
- **description**: Each plan must test exactly ONE idea. No bundled changes.
- **enforcement**: Critic verifies plan has a single `hypothesis` field. Plans with multiple hypotheses or vague "improve several things" are rejected.

### H002: No Repeat Approaches
- **category**: repetition_prevention
- **description**: Don't use the same `approach_family` more than 3 times consecutively across iterations.
- **enforcement**: Critic reads iteration_history and counts consecutive iterations where the winning approach_family matches. Rejects if >= 3.

### H003: Diversity Within Iteration
- **category**: approach_diversity
- **description**: Within a single iteration, different planners should pursue different ideas.
- **enforcement**: Critic checks that no two plans in the same round have identical `approach_family` AND similar `hypothesis`. Similar = same core technique.

## Custom Rules (user-defined)
<!-- Add your own rules here. They will be enforced. See Example Rules section below for templates. -->

## Example Rules (NOT enforced — templates only)

<!-- EXAMPLE ONLY: This rule is NOT active. Copy to "Custom Rules" section to activate it. -->
### H100: (example) No changes to CI/CD
- **category**: scope_limiting
- **description**: Don't modify GitHub Actions workflows or CI configuration.
- **enforcement**: Critic checks target_files[] doesn't include .github/ paths.
