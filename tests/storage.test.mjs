import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createStorage } = require('../services/storage.js');

test('provides and persists a normalized local user profile', () => {
  const values = new Map();
  const adapter = {
    get: (key) => values.get(key),
    set: (key, value) => values.set(key, value),
  };
  const storage = createStorage(adapter);

  assert.deepEqual(storage.getUserProfile(), { nickname: '备考用户', avatarPath: '' });
  assert.deepEqual(storage.saveUserProfile({
    nickname: '  小林  ',
    avatarPath: '  wxfile://profile-avatar.jpg  ',
  }), {
    nickname: '小林',
    avatarPath: 'wxfile://profile-avatar.jpg',
  });
  assert.deepEqual(createStorage(adapter).getUserProfile(), {
    nickname: '小林',
    avatarPath: 'wxfile://profile-avatar.jpg',
  });
});

test('falls back safely from damaged user profile data', () => {
  const cases = [
    null,
    'invalid',
    [],
    {},
    { nickname: '   ', avatarPath: 42 },
    { nickname: '123456789012345678901', avatarPath: null },
  ];

  for (const stored of cases) {
    const storage = createStorage({
      get: (key) => (key === 'guokao_user_profile_v1' ? stored : undefined),
      set: () => undefined,
    });
    assert.deepEqual(storage.getUserProfile(), { nickname: '备考用户', avatarPath: '' });
  }
});

test('rejects invalid nicknames without overwriting an existing profile', () => {
  const values = new Map();
  const storage = createStorage({
    get: (key) => values.get(key),
    set: (key, value) => values.set(key, value),
  });
  storage.saveUserProfile({ nickname: '有效昵称', avatarPath: 'saved-avatar.jpg' });

  assert.throws(() => storage.saveUserProfile({ nickname: '   ' }), /1 and 20/);
  assert.throws(() => storage.saveUserProfile({ nickname: '123456789012345678901' }), /1 and 20/);
  assert.deepEqual(storage.getUserProfile(), { nickname: '有效昵称', avatarPath: 'saved-avatar.jpg' });
  assert.deepEqual(storage.saveUserProfile({ nickname: '新昵称', avatarPath: 42 }), {
    nickname: '新昵称',
    avatarPath: '',
  });
});

test('persists wrong answer ids without duplicates', () => {
  const values = new Map();
  const storage = createStorage({
    get: (key) => values.get(key),
    set: (key, value) => values.set(key, value),
  });
  storage.addWrongAnswer('verbal-001');
  storage.addWrongAnswer('verbal-001');
  storage.addWrongAnswer('verbal-002');
  assert.deepEqual(storage.getWrongAnswerIds(), ['verbal-001', 'verbal-002']);
});

test('records practice history and derives aggregate stats', () => {
  const values = new Map();
  const storage = createStorage({
    get: (key) => values.get(key),
    set: (key, value) => values.set(key, value),
  });
  storage.savePractice({ moduleKey: 'verbal', total: 20, correct: 16, elapsedMs: 1000 });
  storage.savePractice({ moduleKey: 'politics', total: 10, correct: 7, elapsedMs: 2000 });
  assert.deepEqual(storage.getStats(), { total: 30, correct: 23, accuracy: 77, elapsedMs: 3000 });
});

test('appends normalized answer events and validates daily goal', () => {
  const values = new Map();
  const storage = createStorage({
    get: (key) => values.get(key),
    set: (key, value) => values.set(key, value),
  });

  const saved = storage.saveAnswerEvent({
    questionId: 'verbal-001',
    moduleKey: 'verbal',
    userAnswer: 'B',
    correct: true,
    elapsedMs: 500,
  }, 1000);

  assert.equal(saved.answeredAt, 1000);
  assert.deepEqual(storage.getAnswerEvents(), [saved]);
  const multipleSaved = storage.saveAnswerEvent({
    questionId: 'private-001',
    moduleKey: 'user-bank-001',
    userAnswer: ['A', 'C'],
    correct: true,
    elapsedMs: 800,
  }, 2000);
  assert.deepEqual(multipleSaved.userAnswer, ['A', 'C']);
  assert.deepEqual(storage.getAnswerEvents(), [saved, multipleSaved]);
  assert.equal(storage.getDailyGoal(), 20);
  assert.equal(storage.saveDailyGoal(50), 50);
  assert.equal(storage.getDailyGoal(), 50);
  assert.throws(() => storage.saveDailyGoal(0), /1 and 200/);
  assert.throws(() => storage.saveDailyGoal(20.5), /1 and 200/);
});

test('filters invalid answer events and lets a new event supersede a legacy wrong id', () => {
  const values = new Map([
    ['guokao_answer_events', [{ questionId: 'valid-001', moduleKey: 'verbal', correct: false, answeredAt: 10 }, { questionId: 'broken' }]],
    ['guokao_wrong_answers', ['valid-001']],
  ]);
  const storage = createStorage({
    get: (key) => values.get(key),
    set: (key, value) => values.set(key, value),
  });

  assert.equal(storage.getAnswerEvents().length, 1);
  storage.saveAnswerEvent({ questionId: 'valid-001', moduleKey: 'verbal', correct: true }, 20);
  assert.deepEqual(storage.getWrongAnswerIds(), []);
});

test('stores favorite timestamps while preserving and migrating the id API', () => {
  const values = new Map([['guokao_favorites', ['legacy-001']]]);
  const storage = createStorage({
    get: (key) => values.get(key),
    set: (key, value) => values.set(key, value),
  });

  assert.deepEqual(storage.getFavorites(), [{ questionId: 'legacy-001', favoritedAt: 0 }]);
  storage.toggleFavorite('verbal-001', 1000);
  assert.deepEqual(storage.getFavoriteIds(), ['legacy-001', 'verbal-001']);
  assert.deepEqual(storage.getFavorites(), [
    { questionId: 'legacy-001', favoritedAt: 0 },
    { questionId: 'verbal-001', favoritedAt: 1000 },
  ]);
  storage.toggleFavorite('legacy-001', 2000);
  assert.deepEqual(storage.getFavoriteIds(), ['verbal-001']);
  assert.deepEqual(storage.getFavorites(), [{ questionId: 'verbal-001', favoritedAt: 1000 }]);
});

test('removes all learning data associated with a permanently deleted private bank', () => {
  const values = new Map();
  const storage = createStorage({
    get: (key) => values.get(key),
    set: (key, value) => values.set(key, value),
  });
  storage.toggleFavorite('user-bank:question-001', 1000);
  storage.saveAnswerEvent({
    questionId: 'user-bank:question-001', moduleKey: 'user-bank', correct: false,
  }, 1000);
  storage.saveAnswerEvent({ questionId: 'verbal-001', moduleKey: 'verbal', correct: true }, 1000);
  storage.savePractice({ moduleKey: 'user-bank', total: 1, correct: 0 });
  storage.savePractice({ moduleKey: 'verbal', total: 1, correct: 1 });

  storage.removeQuestionData(['user-bank:question-001'], 'user-bank');
  assert.deepEqual(storage.getFavoriteIds(), []);
  assert.deepEqual(storage.getAnswerEvents().map(({ questionId }) => questionId), ['verbal-001']);
  assert.deepEqual(storage.getHistory().map(({ moduleKey }) => moduleKey), ['verbal']);
});
