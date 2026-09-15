import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  loadBank, pickQuestions, getQuestionById, pickMixedQuestions, isValidQuestion,
  configureQuestionBankStorage, listAllBanks, listSubjectSummaries,
} = require('../services/question-bank.js');
const { prepareUserBankImport } = require('../services/user-bank-import.js');
const { createUserBankStorage, createMemoryBankAdapter } = require('../services/user-bank-storage.js');
const { createSubjectStorage } = require('../services/subject-storage.js');

function createSubjectMemory() {
  const values = new Map();
  return { get: (key) => values.get(key), set: (key, value) => values.set(key, value) };
}

function sourceBank(title, stem) {
  return {
    version: 1, category: '自定义', title, questionCount: 2, materials: [],
    questions: [1, 2].map((number) => ({
      id: `question-00${number}`, category: '自定义', subtype: '专项', difficulty: 'unknown',
      stem: `${stem}${number}`, materialId: null,
      options: [
        { key: 'A', text: '甲' }, { key: 'B', text: '乙' },
        { key: 'C', text: '丙' }, { key: 'D', text: '丁' },
      ],
      answer: 'A', explanation: '', knowledgePoints: [], sourceRefs: [], status: 'draft',
    })),
  };
}

function configuredCatalog() {
  const bankStorage = createUserBankStorage(createMemoryBankAdapter(), { now: () => 1000, random: () => 0 });
  const subjectStorage = createSubjectStorage(createSubjectMemory(), { now: () => 1000, random: () => 0 });
  const law = subjectStorage.createSubject('法律');
  const education = subjectStorage.createSubject('教育');
  const lawBank = bankStorage.importBank(prepareUserBankImport(sourceBank('法律题库', '法律题')), { subjectId: law.id });
  const educationBank = bankStorage.importBank(prepareUserBankImport(sourceBank('教育题库', '教育题')), { subjectId: education.id });
  configureQuestionBankStorage(bankStorage, subjectStorage);
  return { law, education, lawBank, educationBank };
}

test('starts without built-in banks and rejects unknown bank ids', () => {
  configureQuestionBankStorage(null, null);
  assert.deepEqual(listAllBanks(), []);
  assert.throws(() => loadBank('legacy-verbal'), /unknown question bank/i);
});

test('lists private banks under custom subject summaries', () => {
  const catalog = configuredCatalog();
  assert.equal(listAllBanks().length, 2);
  assert.deepEqual(listSubjectSummaries().map(({ name, bankCount, questionCount }) => ({ name, bankCount, questionCount })), [
    { name: '法律', bankCount: 1, questionCount: 2 },
    { name: '教育', bankCount: 1, questionCount: 2 },
  ]);
  assert.equal(listAllBanks()[0].subjectId, catalog.law.id);
});

test('loads, searches and picks questions from private banks only', () => {
  const { lawBank } = configuredCatalog();
  const questions = loadBank(lawBank.id).questions;
  assert.equal(questions.length, 2);
  assert.deepEqual(pickQuestions(lawBank.id, 1, false).map(({ id }) => id), [questions[0].id]);
  assert.deepEqual(pickQuestions(lawBank.id, 2, false, [questions[0].id]).map(({ id }) => id), [questions[1].id]);
  assert.equal(getQuestionById(questions[0].id).moduleKey, lawBank.id);
  assert.equal(getQuestionById('missing-id'), undefined);
});

test('loads two- and three-option questions without filtering them out', () => {
  const source = sourceBank('可变选项题库', '可变题');
  source.questions[0].options = source.questions[0].options.slice(0, 2);
  source.questions[0].answer = 'B';
  source.questions[1].options = source.questions[1].options.slice(0, 3);
  source.questions[1].answer = 'C';
  const bankStorage = createUserBankStorage(createMemoryBankAdapter(), {
    now: () => 1000,
    random: () => 0,
  });
  const subjectStorage = createSubjectStorage(createSubjectMemory(), {
    now: () => 1000,
    random: () => 0,
  });
  const subject = subjectStorage.createSubject('判断推理');
  const manifest = bankStorage.importBank(prepareUserBankImport(source), { subjectId: subject.id });
  configureQuestionBankStorage(bankStorage, subjectStorage);

  const loaded = loadBank(manifest.id).questions;
  assert.deepEqual(loaded.map(({ options }) => options.length), [2, 3]);
  assert.deepEqual(loaded.map(({ answer }) => answer), ['B', 'C']);
});

test('picks balanced mixed questions from selected private banks', () => {
  const { lawBank, educationBank } = configuredCatalog();
  const picked = pickMixedQuestions(3, { moduleKeys: [lawBank.id, educationBank.id] });
  const counts = [lawBank.id, educationBank.id].map((id) => picked.filter(({ moduleKey }) => moduleKey === id).length);
  assert.equal(picked.length, 3);
  assert.ok(Math.max(...counts) - Math.min(...counts) <= 1);
  assert.deepEqual(pickMixedQuestions(0), []);
  assert.deepEqual(pickMixedQuestions(3, { moduleKeys: [] }), []);
  assert.throws(() => pickMixedQuestions(2, { moduleKeys: ['unknown'] }), /unknown question bank/i);
});

test('mixed picking defaults to all private banks and de-duplicates keys', () => {
  const { lawBank } = configuredCatalog();
  assert.equal(pickMixedQuestions(10).length, 4);
  assert.equal(pickMixedQuestions(10, { moduleKeys: [lawBank.id, lawBank.id] }).length, 2);
});

test('validates variable option counts and answers against the options actually present', () => {
  const base = {
    id: 'private-001', stem: '请选择正确选项',
    options: [{ key: 'A' }, { key: 'B' }, { key: 'C' }, { key: 'D' }],
  };
  assert.equal(isValidQuestion({ ...base, answer: 'A' }), true);
  assert.equal(isValidQuestion({ ...base, type: 'single-choice', answer: ['A', 'B'] }), false);
  assert.equal(isValidQuestion({ ...base, type: 'multiple-choice', answer: ['A', 'C'] }), true);
  assert.equal(isValidQuestion({ ...base, type: 'multiple-choice', answer: ['A'] }), false);
  assert.equal(isValidQuestion({ ...base, type: 'multiple-choice', answer: ['A', 'A'] }), false);

  const twoOptions = { ...base, options: [{ key: 'A' }, { key: 'B' }] };
  assert.equal(isValidQuestion({ ...twoOptions, answer: 'B' }), true);
  assert.equal(isValidQuestion({ ...twoOptions, answer: 'C' }), false);
  assert.equal(isValidQuestion({ ...twoOptions, type: 'multiple-choice', answer: ['B', 'A'] }), true);

  const threeOptions = { ...base, options: [{ key: 'A' }, { key: 'B' }, { key: 'C' }] };
  assert.equal(isValidQuestion({ ...threeOptions, answer: 'C' }), true);
  assert.equal(isValidQuestion({ ...threeOptions, answer: 'D' }), false);
  assert.equal(isValidQuestion({ ...threeOptions, type: 'multiple-choice', answer: ['A', 'C'] }), true);
  assert.equal(isValidQuestion({ ...threeOptions, type: 'multiple-choice', answer: ['A', 'D'] }), false);
  assert.equal(isValidQuestion({ ...base, options: [{ key: 'A' }], answer: 'A' }), false);
  assert.equal(isValidQuestion({ ...base, options: [{ key: 'A' }, { key: 'C' }], answer: 'A' }), false);
  assert.equal(isValidQuestion({
    ...base,
    options: [{ key: 'A' }, { key: 'B' }, { key: 'C' }, { key: 'D' }, { key: 'E' }],
    answer: 'A',
  }), false);
});
