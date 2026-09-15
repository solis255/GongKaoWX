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
    'pages/checkin/index',
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
  const localComponents = app.pages.flatMap((page) => {
    const config = JSON.parse(fs.readFileSync(path.join(root, `${page}.json`), 'utf8'));
    return Object.values(config.usingComponents || {}).map((component) => (
      path.join(root, component.slice(1))
    ));
  });
  const roots = [
    ...app.pages.map((page) => path.join(root, page)),
    ...Object.values(app.usingComponents).map((component) => path.join(root, component.slice(1))),
    ...localComponents,
  ];
  for (const base of new Set(roots)) {
    const markup = fs.readFileSync(`${base}.wxml`, 'utf8');
    const script = fs.readFileSync(`${base}.js`, 'utf8');
    const handlers = [...markup.matchAll(/bind(?:tap|change|righttap|chooseavatar|input|blur|confirm|error)="([A-Za-z0-9_]+)"/g)].map((match) => match[1]);
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

test('profile supports native nickname and avatar editing backed by local storage', () => {
  const script = fs.readFileSync(path.join(root, 'pages/profile/index.js'), 'utf8');
  const markup = fs.readFileSync(path.join(root, 'pages/profile/index.wxml'), 'utf8');
  const storage = fs.readFileSync(path.join(root, 'services/storage.js'), 'utf8');
  assert.match(markup, /open-type="chooseAvatar"/);
  assert.match(markup, /bindchooseavatar="chooseAvatar"/);
  assert.match(markup, /type="nickname"/);
  assert.match(markup, /maxlength="20"/);
  assert.match(script, /USER_DATA_PATH/);
  assert.match(script, /persistAvatarFile/);
  assert.match(script, /saveUserProfile/);
  assert.match(storage, /guokao_user_profile_v1/);
  assert.match(storage, /getUserProfile/);
  assert.match(storage, /saveUserProfile/);
  assert.doesNotMatch(markup, />备考小林</);
});

test('profile renders today subject distribution with a local Canvas 2D component', () => {
  const script = fs.readFileSync(path.join(root, 'pages/profile/index.js'), 'utf8');
  const markup = fs.readFileSync(path.join(root, 'pages/profile/index.wxml'), 'utf8');
  const config = JSON.parse(fs.readFileSync(path.join(root, 'pages/profile/index.json'), 'utf8'));
  assert.equal(config.usingComponents?.['pie-chart'], '/components/pie-chart/index');
  assert.match(script, /listUserBanks\(\{ includeTrash: true \}\)/);
  assert.match(script, /getTodaySubjectDistribution/);
  assert.match(markup, /今日刷题分布/);
  assert.match(markup, /今天还没有刷题记录/);
  assert.match(markup, /<pie-chart items="\{\{todayDistribution\}\}">/);

  const componentBase = path.join(root, 'components/pie-chart/index');
  for (const extension of ['js', 'json', 'wxml', 'wxss']) {
    assert.equal(fs.existsSync(`${componentBase}.${extension}`), true, `pie-chart index.${extension}`);
  }
  const componentScript = fs.readFileSync(`${componentBase}.js`, 'utf8');
  const componentMarkup = fs.readFileSync(`${componentBase}.wxml`, 'utf8');
  assert.match(componentMarkup, /canvas[^>]+type="2d"/);
  assert.match(componentScript, /pixelRatio/);
  assert.match(componentScript, /context\.scale\(ratio, ratio\)/);
});

test('profile edits exam settings and home renders every countdown state', () => {
  const profileScript = fs.readFileSync(path.join(root, 'pages/profile/index.js'), 'utf8');
  const profileMarkup = fs.readFileSync(path.join(root, 'pages/profile/index.wxml'), 'utf8');
  const profileStyle = fs.readFileSync(path.join(root, 'pages/profile/index.wxss'), 'utf8');
  const homeScript = fs.readFileSync(path.join(root, 'pages/home/index.js'), 'utf8');
  const homeMarkup = fs.readFileSync(path.join(root, 'pages/home/index.wxml'), 'utf8');
  const homeStyle = fs.readFileSync(path.join(root, 'pages/home/index.wxss'), 'utf8');
  const storage = fs.readFileSync(path.join(root, 'services/storage.js'), 'utf8');

  assert.match(profileMarkup, /picker mode="date"/);
  assert.match(profileMarkup, /maxlength="30"/);
  assert.match(profileMarkup, /bindtap="saveExamConfig"/);
  assert.match(profileMarkup, /bindtap="clearExamConfig"/);
  assert.match(profileScript, /getExamConfig\(\)/);
  assert.match(profileScript, /saveExamConfig/);
  assert.match(profileScript, /clearExamConfig/);
  assert.match(homeScript, /getExamCountdown\(storage\.getExamConfig\(\), now\)/);
  assert.match(homeScript, /openExamSettings/);
  assert.match(homeMarkup, /设置考试日期，开始倒计时/);
  assert.match(homeMarkup, /距离考试还有/);
  assert.match(homeMarkup, /考试就在今天/);
  assert.match(homeMarkup, /考试已结束/);
  assert.match(storage, /guokao_exam_config_v1/);
  assert.doesNotMatch(homeScript, /Math\.ceil\([^\n]*86400000/);
  assert.match(profileStyle, /padding-bottom:calc\(220rpx \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(homeStyle, /padding-bottom:\s*calc\(220rpx \+ env\(safe-area-inset-bottom\)\)/);
});

test('bottom navigation opens a correctly spaced event-derived check-in calendar', () => {
  const profileScript = fs.readFileSync(path.join(root, 'pages/profile/index.js'), 'utf8');
  const calendarScript = fs.readFileSync(path.join(root, 'pages/checkin/index.js'), 'utf8');
  const calendarMarkup = fs.readFileSync(path.join(root, 'pages/checkin/index.wxml'), 'utf8');
  const calendarStyle = fs.readFileSync(path.join(root, 'pages/checkin/index.wxss'), 'utf8');
  const bottomNavScript = fs.readFileSync(path.join(root, 'components/bottom-nav/index.js'), 'utf8');
  const bottomNavStyle = fs.readFileSync(path.join(root, 'components/bottom-nav/index.wxss'), 'utf8');
  const storage = fs.readFileSync(path.join(root, 'services/storage.js'), 'utf8');

  assert.doesNotMatch(profileScript, /pages\/checkin\/index/);
  assert.match(bottomNavScript, /key: 'checkin'.*text: '打卡'.*pages\/checkin\/index/);
  assert.match(bottomNavStyle, /\.nav__item\s*\{[^}]*width:\s*20%/);
  assert.match(bottomNavStyle, /\.nav__item\s*\{[^}]*white-space:\s*nowrap/);
  assert.match(calendarScript, /getAnswerEvents\(\)/);
  assert.match(calendarScript, /getMonthActivity/);
  assert.match(calendarScript, /getProfileStats/);
  assert.match(calendarMarkup, /<bottom-nav active="checkin"><\/bottom-nav>/);
  assert.match(calendarMarkup, /can-back="\{\{false\}\}"/);
  assert.match(calendarStyle, /padding-bottom:\s*calc\(220rpx \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(calendarMarkup, /本月打卡/);
  assert.match(calendarMarkup, /本月刷题/);
  assert.match(calendarMarkup, /bindtap="previousMonth"/);
  assert.match(calendarMarkup, /bindtap="nextMonth"/);
  assert.match(calendarMarkup, /bindtap="goToday"/);
  assert.match(calendarMarkup, /bindtap="selectDay"/);
  assert.match(calendarMarkup, /calendar-day--today/);
  assert.match(calendarMarkup, /calendar-day--future/);
  assert.doesNotMatch(storage, /guokao_(?:checkin|attendance)/i);
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
