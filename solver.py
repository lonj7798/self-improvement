"""
Solver module — a collection of utility functions with naive implementations.
The self-improvement loop will iteratively optimize these.
"""


def find_primes(n):
    """Return all prime numbers up to n (inclusive)."""
    primes = []
    for num in range(2, n + 1):
        is_prime = True
        for i in range(2, num):
            if num % i == 0:
                is_prime = False
                break
        if is_prime:
            primes.append(num)
    return primes


def sort_data(data):
    """Sort a list of numbers in ascending order."""
    return sorted(data)


def fibonacci(n):
    """Return the nth Fibonacci number (0-indexed)."""
    if n <= 0:
        return 0
    a, b = 0, 1
    for _ in range(1, n):
        a, b = b, a + b
    return b


def search(data, target):
    """Return the index of target in data, or -1 if not found."""
    for i in range(len(data)):
        if data[i] == target:
            return i
    return -1


def count_words(text):
    """Return a dict of word -> count for the given text."""
    result = {}
    words = text.split()
    for word in words:
        clean = ""
        for ch in word:
            if ch.isalpha():
                clean += ch
        clean = clean.lower()
        if clean:
            if clean in result:
                result[clean] = result[clean] + 1
            else:
                result[clean] = 1
    return result


def matrix_multiply(a, b):
    """Multiply two 2D matrices (lists of lists)."""
    rows_a, cols_a = len(a), len(a[0])
    rows_b, cols_b = len(b), len(b[0])
    if cols_a != rows_b:
        raise ValueError("Incompatible matrix dimensions")
    result = []
    for i in range(rows_a):
        row = []
        for j in range(cols_b):
            total = 0
            for k in range(cols_a):
                total += a[i][k] * b[k][j]
            row.append(total)
        result.append(row)
    return result
