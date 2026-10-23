# ticket-dedupe
Live page: https://aamirtechs.github.io/ticket-dedupe/
Use it in your browser: the Pages site above runs the full tool locally, no install needed.

Scan a ticket export offline and cluster likely duplicate and repeat contacts into a human merge review sheet. It never merges, closes, or modifies anything.

Support queues fill up with the same person writing in twice, once from the form and once by email, plus the follow up that opens a fresh ticket instead of replying. Agents then answer twice, or worse, give two different answers. This tool finds those groups first, so a human can merge with intent instead of by accident.

## Install

Requires Node.js 20 or newer. No packages to install.

```bash
git clone <this repo>
cd ticket-dedupe
node src/cli.js --help
```

## Usage

```bash
node src/cli.js tickets.csv [--threshold 0.8] [--window-days 7] [--repeat-days 30] [--config config.json] [--out-dir out]
```

Input is a ticket CSV export with columns `id`, `requester`, `subject`, `body`, `created_at`, and `status`. Zendesk, Freshdesk, and most helpdesks can export this shape.

How matching works:

- Subjects are normalised first: reply and forward prefixes are stripped, ticket numbers are removed, case is folded, and extra whitespace is collapsed.
- Two tickets with the same normalised subject are an exact match.
- Otherwise, word overlap similarity (Jaccard) is computed over the subject plus body words, after removing a small English stopword list. Pairs at or above the threshold match.
- Pairs are only considered inside the time window, which defaults to 7 days. The boundary is inclusive: a pair exactly 7 days apart still matches, a pair one second past it does not.
- Version 1 only pairs tickets from the same requester. That is deliberate, because merging tickets across different people is rarely correct. Same requester pairs also get a small confidence boost of 0.1 before the threshold check, since a repeat contact from one person is more likely to be a true duplicate. Clustering across requesters to spot shared incidents is listed in GFIs.md as an opt in outbreak mode.

Outputs:

- `clusters.csv` with `cluster_id`, `ticket_ids`, `reason`, and `confidence`, one row per cluster of two or more tickets.
- `repeat-contacts.md` listing requesters with similar issues inside 30 days, including a note when a similar ticket arrived after an earlier one was closed, which usually means a reopen rather than a new issue.

## Example

Input, from `examples/tickets.csv` (synthetic data). Sara wrote in twice about a login problem, Omar has an invoice issue that came back 15 days after a closed ticket, Ana has a subject identical to Sara's but is a different person, and Lee has two unrelated tickets:

```csv
id,requester,subject,body,created_at,status
T-101,sara@example.com,Cannot log in to my account,I cannot log in to my account since this morning. The login page shows an error after I enter my details.,2026-10-01T09:00:00Z,open
T-102,sara@example.com,"Re: Cannot log in to my account [#101]",Still cannot log in to my account. The login page shows the same error after I enter my details.,2026-10-02T10:30:00Z,open
T-103,omar@example.org,Invoice total is wrong,My invoice total is wrong for October. The invoice charges me twice for the same plan.,2026-10-03T08:00:00Z,closed
T-104,omar@example.org,Invoice total wrong again,The invoice total is wrong again for October and charges me twice for the same plan.,2026-10-18T08:30:00Z,open
T-107,ana@example.com,Cannot log in to my account,I cannot log in to my account since this morning. The login page shows an error.,2026-10-01T11:00:00Z,open
```

Run:

```bash
node src/cli.js examples/tickets.csv --out-dir out
```

Real console output:

```text
Tickets scanned: 8
Clusters found: 1
Repeat contacts: 2
Wrote out/clusters.csv
Wrote out/repeat-contacts.md
```

Real `clusters.csv` output:

```csv
cluster_id,ticket_ids,reason,confidence
C1,T-101;T-102,"exact normalised subject match, same requester",1
```

Omar's pair is not a cluster, because the two tickets are 15 days apart, outside the 7 day window. It does show up in the repeat contacts report, which uses the wider 30 day window.

Real `repeat-contacts.md` output:

```markdown
# Repeat Contacts

Requesters with similar issues inside 30 days. Review only, nothing was merged or changed.

## omar@example.org

- Tickets: T-103, T-104
- Similar tickets inside the window: 2
- Note: a later similar ticket arrived after an earlier one was closed, so this may be a reopen rather than a new issue.

## sara@example.com

- Tickets: T-101, T-102
- Similar tickets inside the window: 2
```

## Tests

```bash
npm test
```

14 tests cover exact duplicates, fuzzy near duplicates, different requester non matches, unrelated subjects from the same requester, window boundaries on both sides, a stricter threshold, multi ticket clusters, and repeat contacts including the reopen note and the 30 day limit.

## Good first issues

See GFIs.md.

## License

MIT. Copyright (c) 2026 Amir Hussain.
