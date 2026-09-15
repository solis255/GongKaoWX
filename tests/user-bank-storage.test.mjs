import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { prepareUserBankImport } = require('../services/user-bank-import.js');
const {
  createUserBankStorage,
  createMemoryBankAdapter,
  createFileBankAdapter,
} = require('../services/user-bank-storage.js');

function sourceBank() {
  return {
    version: 1,
    category: '私人题库',
    title: '存储测试',
    description: '说明',
    questionCount: 1,
    materials: [],
    questions: [{
      id: 'question-001', category: '私人题库', subtype: '专项', difficulty: 'unknown',
      stem: '测试题干', materialId: null,
      options: [
        { key: 'A', text: '甲' }, { key: 'B', text: '乙' },
        { key: 'C', text: '丙' }, { key: 'D', text: '丁' },
      ],
      answer: 'A', explanation: '', knowledgePoints: [], sourceRefs: [], status: 'draft',
    }],
  };
}

test('imports, loads and exports a private bank with globally unique question ids', () => {
  const storage = createUserBankStorage(createMemoryBankAdapter(), {
    now: () => 1000,
    random: () => 0,
  });
  const prepared = prepareUserBankImport(sourceBank());
  const manifest = storage.importBank(prepared, { sourceFileName: 'source.json', subjectId: 'subject-1' });
  assert.equal(manifest.id, 'user-bank-rs-00000');
  assert.equal(storage.listBanks().length, 1);
  assert.equal(manifest.subjectId, 'subject-1');
  const loaded = storage.loadBank(manifest.id);
  assert.equal(loaded.questions[0].id, `${manifest.id}:question-001`);
  assert.equal(loaded.questions[0].moduleKey, manifest.id);
  const exported = storage.exportBank(manifest.id);
  assert.equal(exported.questions[0].id, 'question-001');
  assert.equal(exported.questionCount, 1);
  assert.equal(Object.hasOwn(exported.questions[0], 'fingerprint'), false);
});

test('moves banks to trash, restores them and only permanently deletes trashed banks', () => {
  let time = 1000;
  const storage = createUserBankStorage(createMemoryBankAdapter(), {
    now: () => time,
    random: () => 0,
  });
  const manifest = storage.importBank(prepareUserBankImport(sourceBank()), { subjectId: 'subject-1' });
  assert.throws(() => storage.permanentlyDeleteBank(manifest.id), /trashed/i);
  time = 2000;
  storage.trashBank(manifest.id);
  assert.equal(storage.listBanks().length, 0);
  assert.equal(storage.listTrash()[0].trashedAt, 2000);
  assert.throws(() => storage.loadBank(manifest.id), /unknown/i);
  storage.restoreBank(manifest.id);
  assert.equal(storage.listBanks().length, 1);
  storage.trashBank(manifest.id);
  const ids = storage.getQuestionIds(manifest.id);
  assert.equal(ids.length, 1);
  storage.permanentlyDeleteBank(manifest.id);
  assert.equal(storage.listAllBanks().length, 0);
});

test('blocks importing the same normalized bank twice', () => {
  const storage = createUserBankStorage(createMemoryBankAdapter(), {
    now: () => 1000,
    random: () => 0,
  });
  const prepared = prepareUserBankImport(sourceBank());
  storage.importBank(prepared, { subjectId: 'subject-1' });
  assert.throws(() => storage.importBank(prepared, { subjectId: 'subject-1' }), /already been imported/i);
});

test('file adapter commits chunked question files and survives reloads', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'user-bank-files-'));
  const fileSystem = {
    accessSync: (target) => fs.accessSync(target),
    mkdirSync: (target, recursive) => fs.mkdirSync(target, { recursive: Boolean(recursive) }),
    readFileSync: (target, encoding) => fs.readFileSync(target, encoding),
    writeFileSync: (target, data, encoding) => fs.writeFileSync(target, data, encoding),
    unlinkSync: (target) => fs.unlinkSync(target),
    renameSync: (source, destination) => fs.renameSync(source, destination),
    rmdirSync: (target, recursive) => recursive
      ? fs.rmSync(target, { recursive: true, force: true })
      : fs.rmdirSync(target),
  };
  const wxApi = { env: { USER_DATA_PATH: directory }, getFileSystemManager: () => fileSystem };
  try {
    const source = sourceBank();
    source.questions = Array.from({ length: 401 }, (_, index) => ({
      ...source.questions[0],
      id: `question-${String(index + 1).padStart(3, '0')}`,
      stem: `测试题干 ${index + 1}`,
    }));
    source.questionCount = source.questions.length;
    const storage = createUserBankStorage(createFileBankAdapter(wxApi), {
      now: () => 1000,
      random: () => 0,
    });
    const manifest = storage.importBank(prepareUserBankImport(source), { subjectId: 'subject-1' });
    assert.equal(manifest.chunkCount, 3);
    assert.equal(storage.loadBank(manifest.id).questions.length, 401);
    const reloaded = createUserBankStorage(createFileBankAdapter(wxApi));
    assert.equal(reloaded.listBanks()[0].questionCount, 401);
    assert.equal(reloaded.loadBank(manifest.id).questions[400].sourceId, 'question-401');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('preserves multiple-choice type and answer arrays through storage and export', () => {
  const source = sourceBank();
  source.questions[0].type = 'multiple-choice';
  source.questions[0].answer = ['B', 'D'];
  const storage = createUserBankStorage(createMemoryBankAdapter(), {
    now: () => 1000,
    random: () => 0,
  });
  const manifest = storage.importBank(prepareUserBankImport(source), { subjectId: 'subject-1' });
  assert.deepEqual(storage.loadBank(manifest.id).questions[0].answer, ['B', 'D']);
  const exported = storage.exportBank(manifest.id);
  assert.equal(exported.questions[0].type, 'multiple-choice');
  assert.deepEqual(exported.questions[0].answer, ['B', 'D']);
});

test('preserves variable option counts through import, storage, load, and export', () => {
  for (const count of [2, 3]) {
    const source = sourceBank();
    source.questions[0].options = source.questions[0].options.slice(0, count);
    source.questions[0].answer = count === 2 ? 'B' : 'C';
    const storage = createUserBankStorage(createMemoryBankAdapter(), {
      now: () => 1000,
      random: () => 0,
    });
    const prepared = prepareUserBankImport(source);
    assert.equal(prepared.canImport, true);
    const manifest = storage.importBank(prepared, { subjectId: 'subject-1' });
    const loaded = storage.loadBank(manifest.id).questions[0];
    assert.equal(loaded.options.length, count);
    assert.equal(loaded.answer, source.questions[0].answer);
    const exported = storage.exportBank(manifest.id).questions[0];
    assert.equal(exported.options.length, count);
    assert.deepEqual(exported.options, source.questions[0].options);
    assert.equal(exported.answer, source.questions[0].answer);
  }
});

test('requires a subject, updates bank subjects and exports the subject name', () => {
  const storage = createUserBankStorage(createMemoryBankAdapter(), {
    now: () => 1000,
    random: () => 0,
  });
  const prepared = prepareUserBankImport(sourceBank());
  assert.throws(() => storage.importBank(prepared), /subject/i);
  const manifest = storage.importBank(prepared, { subjectId: 'subject-1' });
  const updated = storage.setBankSubject(manifest.id, 'subject-2');
  assert.equal(updated.subjectId, 'subject-2');
  const exported = storage.exportBank(manifest.id, { subjectName: '教师招聘' });
  assert.equal(exported.subject, '教师招聘');
});
