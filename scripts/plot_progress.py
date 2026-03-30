#!/usr/bin/env python3
"""plot_progress.py — Visualize self-improvement loop benchmark progress.

Phase 2 features:
  --dimension NAME   Plot a specific sub-score dimension instead of primary score
  --all-dimensions   Plot all discovered sub-score dimensions as trend lines
  Phase bands and event markers from tracking_history/events.json
"""

import argparse
import json
import os
import sys
from collections import defaultdict

# Resolve paths relative to project root (one level up from scripts/)
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
RAW_DATA_PATH = os.path.join(PROJECT_ROOT, "tracking_history", "raw_data.json")
SETTINGS_PATH = os.path.join(PROJECT_ROOT, "docs", "user_defined", "settings.json")
EVENTS_PATH = os.path.join(PROJECT_ROOT, "tracking_history", "events.json")
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

# Colors for sub-score dimension lines (cycled)
DIMENSION_COLORS = [
    "#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd",
    "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf",
]


def load_json(path, default=None):
    if not os.path.exists(path):
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
                flat_entry = {
                    "iteration": iteration,
                    "plan_id": candidate.get("plan_id", ""),
                    "benchmark_score": candidate.get("score", candidate.get("benchmark_score")),
                    "is_winner": candidate.get("status") == "winner" or candidate.get("is_winner", False),
                    "approach_family": candidate.get("approach_family", "other"),
                }
                if "sub_scores" in candidate:
                    flat_entry["sub_scores"] = candidate["sub_scores"]
                flat.append(flat_entry)
        else:
            flat.append(entry)
    return flat


def discover_dimensions(data):
    """Find all unique sub-score dimension names across all entries."""
    dims = set()
    for entry in data:
        sub = entry.get("sub_scores")
        if isinstance(sub, dict):
            dims.update(sub.keys())
    return sorted(dims)


def get_winner_dimension_series(data, dimension):
    """Extract (iteration, value) pairs for a specific dimension from winners."""
    points = []
    for entry in data:
        if not entry.get("is_winner", False):
            continue
        sub = entry.get("sub_scores")
        if isinstance(sub, dict) and dimension in sub:
            val = sub[dimension]
            if val is not None:
                points.append((entry.get("iteration", 0), val))
    return sorted(points)


def parse_events(events):
    """Parse events into phase transitions and config changes with iterations."""
    phase_transitions = []
    config_changes = []
    for evt in events:
        iteration = evt.get("iteration")
        if iteration is None:
            continue
        etype = evt.get("event_type")
        details = evt.get("details", {})
        if etype == "phase_transition":
            phase_transitions.append({
                "iteration": iteration,
                "from_phase": details.get("from_phase"),
                "to_phase": details.get("to_phase"),
                "reason": details.get("reason", ""),
            })
        elif etype == "config_change":
            config_changes.append({
                "iteration": iteration,
                "field": details.get("field", ""),
                "old_value": details.get("old_value"),
                "new_value": details.get("new_value"),
            })
    return phase_transitions, config_changes


def main():
    parser = argparse.ArgumentParser(description="Plot self-improvement progress")
    parser.add_argument("--dimension", type=str, default=None,
                        help="Plot a specific sub-score dimension on the Y-axis instead of primary score")
    parser.add_argument("--all-dimensions", action="store_true",
                        help="Overlay all sub-score dimension trend lines on the main chart")
    parser.add_argument("--output", type=str, default=None,
                        help="Custom output path for the plot")
    args = parser.parse_args()

    data = load_json(RAW_DATA_PATH, default=[])

    if not data:
        print("No data to plot yet")
        sys.exit(0)

    # Flatten nested format if present
    data = flatten_if_nested(data)

    # Load settings and events
    settings = load_json(SETTINGS_PATH, default={})
    events = load_json(EVENTS_PATH, default=[])
    target_value = settings.get("target_value", None)
    benchmark_direction = settings.get("benchmark_direction", "higher_is_better")

    output_path = args.output or OUTPUT_PATH

    try:
        import matplotlib
        matplotlib.use("Agg")  # non-interactive backend
        import matplotlib.pyplot as plt
        import matplotlib.lines as mlines
    except ImportError:
        print("Error: matplotlib is not installed. Install with: pip install matplotlib")
        sys.exit(1)

    fig, ax = plt.subplots(figsize=(12, 7))

    # Determine Y-axis: primary score or specific dimension
    use_dimension = args.dimension
    if use_dimension:
        y_label = f"Sub-Score: {use_dimension}"
        title_suffix = f" — {use_dimension}"
    else:
        y_label = "Benchmark Score"
        title_suffix = ""

    # ── scatter points ─────────────────────────────────────────────────────────
    winner_iterations = []
    winner_scores = []
    legend_handles = {}

    for entry in data:
        iteration = entry.get("iteration", entry.get("plan_id", 0))
        is_winner = entry.get("is_winner", False)
        approach = entry.get("approach_family", "other")

        if use_dimension:
            sub = entry.get("sub_scores")
            score = sub.get(use_dimension) if isinstance(sub, dict) else None
        else:
            score = entry.get("benchmark_score")

        if score is None:
            continue

        color = APPROACH_COLORS.get(approach, "gray")
        marker = "*" if is_winner else "o"
        size = 200 if is_winner else 80

        ax.scatter(iteration, score, c=color, marker=marker, s=size, zorder=3)

        if is_winner:
            winner_iterations.append(iteration)
            winner_scores.append(score)

        if approach not in legend_handles:
            handle = mlines.Line2D(
                [], [], color=color, marker="o", linestyle="None",
                markersize=8, label=approach,
            )
            legend_handles[approach] = handle

    # ── trend line through winners ─────────────────────────────────────────────
    if len(winner_iterations) >= 2:
        pairs = sorted(zip(winner_iterations, winner_scores))
        wx, wy = zip(*pairs)
        ax.plot(wx, wy, color="red", linestyle="--", linewidth=1.5,
                label="winner trend", zorder=2)

    # ── sub-score dimension overlay lines ──────────────────────────────────────
    dim_handles = []
    if args.all_dimensions and not use_dimension:
        dimensions = discover_dimensions(data)
        for i, dim in enumerate(dimensions):
            series = get_winner_dimension_series(data, dim)
            if len(series) >= 2:
                dx, dy = zip(*series)
                color = DIMENSION_COLORS[i % len(DIMENSION_COLORS)]
                ax.plot(dx, dy, color=color, linestyle=":", linewidth=1.0,
                        alpha=0.6, zorder=2)
                dim_handles.append(mlines.Line2D(
                    [], [], color=color, linestyle=":", linewidth=1.0,
                    alpha=0.6, label=f"sub: {dim}",
                ))

    # ── phase bands from events ────────────────────────────────────────────────
    phase_transitions, config_changes = parse_events(events)
    phase_colors = ["#e8f4fd", "#fde8e8", "#e8fde8", "#fdf8e8", "#f0e8fd"]

    if phase_transitions:
        all_iters = [e.get("iteration", 0) for e in data if e.get("iteration") is not None]
        max_iter = max(all_iters) if all_iters else 1

        # Build phase ranges
        ranges = []
        for j, pt in enumerate(phase_transitions):
            start = pt["iteration"]
            end = phase_transitions[j + 1]["iteration"] if j + 1 < len(phase_transitions) else max_iter + 1
            ranges.append((start, end, pt["to_phase"]))

        for j, (start, end, phase_name) in enumerate(ranges):
            bg_color = phase_colors[j % len(phase_colors)]
            ax.axvspan(start - 0.5, end - 0.5, alpha=0.3, color=bg_color, zorder=0)
            ax.text((start + end) / 2 - 0.5, ax.get_ylim()[1] if ax.get_ylim()[1] != ax.get_ylim()[0] else 1,
                    phase_name, ha="center", va="top", fontsize=8, fontstyle="italic", alpha=0.7)

    # ── event markers (config changes) ─────────────────────────────────────────
    for cc in config_changes:
        ax.axvline(x=cc["iteration"], color="gray", linestyle=":", linewidth=0.8, alpha=0.5, zorder=1)

    # ── target value line ──────────────────────────────────────────────────────
    if target_value is not None and not use_dimension:
        ax.axhline(y=target_value, color="black", linestyle="--",
                   linewidth=1.2, label=f"target ({target_value})", zorder=1)

    # ── legend & labels ────────────────────────────────────────────────────────
    all_handles = list(legend_handles.values())

    winner_handle = mlines.Line2D(
        [], [], color="black", marker="*", linestyle="None",
        markersize=12, label="winner"
    )
    loser_handle = mlines.Line2D(
        [], [], color="black", marker="o", linestyle="None",
        markersize=8, label="loser"
    )
    all_handles = [winner_handle, loser_handle] + all_handles

    if target_value is not None and not use_dimension:
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

    all_handles.extend(dim_handles)

    if config_changes:
        event_handle = mlines.Line2D(
            [], [], color="gray", linestyle=":", linewidth=0.8,
            alpha=0.5, label="config change"
        )
        all_handles.append(event_handle)

    ax.legend(handles=all_handles, loc="best", fontsize=8)
    ax.set_title(f"Self-Improvement Progress{title_suffix}", fontsize=14, fontweight="bold")
    ax.set_xlabel("Iteration", fontsize=12)
    ax.set_ylabel(y_label, fontsize=12)
    ax.grid(True, alpha=0.3)

    # ── save ───────────────────────────────────────────────────────────────────
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    fig.tight_layout()
    fig.savefig(output_path, dpi=150)
    print(f"Plot saved to {output_path}")
    plt.close(fig)

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
        sub_scores = best_entry.get("sub_scores")
        if sub_scores:
            sub_str = ", ".join(f"{k}: {v}" for k, v in sub_scores.items())
            print(f"Iteration {iteration}: best={best_score}, winner={approach}, sub_scores={{{sub_str}}}")
        else:
            print(f"Iteration {iteration}: best={best_score}, winner={approach}")

    # Print discovered dimensions
    dimensions = discover_dimensions(data)
    if dimensions:
        print(f"\nDiscovered sub-score dimensions: {', '.join(dimensions)}")


if __name__ == "__main__":
    main()
