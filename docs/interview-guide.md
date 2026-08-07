# Interview Guide

## Thirty-second explanation

The project studies a finite Braess congestion game as a repeated daily commute with independent tabular learners. Every commuter can learn the privately attractive Shortcut correctly, yet the resulting all-Shortcut equilibrium has average latency 120 minutes instead of the optimum 90. Removing the Shortcut restores the 90-minute outcome, while a discrete marginal-cost toll aligns private incentives with physical social cost. The public experience supports 100, 1,000, 10,000, 100,000, and 1,000,000 commuters with exact full-population analysis and honestly labeled full or sampled learning studies.

The main lesson is that better learning does not repair a badly designed objective.

## What is technically distinctive?

Four boundaries are explicit:

1. Exact game-theoretic claims use rational arithmetic and remove-then-add deviations.
2. Learner outcomes remain empirical and include their seed and information assumptions.
3. Large-population analysis uses constant-size exact convex candidate sets instead of enumerating as many as 500,001,500,001 states.
4. The browser presents validated Python outputs and never trains agents or manufactures population results.

## Explain the model

There are `N` labeled atomic agents. Each chooses Upper, Lower, or Shortcut as one complete action. The variable edges use `60x/N` minutes; the outer constant edges cost 60 minutes; the central edge costs zero. For counts `(x_U, x_L, x_Z)`:

```text
J_U = 60(x_U + x_Z)/N + 60
J_L = 60 + 60(x_L + x_Z)/N
J_Z = 60(x_U + x_Z)/N + 60(x_L + x_Z)/N.
```

The normalization preserves the same intended Braess structure at every supported population.

## Why is all Shortcut an equilibrium?

At `(0, 0, N)`, every agent pays 120 minutes. If one agent moves to Upper, remove that agent from Shortcut first. The commuter still uses `S -> U`, so that edge's load remains `N`. The candidate then pays

```text
60N/N + 60 = 120.
```

Lower is symmetric. No unilateral switch strictly helps, so all Shortcut is a weak pure Nash equilibrium.

At `N = 100`, total physical cost is 12,000 commuter-minutes. The exact physical optimum `(50, 50, 0)` costs 9,000 commuter-minutes. Price of Anarchy is `4/3`. The exact finite weak-equilibrium set is `(0, 0, 100)`, `(0, 1, 99)`, `(1, 0, 99)`, and `(1, 1, 98)`, so the project never claims uniqueness.

## Why remove before adding?

The moving agent changes the loads on every edge it leaves and joins. Pricing a candidate against the original count state can count that agent twice or leave it on an abandoned edge. The code forms

```text
x' = x - one_hot(origin) + one_hot(candidate)
```

before evaluating candidate cost. This same accounting is used for equilibrium, exploitability, best response, and regret counterfactuals.

## How can 10,000-agent analysis remain exact?

The open social objective and Rosenthal potential each separate as `f(x_U) + f(x_L)` for an exact discrete-convex component. The social component is centered at `N/2`; the untolled potential component has equal discrete minima at zero and one. The closed and tolled centers are `N/2`. Checking floor, ceiling, adjacent integers, and boundaries finds every discrete tie with constant work. Feasible pairs give every optimum, and potential minima give every equilibrium.

This constant-size routine is exhaustively compared with complete enumeration at multiple small populations and with a linear reference scan over a broad medium range. The analyzer can report that the 1,000,000-commuter game has 500,001,500,001 open count states without constructing them.

The browser surface is deliberately different: it uses a fixed 2,145-vertex sample of the exact potential formula. Exact equilibrium, optimum, active-profile, and path markers are not snapped to that sample.

## What does Q-learning do?

Each learner owns a separate Q row and receives only experienced selected-route reward. One episode is one new morning commute. All learners choose before rewards are evaluated, then update only the selected entry:

```text
Q_i(a_i) <- Q_i(a_i) + 0.15 [r_i - Q_i(a_i)].
```

The other learners make each learner's environment nonstationary. The project therefore does not transfer the standard single-agent Q-learning convergence theorem. It reports observed training paths and a separate epsilon-zero final evaluation. The learners do not meet, communicate, exchange Q-values, or see one another's private route estimates. They affect one another only because their independently chosen routes create shared congestion.

The canonical 100-commuter study uses 64 Q seeds per scenario and 5,000 episodes. The 1,000- and 10,000-commuter presets use one declared audited full-population vectorized run per scenario, with 3,200 and 2,400 episodes. The 100,000 and 1,000,000 presets use one shared, declared 10,000-learner sampled route-share study. Their uncertainty is not compared with the replicated study.

## Why include best response and Hedge?

They expose the role of information.

- Strict best response has exact model access. Each accepted move strictly lowers private cost and Rosenthal potential.
- Hedge receives the full counterfactual cost vector for every action. Its external-regret interpretation concerns time-average play, not last-iterate pure Nash convergence.
- Independent Q-learning sees only its selected-route reward.

The comparison is not a leaderboard because the feedback assumptions differ.

## How do the tolls work?

For `c_N(x) = 60x/N`, the variable edges receive

```text
tau_N(x) = (x - 1)[c_N(x) - c_N(x - 1)] = 60(x - 1)/N.
```

Then perceived edge cost telescopes:

```text
sum(k=1..x) [c_N(k) + tau_N(k)] = x c_N(x).
```

Summing across edges makes tolled perceived potential equal physical social cost. Toll payments remain transfers, so the physical objective itself does not include them.

## How is determinism protected?

NumPy `SeedSequence` derives run seeds from base seed `20260804`. Every run then spawns separate PCG64 streams for exploration, tie-breaking, scenario initialization, aggregation, representative playback, and greedy evaluation. Stable JSON ordering and finite-number serialization exclude wall-clock data. A second full export produces identical bytes.

## How is the public data honest at scale?

The page initially loads a manifest and the default 100,000-commuter bundle. Other population bundles are fetched only when selected and then cached; the replicated 100-commuter comparison loads only when its chapter is reached. The first three presets contain full-population Q-learning snapshots. The two largest contain sampled-study snapshots scaled by deterministic largest remainder to integer represented-population counts. Costs and loads are recomputed from those scaled counts. Every bundle still contains exact full-population equilibrium, optimum, potential, and welfare analysis.

The renderer draws continuous translucent directional flow. Nonlinear thickness, hue, and opacity all increase monotonically with traffic share from thin green to thick red. Broad moving light supplies a fluid-looking direction cue. Enlarged white-glowing nodes preserve the four junction identities. No individual commuter symbol is used, so rendering complexity does not imply a simulated population size.

## Why the guided Start and Proceed flow?

The initial waiting state prevents an unexplained episode counter and arbitrary profile from appearing as fact. Start opens only the question. Proceed introduces a route as an action, then congestion and reward, then the independent Q update. Learning requires a separate `Run learning with N commuters` action. The two sampled presets say `Run sampled learning path` and disclose 10,000 simulated learners beside the full represented population. Metrics appear only after they have meaning, and exploitability waits until the equilibrium chapter.

Locked chapters are truly hidden and absent from accessibility navigation. Population changes reset only playback, retain already unlocked explanations, and never mix metrics across bundles. Full replay returns to the title, the default 100,000 commuters, waiting state, first chapter, and authored camera.

## How was the interface verified?

- Python formatting, lint, strict typing, coverage, exact-model, learner, determinism, export, and performance checks.
- TypeScript strict compilation, ESLint, Zod validation, numerical re-derivation, and Vitest state and geometry tests.
- Chromium Playwright journeys at `1440x900`, `1280x800`, `1024x768`, `820x1180`, `430x932`, and `390x844`.
- Keyboard, reduced motion, trackpad-equivalent wheel, pointer orbit, lazy population loading, SVG fallback, and replay checks.
- Screenshot inspection of every major narrative state, varied traffic shares, and all audited population scales.
- Production base-path and deployed-asset verification on GitHub Pages.

## Limitations to state plainly

- This is one symmetric atomic routing family, not a general transportation model.
- Agents choose complete routes from a fixed small action set.
- No queueing, capacity, spillback, continuous time, or microscopic vehicle dynamics are modeled.
- Independent-Q outcomes can depend on hyperparameters and seeds.
- The larger studies have one run per scenario and do not estimate uncertainty.
- Hedge and best response receive stronger feedback than Q-learning.
- Toll conclusions belong to this authored objective and are not policy advice.
- Directional flow is an aggregate traffic-share encoding, not a traffic forecast.

## Useful closing line

The agents did not fail to learn. They learned the incentives they were given.
