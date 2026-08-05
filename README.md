# When Every Agent Finds the Shortcut

## Multi-Agent Reinforcement Learning in Congestion Games

[Live interactive essay](https://mihirrao-10.github.io/multi-agent-reinforcement-learning-in-congestion-games/) · [Experiment methodology](docs/experiment-methodology.md) · [Interview guide](docs/interview-guide.md) · [Course map](docs/course-map.md)

![The live essay showing the braided Braess network beside the opening argument](docs/assets/site-hero.png)

Eighty independent tabular learners repeatedly choose routes through one atomic Braess network. The free central link is privately attractive, so the untolled game stabilizes with every agent using it. That outcome is a pure Nash equilibrium, but its average latency is 80 rather than the physical optimum's 64.6875. Closing the link lowers equilibrium latency to 65. Discrete marginal-cost tolls instead move the equilibrium to the physical optimum.

The repository's thesis is narrow: competent individual learning can faithfully discover inefficient incentives. Learning quality and incentive quality are different questions.

This is a completely audited computational study, not a generic MARL benchmark. Python defines the game, validates its exact mathematics, runs every learner, and exports an immutable story bundle. TypeScript validates that bundle again and presents it through one Three.js scene, native SVG charts, KaTeX, and an SVG fallback.

## Canonical model

The game has 80 labeled, unsplittable agents with common source `S` and destination `T`. An action is one complete route:

| Code | Route | Edges |
| --- | --- | --- |
| `U` | Upper | `S -> U -> T` |
| `L` | Lower | `S -> V -> T` |
| `Z` | Shortcut | `S -> U -> V -> T` |

Physical edge latencies at integer load `x` are:

| Edge | Latency |
| --- | ---: |
| `S -> U` | `x / 2` |
| `U -> T` | `45` |
| `S -> V` | `45` |
| `V -> T` | `x / 2` |
| `U -> V` | `0` |

For route counts `(x_U, x_L, x_Z)`, the variable edge loads are `x_U + x_Z` and `x_L + x_Z`. The route costs are

```text
J_U = (x_U + x_Z) / 2 + 45
J_L = 45 + (x_L + x_Z) / 2
J_Z = (x_U + x_Z) / 2 + (x_L + x_Z) / 2
```

Reward is negative perceived route cost. Physical social cost is the sum of physical travel latencies across agents.

## Exact results

Exact rational enumeration reduces the open game from `3^80` labeled profiles to `C(82, 2) = 3,321` symmetric count states. The closed game has 81 states. Every feasible unilateral deviation uses remove-then-add accounting: remove the candidate agent from its current route, add it to the proposed route, and recompute affected loads.

| Scenario | Unique pure Nash | Physical social cost | Average latency | Unique physical optimum |
| --- | ---: | ---: | ---: | ---: |
| Shortcut open | `(0, 0, 80)` | `6400` | `80` | `(35, 35, 10)` |
| Shortcut removed | `(40, 40)` | `5200` | `65` | `(40, 40)` |
| Shortcut tolled | `(35, 35, 10)` | `5175` | `64.6875` | `(35, 35, 10)` |

The open optimum has physical social cost `5175` and average latency `64.6875`. Because the untolled equilibrium is unique,

```text
Price of Anarchy = Price of Stability = 6400 / 5175 = 256 / 207
```

This is approximately `1.236715`. Removing the shortcut lowers equilibrium average latency by `18.75%`.

Rosenthal's potential is evaluated exactly as

```text
Phi = sum(k/2, k=1..x_U+x_Z)
    + 45(x_U + x_L)
    + sum(k/2, k=1..x_L+x_Z)
```

The implementation verifies `19,440` feasible unilateral deviations in each open three-route scenario and `160` in the closed two-route scenario. For every deviation, the player's perceived-cost change equals the potential change exactly. Strict asynchronous best response therefore descends and terminates without cycling.

### Discrete marginal-cost tolls

The two variable edges receive

```text
tau(x) = (x - 1) [c(x) - c(x - 1)] = (x - 1) / 2
```

The constant edges and zero-cost shortcut receive zero toll. Toll payments change private perceived cost but are transfers outside the physical-latency objective. Across all 3,321 count states, the perceived Rosenthal potential telescopes to physical social cost:

```text
sum(k=1..x_e) [c_e(k) + tau_e(k)] = x_e c_e(x_e)
```

The resulting equilibrium `(35, 35, 10)` is specific to this authored finite instance. It is not a universal uniqueness claim about atomic congestion games.

## Learning experiments

### Independent Q-learning

Each agent owns a separate tabular row. There is no parameter sharing, centralized controller, centralized critic, replay buffer, or neural network. Three or two route actions are small enough that a table is the transparent choice.

All 80 actions are selected before any reward is evaluated. Each agent then updates only its selected route value:

```text
Q_i(a_i) <- Q_i(a_i) + alpha [r_i - Q_i(a_i)]
```

`gamma = 0` because each episode is a one-stage repeated decision, not a continuing control trajectory. The public configuration uses 5,000 episodes, `alpha = 0.15`, zero initial values, and epsilon `max(0.01, 0.80 * 0.999^(t-1))`. The final learned policy is evaluated separately at epsilon zero.

The canonical 64-seed independent-Q results are empirical:

| Scenario | Representative seed | Final greedy counts | Exploitability |
| --- | ---: | ---: | ---: |
| Open | `1934370` | `(0, 0, 80)` | `0` |
| Closed | `1248724` | `(40, 40)` | `0` |
| Tolled | `82370885` | `(35, 35, 10)` | `0` |

The open and closed final count vectors were exact across all 64 Q-learning seeds except one closed run at normalized distance `0.0125`; the export retains every per-seed summary and aggregate rather than hiding variation. Tolled Q-learning had mean physical social cost `5178.5625`, population standard deviation `8.7180`, and standard error `1.0898` across 64 deterministic seeds.

### Baselines

- Asynchronous strict best response uses exact unilateral costs, one labeled agent at a time, and 16 seeded update orders. Every accepted move is checked against exact potential descent.
- Hedge gives each agent the full counterfactual route-cost vector, uses stable log weights with `eta = 0.18`, and runs 64 seeds per scenario. Low external regret does not imply last-iterate pure-Nash convergence.

Information assumptions differ deliberately. Q-learning updates from experienced selected-route reward only. Best response has exact model access. Hedge has full counterfactual feedback.

## Scientific guardrails

- Exact enumeration supplies equilibrium, optimum, exploitability, potential, Price of Anarchy, and Price of Stability benchmarks.
- Independent Q-learning is evaluated empirically against those exact benchmarks. The project does not transfer the classic single-agent Q-learning convergence theorem unchanged to a nonstationary multi-agent environment.
- External regret is computed with exact counterfactual remove-then-add costs. The project reports it but does not claim that a low value proves last-iterate Nash convergence.
- The representative run is a final-count medoid, not the prettiest animation. Pairwise L1 count distance is minimized; lower exploitability and then smaller seed break ties.
- The browser never trains agents or invents numerical states. Python exports all numerical results. TypeScript validates and presents them.
- The renderer may visually interpolate geometry, camera position, or material properties between exported states. Every textual metric belongs to one exact exported snapshot.
- Particle motion encodes route assignment and relative travel cost. It is not a microscopic or continuous-time traffic simulator.

## Architecture

```text
Python exact model and experiments
  -> deterministic schema 1.0.0 JSON
  -> Zod and numerical consistency validation
  -> typed story state machine
  -> one Three.js renderer plus native SVG and KaTeX
```

The potential surface contains all 3,321 states and 6,400 deterministically indexed triangles. Its displayed height is an affine normalization with a shared scale across original potential and tolled potential. Raw objective values remain attached to every vertex.

Randomness is isolated with NumPy `SeedSequence` and PCG64. Separate child streams cover exploration, greedy tie-breaking, scenario initialization, aggregate selection, representative playback, and final evaluation. Run seeds are derived from base seed `20260804` in scenario and learner namespaces.

## Installation

Python 3.12 or newer and Node 20 or newer are required.

```bash
git clone https://github.com/mihirrao-10/multi-agent-reinforcement-learning-in-congestion-games.git
cd multi-agent-reinforcement-learning-in-congestion-games
make setup
```

The canonical reproducibility toolchain pins Python 3.12.13 in CI and NumPy 2.5.1. Development extras add pytest, coverage, Ruff, and mypy.

## CLI

```bash
# One deterministic learner run
congestion-marl simulate --scenario braess-open --learner q-learning --seed 20260804

# Exact count-state analysis
congestion-marl enumerate --scenario braess-open --json

# Smaller multi-learner comparison
congestion-marl compare --seeds 4 --episodes 500

# Full deterministic browser export
congestion-marl export --output web/public/data/story-v1.json

# Independent schema and numerical validation
congestion-marl validate web/public/data/story-v1.json

# Warmup-based implementation profiling
congestion-marl benchmark --output benchmarks/measurements.json
```

## Deterministic data regeneration

The committed public bundle is [web/public/data/story-v1.json](web/public/data/story-v1.json). It includes the model, exact analyses, all seed summaries, aggregates, representative trajectories, learner state, 253 snapshots per representative 5,000-episode learner run, complete landscape geometry, benchmark metadata, and provenance.

```bash
make export

congestion-marl export --output /tmp/story-a.json
congestion-marl export --output /tmp/story-b.json
cmp /tmp/story-a.json /tmp/story-b.json
cmp /tmp/story-a.json web/public/data/story-v1.json
```

Stable key ordering, compact finite-number JSON, canonical rounding to 12 decimal places, fixed seed namespaces, excluded wall-clock runtime, and an excluded git hash make the canonical export byte reproducible across the pinned Linux and macOS toolchains.

## Web development

```bash
cd web
npm install
npm run dev
```

The Vite base path is the repository name so the same production bundle works on GitHub Pages. WebGL failure can be tested deliberately with `?forceFallback=1`.

## Validation and tests

```bash
# Python formatting, lint, strict types, tests, coverage, export validation,
# frontend formatting, lint, unit tests, links, production build, and Playwright
make check

# Individual commands
make lint
make typecheck
make test
make validate
make web-check
make e2e
```

The Python suite covers exact route costs, all count states, every feasible deviation, equilibrium, welfare, toll identities, learners, random-stream isolation, deterministic exports, and CLI behavior. The TypeScript suite covers schema and numerical re-derivation, geometry, color and radius mappings, charts, snapshots, and state transitions. Chromium Playwright tests cover the ten-chapter narrative, exact playback, controls, keyboard camera use, reduced motion, fallback, accessibility, and 1440, 1280, tablet, and mobile layouts.

## Deployment

`ci.yml` validates Python and web code on pushes and pull requests. `deploy-pages.yml` builds `web/dist`, uploads the GitHub Pages artifact, and deploys from the `main` branch. No generated `dist` directory is committed.

After deployment, the public desktop and mobile compositions can be checked with:

```bash
cd web
npm run verify:deployment -- https://mihirrao-10.github.io/multi-agent-reinforcement-learning-in-congestion-games/ /tmp/deployment-check
```

## Limitations

- This is one atomic symmetric routing game with 80 agents sharing one origin and destination.
- Each agent chooses one complete route per episode from two or three available routes.
- There is no continuous-time traffic, queueing, or physical road-capacity model beyond the authored latency functions.
- Route costs are mathematical latency functions; particles are an assignment visualization.
- Q-learning is tabular and independent. Other adapting agents make each learner's environment nonstationary, so no general independent-Q convergence theorem is claimed.
- Behavior can depend on hyperparameters and exploration.
- Hedge receives full counterfactual information; best response receives exact model information.
- Toll conclusions belong to this authored finite instance, and toll payments are treated as transfers.
- This is an educational computational study, not transportation-policy advice or a real traffic forecast.
- All numerical claims belong to the stated model.

## References

- Robert W. Rosenthal, [A class of games possessing pure-strategy Nash equilibria](https://doi.org/10.1007/BF01737559), *International Journal of Game Theory* 2, 65-67, 1973.
- Dietrich Braess, Anna Nagurney, and Tina Wakolbinger, [On a Paradox of Traffic Planning](https://doi.org/10.1287/trsc.1050.0127), *Transportation Science* 39(4), 446-450, 2005 English translation of the 1968 paper.
- Tim Roughgarden and Éva Tardos, [How Bad Is Selfish Routing?](https://doi.org/10.1145/506147.506153), *Journal of the ACM* 49(2), 236-259, 2002.
- Christopher J. C. H. Watkins and Peter Dayan, [Q-learning](https://doi.org/10.1007/BF00992698), *Machine Learning* 8, 279-292, 1992.
- Yoav Freund and Robert E. Schapire, [A Decision-Theoretic Generalization of On-Line Learning and an Application to Boosting](https://doi.org/10.1006/jcss.1997.1504), *Journal of Computer and System Sciences* 55(1), 119-139, 1997.

See the [course map](docs/course-map.md) for authoritative books, notes, conceptual boundaries, and the project-specific versus established-theory split.

## Repository map

```text
src/congestion_marl/       exact game, learners, experiments, export, CLI
tests/                     Python mathematical and implementation tests
benchmarks/                profiling scripts and measured metadata
scripts/                   deterministic export helper
web/src/                   validated story, charts, Three.js, fallback, styles
web/tests/                 Vitest unit and numerical consistency tests
web/e2e/                   Playwright behavior, accessibility, and viewport tests
web/public/data/           authoritative versioned story export
docs/                      methodology, interview guide, course map, assets
.github/workflows/         CI and GitHub Pages deployment
```
