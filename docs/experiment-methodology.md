# Experiment Methodology

## Scope

This repository is a deterministic computational study of one population-normalized atomic congestion game. It asks three bounded questions:

1. What are the exact pure equilibria and physical social optima when the shortcut is open, removed, or tolled?
2. What profiles do declared independent-Q, asynchronous strict-best-response, and full-information Hedge experiments produce?
3. Can exact analysis, empirical learning, scalable rendering, and a static public export remain independently auditable?

Exact claims come from rational game analysis. Learner outcomes are empirical. No observed trajectory is promoted to a general convergence theorem.

## Game definition

### Populations and actions

The public populations are `N = 100`, `N = 1,000`, and `N = 10,000`. Agents are labeled, atomic, and unsplittable. Each chooses one complete source-to-destination route per episode.

| Index | Code | Name | Directed edges |
| ---: | --- | --- | --- |
| 0 | `U` | Upper | `S -> U`, `U -> T` |
| 1 | `L` | Lower | `S -> V`, `V -> T` |
| 2 | `Z` | Shortcut | `S -> U`, `U -> V`, `V -> T` |

The closed scenario removes the central edge and action `Z`.

### Physical latencies

For nonnegative integer load `x`:

| Edge | Physical latency |
| --- | ---: |
| `S -> U` | `40x/N` |
| `U -> T` | `45` |
| `S -> V` | `45` |
| `V -> T` | `40x/N` |
| `U -> V` | `0` |

For open route counts `(x_U, x_L, x_Z)` summing to `N`:

```text
x_SU = x_U + x_Z
x_VT = x_L + x_Z

J_U = 40x_SU/N + 45
J_L = 45 + 40x_VT/N
J_Z = 40x_SU/N + 40x_VT/N.
```

Physical social cost is

```text
C(x) = sum_e x_e c_e(x_e).
```

Average physical latency is `C(x)/N`. There is no capacity, queue, spillback, continuous-time traffic, or travel-time state beyond these functions.

### Scenarios

- `braess-open`: all routes are available; perceived cost equals physical cost.
- `braess-closed`: the central edge and Shortcut action are removed.
- `braess-tolled`: all routes are available; the variable edges have `tau_N(x) = 40(x - 1)/N`.

A tolled learner's reward is negative physical route latency minus route toll payment. Tolls influence private incentives but remain transfers outside physical social cost.

## Exact analysis

### Remove-then-add deviations

For occupied origin route `r` and candidate route `s`, every unilateral counterfactual uses

```text
x' = x - one_hot(r) + one_hot(s).
```

The current cost of `r` at `x` is compared with the candidate cost of `s` at `x'`. This counts the moving agent exactly once on every shared edge it leaves or joins.

Exploitability is

```text
epsilon(x) = max_i [J_i(x) - min_s J_i(s, x_-i)].
```

It is zero exactly when no agent can reduce perceived route cost by switching alone.

### Why the large-population reduction is exact

Materializing every weak composition is practical at 100 agents but not at 10,000:

| Population | Open or tolled states | Closed states |
| ---: | ---: | ---: |
| 100 | 5,151 | 101 |
| 1,000 | 501,501 | 1,001 |
| 10,000 | 50,015,001 | 10,001 |

For the open game, both physical social cost and untolled Rosenthal potential can be written as

```text
f(x_U) + f(x_L)
```

for an exact discrete-convex component function. Each component minimum lies below `N/2`, so feasible pairs from the complete component minimizer set give the complete global minimizer set. For the untolled potential, these minimizers are also exactly the one-agent local minima, hence all pure Nash equilibria. In the tolled game, perceived potential is physical social cost, so the same social minimizers are the complete equilibrium set. The closed game is a direct scan over `x_U`, with `x_L = N - x_U`.

The implementation therefore evaluates `O(N)` exact `Fraction` values rather than `O(N^2)` profiles. Tests compare this reduction with exhaustive enumeration over multiple small populations in every scenario. They compare all equilibria, all optima, Price of Anarchy, Price of Stability, route and counterfactual costs, exploitability, potential values, and tied minima.

### Exact default outputs

At `N = 100`:

| Scenario | Pure Nash set | Physical optimum set | Equilibrium cost | Optimum cost |
| --- | --- | --- | ---: | ---: |
| Open | `{(0, 0, 100)}` | `{(44, 44, 12)}` | 8,000 | 6,468.8 |
| Closed | `{(50, 50)}` | `{(50, 50)}` | 6,500 | 6,500 |
| Tolled | `{(44, 44, 12)}` | `{(44, 44, 12)}` | 6,468.8 | 6,468.8 |

Open Price of Anarchy and Price of Stability are both `5000/4043`. Integer ties are retained. At `N = 1,000`, the open social optimum and tolled equilibrium each contain four adjacent profiles.

### Potential identities

Rosenthal potential is

```text
Phi(x) = sum_e sum(k=1..x_e) c_e(k).
```

Every small-instance directed deviation is checked exactly for

```text
Phi(x') - Phi(x) = J_i(x') - J_i(x).
```

The same symbolic edgewise identity applies for every supported population. The export records the number of feasible deviations covered by that identity: 30,300 at 100 agents, 3,003,000 at 1,000, and 300,030,000 at 10,000.

For a variable edge under the discrete toll,

```text
sum(k=1..x) [40k/N + 40(k - 1)/N] = 40x^2/N = x c_N(x).
```

Therefore tolled perceived potential equals physical social cost for every integer state. The 100-agent implementation checks all 5,151 tolled states directly. Large-population validity follows from the exact telescoping identity and small exhaustive cross-checks.

## Learner protocols

### Independent tabular Q-learning

Each agent owns a separate Q row with one value per feasible route. At episode `t`:

1. Every agent selects an epsilon-greedy action using the pre-episode table.
2. All actions are fixed before any cost is evaluated.
3. Aggregate route counts determine exact selected-population loads and rewards.
4. Each agent updates only its selected entry.

```text
Q_i(a_i) <- Q_i(a_i) + 0.15 [r_i - Q_i(a_i)].
```

The exploration schedule is

```text
epsilon_t = max(0.01, 0.80 * 0.999^(t-1)).
```

Initial values are zero. `gamma = 0` because each episode is a one-stage repeated decision. Final policy evaluation uses epsilon zero and a dedicated random stream. Training endpoints and final greedy evaluation are both retained.

### Public study scopes

| Population | Q episodes | Seeds per scenario | Purpose |
| ---: | ---: | ---: | --- |
| 100 | 5,000 | 64 | canonical replicated learner comparison |
| 1,000 | 3,200 | 1 | audited vectorized scale trajectory |
| 10,000 | 2,400 | 1 | audited vectorized scale trajectory |

The large episode schedules keep deterministic public regeneration practical while retaining the same update rule and epsilon schedule. They are declared in each bundle. Their one-run scope does not support uncertainty comparisons with the canonical 64-seed study.

The committed open training endpoints are `(0, 0, 100)`, `(7, 9, 984)`, and `(258, 257, 9485)` for the three populations. The corresponding epsilon-zero greedy profiles are `(0, 0, 100)`, `(0, 0, 1000)`, and `(0, 0, 10000)`. These are empirical results from distinct computed arrays, not rescaled curves.

### Baselines

- Asynchronous strict best response selects one labeled agent at a time, evaluates exact unilateral costs, and accepts only strict improvements. The 100-agent comparison uses 16 seeded orders per scenario. The exported raw scale paths contain 61, 660, and 6,732 count states; large rendered paths retain 144 deterministic points while the raw path is validated separately.
- Hedge gives every agent the full counterfactual route-cost vector and uses stable log weights with `eta = 0.18`. The canonical comparison uses 64 seeds per scenario.

Information assumptions differ. Q-learning sees only selected-route reward. Best response has exact model access. Hedge has full counterfactual feedback. Low external regret is not presented as last-iterate pure Nash convergence.

### Seed isolation and representatives

Base seed `20260804` is separated by NumPy `SeedSequence` namespaces. Each run spawns PCG64 streams for action exploration, tie-breaking, scenario initialization, aggregate selection, representative playback, and greedy evaluation. Adding draws to one role cannot shift the others.

The representative run minimizes total pairwise L1 distance between final route-count vectors. Lower exploitability and then smaller seed break ties. It is rerun independently before export, and its summary must agree.

## Snapshot and export protocol

Snapshots begin at measured episode 1 and always include the final training episode. Deterministic adaptive thinning keeps 243 snapshots at 100 agents, 136 at 1,000, and 102 at 10,000 for the committed open trajectories. Each snapshot contains:

- route counts and derived edge loads;
- physical edge latencies;
- physical and perceived route costs;
- physical social cost and average latency;
- toll payment, both potentials, and exploitability;
- regret summary and policy entropy.

Population-sized assignments and Q arrays are intentionally absent from public JSON. The Q shape, simultaneous-choice contract, selected-action-only update contract, and epsilon-zero evaluation remain explicit metadata.

Schema `2.0.0` uses one manifest plus population-specific bundles. Python validation independently re-derives all public numerical fields from aggregate counts. TypeScript uses Zod plus a second numerical re-derivation before presentation. Stable key ordering, finite-number serialization, fixed seeds, and omitted wall-clock fields make regeneration byte-identical.

## Potential surface protocol

The 100-agent landscape enumerates all 5,151 count states and 10,000 triangles. Larger landscapes use a fixed resolution of 64, producing 2,145 vertices and 4,096 triangles. Each sample maps by deterministic largest remainder to a unique exact population count state, then evaluates the exact formula there.

Exact equilibrium and optimum markers are generated independently of the sample mesh. Q-learning trajectories use exported snapshots. The directional arrowheads belong only to the strict-best-response trajectory and point from earlier to later, lower-potential states. Q-learning is explicitly not described as monotone.

## Rendering cohorts

At 100 agents, one visible bead represents one agent. At larger populations, exactly 180 visible beads are allocated to routes by deterministic largest remainder. Each positive route receives at least one bead. Integer cohort weights sum exactly to the selected population. Cohort construction is a renderer input and cannot change route counts, loads, costs, or charts.

## Validation boundary

The project distinguishes:

- exact equilibrium, optimum, potential, toll, and welfare statements;
- empirical learner summaries under declared settings;
- affine geometry interpolation for display;
- bounded particle motion as a route and relative-latency encoding.

It does not claim a general independent-Q convergence theorem, a continuous traffic forecast, a physical queueing model, or a universal optimal-toll result beyond the authored game family.
