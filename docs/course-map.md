# Course Map and Theory Boundary

## Purpose

This map separates established theory from project-specific modeling, computation, and empirical evidence. The implementation notes are in [experiment-methodology.md](experiment-methodology.md), and the spoken narrative is in [interview-guide.md](interview-guide.md).

## Core sources

| Topic | Source | Project use |
| --- | --- | --- |
| Finite congestion games and exact potential | Robert W. Rosenthal, [A class of games possessing pure-strategy Nash equilibria](https://doi.org/10.1007/BF01737559), 1973 | Defines the potential construction and finite-improvement logic. |
| Braess paradox | Dietrich Braess, Anna Nagurney, and Tina Wakolbinger, [On a Paradox of Traffic Planning](https://doi.org/10.1287/trsc.1050.0127), 2005 English translation | Supplies the canonical network paradox and incentive question. |
| Selfish routing and inefficiency | Tim Roughgarden and Éva Tardos, [How Bad Is Selfish Routing?](https://doi.org/10.1145/506147.506153), 2002 | Supplies the welfare comparison vocabulary and broader routing context. |
| Algorithmic game theory | Noam Nisan, Tim Roughgarden, Éva Tardos, and Vijay Vazirani, editors, [Algorithmic Game Theory](https://www.cambridge.org/core/books/algorithmic-game-theory/009ED727A216D3A49905F8673CAAC04A), 2007 | Background for congestion games, equilibrium, Price of Anarchy, and learning in games. |
| Multi-agent systems | Yoav Shoham and Kevin Leyton-Brown, [Multiagent Systems](http://www.masfoundations.org/), 2009 | Frames strategic interaction and information assumptions. |
| Tabular Q-learning | Christopher Watkins and Peter Dayan, [Q-learning](https://doi.org/10.1007/BF00992698), 1992 | Supplies the tabular update, not a convergence claim for adapting independent agents. |
| Reinforcement learning | Richard Sutton and Andrew Barto, [Reinforcement Learning: An Introduction](http://incompleteideas.net/book/the-book-2nd.html), second edition | Background for value estimates, exploration, and one-stage repeated decisions. |
| Hedge | Yoav Freund and Robert Schapire, [A Decision-Theoretic Generalization of On-Line Learning and an Application to Boosting](https://doi.org/10.1006/jcss.1997.1504), 1997 | Supplies the full-information exponential-weights baseline. |
| External regret | Nicolò Cesa-Bianchi and Gábor Lugosi, [Prediction, Learning, and Games](https://www.cambridge.org/core/books/prediction-learning-and-games/A05C9F6ABC752FAB8954C885D0065C8F), 2006 | Supplies the fixed-action-in-hindsight regret framework. |
| Regret and empirical play | Tim Roughgarden, [Twenty Lectures on Algorithmic Game Theory](https://theory.stanford.edu/~tim/f13/f13.pdf), 2013 | Supports the time-average connection to coarse correlated equilibrium, not last-iterate Nash. |

## Established theory used directly

### Congestion potential

For integer edge load `x_e`, Rosenthal's potential contribution is

```text
sum(k=1..x_e) c_e(k).
```

Under a unilateral route change, unchanged edge contributions cancel and the remaining potential difference equals the mover's perceived-cost difference. A finite sequence of accepted strict cost improvements therefore cannot cycle.

The repository still checks the identity exhaustively on small populations so a coding error cannot hide behind the theorem.

### Braess and welfare

The recognizable Braess family has one source, one destination, two outer routes, and a central connection that combines their congestion-sensitive portions. Selfish use of the added link can make equilibrium travel worse. Price of Anarchy and Price of Stability compare equilibrium cost with optimum cost.

The values `4/3`, `(0, 0, 100)`, and `(50, 50, 0)` are not literature constants. They are exact outputs of this authored normalized finite model.

### Q-learning

The tabular Q update is established. Standard single-agent convergence assumptions do not match independently adapting agents whose joint choices change rewards. The project reuses the update and reports finite empirical outcomes without claiming a transferred theorem.

### Hedge and regret

Hedge is a full-information online-learning method. External regret compares realized cumulative cost with the best fixed action in hindsight. Small external regret for every player supports a statement about empirical time-average play. It does not by itself show that the final profile, policy mode, or sampled last action is a pure Nash equilibrium.

## Project-specific model choices

- Selectable represented populations `1,000`, `10,000`, and `100,000`, plus a hidden `100`-commuter comparison bundle.
- Labeled, atomic, unsplittable agents with complete-route actions.
- Variable costs `60x/N` minutes, constant costs 60 minutes, and a zero-cost central edge.
- Route codes `U`, `L`, and `Z`.
- Physical social cost as total physical latency.
- Discrete toll `60(x - 1)/N` minutes on the variable edges.
- Scenarios `braess-open`, `braess-closed`, and `braess-tolled`.
- An exact constant-size discrete-convex candidate reduction for equilibrium and optimum.

These choices preserve the intended Braess structure as population changes. They can produce tied adjacent integer optima, so the implementation returns complete sets and avoids universal uniqueness language.

## Project-specific learning design

| Decision | Public value |
| --- | --- |
| Q step size | `alpha = 0.15` |
| Initial Q values | `0` |
| Exploration | `max(0.01, 0.80 * 0.999^(t-1))` |
| Final evaluation | epsilon zero with isolated tie-breaking stream |
| Canonical Q and Hedge study | 5,000 episodes, 64 seeds per scenario |
| Canonical best response | 16 update orders per scenario |
| 1,000-agent Q scale study | 3,200 episodes, one seed per scenario |
| 10,000-agent Q scale study | 2,400 episodes, one seed per scenario |
| 100,000-agent sampled study | 10,000 learners, 2,400 episodes, one seed per scenario |
| Hedge rate | `eta = 0.18` |
| Base seed | `20260804` |
| Representative | final-count medoid, exploitability, then seed |

All Q agents choose before rewards are computed and update selected entries only. Hedge receives the complete counterfactual vector. Best response receives exact model access.

## Project-specific presentation design

- A title-only Start screen and one-act-at-a-time guided journey.
- A real waiting state with no fabricated episode or route metrics.
- A shared Three.js network with top camera controls and bottom population controls.
- Continuous translucent directional tubes with no individual commuter symbols.
- Traffic share encoded monotonically by nonlinear radius, hue, and opacity from thin green to thick red.
- Broad moving light used only as a fluid-looking direction cue.
- Four enlarged white cores and soft white halos for `S`, `U`, `V`, and `T`.
- A complete 100-agent potential surface and deterministic fixed-resolution scale samples.
- Exact markers, a validated strict-best-response path, and Q traces without downhill claims.
- Native SVG charts, KaTeX, and a state-equivalent SVG network fallback.
- Manifest-based lazy data loading and byte-deterministic public bundles.

Visual interpolation never creates a numerical claim. Textual values come from exact profiles or exported measured snapshots.

## Empirical observations, not theorems

- The finite-episode canonical 100-commuter representative remains mixed, while the exact all-Shortcut profile is separately identified as an equilibrium.
- The committed 1,000- and 10,000-commuter full studies have distinct training endpoints.
- The 100,000-commuter displayed training path is disclosed as a scaled summary of one 10,000-learner proxy.
- Epsilon-zero greedy evaluations reach all Shortcut for the 10,000- and 100,000-commuter studies; the hidden 100-commuter comparison and the 1,000-commuter study remain mixed at their declared episode budgets.
- The canonical tolled representative is near an exact optimum but need not equal it in every run.
- Low Hedge regret does not force every final profile to be a pure equilibrium.

Changing episode count, exploration, step size, initialization, feedback, or seeds can change empirical outcomes. Exact game analysis does not depend on those choices.

## Suggested reading path

For game theory, begin with Rosenthal and Braess, then selfish-routing welfare and the congestion-game chapters of *Algorithmic Game Theory*. For reinforcement learning, read Watkins and Dayan plus Sutton and Barto, then identify which single-agent assumptions fail here. For online learning, pair Freund and Schapire with Cesa-Bianchi and Lugosi, then use Roughgarden's notes for the careful empirical-distribution interpretation.
