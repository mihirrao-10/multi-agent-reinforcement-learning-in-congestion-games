"""Measure exact symmetry-reduced scenario analysis."""

from time import perf_counter

from congestion_marl.analysis.enumeration import analyze_scenario
from congestion_marl.types import Scenario

if __name__ == "__main__":
    analyze_scenario(Scenario.OPEN)
    start = perf_counter()
    result = analyze_scenario(Scenario.OPEN)
    elapsed = perf_counter() - start
    print(
        f"{result.count_states} states and {result.potential_identity_checks} "
        f"deviations in {elapsed:.6f} s"
    )
