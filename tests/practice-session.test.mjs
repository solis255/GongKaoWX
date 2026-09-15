import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  createSession,
  selectAnswer,
  submitAnswer,
  moveNext,
  movePrevious,
  jumpToQuestion,
  buildQuestionCard,
  summarizeSession,
} = require('../services/practice-session.js');

const questions = [
  { id: 'q-1', answer: 'B', options: [{ key: 'A' }, { key: 'B' }, { key: 'C' }, { key: 'D' }] },
  { id: 'q-2', answer: 'A', options: [{ key: 'A' }, { key: 'B' }, { key: 'C' }, { key: 'D' }] },
  { id: 'q-3', answer: 'C', options: [{ key: 'A' }, { key: 'B' }, { key: 'C' }, { key: 'D' }] },
];

const submitSelected = (session, answer) => submitAnswer(selectAnswer(session, answer), 100);

test('creates a session with no selected answer', () => {
  const session = createSession('verbal', questions, { autoWrong: true });
  assert.equal(session.currentIndex, 0);
  assert.equal(session.answers.length, 0);
  assert.equal(session.selectedAnswer, null);
});

test('selects and submits an answer with correctness metadata', () => {
  let session = createSession('verbal', questions);
  session = selectAnswer(session, 'B');
  session = submitAnswer(session, 42000);
  assert.deepEqual(session.answers[0], {
    questionId: 'q-1',
    userAnswer: 'B',
    correct: true,
    elapsedMs: 42000,
  });
  assert.equal(session.submitted, true);
});

test('does not submit before an answer is selected', () => {
  const session = createSession('verbal', questions);
  assert.throws(() => submitAnswer(session, 1000), /select an answer/i);
});

test('moves to the next question and summarizes results', () => {
  let session = createSession('verbal', questions);
  session = submitAnswer(selectAnswer(session, 'B'), 1000);
  session = moveNext(session);
  session = submitAnswer(selectAnswer(session, 'C'), 2000);
  const summary = summarizeSession(session);
  assert.equal(summary.total, 2);
  assert.equal(summary.correct, 1);
  assert.equal(summary.incorrect, 1);
  assert.equal(summary.accuracy, 50);
  assert.equal(summary.elapsedMs, 3000);
});

test('builds card states and blocks future questions', () => {
  let session = createSession('verbal', questions);
  session = submitSelected(session, 'B');
  session = moveNext(session);
  assert.deepEqual(buildQuestionCard(session).map(({ status, current, locked }) => ({ status, current, locked })), [
    { status: 'correct', current: false, locked: false },
    { status: 'current', current: true, locked: false },
    { status: 'locked', current: false, locked: true },
  ]);
  assert.throws(() => jumpToQuestion(session, 2), /locked/i);
});

test('restores answered state while moving backward and forward', () => {
  let session = createSession('verbal', questions);
  session = submitSelected(session, 'B');
  session = moveNext(session);
  session = submitSelected(session, 'C');
  session = moveNext(session);

  session = movePrevious(session);
  assert.equal(session.currentIndex, 1);
  assert.equal(session.selectedAnswer, 'C');
  assert.equal(session.submitted, true);

  session = jumpToQuestion(session, 2);
  assert.equal(session.selectedAnswer, null);
  assert.equal(session.submitted, false);
});

test('supports toggling and order-independent grading for multiple-choice answers', () => {
  const question = {
    id: 'multi-001',
    type: 'multiple-choice',
    options: [
      { key: 'A', text: 'A' }, { key: 'B', text: 'B' },
      { key: 'C', text: 'C' }, { key: 'D', text: 'D' },
    ],
    answer: ['A', 'C'],
  };
  let session = createSession('private', [question]);
  session = selectAnswer(session, ['C', 'A']);
  assert.deepEqual(session.selectedAnswer, ['A', 'C']);
  session = submitAnswer(session, 500);
  assert.deepEqual(session.answers[0].userAnswer, ['A', 'C']);
  assert.equal(session.answers[0].correct, true);
});

test('marks incomplete or extra multiple-choice selections wrong and rejects invalid arrays', () => {
  const question = {
    id: 'multi-002',
    type: 'multiple-choice',
    options: [
      { key: 'A', text: 'A' }, { key: 'B', text: 'B' },
      { key: 'C', text: 'C' }, { key: 'D', text: 'D' },
    ],
    answer: ['A', 'C'],
  };
  let session = createSession('private', [question]);
  assert.throws(() => selectAnswer(session, 'A'), /invalid answer/i);
  assert.throws(() => selectAnswer(session, ['A', 'E']), /invalid answer/i);
  session = selectAnswer(session, ['A']);
  session = submitAnswer(session);
  assert.equal(session.answers[0].correct, false);
});

test('grades two- and three-option questions without phantom choices', () => {
  const single = {
    id: 'two-option-single',
    options: [{ key: 'A' }, { key: 'B' }],
    answer: 'B',
  };
  let singleSession = createSession('private', [single]);
  assert.throws(() => selectAnswer(singleSession, 'C'), /invalid answer/i);
  singleSession = submitAnswer(selectAnswer(singleSession, 'B'));
  assert.equal(singleSession.answers[0].correct, true);

  const multiple = {
    id: 'three-option-multiple',
    type: 'multiple-choice',
    options: [{ key: 'A' }, { key: 'B' }, { key: 'C' }],
    answer: ['A', 'C'],
  };
  let multipleSession = createSession('private', [multiple]);
  multipleSession = submitAnswer(selectAnswer(multipleSession, ['C', 'A']));
  assert.deepEqual(multipleSession.answers[0].userAnswer, ['A', 'C']);
  assert.equal(multipleSession.answers[0].correct, true);
});
