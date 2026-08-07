from pathlib import Path
from types import SimpleNamespace

import congestion_marl.benchmarking as benchmarking


def test_measure_uses_one_warmup_and_reports_every_sample(monkeypatch: object) -> None:
    calls: list[str] = []
    clock = iter((0.0, 1.0, 2.0, 4.0))
    monkeypatch.setattr(benchmarking.time, "perf_counter", lambda: next(clock))  # type: ignore[attr-defined]

    result = benchmarking._measure(lambda: calls.append("called"), repeats=2)

    assert calls == ["called", "called", "called"]
    assert result == {
        "warmups": 1,
        "repeats": 2,
        "minimumSeconds": 1.0,
        "meanSeconds": 1.5,
        "maximumSeconds": 2.0,
    }


def test_benchmark_suite_reports_present_and_missing_bundle_sets(
    tmp_path: Path, monkeypatch: object
) -> None:
    monkeypatch.setattr(benchmarking, "build_story", lambda config: {"config": config})  # type: ignore[attr-defined]
    monkeypatch.setattr(benchmarking, "analyze_scenario", lambda *args: object())  # type: ignore[attr-defined]
    monkeypatch.setattr(benchmarking, "run_independent_q", lambda *args: object())  # type: ignore[attr-defined]
    monkeypatch.setattr(benchmarking, "run_hedge", lambda *args: object())  # type: ignore[attr-defined]
    monkeypatch.setattr(benchmarking, "build_potential_landscape", lambda *args: {})  # type: ignore[attr-defined]
    monkeypatch.setattr(benchmarking, "build_population_bundle", lambda *args: {})  # type: ignore[attr-defined]
    monkeypatch.setattr(benchmarking, "validate_story", lambda *args: None)  # type: ignore[attr-defined]
    monkeypatch.setattr(benchmarking, "validate_export_directory", lambda *args: {})  # type: ignore[attr-defined]
    monkeypatch.setattr(  # type: ignore[attr-defined]
        benchmarking,
        "experiment_config_for_population",
        lambda population: SimpleNamespace(
            population=population,
            q_learning=SimpleNamespace(agents=population, episodes=2_400),
        ),
    )

    names = (
        "manifest-v3.json",
        "population-100-v3.json",
        "population-1000-v3.json",
        "population-10000-v3.json",
        "population-100000-v3.json",
        "population-1000000-v3.json",
    )
    for index, name in enumerate(names, start=1):
        (tmp_path / name).write_text(f'{{"index":{index}}}\n', encoding="utf-8")

    present = benchmarking.benchmark_suite(tmp_path)
    loading = present["measurements"]["committedBundleLoading"]  # type: ignore[index]
    assert set(loading) == {  # type: ignore[arg-type]
        "jsonParseAllManifestAndPopulationBundles",
        "independentValidationAllPopulationBundles",
    }
    assert present["bundleSizesBytes"] == {name: (tmp_path / name).stat().st_size for name in names}
    assert loading["jsonParseAllManifestAndPopulationBundles"]["repeats"] == 3  # type: ignore[index]
    assert loading["independentValidationAllPopulationBundles"]["repeats"] == 2  # type: ignore[index]

    missing = benchmarking.benchmark_suite(tmp_path / "missing")
    assert missing["measurements"]["committedBundleLoading"] == {  # type: ignore[index]
        "status": "not measured; run from a repository containing the public bundles"
    }
