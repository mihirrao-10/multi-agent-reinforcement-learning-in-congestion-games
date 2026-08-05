"""Command-line interface for simulation, exact analysis, export, and validation."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import cast

from congestion_marl.analysis.enumeration import analyze_scenario
from congestion_marl.benchmarking import benchmark_suite
from congestion_marl.config import BASE_SEED, ExperimentConfig, HedgeConfig, QLearningConfig
from congestion_marl.export.json_writer import write_deterministic_json
from congestion_marl.export.story import build_story
from congestion_marl.export.validation import (
    StoryValidationError,
    validate_story,
    validate_story_file,
)
from congestion_marl.games.braess import BraessGame
from congestion_marl.learners.best_response import run_best_response
from congestion_marl.learners.hedge import run_hedge
from congestion_marl.learners.independent_q import run_independent_q
from congestion_marl.simulation.experiments import run_experiment_matrix
from congestion_marl.types import Scenario


def _scenario(value: str) -> Scenario:
    try:
        return Scenario(value)
    except ValueError as error:
        choices = ", ".join(item.value for item in Scenario)
        raise argparse.ArgumentTypeError(f"unknown scenario {value!r}; choose {choices}") from error


def _print(payload: object, machine_readable: bool) -> None:
    if machine_readable:
        print(json.dumps(payload, sort_keys=True, indent=2, allow_nan=False))
        return
    if isinstance(payload, dict):
        for key, value in payload.items():
            print(f"{key}: {value}")
    else:
        print(payload)


def _simulate(args: argparse.Namespace) -> int:
    scenario = cast(Scenario, args.scenario)
    game = BraessGame(scenario, args.agents)
    if args.learner == "q-learning":
        run = run_independent_q(
            game,
            QLearningConfig(agents=args.agents, episodes=args.episodes),
            args.seed,
        )
    elif args.learner == "hedge":
        run = run_hedge(
            game,
            HedgeConfig(agents=args.agents, episodes=args.episodes),
            args.seed,
        )
    else:
        run = run_best_response(game, args.seed)
    exact = analyze_scenario(scenario, args.agents)
    payload = run.summary(exact.equilibria[0], exact.social_optima[0])
    payload["learner"] = run.learner
    payload["interpretation"] = (
        "empirical epsilon-zero greedy evaluation"
        if run.learner == "q-learning"
        else "terminal or final-policy evaluation; see learner information assumptions"
    )
    _print(payload, args.json)
    return 0


def _enumerate(args: argparse.Namespace) -> int:
    scenario = cast(Scenario, args.scenario)
    analysis = analyze_scenario(scenario, args.agents)
    game = BraessGame(scenario, args.agents)
    payload = {
        "scenario": scenario.value,
        "countStates": analysis.count_states,
        "pureNashEquilibria": [list(state) for state in analysis.equilibria],
        "socialOptima": [list(state) for state in analysis.social_optima],
        "equilibriumSocialCosts": [float(value) for value in analysis.equilibrium_social_costs],
        "optimumSocialCost": float(analysis.optimum_social_cost),
        "optimumAverageLatency": float(analysis.optimum_social_cost / game.population),
        "priceOfAnarchy": float(analysis.price_of_anarchy),
        "priceOfStability": float(analysis.price_of_stability),
        "exactPotentialDeviationChecks": analysis.potential_identity_checks,
        "tolledPotentialStateChecks": analysis.tolled_potential_checks,
    }
    _print(payload, args.json)
    return 0


def _compare(args: argparse.Namespace) -> int:
    controls = ExperimentConfig(
        seeds=args.seeds,
        best_response_seeds=min(16, args.seeds),
        q_learning=QLearningConfig(episodes=args.episodes),
        hedge=HedgeConfig(episodes=args.episodes),
    )
    matrix = run_experiment_matrix(controls)
    if args.json:
        _print(matrix, True)
    else:
        for scenario, scenario_block in matrix.items():
            print(scenario)
            for learner_key, learner_value in cast(
                dict[str, dict[str, object]], scenario_block
            ).items():
                selection = cast(dict[str, object], learner_value["representativeSelection"])
                representative = cast(dict[str, object], learner_value["representative"])
                summary = cast(dict[str, object], representative["summary"])
                print(
                    f"  {learner_key}: seed {selection['representativeSeed']}, "
                    f"final {summary['finalGreedyRouteCounts']}, "
                    f"exploitability {summary['exploitability']}"
                )
    return 0


def _export(args: argparse.Namespace) -> int:
    payload = build_story()
    validate_story(payload)
    output = Path(args.output)
    write_deterministic_json(output, payload)
    print(f"wrote validated schema 1.0.0 story data to {output}")
    return 0


def _validate(args: argparse.Namespace) -> int:
    payload = validate_story_file(args.path)
    landscape = cast(dict[str, object], payload["potentialLandscape"])
    print(
        f"valid story schema {payload['schemaVersion']}: "
        f"{len(cast(list[object], landscape['vertices']))} states, "
        f"{len(cast(list[object], landscape['triangles']))} triangles"
    )
    return 0


def _benchmark(args: argparse.Namespace) -> int:
    payload = benchmark_suite()
    if args.output:
        write_deterministic_json(Path(args.output), payload)
        print(f"wrote measured benchmark metadata to {args.output}")
    else:
        _print(payload, True)
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="congestion-marl",
        description="Exact and empirical analysis of the authored atomic Braess game.",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    simulate = subparsers.add_parser("simulate", help="run one deterministic learner")
    simulate.add_argument("--scenario", type=_scenario, default=Scenario.OPEN)
    simulate.add_argument(
        "--learner", choices=("q-learning", "hedge", "best-response"), default="q-learning"
    )
    simulate.add_argument("--agents", type=int, default=80)
    simulate.add_argument("--episodes", type=int, default=5000)
    simulate.add_argument("--seed", type=int, default=BASE_SEED)
    simulate.add_argument("--json", action="store_true")
    simulate.set_defaults(handler=_simulate)

    enumerate_parser = subparsers.add_parser(
        "enumerate", help="enumerate all symmetric count states exactly"
    )
    enumerate_parser.add_argument("--scenario", type=_scenario, default=Scenario.OPEN)
    enumerate_parser.add_argument("--agents", type=int, default=80)
    enumerate_parser.add_argument("--json", action="store_true")
    enumerate_parser.set_defaults(handler=_enumerate)

    compare = subparsers.add_parser("compare", help="run the deterministic experiment matrix")
    compare.add_argument("--seeds", type=int, default=64)
    compare.add_argument("--episodes", type=int, default=5000)
    compare.add_argument("--json", action="store_true")
    compare.set_defaults(handler=_compare)

    export = subparsers.add_parser("export", help="generate authoritative versioned story JSON")
    export.add_argument("--output", default="web/public/data/story-v1.json")
    export.set_defaults(handler=_export)

    validate = subparsers.add_parser("validate", help="validate a story JSON bundle")
    validate.add_argument("path")
    validate.set_defaults(handler=_validate)

    benchmark = subparsers.add_parser("benchmark", help="measure core implementation paths")
    benchmark.add_argument("--output")
    benchmark.set_defaults(handler=_benchmark)
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    try:
        args = parser.parse_args(argv)
        return int(args.handler(args))
    except (ValueError, StoryValidationError, AssertionError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
