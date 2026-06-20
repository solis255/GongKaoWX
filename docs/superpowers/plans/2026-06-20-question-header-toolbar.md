# 答题顶部与题卡工具栏实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将答题卡入口移到底部，把返回入口改为稳定的圆形 UI，并让无答题事件的新用户错题数恒为 0。

**Architecture:** 共享 `app-header` 负责圆形返回 UI；答题页和解析页各自在底部工具栏提供题卡入口。首页与错题本仅消费答题事件推导的错题快照，不再读取旧错题 ID。

**Tech Stack:** 微信小程序原生框架、WXML/WXSS、CommonJS、Node.js 内置测试运行器。

---

### Task 1: 圆形返回按钮和顶部职责收敛

**Files:**
- Modify: `components/app-header/index.wxml`
- Modify: `components/app-header/index.wxss`
- Modify: `pages/question/index.wxml`
- Modify: `pages/question/index.wxss`
- Modify: `pages/analysis/index.wxml`
- Modify: `tests/miniprogram-structure.test.mjs`

- [x] **Step 1: 写失败结构测试**

```js
test('question headers use icon UI and do not place the card action at the top', () => {
  const componentMarkup = fs.readFileSync(path.join(root, 'components/app-header/index.wxml'), 'utf8');
  const componentStyle = fs.readFileSync(path.join(root, 'components/app-header/index.wxss'), 'utf8');
  const questionMarkup = fs.readFileSync(path.join(root, 'pages/question/index.wxml'), 'utf8');
  const analysisMarkup = fs.readFileSync(path.join(root, 'pages/analysis/index.wxml'), 'utf8');
  assert.match(componentMarkup, /back-button__arrow/);
  assert.match(componentStyle, /border-radius:\s*50%/);
  assert.doesNotMatch(questionMarkup, /question-head__card/);
  assert.doesNotMatch(analysisMarkup, /right-text="答题卡"/);
});
```

- [x] **Step 2: 运行并确认失败**

Run: `/Users/accs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/miniprogram-structure.test.mjs`

Expected: FAIL，缺少 `back-button__arrow`，且顶部仍含题卡入口。

- [x] **Step 3: 实现共享圆形返回按钮**

```xml
<view class="side side--left" bindtap="back" wx:if="{{canBack}}" aria-role="button" aria-label="返回">
  <view class="back-button"><text class="back-button__arrow">‹</text></view>
</view>
```

```css
.back-button{width:64rpx;height:64rpx;display:flex;align-items:center;justify-content:center;border-radius:50%;color:#273240;background:#f2f6f5;box-shadow:0 4rpx 14rpx rgba(24,67,77,.08)}
.back-button__arrow{margin-top:-4rpx;font-size:52rpx;line-height:1}
```

解析页的共享头部改为：

```xml
<app-header title="{{index}} / {{total}}"></app-header>
```

答题页删除 `.question-head__card` 节点和样式；左侧改为圆形按钮：

```xml
<view class="question-head__back" bindtap="previous" aria-role="button" aria-label="{{index===1?'返回':'上一题'}}"><text class="question-head__arrow">‹</text></view>
```

```css
.question-head__back{position:absolute;left:42rpx;bottom:8px;width:64rpx;height:64rpx;display:flex;align-items:center;justify-content:center;border-radius:50%;background:#f2f6f5;box-shadow:0 4rpx 14rpx rgba(24,67,77,.08)}
.question-head__arrow{margin-top:-4rpx;font-size:52rpx;line-height:1}
```

- [x] **Step 4: 运行结构测试**

Run: `/Users/accs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/miniprogram-structure.test.mjs`

Expected: PASS。

### Task 2: 底部题卡入口

**Files:**
- Modify: `pages/question/index.wxml`
- Modify: `pages/question/index.wxss`
- Modify: `pages/analysis/index.wxml`
- Modify: `pages/analysis/index.wxss`
- Modify: `tests/miniprogram-structure.test.mjs`

- [x] **Step 1: 写失败测试**

```js
test('question and analysis expose the card action in their bottom toolbars', () => {
  const questionMarkup = fs.readFileSync(path.join(root, 'pages/question/index.wxml'), 'utf8');
  const analysisMarkup = fs.readFileSync(path.join(root, 'pages/analysis/index.wxml'), 'utf8');
  assert.match(questionMarkup, /class="utility[^"].*bindtap="openCard"/s);
  assert.match(analysisMarkup, /class="card-action" bindtap="openCard"/);
});
```

- [x] **Step 2: 运行并确认失败**

Run: `/Users/accs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/miniprogram-structure.test.mjs`

Expected: FAIL，底部不存在两个题卡入口。

- [x] **Step 3: 实现答题页底部入口**

```xml
<view class="answer-bar">
  <view class="utility" bindtap="toggleFavorite"><text>{{favorite?'已收藏':'收藏'}}</text></view>
  <view class="utility utility--card" bindtap="openCard"><text>题卡</text></view>
  <button class="primary-button submit" disabled="{{!canSubmit}}" bindtap="submit">提交答案</button>
</view>
```

```css
.utility{width:78rpx;display:flex;align-items:center;justify-content:center;color:#7a8491;font-size:23rpx}.utility--card{color:#0ca77b}.submit{flex:1}
```

- [x] **Step 4: 实现解析页底部入口**

```xml
<view class="actions">
  <view class="outline-button" bindtap="previous">{{index===1?'返回':'上一题'}}</view>
  <view class="card-action" bindtap="openCard">题卡</view>
  <view class="primary-button" bindtap="next">{{index===total?'完成练习':'下一题'}}</view>
</view>
```

```css
.actions>.outline-button,.actions>.primary-button{flex:1}.card-action{width:92rpx;height:92rpx;display:flex;align-items:center;justify-content:center;border:2rpx solid #20b88d;border-radius:28rpx;color:#0ca77b;background:#fff;font-weight:600}
```

- [x] **Step 5: 运行结构测试**

Run: `/Users/accs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/miniprogram-structure.test.mjs`

Expected: PASS。

### Task 3: 新用户错题归零

**Files:**
- Modify: `pages/home/index.js`
- Modify: `pages/wrong/index.js`
- Modify: `tests/miniprogram-structure.test.mjs`

- [x] **Step 1: 写失败测试**

```js
test('home and wrong pages derive wrong answers only from answer events', () => {
  const home = fs.readFileSync(path.join(root, 'pages/home/index.js'), 'utf8');
  const wrong = fs.readFileSync(path.join(root, 'pages/wrong/index.js'), 'utf8');
  assert.doesNotMatch(home, /getWrongAnswerIds/);
  assert.doesNotMatch(wrong, /getWrongAnswerIds/);
});
```

- [x] **Step 2: 运行并确认失败**

Run: `/Users/accs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/miniprogram-structure.test.mjs`

Expected: FAIL，两个页面仍读取旧错题 ID。

- [x] **Step 3: 删除旧 ID 合并逻辑**

首页改为：

```js
const snapshot = getWrongSnapshot(events, now);
this.setData({ wrongCount: snapshot.wrongIds.length });
```

错题本改为：

```js
const wrongIds = new Set(getWrongSnapshot(events, new Date()).wrongIds);
```

删除 `answeredIds` 和 `storage.getWrongAnswerIds()` 相关变量。

- [x] **Step 4: 运行结构和进度测试**

Run: `/Users/accs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/miniprogram-structure.test.mjs tests/user-progress.test.mjs`

Expected: PASS。

### Task 4: 全量验证

**Files:**
- Modify: `design-qa.md`
- Modify: `docs/superpowers/plans/2026-06-20-question-header-toolbar.md`

- [x] **Step 1: 运行全部测试和校验**

```bash
/Users/accs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/*.test.mjs
/Users/accs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/validate-question-banks.mjs
```

Expected: 0 failures，360 questions valid。

- [x] **Step 2: 开发者工具验收**

验证答题页和解析页顶部不再出现题卡文字；圆形返回按钮位于胶囊下方；底部题卡可进入题号列表；无答题事件时首页错题数与错题本列表均为 0。

- [x] **Step 3: 更新 QA**

在 `design-qa.md` 记录本轮验证设备、顶部布局、底部题卡和空错题状态；没有 P0/P1/P2 时保持 `final result: passed`。
