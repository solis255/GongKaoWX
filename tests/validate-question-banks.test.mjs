import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  BANK_FILE_NAMES,
  validateBank,
  validateDirectory,
} from '../scripts/validate-question-banks.mjs';

function makeQuestion(index, difficulty) {
  return {
    id: `sample-${String(index).padStart(3, '0')}`,
    category: 'sample category',
    subtype: 'sample subtype',
    difficulty,
    stem: `Question ${index}`,
    materialId: null,
    options: [
      { key: 'A', text: 'Option A' },
      { key: 'B', text: 'Option B' },
      { key: 'C', text: 'Option C' },
      { key: 'D', text: 'Option D' },
    ],
    answer: 'B',
    explanation: 'A complete explanation.',
    knowledgePoints: ['sample point'],
    sourceRefs: [],
    status: 'draft',
  };
}

function makeValidBank(prefix = 'sample') {
  const difficulties = [
    ...Array(18).fill('easy'),
    ...Array(30).fill('medium'),
    ...Array(12).fill('hard'),
  ];
  const questions = difficulties.map((difficulty, offset) => ({
    ...makeQuestion(offset + 1, difficulty),
    id: `${prefix}-${String(offset + 1).padStart(3, '0')}`,
  }));
  return {
    version: 1,
    category: 'sample category',
    title: 'Sample question bank',
    questionCount: 60,
    materials: [],
    questions,
  };
}

test('accepts a valid 60-question four-option bank', () => {
  assert.deepEqual(validateBank(makeValidBank(), 'sample.json'), []);
});

test('rejects a bank whose questionCount differs from its questions', () => {
  const bank = makeValidBank();
  bank.questionCount = 59;
  assert.match(validateBank(bank, 'sample.json').join('\n'), /questionCount/);
});

test('requires exactly 60 questions', () => {
  const bank = makeValidBank();
  bank.questions.pop();
  bank.questionCount = 59;
  assert.match(validateBank(bank, 'sample.json').join('\n'), /60 questions/);
});

test('rejects duplicate and non-continuous IDs', () => {
  const duplicate = makeValidBank();
  duplicate.questions[1].id = duplicate.questions[0].id;
  assert.match(validateBank(duplicate, 'sample.json').join('\n'), /duplicate id/);

  const discontinuous = makeValidBank();
  discontinuous.questions[1].id = 'sample-099';
  assert.match(validateBank(discontinuous, 'sample.json').join('\n'), /continuous/);
});

test('requires exactly the non-empty A-D options', () => {
  const missing = makeValidBank();
  missing.questions[0].options.pop();
  assert.match(validateBank(missing, 'sample.json').join('\n'), /options must be A-D/);

  const empty = makeValidBank();
  empty.questions[0].options[0].text = ' ';
  assert.match(validateBank(empty, 'sample.json').join('\n'), /option A text/);
});

test('rejects an answer that is not one of A-D', () => {
  const bank = makeValidBank();
  bank.questions[0].answer = 'E';
  assert.match(validateBank(bank, 'sample.json').join('\n'), /answer/);
});

test('requires all bank and question fields', () => {
  const missingTitle = makeValidBank();
  delete missingTitle.title;
  assert.match(validateBank(missingTitle, 'sample.json').join('\n'), /title/);

  const missingExplanation = makeValidBank();
  missingExplanation.questions[0].explanation = '';
  assert.match(validateBank(missingExplanation, 'sample.json').join('\n'), /explanation/);

  const missingKnowledgePoints = makeValidBank();
  missingKnowledgePoints.questions[0].knowledgePoints = [];
  assert.match(validateBank(missingKnowledgePoints, 'sample.json').join('\n'), /knowledgePoints/);
});

test('requires an 18 easy, 30 medium, 12 hard distribution', () => {
  const bank = makeValidBank();
  bank.questions[0].difficulty = 'medium';
  assert.match(validateBank(bank, 'sample.json').join('\n'), /difficulty distribution/);
});

test('validates materialId references', () => {
  const bank = makeValidBank();
  bank.questions[0].materialId = 'material-001';
  assert.match(validateBank(bank, 'sample.json').join('\n'), /materialId/);

  bank.materials.push({
    id: 'material-001',
    title: 'Material title',
    content: 'Material content',
    sourceRefs: [],
  });
  assert.deepEqual(validateBank(bank, 'sample.json'), []);
});

test('validateDirectory requires all six banks and totals 360 questions', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'question-banks-'));
  t.after(() => rm(directory, { recursive: true, force: true }));

  let result = await validateDirectory(directory);
  assert.equal(result.totalQuestions, 0);
  assert.match(result.errors.join('\n'), /politics\.json.*missing/i);

  for (const fileName of BANK_FILE_NAMES) {
    const prefix = fileName.replace('.json', '');
    await writeFile(
      path.join(directory, fileName),
      `${JSON.stringify(makeValidBank(prefix), null, 2)}\n`,
      'utf8',
    );
  }

  result = await validateDirectory(directory);
  assert.deepEqual(result.errors, []);
  assert.equal(result.totalQuestions, 360);
  assert.equal(result.files.length, 6);
});

test('CLI validates one bank file and defaults to the question-bank directory', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'question-bank-cli-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const bankPath = path.join(directory, 'politics.json');
  await writeFile(bankPath, `${JSON.stringify(makeValidBank('politics'))}\n`, 'utf8');

  const single = spawnSync(process.execPath, [
    path.resolve('scripts/validate-question-banks.mjs'),
    bankPath,
  ], { encoding: 'utf8' });
  assert.equal(single.status, 0);
  assert.match(single.stdout, /politics\.json: 60 questions, valid/);

  const directoryDefault = spawnSync(process.execPath, [
    path.resolve('scripts/validate-question-banks.mjs'),
  ], { encoding: 'utf8' });
  assert.equal(directoryDefault.status, 1);
  assert.match(directoryDefault.stderr, /missing required bank file/);
});
