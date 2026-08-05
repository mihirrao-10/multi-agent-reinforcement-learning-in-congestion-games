# Interview Guide

## The project in one sentence

Eighty independent learners discover the unique Nash equilibrium of an atomic Braess congestion game, and exact enumeration proves that this learned equilibrium is inefficient until the incentives are changed.

## A two-minute explanation

This project asks a simple multi-agent learning question: what happens when every agent learns competently inside a poorly designed game?

There are 80 labeled, unsplittable agents. Every episode, each agent chooses one complete route from a common source to a common destination. In the open Braess network, the routes are Upper, Lower, and Shortcut. Two edges have latency equal to half their load, two have constant latency 45, and the middle shortcut has zero physical latency.

Exact rational enumeration reduces the apparent `3^80` profile space to 3,321 route-count states. It proves that the only pure Nash equilibrium is `(0, 0, 80)`: everyone takes the shortcut, each experiences latency 80, and total physical cost is 6,400. The physical social optimum is `(35, 35, 10)`, with total cost 5,175 and average latency 64.6875. Therefore Price of Anarchy and Price of Stability are both `6400 / 5175 = 256 / 207`, about 1.236715.

Independent tabular Q-learning gives every agent its own three-value table. Agents act simultaneously, receive only their selected-route reward, and update independently. Across 64 fixed seeds, the open scenario's final epsilon-zero greedy policy reached the exact inefficient equilibrium every time. This is empirical evidence for this instance, not a general convergence theorem for independent Q-learning.

The intervention matters more than learner sophistication. Removing the shortcut produces equilibrium `(40, 40)` and average latency 65. Discrete marginal-cost tolls on the two load-sensitive edges produce equilibrium `(35, 35, 10)`, exactly the physical optimum. Python owns every numerical result and exports deterministic JSON. The browser validates that file and tells the story using one Three.js network, a complete potential landscape, native SVG charts, and an accessible SVG fallback.

## A ten-minute explanation

### 1. Model the game

An **atomic congestion game** has discrete players who choose resource sets. Here a resource is a directed edge and an action is one complete source-to-destination route. **Unsplittable** means a player chooses exactly one route in an episode rather than dividing one unit of flow among routes.

Let the route-count vector be `(x_U, x_L, x_Z)`, where `U`, `L`, and `Z` denote Upper, Lower, and Shortcut. The edge loads on `S -> U` and `V -> T` are `x_U + x_Z` and `x_L + x_Z`. The remaining used outer edges have constant cost 45, and the shortcut has cost zero. Thus

```text
J_U = (x_U + x_Z) / 2 + 45
J_L = 45 + (x_L + x_Z) / 2
J_Z = (x_U + x_Z) / 2 + (x_L + x_Z) / 2
```

A player's route cost is the sum of edge latencies on the route after that player is included. Physical social cost is the sum of every player's physical route latency, equivalently `sum_e x_e c_e(x_e)`.

### 2. Derive the canonical outcomes

At `(0, 0, 80)`, both variable edges have load 80. A Shortcut user pays `40 + 40 = 80`. If that player deviates to Upper, the post-deviation loads give `79 / 2 + 45 = 84.5`; Lower is symmetric. No unilateral deviation helps, so exploitability is zero.

The equilibrium physical social cost is

```text
80 agents * 80 latency = 6400.
```

At `(35, 35, 10)`, both variable edges have load 45. Upper and Lower users each pay `22.5 + 45 = 67.5`; Shortcut users pay `22.5 + 22.5 = 45`. Physical social cost is

```text
35(67.5) + 35(67.5) + 10(45) = 5175,
5175 / 80 = 64.6875.
```

Exact enumeration proves this is the unique physical optimum. Since the open equilibrium is also unique,

```text
PoA = PoS = 6400 / 5175 = 256 / 207 = 1.2367149758...
```

Closing the shortcut leaves `(x_U, x_L)` with `x_U + x_L = 80`. Exact enumeration gives the unique equilibrium and optimum `(40, 40)`. Each route costs `40 / 2 + 45 = 65`, so total cost is 5,200. Relative to the open equilibrium, average latency falls by `(80 - 65) / 80 = 18.75%`.

### 3. Connect incentives to the potential

Rosenthal's potential for the untolled game is

```text
Phi(x) = sum(k/2, k=1..x_U+x_Z)
       + 45(x_U + x_L)
       + sum(k/2, k=1..x_L+x_Z).
```

For a unilateral move, remove the moving player from the old route, add the player to the new route, and recompute the affected loads. The exact-potential identity is

```text
Phi(after) - Phi(before)
  = perceived_cost_of_new_route(after)
  - perceived_cost_of_old_route(before).
```

The implementation checks this identity with exact rational arithmetic for all 19,440 feasible directed deviations in each three-route scenario and all 160 in the two-route scenario. A strict best response has a negative private-cost change, so it strictly lowers a potential with finitely many states. That is why asynchronous strict best response terminates at a pure Nash equilibrium and cannot cycle.

### 4. Explain the learners and their information

**Independent Q-learning.** Agent `i` owns one row `Q_i`, with one value per available route. All agents choose from unchanged pre-reward tables, so the joint update is simultaneous. Each agent observes only the cost of the selected route and applies

```text
Q_i(a_i) <- Q_i(a_i) + alpha [-J_i(a_i) - Q_i(a_i)].
```

There is no next-state bootstrap term. Each episode is a one-stage repeated decision, so `gamma = 0`. The public run uses 5,000 episodes, `alpha = 0.15`, and epsilon `max(0.01, 0.80 * 0.999^(t-1))`. Initial values are zero. Training exploration is not reused for the reported final profile: a separate epsilon-zero greedy evaluation uses a separate random stream for deterministic tie-breaking.

There is no neural network because each agent has only two or three actions and no state variable. A table is sufficient, transparent, and directly inspectable.

**Asynchronous strict best response.** One labeled agent at a time gets exact model access, chooses a strictly cheaper route if one exists, and moves. Seeded permutations determine update order. This is a theory-aligned diagnostic, not a same-information competitor to Q-learning.

**Hedge.** Every agent maintains stable log weights and receives the full exact counterfactual route-cost vector. With learning rate `eta = 0.18`, it multiplicatively downweights costly actions. Hedge's information assumption is stronger than Q-learning's.

Adapting opponents make each independent Q-learner's reward distribution nonstationary. The classic single-agent Q-learning convergence result cannot simply be transferred to this setting. The project therefore compares empirical outcomes against exact benchmarks and makes no general independent-Q convergence claim.

### 5. Explain the diagnostics

A pure Nash profile has no profitable unilateral deviation. The implementation defines **exploitability** as the largest available one-player cost improvement under exact remove-then-add accounting. It is zero exactly when no player can strictly improve.

For a player over `T` training rounds, external regret is

```text
sum_t realized_cost_t - min_a sum_t counterfactual_cost_t(a).
```

The counterfactual cost treats the player's actual action as removed before adding the fixed alternative. The project reports cumulative and per-round regret by agent. Low external regret concerns time-averaged play; it does not prove that a last sampled or greedy profile is a pure Nash equilibrium. If every player has vanishing external regret, the empirical joint-play distribution has the standard coarse-correlated-equilibrium interpretation, but this project does not export a separate finite-sample CCE certificate.

### 6. Explain the toll intervention

The two variable edges use the discrete marginal-cost toll

```text
tau(x) = (x - 1) [c(x) - c(x - 1)] = (x - 1) / 2.
```

The two constant edges and zero-cost shortcut have zero toll. Players learn from physical latency plus toll, but reported physical social cost excludes toll payments because they are transfers, not travel time.

For a variable edge,

```text
sum(k=1..x) [c(k) + tau(k)]
= sum(k=1..x) [k/2 + (k-1)/2]
= x^2 / 2
= x c(x).
```

Summing over edges makes perceived Rosenthal potential equal physical social cost at every count state. Consequently, the unique potential minimum for this authored finite game is the unique physical optimum `(35, 35, 10)`, which is also the unique tolled equilibrium. This uniqueness is project-specific, not a universal statement about marginal-cost tolls in every atomic congestion game.

### 7. Explain the experiment and presentation boundary

The full experiment matrix has 64 deterministic seeds per scenario for Q-learning, 64 for Hedge, and 16 seeded update orders for best response. A representative run is selected as the medoid minimizing total pairwise L1 distance between final route-count vectors. Lower exploitability and then lower seed break ties. It is never selected for a pleasing animation.

Python exports the exact model, full exact analyses, seed summaries, aggregate statistics, representative learner state and snapshots, all 3,321 potential-surface vertices, and all 6,400 triangles. Stable ordering and isolated PCG64 random streams make the canonical bundle byte reproducible. The browser does not train agents. TypeScript validates the schema and re-derives important numerical identities before rendering.

## Definitions worth giving precisely

- **Edge load:** the number of agents whose selected routes contain that edge.
- **Route cost:** the sum of the costs of the route's edges at the joint profile's resulting loads.
- **Social cost:** the sum of all agents' physical route costs, not perceived toll-inclusive costs.
- **Pure Nash equilibrium:** a profile in which no one player can lower perceived cost by changing route alone.
- **Social optimum:** a feasible profile minimizing physical social cost.
- **Price of Anarchy:** worst equilibrium physical social cost divided by optimal physical social cost.
- **Price of Stability:** best equilibrium physical social cost divided by optimal physical social cost.
- **Braess's paradox:** adding an apparently helpful route or edge can worsen selfish-routing equilibrium performance.
- **Exact potential:** a scalar whose change under every unilateral move equals that mover's perceived-cost change.
- **External regret:** excess realized cumulative cost relative to the best fixed action in hindsight.

## How every visual encoding maps to mathematics

| Visual encoding | Mathematical quantity |
| --- | --- |
| Edge tube thickness | Exported edge load |
| Variable-edge hue from green to orange-red | Exported physical edge latency under a fixed global scale |
| Shortcut's neutral gold color | Its zero physical latency, never falsely colored as congested |
| 80 instanced particles | 80 labeled route assignments |
| Particle speed | Relative exported route cost for the selected route |
| Route-count chips and textual metrics | One exact exported snapshot |
| Potential surface height | Affine normalization of exact potential under shared fixed bounds |
| Surface color | Exact objective value under the same deterministic scale |
| Surface trajectory | Exported representative route-count snapshots |
| Nash and optimum markers | Exact enumerated count states |
| Toll morph | Interpolation from original potential to tolled perceived potential |

Geometric and camera transitions can interpolate smoothly. Numerical text is never interpolated: it always belongs to a specific exported snapshot. Particle motion is an assignment visualization, not a continuous-time traffic simulation.

## Performance and engineering choices

- One persistent Three.js renderer serves the network and potential chapters.
- `InstancedMesh` represents all 80 agents with one draw-efficient structure.
- The five directed edges use deterministic curves and stable geometry.
- The complete 3,321-vertex, 6,400-triangle lattice is generated once and updated in place during the toll morph.
- Pixel ratio is capped, resize work is scheduled, and hidden scenes stop unnecessary animation work.
- Native SVG handles charts because the plots are small, semantic, and easier to make accessible than another canvas.
- The deterministic JSON is fetched once, validated with Zod, and treated as immutable story state.
- Vite emits static assets under the repository subpath for GitHub Pages.

## Accessibility talking points

- The page uses semantic landmarks, headings, buttons, chapter labels, and status regions.
- Every control is keyboard reachable and has a visible focus treatment.
- Camera controls support keyboard input as well as mouse, trackpad, and touch.
- The active scene description and focus status update for assistive technology.
- `prefers-reduced-motion` is observed at load time and when the preference changes.
- With reduced motion, playback and scene transitions settle immediately instead of forcing animation.
- A deliberate WebGL failure path renders an accessible SVG network with the same route and load story.
- Charts have text descriptions, labeled axes, and non-color distinctions.
- Color is paired with thickness, text, shape, or position and is never the only carrier of meaning.

## Likely technical questions

### Why enumerate count states instead of labeled profiles?

The game is symmetric: cost and welfare depend on route counts, not player identities. Nonnegative triples summing to 80 number `C(82,2) = 3,321`, while labeled profiles number `3^80`. Count-state enumeration preserves every distinct cost outcome and makes exhaustive exact checks feasible.

### Why must deviations use remove-then-add accounting?

The moving player contributes to the old loads. Counterfactual cost on the new route must be evaluated after removing that contribution and adding the player to the new route. Evaluating the target against the unchanged aggregate can be off by one on shared edges and can invalidate equilibrium, regret, and potential checks.

### Is `(35, 35, 10)` a Nash equilibrium in the untolled game?

No. It is the physical optimum, but its incentives are unstable without tolls. For example, an Upper user at that profile pays 67.5 and can move to Shortcut, where the post-move variable loads are 45 and 46, for cost 45.5. It becomes the unique equilibrium only in the tolled scenario.

### Why is the open optimum allowed to send some agents through the shortcut?

The shortcut itself is free and can be socially useful in moderation. The harm comes from the load its users add to both variable edges. Exact enumeration balances that externality at ten Shortcut users, not zero.

### Why is gamma zero?

There is no state transition whose future return should be bootstrapped. Each episode is one simultaneous route choice followed by one cost. Using a positive discount factor would imply a continuing-state model that this experiment does not have.

### Is Q-learning really multi-agent here?

Yes. Eighty separate learners update from a shared joint outcome, and each learner changes the environment faced by the others. It is deliberately the simplest independent MARL setting: no central controller, critic, sharing, or communication.

### Does low Hedge regret imply convergence to Nash?

No. Vanishing external regret supports a statement about empirical joint-play distributions and coarse correlated equilibrium. It does not guarantee last-iterate pure-Nash convergence. The exported Hedge final profiles and exploitability make that distinction visible.

### Why use population standard deviation rather than sample standard deviation?

The public statistics describe the complete predeclared 64-run deterministic experiment matrix rather than estimating dispersion from an accidental subsample. The export records population standard deviation (`ddof = 0`) and standard error `sigma / sqrt(64)`. These are run-to-run summaries, not confidence intervals for a universal population.

### Why not train in JavaScript?

Keeping model, exact analysis, learning, and export in Python produces one auditable numerical authority. The browser only validates and presents immutable data, which prevents timing, frame rate, or device differences from changing the scientific claims.

### What would you change for a larger problem?

Count-state enumeration and per-agent tables would eventually become infeasible. Possible extensions include structured optimization, sampled equilibrium diagnostics, function approximation, richer state, or graph-based policies. Those would change the scientific question and introduce approximation error, so they are outside this project's intentionally exact scope.

## Established theory versus project-specific work

Established theory supplies atomic congestion games, Rosenthal potential, finite-improvement arguments, Nash equilibrium, Braess's paradox, Price of Anarchy, Q-learning, Hedge, and the no-regret connection to time-averaged equilibrium concepts.

Project-specific work includes the 80-agent integer scaling, the exact latency constants, the three authored scenarios, all hyperparameters and seed namespaces, the medoid representative rule, the snapshot schedule, the finite-instance toll result, the deterministic data contract, and every visual encoding. The project applies established ideas carefully; it does not claim a new theorem.

## Honest limitations

This is one symmetric atomic routing game. All 80 agents share one source and destination and choose one complete route from two or three options per episode. There is no continuous-time traffic, queueing model, or physical capacity model beyond the authored latency functions. Q-learning behavior can depend on hyperparameters and exploration, and adapting agents make the environment nonstationary. Hedge and best response receive stronger information than Q-learning. Toll payments are treated as transfers. Results are educational evidence for this finite model, not transportation-policy advice or a real traffic forecast.
