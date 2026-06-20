# 刷题回看与来源交互实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为刷题流程增加可跳转的答题卡、上一题回看、题目来源展开和完整滚动解析，并拆分个人中心三个指标的导航。

**Architecture:** `services/practice-session.js` 统一管理会话内题号状态和安全跳转；新增 `pages/question-card` 只负责渲染会话题号。答题页与解析页复用会话 API，不直接篡改索引；来源只读取题目现有 `sourceRefs`。

**Tech Stack:** 微信小程序原生框架、CommonJS、WXML/WXSS、Node.js 内置测试运行器。

---

## 文件结构

- Modify: `services/practice-session.js` — 会话内题号状态、按索引跳转和上一题。
- Modify: `tests/practice-session.test.mjs` — 锁定题、已答恢复和前后导航测试。
- Create: `pages/question-card/index.{js,json,wxml,wxss}` — 独立答题卡页面。
- Modify: `app.json`, `tests/miniprogram-structure.test.mjs` — 注册并验证新页面。
- Modify: `pages/question/index.{js,wxml,wxss}` — 安全顶栏、上一题、题卡入口。
- Modify: `pages/analysis/index.{js,wxml,wxss}` — 完整滚动、来源和前后题导航。
- Modify: `pages/profile/index.{js,wxml,wxss}` — 三个指标独立导航。

### Task 1: 会话内安全跳转

**Files:**
- Modify: `tests/practice-session.test.mjs`
- Modify: `services/practice-session.js`

- [x] **Step 1: 写失败测试**

```js
const questions = [
  { id: 'q-1', answer: 'A', options: [{ key: 'A' }, { key: 'B' }, { key: 'C' }, { key: 'D' }] },
  { id: 'q-2', answer: 'B', options: [{ key: 'A' }, { key: 'B' }, { key: 'C' }, { key: 'D' }] },
  { id: 'q-3', answer: 'C', options: [{ key: 'A' }, { key: 'B' }, { key: 'C' }, { key: 'D' }] },
];

const submitSelected = (session, answer) => submitAnswer(selectAnswer(session, answer), 100);

test('builds card states and blocks future questions', () => {
  let session = createSession('verbal', questions);
  session = selectAnswer(session, 'A');
  session = submitAnswer(session, 100);
  session = moveNext(session);
  assert.deepEqual(buildQuestionCard(session).map(({ status, current, locked }) => ({ status, current, locked })), [
    { status: 'correct', current: false, locked: false },
    { status: 'current', current: true, locked: false },
    { status: 'locked', current: false, locked: true },
  ]);
  assert.throws(() => jumpToQuestion(session, 2), /locked/i);
});

test('restores an answered question and returns to the latest unanswered question', () => {
  let session = createSession('verbal', questions);
  session = submitSelected(session, 'A');
  session = moveNext(session);
  session = submitSelected(session, 'B');
  session = moveNext(session);
  const previous = jumpToQuestion(session, 0);
  assert.equal(previous.selectedAnswer, 'A');
  assert.equal(previous.submitted, true);
  const latest = jumpToQuestion(previous, 2);
  assert.equal(latest.selectedAnswer, null);
  assert.equal(latest.submitted, false);
});
```

- [x] **Step 2: 运行并确认失败**

Run: `/Users/accs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/practice-session.test.mjs`

Expected: FAIL，提示 `buildQuestionCard` 或 `jumpToQuestion` 未导出。

- [x] **Step 3: 实现最小会话 API**

```js
function jumpToQuestion(session, index) {
  const target = Number(index);
  if (!Number.isInteger(target) || target < 0 || target >= session.questions.length) throw new RangeError('Invalid question index');
  if (target > session.answers.length) throw new Error('Question is locked');
  const record = session.answers[target] || null;
  return {
    ...session,
    currentIndex: target,
    selectedAnswer: record ? record.userAnswer : null,
    submitted: Boolean(record),
  };
}

function buildQuestionCard(session) {
  return session.questions.map((question, index) => {
    const record = session.answers[index];
    const current = index === session.currentIndex;
    return {
      questionId: question.id,
      index,
      number: index + 1,
      status: record ? (record.correct ? 'correct' : 'wrong') : (index === session.answers.length ? 'current' : 'locked'),
      current,
      locked: index > session.answers.length,
    };
  });
}

function movePrevious(session) {
  if (session.currentIndex === 0) return session;
  return jumpToQuestion(session, session.currentIndex - 1);
}
```

```js
function moveNext(session) {
  if (!session.submitted) throw new Error('Submit the current answer before moving next');
  if (session.currentIndex >= session.questions.length - 1) return session;
  return jumpToQuestion(session, session.currentIndex + 1);
}

module.exports = {
  createSession, currentQuestion, selectAnswer, submitAnswer,
  moveNext, movePrevious, jumpToQuestion, buildQuestionCard, summarizeSession,
};
```

- [x] **Step 4: 运行测试**

Run: `/Users/accs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/practice-session.test.mjs`

Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add services/practice-session.js tests/practice-session.test.mjs
git commit -m "feat: support safe question review navigation"
```

### Task 2: 独立答题卡页面

**Files:**
- Modify: `tests/miniprogram-structure.test.mjs`
- Modify: `app.json`
- Create: `pages/question-card/index.js`
- Create: `pages/question-card/index.json`
- Create: `pages/question-card/index.wxml`
- Create: `pages/question-card/index.wxss`

- [x] **Step 1: 添加路由失败测试**

在 `app.pages` 期望数组的 `pages/question/index` 后加入：

```js
'pages/question-card/index',
```

运行结构测试，预期因路由和文件缺失而失败。

- [x] **Step 2: 注册页面并实现题卡逻辑**

```js
const { buildQuestionCard, jumpToQuestion } = require('../../services/practice-session');

Page({
  data: { rows: [], completed: 0, correct: 0, wrong: 0 },
  onShow() {
    const session = getApp().globalData.session;
    if (!session) { wx.reLaunch({ url: '/pages/home/index' }); return; }
    const rows = buildQuestionCard(session);
    this.setData({
      rows,
      completed: session.answers.length,
      correct: session.answers.filter((item) => item.correct).length,
      wrong: session.answers.filter((item) => !item.correct).length,
    });
  },
  openQuestion(event) {
    const index = Number(event.currentTarget.dataset.index);
    const row = this.data.rows[index];
    if (row.locked) { wx.showToast({ title: '请按顺序完成前面的题目', icon: 'none' }); return; }
    const app = getApp();
    app.globalData.session = jumpToQuestion(app.globalData.session, index);
    wx.redirectTo({ url: app.globalData.session.submitted ? '/pages/analysis/index' : '/pages/question/index' });
  },
});
```

```xml
<view class="page card-page">
  <app-header title="答题卡"></app-header>
  <view class="card card-summary">
    <text>已完成 {{completed}}</text><text class="green">正确 {{correct}}</text><text class="wrong">错误 {{wrong}}</text>
  </view>
  <view class="card-grid">
    <view wx:for="{{rows}}" wx:key="questionId"
      class="card-number card-number--{{item.status}} {{item.current?'card-number--current':''}}"
      data-index="{{item.index}}" bindtap="openQuestion">{{item.number}}</view>
  </view>
</view>
```

```css
.card-page{background:#fff;padding-top:0}.card-summary{margin-top:24rpx;padding:28rpx;display:flex;justify-content:space-around}
.card-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:24rpx;margin-top:34rpx}.card-number{height:88rpx;display:flex;align-items:center;justify-content:center;border-radius:22rpx;background:#eef1f3;color:#8d96a1}.card-number--correct{color:#fff;background:#20b88d}.card-number--wrong{color:#fff;background:#ef6b64}.card-number--current{box-shadow:0 0 0 5rpx rgba(32,184,141,.22)}
```

- [x] **Step 3: 运行结构测试**

Run: `/Users/accs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/miniprogram-structure.test.mjs`

Expected: PASS，且所有 WXML 处理器存在。

- [ ] **Step 4: 提交**

```bash
git add app.json pages/question-card tests/miniprogram-structure.test.mjs
git commit -m "feat: add question card page"
```

### Task 3: 答题页安全顶栏和上一题

**Files:**
- Modify: `pages/question/index.js`
- Modify: `pages/question/index.wxml`
- Modify: `pages/question/index.wxss`
- Modify: `tests/miniprogram-structure.test.mjs`

- [x] **Step 1: 添加静态失败测试**

```js
test('question page navigates to the card and reserves capsule space', () => {
  const script = fs.readFileSync(path.join(root, 'pages/question/index.js'), 'utf8');
  const markup = fs.readFileSync(path.join(root, 'pages/question/index.wxml'), 'utf8');
  assert.match(script, /pages\/question-card\/index/);
  assert.match(markup, /layout\.rightSafeWidth/);
  assert.doesNotMatch(script, /已完成.*题/);
});
```

- [x] **Step 2: 实现入口和上一题**

```js
const { currentQuestion, selectAnswer, submitAnswer, movePrevious } = require('../../services/practice-session');

previous() {
  const app = getApp();
  if (app.globalData.session.currentIndex === 0) { this.navigateBack(); return; }
  app.globalData.session = movePrevious(app.globalData.session);
  wx.redirectTo({ url: '/pages/analysis/index' });
},
openCard() { wx.navigateTo({ url: '/pages/question-card/index' }); },
```

顶栏左侧文案为 `{{index===1?'返回':'上一题'}}`，中间题号使用绝对居中的 `.question-head__title`，右侧使用 `style="right: {{layout.rightSafeWidth}}px"`。标题区域左右各保留 `layout.rightSafeWidth`，确保与胶囊和左按钮都不重叠。

- [x] **Step 3: 运行结构与会话测试**

Run: `/Users/accs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/miniprogram-structure.test.mjs tests/practice-session.test.mjs`

Expected: PASS。

- [ ] **Step 4: 提交**

```bash
git add pages/question tests/miniprogram-structure.test.mjs
git commit -m "fix: add safe question navigation header"
```

### Task 4: 可滚动解析、来源与前后题

**Files:**
- Modify: `pages/analysis/index.js`
- Modify: `pages/analysis/index.wxml`
- Modify: `pages/analysis/index.wxss`
- Modify: `tests/miniprogram-structure.test.mjs`

- [x] **Step 1: 添加来源和滚动结构失败测试**

```js
test('analysis consumes local sourceRefs and uses a scroll view', () => {
  const script = fs.readFileSync(path.join(root, 'pages/analysis/index.js'), 'utf8');
  const markup = fs.readFileSync(path.join(root, 'pages/analysis/index.wxml'), 'utf8');
  assert.match(script, /sourceRefs/);
  assert.match(script, /setClipboardData/);
  assert.match(markup, /<scroll-view[^>]*scroll-y/);
  assert.match(markup, /wx:if="\{\{sources\.length\}\}"/);
});
```

- [x] **Step 2: 加载完整题目上下文和本地来源**

```js
const { currentQuestion, moveNext, movePrevious } = require('../../services/practice-session');
const { loadBank } = require('../../services/question-bank');

const question = currentQuestion(session);
const bank = loadBank(question.moduleKey || session.moduleKey);
const material = question.materialId ? bank.materials.find(({ id }) => id === question.materialId) : null;
this.setData({
  question,
  material,
  sources: Array.isArray(question.sourceRefs) ? question.sourceRefs : [],
  sourcesExpanded: false,
});

toggleSources() { this.setData({ sourcesExpanded: !this.data.sourcesExpanded }); },
copySource(event) {
  const source = this.data.sources[event.currentTarget.dataset.index];
  if (!source || !source.url) return;
  wx.setClipboardData({ data: source.url, success: () => wx.showToast({ title: '来源链接已复制', icon: 'none' }) });
},
```

来源行只在 `sources.length` 时渲染；展开后显示 `title`、`kind`、`publishedAt`，有 URL 的行绑定 `copySource`。

- [x] **Step 3: 实现前后题导航**

```js
previous() {
  const app = getApp();
  if (app.globalData.session.currentIndex === 0) { wx.navigateBack(); return; }
  app.globalData.session = movePrevious(app.globalData.session);
  wx.redirectTo({ url: '/pages/analysis/index' });
},
next() {
  const app = getApp();
  const session = app.globalData.session;
  if (session.currentIndex >= session.questions.length - 1) { wx.redirectTo({ url: '/pages/result/index' }); return; }
  app.globalData.session = moveNext(session);
  wx.redirectTo({ url: app.globalData.session.submitted ? '/pages/analysis/index' : '/pages/question/index' });
},
openCard() { wx.navigateTo({ url: '/pages/question-card/index' }); },
```

- [x] **Step 4: 改为全高滚动布局**

```xml
<view class="analysis-page">
  <app-header title="{{index}} / {{total}}" right-text="答题卡" bind:righttap="openCard"></app-header>
  <scroll-view class="analysis-scroll" scroll-y>
    <view class="analysis-content">
      <view wx:if="{{material}}" class="material">{{material.content}}</view>
      <view class="card question-summary"><view class="summary-stem">{{question.stem}}</view>
        <view class="option-line" wx:for="{{question.options}}" wx:key="key">{{item.key}}. {{item.text}}</view>
      </view>
      <view class="result-banner {{correct?'result-banner--correct':'result-banner--wrong'}}">{{correct?'回答正确':'回答错误'}}</view>
      <view class="card explanation"><view class="correct-answer">正确答案 <text>{{question.answer}}</text></view><view class="explanation-text">{{question.explanation}}</view></view>
      <view wx:if="{{sources.length}}" class="source-row" bindtap="toggleSources">{{sourcesExpanded?'收起题目来源':'查看本题来源'}}</view>
      <view wx:if="{{sourcesExpanded}}" class="source-list"><view wx:for="{{sources}}" wx:key="title" data-index="{{index}}" bindtap="copySource"><view>{{item.title}}</view><view class="muted">{{item.kind}} · {{item.publishedAt}}</view></view></view>
    </view>
  </scroll-view>
  <view class="actions"><view class="outline-button" bindtap="previous">{{index===1?'返回':'上一题'}}</view><view class="primary-button" bindtap="next">{{index===total?'完成练习':'下一题'}}</view></view>
</view>
```

```css
.analysis-page{height:100vh;display:flex;flex-direction:column;background:#fff}.analysis-scroll{flex:1;height:auto}.analysis-content{padding:22rpx 42rpx 190rpx}.summary-stem{line-height:1.75;white-space:pre-wrap}.option-line{margin-top:16rpx;line-height:1.6}.actions{position:fixed;left:42rpx;right:42rpx;bottom:24rpx;display:flex;gap:20rpx;background:#fff}
```

- [x] **Step 5: 运行结构和全量测试**

Run: `/Users/accs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/*.test.mjs`

Expected: 0 failures。

- [ ] **Step 6: 提交**

```bash
git add pages/analysis tests/miniprogram-structure.test.mjs
git commit -m "feat: add scrollable analysis sources and review navigation"
```

### Task 5: 个人中心指标独立导航

**Files:**
- Modify: `pages/profile/index.js`
- Modify: `pages/profile/index.wxml`
- Modify: `pages/profile/index.wxss`
- Modify: `tests/miniprogram-structure.test.mjs`

- [x] **Step 1: 添加导航失败测试**

```js
test('profile metrics have three distinct destinations', () => {
  const source = fs.readFileSync(path.join(root, 'pages/profile/index.js'), 'utf8');
  assert.match(source, /pages\/history\/index/);
  assert.match(source, /pages\/stats\/index/);
  assert.match(source, /pages\/favorites\/index/);
});
```

- [x] **Step 2: 实现三个处理器**

```js
openTotal() { wx.navigateTo({ url: '/pages/history/index' }); },
openAccuracy() { wx.navigateTo({ url: '/pages/stats/index' }); },
openFavorites() { wx.navigateTo({ url: '/pages/favorites/index' }); },
```

```xml
<view class="metrics">
  <view bindtap="openTotal"><text>累计</text><view>{{total}}<text>题</text></view></view>
  <view bindtap="openAccuracy"><text>正确率</text><view>{{accuracy}}<text>%</text></view></view>
  <view bindtap="openFavorites"><text>收藏</text><view>{{favorites}}<text>题</text></view></view>
</view>
```

```css
.metrics>view:active{background:rgba(25,184,138,.06)}
```

- [x] **Step 3: 运行结构测试**

Run: `/Users/accs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/miniprogram-structure.test.mjs`

Expected: PASS。

- [ ] **Step 4: 提交**

```bash
git add pages/profile tests/miniprogram-structure.test.mjs
git commit -m "fix: separate profile metric destinations"
```

### Task 6: 全量验证和开发者工具验收

**Files:**
- Modify: `design-qa.md`
- Modify: `docs/superpowers/plans/2026-06-20-question-review-navigation.md`

- [x] **Step 1: 运行全部测试**

Run: `/Users/accs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/*.test.mjs`

Expected: 0 failures。

- [x] **Step 2: 校验脚本和语法**

```bash
/Users/accs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/validate-question-banks.mjs
for f in app.js services/*.js pages/*/index.js components/*/index.js; do /Users/accs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --check "$f" || exit 1; done
```

Expected: 360 questions valid，所有 JS 退出码为 0。

- [x] **Step 3: 微信开发者工具验证**

在 iPhone 12/13 和一个窄屏模拟器验证：题号与答题卡不重叠胶囊；题卡未来题锁定；上一题回看不增加统计；解析可滚动到底；来源展开和复制成功；个人指标进入三个不同页面。

- [x] **Step 4: 更新 QA 记录**

在 `design-qa.md` 追加本轮设备、页面、交互和剩余差异；只有不存在 P0/P1/P2 时记录 `final result: passed`。
