'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseCsv } = require('../src/csv');
const { normaliseSubject, jaccard, termSet, clusterTickets, repeatContacts } = require('../src/dedupe');

function ticket(overrides) {
  return {
    id: 'T-1', requester: 'sara@example.com', subject: 'Cannot log in',
    body: 'I cannot log in to my account since this morning', created_at: '2026-10-01T09:00:00Z',
    status: 'open', ...overrides,
  };
}

test('parseCsv reads ticket rows with quoted bodies', () => {
  const rows = parseCsv('id,requester,subject,body,created_at,status\nT-1,a@example.com,Hi,"body, with comma",2026-10-01T09:00:00Z,open\n');
  assert.equal(rows[0].body, 'body, with comma');
});

test('normaliseSubject strips reply prefixes, ticket numbers, case and whitespace', () => {
  assert.equal(normaliseSubject('Re: Fwd:  Cannot   Log In [#42]'), 'cannot log in');
  assert.equal(normaliseSubject('Ticket #123 account help'), 'account help');
});

test('jaccard is 1 for identical term sets and 0 for disjoint sets', () => {
  assert.equal(jaccard(termSet('login broken'), termSet('login broken')), 1);
  assert.equal(jaccard(termSet('login broken'), termSet('invoice refund')), 0);
});

test('exact duplicates cluster together', () => {
  const { clusters } = clusterTickets([
    ticket({}),
    ticket({ id: 'T-2', subject: 'Re: Cannot log in [#1]', created_at: '2026-10-02T09:00:00Z' }),
  ]);
  assert.equal(clusters.length, 1);
  assert.equal(clusters[0].ticket_ids, 'T-1;T-2');
  assert.equal(clusters[0].confidence, 1);
});

test('fuzzy near duplicates cluster together', () => {
  const { clusters } = clusterTickets([
    ticket({ id: 'T-1', subject: 'Invoice total is wrong', body: 'My invoice total is wrong and charges me twice for the same plan' }),
    ticket({ id: 'T-2', subject: 'Invoice total wrong', body: 'My invoice total is wrong and charges me twice for the same plan today', created_at: '2026-10-03T09:00:00Z' }),
  ]);
  assert.equal(clusters.length, 1);
  assert.match(clusters[0].reason, /fuzzy|exact/);
});

test('different requesters do not cluster, even with identical subjects', () => {
  const { clusters } = clusterTickets([
    ticket({}),
    ticket({ id: 'T-2', requester: 'other@example.com', created_at: '2026-10-01T10:00:00Z' }),
  ]);
  assert.equal(clusters.length, 0);
});

test('same requester with unrelated subjects does not cluster', () => {
  const { clusters } = clusterTickets([
    ticket({}),
    ticket({ id: 'T-2', subject: 'Export to spreadsheet question', body: 'How do I export reports for my manager', created_at: '2026-10-02T09:00:00Z' }),
  ]);
  assert.equal(clusters.length, 0);
});

test('window boundary: pair exactly at the window edge clusters', () => {
  const { clusters } = clusterTickets([
    ticket({}),
    ticket({ id: 'T-2', created_at: '2026-10-08T09:00:00Z' }),
  ], { windowDays: 7 });
  assert.equal(clusters.length, 1);
});

test('window boundary: pair just past the window does not cluster', () => {
  const { clusters } = clusterTickets([
    ticket({}),
    ticket({ id: 'T-2', created_at: '2026-10-08T09:00:01Z' }),
  ], { windowDays: 7 });
  assert.equal(clusters.length, 0);
});

test('a wider window catches the pair that the default window missed', () => {
  const rows = [ticket({}), ticket({ id: 'T-2', created_at: '2026-10-15T09:00:00Z' })];
  assert.equal(clusterTickets(rows).clusters.length, 0);
  assert.equal(clusterTickets(rows, { windowDays: 14 }).clusters.length, 1);
});

test('higher threshold blocks a borderline fuzzy pair', () => {
  const rows = [
    ticket({ id: 'T-1', subject: 'Invoice total is wrong', body: 'invoice total wrong charges twice plan' }),
    ticket({ id: 'T-2', subject: 'Invoice total wrong', body: 'invoice total wrong charges twice plan today extra words here now', created_at: '2026-10-02T09:00:00Z' }),
  ];
  const strict = clusterTickets(rows, { threshold: 1 });
  assert.equal(strict.clusters.length, 0);
});

test('three duplicates form one cluster, not separate pairs', () => {
  const { clusters } = clusterTickets([
    ticket({}),
    ticket({ id: 'T-2', created_at: '2026-10-02T09:00:00Z' }),
    ticket({ id: 'T-3', created_at: '2026-10-03T09:00:00Z' }),
  ]);
  assert.equal(clusters.length, 1);
  assert.equal(clusters[0].ticket_ids, 'T-1;T-2;T-3');
});

test('repeat contacts flags a similar ticket after a closed one inside 30 days', () => {
  const entries = repeatContacts([
    ticket({ status: 'closed' }),
    ticket({ id: 'T-2', created_at: '2026-10-20T09:00:00Z' }),
    ticket({ id: 'T-3', requester: 'solo@example.com', subject: 'Unique question', body: 'Something entirely different' }),
  ]);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].requester, 'sara@example.com');
  assert.equal(entries[0].reopenNote, true);
});

test('repeat contacts ignores similar tickets more than 30 days apart', () => {
  const entries = repeatContacts([
    ticket({}),
    ticket({ id: 'T-2', created_at: '2026-12-15T09:00:00Z' }),
  ]);
  assert.equal(entries.length, 0);
});
