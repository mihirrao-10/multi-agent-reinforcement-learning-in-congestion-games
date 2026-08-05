from congestion_marl.analysis.enumeration import potential_identity_summary
from congestion_marl.games.braess import BraessGame
from congestion_marl.types import Route, Scenario


def test_open_exact_potential_identity_for_every_deviation() -> None:
    checks, toll_checks = potential_identity_summary(BraessGame(Scenario.OPEN))
    assert checks == 19440
    assert toll_checks == 0


def test_closed_potential_identity() -> None:
    checks, _ = potential_identity_summary(BraessGame(Scenario.CLOSED))
    assert checks == 160


def test_remove_then_add_deviation_changes_own_load() -> None:
    game = BraessGame(Scenario.OPEN)
    state = (0, 0, 80)
    assert game.counterfactual_counts(state, Route.SHORTCUT, Route.UPPER) == (1, 0, 79)
    assert game.counterfactual_cost(state, Route.SHORTCUT, Route.UPPER) == 85
    current = game.route_physical_costs(state)[Route.SHORTCUT]
    changed = game.counterfactual_counts(state, Route.SHORTCUT, Route.UPPER)
    assert game.rosenthal_potential(changed) - game.rosenthal_potential(state) == 85 - current
