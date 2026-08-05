# Course Map and Verified References

This map separates the theory inherited from the literature from the modeling, experimental, and visual decisions made in this repository. It intentionally avoids unverified theorem, chapter, and page numbers.

## Established theory

| Project concept | Authoritative source | How it is used here |
| --- | --- | --- |
| Finite congestion games and exact potential | Robert W. Rosenthal, [A class of games possessing pure-strategy Nash equilibria](https://doi.org/10.1007/BF01737559), *International Journal of Game Theory* 2, 65-67 (1973) | The project implements the Rosenthal potential as a sum of resource costs over integer loads. Exact potential change equals the moving player's perceived-cost change. |
| Braess's paradox | Dietrich Braess, Anna Nagurney, and Tina Wakolbinger, [On a Paradox of Traffic Planning](https://doi.org/10.1287/trsc.1050.0127), *Transportation Science* 39(4), 446-450 (2005 English translation of the 1968 work) | The open network has a free middle link that makes the unique selfish equilibrium worse than the equilibrium after that link is removed. |
| Selfish routing and inefficiency | Tim Roughgarden, [Selfish Routing and the Price of Anarchy](https://mitpress.mit.edu/9780262549325/selfish-routing-and-the-price-of-anarchy/), MIT Press (first edition 2005) | Supplies the broader framework for comparing equilibrium routing cost with optimal routing cost. |
| Price of Anarchy in selfish routing | Tim Roughgarden and Éva Tardos, [How Bad Is Selfish Routing?](https://doi.org/10.1145/506147.506153), *Journal of the ACM* 49(2), 236-259 (2002) | Motivates the exact equilibrium-to-optimum cost ratio. This project computes a finite atomic instance exactly rather than importing a general bound. |
| Algorithmic game theory vocabulary and methods | Noam Nisan, Tim Roughgarden, Éva Tardos, and Vijay V. Vazirani, editors, [Algorithmic Game Theory](https://assets.cambridge.org/97805218/72829/frontmatter/9780521872829_frontmatter.pdf), Cambridge University Press (2007) | Provides authoritative context for equilibria, routing games, inefficiency, learning, and mechanisms. |
| Multi-agent learning and game-theoretic foundations | Yoav Shoham and Kevin Leyton-Brown, [Multiagent Systems: Algorithmic, Game-Theoretic, and Logical Foundations](https://www.cambridge.org/core/books/multiagent-systems/B11B69E0CB9032D6EC0A254F59922360), Cambridge University Press (2008) | Frames the distinction between single-agent learning in a fixed environment and learning while other agents adapt. |
| Tabular Q-learning | Christopher J. C. H. Watkins and Peter Dayan, [Q-learning](https://doi.org/10.1007/BF00992698), *Machine Learning* 8, 279-292 (1992) | Supplies the selected-action temporal-difference update. The single-agent convergence result is not claimed for this nonstationary independent multi-agent setting. |
| Hedge and multiplicative weights | Yoav Freund and Robert E. Schapire, [A Decision-Theoretic Generalization of On-Line Learning and an Application to Boosting](https://doi.org/10.1006/jcss.1997.1504), *Journal of Computer and System Sciences* 55(1), 119-139 (1997) | Motivates one full-information multiplicative-weights learner per agent. The implementation uses normalized costs and stable log weights. |
| Online learning and external regret | Nicolò Cesa-Bianchi and Gábor Lugosi, [Prediction, Learning, and Games](https://www.cambridge.org/core/books/prediction-learning-and-games/A05C9F6ABC752FAB8954C885D0065C8F), Cambridge University Press (2006) | Provides the standard fixed-action-in-hindsight regret framework used for the per-agent diagnostic. |
| No-regret learning and coarse correlated equilibrium | Tim Roughgarden, [Twenty Lectures on Algorithmic Game Theory](https://theory.stanford.edu/~tim/f13/f13.pdf), Stanford course notes (2013) | Supports the standard time-average statement: when every player's external regret is small, empirical joint play is an approximate coarse correlated equilibrium. It does not imply last-iterate pure Nash convergence. |

The links above resolve to publisher, journal, author, or DOI records. Bibliographic details were checked against those records on 2026-08-05.

## What the project takes from those sources

### Congestion games and potential

Rosenthal's construction applies to finite congestion games in which a player's cost is the sum of resource costs. For integer edge load `x_e`, the potential contribution is

```text
sum(k=1..x_e) c_e(k).
```

Under a unilateral change, contributions on unchanged resources cancel and the remaining difference is exactly the mover's cost difference. The project verifies that identity across every feasible count-state deviation instead of treating the theorem as an unchecked implementation assumption.

The finite-improvement consequence is also established theory: every accepted strict cost improvement strictly decreases potential, and a finite game cannot have an infinite strictly descending path. The seeded asynchronous best-response baseline is a direct computational realization of that argument.

### Braess's paradox and selfish routing

Braess's paradox is the canonical observation that adding network capacity or an apparently attractive link can make selfishly chosen routes worse. The literature supplies the concept and canonical network structure. This repository instantiates an integer, unsplittable 80-agent version with two `x / 2` edges, two constant-45 edges, and one zero-cost shortcut.

Price of Anarchy and Price of Stability are established comparisons between equilibrium welfare and optimum welfare. Their project values, both `256 / 207`, are derived by exhaustive exact analysis of this particular finite instance. They are not quoted from the general selfish-routing results.

### Learning

Watkins and Dayan analyze tabular Q-learning in a single-agent Markov decision setting under assumptions that do not match 80 independently adapting agents. The project reuses the tabular update but limits its claim to observed outcomes under a predeclared experiment matrix.

Hedge is an established full-information online-learning method. External regret compares realized cumulative cost to the cumulative cost of the best fixed action in hindsight. If all players have at most `epsilon` average external regret, their empirical joint-play distribution has the usual `epsilon` coarse-correlated-equilibrium guarantee. That statement concerns an empirical distribution over play, not the last action profile, a sampled profile, or the final mode of a policy.

This implementation reports agent-level regret summaries and last-profile exploitability separately. It does not relabel low regret as pure Nash convergence and does not claim a standalone CCE certification beyond the standard interpretation of the reported finite regrets.

## Canonical example versus authored scaling

The following elements come from the recognizable Braess example family:

- one source and one destination;
- two outer paths;
- a middle shortcut that combines the variable parts of both paths;
- selfish use of the added shortcut worsening equilibrium travel time;
- improvement when the shortcut is removed.

The following are project-specific choices:

- 80 labeled atomic agents;
- unsplittable complete-route actions;
- variable costs `x / 2` and constant costs 45;
- route codes `U`, `L`, and `Z`;
- exact count-state enumeration rather than a nonatomic flow derivation;
- physical social cost as the sum of physical latency;
- the discrete toll `tau(x) = (x - 1) / 2` on the variable edges;
- three scenarios named `braess-open`, `braess-closed`, and `braess-tolled`.

These choices yield the project-specific outcomes `(0, 0, 80)`, `(40, 40)`, and `(35, 35, 10)`. No source is being credited with those exact authored 80-agent numerical outputs.

## Project-specific learning design

None of these values is a literature default or a claimed optimum:

| Decision | Project value |
| --- | --- |
| Q-learning episodes | 5,000 |
| Q-learning step size | `alpha = 0.15` |
| Initial Q values | `0` |
| Exploration | `max(0.01, 0.80 * 0.999^(t-1))` |
| Final Q evaluation | epsilon zero with isolated tie-breaking stream |
| Hedge episodes | 5,000 |
| Hedge learning rate | `eta = 0.18` |
| Q-learning and Hedge seeds | 64 per scenario and learner |
| Best-response update orders | 16 per scenario |
| Base seed | `20260804` |
| Representative run | final-count medoid, then exploitability, then seed |

Each Q-learning agent owns a separate table. Actions are selected simultaneously before costs and updates are computed. Hedge receives the complete exact counterfactual cost vector; best response receives exact model access; Q-learning sees only experienced selected-route reward. These information assumptions intentionally differ and are stated wherever algorithms are compared.

## Project-specific visual and data design

The literature does not prescribe the presentation. This repository authors:

- a braided, orbitable Three.js network rather than a literal city map;
- edge thickness as load and variable-edge hue as physical latency;
- a neutral shortcut color that remains truthful to zero physical latency;
- 80 instanced particles as route-assignment marks;
- a complete triangular potential landscape with 3,321 vertices and 6,400 triangles;
- one shared potential-height scale for the untolled and tolled surfaces;
- exact Nash and social-optimum markers plus an exported learning trajectory;
- ten scrollytelling chapters and an explicit Explore view;
- an SVG fallback for WebGL failure;
- a Python-owned, versioned, byte-deterministic public data bundle.

The renderer can interpolate visual geometry, camera poses, and material properties. It does not interpolate or invent numerical claims. Textual metrics always correspond to exact exported snapshots.

## Empirical observations, not established theorems

The following statements describe this committed deterministic experiment only:

- all 64 open-scenario independent-Q seeds had final greedy counts `(0, 0, 80)`;
- 63 of 64 closed-scenario independent-Q seeds had `(40, 40)`, with one run one agent away;
- the representative tolled independent-Q seed had `(35, 35, 10)`, zero exploitability, and physical social cost 5,175;
- tolled independent-Q physical social cost had mean 5,178.5625, population standard deviation 8.7180, and standard error 1.0898 across the 64 fixed seeds;
- all 16 seeded strict best-response runs reached the unique exact equilibrium in every scenario;
- low Hedge external regret did not guarantee that every final sampled profile was a pure Nash equilibrium.

Changing episode count, exploration, learning rate, initialization, feedback, or random seeds can change empirical learning behavior. Exact equilibrium and optimum claims do not depend on those learner settings because they come from exhaustive rational enumeration.

## Reading path

For a game theory course, begin with Rosenthal, Braess, Roughgarden and Tardos, then the relevant routing and learning material in *Algorithmic Game Theory*. For a multi-agent systems course, pair Shoham and Leyton-Brown with the project's information-assumption comparison. For reinforcement learning, read Watkins and Dayan before examining why the project's nonstationarity prevents a direct convergence claim. For online learning, pair Freund and Schapire with Cesa-Bianchi and Lugosi, then use Roughgarden's notes for the careful connection from external regret to empirical coarse correlated equilibrium.

The implementation-level bridge from those sources to this repository is documented in [experiment-methodology.md](experiment-methodology.md), and a spoken explanation is organized in [interview-guide.md](interview-guide.md).
