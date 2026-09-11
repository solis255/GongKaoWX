const CHUNK_SIZE = 200;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createMemoryBankAdapter(initialRecords = []) {
  const records = new Map(initialRecords.map((record) => [record.manifest.id, clone(record)]));
  return {
    listManifests: () => [...records.values()].map(({ manifest }) => clone(manifest)),
    readRecord: (id) => records.has(id) ? clone(records.get(id)) : null,
    createRecord(record) {
      if (records.has(record.manifest.id)) throw new Error(`Bank already exists: ${record.manifest.id}`);
      records.set(record.manifest.id, clone(record));
    },
    setStatus(id, status, changedAt) {
      const record = records.get(id);
      if (!record) throw new Error(`Unknown user bank: ${id}`);
      record.manifest.status = status;
      record.manifest.trashedAt = status === 'trash' ? changedAt : null;
      records.set(id, record);
    },
    updateManifest(id, changes) {
      const record = records.get(id);
      if (!record) throw new Error(`Unknown user bank: ${id}`);
      record.manifest = { ...record.manifest, ...clone(changes) };
      records.set(id, record);
    },
    deleteRecord(id) { records.delete(id); },
  };
}

function createFileBankAdapter(wxApi = typeof wx !== 'undefined' ? wx : null) {
  if (!wxApi?.getFileSystemManager || !wxApi?.env?.USER_DATA_PATH) return createMemoryBankAdapter();
  const fs = wxApi.getFileSystemManager();
  const root = `${wxApi.env.USER_DATA_PATH}/guokao-user-banks-v1`;
  const banksRoot = `${root}/banks`;
  const trashRoot = `${root}/trash`;
  const stagingRoot = `${root}/staging`;
  const indexPath = `${root}/index.json`;

  const exists = (path) => {
    try { fs.accessSync(path); return true; }
    catch (error) { return false; }
  };
  const ensureDirectories = () => {
    for (const path of [root, banksRoot, trashRoot, stagingRoot]) {
      if (!exists(path)) fs.mkdirSync(path, true);
    }
  };
  const readJson = (path, fallback) => {
    if (!exists(path)) return fallback;
    try { return JSON.parse(fs.readFileSync(path, 'utf8')); }
    catch (error) { return fallback; }
  };
  const writeJson = (path, value) => {
    const temporary = `${path}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(value), 'utf8');
    if (exists(path)) fs.unlinkSync(path);
    fs.renameSync(temporary, path);
  };
  const readIndex = () => {
    ensureDirectories();
    const value = readJson(indexPath, { storageVersion: 1, banks: [] });
    return value && Array.isArray(value.banks) ? value : { storageVersion: 1, banks: [] };
  };
  const writeIndex = (value) => writeJson(indexPath, value);
  const directoryFor = (manifest) => (
    manifest.status === 'trash' ? `${trashRoot}/${manifest.id}` : `${banksRoot}/${manifest.id}`
  );

  return {
    listManifests: () => readIndex().banks.map(clone),
    readRecord(id) {
      const manifest = readIndex().banks.find((item) => item.id === id);
      if (!manifest) return null;
      const directory = directoryFor(manifest);
      const materials = readJson(`${directory}/materials.json`, []);
      const questions = [];
      for (let index = 0; index < manifest.chunkCount; index += 1) {
        const name = `chunk-${String(index + 1).padStart(4, '0')}.json`;
        questions.push(...readJson(`${directory}/questions/${name}`, []));
      }
      return { manifest: clone(manifest), materials, questions };
    },
    createRecord(record) {
      ensureDirectories();
      const index = readIndex();
      if (index.banks.some(({ id }) => id === record.manifest.id)) {
        throw new Error(`Bank already exists: ${record.manifest.id}`);
      }
      const stage = `${stagingRoot}/${record.manifest.id}`;
      const destination = `${banksRoot}/${record.manifest.id}`;
      if (exists(stage)) fs.rmdirSync(stage, true);
      fs.mkdirSync(`${stage}/questions`, true);
      try {
        writeJson(`${stage}/materials.json`, record.materials);
        for (let offset = 0, chunk = 1; offset < record.questions.length; offset += CHUNK_SIZE, chunk += 1) {
          const name = `chunk-${String(chunk).padStart(4, '0')}.json`;
          writeJson(`${stage}/questions/${name}`, record.questions.slice(offset, offset + CHUNK_SIZE));
        }
        writeJson(`${stage}/manifest.json`, record.manifest);
        fs.renameSync(stage, destination);
        try { writeIndex({ storageVersion: 1, banks: [...index.banks, record.manifest] }); }
        catch (error) {
          if (exists(destination)) fs.rmdirSync(destination, true);
          throw error;
        }
      } catch (error) {
        if (exists(stage)) fs.rmdirSync(stage, true);
        throw error;
      }
    },
    setStatus(id, status, changedAt) {
      const index = readIndex();
      const position = index.banks.findIndex((item) => item.id === id);
      if (position < 0) throw new Error(`Unknown user bank: ${id}`);
      const current = index.banks[position];
      const next = {
        ...current,
        status,
        trashedAt: status === 'trash' ? changedAt : null,
      };
      const source = directoryFor(current);
      const destination = directoryFor(next);
      if (source !== destination) fs.renameSync(source, destination);
      try {
        writeJson(`${destination}/manifest.json`, next);
        index.banks[position] = next;
        writeIndex(index);
      } catch (error) {
        if (source !== destination && exists(destination) && !exists(source)) fs.renameSync(destination, source);
        throw error;
      }
    },
    updateManifest(id, changes) {
      const index = readIndex();
      const position = index.banks.findIndex((item) => item.id === id);
      if (position < 0) throw new Error(`Unknown user bank: ${id}`);
      const manifest = { ...index.banks[position], ...changes };
      const directory = directoryFor(manifest);
      writeJson(`${directory}/manifest.json`, manifest);
      index.banks[position] = manifest;
      writeIndex(index);
    },
    deleteRecord(id) {
      const index = readIndex();
      const manifest = index.banks.find((item) => item.id === id);
      if (!manifest) return;
      if (manifest.status !== 'trash') throw new Error('Only trashed banks can be permanently deleted');
      const directory = directoryFor(manifest);
      if (exists(directory)) fs.rmdirSync(directory, true);
      writeIndex({ ...index, banks: index.banks.filter((item) => item.id !== id) });
    },
  };
}

function generateBankId(now, random) {
  const suffix = Math.floor(random() * 0x1000000).toString(36).padStart(5, '0');
  return `user-bank-${now.toString(36)}-${suffix}`;
}

function createUserBankStorage(adapter = createFileBankAdapter(), options = {}) {
  const now = typeof options.now === 'function' ? options.now : Date.now;
  const random = typeof options.random === 'function' ? options.random : Math.random;
  const listAll = () => adapter.listManifests().filter((item) => item && item.id);
  const getManifest = (id) => listAll().find((item) => item.id === id);

  return {
    listBanks: () => listAll().filter(({ status }) => status !== 'trash'),
    listTrash: () => listAll().filter(({ status }) => status === 'trash'),
    listAllBanks: listAll,
    getManifest,
    getQuestionIds(id) {
      const record = adapter.readRecord(id);
      return record ? record.questions.map(({ id: questionId }) => questionId) : [];
    },
    loadBank(id) {
      const record = adapter.readRecord(id);
      if (!record || record.manifest.status === 'trash') throw new Error(`Unknown user bank: ${id}`);
      return {
        version: 1,
        category: record.manifest.category,
        title: record.manifest.name,
        description: record.manifest.description || '',
        questionCount: record.questions.length,
        materials: record.materials,
        questions: record.questions,
        userBank: true,
        bankId: id,
      };
    },
    importBank(prepared, meta = {}) {
      if (!prepared?.bank || !prepared?.contentHash) throw new TypeError('Prepared bank import is required');
      if (typeof meta.subjectId !== 'string' || !meta.subjectId) throw new TypeError('Subject is required');
      if (listAll().some(({ contentHash }) => contentHash === prepared.contentHash)) {
        throw new Error('This question bank has already been imported');
      }
      const timestamp = now();
      let attempt = 0;
      let id;
      do { id = generateBankId(timestamp + attempt, random); attempt += 1; }
      while (getManifest(id));
      const questions = prepared.bank.questions.map((question) => ({
        ...question,
        sourceId: question.id,
        id: `${id}:${question.id}`,
        moduleKey: id,
      }));
      const manifest = {
        id,
        name: prepared.bank.title,
        category: prepared.bank.category,
        description: prepared.bank.description || '',
        subjectId: meta.subjectId,
        questionCount: questions.length,
        materialCount: prepared.bank.materials.length,
        chunkCount: Math.ceil(questions.length / CHUNK_SIZE),
        contentHash: prepared.contentHash,
        questionFingerprints: questions.map(({ fingerprint }) => fingerprint),
        sourceFileName: meta.sourceFileName || '',
        status: 'active',
        createdAt: timestamp,
        updatedAt: timestamp,
        importedAt: timestamp,
        trashedAt: null,
      };
      adapter.createRecord({ manifest, materials: prepared.bank.materials, questions });
      return clone(manifest);
    },
    setBankSubject(id, subjectId) {
      if (!getManifest(id)) throw new Error(`Unknown user bank: ${id}`);
      if (typeof subjectId !== 'string' || !subjectId) throw new TypeError('Subject is required');
      const updatedAt = now();
      adapter.updateManifest(id, { subjectId, updatedAt });
      return clone(getManifest(id));
    },
    trashBank(id) {
      if (!getManifest(id)) throw new Error(`Unknown user bank: ${id}`);
      adapter.setStatus(id, 'trash', now());
    },
    restoreBank(id) {
      const manifest = getManifest(id);
      if (!manifest || manifest.status !== 'trash') throw new Error(`Unknown trashed bank: ${id}`);
      adapter.setStatus(id, 'active', now());
    },
    permanentlyDeleteBank(id) {
      const manifest = getManifest(id);
      if (!manifest || manifest.status !== 'trash') throw new Error('Only trashed banks can be permanently deleted');
      adapter.deleteRecord(id);
    },
    exportBank(id, meta = {}) {
      const record = adapter.readRecord(id);
      if (!record) throw new Error(`Unknown user bank: ${id}`);
      return {
        version: 1,
        ...(meta.subjectName ? { subject: meta.subjectName } : {}),
        category: record.manifest.category,
        title: record.manifest.name,
        description: record.manifest.description || '',
        questionCount: record.questions.length,
        materials: clone(record.materials),
        questions: record.questions.map((question) => ({
          id: question.sourceId || question.id,
          type: question.type || 'single-choice',
          category: question.category,
          subtype: question.subtype,
          difficulty: question.difficulty,
          stem: question.stem,
          materialId: question.materialId,
          options: question.options,
          answer: question.answer,
          explanation: question.explanation,
          knowledgePoints: question.knowledgePoints,
          sourceRefs: question.sourceRefs,
          status: question.status,
        })),
      };
    },
  };
}

module.exports = {
  CHUNK_SIZE,
  createUserBankStorage,
  createFileBankAdapter,
  createMemoryBankAdapter,
};
