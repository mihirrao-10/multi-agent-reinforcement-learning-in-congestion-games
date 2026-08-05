from congestion_marl.config import ExperimentConfig, HedgeConfig, QLearningConfig
from congestion_marl.simulation.aggregation import select_representative_run
from congestion_marl.simulation.experiments import run_experiment_matrix


def test_quick_experiment_matrix_is_deterministic_and_complete() -> None:
    config = ExperimentConfig(
        seeds=3,
        best_response_seeds=2,
        q_learning=QLearningConfig(episodes=200),
        hedge=HedgeConfig(episodes=200),
    )
    left = run_experiment_matrix(config)
    right = run_experiment_matrix(config)
    assert left == right
    assert set(left) == {"braess-open", "braess-closed", "braess-tolled"}
    for scenario in left.values():
        assert set(scenario) == {"qLearning", "hedge", "bestResponse"}


def test_representative_selection_rejects_empty_runs() -> None:
    try:
        select_representative_run([])
    except ValueError as error:
        assert "at least one" in str(error)
    else:
        raise AssertionError("empty representative candidates were accepted")
