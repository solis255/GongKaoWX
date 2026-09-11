import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  createSubjectStorage,
  migrateBankSubjects,
  SUBJECTS_KEY,
} = require('../services/subject-storage.js');

function memoryAdapter() {
  const values = new Map();
  return { values, get: (key) => values.get(key), set: (key, value) => values.set(key, value) };
}

test('creates, renames and deletes custom subjects with normalized unique names', () => {
  const adapter = memoryAdapter();
  let timestamp = 1000;
  const storage = createSubjectStorage(adapter, { now: () => timestamp, random: () => 0 });
  const subject = storage.createSubject('  行政   执法  ');
  assert.equal(subject.name, '行政 执法');
  assert.equal(adapter.values.get(SUBJECTS_KEY).length, 1);
  assert.throws(() => storage.createSubject('行政 执法'), /已存在/);
  const second = storage.createSubject('教育');
  const third = storage.createSubject('医疗');
  assert.notEqual(second.id, third.id);
  timestamp = 2000;
  assert.equal(storage.renameSubject(subject.id, '法律').name, '法律');
  assert.throws(() => storage.deleteSubject(subject.id, [subject.id]), /题库/);
  storage.deleteSubject(subject.id);
  assert.deepEqual(storage.listSubjects().map(({ name }) => name), ['教育', '医疗']);
});

test('migrates banks without a valid subject from their original category', () => {
  const subjectStorage = createSubjectStorage(memoryAdapter(), { now: () => 1000, random: () => 0 });
  const manifests = [{ id: 'bank-1', category: '事业单位', subjectId: '' }];
  const userBankStorage = {
    listAllBanks: () => manifests,
    setBankSubject(id, subjectId) {
      const manifest = manifests.find((item) => item.id === id);
      manifest.subjectId = subjectId;
    },
  };
  migrateBankSubjects(subjectStorage, userBankStorage);
  assert.equal(subjectStorage.listSubjects()[0].name, '事业单位');
  assert.equal(manifests[0].subjectId, subjectStorage.listSubjects()[0].id);
});
