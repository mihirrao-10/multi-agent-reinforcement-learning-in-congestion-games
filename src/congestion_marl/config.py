"""Validated experiment configuration."""

from __future__ import annotations

from dataclasses import dataclass

POPULATION = 100
SUPPORTED_POPULATIONS = (100, 1_000, 10_000)
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
        if self.q_learning.agents != self.hedge.agents:
            raise ValueError("Q-learning and Hedge populations must agree")

    @property
    def population(self) -> int:
        return self.q_learning.agents


def experiment_config_for_population(population: int) -> ExperimentConfig:
    """Return the public audited study configuration for a supported population."""

    if population not in SUPPORTED_POPULATIONS:
        raise ValueError(f"unsupported public population {population}")
    if population == POPULATION:
        return ExperimentConfig()
    # Large presets retain one deterministic audited run per scenario. Fewer
    # episodes keep the public regeneration path practical while the separate
    # epsilon-zero evaluation remains unchanged.
    episodes = 3_200 if population == 1_000 else 2_400
    return ExperimentConfig(
        seeds=1,
        best_response_seeds=1,
        q_learning=QLearningConfig(agents=population, episodes=episodes),
        hedge=HedgeConfig(agents=population, episodes=episodes),
    )
