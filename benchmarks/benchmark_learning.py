"""Run the package learner benchmark suite."""

from congestion_marl.benchmarking import benchmark_suite

if __name__ == "__main__":
    import json

    print(json.dumps(benchmark_suite(), indent=2, sort_keys=True))
