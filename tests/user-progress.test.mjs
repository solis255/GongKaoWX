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
