# AgentID Analytics

The Advanced Analytics page at `/app/analytics` uses backend-calculated records rather than fabricated chart data.

Its sources are:

- current identities and lifecycle state from `AgentRegistry`;
- persisted authentication audit events;
- persisted verified interactions;
- decoded blockchain lifecycle events.

The page reports verification attempts, verified and blocked requests, success rate, interaction count, unique active agents, blocked reasons, active agents, communication pairs, and lifecycle activity. The one-hour, 24-hour, seven-day, and all-time controls recalculate applicable metrics from the selected time window.

Empty ranges display an honest empty state. Counts describe recorded activity in the configured persistence store and connected chain; they are not reputation, safety, or quality scores.
