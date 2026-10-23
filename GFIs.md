# Good First Issues

These are seeded starter issues for new contributors. Each one is scoped, self contained, and covered by the existing test style.

## 1. Richer subject normalisation rules (order IDs, tracking numbers)

Normalisation currently strips reply prefixes and ticket numbers, but order IDs and tracking numbers still make otherwise identical subjects look different. Add optional rules that replace order IDs and tracking numbers with a placeholder before comparison, keep them off by default, and add tests showing two subjects that differ only by an order ID. Document the new option in the README.

## 2. Multilingual stopword lists

The word overlap score uses a small English stopword list, so common words in other languages inflate similarity for non English tickets. Add stopword lists for at least two more languages, a config option to select them, and tests proving a pair that scores high only because of shared filler words drops below the threshold. Keep every list in the repo, with no network lookups.

## 3. Outbreak mode: cluster across different requesters to spot incidents

Version 1 only clusters tickets from the same requester, on purpose, because merging tickets across people is rarely right. An opt in outbreak mode would also cluster near identical tickets from different requesters inside a short window, so a team can spot a shared incident early. This mode must be clearly labelled in the output, must never be the default, and needs tests for both modes.
