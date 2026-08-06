# When Every Agent Finds the Shortcut

## Multi-Agent Reinforcement Learning in Congestion Games

[Live interactive essay](https://mihirrao-10.github.io/multi-agent-reinforcement-learning-in-congestion-games/) · [Experiment methodology](docs/experiment-methodology.md) · [Interview guide](docs/interview-guide.md) · [Course map](docs/course-map.md)

One hundred independent tabular learners repeatedly choose complete routes through an atomic Braess network. The zero-cost central link is privately attractive, so the untolled game has an exact equilibrium in which every agent uses it. Average latency is then 80, compared with 64.688 at the physical optimum. Removing the link lowers equilibrium latency to 65. Discrete marginal-cost tolls instead align equilibrium with the physical optimum.

The population can be changed honestly to 100, 1,000, or 10,000. Every preset uses the same population-normalized game, exact population-specific equilibrium and welfare analysis, and a separately computed independent-Q trajectory. The larger displays use bounded weighted cohorts and sampled potential surfaces; their metrics and exact markers remain tied to integer count states.

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
| `S -> U` | `40x/N` |
| `U -> T` | `45` |
| `S -> V` | `45` |
| `V -> T` | `40x/N` |
| `U -> V` | `0` |

For route counts `(x_U, x_L, x_Z)` summing to `N`,

```text
J_U = 40(x_U + x_Z)/N + 45
J_L = 45 + 40(x_L + x_Z)/N
J_Z = 40(x_U + x_Z)/N + 40(x_L + x_Z)/N
```

Reward is negative perceived route cost. Physical social cost is the sum of physical travel latency across agents. Toll payments affect perceived cost but are treated as transfers outside that physical objective.

## Exact default results

All canonical arithmetic uses `Fraction`, including remove-then-add deviations. At `N = 100`:

| Scenario | Pure Nash equilibrium | Physical social cost | Average latency | Physical optimum |
| --- | --- | ---: | ---: | --- |
| Shortcut open | `(0, 0, 100)` | `8000` | `80` | `(44, 44, 12)` |
| Shortcut removed | `(50, 50)` | `6500` | `65` | `(50, 50)` |
| Shortcut tolled | `(44, 44, 12)` | `6468.8` | `64.688` | `(44, 44, 12)` |

The open optimum cost is `32344/5`. Therefore

```text
Price of Anarchy = Price of Stability = 5000/4043
```

This is approximately `1.236705`. The code computes every tied optimum or equilibrium rather than assuming uniqueness. For example, `N = 1,000` has four adjacent tied open optima:

```text
(437, 437, 126)
(437, 438, 125)
(438, 437, 125)
(438, 438, 124)
```

### Efficient exact analysis

The open and tolled objectives separate into two identical discrete-convex functions of `x_U` and `x_L`. Scanning one integer component from `0` through `N` finds the complete component minimizer set. Its feasible Cartesian product gives every global optimum, and the same reduction applied to the exact potential gives every equilibrium. The closed game is a one-dimensional scan.

This is exact `O(N)` analysis. It reports the correct count-state totals without materializing them:

| Population | Open count states | Displayed surface |
| ---: | ---: | ---: |
| 100 | 5,151 | all 5,151 vertices |
| 1,000 | 501,501 | 2,145 deterministic samples |
| 10,000 | 50,015,001 | 2,145 deterministic samples |

Small populations are exhaustively cross-checked against the reduced algorithm for all scenarios, all equilibria, all optima, efficiency ratios, exploitability, potential changes, and toll identities.

### Potential and tolls

Rosenthal potential is

```text
Phi(x) = sum_e sum(k=1..x_e) c_e(k).
```

For every unilateral deviation, its exact change equals the deviating agent's exact perceived-cost change. The strict best-response baseline therefore descends and terminates.

The two variable edges receive the discrete marginal toll

```text
tau_N(x) = (x - 1)[c_N(x) - c_N(x - 1)] = 40(x - 1)/N.
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
| 100 | 5,000 | 64-seed canonical comparison | `(0, 0, 100)` | `(0, 0, 100)` |
| 1,000 | 3,200 | one audited scale run | `(7, 9, 984)` | `(0, 0, 1000)` |
| 10,000 | 2,400 | one audited scale run | `(258, 257, 9485)` | `(0, 0, 10000)` |

The training endpoint and epsilon-zero evaluation answer different empirical questions and remain separate in the export. Uncertainty from the one-run scale studies is never compared as if it had 64 replications.

Best response has exact model access. Hedge receives full counterfactual feedback. Independent Q-learning sees only experienced selected-route reward. Those information assumptions are intentionally different.

## Population-aware public data

The browser never trains agents or computes the 10,000-agent exact analysis. Python writes schema `2.0.0` data:

```text
web/public/data/manifest-v2.json
web/public/data/population-100-v2.json
web/public/data/population-1000-v2.json
web/public/data/population-10000-v2.json
```

The initial page fetches only the manifest and 100-agent bundle. Larger bundles load on selection. Snapshots store aggregate route counts, derived edge loads, route costs, objectives, and diagnostics, not population-sized assignment arrays. Large surfaces are fixed-resolution samples of the exact formula, while equilibrium, optimum, active-profile, and path markers remain exact integer states.

At 100 agents, one visible bead represents one agent. Larger presets render at most 180 beads allocated by deterministic largest remainder. Every positive route receives a bead, and exact represented-agent weights sum to `N`. Cohorts affect rendering only, never metrics.

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
congestion-marl enumerate --scenario braess-open --agents 10000 --json

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
- Particle motion is a route and relative-latency encoding, not a microscopic traffic simulation.
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
