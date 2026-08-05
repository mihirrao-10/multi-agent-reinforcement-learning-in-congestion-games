from congestion_marl.cli import main


def test_cli_help_and_exact_enumeration(capsys: object) -> None:
    assert main(["enumerate", "--scenario", "braess-open", "--json"]) == 0
    output = capsys.readouterr().out  # type: ignore[attr-defined]
    assert '"countStates": 3321' in output


def test_cli_quick_simulation_and_invalid_scenario(capsys: object) -> None:
    assert (
        main(
            [
                "simulate",
                "--scenario",
                "braess-closed",
                "--learner",
                "q-learning",
                "--agents",
                "10",
                "--episodes",
                "20",
            ]
        )
        == 0
    )
    assert "finalGreedyRouteCounts" in capsys.readouterr().out  # type: ignore[attr-defined]
