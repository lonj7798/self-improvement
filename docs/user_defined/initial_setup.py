#!/usr/bin/env python3
"""Interactive setup for the self-improvement loop.
Run this before starting the orchestrator to configure all required settings."""

import hashlib
import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent.parent
USER_SETTINGS = ROOT / "docs" / "user_defined" / "settings.json"
AGENT_SETTINGS = ROOT / "docs" / "agent_defined" / "settings.json"
GOAL_FILE = ROOT / "docs" / "user_defined" / "goal.md"
REPO_FILE = ROOT / "docs" / "user_defined" / "repo.md"
HARNESS_FILE = ROOT / "docs" / "user_defined" / "harness.md"
BASELINE_FILE = ROOT / "tracking_history" / "baseline.json"
SEALED_HASHES_FILE = ROOT / ".sealed_hashes"

# All sources live in claude/ — copied to .claude/ during setup
REQUIRED_FILES = [
    "claude/agents/si-researcher/CLAUDE.md",
    "claude/agents/si-planner/CLAUDE.md",
    "claude/agents/si-planner/skills/si-plan-creator/SKILL.md",
    "claude/agents/si-planner/skills/si-plan-architect/SKILL.md",
    "claude/agents/si-planner/skills/si-plan-critic/SKILL.md",
    "claude/agents/si-executor/CLAUDE.md",
    "claude/agents/si-github-manager/CLAUDE.md",
    "claude/skills/si-goal-clarifier/SKILL.md",
    "claude/skills/si-benchmark-builder/SKILL.md",
]


def load_json(path: Path) -> dict:
    try:
        with open(path) as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"Error: file not found: {path}")
        sys.exit(1)
    except json.JSONDecodeError as exc:
        print(f"Error: could not parse {path}: {exc}")
        sys.exit(1)


def save_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
        f.write("\n")


def prompt(msg: str, default: str = "") -> str:
    suffix = f" [{default}]" if default else ""
    val = input(f"{msg}{suffix}: ").strip()
    return val or default


def confirm(msg: str, default: bool = True) -> bool:
    hint = "Y/n" if default else "y/N"
    val = input(f"{msg} [{hint}]: ").strip().lower()
    if not val:
        return default
    return val in ("y", "yes")


def compute_file_hash(filepath: Path) -> str:
    """Compute SHA-256 hash of a file."""
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def generate_sealed_hashes(user_settings: dict) -> None:
    """Generate .sealed_hashes manifest from sealed_files in settings."""
    sealed_files = user_settings.get("sealed_files", [])
    if not sealed_files:
        print("  No sealed files configured — skipping hash manifest.")
        return

    want_to_improve = ROOT / "want_to_improve"
    if not want_to_improve.exists():
        print("  Warning: want_to_improve/ not found — cannot generate sealed hashes.")
        return

    hashes = {}
    missing = []
    for sealed_path in sealed_files:
        full_path = want_to_improve / sealed_path
        if sealed_path.endswith("/"):
            # Directory pattern — hash all files within
            dir_path = want_to_improve / sealed_path.rstrip("/")
            if dir_path.is_dir():
                for child in sorted(dir_path.rglob("*")):
                    if child.is_file():
                        rel = str(child.relative_to(want_to_improve))
                        hashes[rel] = compute_file_hash(child)
            else:
                missing.append(sealed_path)
        elif full_path.is_file():
            hashes[sealed_path] = compute_file_hash(full_path)
        else:
            missing.append(sealed_path)

    if missing:
        print(f"  Warning: sealed files not found (will be checked when they exist): {missing}")

    if hashes:
        save_json(SEALED_HASHES_FILE, hashes)
        print(f"  Generated .sealed_hashes manifest ({len(hashes)} file(s)).")
    else:
        print("  No sealed files found to hash.")


def step0_check_dependencies() -> None:
    """Check that required external dependencies are available."""
    print("\n=== Step 0: Dependency Check ===")

    # Check jq
    result = subprocess.run(["which", "jq"], capture_output=True)
    if result.returncode != 0:
        print("ERROR: jq is not installed. Install it with:")
        print("  macOS: brew install jq")
        print("  Linux: apt-get install jq")
        print("Then re-run this script.")
        sys.exit(1)

    # Check matplotlib
    try:
        import matplotlib  # noqa: F401
    except ImportError:
        print("ERROR: matplotlib is not installed. Install it with:")
        print("  pip install matplotlib")
        print("Then re-run this script.")
        sys.exit(1)

    print("  All dependencies found.")


def step0_claude_setup() -> bool:
    """Verify claude/ source, then copy claude/ → .claude/."""
    import shutil
    print("\n=== Step 0: Claude Setup ===")

    # Verify all required files exist in claude/
    print("Checking claude/ source...")
    missing = []
    for path in REQUIRED_FILES:
        if not (ROOT / path).exists():
            missing.append(path)
    if missing:
        print("MISSING files:")
        for m in missing:
            print(f"  - {m}")
        print("\nSetup cannot continue. Create the missing files first.")
        return False
    print(f"  {len(REQUIRED_FILES)} file(s) verified.")

    # Copy claude/ → .claude/
    print("Installing claude/ → .claude/...")
    src = ROOT / "claude"
    dst = ROOT / ".claude"
    for subdir in ("agents", "skills"):
        src_dir = src / subdir
        dst_dir = dst / subdir
        if not src_dir.exists():
            continue
        dst_dir.mkdir(parents=True, exist_ok=True)
        for item in src_dir.iterdir():
            if item.is_dir() and item.name.startswith("si-"):
                target = dst_dir / item.name
                if target.exists():
                    shutil.rmtree(target)
                shutil.copytree(item, target)
    print("  Copied claude/ → .claude/ (agents + skills)")

    # Copy settings.json (Stop hook + env config)
    settings_src = src / "settings.json"
    settings_dst = dst / "settings.json"
    if settings_src.exists():
        dst.mkdir(parents=True, exist_ok=True)
        shutil.copy2(settings_src, settings_dst)
        print("  Copied claude/settings.json → .claude/settings.json")

    print("All agents, skills, and settings installed.")
    return True


def step1_repository(user_settings: dict) -> bool:
    """Clone or link a GitHub repo."""
    print("\n=== Step 1: Repository ===")
    want_to_improve = ROOT / "want_to_improve"

    current_url = user_settings.get("current_repo_url", "")
    if want_to_improve.exists() and (want_to_improve / ".git").exists():
        print(f"Repository already exists at want_to_improve/")
        if current_url:
            print(f"URL: {current_url}")
        if not confirm("Keep this repo?"):
            subprocess.run(["rm", "-rf", str(want_to_improve)], check=True)
        else:
            return True

    url = prompt("GitHub repo URL", current_url)
    if not url:
        print("No URL provided. Skipping.")
        return False

    print(f"Cloning {url}...")
    try:
        subprocess.run(
            ["git", "clone", url, str(want_to_improve)],
            check=True,
            capture_output=True,
            text=True,
        )
    except subprocess.CalledProcessError as e:
        print(f"Clone failed: {e.stderr}")
        return False

    user_settings["current_repo_url"] = url
    user_settings["upstream_url"] = url
    save_json(USER_SETTINGS, user_settings)

    # Fork setup
    gh_available = False
    try:
        subprocess.run(
            ["gh", "auth", "status"],
            capture_output=True, text=True, check=True,
        )
        gh_available = True
    except (subprocess.CalledProcessError, FileNotFoundError):
        pass

    if gh_available and confirm("Fork this repo for the improvement loop? (recommended)"):
        print(f"Forking {url}...")
        try:
            result = subprocess.run(
                ["gh", "repo", "fork", url, "--clone=false"],
                capture_output=True, text=True, check=True,
            )
            # Reconfigure remotes: origin=fork, upstream=original
            subprocess.run(
                ["git", "-C", str(want_to_improve), "remote", "rename", "origin", "upstream"],
                capture_output=True, text=True, check=True,
            )
            # Get fork URL by querying gh for the authenticated user's fork
            fork_list = subprocess.run(
                ["gh", "repo", "list", "--fork", "--json", "url,parent", "-q",
                 f'[.[] | select(.parent.url == "{url}" or .parent.url == "{url}.git")][0].url'],
                capture_output=True, text=True,
            )
            fork_url = fork_list.stdout.strip()
            if not fork_url:
                # Fallback: construct from gh auth status
                whoami = subprocess.run(
                    ["gh", "api", "user", "-q", ".login"],
                    capture_output=True, text=True,
                )
                username = whoami.stdout.strip()
                repo_name = url.rstrip("/").removesuffix(".git").split("/")[-1]
                if url.startswith("git@") or url.startswith("ssh://"):
                    fork_url = f"git@github.com:{username}/{repo_name}.git"
                else:
                    fork_url = f"https://github.com/{username}/{repo_name}.git"

            subprocess.run(
                ["git", "-C", str(want_to_improve), "remote", "add", "origin", fork_url],
                capture_output=True, text=True, check=True,
            )
            user_settings["fork_url"] = fork_url
            save_json(USER_SETTINGS, user_settings)
            print(f"Fork configured: origin={fork_url}, upstream={url}")
        except subprocess.CalledProcessError as e:
            print(f"Fork setup failed: {e.stderr or e}")
            print("Falling back to same-repo mode (fork_url = upstream_url).")
            user_settings["fork_url"] = url
            save_json(USER_SETTINGS, user_settings)
    else:
        if not gh_available:
            print("Note: gh CLI not found or not authenticated. Skipping fork.")
            print("  Install: https://cli.github.com/")
            print("  Auth:    gh auth login")
        print("Using same-repo mode (fork_url = upstream_url).")
        user_settings["fork_url"] = url
        save_json(USER_SETTINGS, user_settings)

    # Update repo.md
    description = prompt("Brief description of the repo (optional)")
    repo_content = f"""# Target Repository

## Repository
- **URL**: {url}
- **Branch**: main
- **Local path**: want_to_improve/

## Description
{description if description else '<!-- Brief description of what this repo does and why you want to improve it. -->'}

## Key Files
<!-- List the most important files the agents should focus on. -->

## Notes
<!-- Any context that would help agents understand this repo better. -->
"""
    REPO_FILE.write_text(repo_content)
    print("Repository configured.")
    return True


def step2_goal(agent_settings: dict) -> bool:
    """Configure the improvement goal."""
    print("\n=== Step 2: Goal ===")
    if agent_settings.get("si_setting_goal"):
        if confirm("Goal already set. Reconfigure?", default=False):
            agent_settings["si_setting_goal"] = False
        else:
            return True

    objective = prompt("What do you want to improve? (1-2 sentences)")
    if not objective:
        print("No objective provided. Skipping.")
        return False

    metric_name = prompt("Metric name (e.g., accuracy, latency, score)")
    target_value = prompt("Target value")
    direction = prompt("Direction (higher_is_better / lower_is_better)", "higher_is_better")
    in_scope = prompt("In scope (files/modules to modify)")
    out_scope = prompt("Out of scope (files/modules to avoid)", "")

    ideas = []
    print("Experiment ideas (enter empty line to finish):")
    i = 1
    while True:
        idea = prompt(f"  Idea {i}")
        if not idea:
            break
        ideas.append(idea)
        i += 1

    ideas_text = "\n".join(f"{i+1}. {idea}" for i, idea in enumerate(ideas)) if ideas else "1.\n2.\n3."

    goal_content = f"""# Improvement Goal

## Objective
{objective}

## Target Metric
- **Metric name**: {metric_name}
- **Target value**: {target_value}
- **Direction**: {direction}

## Scope
- **In scope**: {in_scope}
- **Out of scope**: {out_scope}

## Milestones (optional)

| Milestone | Target | Strategy Focus |
|-----------|--------|----------------|
| M1 | | Quick wins, low-hanging fruit |
| M2 | | Moderate improvements |
| M3 | | Harder optimizations |
| M4 | | Final push to target |

## Experiment Ideas (optional)
{ideas_text}
"""
    GOAL_FILE.write_text(goal_content)

    # Update user_defined settings with target
    user_settings = load_json(USER_SETTINGS)
    user_settings["benchmark_direction"] = direction
    if target_value:
        try:
            user_settings["target_value"] = float(target_value)
        except ValueError:
            pass
    save_json(USER_SETTINGS, user_settings)

    agent_settings["si_setting_goal"] = True
    save_json(AGENT_SETTINGS, agent_settings)
    print("Goal configured.")
    return True


def step3_benchmark(user_settings: dict, agent_settings: dict) -> bool:
    """Configure and validate the benchmark command."""
    print("\n=== Step 3: Benchmark ===")
    if agent_settings.get("si_setting_benchmark"):
        if confirm("Benchmark already set. Reconfigure?", default=False):
            agent_settings["si_setting_benchmark"] = False
        else:
            return True

    current_cmd = user_settings.get("benchmark_command", "")
    cmd = prompt("Benchmark command (run from want_to_improve/)", current_cmd)
    if not cmd:
        print("No command provided. Skipping.")
        return False

    fmt = prompt("Output format (number / pass_fail)", user_settings.get("benchmark_format", "number"))

    user_settings["benchmark_command"] = cmd
    user_settings["benchmark_format"] = fmt
    save_json(USER_SETTINGS, user_settings)

    # Test the benchmark
    want_to_improve = ROOT / "want_to_improve"
    if want_to_improve.exists() and confirm("Run benchmark now to validate and record baseline?"):
        print(f"Running: {cmd}")
        try:
            result = subprocess.run(
                ["bash", "-c", cmd], cwd=str(want_to_improve),
                capture_output=True, text=True, timeout=600,
            )
            print(f"stdout: {result.stdout.strip()}")
            if result.stderr.strip():
                print(f"stderr: {result.stderr.strip()}")

            if result.returncode != 0:
                print(f"Warning: command exited with code {result.returncode}")

            if fmt == "number":
                score_str = prompt("Enter the benchmark score from the output above")
                try:
                    score = float(score_str)
                except ValueError:
                    print("Invalid number. Benchmark not validated.")
                    return False
            else:
                passed = confirm("Did the benchmark pass?")
                score = 1.0 if passed else 0.0

            # Record baseline
            from datetime import datetime, timezone
            baseline = {
                "baseline_score": score,
                "recorded_at": datetime.now(timezone.utc).isoformat(),
            }
            BASELINE_FILE.parent.mkdir(parents=True, exist_ok=True)
            save_json(BASELINE_FILE, baseline)
            print(f"Baseline score recorded: {score}")

            agent_settings["si_setting_benchmark"] = True
            agent_settings["best_score"] = score
            save_json(AGENT_SETTINGS, agent_settings)
            return True

        except subprocess.TimeoutExpired:
            print("Benchmark timed out (10 min limit).")
            return False
        except Exception as e:
            print(f"Error running benchmark: {e}")
            return False
    else:
        print("Benchmark command saved. Run the orchestrator to validate later.")
        agent_settings["si_setting_benchmark"] = False
        save_json(AGENT_SETTINGS, agent_settings)
        return False


def step3b_agent_count(user_settings: dict) -> bool:
    """Configure how many parallel agents to run per iteration."""
    print("\n=== Step 3b: Agent Count ===")
    current = user_settings.get("number_of_agents", 3)
    print(f"Current setting: {current} agent(s) per iteration.")
    print()
    print("How many parallel agents should explore improvements each iteration?")
    print("  1 agent  — Best for scratch-level or early-stage repos.")
    print("             One hypothesis per iteration, simpler to debug, lower cost.")
    print("  2-3      — Good balance for most repos (default: 3).")
    print("             Multiple hypotheses compete each round.")
    print("  4+       — For large codebases with many improvement vectors.")
    print("             Higher cost but faster exploration.")
    print()

    # Detect scratch-level signals
    want_to_improve = ROOT / "want_to_improve"
    is_scratch = False
    if want_to_improve.exists():
        file_count = sum(1 for _ in want_to_improve.rglob("*") if _.is_file() and ".git" not in _.parts)
        if file_count < 20:
            is_scratch = True
            print(f"  Note: The repo has only {file_count} files.")
            print("  Suggestion: Start with 1 agent and scale up after the loop proves itself.")
            print()

    default = "1" if is_scratch else str(current)
    count_str = prompt("Number of agents", default)
    try:
        count = int(count_str)
        if count < 1:
            print("Must be at least 1. Setting to 1.")
            count = 1
        if count > 10:
            print(f"Warning: {count} agents is high. Each runs a full benchmark per iteration.")
            if not confirm("Continue with this count?"):
                count = 3
    except ValueError:
        print(f"Invalid number '{count_str}'. Using default ({default}).")
        count = int(default)

    user_settings["number_of_agents"] = count
    save_json(USER_SETTINGS, user_settings)
    print(f"Agent count set to {count}.")
    return True


def step4_harness(agent_settings: dict) -> bool:
    """Configure harness rules."""
    print("\n=== Step 4: Harness ===")
    if agent_settings.get("si_setting_harness"):
        if confirm("Harness already set. Reconfigure?", default=False):
            agent_settings["si_setting_harness"] = False
        else:
            return True

    print("Default rules (always active):")
    print("  H001: One hypothesis per plan")
    print("  H002: No repeat approaches (3+ consecutive)")
    print("  H003: Diversity within iteration")

    if confirm("Add custom harness rules?", default=False):
        harness = HARNESS_FILE.read_text()
        print("\nEnter custom rules (empty line to finish):")
        rules = []
        i = 100
        while True:
            name = prompt(f"  Rule H{i} name (e.g., 'No changes to tests')")
            if not name:
                break
            category = prompt(f"  Category (repetition_prevention / approach_diversity / scope_limiting)", "scope_limiting")
            description = prompt(f"  Description")
            enforcement = prompt(f"  How to enforce")
            rules.append(f"""
### H{i}: {name}
- **category**: {category}
- **description**: {description}
- **enforcement**: {enforcement}
""")
            i += 1

        if rules:
            # Append custom rules before the example rule
            insertion = "\n".join(rules)
            harness = harness.replace(
                "### H100: (example)",
                f"{insertion}\n### H100: (example)",
            )
            HARNESS_FILE.write_text(harness)
            print(f"Added {len(rules)} custom rule(s).")
    else:
        print("Using default rules.")

    agent_settings["si_setting_harness"] = True
    save_json(AGENT_SETTINGS, agent_settings)
    print("Harness configured.")

    # Generate sealed file hashes after harness is configured
    user_settings = load_json(USER_SETTINGS)
    generate_sealed_hashes(user_settings)

    return True


def main():
    print("=" * 50)
    print("  Self-Improvement Loop — Initial Setup")
    print("=" * 50)

    user_settings = load_json(USER_SETTINGS)
    agent_settings = load_json(AGENT_SETTINGS)

    # Step 0: Dependency check (always runs)
    step0_check_dependencies()

    # Step 0b: Claude setup
    if not user_settings.get("si_claude_setting"):
        if not step0_claude_setup():
            sys.exit(1)
        user_settings["si_claude_setting"] = True
        save_json(USER_SETTINGS, user_settings)
    else:
        print("\n=== Step 0: Claude Setup === (already complete)")

    # Step 1
    if not step1_repository(user_settings):
        print("Warning: Repository setup incomplete. Steps 2-4 may not work correctly.")
        if not confirm("Continue anyway?", default=False):
            sys.exit(1)
    user_settings = load_json(USER_SETTINGS)  # reload after possible changes

    # Step 2
    step2_goal(agent_settings)
    agent_settings = load_json(AGENT_SETTINGS)

    # Step 3
    step3_benchmark(user_settings, agent_settings)
    user_settings = load_json(USER_SETTINGS)
    agent_settings = load_json(AGENT_SETTINGS)

    # Step 3b
    step3b_agent_count(user_settings)
    user_settings = load_json(USER_SETTINGS)

    # Step 4
    step4_harness(agent_settings)
    agent_settings = load_json(AGENT_SETTINGS)

    # Gate check
    print("\n" + "=" * 50)
    print("  Gate Check")
    print("=" * 50)
    gates = {
        "si_claude_setting": user_settings.get("si_claude_setting", False),
        "si_setting_goal": agent_settings.get("si_setting_goal", False),
        "si_setting_benchmark": agent_settings.get("si_setting_benchmark", False),
        "si_setting_harness": agent_settings.get("si_setting_harness", False),
    }
    all_pass = True
    for key, val in gates.items():
        status = "PASS" if val else "FAIL"
        print(f"  {key}: {status}")
        if not val:
            all_pass = False

    if all_pass:
        print("\nAll gates passed. Ready to run the improvement loop.")
        print("Start the orchestrator with: claude")
    else:
        print("\nSome gates failed. Re-run this script to complete setup.")


if __name__ == "__main__":
    main()
