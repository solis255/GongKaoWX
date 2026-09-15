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
  getTodayCount,
  getTodaySubjectDistribution,
  getExamCountdown,
  getDailyActivity,
  getMonthActivity,
  shiftCalendarMonth,
} = require('../services/user-progress.js');

const at = (day, hour = 0) => new Date(2026, 5, day, hour).getTime();

const events = [
  { questionId: 'politics-001', moduleKey: 'politics', correct: false, answeredAt: at(16, 8) },
  { questionId: 'politics-001', moduleKey: 'politics', correct: true, answeredAt: at(20, 8) },
  { questionId: 'verbal-001', moduleKey: 'verbal', correct: false, answeredAt: at(20, 9) },
  { questionId: 'politics-002', moduleKey: 'politics', correct: true, answeredAt: at(20, 10) },
  { questionId: 'politics-002', moduleKey: 'politics', correct: true, answeredAt: at(20, 11) },
];

test('changes greeting across local-time periods', () => {
  assert.deepEqual(getGreeting(new Date(2026, 5, 20, 2)), { title: '夜深了', subtitle: '注意休息' });
  assert.deepEqual(getGreeting(new Date(2026, 5, 20, 8)), { title: '早上好', subtitle: '继续保持' });
  assert.deepEqual(getGreeting(new Date(2026, 5, 20, 12)), { title: '中午好', subtitle: '稳步前进' });
  assert.deepEqual(getGreeting(new Date(2026, 5, 20, 15)), { title: '下午好', subtitle: '保持专注' });
  assert.deepEqual(getGreeting(new Date(2026, 5, 20, 20)), { title: '晚上好', subtitle: '今天也有收获' });
});

test('builds a local calendar date card', () => {
  assert.deepEqual(getDateCard(new Date(2026, 5, 20, 15)), { month: 6, day: 20, weekday: '周六' });
});

test('counts distinct questions ever answered correctly per module', () => {
  assert.deepEqual(getModuleProgress(events), { politics: 2, verbal: 0 });
});

test('keeps only questions whose latest answer is wrong and tracks this-week reinforcement', () => {
  assert.deepEqual(getWrongSnapshot(events, new Date(2026, 5, 20, 12)), {
    wrongIds: ['verbal-001'],
    reinforcedIds: ['politics-001'],
  });
});

test('filters wrong and reinforced questions by module', () => {
  assert.deepEqual(getWrongSnapshot(events, new Date(2026, 5, 20, 12), 'verbal'), {
    wrongIds: ['verbal-001'],
    reinforcedIds: [],
  });
});

test('counts answer events from today in local time', () => {
  assert.equal(getTodayCount(events, new Date(2026, 5, 20, 23, 30)), 4);
});

test('aggregates today answer events by subject across multiple banks', () => {
  const now = new Date(2026, 5, 20, 12);
  const distributionEvents = [
    ...[8, 9].map((hour, index) => ({
      questionId: `a-${index}`, moduleKey: 'bank-A', correct: true, answeredAt: at(20, hour),
    })),
    { questionId: 'b-1', moduleKey: 'bank-B', correct: false, answeredAt: at(20, 10) },
    ...[11, 12, 13].map((hour, index) => ({
      questionId: `c-${index}`, moduleKey: 'bank-C', correct: true, answeredAt: at(20, hour),
    })),
    { questionId: 'yesterday', moduleKey: 'bank-A', correct: true, answeredAt: at(19, 23) },
  ];
  const banks = [
    { key: 'bank-A', subjectName: '判断推理' },
    { key: 'bank-B', subjectName: '言语理解' },
    { key: 'bank-C', subjectName: '判断推理', status: 'trash' },
  ];

  assert.deepEqual(getTodaySubjectDistribution(distributionEvents, banks, now), [
    { name: '判断推理', value: 5, percent: 83 },
    { name: '言语理解', value: 1, percent: 17 },
  ]);
});

test('groups unknown today modules under other without losing event counts', () => {
  const now = new Date(2026, 5, 20, 12);
  const distribution = getTodaySubjectDistribution([
    { questionId: 'known', moduleKey: 'known-bank', correct: true, answeredAt: at(20, 8) },
    { questionId: 'unknown-1', moduleKey: 'removed-bank', correct: false, answeredAt: at(20, 9) },
    { questionId: 'unknown-2', moduleKey: 'another-bank', correct: true, answeredAt: at(20, 10) },
  ], [{ key: 'known-bank', subjectName: '资料分析' }], now);

  assert.deepEqual(distribution, [
    { name: '其他', value: 2, percent: 67 },
    { name: '资料分析', value: 1, percent: 33 },
  ]);
  assert.equal(distribution.reduce((sum, item) => sum + item.value, 0), 3);
});

test('returns an empty subject distribution when today has no valid events', () => {
  assert.deepEqual(getTodaySubjectDistribution(events, [], new Date(2026, 5, 21, 12)), []);
  assert.deepEqual(getTodaySubjectDistribution(events, [], new Date('invalid')), []);
  assert.deepEqual(getTodaySubjectDistribution([
    { questionId: 'only', moduleKey: 'only-bank', correct: true, answeredAt: at(20, 8) },
  ], [{ key: 'only-bank', subjectName: '数量关系' }], new Date(2026, 5, 20, 12)), [
    { name: '数量关系', value: 1, percent: 100 },
  ]);
});

test('builds future and same-day exam countdowns from natural calendar days', () => {
  const config = { name: '2027 国考', date: '2026-11-29' };
  assert.deepEqual(getExamCountdown(config, new Date(2026, 10, 19, 23, 59)), {
    configured: true,
    name: '2027 国考',
    date: '2026-11-29',
    days: 10,
    state: 'future',
    text: '距离考试还有 10 天',
  });
  assert.equal(getExamCountdown(config, new Date(2026, 10, 28, 0, 1)).days, 1);
  assert.deepEqual(getExamCountdown(config, new Date(2026, 10, 29, 23, 59)), {
    configured: true,
    name: '2027 国考',
    date: '2026-11-29',
    days: 0,
    state: 'today',
    text: '考试就在今天',
  });
});

test('handles past, cross-month, cross-year, and unset exam countdowns', () => {
  assert.deepEqual(getExamCountdown(
    { name: '考试', date: '2026-11-29' },
    new Date(2026, 10, 30, 0, 1),
  ), {
    configured: true,
    name: '考试',
    date: '2026-11-29',
    days: 1,
    state: 'past',
    text: '考试已结束 1 天',
  });
  assert.equal(getExamCountdown(
    { name: '跨月考试', date: '2026-02-01' },
    new Date(2026, 0, 31, 23, 59),
  ).days, 1);
  assert.equal(getExamCountdown(
    { name: '跨年考试', date: '2027-01-01' },
    new Date(2026, 11, 31, 23, 59),
  ).days, 1);

  const unset = {
    configured: false,
    name: '',
    date: '',
    days: null,
    state: 'unset',
    text: '设置考试日期，开始倒计时',
  };
  assert.deepEqual(getExamCountdown(null, new Date(2026, 10, 20)), unset);
  assert.deepEqual(getExamCountdown({ name: '考试', date: '2026-02-29' }, new Date(2026, 1, 1)), unset);
  assert.deepEqual(getExamCountdown({ name: '', date: '2026-11-29' }, new Date(2026, 10, 20)), unset);
  assert.deepEqual(getExamCountdown({ name: '考试', date: '2026-11-29' }, new Date('invalid')), unset);
});

test('builds profile totals, accuracy, favorites, and consecutive study days', () => {
  const profileEvents = [
    { questionId: 'q1', moduleKey: 'verbal', correct: true, answeredAt: new Date(2026, 5, 18, 8).getTime() },
    { questionId: 'q2', moduleKey: 'verbal', correct: false, answeredAt: new Date(2026, 5, 19, 8).getTime() },
    { questionId: 'q3', moduleKey: 'verbal', correct: true, answeredAt: new Date(2026, 5, 20, 8).getTime() },
  ];
  assert.deepEqual(getProfileStats(profileEvents, ['q1', 'q3'], new Date(2026, 5, 20, 12)), {
    total: 3,
    correct: 2,
    accuracy: 67,
    favorites: 2,
    streak: 3,
  });
});

test('keeps the latest completed streak before today starts', () => {
  const profileEvents = [
    { questionId: 'q1', moduleKey: 'verbal', correct: true, answeredAt: new Date(2026, 5, 18, 8).getTime() },
    { questionId: 'q2', moduleKey: 'verbal', correct: true, answeredAt: new Date(2026, 5, 19, 8).getTime() },
  ];
  assert.equal(getProfileStats(profileEvents, [], new Date(2026, 5, 20, 8)).streak, 2);
});

test('aggregates and sorts per-question history by latest attempt', () => {
  assert.deepEqual(getHistoryRows(events), [
    {
      questionId: 'politics-002',
      moduleKey: 'politics',
      attemptCount: 2,
      wrongCount: 0,
      lastAnsweredAt: at(20, 11),
      latestCorrect: true,
    },
    {
      questionId: 'verbal-001',
      moduleKey: 'verbal',
      attemptCount: 1,
      wrongCount: 1,
      lastAnsweredAt: at(20, 9),
      latestCorrect: false,
    },
    {
      questionId: 'politics-001',
      moduleKey: 'politics',
      attemptCount: 2,
      wrongCount: 1,
      lastAnsweredAt: at(20, 8),
      latestCorrect: true,
    },
  ]);
});

test('treats non-array collections as empty', () => {
  assert.deepEqual(getModuleProgress(null), {});
  assert.deepEqual(getWrongSnapshot({}, new Date(2026, 5, 20)), { wrongIds: [], reinforcedIds: [] });
  assert.equal(getTodayCount('events', new Date(2026, 5, 20)), 0);
  assert.deepEqual(getProfileStats(undefined, 'favorites', new Date(2026, 5, 20)), {
    total: 0,
    correct: 0,
    accuracy: 0,
    favorites: 0,
    streak: 0,
  });
  assert.deepEqual(getHistoryRows(42), []);
});

test('ignores damaged entries inside an event array in every event-derived view', () => {
  const now = new Date(2026, 5, 20, 12);
  const validEvent = {
    questionId: 'valid-001',
    moduleKey: 'verbal',
    correct: false,
    answeredAt: new Date(2026, 5, 20, 8).getTime(),
  };
  const damagedEvents = [
    validEvent,
    null,
    {},
    { moduleKey: 'verbal', correct: true, answeredAt: validEvent.answeredAt },
    { questionId: 'missing-module', correct: true, answeredAt: validEvent.answeredAt },
    { questionId: 'infinite', moduleKey: 'verbal', correct: true, answeredAt: Infinity },
    { questionId: 'nan', moduleKey: 'verbal', correct: true, answeredAt: Number.NaN },
    { questionId: 'too-large', moduleKey: 'verbal', correct: true, answeredAt: 8_640_000_000_000_001 },
    { questionId: '   ', moduleKey: 'verbal', correct: true, answeredAt: validEvent.answeredAt },
    { questionId: 'blank-module', moduleKey: ' \t ', correct: true, answeredAt: validEvent.answeredAt },
    { questionId: 'missing-correct', moduleKey: 'verbal', answeredAt: validEvent.answeredAt },
    { questionId: 'string-false', moduleKey: 'verbal', correct: 'false', answeredAt: validEvent.answeredAt },
  ];

  assert.deepEqual(getModuleProgress(damagedEvents), { verbal: 0 });
  assert.deepEqual(getWrongSnapshot(damagedEvents, now, 'verbal'), {
    wrongIds: ['valid-001'],
    reinforcedIds: [],
  });
  assert.equal(getTodayCount(damagedEvents, now), 1);
  assert.deepEqual(getProfileStats(damagedEvents, [], now), {
    total: 1,
    correct: 0,
    accuracy: 0,
    favorites: 0,
    streak: 1,
  });
  assert.deepEqual(getHistoryRows(damagedEvents), [{
    questionId: 'valid-001',
    moduleKey: 'verbal',
    attemptCount: 1,
    wrongCount: 1,
    lastAnsweredAt: validEvent.answeredAt,
    latestCorrect: false,
  }]);
});

test('counts reinforcement at week start and now but excludes future answers', () => {
  const now = new Date(2026, 5, 20, 12);
  const weekStart = new Date(2026, 5, 15, 0).getTime();
  const boundaryEvents = [
    { questionId: 'at-start', moduleKey: 'politics', correct: false, answeredAt: weekStart - 1 },
    { questionId: 'at-start', moduleKey: 'politics', correct: true, answeredAt: weekStart },
    { questionId: 'at-now', moduleKey: 'politics', correct: false, answeredAt: weekStart + 1 },
    { questionId: 'at-now', moduleKey: 'politics', correct: true, answeredAt: now.getTime() },
    { questionId: 'future', moduleKey: 'politics', correct: false, answeredAt: weekStart + 2 },
    { questionId: 'future', moduleKey: 'politics', correct: true, answeredAt: now.getTime() + 1 },
  ];

  assert.deepEqual(getWrongSnapshot(boundaryEvents, now).reinforcedIds, ['at-start', 'at-now']);
});

test('excludes future events before deriving the latest wrong-answer snapshot', () => {
  const now = new Date(2026, 5, 20, 12);
  const snapshotEvents = [
    { questionId: 'currently-wrong', moduleKey: 'verbal', correct: false, answeredAt: now.getTime() - 1 },
    { questionId: 'currently-wrong', moduleKey: 'verbal', correct: true, answeredAt: now.getTime() + 1 },
    { questionId: 'future-wrong', moduleKey: 'verbal', correct: false, answeredAt: now.getTime() + 1 },
  ];

  assert.deepEqual(getWrongSnapshot(snapshotEvents, now), {
    wrongIds: ['currently-wrong'],
    reinforcedIds: [],
  });
});

test('uses empty time-derived results for an invalid now date', () => {
  const invalidNow = new Date('not-a-date');
  assert.deepEqual(getWrongSnapshot(events, invalidNow), { wrongIds: [], reinforcedIds: [] });
  assert.equal(getTodayCount(events, invalidNow), 0);
  assert.deepEqual(getProfileStats(events, [], invalidNow), {
    total: 5,
    correct: 3,
    accuracy: 60,
    favorites: 0,
    streak: 0,
  });
});

test('aggregates valid answer events by local day and ignores future calendar dates', () => {
  const now = new Date(2026, 8, 14, 12);
  const activity = getDailyActivity([
    { questionId: 'q1', moduleKey: 'verbal', correct: true, answeredAt: new Date(2026, 8, 13, 8).getTime() },
    { questionId: 'q2', moduleKey: 'verbal', correct: false, answeredAt: new Date(2026, 8, 13, 18).getTime() },
    { questionId: 'q3', moduleKey: 'data', correct: true, answeredAt: new Date(2026, 8, 14, 20).getTime() },
    { questionId: 'future', moduleKey: 'data', correct: true, answeredAt: new Date(2026, 8, 15, 8).getTime() },
    { questionId: '', moduleKey: 'data', correct: true, answeredAt: new Date(2026, 8, 14, 8).getTime() },
  ], now);

  assert.deepEqual(activity, {
    '2026-09-13': 2,
    '2026-09-14': 1,
  });
  assert.deepEqual(getDailyActivity([], new Date('invalid')), {});
});

test('builds a Monday-first month with daily counts and monthly summaries', () => {
  const now = new Date(2026, 8, 14, 12);
  const month = getMonthActivity([
    { questionId: 'q1', moduleKey: 'verbal', correct: true, answeredAt: new Date(2026, 8, 1, 8).getTime() },
    { questionId: 'q2', moduleKey: 'verbal', correct: false, answeredAt: new Date(2026, 8, 1, 9).getTime() },
    { questionId: 'q3', moduleKey: 'data', correct: true, answeredAt: new Date(2026, 8, 14, 8).getTime() },
    { questionId: 'outside', moduleKey: 'data', correct: true, answeredAt: new Date(2026, 7, 31, 8).getTime() },
    { questionId: 'future', moduleKey: 'data', correct: true, answeredAt: new Date(2026, 8, 20, 8).getTime() },
  ], 2026, 9, now);

  assert.equal(month.label, '2026年9月');
  assert.equal(month.days.length, 30);
  assert.equal(month.leadingDays, 1);
  assert.equal(month.trailingDays, 4);
  assert.equal(month.checkinDays, 2);
  assert.equal(month.totalQuestions, 3);
  assert.deepEqual(month.days[0], {
    key: '2026-09-01',
    day: 1,
    count: 2,
    checked: true,
    isToday: false,
    isFuture: false,
  });
  assert.equal(month.days[13].isToday, true);
  assert.equal(month.days[19].isFuture, true);
  assert.equal(month.days[19].checked, false);
});

test('uses correct February lengths for common and leap years', () => {
  const now = new Date(2026, 8, 14);
  assert.equal(getMonthActivity([], 2025, 2, now).days.length, 28);
  assert.equal(getMonthActivity([], 2024, 2, now).days.length, 29);
  assert.equal(getMonthActivity([], 2000, 2, now).days.length, 29);
  assert.equal(getMonthActivity([], 1900, 2, now).days.length, 28);
  assert.equal(getMonthActivity([], 2026, 13, now), null);
});

test('shifts calendar months across year boundaries', () => {
  assert.deepEqual(shiftCalendarMonth(2026, 12, 1), { year: 2027, month: 1 });
  assert.deepEqual(shiftCalendarMonth(2026, 1, -1), { year: 2025, month: 12 });
  assert.deepEqual(shiftCalendarMonth(2026, 6, 18), { year: 2027, month: 12 });
  assert.equal(shiftCalendarMonth(2026, 0, 1), null);
});
