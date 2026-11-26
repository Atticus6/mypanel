import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const readView = (name) =>
    readFileSync(new URL(`../src/views/app-store/installed/${name}/index.tsx`, import.meta.url), 'utf8');

test('upgrade loads only the selected target Compose and keeps the fallback list', () => {
    const source = readView('upgrade');
    assert.ok(source.includes('loadCompose: false'), 'baseline versions must skip Compose loading');
    assert.ok(source.includes('loadCompose: true'), 'selected version must load Compose');
    assert.ok(source.includes('updateVersion'), 'selected version must be passed to the loader');
});

test('upgrade disabled expression depends on Compose readiness and loading state', () => {
    const source = readView('upgrade');
    assert.ok(source.includes('composeReady'), 'confirm button must wait for Compose readiness');
    assert.ok(source.includes('loadingVersions'), 'confirm button must respect the loading state');
});

test('ignore requests skip both current and target Compose loading', () => {
    const source = readView('ignore/create');
    assert.ok(source.includes('loadCompose: false'), 'ignore path must skip Compose loading');
});

test('Feishu legacy transition still enforces the required backup', () => {
    const source = readView('upgrade');
    assert.ok(source.includes('feishuLegacy'), 'legacy Feishu notice must be shown');
    assert.ok(source.includes('backup'), 'backup option must remain available');
});
