import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
const project = JSON.parse(fs.readFileSync(path.join(root, 'project.config.json'), 'utf8'));

test('registers all designed and user-data screens', () => {
  assert.deepEqual(app.pages, [
    'pages/home/index',
    'pages/bank/index',
    'pages/practice-setup/index',
    'pages/question/index',
    'pages/question-card/index',
    'pages/analysis/index',
    'pages/result/index',
    'pages/wrong/index',
    'pages/stats/index',
    'pages/profile/index',
    'pages/goal/index',
    'pages/favorites/index',
    'pages/history/index',
    'pages/import-bank/index',
    'pages/bank-trash/index',
    'pages/subjects/index',
  ]);
});

test('every registered page has js, json, wxml and wxss files', () => {
  for (const page of app.pages) {
    for (const extension of ['js', 'json', 'wxml', 'wxss']) {
      assert.equal(fs.existsSync(path.join(root, `${page}.${extension}`)), true, `${page}.${extension}`);
    }
  }
});

test('every WXML event handler exists in its page or component script', () => {
  const roots = [
    ...app.pages.map((page) => path.join(root, page)),
    ...Object.values(app.usingComponents).map((component) => path.join(root, component.slice(1))),
  ];
  for (const base of roots) {
    const markup = fs.readFileSync(`${base}.wxml`, 'utf8');
    const script = fs.readFileSync(`${base}.js`, 'utf8');
    const handlers = [...markup.matchAll(/bind(?:tap|change|righttap)="([A-Za-z0-9_]+)"/g)].map((match) => match[1]);
    for (const handler of handlers) {
      assert.match(script, new RegExp(`\\b${handler}\\s*\\(`), `${base}.wxml handler ${handler}`);
    }
  }
});

test('question submission guards an already submitted session before persisting an event', () => {
  const source = fs.readFileSync(path.join(root, 'pages/question/index.js'), 'utf8');
  const guard = source.indexOf('if (app.globalData.session.submitted) return;');
  const persist = source.indexOf('saveAnswerEvent');
  assert.ok(guard >= 0, 'submitted session guard is required');
  assert.ok(persist > guard, 'guard must run before saving the answer event');
});

test('question page opens the card and supports previous navigation', () => {
  const script = fs.readFileSync(path.join(root, 'pages/question/index.js'), 'utf8');
  const markup = fs.readFileSync(path.join(root, 'pages/question/index.wxml'), 'utf8');
  assert.match(script, /pages\/question-card\/index/);
  assert.match(script, /movePrevious/);
  assert.match(script, /multiple-choice/);
  assert.match(script, /selected\.includes\(key\)/);
  assert.match(markup, /多选题/);
  assert.match(markup, /item\.selected/);
  assert.doesNotMatch(script, /已完成.*题/);
});

test('analysis uses local sources, a scroll view, and real card navigation', () => {
  const script = fs.readFileSync(path.join(root, 'pages/analysis/index.js'), 'utf8');
  const markup = fs.readFileSync(path.join(root, 'pages/analysis/index.wxml'), 'utf8');
  assert.match(script, /sourceRefs/);
  assert.match(script, /setClipboardData/);
  assert.match(script, /pages\/question-card\/index/);
  assert.match(script, /movePrevious/);
  assert.match(script, /answerText/);
  assert.match(markup, /questionTypeText/);
  assert.match(markup, /item\.correct/);
  assert.match(markup, /item\.chosen/);
  assert.match(markup, /<scroll-view[^>]*scroll-y/);
  assert.match(markup, /wx:if="\{\{sources\.length\}\}"/);
  assert.doesNotMatch(script, /已完成.*题/);
});

test('profile metrics expose three independent tap targets', () => {
  const script = fs.readFileSync(path.join(root, 'pages/profile/index.js'), 'utf8');
  const markup = fs.readFileSync(path.join(root, 'pages/profile/index.wxml'), 'utf8');
  assert.match(script, /openTotal\(\).*pages\/history\/index/s);
  assert.match(script, /openAccuracy\(\).*pages\/stats\/index/s);
  assert.match(script, /openFavorites\(\).*pages\/favorites\/index/s);
  assert.match(markup, /bindtap="openTotal"/);
  assert.match(markup, /bindtap="openAccuracy"/);
  assert.match(markup, /bindtap="openFavorites"/);
  assert.doesNotMatch(markup, /class="metrics" bindtap=/);
});

test('question headers use icon UI and keep the card action out of the top row', () => {
  const componentMarkup = fs.readFileSync(path.join(root, 'components/app-header/index.wxml'), 'utf8');
  const componentStyle = fs.readFileSync(path.join(root, 'components/app-header/index.wxss'), 'utf8');
  const questionMarkup = fs.readFileSync(path.join(root, 'pages/question/index.wxml'), 'utf8');
  const analysisMarkup = fs.readFileSync(path.join(root, 'pages/analysis/index.wxml'), 'utf8');
  assert.match(componentMarkup, /back-button__arrow/);
  assert.match(componentStyle, /border-radius:\s*50%/);
  assert.doesNotMatch(questionMarkup, /question-head__card/);
  assert.doesNotMatch(analysisMarkup, /right-text="答题卡"/);
});

test('question and analysis expose the card action in their bottom toolbars', () => {
  const questionMarkup = fs.readFileSync(path.join(root, 'pages/question/index.wxml'), 'utf8');
  const analysisMarkup = fs.readFileSync(path.join(root, 'pages/analysis/index.wxml'), 'utf8');
  assert.match(questionMarkup, /class="utility utility--card" bindtap="openCard"/);
  assert.match(analysisMarkup, /class="card-action" bindtap="openCard"/);
});

test('home and wrong pages derive wrong answers only from answer events', () => {
  const home = fs.readFileSync(path.join(root, 'pages/home/index.js'), 'utf8');
  const wrong = fs.readFileSync(path.join(root, 'pages/wrong/index.js'), 'utf8');
  assert.doesNotMatch(home, /getWrongAnswerIds/);
  assert.doesNotMatch(wrong, /getWrongAnswerIds/);
});

test('keeps imported JSON support available in the developer-tools preview package', () => {
  assert.equal(project.setting.ignoreDevUnusedFiles, false);
  const privateConfigPath = path.join(root, 'project.private.config.json');
  if (fs.existsSync(privateConfigPath)) {
    const privateConfig = JSON.parse(fs.readFileSync(privateConfigPath, 'utf8'));
    assert.notEqual(privateConfig.setting?.ignoreDevUnusedFiles, true);
  }
});

test('removes every legacy built-in question bank and exposes subject management', () => {
  const names = ['politics', 'common-sense', 'verbal', 'quantitative', 'reasoning', 'data-analysis'];
  for (const name of names) {
    assert.equal(fs.existsSync(path.join(root, `questions/${name}.json`)), false);
    assert.equal(fs.existsSync(path.join(root, `questions/generated/${name}.js`)), false);
  }
  assert.match(fs.readFileSync(path.join(root, 'pages/bank/index.wxml'), 'utf8'), /管理科目/);
  assert.match(fs.readFileSync(path.join(root, 'pages/import-bank/index.wxml'), 'utf8'), /所属科目/);
});
