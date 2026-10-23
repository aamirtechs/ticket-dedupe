#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { parseCsv, toCsv } = require('./csv');
const { clusterTickets, repeatContacts, repeatContactsMarkdown } = require('./dedupe');

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      if (key === 'help') { args.help = true; } else { args[key] = argv[i + 1]; i += 1; }
    } else { args._.push(a); }
  }
  return args;
}

function usage() {
  return [
    'Usage: ticket-dedupe <tickets.csv> [options]',
    '',
    'Options:',
    '  --threshold <n>    Similarity threshold, 0 to 1 (default 0.8)',
    '  --window-days <n>  Only pair tickets inside this many days (default 7)',
    '  --repeat-days <n>  Repeat contact window in days (default 30)',
    '  --config <file>    JSON config with threshold, windowDays, repeatDays',
    '  --out-dir <dir>    Output directory (default: current directory)',
    '  --help             Show this help',
    '',
    'Review only. This tool never merges, closes, or modifies any ticket.',
  ].join('\n');
}

function main(argv) {
  const args = parseArgs(argv);
  if (args.help || args._.length === 0) {
    console.log(usage());
    return args._.length === 0 && !args.help ? 1 : 0;
  }
  let config = {};
  if (args.config) config = JSON.parse(fs.readFileSync(args.config, 'utf8'));
  const opts = {
    threshold: args.threshold !== undefined ? Number(args.threshold) : config.threshold,
    windowDays: args['window-days'] !== undefined ? Number(args['window-days']) : config.windowDays,
    repeatDays: args['repeat-days'] !== undefined ? Number(args['repeat-days']) : config.repeatDays,
  };
  for (const k of Object.keys(opts)) if (opts[k] === undefined) delete opts[k];
  const rows = parseCsv(fs.readFileSync(args._[0], 'utf8'));
  const result = clusterTickets(rows, opts);
  const repeats = repeatContacts(rows, result.options);
  const outDir = args['out-dir'] || '.';
  fs.mkdirSync(outDir, { recursive: true });
  const headers = ['cluster_id', 'ticket_ids', 'reason', 'confidence'];
  fs.writeFileSync(path.join(outDir, 'clusters.csv'), toCsv(headers, result.clusters));
  fs.writeFileSync(path.join(outDir, 'repeat-contacts.md'), repeatContactsMarkdown(repeats, result.options.repeatDays));
  console.log('Tickets scanned: ' + result.tickets.length);
  console.log('Clusters found: ' + result.clusters.length);
  console.log('Repeat contacts: ' + repeats.length);
  console.log('Wrote ' + path.join(outDir, 'clusters.csv'));
  console.log('Wrote ' + path.join(outDir, 'repeat-contacts.md'));
  return 0;
}

if (require.main === module) {
  try { process.exitCode = main(process.argv.slice(2)); } catch (err) {
    console.error('Error: ' + err.message);
    process.exitCode = 1;
  }
}

module.exports = { parseArgs, usage, main };
