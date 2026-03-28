#!/usr/bin/env python3
"""plot_progress.py — Visualize self-improvement loop benchmark progress."""

import json
import os
import sys
from collections import defaultdict

# Resolve paths relative to project root (one level up from scripts/)
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
RAW_DATA_PATH = os.path.join(PROJECT_ROOT, "tracking_history", "raw_data.json")
SETTINGS_PATH = os.path.join(PROJECT_ROOT, "docs", "user_defined", "settings.json")
OUTPUT_PATH = os.path.join(PROJECT_ROOT, "tracking_history", "progress.png")

APPROACH_COLORS = {
    "architecture":    "blue",
    "training_config": "green",
    "data":            "orange",
    "infrastructure":  "red",
    "optimization":    "purple",
    "testing":         "cyan",
    "documentation":   "brown",
    "other":           "gray",
}


def load_json(path, default=None):
    if not os.path.exists(path):
        print(f"Warning: file not found: {path}")
        return default
    try:
        with open(path) as f:
            return json.load(f)
    except json.JSONDecodeError as exc:
        print(f"Warning: could not parse {path}: {exc}")
        return default


def flatten_if_nested(data):
    """Handle backwards compatibility: if entries use the old nested format
    with a 'candidates' key, flatten them to the expected flat format."""
    flat = []
    for entry in data:
        if "candidates" in entry:
            iteration = entry.get("iteration", 0)
            for candidate in entry["candidates"]:
                flat.append({
                    "iteration": iteration,
                    "plan_id": candidate.get("plan_id", ""),
                    "benchmark_score": candidate.get("score", candidate.get("benchmark_score")),
                    "is_winner": candidate.get("status") == "winner" or candidate.get("is_winner", False),
                    "approach_family": candidate.get("approach_family", "other"),
                })
        else:
            flat.append(entry)
    return flat


def main():
    data = load_json(RAW_DATA_PATH, default=[])

    if not data:
        print("No data to plot yet")
        sys.exit(0)

    # Flatten nested format if present
    data = flatten_if_nested(data)

    # Load settings
    settings = load_json(SETTINGS_PATH, default={})
    target_value = settings.get("target_value", None)
    benchmark_direction = settings.get("benchmark_direction", "higher_is_better")

    try:
        import matplotlib
        matplotlib.use("Agg")  # non-interactive backend
        import matplotlib.pyplot as plt
        import matplotlib.lines as mlines
    except ImportError:
        print("Error: matplotlib is not installed. Install with: pip install matplotlib")
        sys.exit(1)

    fig, ax = plt.subplots(figsize=(10, 6))

    # ── scatter points ─────────────────────────────────────────────────────────
    winner_iterations = []
    winner_scores = []
    legend_handles = {}

    for entry in data:
        iteration = entry.get("iteration", entry.get("plan_id", 0))
        score = entry.get("benchmark_score")
        is_winner = entry.get("is_winner", False)
        approach = entry.get("approach_family", "other")

        if score is None:
            continue

        color = APPROACH_COLORS.get(approach, "gray")
        marker = "*" if is_winner else "o"
        size = 200 if is_winner else 80

        ax.scatter(iteration, score, c=color, marker=marker, s=size, zorder=3)

        if is_winner:
            winner_iterations.append(iteration)
            winner_scores.append(score)

        # Build legend entry for this approach family (deduplicate)
        if approach not in legend_handles:
            handle = mlines.Line2D(
                [], [],
                color=color,
                marker="o",
                linestyle="None",
                markersize=8,
                label=approach,
            )
            legend_handles[approach] = handle

    # ── trend line through winners ─────────────────────────────────────────────
    if len(winner_iterations) >= 2:
        # Sort by iteration before drawing the line
        pairs = sorted(zip(winner_iterations, winner_scores))
        wx, wy = zip(*pairs)
        ax.plot(wx, wy, color="red", linestyle="--", linewidth=1.5,
                label="winner trend", zorder=2)

    # ── target value line ──────────────────────────────────────────────────────
    if target_value is not None:
        ax.axhline(y=target_value, color="black", linestyle="--",
                   linewidth=1.2, label=f"target ({target_value})", zorder=1)

    # ── legend & labels ────────────────────────────────────────────────────────
    all_handles = list(legend_handles.values())

    # Add special markers for winner/loser
    winner_handle = mlines.Line2D(
        [], [], color="black", marker="*", linestyle="None",
        markersize=12, label="winner (★)"
    )
    loser_handle = mlines.Line2D(
        [], [], color="black", marker="o", linestyle="None",
        markersize=8, label="loser (●)"
    )
    all_handles = [winner_handle, loser_handle] + all_handles

    if target_value is not None:
        target_handle = mlines.Line2D(
            [], [], color="black", linestyle="--", linewidth=1.2,
            label=f"target ({target_value})"
        )
        all_handles.append(target_handle)

    if len(winner_iterations) >= 2:
        trend_handle = mlines.Line2D(
            [], [], color="red", linestyle="--", linewidth=1.5,
            label="winner trend"
        )
        all_handles.append(trend_handle)

    ax.legend(handles=all_handles, loc="best", fontsize=9)
    ax.set_title("Self-Improvement Progress", fontsize=14, fontweight="bold")
    ax.set_xlabel("Iteration", fontsize=12)
    ax.set_ylabel("Benchmark Score", fontsize=12)
    ax.grid(True, alpha=0.3)

    # ── save ───────────────────────────────────────────────────────────────────
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    fig.tight_layout()
    fig.savefig(OUTPUT_PATH, dpi=150)
    print(f"Plot saved to {OUTPUT_PATH}")

    # ── text summary ───────────────────────────────────────────────────────────
    iter_entries = defaultdict(list)
    for entry in data:
        iteration = entry.get("iteration", entry.get("plan_id", 0))
        score = entry.get("benchmark_score")
        if score is not None:
            iter_entries[iteration].append(entry)

    for iteration in sorted(iter_entries.keys()):
        entries = iter_entries[iteration]
        if benchmark_direction == "lower_is_better":
            best_entry = min(entries, key=lambda e: e.get("benchmark_score", float("inf")))
        else:
            best_entry = max(entries, key=lambda e: e.get("benchmark_score", float("-inf")))
        best_score = best_entry.get("benchmark_score")
        approach = best_entry.get("approach_family", "unknown")
        print(f"Iteration {iteration}: best={best_score}, winner={approach}")


if __name__ == "__main__":
    main()
