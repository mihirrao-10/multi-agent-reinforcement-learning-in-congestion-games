import numpy as np
import pytest

from congestion_marl.analysis.regret import cumulative_external_regret, regret_summary


def test_exact_external_regret_accounting() -> None:
    realized = np.asarray([[3.0, 4.0], [2.0, 5.0]])
    counterfactual = np.asarray(
        [
            [[3.0, 4.0], [6.0, 4.0]],
            [[2.0, 3.0], [2.0, 5.0]],
        ]
    )
    regrets = cumulative_external_regret(realized, counterfactual)
    assert np.allclose(regrets, [0.0, 1.0])
    summary = regret_summary(regrets, 2)
    assert summary["meanAverage"] == 0.25
    assert summary["maximumAverage"] == 0.5


def test_invalid_regret_shapes_are_rejected() -> None:
    with pytest.raises(ValueError):
        cumulative_external_regret(np.zeros(2), np.zeros((1, 2, 2)))
