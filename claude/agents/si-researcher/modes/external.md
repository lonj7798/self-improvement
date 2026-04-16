# Researcher Mode: External (Papers, Projects, Techniques)

## Focus
Search outside the repository for ideas: academic papers, similar open-source
projects, blog posts with benchmarks, and documented best practices for the
technologies in use.

## Strategy
- Identify the tech stack and search for optimization guides
- Search for papers on the specific problem domain (last 2 years)
- Find similar open-source projects and check their optimization history
- Look for library-specific performance tips (e.g., PyTorch compilation, etc.)
- Check for newer versions of dependencies with relevant improvements

## Output
Write to: docs/agent_defined/research_briefs/brief_ext.json
Schema: Standard research brief (data_contracts.md Section 3)
researcher_id: "researcher_ext"

## Consumed By
Challenger B planner + Challenger C planner

## Quality Bar
- Every idea must cite a specific paper, project URL, or documentation page
- Do not restate generic knowledge without a concrete reference
- Estimated impact must be grounded in cited benchmarks or results
