from fractions import Fraction

import pytest

from congestion_marl.analysis.diagnostics import normalized_count_distance, require_finite
from congestion_marl.analysis.equilibrium import cost_exploitability, is_pure_nash
from congestion_marl.analysis.potential import perceived_potential, rosenthal_potential
from congestion_marl.analysis.welfare import average_physical_latency, physical_social_cost
from congestion_marl.games.braess import BraessGame
from congestion_marl.simulation.seeds import derive_seeds, seed_policy
from congestion_marl.simulation.snapshots import snapshot_episode_indices
from congestion_marl.types import Scenario


def test_analysis_wrappers_preserve_exact_values() -> None:
    game = BraessGame(Scenario.OPEN)
    equilibrium = (0, 0, 80)
    optimum = (35, 35, 10)
    assert cost_exploitability(game, equilibrium) == 0
    assert is_pure_nash(game, equilibrium)
    assert rosenthal_potential(game, equilibrium) == 3240
    assert perceived_potential(game, equilibrium) == 3240
    assert physical_social_cost(game, optimum) == 5175
    assert average_physical_latency(game, optimum) == Fraction(1035, 16)
    assert normalized_count_distance(equilibrium, optimum, 80) == 0.875
    require_finite([0.0, 1.0], "finite sample")


def test_diagnostics_and_seed_controls_reject_invalid_inputs() -> None:
    with pytest.raises(ValueError):
        normalized_count_distance((1,), (1, 0), 80)
    with pytest.raises(ValueError, match="NaN"):
        require_finite([float("nan")], "sample")
    with pytest.raises(ValueError):
        derive_seeds(1, 0)
    assert seed_policy()["bitGenerator"] == "PCG64"


def test_canonical_snapshot_schedule_has_exact_endpoints_and_target_size() -> None:
    indices = snapshot_episode_indices(5000)
    assert indices[0] == 0
    assert indices[-1] == 5000
    assert 180 <= len(indices) <= 300
    assert indices == tuple(sorted(set(indices)))
