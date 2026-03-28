#!/usr/bin/env python3
"""
Benchmark for solver.py — measures correctness and performance.
Outputs a single score (0-100) to stdout.

Score = correctness_weight(60%) + speed_weight(40%)
"""

import time
import sys
import random
import json

# Reproducible test data
random.seed(42)

# --- Test Cases ---

PRIME_N = 5000
SORT_SIZE = 3000
FIB_N = 30
SEARCH_SIZE = 50000
WORD_TEXT = " ".join(
    random.choice(["the", "quick", "brown", "fox", "jumps", "over", "lazy", "dog",
                    "alpha", "beta", "gamma", "delta", "epsilon", "zeta", "eta",
                    "theta", "iota", "kappa", "lambda", "mu"])
    for _ in range(10000)
)
MATRIX_SIZE = 80

SORT_DATA = [random.randint(0, 100000) for _ in range(SORT_SIZE)]
SEARCH_DATA = list(range(SEARCH_SIZE))
SEARCH_TARGET = SEARCH_SIZE - 1  # worst case for linear search

MATRIX_A = [[random.random() for _ in range(MATRIX_SIZE)] for _ in range(MATRIX_SIZE)]
MATRIX_B = [[random.random() for _ in range(MATRIX_SIZE)] for _ in range(MATRIX_SIZE)]

# --- Reference Answers ---

def ref_primes(n):
    sieve = [True] * (n + 1)
    sieve[0] = sieve[1] = False
    for i in range(2, int(n**0.5) + 1):
        if sieve[i]:
            for j in range(i*i, n + 1, i):
                sieve[j] = False
    return [i for i, v in enumerate(sieve) if v]

REF_PRIMES = ref_primes(PRIME_N)
REF_SORTED = sorted(SORT_DATA)
REF_FIB = 832040  # fib(30)
REF_SEARCH = SEARCH_SIZE - 1

# --- Time Budgets (seconds) --- targets for full speed score
TIME_BUDGETS = {
    "primes": 0.05,
    "sort": 0.01,
    "fibonacci": 0.001,
    "search": 0.001,
    "words": 0.01,
    "matrix": 0.05,
}


def timed(fn, *args, repeats=1):
    """Run fn and return (result, elapsed_seconds)."""
    start = time.perf_counter()
    for _ in range(repeats):
        result = fn(*args)
    elapsed = (time.perf_counter() - start) / repeats
    return result, elapsed


def speed_score(elapsed, budget):
    """0-1 score: 1.0 if elapsed <= budget, degrades linearly to 0 at 10x budget."""
    if elapsed <= budget:
        return 1.0
    ratio = elapsed / budget
    if ratio >= 10:
        return 0.0
    return max(0.0, 1.0 - (ratio - 1) / 9)


def run_benchmark():
    try:
        from solver import find_primes, sort_data, fibonacci, search, count_words, matrix_multiply
    except ImportError as e:
        print(f"Import error: {e}", file=sys.stderr)
        print("0")
        return

    results = {}
    correctness_scores = {}
    speed_scores = {}

    # 1. Primes
    try:
        primes, t = timed(find_primes, PRIME_N)
        correct = primes == REF_PRIMES
        correctness_scores["primes"] = 1.0 if correct else 0.0
        speed_scores["primes"] = speed_score(t, TIME_BUDGETS["primes"])
        results["primes"] = {"correct": correct, "time": round(t, 4)}
    except Exception as e:
        correctness_scores["primes"] = 0.0
        speed_scores["primes"] = 0.0
        results["primes"] = {"error": str(e)}

    # 2. Sort
    try:
        sorted_arr, t = timed(sort_data, SORT_DATA)
        correct = sorted_arr == REF_SORTED
        correctness_scores["sort"] = 1.0 if correct else 0.0
        speed_scores["sort"] = speed_score(t, TIME_BUDGETS["sort"])
        results["sort"] = {"correct": correct, "time": round(t, 4)}
    except Exception as e:
        correctness_scores["sort"] = 0.0
        speed_scores["sort"] = 0.0
        results["sort"] = {"error": str(e)}

    # 3. Fibonacci
    try:
        fib, t = timed(fibonacci, FIB_N)
        correct = fib == REF_FIB
        correctness_scores["fibonacci"] = 1.0 if correct else 0.0
        speed_scores["fibonacci"] = speed_score(t, TIME_BUDGETS["fibonacci"])
        results["fibonacci"] = {"correct": correct, "time": round(t, 4)}
    except Exception as e:
        correctness_scores["fibonacci"] = 0.0
        speed_scores["fibonacci"] = 0.0
        results["fibonacci"] = {"error": str(e)}

    # 4. Search
    try:
        idx, t = timed(search, SEARCH_DATA, SEARCH_TARGET)
        correct = idx == REF_SEARCH
        correctness_scores["search"] = 1.0 if correct else 0.0
        speed_scores["search"] = speed_score(t, TIME_BUDGETS["search"])
        results["search"] = {"correct": correct, "time": round(t, 4)}
    except Exception as e:
        correctness_scores["search"] = 0.0
        speed_scores["search"] = 0.0
        results["search"] = {"error": str(e)}

    # 5. Word count
    try:
        wc, t = timed(count_words, WORD_TEXT)
        # Spot-check a few words
        correct = isinstance(wc, dict) and wc.get("the", 0) > 0 and all(isinstance(v, int) for v in wc.values())
        correctness_scores["words"] = 1.0 if correct else 0.0
        speed_scores["words"] = speed_score(t, TIME_BUDGETS["words"])
        results["words"] = {"correct": correct, "time": round(t, 4)}
    except Exception as e:
        correctness_scores["words"] = 0.0
        speed_scores["words"] = 0.0
        results["words"] = {"error": str(e)}

    # 6. Matrix multiply
    try:
        mat, t = timed(matrix_multiply, MATRIX_A, MATRIX_B)
        correct = len(mat) == MATRIX_SIZE and len(mat[0]) == MATRIX_SIZE
        correctness_scores["matrix"] = 1.0 if correct else 0.0
        speed_scores["matrix"] = speed_score(t, TIME_BUDGETS["matrix"])
        results["matrix"] = {"correct": correct, "time": round(t, 4)}
    except Exception as e:
        correctness_scores["matrix"] = 0.0
        speed_scores["matrix"] = 0.0
        results["matrix"] = {"error": str(e)}

    # --- Compute final score ---
    n = len(correctness_scores)
    avg_correctness = sum(correctness_scores.values()) / n
    avg_speed = sum(speed_scores.values()) / n

    final_score = round(avg_correctness * 60 + avg_speed * 40, 1)

    # Print details to stderr for debugging
    print(json.dumps(results, indent=2), file=sys.stderr)
    print(f"Correctness: {avg_correctness:.2%} | Speed: {avg_speed:.2%}", file=sys.stderr)

    # Print score to stdout (this is what the pipeline reads)
    print(final_score)


if __name__ == "__main__":
    run_benchmark()
