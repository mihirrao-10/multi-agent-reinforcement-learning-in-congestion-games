# Interview Guide

## Thirty-second explanation

The project studies a finite Braess congestion game with independent tabular learners. Every agent can learn the privately attractive Shortcut correctly, yet the resulting exact equilibrium makes average latency 80 instead of the optimum 64.688. Removing the Shortcut lowers equilibrium latency to 65, while a discrete marginal-cost toll aligns private incentives with physical social cost. The public experience supports 100, 1,000, and 10,000 agents using exact population-specific analysis and separately computed trajectories.

The main lesson is that better learning does not repair a badly designed objective.

## What is technically distinctive?

Four boundaries are explicit:

1. Exact game-theoretic claims use rational arithmetic and remove-then-add deviations.
2. Learner outcomes remain empirical and include their seed and information assumptions.
3. Large-population analysis exploits discrete convexity instead of enumerating 50 million states.
4. The browser presents validated Python outputs and never trains agents or manufactures population results.

## Explain the model

There are `N` labeled atomic agents. Each chooses Upper, Lower, or Shortcut as one complete action. The variable edges use `40x/N`; the outer constant edges cost 45; the central edge costs zero. For counts `(x_U, x_L, x_Z)`:

```text
J_U = 40(x_U + x_Z)/N + 45
J_L = 45 + 40(x_L + x_Z)/N
J_Z = 40(x_U + x_Z)/N + 40(x_L + x_Z)/N.
```

The normalization preserves the same intended Braess structure at every supported population.

## Why does every agent use the Shortcut at equilibrium?

At `(0, 0, N)`, every agent pays 80. If one agent moves to Upper, remove that agent from Shortcut first. The candidate then pays

```text
40(N - 1)/N + 45,
```

which is greater than 80 for the supported populations. Lower is symmetric. No unilateral switch helps, so all Shortcut is a pure Nash equilibrium.

At `N = 100`, total physical cost is 8,000. The exact physical optimum `(44, 44, 12)` costs 6,468.8. Price of Anarchy is `5000/4043`.

## Why remove before adding?

The moving agent changes the loads on every edge it leaves and joins. Pricing a candidate against the original count state can count that agent twice or leave it on an abandoned edge. The code forms

```text
x' = x - one_hot(origin) + one_hot(candidate)
```

before evaluating candidate cost. This same accounting is used for equilibrium, exploitability, best response, and regret counterfactuals.

## How can 10,000-agent analysis remain exact?

The open social objective and Rosenthal potential each separate as `f(x_U) + f(x_L)` for an exact discrete-convex component. Scanning one component over `0..N` finds every component minimum. Feasible pairs give every optimum, and potential minima give every equilibrium. The closed game needs only one scan.

This exact `O(N)` routine is exhaustively compared with complete enumeration at multiple small populations. The analyzer can report that the 10,000-agent game has 50,015,001 open count states without constructing them.

The browser surface is deliberately different: it uses a fixed 2,145-vertex sample of the exact potential formula. Exact equilibrium, optimum, active-profile, and path markers are not snapped to that sample.

## What does Q-learning do?

Each agent owns a separate Q row and receives only experienced selected-route reward. All agents choose before rewards are evaluated, then update only the selected entry:

```text
Q_i(a_i) <- Q_i(a_i) + 0.15 [r_i - Q_i(a_i)].
```

The other learners make each agent's environment nonstationary. The project therefore does not transfer the standard single-agent Q-learning convergence theorem. It reports observed training paths and a separate epsilon-zero final evaluation.

The canonical 100-agent study uses 64 Q seeds per scenario and 5,000 episodes. The 1,000- and 10,000-agent presets use one declared audited vectorized run per scenario, with 3,200 and 2,400 episodes. Their uncertainty is not compared with the replicated study.

## Why include best response and Hedge?

They expose the role of information.

- Strict best response has exact model access. Each accepted move strictly lowers private cost and Rosenthal potential.
- Hedge receives the full counterfactual cost vector for every action. Its external-regret interpretation concerns time-average play, not last-iterate pure Nash convergence.
- Independent Q-learning sees only its selected-route reward.

The comparison is not a leaderboard because the feedback assumptions differ.

## How do the tolls work?

For `c_N(x) = 40x/N`, the variable edges receive

```text
tau_N(x) = (x - 1)[c_N(x) - c_N(x - 1)] = 40(x - 1)/N.
```

Then perceived edge cost telescopes:

```text
sum(k=1..x) [c_N(k) + tau_N(k)] = x c_N(x).
```

Summing across edges makes tolled perceived potential equal physical social cost. Toll payments remain transfers, so the physical objective itself does not include them.

## How is determinism protected?

NumPy `SeedSequence` derives run seeds from base seed `20260804`. Every run then spawns separate PCG64 streams for exploration, tie-breaking, scenario initialization, aggregation, representative playback, and greedy evaluation. Stable JSON ordering and finite-number serialization exclude wall-clock data. A second full export produces identical bytes.

## How is the public data honest at scale?

The page initially loads a manifest and the 100-agent bundle. The larger bundles are fetched only when selected. They contain actual selected-population Q-learning snapshots and exact selected-population profiles. They do not contain copied route-share curves, population-sized assignment arrays, or millions of landscape vertices.

The renderer uses one bead per agent at 100. Larger presets cap visible beads at 180 and assign exact integer weights by deterministic largest remainder. The legend states the approximate bead weight, while all metrics retain exact route counts.

## Why the guided Start and Proceed flow?

The initial waiting state prevents an unexplained episode counter and arbitrary profile from appearing as fact. Start opens only the question. Proceed introduces a route as an action, then congestion and reward, then the independent Q update. Learning requires a separate `Run learning with N agents` action. Metrics appear only after they have meaning, and exploitability waits until the equilibrium chapter.

Locked chapters are truly hidden and absent from accessibility navigation. Population changes reset only playback, retain already unlocked explanations, and never mix metrics across bundles. Full replay returns to the title, 100 agents, waiting state, first chapter, and authored camera.

## How was the interface verified?

- Python formatting, lint, strict typing, coverage, exact-model, learner, determinism, export, and performance checks.
- TypeScript strict compilation, ESLint, Zod validation, numerical re-derivation, and Vitest state and geometry tests.
- Chromium Playwright journeys at 1440, 1280, tablet, and mobile widths.
- Keyboard, reduced motion, trackpad-equivalent wheel, pointer orbit, lazy population loading, SVG fallback, and replay checks.
- Screenshot inspection of every major narrative state and both scale cohorts.
- Production base-path and deployed-asset verification on GitHub Pages.

## Limitations to state plainly

- This is one symmetric atomic routing family, not a general transportation model.
- Agents choose complete routes from a fixed small action set.
- No queueing, capacity, spillback, continuous time, or microscopic vehicle dynamics are modeled.
- Independent-Q outcomes can depend on hyperparameters and seeds.
- The larger studies have one run per scenario and do not estimate uncertainty.
- Hedge and best response receive stronger feedback than Q-learning.
- Toll conclusions belong to this authored objective and are not policy advice.
- Particle motion is an encoding of assignment and relative latency, not a traffic forecast.

## Useful closing line

The agents did not fail to learn. They learned the incentives they were given.
