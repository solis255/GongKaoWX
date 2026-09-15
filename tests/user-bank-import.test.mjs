import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { prepareUserBankImport, sha256 } = require('../services/user-bank-import.js');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function makeOptions(keys) {
  const textByKey = { A: '选项一', B: '选项二', C: '选项三', D: '选项四', E: '选项五' };
  return keys.map((key) => ({ key, text: textByKey[key] }));
}

function makeQuestion(id, stem = `题干 ${id}`) {
  return {
    id,
    category: '自定义分类',
    subtype: '专项',
    difficulty: 'unknown',
    stem,
    materialId: null,
    options: makeOptions(['A', 'B', 'C', 'D']),
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
  assert.deepEqual(prepared.bank.questions.map(({ options }) => options.length), [2, 3]);
  assert.equal(prepared.bank.questions[0].fingerprint.length, 64);
});

test('schema declares two to four ordered A-D options', () => {
  const schema = JSON.parse(fs.readFileSync(
    path.join(root, 'questions/user-bank-import.schema.json'),
    'utf8',
  ));
  const options = schema.$defs.question.properties.options;
  assert.equal(options.minItems, 2);
  assert.equal(options.maxItems, 4);
  assert.deepEqual(
    options.prefixItems.map((item) => item.properties.key.const),
    ['A', 'B', 'C', 'D'],
  );
  assert.equal(options.items, false);
});

test('imports a two-option single-choice question', () => {
  const question = { ...makeQuestion('two-single'), options: makeOptions(['A', 'B']), answer: 'B' };
  const prepared = prepareUserBankImport(makeBank([question]));
  assert.equal(prepared.canImport, true);
  assert.deepEqual(prepared.bank.questions[0].options.map(({ key }) => key), ['A', 'B']);
  assert.equal(prepared.bank.questions[0].answer, 'B');
});

test('imports a three-option single-choice question', () => {
  const question = {
    ...makeQuestion('three-single', '相同题干'),
    options: makeOptions(['A', 'B', 'C']),
    answer: 'C',
  };
  const prepared = prepareUserBankImport(makeBank([question]));
  const twoOptionVersion = prepareUserBankImport(makeBank([{
    ...makeQuestion('two-version', '相同题干'),
    options: makeOptions(['A', 'B']),
    answer: 'B',
  }]));
  assert.equal(prepared.canImport, true);
  assert.deepEqual(prepared.bank.questions[0].options.map(({ key }) => key), ['A', 'B', 'C']);
  assert.notEqual(
    prepared.bank.questions[0].fingerprint,
    twoOptionVersion.bank.questions[0].fingerprint,
  );
});

test('keeps four-option single-choice questions compatible', () => {
  const question = { ...makeQuestion('four-single'), answer: 'D' };
  const prepared = prepareUserBankImport(makeBank([question]));
  assert.equal(prepared.canImport, true);
  assert.equal(prepared.bank.questions[0].answer, 'D');
});

test('rejects C as the answer of a two-option question', () => {
  const question = { ...makeQuestion('two-invalid'), options: makeOptions(['A', 'B']), answer: 'C' };
  const prepared = prepareUserBankImport(makeBank([question]));
  assert.equal(prepared.canImport, false);
  assert.match(prepared.issues.join('\n'), /单选题答案必须是当前题目实际存在的选项之一/);
});

test('rejects D as the answer of a three-option question', () => {
  const question = { ...makeQuestion('three-invalid'), options: makeOptions(['A', 'B', 'C']), answer: 'D' };
  const prepared = prepareUserBankImport(makeBank([question]));
  assert.equal(prepared.canImport, false);
  assert.match(prepared.issues.join('\n'), /实际存在的选项/);
});

test('imports and naturally orders a three-option multiple-choice answer', () => {
  const question = {
    ...makeQuestion('three-multiple'),
    type: 'multiple-choice',
    options: makeOptions(['A', 'B', 'C']),
    answer: ['C', 'A'],
  };
  const prepared = prepareUserBankImport(makeBank([question]));
  assert.equal(prepared.canImport, true);
  assert.deepEqual(prepared.bank.questions[0].answer, ['A', 'C']);
});

test('rejects a multiple-choice answer that references a missing option', () => {
  const question = {
    ...makeQuestion('missing-multiple'),
    type: 'multiple-choice',
    options: makeOptions(['A', 'B', 'C']),
    answer: ['A', 'D'],
  };
  const prepared = prepareUserBankImport(makeBank([question]));
  assert.equal(prepared.canImport, false);
  assert.match(prepared.issues.join('\n'), /至少两个不重复且实际存在的选项/);
});

test('imports a two-option multiple-choice question using both answers', () => {
  const question = {
    ...makeQuestion('two-multiple'),
    type: 'multiple-choice',
    options: makeOptions(['A', 'B']),
    answer: ['B', 'A'],
  };
  const prepared = prepareUserBankImport(makeBank([question]));
  assert.equal(prepared.canImport, true);
  assert.deepEqual(prepared.bank.questions[0].answer, ['A', 'B']);
});

test('rejects a question with only one option', () => {
  const question = { ...makeQuestion('one-option'), options: makeOptions(['A']), answer: 'A' };
  const prepared = prepareUserBankImport(makeBank([question]));
  assert.equal(prepared.canImport, false);
  assert.match(prepared.issues.join('\n'), /选项必须为 2～4 个/);
});

test('rejects non-contiguous option keys', () => {
  for (const keys of [['A', 'C'], ['A', 'B', 'D']]) {
    const question = { ...makeQuestion(`gap-${keys.join('')}`), options: makeOptions(keys), answer: 'A' };
    const prepared = prepareUserBankImport(makeBank([question]));
    assert.equal(prepared.canImport, false);
    assert.match(prepared.issues.join('\n'), /顺序连续排列/);
  }
});

test('rejects option keys in the wrong order', () => {
  for (const keys of [['B', 'A'], ['A', 'C', 'B']]) {
    const question = { ...makeQuestion(`order-${keys.join('')}`), options: makeOptions(keys), answer: 'A' };
    const prepared = prepareUserBankImport(makeBank([question]));
    assert.equal(prepared.canImport, false);
    assert.match(prepared.issues.join('\n'), /顺序连续排列/);
  }
});

test('rejects options starting from B, repeated keys, and more than four choices', () => {
  for (const keys of [['B', 'C'], ['A', 'A'], ['A', 'B', 'C', 'D', 'E']]) {
    const question = { ...makeQuestion(`bounds-${keys.join('')}`), options: makeOptions(keys), answer: 'A' };
    const prepared = prepareUserBankImport(makeBank([question]));
    assert.equal(prepared.canImport, false);
    assert.match(prepared.issues.join('\n'), /选项必须为 2～4 个/);
  }
});

test('keeps empty and duplicate option text invalid', () => {
  const empty = makeOptions(['A', 'B']);
  empty[1].text = '';
  const emptyPrepared = prepareUserBankImport(makeBank([{
    ...makeQuestion('empty-option'), options: empty, answer: 'A',
  }]));
  assert.equal(emptyPrepared.canImport, false);
  assert.match(emptyPrepared.issues.join('\n'), /选项内容不能为空/);

  const duplicate = makeOptions(['A', 'B']);
  duplicate[1].text = duplicate[0].text;
  const duplicatePrepared = prepareUserBankImport(makeBank([{
    ...makeQuestion('duplicate-option'), options: duplicate, answer: 'A',
  }]));
  assert.equal(duplicatePrepared.canImport, false);
  assert.match(duplicatePrepared.issues.join('\n'), /选项内容不能重复/);
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
