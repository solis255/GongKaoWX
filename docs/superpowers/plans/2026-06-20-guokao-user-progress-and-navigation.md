# 国考刷题用户进度与导航改造实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用统一答题事件驱动首页、错题、收藏、练习记录和个人统计，区分模块与随机练习，并让所有页面自动避开微信胶囊按钮。

**Architecture:** `services/user-progress.js` 负责纯统计推导，`services/storage.js` 只负责持久化和兼容迁移，`services/question-bank.js` 负责题目选择。页面读取这些服务的视图模型，不再维护演示计数；新增目标、收藏和练习记录三个原生页面。

**Tech Stack:** 微信小程序原生框架、CommonJS、WXML、WXSS、Node.js 内置测试运行器。

---

## 文件结构

- Create: `services/user-progress.js` — 从答题事件推导问候、日期、模块进度、错题、巩固和个人统计。
- Create: `services/layout.js` — 计算胶囊安全区和导航高度。
- Modify: `services/storage.js` — 保存答题事件、每日目标和带时间的收藏记录。
- Modify: `services/question-bank.js` — 支持模块抽题、跨模块随机抽题、排除已做题和按 ID 回查。
- Modify: `app.js`, `app.json`, `app.wxss` — 初始化布局指标并注册新增页面。
- Modify: `components/app-header/*` — 使用动态导航高度。
- Modify: `pages/home/*`, `pages/bank/*`, `pages/practice-setup/*`, `pages/question/*`, `pages/wrong/*`, `pages/profile/*`, `pages/stats/*`。
- Create: `pages/goal/*`, `pages/favorites/*`, `pages/history/*`。
- Modify: `tests/storage.test.mjs`, `tests/question-bank.test.mjs`, `tests/miniprogram-structure.test.mjs`。
- Create: `tests/user-progress.test.mjs`, `tests/layout.test.mjs`。

### Task 1: 统一答题事件与统计推导

**Files:**
- Create: `tests/user-progress.test.mjs`
- Create: `services/user-progress.js`

- [x] **Step 1: 写失败测试**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const {
  getGreeting,
  getDateCard,
  getModuleProgress,
  getWrongSnapshot,
  getProfileStats,
  getHistoryRows,
} = require('../services/user-progress.js');

const events = [
  { questionId: 'politics-001', moduleKey: 'politics', correct: false, answeredAt: Date.parse('2026-06-16T08:00:00+08:00') },
  { questionId: 'politics-001', moduleKey: 'politics', correct: true, answeredAt: Date.parse('2026-06-20T08:00:00+08:00') },
  { questionId: 'verbal-001', moduleKey: 'verbal', correct: false, answeredAt: Date.parse('2026-06-20T09:00:00+08:00') },
];

test('changes greeting and date card by local time', () => {
  assert.equal(getGreeting(new Date('2026-06-20T15:00:00+08:00')).title, '下午好');
  assert.deepEqual(getDateCard(new Date('2026-06-20T15:00:00+08:00')), { month: 6, day: 20, weekday: '周六' });
});

test('counts distinct questions ever answered correctly per module', () => {
  assert.deepEqual(getModuleProgress(events), { politics: 1, verbal: 0 });
});

test('keeps only questions whose latest answer is wrong', () => {
  assert.deepEqual(getWrongSnapshot(events, new Date('2026-06-20T12:00:00+08:00')), {
    wrongIds: ['verbal-001'], reinforcedIds: ['politics-001']
  });
});

test('builds real profile stats and per-question history', () => {
  assert.deepEqual(getProfileStats(events, [], new Date('2026-06-20T12:00:00+08:00')), { total: 3, correct: 1, accuracy: 33, favorites: 0, streak: 1 });
  assert.equal(getHistoryRows(events)[0].wrongCount, 1);
});
```

- [x] **Step 2: 运行测试并确认失败**

Run: `/Users/accs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/user-progress.test.mjs`

Expected: FAIL，提示找不到 `services/user-progress.js`。

- [x] **Step 3: 实现纯统计服务**

```js
function getGreeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 5) return { title: '夜深了', subtitle: '注意休息' };
  if (hour < 12) return { title: '早上好', subtitle: '继续保持' };
  if (hour < 14) return { title: '中午好', subtitle: '稳步前进' };
  if (hour < 19) return { title: '下午好', subtitle: '保持专注' };
  return { title: '晚上好', subtitle: '今天也有收获' };
}

function latestByQuestion(events) {
  const latest = new Map();
  [...events].sort((a, b) => a.answeredAt - b.answeredAt).forEach((event) => latest.set(event.questionId, event));
  return latest;
}

function getModuleProgress(events) {
  const result = {};
  for (const event of Array.isArray(events) ? events : []) {
    if (!event.correct || !event.moduleKey || !event.questionId) continue;
    if (!result[event.moduleKey]) result[event.moduleKey] = new Set();
    result[event.moduleKey].add(event.questionId);
  }
  return Object.fromEntries(Object.entries(result).map(([key, ids]) => [key, ids.size]));
}

function getDateCard(date = new Date()) {
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return { month: date.getMonth() + 1, day: date.getDate(), weekday: weekdays[date.getDay()] };
}

function dayKey(timestamp) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function startOfWeek(now) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start.getTime();
}

function getWrongSnapshot(events, now = new Date(), moduleKey) {
  const source = (Array.isArray(events) ? events : [])
    .filter((event) => !moduleKey || event.moduleKey === moduleKey)
    .sort((a, b) => a.answeredAt - b.answeredAt);
  const latest = latestByQuestion(source);
  const everWrong = new Set();
  const reinforced = new Set();
  const weekStart = startOfWeek(now);
  for (const event of source) {
    if (!event.correct) everWrong.add(event.questionId);
    if (event.correct && event.answeredAt >= weekStart && everWrong.has(event.questionId)) reinforced.add(event.questionId);
  }
  return {
    wrongIds: [...latest.values()].filter((event) => !event.correct).map((event) => event.questionId),
    reinforcedIds: [...reinforced],
  };
}

function getHistoryRows(events) {
  const rows = new Map();
  for (const event of Array.isArray(events) ? events : []) {
    const row = rows.get(event.questionId) || { questionId: event.questionId, moduleKey: event.moduleKey, attemptCount: 0, wrongCount: 0 };
    row.attemptCount += 1;
    if (!event.correct) row.wrongCount += 1;
    if (!row.lastAnsweredAt || event.answeredAt >= row.lastAnsweredAt) {
      row.lastAnsweredAt = event.answeredAt;
      row.latestCorrect = Boolean(event.correct);
    }
    rows.set(event.questionId, row);
  }
  return [...rows.values()].sort((a, b) => b.lastAnsweredAt - a.lastAnsweredAt);
}

function getTodayCount(events, now = new Date()) {
  const today = dayKey(now.getTime());
  return (Array.isArray(events) ? events : []).filter((event) => dayKey(event.answeredAt) === today).length;
}

function getProfileStats(events, favoriteIds, now = new Date()) {
  const source = Array.isArray(events) ? events : [];
  const studiedDays = new Set(source.map((event) => dayKey(event.answeredAt)));
  let streak = 0;
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  while (studiedDays.has(dayKey(cursor.getTime()))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  const correct = source.filter((event) => event.correct).length;
  return {
    total: source.length,
    correct,
    accuracy: source.length ? Math.round(correct / source.length * 100) : 0,
    favorites: Array.isArray(favoriteIds) ? favoriteIds.length : 0,
    streak,
  };
}

module.exports = { getGreeting, getDateCard, getModuleProgress, getWrongSnapshot, getProfileStats, getHistoryRows, getTodayCount };
```

- [x] **Step 4: 运行测试并确认通过**

Run: `/Users/accs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/user-progress.test.mjs`

Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add services/user-progress.js tests/user-progress.test.mjs
git commit -m "feat: derive user progress from answer events"
```

### Task 2: 持久化答题事件、每日目标和收藏时间

**Files:**
- Modify: `tests/storage.test.mjs`
- Modify: `services/storage.js`
- Modify: `pages/question/index.js`

- [x] **Step 1: 扩展失败测试**

```js
test('appends normalized answer events and validates daily goal', () => {
  const values = new Map();
  const storage = createStorage({ get: (key) => values.get(key), set: (key, value) => values.set(key, value) });
  storage.saveAnswerEvent({ questionId: 'verbal-001', moduleKey: 'verbal', userAnswer: 'B', correct: true, elapsedMs: 500 });
  assert.equal(storage.getAnswerEvents().length, 1);
  assert.equal(storage.getDailyGoal(), 20);
  assert.equal(storage.saveDailyGoal(50), 50);
  assert.throws(() => storage.saveDailyGoal(0), /1 and 200/);
});

test('stores favorite timestamps while preserving the id API', () => {
  const values = new Map();
  const storage = createStorage({ get: (key) => values.get(key), set: (key, value) => values.set(key, value) });
  storage.toggleFavorite('verbal-001', 1000);
  assert.deepEqual(storage.getFavoriteIds(), ['verbal-001']);
  assert.deepEqual(storage.getFavorites(), [{ questionId: 'verbal-001', favoritedAt: 1000 }]);
});
```

- [x] **Step 2: 运行并确认失败**

Run: `/Users/accs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/storage.test.mjs`

Expected: FAIL，提示新方法不存在。

- [x] **Step 3: 实现存储 API 和兼容迁移**

新增键：

```js
attempts: 'guokao_answer_events',
dailyGoal: 'guokao_daily_goal',
favoriteRecords: 'guokao_favorite_records'
```

`getAnswerEvents()` 过滤缺失 `questionId/moduleKey/answeredAt` 的记录；`saveAnswerEvent()` 自动补 `answeredAt: Date.now()`；`getDailyGoal()` 返回合法值或 20；`saveDailyGoal()` 只接受 1–200 整数。`getFavorites()` 将旧收藏 ID 迁移成 `{ questionId, favoritedAt: 0 }`。保留现有 `getWrongIds()` 作为旧版本兼容入口：只有尚无新答题事件的旧错题 ID 会参与错题页展示，一旦该题产生新事件，最新事件状态接管并从旧集合删除。

- [x] **Step 4: 答题提交时立即记录事件**

在 `pages/question/index.js` 的 `submit()` 中，调用：

```js
app.globalData.storage.saveAnswerEvent({
  questionId: record.questionId,
  moduleKey: app.globalData.session.moduleKey,
  userAnswer: record.userAnswer,
  correct: record.correct,
  elapsedMs: record.elapsedMs,
});
```

- [x] **Step 5: 运行存储和会话测试**

Run: `/Users/accs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/storage.test.mjs tests/practice-session.test.mjs`

Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add services/storage.js pages/question/index.js tests/storage.test.mjs
git commit -m "feat: persist answer events and daily goal"
```

### Task 3: 区分模块练习与综合随机练习

**Files:**
- Modify: `tests/question-bank.test.mjs`
- Modify: `services/question-bank.js`
- Modify: `pages/bank/index.js`
- Modify: `pages/bank/index.wxml`
- Modify: `pages/practice-setup/index.js`
- Modify: `pages/practice-setup/index.wxml`

- [x] **Step 1: 写混合抽题失败测试**

```js
test('picks a mixed random set from selected modules and excludes completed ids', () => {
  const picked = pickMixedQuestions(12, { moduleKeys: ['politics', 'verbal', 'judgment', 'data'], excludeIds: ['politics-001'] });
  assert.equal(picked.length, 12);
  assert.equal(picked.some(({ id }) => id === 'politics-001'), false);
  assert.deepEqual([...new Set(picked.map(({ moduleKey }) => moduleKey))].sort(), ['data', 'judgment', 'politics', 'verbal']);
});

test('finds questions by id across banks', () => {
  assert.equal(getQuestionById('verbal-001').moduleKey, 'verbal');
});
```

- [x] **Step 2: 运行并确认失败**

Run: `/Users/accs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/question-bank.test.mjs`

Expected: FAIL，提示 `pickMixedQuestions` 和 `getQuestionById` 不存在。

- [x] **Step 3: 实现题库选择 API**

`getQuestionById(id)` 返回附带 `moduleKey` 的题目；`pickMixedQuestions(count, options)` 仅从 `options.moduleKeys`（缺省为全部模块）按模块轮询取题、过滤 `excludeIds` 后打乱；`pickQuestions()` 保持单模块行为并支持排除 ID。混合题量不足时返回实际可用题目，零题时返回空数组交由页面提示。

- [x] **Step 4: 让题库标签改变真实行为**

模块模式点击条目设置：

```js
app.globalData.practiceMode = 'module';
app.globalData.moduleKey = moduleKey;
```

随机模式点击顶部“随机练习”或推荐入口设置：

```js
app.globalData.practiceMode = 'mixed';
app.globalData.moduleKey = null;
wx.navigateTo({ url: '/pages/practice-setup/index?mode=mixed' });
```

设置页根据 `mode` 显示“综合随机练习”，并提供六个模块的多选范围，默认全选且至少保留一个；在 `start()` 中把选中的 `moduleKeys` 传给 `pickMixedQuestions()`。`onlyNew` 使用答题事件 ID 作为排除集合。可用题量少于请求题量时先提示“将开始 N 题”，为 0 时阻止开始并提示关闭“只练未做题”。

- [x] **Step 5: 运行测试**

Run: `/Users/accs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/question-bank.test.mjs tests/practice-session.test.mjs`

Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add services/question-bank.js pages/bank pages/practice-setup tests/question-bank.test.mjs
git commit -m "feat: separate module and mixed practice modes"
```

### Task 4: 动态胶囊安全区

**Files:**
- Create: `tests/layout.test.mjs`
- Create: `services/layout.js`
- Modify: `app.js`
- Modify: `app.wxss`
- Modify: `components/app-header/index.js`
- Modify: `components/app-header/index.wxml`
- Modify: `components/app-header/index.wxss`
- Modify: `pages/home/index.wxml`, `pages/bank/index.wxml`, `pages/wrong/index.wxml`, `pages/profile/index.wxml`

- [x] **Step 1: 写布局计算失败测试**

```js
test('places content below the WeChat menu capsule', () => {
  assert.deepEqual(
    computeLayoutMetrics({ statusBarHeight: 47, screenWidth: 430 }, { top: 55, bottom: 87, height: 32 }),
    { statusBarHeight: 47, capsuleTop: 55, capsuleHeight: 32, navHeight: 95, contentTop: 103 }
  );
});
```

- [x] **Step 2: 运行并确认失败**

Run: `/Users/accs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/layout.test.mjs`

Expected: FAIL，提示找不到 `services/layout.js`。

- [x] **Step 3: 实现布局指标并注入页面**

```js
function computeLayoutMetrics(windowInfo, capsule) {
  const statusBarHeight = windowInfo.statusBarHeight || 20;
  const capsuleTop = capsule?.top || statusBarHeight + 8;
  const capsuleHeight = capsule?.height || 32;
  const navHeight = capsuleTop + capsuleHeight + (capsuleTop - statusBarHeight);
  return { statusBarHeight, capsuleTop, capsuleHeight, navHeight, contentTop: navHeight + 8 };
}
```

`app.onLaunch()` 保存 `globalData.layout`。`app-header` 用属性接收 `navHeight`，一级页面根容器使用 `style="padding-top: {{layout.contentTop}}px"`，删除固定 `.safe-top`。

- [x] **Step 4: 运行布局测试与页面结构测试**

Run: `/Users/accs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/layout.test.mjs tests/miniprogram-structure.test.mjs`

Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add services/layout.js tests/layout.test.mjs app.js app.wxss components/app-header pages/home/index.wxml pages/bank/index.wxml pages/wrong/index.wxml pages/profile/index.wxml
git commit -m "fix: respect WeChat capsule safe area"
```

### Task 5: 首页与每日目标设置

**Files:**
- Modify: `app.json`
- Modify: `pages/home/index.js`, `pages/home/index.wxml`, `pages/home/index.wxss`
- Create: `pages/goal/index.js`, `pages/goal/index.json`, `pages/goal/index.wxml`, `pages/goal/index.wxss`
- Modify: `tests/miniprogram-structure.test.mjs`

- [x] **Step 1: 扩展路由失败测试**

在页面列表期望值中加入 `pages/goal/index`，运行结构测试并确认缺少页面文件。

- [x] **Step 2: 用真实视图模型替换首页演示值**

`onShow()` 读取答题事件、每日目标和当前时间，设置：

```js
const moduleProgress = getModuleProgress(events);
const todayDone = getTodayCount(events, now);
const todayGoal = storage.getDailyGoal();
this.setData({
  greeting: getGreeting(now),
  dateCard: getDateCard(now),
  todayDone,
  todayGoal,
  todayProgress: Math.min(100, Math.round(todayDone / todayGoal * 100)),
  modules: listModules().map((module) => ({
    ...module,
    done: moduleProgress[module.key] || 0,
    progress: Math.round((moduleProgress[module.key] || 0) / module.questionCount * 100),
  })),
});
```

目标卡点击 `/pages/goal/index`，日期卡显示月、日、星期。

- [x] **Step 3: 实现目标设置页**

页面提供 10、20、30、50 四个选项和数字输入。保存时调用 `storage.saveDailyGoal()`，成功后 `navigateBack()`；非法值在页面显示“请输入 1–200 的整数”。

- [x] **Step 4: 运行结构、统计和存储测试**

Run: `/Users/accs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/miniprogram-structure.test.mjs tests/user-progress.test.mjs tests/storage.test.mjs`

Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add app.json pages/home pages/goal tests/miniprogram-structure.test.mjs
git commit -m "feat: add dynamic home dashboard and daily goal"
```

### Task 6: 真实错题本和分类空状态

**Files:**
- Modify: `pages/wrong/index.js`, `pages/wrong/index.wxml`, `pages/wrong/index.wxss`
- Modify: `tests/user-progress.test.mjs`

- [x] **Step 1: 添加分类与巩固测试**

```js
test('filters wrong and reinforced ids by module', () => {
  const snapshot = getWrongSnapshot(events, new Date('2026-06-20T12:00:00+08:00'), 'politics');
  assert.deepEqual(snapshot.wrongIds, []);
  assert.deepEqual(snapshot.reinforcedIds, ['politics-001']);
});
```

- [x] **Step 2: 运行并确认现有实现不满足过滤口径**

Run: `/Users/accs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/user-progress.test.mjs`

Expected: FAIL。

- [x] **Step 3: 删除演示错题并实现真实视图**

`onShow()` 从答题事件生成错题，并合并“尚无新事件接管”的合法旧错题 ID；`filter()` 重新计算当前模块的 `items`、`wrongCount`、`reinforcedCount`、`emptyTitle` 和 `actionText`。题库中已失效的旧 ID 直接忽略。无错题时不渲染列表：

```xml
<view wx:if="{{items.length}}" class="wrong-list">...</view>
<view wx:else class="empty-state">
  <view class="empty-state__title">{{emptyTitle}}</view>
  <view class="muted">继续练习，系统会自动记录需要巩固的题目</view>
</view>
```

按钮根据状态执行错题练习、模块专项练习或返回题库。

- [x] **Step 4: 运行测试**

Run: `/Users/accs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/user-progress.test.mjs tests/miniprogram-structure.test.mjs`

Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add pages/wrong tests/user-progress.test.mjs
git commit -m "fix: drive wrong answers from real attempts"
```

### Task 7: 个人中心、收藏和练习记录

**Files:**
- Modify: `app.json`
- Modify: `pages/profile/index.js`, `pages/profile/index.wxml`, `pages/profile/index.wxss`
- Create: `pages/favorites/index.js`, `pages/favorites/index.json`, `pages/favorites/index.wxml`, `pages/favorites/index.wxss`
- Create: `pages/history/index.js`, `pages/history/index.json`, `pages/history/index.wxml`, `pages/history/index.wxss`
- Modify: `tests/miniprogram-structure.test.mjs`, `tests/user-progress.test.mjs`

- [x] **Step 1: 添加路由和练习记录失败测试**

在结构测试期望页面中加入 `pages/favorites/index` 和 `pages/history/index`。在统计测试中断言相同题目三次作答聚合为一行，`attemptCount === 3`、`wrongCount === 2`、`latestCorrect === true`。在存储测试中先后收藏两道题，断言 `getFavorites()` 保留时间戳；取消其中一道后，断言仅剩另一道且 `getFavoriteIds()` 与记录数组一致。

- [x] **Step 2: 运行并确认失败**

Run: `/Users/accs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/miniprogram-structure.test.mjs tests/user-progress.test.mjs`

Expected: FAIL。

- [x] **Step 3: 改造个人中心真实统计和菜单路由**

使用 `getProfileStats(storage.getAnswerEvents(), storage.getFavoriteIds())`；无数据保持 0。菜单映射：学习目标 → `/pages/goal/index`，练习记录 → `/pages/history/index`，我的收藏 → `/pages/favorites/index`。

- [x] **Step 4: 实现收藏列表**

用 `storage.getFavorites()` 与 `getQuestionById()` 合并数据，按 `favoritedAt` 倒序。取消收藏后立即刷新；点击题目用该题创建单题会话；空状态跳转题库。

- [x] **Step 5: 实现练习记录**

用 `getHistoryRows()` 生成逐题聚合，合并题干和模块信息，显示作答次数、错误次数、最后时间和最新状态。点击行创建单题会话。

- [x] **Step 6: 运行测试**

Run: `/Users/accs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/miniprogram-structure.test.mjs tests/user-progress.test.mjs tests/storage.test.mjs`

Expected: PASS。

- [ ] **Step 7: 提交**

```bash
git add app.json pages/profile pages/favorites pages/history tests/miniprogram-structure.test.mjs tests/user-progress.test.mjs
git commit -m "feat: add favorites and per-question practice history"
```

### Task 8: 全库验证和开发者工具验收

**Files:**
- Modify: `design-qa.md`
- Modify: `docs/superpowers/plans/2026-06-20-guokao-user-progress-and-navigation.md` — 勾选已完成步骤。

- [x] **Step 1: 同步小程序题库模块**

Run: `/Users/accs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/sync-question-modules.mjs`

Expected: 六个 JS 模块各输出 `60 questions`。

- [x] **Step 2: 运行全部测试**

Run: `/Users/accs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/*.test.mjs`

Expected: 0 failures。

- [x] **Step 3: 运行题库校验**

Run: `/Users/accs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/validate-question-banks.mjs`

Expected: 六套题库、360 题全部 valid。

- [x] **Step 4: 开发者工具交互验证**

在 iPhone 12/13 模拟器和当前真机调试环境依次验证：首页不遮胶囊；日期和问候正确；目标保存回显；新用户统计为 0；模块与随机练习来源不同；错误后出现错题、答对后移除；收藏页可取消；记录页错误次数正确。

- [x] **Step 5: 视觉 QA**

捕获首页、题库、错题、我的、目标、收藏和记录页面。对照 `design/screens/`，在 `design-qa.md` 记录字体、间距、颜色、图片、文案和剩余差异，修复所有 P0/P1/P2 后将 `final result` 改为 `passed`。

- [ ] **Step 6: 提交验收结果**

```bash
git add design-qa.md docs/superpowers/plans/2026-06-20-guokao-user-progress-and-navigation.md
git commit -m "test: verify user progress overhaul"
```
