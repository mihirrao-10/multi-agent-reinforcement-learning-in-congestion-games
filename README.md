# When Every Agent Finds the Shortcut

## Multi-Agent Reinforcement Learning in Congestion Games

[Live interactive essay](https://mihirrao-10.github.io/multi-agent-reinforcement-learning-in-congestion-games/) · [Experiment methodology](docs/experiment-methodology.md) · [Interview guide](docs/interview-guide.md) · [Course map](docs/course-map.md)

Each episode represents a new morning commute. Independent tabular learners separately choose complete routes from source `S` to destination `T`, experience only their own trip, and update only their own selected action. They do not meet, message, or exchange Q-values. Their shared congestion couples their rewards without creating communication between learners. With the central link closed, an even split gives every commuter a 90-minute trip. The zero-cost link is privately attractive, and the untolled game has an all-Shortcut equilibrium with a 120-minute trip. Removing the link restores the 90-minute outcome. Discrete marginal-cost tolls instead align equilibrium with the same physical optimum.

The five audited population options are 100, 1,000, 10,000, 100,000, and 1,000,000. Exact equilibrium, welfare, toll, and potential claims always use the full selected population. Independent Q-learning simulates every commuter through 10,000. The 100,000 and 1,000,000 views are explicitly labeled 10,000-learner sampled studies: deterministic largest-remainder scaling converts estimated route shares into represented-population integer counts, then every displayed load and cost is recomputed for the full represented population.

The thesis is narrow: capable individual learning can faithfully discover inefficient incentives. Learning quality and incentive quality are different questions.

## Model

There are `N` labeled, unsplittable agents with source `S` and destination `T`. One action is one complete route:

| Code | Route | Edges |
| --- | --- | --- |
| `U` | Upper | `S -> U -> T` |
| `L` | Lower | `S -> V -> T` |
| `Z` | Shortcut | `S -> U -> V -> T` |

For integer edge load `x`, the physical latencies are:

| Edge | Latency |
| --- | ---: |
| `S -> U` | `60x/N` minutes |
| `U -> T` | `60` minutes |
| `S -> V` | `60` minutes |
| `V -> T` | `60x/N` minutes |
| `U -> V` | `0` |

For route counts `(x_U, x_L, x_Z)` summing to `N`,

```text
J_U = 60(x_U + x_Z)/N + 60
J_L = 60 + 60(x_L + x_Z)/N
J_Z = 60(x_U + x_Z)/N + 60(x_L + x_Z)/N
```

Reward is negative perceived route cost. Physical social cost is the sum of physical travel latency across agents. Toll payments affect perceived cost but are treated as transfers outside that physical objective.

## Exact default results

All canonical arithmetic uses `Fraction`, including remove-then-add deviations. At `N = 100`:

| Scenario | Displayed pure Nash equilibrium | Physical social cost | Average latency | Physical optimum |
| --- | --- | ---: | ---: | --- |
| Shortcut open | `(0, 0, 100)` | `12000` commuter-minutes | `120` minutes | `(50, 50, 0)` |
| Shortcut removed | `(50, 50)` | `9000` commuter-minutes | `90` minutes | `(50, 50)` |
| Shortcut tolled | `(50, 50, 0)` | `9000` commuter-minutes | `90` minutes | `(50, 50, 0)` |

The finite untolled game does not have a unique pure equilibrium. The exact set is

```text
(0, 0, 100)
(0, 1, 99)
(1, 0, 99)
(1, 1, 98)
```

These are weak equilibria: no single commuter can strictly lower its own cost by moving. The all-Shortcut profile is the worst member and the narrative example. The best equilibrium costs `59406/5` commuter-minutes. The exact physical optimum costs `9000` commuter-minutes. Therefore

```text
Price of Anarchy = 4/3
Price of Stability = 9901/7500
```

These are approximately `1.333333` and `1.320133`. The code computes every equilibrium and optimum rather than assuming uniqueness. For every supported even population, the physical optimum is the unique even split `(N/2, N/2, 0)`, while the untolled weak-equilibrium set has the same four count-pattern forms shown above.

### Efficient exact analysis

The open social objective and the untolled Rosenthal potential each separate into two identical discrete-convex functions of `x_U` and `x_L`. The social component is minimized at `N/2`. The untolled potential component has its finite weak tie at counts zero and one, producing the four equilibria above. The closed and tolled games are minimized at `N/2`. A fixed neighborhood around each exact rational center, including adjacent integers and boundaries, contains every discrete minimizer and tie. Its feasible Cartesian product gives every global optimum, and the same reduction applied to the exact potential gives every equilibrium.

This is exact constant-size candidate analysis. It reports the correct count-state totals without materializing them:

| Population | Open count states | Displayed surface |
| ---: | ---: | ---: |
| 100 | 5,151 | all 5,151 vertices |
| 1,000 | 501,501 | 2,145 deterministic samples |
| 10,000 | 50,015,001 | 2,145 deterministic samples |
| 100,000 | 5,000,150,001 | 2,145 deterministic samples |
| 1,000,000 | 500,001,500,001 | 2,145 deterministic samples |

Small populations are exhaustively cross-checked against the reduced algorithm for all scenarios, all equilibria, all optima, efficiency ratios, exploitability, potential changes, and toll identities.

### Potential and tolls

Rosenthal potential is

```text
Phi(x) = sum_e sum(k=1..x_e) c_e(k).
```

For every unilateral deviation, its exact change equals the deviating agent's exact perceived-cost change. The strict best-response baseline therefore descends and terminates.

The two variable edges receive the discrete marginal toll

```text
tau_N(x) = (x - 1)[c_N(x) - c_N(x - 1)] = 60(x - 1)/N.
```

Then

```text
sum(k=1..x) [c_N(k) + tau_N(k)] = x c_N(x),
```

so tolled perceived potential equals physical social cost exactly.

## Learning studies

Each agent owns a separate tabular Q row. There is no parameter sharing, centralized controller, critic, replay buffer, or neural network. All agents select actions before any reward is evaluated, and each updates only the selected entry:

```text
Q_i(a_i) <- Q_i(a_i) + alpha [r_i - Q_i(a_i)].
```

`gamma = 0` because an episode is a one-stage repeated decision. The canonical schedule uses `alpha = 0.15`, zero initial values, and epsilon `max(0.01, 0.80 * 0.999^(t-1))`. Final policies are evaluated separately at epsilon zero with an isolated random stream.

The 100-agent comparison retains 64 independent-Q seeds and 64 Hedge seeds per scenario, plus 16 strict-best-response orders. Larger presets retain one clearly labeled deterministic audited Q-learning run per scenario:

| Population | Episodes | Public study scope | Open training endpoint | Epsilon-zero greedy evaluation |
| ---: | ---: | --- | --- | --- |
| 100 | 5,000 | 64-seed canonical comparison | `(23, 20, 57)` | `(21, 20, 59)` |
| 1,000 | 3,200 | one audited scale run | `(61, 68, 871)` | `(55, 59, 886)` |
| 10,000 | 2,400 | one audited scale run | `(258, 257, 9485)` | `(0, 0, 10000)` |
| 100,000 | 2,400 | sampled 10,000-learner proxy | `(2580, 2570, 94850)` | `(0, 0, 100000)` |
| 1,000,000 | 2,400 | sampled 10,000-learner proxy | `(25800, 25700, 948500)` | `(0, 0, 1000000)` |

The training endpoint and epsilon-zero evaluation answer different empirical questions and remain separate in the export. Uncertainty from the one-run scale studies is never compared as if it had 64 replications.

Best response has exact model access. Hedge receives full counterfactual feedback. Independent Q-learning sees only experienced selected-route reward. Those information assumptions are intentionally different.

## Population-aware public data

The browser never trains learners or computes exact analysis. Python writes schema `3.0.0` data:

```text
web/public/data/manifest-v3.json
web/public/data/population-100-v3.json
web/public/data/population-1000-v3.json
web/public/data/population-10000-v3.json
web/public/data/population-100000-v3.json
web/public/data/population-1000000-v3.json
```

The initial page fetches only the manifest and default 100,000-commuter bundle. Other population bundles load on selection and are cached. The fully replicated 100-commuter comparison loads only when its chapter is reached. A failed population selection leaves the previous validated bundle active and exposes a retry. Snapshots store aggregate route counts, derived edge loads, route costs, objectives, and diagnostics, not population-sized assignment arrays. Large surfaces are fixed-resolution samples of the exact formula, while equilibrium, optimum, active-profile, and path markers remain exact integer states.

The network uses continuous translucent directional flow on every edge. Nonlinear tube thickness, hue, and opacity all encode traffic share monotonically from thin green to thick red. Broad moving light supplies a fluid-looking direction cue without pretending to show individual commuters. Four enlarged white cores with soft white halos identify `S`, `U`, `V`, and `T`. The native SVG fallback preserves the same encodings. Reduced motion freezes every directional phase at a deterministic value.

## Architecture

```text
Python exact model and vectorized experiments
  -> deterministic manifest and population bundles
  -> independent Python export validation
  -> Zod and TypeScript numerical re-derivation
  -> progressive journey state machine
  -> Three.js, native SVG fallback, SVG charts, and KaTeX
```

Randomness is isolated with NumPy `SeedSequence` and PCG64. Stable ordering and finite-number serialization make canonical exports byte reproducible. Wall-clock measurements and git state are excluded from canonical JSON.

## Installation and commands

Python 3.12 or newer and Node 20 or newer are required.

```bash
git clone https://github.com/mihirrao-10/multi-agent-reinforcement-learning-in-congestion-games.git
cd multi-agent-reinforcement-learning-in-congestion-games
make setup
```

```bash
# Exact analysis at any supported population
congestion-marl enumerate --scenario braess-open --population 1000000 --json

# One deterministic learner
congestion-marl simulate --scenario braess-open --learner q-learning --agents 100

# Regenerate and independently validate every public bundle
make export
make validate

# Python formatting, lint, strict types, coverage, export validation,
# frontend checks, production build, and Chromium end-to-end tests
make check
```

For local web work:

```bash
cd web
npm install
npm run dev
```

Use `?forceFallback=1` to exercise the native SVG path.

## Deployment

GitHub Actions runs Python and web validation on every push and pull request. The Pages workflow validates committed population bundles, builds the repository-base-path production artifact, and deploys `main`.

```bash
cd web
npm run verify:deployment -- \
  https://mihirrao-10.github.io/multi-agent-reinforcement-learning-in-congestion-games/ \
  /tmp/congestion-deployment-check
```

## Scientific guardrails

- Exact equilibrium and welfare claims come from exact analysis, not from learner outcomes.
- Independent-Q outcomes are empirical. Classic single-agent convergence theory is not transferred unchanged to the nonstationary multi-agent setting.
- Low external regret concerns time-average play and does not imply last-iterate pure Nash convergence.
- A representative run is selected by a declared final-count medoid rule, then exploitability, then seed.
- Visual geometry may interpolate. Every displayed numerical metric belongs to one exported snapshot or exact profile.
- Directional flow is an aggregate traffic-share and direction encoding, not a microscopic traffic simulation.
- This is an educational computational study, not a transportation forecast or policy recommendation.

## References

- Robert W. Rosenthal, [A class of games possessing pure-strategy Nash equilibria](https://doi.org/10.1007/BF01737559), *International Journal of Game Theory* 2, 65-67, 1973.
- Dietrich Braess, Anna Nagurney, and Tina Wakolbinger, [On a Paradox of Traffic Planning](https://doi.org/10.1287/trsc.1050.0127), *Transportation Science* 39(4), 446-450, 2005 English translation.
- Tim Roughgarden and Éva Tardos, [How Bad Is Selfish Routing?](https://doi.org/10.1145/506147.506153), *Journal of the ACM* 49(2), 236-259, 2002.
- Christopher J. C. H. Watkins and Peter Dayan, [Q-learning](https://doi.org/10.1007/BF00992698), *Machine Learning* 8, 279-292, 1992.
- Yoav Freund and Robert E. Schapire, [A Decision-Theoretic Generalization of On-Line Learning and an Application to Boosting](https://doi.org/10.1006/jcss.1997.1504), *Journal of Computer and System Sciences* 55(1), 119-139, 1997.

## Repository map

```text
src/congestion_marl/       game, exact analysis, learners, export, CLI
tests/                     Python mathematical and implementation tests
benchmarks/                focused performance checks
scripts/                   deterministic export helper
web/src/                   journey, charts, Three.js, fallback, styles
web/tests/                 Vitest units and browser-data consistency tests
web/e2e/                   Playwright behavior, accessibility, and viewports
web/public/data/           authoritative manifest and population bundles
docs/                      methodology, interview guide, course map
.github/workflows/         CI and GitHub Pages deployment
```
