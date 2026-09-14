import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const {
  computeLayoutMetrics,
  getSafeWindowInfo,
  resolvePositiveMetric,
} = require('../services/layout.js');

test('places content below the WeChat menu capsule', () => {
  assert.deepEqual(
    computeLayoutMetrics(
      { statusBarHeight: 47, screenWidth: 430, windowWidth: 430 },
      { top: 55, bottom: 87, height: 32, left: 334, right: 421, width: 87 },
    ),
    {
      statusBarHeight: 47,
      capsuleTop: 55,
      capsuleHeight: 32,
      windowWidth: 430,
      capsuleLeft: 334,
      capsuleRight: 421,
      capsuleWidth: 87,
      rightSafeWidth: 96,
      navHeight: 95,
      contentTop: 103,
    },
  );
});

test('uses safe defaults when window or capsule metrics are unavailable', () => {
  assert.deepEqual(computeLayoutMetrics(), {
    statusBarHeight: 20,
    capsuleTop: 28,
    capsuleHeight: 32,
    windowWidth: 375,
    capsuleLeft: 281,
    capsuleRight: 368,
    capsuleWidth: 87,
    rightSafeWidth: 94,
    navHeight: 68,
    contentTop: 76,
  });
});

test('normalizes null and malformed layout inputs to finite safe metrics', () => {
  for (const [windowInfo, capsule] of [
    [null, null],
    ['invalid', 42],
    [{ statusBarHeight: -1, windowWidth: Number.NaN }, { top: -8, width: -10 }],
  ]) {
    const layout = computeLayoutMetrics(windowInfo, capsule);
    assert.deepEqual(layout, {
      statusBarHeight: 20,
      capsuleTop: 28,
      capsuleHeight: 32,
      windowWidth: 375,
      capsuleLeft: 281,
      capsuleRight: 368,
      capsuleWidth: 87,
      rightSafeWidth: 94,
      navHeight: 68,
      contentTop: 76,
    });
  }
});

test('rejects contradictory positive capsule geometry and keeps vertical metrics positive', () => {
  const layout = computeLayoutMetrics(
    { statusBarHeight: 47, windowWidth: 430 },
    { top: 30, height: 32, left: 350, right: 330, width: 87 },
  );
  assert.deepEqual(layout, {
    statusBarHeight: 47,
    capsuleTop: 55,
    capsuleHeight: 32,
    windowWidth: 430,
    capsuleLeft: 336,
    capsuleRight: 423,
    capsuleWidth: 87,
    rightSafeWidth: 94,
    navHeight: 95,
    contentTop: 103,
  });
  assert.ok(layout.navHeight > 0);
  assert.ok(layout.contentTop > layout.navHeight);
});

test('falls back from getWindowInfo to getSystemInfoSync and finally an empty object', () => {
  const legacyInfo = { statusBarHeight: 44, windowWidth: 390 };
  assert.equal(getSafeWindowInfo({
    getWindowInfo() { throw new Error('unsupported'); },
    getSystemInfoSync() { return legacyInfo; },
  }), legacyInfo);
  assert.deepEqual(getSafeWindowInfo({
    getWindowInfo() { throw new Error('unsupported'); },
    getSystemInfoSync() { throw new Error('unsupported'); },
  }), {});
  assert.deepEqual(getSafeWindowInfo(null), {});
});

test('resolves a positive component property, then global layout, then default', () => {
  assert.equal(resolvePositiveMetric(95, 68, 60), 95);
  assert.equal(resolvePositiveMetric(0, 68, 60), 68);
  assert.equal(resolvePositiveMetric(0, 0, 60), 60);
});

test('app and app-header consume shared safe layout resolvers', () => {
  const appScript = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  const headerScript = fs.readFileSync(path.join(root, 'components/app-header/index.js'), 'utf8');
  assert.match(appScript, /getSafeWindowInfo\(wx\)/);
  assert.equal((headerScript.match(/observer\([^)]*\)\s*{\s*this\.resolveLayout\(\)/g) || []).length, 2);
  assert.match(headerScript, /resolvePositiveMetric/);
});

test('bank tools stay above the fixed navigation on narrow safe-area screens', () => {
  const markup = fs.readFileSync(path.join(root, 'pages/bank/index.wxml'), 'utf8');
  const style = fs.readFileSync(path.join(root, 'pages/bank/index.wxss'), 'utf8');
  const toolRows = markup.match(/class="bank-tool(?: [^"]*)?"/g) || [];

  assert.equal(toolRows.length, 3);
  assert.match(style, /\.bank\s*\{[^}]*padding-bottom:\s*calc\(220rpx \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(style, /grid-template-columns:\s*repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(style, /\.bank-tool\s*\{[^}]*height:\s*88rpx/);
  assert.match(style, /\.bank-tool\s*\{[^}]*white-space:\s*nowrap/);
  assert.match(markup, /管理科目/);
  assert.match(markup, /＋ 导入题库/);
  assert.match(markup, /回收站/);
});
