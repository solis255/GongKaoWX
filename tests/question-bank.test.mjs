import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  listModules,
  loadBank,
  pickQuestions,
  getQuestionById,
  pickMixedQuestions,
  isValidQuestion,
} = require('../services/question-bank.js');

test('lists the six guokao modules in display order', () => {
  assert.deepEqual(
    listModules().map(({ key }) => key),
    ['politics', 'common-sense', 'verbal', 'quantitative', 'reasoning', 'data-analysis'],
  );
});

test('loads a local JSON bank and exposes all valid questions', () => {
  const bank = loadBank('verbal');
  assert.equal(bank.category, '言语理解与表达');
  assert.equal(bank.questions.length, 60);
  assert.equal(bank.questions[0].options.length, 4);
});

test('picks the requested number without mutating the source bank', () => {
  const original = loadBank('verbal').questions.map(({ id }) => id);
  const picked = pickQuestions('verbal', 10, false);
  assert.equal(picked.length, 10);
  assert.deepEqual(picked.map(({ id }) => id), original.slice(0, 10));
  assert.deepEqual(loadBank('verbal').questions.map(({ id }) => id), original);
});

test('rejects unknown modules', () => {
  assert.throws(() => loadBank('unknown'), /unknown module/i);
});

test('rejects malformed option entries without throwing', () => {
  const base = {
    id: 'test-001',
    stem: 'test stem',
    answer: 'A',
  };

  for (const malformed of [null, 'A', 1, true]) {
    assert.doesNotThrow(() => isValidQuestion({
      ...base,
      options: [{ key: 'A' }, { key: 'B' }, malformed, { key: 'D' }],
    }));
    assert.equal(isValidQuestion({
      ...base,
      options: [{ key: 'A' }, { key: 'B' }, malformed, { key: 'D' }],
    }), false);
  }
});

test('requires options to be an array of exactly four entries', () => {
  const base = {
    id: 'test-001',
    stem: 'test stem',
    answer: 'A',
  };
  const invalidOptions = [
    undefined,
    'A,B,C,D',
    { A: 'one', B: 'two', C: 'three', D: 'four' },
    [{ key: 'A' }, { key: 'B' }, { key: 'C' }],
    [{ key: 'A' }, { key: 'B' }, { key: 'C' }, { key: 'D' }, { key: 'E' }],
  ];

  for (const options of invalidOptions) {
    assert.doesNotThrow(() => isValidQuestion({ ...base, options }));
    assert.equal(isValidQuestion({ ...base, options }), false);
  }
});

test('finds questions across all six banks and includes their module keys', () => {
  for (const { key: moduleKey } of listModules()) {
    const expected = loadBank(moduleKey).questions[0];
    const question = getQuestionById(expected.id);
    assert.equal(question.id, expected.id);
    assert.equal(question.moduleKey, moduleKey);
  }
  assert.equal(getQuestionById('missing-id'), undefined);
});

test('picks an approximately balanced mixed set from selected modules', () => {
  const moduleKeys = ['politics', 'verbal', 'reasoning'];
  const picked = pickMixedQuestions(8, { moduleKeys });
  const counts = moduleKeys.map(
    (moduleKey) => picked.filter((question) => question.moduleKey === moduleKey).length,
  );

  assert.equal(picked.length, 8);
  assert.deepEqual([...new Set(picked.map(({ moduleKey }) => moduleKey))].sort(), moduleKeys.sort());
  assert.ok(Math.max(...counts) - Math.min(...counts) <= 1);
});

test('mixed picking defaults to all modules, excludes completed ids, and returns available count', () => {
  const firstByModule = listModules().map(({ key }) => loadBank(key).questions[0].id);
  const availableCount = listModules()
    .reduce((total, { questionCount }) => total + questionCount, 0) - firstByModule.length;
  const picked = pickMixedQuestions(400, { excludeIds: firstByModule });

  assert.equal(picked.length, availableCount);
  assert.equal(picked.some(({ id }) => firstByModule.includes(id)), false);
  assert.deepEqual(
    [...new Set(picked.map(({ moduleKey }) => moduleKey))].sort(),
    listModules().map(({ key }) => key).sort(),
  );
});

test('mixed picking returns an empty set when count is zero', () => {
  assert.deepEqual(pickMixedQuestions(0), []);
});

test('mixed picking floors fractional counts and preserves default and negative behavior', () => {
  assert.equal(pickMixedQuestions(2.9).length, 2);
  assert.equal(pickMixedQuestions().length, 20);
  assert.deepEqual(pickMixedQuestions(-1), []);
});

test('mixed picking returns an empty set for no selected modules', () => {
  assert.deepEqual(pickMixedQuestions(10, { moduleKeys: [] }), []);
});

test('mixed picking treats non-array module keys as the default module set', () => {
  const picked = pickMixedQuestions(6, { moduleKeys: 'verbal' });

  assert.deepEqual(
    [...new Set(picked.map(({ moduleKey }) => moduleKey))].sort(),
    listModules().map(({ key }) => key).sort(),
  );
});

test('mixed picking treats null options as the default options object', () => {
  const picked = pickMixedQuestions(6, null);

  assert.deepEqual(
    [...new Set(picked.map(({ moduleKey }) => moduleKey))].sort(),
    listModules().map(({ key }) => key).sort(),
  );
});

test('mixed picking de-duplicates repeated module keys and question ids', () => {
  const picked = pickMixedQuestions(120, { moduleKeys: ['verbal', 'verbal'] });

  assert.equal(picked.length, loadBank('verbal').questions.length);
  assert.equal(new Set(picked.map(({ id }) => id)).size, picked.length);
});

test('mixed picking rejects unknown module keys', () => {
  assert.throws(
    () => pickMixedQuestions(10, { moduleKeys: ['verbal', 'unknown'] }),
    /unknown module/i,
  );
});

test('mixed picking returns an empty set when every candidate is excluded', () => {
  const moduleKey = 'politics';
  const excludeIds = loadBank(moduleKey).questions.map(({ id }) => id);

  assert.deepEqual(pickMixedQuestions(10, { moduleKeys: [moduleKey], excludeIds }), []);
});

test('mixed picking shuffles the round-robin selection before returning it', () => {
  const originalRandom = Math.random;
  let randomCalls = 0;
  Math.random = () => {
    randomCalls += 1;
    return 0;
  };

  try {
    const picked = pickMixedQuestions(4, { moduleKeys: ['politics', 'verbal'] });
    assert.deepEqual(
      picked.map(({ id }) => id),
      ['verbal-001', 'politics-002', 'verbal-002', 'politics-001'],
    );
    assert.equal(randomCalls, 3);
  } finally {
    Math.random = originalRandom;
  }
});

test('pickQuestions remains compatible and supports excluding ids', () => {
  const questions = loadBank('verbal').questions;
  const picked = pickQuestions('verbal', 2, false, [questions[0].id]);

  assert.deepEqual(picked.map(({ id }) => id), [questions[1].id, questions[2].id]);
});
