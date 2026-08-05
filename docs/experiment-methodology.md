# Experiment Methodology

## Scope and preregistered questions

This repository is a deterministic computational study of one finite atomic congestion game. It asks three bounded questions:

1. What are the exact pure equilibria and physical social optima when the shortcut is open, removed, or tolled?
2. What final profiles do independent tabular Q-learning, asynchronous strict best response, and full-information Hedge produce under a fixed multi-seed experiment matrix?
3. Can the numerical boundary between exact analysis and empirical learning remain auditable through a static interactive presentation?

Exact equilibrium and welfare results come from exhaustive rational enumeration. Learning results come from the fixed experiments below. No empirical outcome is promoted to a general convergence theorem.

## Game definition

### Population and actions

The game has `N = 80` labeled atomic agents. Every agent has the same source `S`, destination `T`, and feasible route set. Atomic means each agent has non-negligible unit weight. Unsplittable means each agent chooses exactly one complete route per episode.

In the open and tolled scenarios the actions are:

| Index | Code | Name | Directed edges |
| ---: | --- | --- | --- |
| 0 | `U` | Upper | `S -> U`, `U -> T` |
| 1 | `L` | Lower | `S -> V`, `V -> T` |
| 2 | `Z` | Shortcut | `S -> U`, `U -> V`, `V -> T` |

The closed scenario removes `U -> V` and therefore removes action `Z`. Route indices remain deterministic within each scenario.

### Physical edge latencies

For nonnegative integer load `x`, physical latency is

| Edge | Function |
| --- | ---: |
| `S -> U` | `c_SU(x) = x / 2` |
| `U -> T` | `c_UT(x) = 45` |
| `S -> V` | `c_SV(x) = 45` |
| `V -> T` | `c_VT(x) = x / 2` |
| `U -> V` | `c_UV(x) = 0` |

Constant-edge functions evaluate to their stated cost when used. There is no physical capacity, queue, spillback, travel-time state, or continuous clock.

For open route counts `(x_U, x_L, x_Z)` summing to 80, the variable edge loads are

```text
x_SU = x_U + x_Z
x_VT = x_L + x_Z.
```

The physical route costs are

```text
J_U = (x_U + x_Z) / 2 + 45
J_L = 45 + (x_L + x_Z) / 2
J_Z = (x_U + x_Z) / 2 + (x_L + x_Z) / 2.
```

The physical social cost of a count state is both

```text
C(x) = sum_i J_i(x) = sum_e x_e c_e(x_e).
```

All reported average physical latencies divide this total by 80.

## Scenarios and perceived costs

### `braess-open`

All three routes are available. Perceived cost equals physical route latency. Reward for learning is its negative.

### `braess-closed`

The shortcut and route `Z` are removed. Perceived cost again equals physical route latency. Agents choose only Upper or Lower.

### `braess-tolled`

All three routes are available. The two load-sensitive edges have discrete marginal-cost toll

```text
tau_SU(x) = tau_VT(x)
          = (x - 1) [c(x) - c(x - 1)]
          = (x - 1) / 2.
```

All other tolls are zero. A player's perceived route cost is physical route latency plus tolls on that route at the resulting loads. Reward is negative perceived cost.

Toll payments are transfers. They influence decisions and perceived potential but are excluded from physical social cost. The export records physical route cost, perceived route cost, and total toll payment separately.

For either variable edge,

```text
sum(k=1..x) [c(k) + tau(k)] = x c(x).
```

Therefore the complete tolled perceived potential equals physical social cost at all 3,321 count states. This identity is checked exactly.

## Exact enumeration

### Symmetry reduction

Agents are labeled during learning, but costs depend only on route counts. The exact analyzer enumerates weak compositions in deterministic order.

- Open or tolled: `C(80 + 3 - 1, 3 - 1) = C(82, 2) = 3,321` states.
- Closed: `C(80 + 2 - 1, 2 - 1) = 81` states.

Python `Fraction` arithmetic is used for canonical costs, potentials, deviations, and efficiency ratios. No floating tolerance determines an equilibrium or optimum.

### Unilateral deviations

Every counterfactual uses remove-then-add accounting. For an occupied origin route `r` and candidate route `s`, the analyzer forms

```text
x' = x - one_hot(r) + one_hot(s)
```

and compares the current perceived cost of `r` at `x` with the perceived cost of `s` at `x'`. This is essential because the moving player changes every shared edge load it leaves or joins.

The exact-potential identity is checked for every feasible directed deviation:

- 19,440 checks in `braess-open`;
- 160 checks in `braess-closed`;
- 19,440 checks in `braess-tolled`.

Tolled potential equality to physical social cost is additionally checked at all 3,321 tolled states.

### Exact outputs

| Scenario | Unique pure Nash equilibrium | Unique physical optimum | Equilibrium physical cost | Optimum physical cost | Equilibrium average |
| --- | --- | --- | ---: | ---: | ---: |
| Open | `(0, 0, 80)` | `(35, 35, 10)` | 6,400 | 5,175 | 80 |
| Closed | `(40, 40)` | `(40, 40)` | 5,200 | 5,200 | 65 |
| Tolled | `(35, 35, 10)` | `(35, 35, 10)` | 5,175 | 5,175 | 64.6875 |

For the open game,

```text
Price of Anarchy = Price of Stability
                 = 6400 / 5175
                 = 256 / 207
                 = 1.2367149758454106...
```

Closed and tolled Price of Anarchy and Price of Stability are one. These exact claims do not depend on learning seeds or hyperparameters.

## Diagnostics

### Exploitability

For a count state `x`, exploitability is the maximum exact improvement available to one current player:

```text
max over occupied r and candidate s
  max(0, perceived_cost_r(x) - perceived_cost_s(x - e_r + e_s)).
```

It is zero exactly when the count state is a pure Nash equilibrium. Reported final exploitability is evaluated on the separate final profile, not inferred from a training loss.

### Distance to benchmarks

Route-count distance is normalized L1 distance:

```text
d(x, y) = sum_r |x_r - y_r| / (2N).
```

Moving one agent between routes changes two coordinates by one, so one reassignment has distance `1 / 80 = 0.0125`.

### External regret

At every learning episode, the engine stores each player's realized perceived cost and the perceived cost of each fixed counterfactual route under remove-then-add accounting. For player `i` after `T` episodes,

```text
R_i(T) = sum_t cost_i,t(actual)
       - min_a sum_t cost_i,t(counterfactual fixed action a).
```

The engine computes cumulative regret by agent. The public export reports mean and maximum per-episode external regret in snapshots and final summaries. Regret uses perceived cost, including tolls in the tolled scenario. It is a learning diagnostic, not part of physical social cost.

The standard no-external-regret result concerns empirical joint-play distributions and approximate coarse correlated equilibrium. This project does not claim that low regret makes the last profile a pure Nash equilibrium.

## Learners

### Independent tabular Q-learning

Each of the 80 agents owns a separate row with one Q value per available route. There is no parameter sharing, centralized policy, centralized critic, state input, replay buffer, or neural network.

At episode `t`:

1. Every agent selects an epsilon-greedy action from unchanged pre-reward Q values.
2. All 80 actions jointly determine route counts and edge loads.
3. Each agent observes only the perceived cost of its selected route.
4. Every selected value is updated simultaneously using

```text
Q_i(a_i) <- Q_i(a_i) + alpha [-cost_i(a_i) - Q_i(a_i)].
```

This is a one-stage repeated game, so `gamma = 0` and there is no bootstrap target. The canonical configuration is:

| Control | Value |
| --- | ---: |
| Agents | 80 |
| Episodes | 5,000 |
| `alpha` | 0.15 |
| Initial Q value | 0 |
| Initial epsilon | 0.80 |
| Epsilon decay | 0.999 per episode |
| Epsilon floor | 0.01 |
| Final evaluation epsilon | 0 |

The epsilon used at one-indexed episode `t` is `max(0.01, 0.80 * 0.999^(t-1))`.

Training's last route counts and the reported final route counts are separate fields. After episode 5,000, a dedicated evaluation stream samples the epsilon-zero policy, including deterministic uniform tie-breaking among exact Q-value ties. This prevents a final exploratory training action from being reported as the learned greedy policy.

Independent agents make each other's reward environments nonstationary. The experiment does not claim the convergence theorem for classic single-agent Q-learning applies here.

### Asynchronous strict best response

Best response begins from a seeded random labeled assignment. Each sweep uses a seeded permutation of all agents. One player at a time evaluates every exact perceived counterfactual and moves only if the lowest-cost candidate strictly improves on the current route. Route order breaks exact candidate ties deterministically.

After every accepted move, the implementation asserts both strict potential descent and equality between potential change and private-cost change. It also records the complete accepted-assignment path and rejects repeated states. Termination occurs after a full sweep with no strict improvement, subject to a defensive 10,000-sweep ceiling that is never reached in the canonical runs.

This baseline has exact model access and is not information-equivalent to Q-learning.

### Full-information Hedge

Each agent starts with zero log weights. At each episode:

1. stable softmax converts log weights to action probabilities;
2. each agent samples one action;
3. exact remove-then-add perceived costs are computed for every candidate action;
4. log weights update as `log_w -= eta * counterfactual_cost / cost_bound`;
5. the row maximum is subtracted to maintain numerical stability.

The canonical controls are 5,000 episodes, 80 agents, and `eta = 0.18`. The cost bound is a deterministic valid maximum over authored single-route extreme count states. The export includes final log weights, action probabilities, expected mixed route counts, and empirical route frequencies.

The final Hedge profile is a deterministic seeded sample from the final probability rows, not a claim that those probabilities have collapsed to a pure strategy. Hedge receives full counterfactual feedback, unlike experienced-feedback Q-learning.

## Seeds and random-stream isolation

The base seed is `20260804`. For scenario index `j`, the experiment namespaces are:

```text
Q-learning:    3j
Hedge:         3j + 1
best response: 3j + 2.
```

NumPy `SeedSequence([base_seed, namespace])` spawns deterministic unsigned 32-bit run seeds. The public matrix uses:

- 64 Q-learning seeds per scenario;
- 64 Hedge seeds per scenario;
- 16 best-response seeds per scenario.

Every run seed spawns six PCG64 generators with fixed names:

1. `action-exploration`;
2. `tie-breaking`;
3. `scenario-initialization`;
4. `aggregate-selection`;
5. `representative-playback`;
6. `greedy-evaluation`.

Isolation prevents an added visualization draw or tie-break draw from shifting exploration, initialization, or final evaluation. The complete derived seed lists are committed in `web/public/data/story-v1.json`.

## Multi-seed aggregation and uncertainty

For each learner and scenario, all predeclared runs are retained as per-seed final summaries. For each numerical metric, the export records:

- arithmetic mean;
- population standard deviation with `ddof = 0`;
- standard error `population_standard_deviation / sqrt(number_of_runs)`;
- minimum;
- maximum;
- number of runs.

Metrics include physical social cost, average physical latency, exploitability, normalized distances to equilibrium and optimum, mean average external regret, and maximum average external regret.

These descriptive summaries quantify variation across the fixed deterministic matrix. Standard error is reported transparently but is not presented as a universal confidence interval. There is no post hoc seed deletion.

### Representative-run policy

For each learner and scenario, let each run be represented by its final route-count vector. The selected run minimizes the sum of pairwise L1 distances from its vector to all other runs. This is a medoid, so it is always one real run. Ties are broken by lower final exploitability and then smaller seed.

The selected seed is rerun with snapshot capture, and its final counts must exactly match the original no-snapshot run. Selection never considers animation smoothness, chart appearance, dramatic trajectory, or visual attractiveness.

## Snapshot sampling

Only representative Q-learning and Hedge runs need full playback. For each 5,000-episode run, the deterministic schedule is the sorted union of:

- every episode from 0 through 40;
- 52 integer-converted geometric samples from 41 through 1,000;
- 160 integer-converted regular samples from 1,001 through 5,000;
- explicit endpoints 0 and 5,000.

Duplicate indices caused by integer conversion are removed. The resulting canonical schedule has 253 exact episodes for each representative run.

Each snapshot includes all 80 labeled assignments, route counts, edge loads and physical latencies, physical and perceived route costs, physical social cost, average physical latency, toll payment, original and perceived potentials, exploitability, mean and maximum average regret, policy entropy, epsilon, and episode index.

The browser can interpolate particle position, camera, material, or surface geometry between snapshots. It does not interpolate numerical text; metrics are keyed to the current exact snapshot.

## Canonical empirical results

The representative independent-Q outputs are:

| Scenario | Seed | Final epsilon-zero counts | Physical cost | Average latency | Exploitability |
| --- | ---: | --- | ---: | ---: | ---: |
| Open | 1,934,370 | `(0, 0, 80)` | 6,400 | 80 | 0 |
| Closed | 1,248,724 | `(40, 40)` | 5,200 | 65 | 0 |
| Tolled | 82,370,885 | `(35, 35, 10)` | 5,175 | 64.6875 | 0 |

All 64 open Q-learning runs reached the exact equilibrium. In the closed scenario, 63 reached `(40, 40)` and one was one reassignment away, producing a maximum physical cost of 5,201. For tolled Q-learning, final physical social cost over 64 seeds had mean 5,178.5625, population standard deviation 8.7180219230, standard error 1.0897527404, minimum 5,175, and maximum 5,217.5.

All 16 strict best-response runs in each scenario reached that scenario's unique exact equilibrium. Hedge is retained as a distinct full-information baseline; its small external regret is not used as a substitute for final-profile exploitability.

These are empirical outcomes of the declared algorithms, seeds, and hyperparameters. They are not exact statements about all seeds or all learning settings.

## Deterministic public output

`web/public/data/story-v1.json` is schema version `1.0.0`. Python is the sole numerical authority. The payload contains:

- the complete network and scenario model;
- exact rational analyses and decimal projections;
- full per-seed summaries and aggregate statistics;
- representative snapshots and final learner state;
- the entire potential landscape and deterministic triangle indices;
- fixed visual scale metadata;
- benchmark metadata and provenance.

Serialization uses UTF-8, sorted keys, compact separators, finite numbers only, canonical rounding to 12 decimal places, and one final newline. The rounding removes last-bit `exp` differences between supported processor architectures while retaining substantially more precision than the published summaries. Wall-clock experiment runtimes, generation timestamp, and git commit are excluded from the canonical story bundle because they would make it vary. The configuration hash, package version, Python version, NumPy version, generator, and generation command are recorded. CI pins Python 3.12.13 and the package pins NumPy 2.5.1 so those provenance fields remain reproducible instead of drifting with a floating toolchain.

The deterministic contract is checked by generating independent temporary files, comparing them byte for byte to each other, and comparing them to the committed bundle. Python validates the payload after construction. TypeScript then validates the fetched schema and re-derives route counts, loads, costs, welfare, potential geometry, and index bounds before rendering.

## Performance benchmark methodology

`congestion-marl benchmark` is implementation profiling, not a real-time scientific claim. Each operation receives one warmup. Most operations then receive three measured repetitions using `time.perf_counter`; the quick export assembly receives two. Minimum and arithmetic-mean seconds are recorded along with Python, NumPy, platform, architecture, and a UTC generation timestamp in `benchmarks/measurements.json`.

The measured operations are:

- complete open count-state enumeration and exact analysis;
- one 500-episode open Q-learning run;
- one 500-episode open Hedge run;
- a reduced story assembly with two seeds and 200 episodes;
- validation of that reduced story.

The committed measurement environment is Apple arm64, macOS 26.5, Python 3.14.4, and NumPy 2.5.1. Measurements characterize that recorded machine only. They are deliberately stored outside the canonical deterministic story-generation process; the story includes them as fixed committed metadata rather than rerunning a timer during export.

## Exact versus empirical output boundary

| Output | Status |
| --- | --- |
| Count-state set and cardinality | Exact |
| Edge and route cost at a count state | Exact rational |
| Pure Nash equilibria | Exact |
| Physical social optima | Exact |
| Rosenthal and tolled potential identities | Exact |
| Price of Anarchy and Price of Stability | Exact rational |
| Exploitability of a specified final profile | Exact rational calculation, serialized as a number |
| One seeded learner trajectory | Deterministic empirical output |
| Multi-seed means and dispersion | Deterministic summaries of empirical runs |
| Representative seed | Deterministic empirical medoid |
| Browser geometry between snapshots | Visual interpolation only |
| Benchmark timing | Machine-specific empirical measurement |

## Reproduction commands

```bash
make setup
make lint
make typecheck
make test

congestion-marl enumerate --scenario braess-open --json
congestion-marl enumerate --scenario braess-closed --json
congestion-marl enumerate --scenario braess-tolled --json

congestion-marl export --output /tmp/story-a.json
congestion-marl export --output /tmp/story-b.json
congestion-marl validate /tmp/story-a.json
cmp /tmp/story-a.json /tmp/story-b.json
cmp /tmp/story-a.json web/public/data/story-v1.json

cd web
npm ci
npm run check
npm run test:e2e
```

## Limitations

- This is one authored symmetric atomic routing game with exactly 80 agents.
- All agents share one origin and destination and choose one complete route per episode.
- There are only two or three available routes, depending on scenario.
- There is no continuous-time traffic, queueing model, spillback, or physical road capacity beyond the stated latency functions.
- Moving particles encode assignments and relative route cost. They are not simulated vehicles.
- Independent Q-learning is tabular, state-free, and subject to multi-agent nonstationarity.
- Learning behavior can change with hyperparameters, initialization, exploration, feedback, or seeds.
- No general convergence theorem for independent Q-learning is claimed.
- Hedge receives full counterfactual feedback, best response receives exact model information, and Q-learning receives selected-route experience. Their information assumptions differ.
- Low external regret does not guarantee last-iterate pure Nash convergence.
- The marginal-cost toll outcome and its uniqueness belong to this finite instance.
- Toll payments are modeled as transfers and excluded from physical social cost.
- The study is educational, not transportation-policy advice and not a real traffic forecast.
- Every numerical claim is conditional on the model and experiment configuration documented above.
