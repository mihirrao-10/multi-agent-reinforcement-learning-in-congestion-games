# Congestion Games: Study Guide

The [README](../README.md) owns the model, exact results, commands, and data
layout. [Experiment methodology](experiment-methodology.md) owns the study
protocol and diagnostics. This guide keeps explanation prompts and the theory
boundary in one place.

## Explaining the project

Independent commuters can learn the privately attractive Shortcut correctly,
yet its worst equilibrium costs 120 minutes per trip instead of the optimum 90.
Removing the Shortcut restores the efficient split. A discrete marginal-cost
toll aligns private incentives with physical travel cost. Better learning does
not repair inefficient incentives.

When explaining the implementation, distinguish four kinds of evidence:

- Exact finite-game claims use rational arithmetic and remove-then-add deviations.
- Learning outcomes are measured runs with declared seeds and feedback assumptions.
- Large-population equilibria and optima use an exact discrete-convex candidate
  reduction; the plotted potential surface is only a fixed-resolution sample.
- The browser validates and presents Python exports; it does not train learners.

### Derivations to reproduce

1. At all Shortcut, move one commuter to Upper, removing it from its old route
   before adding it to the new one. Show that its new cost is still 120, proving
   a weak equilibrium. Explain why this does not establish uniqueness.
2. Derive the open welfare and Rosenthal potential as sums of two discrete-convex
   count functions. Locate their integer minimizers and ties, then explain why
   a constant-size candidate set gives exact full-population results.
3. Verify the unilateral potential difference equals the mover's cost difference.
   Strict best response therefore decreases potential and terminates.
4. For variable-edge cost `c_N(x) = 60x/N`, derive the toll `60(x-1)/N` and the
   identity `sum(k=1..x) [c_N(k)+tau_N(k)] = x c_N(x)`. Toll payments remain
   transfers outside physical social cost.
5. Explain the independent-Q selected-action update and why adapting opponents
   invalidate a direct appeal to the single-agent convergence theorem.
6. Explain why Hedge's external regret concerns time-average play, not a final
   pure equilibrium. Compare its full feedback with Q-learning's selected reward.

### Explaining the scale studies

The 1,000- and 10,000-commuter views use declared full-population Q runs. The
100,000 view scales one 10,000-learner sampled study using deterministic
largest-remainder counts, then recomputes costs at the represented population.
The hidden 100-commuter comparison has 64 Q seeds and 64 Hedge seeds per scenario.
A single-run large study cannot supply the replicated study's uncertainty.

Training endpoints and epsilon-zero greedy evaluations answer different
questions and stay separate. SeedSequence and separate PCG64 streams isolate
exploration, tie-breaking, initialization, aggregation, playback, and evaluation.
Stable ordering and finite-number serialization permit byte-identical exports.
See the methodology for the actual schedules, diagnostics, and limitations.

### Explaining the presentation

Start and Proceed introduce actions, congestion, and rewards before measured
metrics appear. A separate action starts learning playback. Population changes
reset playback without mixing bundles. Lazy loading fetches only needed bundles.
Aggregate directional flow encodes traffic share, not individual vehicles or a
forecast; interpolation never creates a numerical observation.

## Theory and code map

### Core sources

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

### Theory boundary

Rosenthal supplies the potential identity, Braess supplies the routing incentive
question, Q-learning supplies the update, and Hedge supplies the full-information
baseline. The authored finite model, population normalization, exact candidate
reduction, hyperparameters, sampled scaling, and interface are project choices.
The values and count profiles in the README are outputs of this model, not
universal literature constants.

Follow the README's code map from the exact game and analyzer through learners,
study/export code, and browser validators. For theory, read Rosenthal and Braess
first, then welfare and congestion-game chapters of Algorithmic Game Theory.
For learning, contrast Watkins and Dayan with the assumptions that fail here;
then connect external regret to empirical play using Roughgarden's notes.

State the limitations plainly: a small fixed route set, no queues or continuous
traffic dynamics, seed-dependent independent-Q outcomes, stronger feedback for
Hedge and best response, and one run per scenario in the large presets. The toll
result belongs to the model's objective and is not transportation policy advice.
