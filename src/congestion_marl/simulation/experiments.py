"""Canonical deterministic multi-seed experiment matrix."""

from __future__ import annotations

from collections.abc import Callable

from congestion_marl.analysis.enumeration import analyze_scenario
from congestion_marl.config import ExperimentConfig
from congestion_marl.games.braess import BraessGame
from congestion_marl.learners.best_response import run_best_response
from congestion_marl.learners.hedge import run_hedge
from congestion_marl.learners.independent_q import run_independent_q
from congestion_marl.simulation.aggregation import aggregate_summaries, select_representative_run
from congestion_marl.simulation.engine import LearningRun
from congestion_marl.simulation.seeds import derive_seeds
from congestion_marl.simulation.snapshots import snapshot_episode_indices
from congestion_marl.types import Scenario

type Runner = Callable[[int, bool], LearningRun]


def _learner_block(
    learner: str,
    seeds: tuple[int, ...],
    runner: Runner,
    equilibrium: tuple[int, ...],
    optimum: tuple[int, ...],
) -> dict[str, object]:
    runs = [runner(seed, False) for seed in seeds]
    representative = select_representative_run(runs)
    rerun = runner(representative.seed, True)
    if rerun.final_greedy_counts != representative.final_greedy_counts:
        raise AssertionError("representative rerun is not deterministic")
    summaries = [run.summary(equilibrium, optimum) for run in runs]
    return {
        "learner": learner,
        "seedList": list(seeds),
        "representativeSelection": {
            "rule": (
                "medoid under pairwise L1 final-count distance, then lower "
                "exploitability, then smaller seed"
            ),
            "representativeSeed": representative.seed,
        },
        "perSeedFinalSummaries": summaries,
        "aggregate": aggregate_summaries(summaries),
        "representative": {
            "summary": rerun.summary(equilibrium, optimum),
            "snapshots": [snapshot.to_dict() for snapshot in rerun.snapshots],
            "learnerState": rerun.state,
        },
        "runtime": {
            "includedInDeterministicBundle": False,
            "reason": "wall-clock measurements are recorded by congestion-marl benchmark",
        },
    }


def run_experiment_matrix(config: ExperimentConfig | None = None) -> dict[str, object]:
    """Run Q-learning and Hedge on 64 seeds, plus seeded exact best response."""

    controls = config or ExperimentConfig()
    result: dict[str, object] = {}
    for scenario_index, scenario in enumerate(Scenario):
        game = BraessGame(scenario, controls.q_learning.agents)
        exact = analyze_scenario(scenario, game.population)
        equilibrium = exact.equilibria[0]
        optimum = exact.social_optima[0]
        q_seeds = derive_seeds(controls.base_seed, controls.seeds, scenario_index * 3)
        hedge_seeds = derive_seeds(controls.base_seed, controls.seeds, scenario_index * 3 + 1)
        br_seeds = derive_seeds(
            controls.base_seed, controls.best_response_seeds, scenario_index * 3 + 2
        )
        sample_episodes = snapshot_episode_indices(controls.q_learning.episodes)

        def q_runner(
            seed: int,
            representative: bool,
            run_game: BraessGame = game,
            samples: tuple[int, ...] = sample_episodes,
        ) -> LearningRun:
            return run_independent_q(
                run_game,
                controls.q_learning,
                seed,
                snapshot_episodes=samples if representative else (),
            )

        def hedge_runner(
            seed: int,
            representative: bool,
            run_game: BraessGame = game,
            samples: tuple[int, ...] = sample_episodes,
        ) -> LearningRun:
            return run_hedge(
                run_game,
                controls.hedge,
                seed,
                snapshot_episodes=samples if representative else (),
            )

        def best_response_runner(
            seed: int, representative: bool, run_game: BraessGame = game
        ) -> LearningRun:
            del representative
            return run_best_response(run_game, seed)

        result[scenario.value] = {
            "qLearning": _learner_block(
                "independent-q-learning", q_seeds, q_runner, equilibrium, optimum
            ),
            "hedge": _learner_block(
                "full-information-hedge", hedge_seeds, hedge_runner, equilibrium, optimum
            ),
            "bestResponse": _learner_block(
                "asynchronous-strict-best-response",
                br_seeds,
                best_response_runner,
                equilibrium,
                optimum,
            ),
        }
    return result
