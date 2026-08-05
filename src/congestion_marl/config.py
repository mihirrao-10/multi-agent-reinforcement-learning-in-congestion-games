"""Validated experiment configuration."""

from __future__ import annotations

from dataclasses import dataclass

POPULATION = 80
BASE_SEED = 20260804


@dataclass(frozen=True, slots=True)
class QLearningConfig:
    """Canonical independent Q-learning controls."""

    agents: int = POPULATION
    episodes: int = 5000
    alpha: float = 0.15
    epsilon_start: float = 0.80
    epsilon_decay: float = 0.999
    epsilon_floor: float = 0.01
    initial_q: float = 0.0

    def __post_init__(self) -> None:
        if self.agents <= 0 or self.episodes <= 0:
            raise ValueError("agents and episodes must be positive")
        if not 0 < self.alpha <= 1:
            raise ValueError("alpha must lie in (0, 1]")
        if not 0 <= self.epsilon_floor <= self.epsilon_start <= 1:
            raise ValueError("epsilon values must satisfy 0 <= floor <= start <= 1")
        if not 0 < self.epsilon_decay <= 1:
            raise ValueError("epsilon decay must lie in (0, 1]")

    def epsilon(self, episode: int) -> float:
        """Return the exploration rate used at a one-indexed episode."""

        if episode < 1:
            return self.epsilon_start
        return max(self.epsilon_floor, self.epsilon_start * self.epsilon_decay ** (episode - 1))


@dataclass(frozen=True, slots=True)
class HedgeConfig:
    """Stable full-information Hedge controls."""

    agents: int = POPULATION
    episodes: int = 5000
    eta: float = 0.18

    def __post_init__(self) -> None:
        if self.agents <= 0 or self.episodes <= 0:
            raise ValueError("agents and episodes must be positive")
        if self.eta <= 0:
            raise ValueError("eta must be positive")


@dataclass(frozen=True, slots=True)
class ExperimentConfig:
    """Public deterministic experiment matrix."""

    base_seed: int = BASE_SEED
    seeds: int = 64
    best_response_seeds: int = 16
    q_learning: QLearningConfig = QLearningConfig()
    hedge: HedgeConfig = HedgeConfig()

    def __post_init__(self) -> None:
        if self.seeds < 1 or self.best_response_seeds < 1:
            raise ValueError("seed counts must be positive")
