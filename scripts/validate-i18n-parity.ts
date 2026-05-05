#!/usr/bin/env tsx
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { routing } from '../i18n/routing';

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };

function flattenKeys(obj: JsonValue, prefix = ''): string[] {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    return [prefix];
  }
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    keys.push(...flattenKeys(v, path));
  }
  return keys;
}

function loadLocale(locale: string): JsonValue {
  const path = join(process.cwd(), 'messages', `${locale}.json`);
  return JSON.parse(readFileSync(path, 'utf8')) as JsonValue;
}

function diff(a: ReadonlySet<string>, b: ReadonlySet<string>): string[] {
  return [...a].filter((k) => !b.has(k));
}

const baseLocale = routing.defaultLocale;
const baseKeys = new Set(flattenKeys(loadLocale(baseLocale)));

let hasError = false;
const otherLocales = routing.locales.filter((l) => l !== baseLocale);

for (const locale of otherLocales) {
  const keys = new Set(flattenKeys(loadLocale(locale)));
  const missing = diff(baseKeys, keys);
  const extra = diff(keys, baseKeys);
  if (missing.length === 0 && extra.length === 0) {
    console.log(`✓ ${locale}.json — ${keys.size} keys, parity OK`);
    continue;
  }
  hasError = true;
  console.error(`✗ ${locale}.json — parity broken`);
  if (missing.length > 0) {
    console.error(`  Missing ${missing.length} key(s) present in ${baseLocale}.json:`);
    for (const k of missing.slice(0, 20)) console.error(`    - ${k}`);
    if (missing.length > 20) console.error(`    ... and ${missing.length - 20} more`);
  }
  if (extra.length > 0) {
    console.error(`  Extra ${extra.length} key(s) not in ${baseLocale}.json:`);
    for (const k of extra.slice(0, 20)) console.error(`    + ${k}`);
    if (extra.length > 20) console.error(`    ... and ${extra.length - 20} more`);
  }
}

if (hasError) {
  console.error('\nFix the divergences above before shipping.');
  process.exit(1);
}
console.log(`\nAll ${routing.locales.length} locales in parity (${baseKeys.size} keys each).`);
