import copy

import pytest

from congestion_marl.config import ExperimentConfig, HedgeConfig, QLearningConfig
from congestion_marl.export.json_writer import deterministic_json_bytes
from congestion_marl.export.story import build_potential_landscape, build_story
from congestion_marl.export.validation import StoryValidationError, validate_story


def quick_story() -> dict[str, object]:
    return build_story(
        ExperimentConfig(
            seeds=2,
            best_response_seeds=2,
            q_learning=QLearningConfig(episodes=200),
            hedge=HedgeConfig(episodes=200),
        )
    )


def test_landscape_topology_is_complete() -> None:
    landscape = build_potential_landscape()
    assert len(landscape["vertices"]) == 3321  # type: ignore[arg-type]
    assert len(landscape["triangles"]) == 6400  # type: ignore[arg-type]


def test_story_is_deterministic_and_valid() -> None:
    first = quick_story()
    second = quick_story()
    assert deterministic_json_bytes(first) == deterministic_json_bytes(second)
    validate_story(first)


def test_float_serialization_discards_platform_scale_noise() -> None:
    first = deterministic_json_bytes({"probability": 0.5579733868637083})
    second = deterministic_json_bytes({"probability": 0.5579733868637084})

    assert first == second
    assert first == b'{"probability":0.557973386864}\n'


def test_validator_catches_intentional_corruption() -> None:
    payload = quick_story()
    corrupted = copy.deepcopy(payload)
    corrupted["schemaVersion"] = "broken"
    with pytest.raises(StoryValidationError, match="schema"):
        validate_story(corrupted)
