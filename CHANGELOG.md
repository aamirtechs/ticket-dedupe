# Changelog

## 1.0.0

- Initial release.
- Normalises ticket subjects by stripping reply and forward prefixes, ticket numbers, extra whitespace, and case differences.
- Clusters exact normalised subject matches and fuzzy word overlap matches inside a configurable time window, for the same requester only.
- Writes clusters.csv for human merge review and repeat-contacts.md for requesters with similar issues inside 30 days, including possible reopens after a closed ticket.
- Review only. Nothing is merged, closed, or modified.
