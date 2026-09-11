import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { prepareUserBankImport, sha256 } = require('../services/user-bank-import.js');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function makeQuestion(id, stem = `题干 ${id}`) {
  return {
    id,
    category: '自定义分类',
    subtype: '专项',
    difficulty: 'unknown',
    stem,
    materialId: null,
    options: [
      { key: 'A', text: '选项一' },
      { key: 'B', text: '选项二' },
      { key: 'C', text: '选项三' },
      { key: 'D', text: '选项四' },
    ],
    answer: 'A',
    explanation: '',
    knowledgePoints: [],
    sourceRefs: [],
    status: 'draft',
  };
}

function makeBank(questions = [makeQuestion('question-001')]) {
  return {
    version: 1,
    category: '私人题库',
    title: '测试题库',
    description: '',
    questionCount: questions.length,
    materials: [],
    questions,
  };
}

test('computes the standard SHA-256 digest', () => {
  assert.equal(sha256('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

test('accepts the bundled private question bank example', () => {
  const source = fs.readFileSync(path.join(root, 'questions/user-bank-import.example.json'), 'utf8');
  const prepared = prepareUserBankImport(source);
  assert.equal(prepared.canImport, true);
  assert.deepEqual(prepared.summary, {
    total: 2, valid: 2, invalid: 0, duplicate: 0, crossBankDuplicate: 0,
  });
  assert.equal(prepared.bank.subject, '示例科目');
  assert.equal(prepared.bank.questions[0].fingerprint.length, 64);
});

test('keeps valid questions while reporting malformed and duplicate entries', () => {
  const invalid = { ...makeQuestion('question-002'), answer: 'E' };
  const duplicate = makeQuestion('question-003', '题干 question-001');
  const prepared = prepareUserBankImport(makeBank([
    makeQuestion('question-001'), invalid, duplicate,
  ]));
  assert.equal(prepared.canImport, true);
  assert.equal(prepared.summary.valid, 1);
  assert.equal(prepared.summary.invalid, 1);
  assert.equal(prepared.summary.duplicate, 1);
  assert.match(prepared.issues.join('\n'), /答案必须/);
  assert.match(prepared.duplicates.join('\n'), /重复/);
});

test('blocks an exact duplicate bank but allows cross-bank duplicate questions', () => {
  const initial = prepareUserBankImport(makeBank());
  const existing = [{
    name: '已导入题库',
    contentHash: initial.contentHash,
    questionFingerprints: initial.bank.questions.map(({ fingerprint }) => fingerprint),
    importedAtText: '2026-08-20',
  }];
  const exact = prepareUserBankImport(makeBank(), existing);
  assert.equal(exact.canImport, false);
  assert.match(exact.fatalErrors.join('\n'), /已导入/);
  const renamedSubject = makeBank();
  renamedSubject.subject = '另一个科目建议';
  assert.equal(prepareUserBankImport(renamedSubject, existing).canImport, false);

  const changed = makeBank([makeQuestion('question-001'), makeQuestion('question-002', '另一道题')]);
  const partial = prepareUserBankImport(changed, existing);
  assert.equal(partial.canImport, true);
  assert.equal(partial.summary.crossBankDuplicate, 1);
});

test('rejects invalid materials and unsupported fields', () => {
  const source = makeBank();
  source.unexpected = true;
  source.materials = [{ id: 'bad id', title: '', content: '', sourceRefs: [] }];
  const prepared = prepareUserBankImport(source);
  assert.equal(prepared.canImport, false);
  assert.match(prepared.fatalErrors.join('\n'), /未知字段/);
  assert.match(prepared.fatalErrors.join('\n'), /材料1/);
});

test('imports multiple-choice answers as a normalized option set', () => {
  const question = {
    ...makeQuestion('question-001'),
    type: 'multiple-choice',
    answer: ['D', 'B'],
  };
  const prepared = prepareUserBankImport(makeBank([question]));
  assert.equal(prepared.canImport, true);
  assert.equal(prepared.bank.questions[0].type, 'multiple-choice');
  assert.deepEqual(prepared.bank.questions[0].answer, ['B', 'D']);
});

test('rejects malformed multiple-choice answers and mismatched answer types', () => {
  for (const answer of ['A', ['A'], ['A', 'A'], ['A', 'E']]) {
    const question = {
      ...makeQuestion('question-001'),
      type: 'multiple-choice',
      answer,
    };
    const prepared = prepareUserBankImport(makeBank([question]));
    assert.equal(prepared.canImport, false);
    assert.match(prepared.issues.join('\n'), /多选题答案/);
  }
  const singleWithArray = {
    ...makeQuestion('question-001'),
    type: 'single-choice',
    answer: ['A', 'B'],
  };
  const prepared = prepareUserBankImport(makeBank([singleWithArray]));
  assert.equal(prepared.canImport, false);
  assert.match(prepared.issues.join('\n'), /单选题答案/);
});

export { makeBank };
