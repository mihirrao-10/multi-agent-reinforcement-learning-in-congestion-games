# Experiment Methodology

## Scope

This repository is a deterministic computational study of one population-normalized atomic congestion game. It asks three bounded questions:

1. What are the exact pure equilibria and physical social optima when the shortcut is open, removed, or tolled?
2. What profiles do declared independent-Q, asynchronous strict-best-response, and full-information Hedge experiments produce?
3. Can exact analysis, empirical learning, scalable rendering, and a static public export remain independently auditable?

Exact claims come from rational game analysis. Learner outcomes are empirical. No observed trajectory is promoted to a general convergence theorem.

## Game definition

### Populations and actions

The public populations are `N = 100`, `N = 1,000`, `N = 10,000`, `N = 100,000`, and `N = 1,000,000`. Commuters are labeled, atomic, and unsplittable. Each episode is one new morning commute, and each learner chooses one complete source-to-destination route.

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
| `S -> U` | `60x/N` minutes |
| `U -> T` | `60` minutes |
| `S -> V` | `60` minutes |
| `V -> T` | `60x/N` minutes |
| `U -> V` | `0` |

For open route counts `(x_U, x_L, x_Z)` summing to `N`:

```text
x_SU = x_U + x_Z
x_VT = x_L + x_Z

J_U = 60x_SU/N + 60
J_L = 60 + 60x_VT/N
J_Z = 60x_SU/N + 60x_VT/N.
```

Physical social cost is

```text
C(x) = sum_e x_e c_e(x_e).
```

Average physical latency is `C(x)/N`. There is no capacity, queue, spillback, continuous-time traffic, or travel-time state beyond these functions.

### Scenarios

- `braess-open`: all routes are available; perceived cost equals physical cost.
- `braess-closed`: the central edge and Shortcut action are removed.
- `braess-tolled`: all routes are available; the variable edges have `tau_N(x) = 60(x - 1)/N` minutes.

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

Materializing every weak composition is practical at 100 commuters but not at the larger presets:

| Population | Open or tolled states | Closed states |
| ---: | ---: | ---: |
| 100 | 5,151 | 101 |
| 1,000 | 501,501 | 1,001 |
| 10,000 | 50,015,001 | 10,001 |
| 100,000 | 5,000,150,001 | 100,001 |
| 1,000,000 | 500,001,500,001 | 1,000,001 |

For the open game, both physical social cost and untolled Rosenthal potential can be written as

```text
f(x_U) + f(x_L)
```

for an exact discrete-convex component function. The physical social-cost component is centered at `N/2`. The untolled potential component has equal discrete minima at zero and one, so its feasible Cartesian product produces four weak pure equilibria. The closed-game center is `N/2`. Floor, ceiling, adjacent integers, and boundaries form a constant-size candidate set that retains every integer tie. Feasible pairs from the complete component minimizer set give the complete global minimizer set. For the untolled potential, these minimizers are also exactly the one-agent local minima, hence all pure Nash equilibria. In the tolled game, perceived potential is physical social cost, so the same social minimizers are the complete equilibrium set.

The implementation therefore evaluates a constant number of exact `Fraction` values rather than `O(N)` component values or `O(N^2)` profiles. Tests compare this reduction with exhaustive enumeration over multiple small populations and with the former linear scan across a wide medium-population range. They compare all equilibria, all optima, Price of Anarchy, Price of Stability, route and counterfactual costs, exploitability, potential values, and tied minima.

### Exact default outputs

At `N = 100`:

| Scenario | Pure Nash set | Physical optimum set | Equilibrium cost | Optimum cost |
| --- | --- | --- | ---: | ---: |
| Open | `{(0, 0, 100), (0, 1, 99), (1, 0, 99), (1, 1, 98)}` | `{(50, 50, 0)}` | 12,000 worst | 9,000 |
| Closed | `{(50, 50)}` | `{(50, 50)}` | 9,000 | 9,000 |
| Tolled | `{(50, 50, 0)}` | `{(50, 50, 0)}` | 9,000 | 9,000 |

Costs in the table are commuter-minutes. The all-Shortcut profile has an average latency of 120 minutes and supplies the worst equilibrium cost. The exact optimum, closed equilibrium, and tolled equilibrium average 90 minutes. Open Price of Anarchy is `4/3`; Price of Stability is `9901/7500`. The implementation retains the full weak-equilibrium set and makes no uniqueness claim.

### Potential identities

Rosenthal potential is

```text
Phi(x) = sum_e sum(k=1..x_e) c_e(k).
```

Every small-instance directed deviation is checked exactly for

```text
Phi(x') - Phi(x) = J_i(x') - J_i(x).
```

The same symbolic edgewise identity applies for every supported population. The export records the number of feasible deviations covered by that identity: 30,300 at 100; 3,003,000 at 1,000; 300,030,000 at 10,000; 30,000,300,000 at 100,000; and 3,000,003,000,000 at 1,000,000.

For a variable edge under the discrete toll,

```text
sum(k=1..x) [60k/N + 60(k - 1)/N] = 60x^2/N = x c_N(x).
```

Therefore tolled perceived potential equals physical social cost for every integer state. The 100-agent implementation checks all 5,151 tolled states directly. Large-population validity follows from the exact telescoping identity and small exhaustive cross-checks.

## Learner protocols

### Independent tabular Q-learning

Each learner owns a separate Q row with one value per feasible route. At episode `t`, representing the next morning:

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

Learners do not meet, exchange messages, share Q-values, or observe one another's private estimates. Each independent-Q learner receives only the reward from its own selected trip. The shared edge loads couple outcomes through congestion; that coupling is not communication.

### Public study scopes

| Population | Q episodes | Seeds per scenario | Purpose |
| ---: | ---: | ---: | --- |
| 100 | 5,000 | 64 | canonical replicated learner comparison |
| 1,000 | 3,200 | 1 | audited vectorized scale trajectory |
| 10,000 | 2,400 | 1 | audited vectorized scale trajectory |
| 100,000 | 2,400 | 1 | 10,000-learner sampled route-share study |
| 1,000,000 | 2,400 | 1 | 10,000-learner sampled route-share study |

The larger episode schedules keep deterministic public regeneration practical while retaining the same update rule and epsilon schedule. The 100, 1,000, and 10,000 studies simulate the full represented population. For 100,000 and 1,000,000, 10,000 separate tabular learners estimate normalized route shares. Deterministic largest remainder produces full-population integer route counts, and all loads, route costs, latency, social cost, exploitability, and exact distances are recomputed for the represented population. The labels and bundle metadata expose both learner count and represented population. Their one-run scope does not support uncertainty comparisons with the canonical 64-seed study.

The committed open training endpoints are `(23, 20, 57)`, `(61, 68, 871)`, `(258, 257, 9485)`, `(2580, 2570, 94850)`, and `(25800, 25700, 948500)`. The corresponding epsilon-zero greedy profiles are `(21, 20, 59)`, `(55, 59, 886)`, and then all Shortcut for the three larger represented populations. The first three are empirical results from full-population arrays. The last two are explicitly scaled integer summaries of the shared 10,000-learner proxy, never described as full-population simulation.

### Baselines

- Asynchronous strict best response selects one labeled agent at a time, evaluates exact unilateral costs, and accepts only strict improvements. The 100-agent comparison uses 16 seeded orders per scenario. The exact open-game paths contain 65, 665, 6,665, 66,665, and 666,665 count states across the five populations; paths longer than 144 points retain 144 ordered display checkpoints while every omitted one-agent move is validated by the closed-form construction.
- Hedge gives every agent the full counterfactual route-cost vector and uses stable log weights with `eta = 0.18`. The canonical comparison uses 64 seeds per scenario.

Information assumptions differ. Q-learning sees only selected-route reward. Best response has exact model access. Hedge has full counterfactual feedback. Low external regret is not presented as last-iterate pure Nash convergence.

### Seed isolation and representatives

Base seed `20260804` is separated by NumPy `SeedSequence` namespaces. Each run spawns PCG64 streams for action exploration, tie-breaking, scenario initialization, aggregate selection, representative playback, and greedy evaluation. Adding draws to one role cannot shift the others.

The representative run minimizes total pairwise L1 distance between final route-count vectors. Lower exploitability and then smaller seed break ties. It is rerun independently before export, and its summary must agree.

## Snapshot and export protocol

Snapshots begin at measured episode 1 and always include the final training episode. Deterministic adaptive thinning keeps 243 snapshots at 100 commuters, 136 at 1,000, and 102 at 10,000 and both sampled-study presets for the committed open trajectories. Each snapshot contains:

- route counts and derived edge loads;
- physical edge latencies;
- physical and perceived route costs;
- physical social cost and average latency;
- toll payment, both potentials, and exploitability;
- regret summary and policy entropy.

Population-sized assignments and Q arrays are intentionally absent from public JSON. The Q shape, simultaneous-choice contract, selected-action-only update contract, and epsilon-zero evaluation remain explicit metadata.

Schema `3.0.0` uses one manifest plus five population-specific bundles. Python validation independently re-derives all public numerical fields from aggregate counts and rejects dishonest learner-count or represented-population metadata. TypeScript uses Zod plus a second numerical re-derivation before presentation. Stable key ordering, finite-number serialization, fixed seeds, and omitted wall-clock fields make regeneration byte-identical.

## Potential surface protocol

The 100-agent landscape enumerates all 5,151 count states and 10,000 triangles. Larger landscapes use a fixed resolution of 64, producing 2,145 vertices and 4,096 triangles. Each sample maps by deterministic largest remainder to a unique exact population count state, then evaluates the exact formula there.

Exact equilibrium and optimum markers are generated independently of the sample mesh. Q-learning trajectories use exported snapshots. The directional arrowheads belong only to the strict-best-response trajectory and point from earlier to later, lower-potential states. Q-learning is explicitly not described as monotone.

## Continuous-flow rendering

Every edge is a continuous translucent tube with a soft outer glow. Radius is `0.007 + 0.021 sqrt(s) + 0.011 s^2` for edge traffic share `s`, giving the audited range `0.007` through `0.039`. Radius, hue, and opacity all increase monotonically with traffic share, from thin green to thick red, regardless of edge role. A broad layered light field moves from source to target at a constant visual speed, giving the network a fluid appearance without inventing a latency encoding. Reduced motion fixes phase at `1.75` and performs no idle animation. Endpoint node cores use radius `0.148`, junction cores use `0.130`, every core is white, and the white halo scale is `1.65`. The SVG fallback applies the same data mappings.

## Validation boundary

The project distinguishes:

- exact equilibrium, optimum, potential, toll, and welfare statements;
- empirical learner summaries under declared settings;
- affine geometry interpolation for display;
- continuous aggregate flow as a traffic-share and direction encoding.

It does not claim a general independent-Q convergence theorem, a continuous traffic forecast, a physical queueing model, or a universal optimal-toll result beyond the authored game family.
