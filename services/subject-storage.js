const SUBJECTS_KEY = 'guokao_custom_subjects_v1';

function normalizeSubjectName(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function defaultAdapter() {
  if (typeof wx !== 'undefined') {
    return {
      get: (key) => wx.getStorageSync(key),
      set: (key, value) => wx.setStorageSync(key, value),
    };
  }
  const memory = new Map();
  return { get: (key) => memory.get(key), set: (key, value) => memory.set(key, value) };
}

function createSubjectStorage(adapter = defaultAdapter(), options = {}) {
  const now = typeof options.now === 'function' ? options.now : Date.now;
  const random = typeof options.random === 'function' ? options.random : Math.random;
  const read = () => {
    const value = adapter.get(SUBJECTS_KEY);
    return Array.isArray(value)
      ? value.filter((item) => item && typeof item.id === 'string' && normalizeSubjectName(item.name))
      : [];
  };
  const write = (subjects) => adapter.set(SUBJECTS_KEY, subjects);
  const validateName = (name, subjects, excludedId) => {
    const normalized = normalizeSubjectName(name);
    if (!normalized) throw new Error('科目名称不能为空');
    if (normalized.length > 20) throw new Error('科目名称不能超过 20 个字符');
    if (subjects.some((item) => item.id !== excludedId && item.name.toLocaleLowerCase() === normalized.toLocaleLowerCase())) {
      throw new Error('科目名称已存在');
    }
    return normalized;
  };
  const makeId = (timestamp) => {
    const suffix = Math.floor(random() * 0x1000000).toString(36).padStart(5, '0');
    return `subject-${timestamp.toString(36)}-${suffix}`;
  };

  return {
    listSubjects: () => read().slice().sort((a, b) => a.createdAt - b.createdAt),
    getSubject: (id) => read().find((item) => item.id === id),
    createSubject(name) {
      const subjects = read();
      const normalized = validateName(name, subjects);
      const timestamp = now();
      let attempt = 0;
      let id;
      do { id = makeId(timestamp + attempt); attempt += 1; }
      while (subjects.some((item) => item.id === id));
      const subject = { id, name: normalized, createdAt: timestamp, updatedAt: timestamp };
      write([...subjects, subject]);
      return { ...subject };
    },
    ensureSubject(name) {
      const normalized = normalizeSubjectName(name) || '未分类';
      const existing = read().find((item) => item.name.toLocaleLowerCase() === normalized.toLocaleLowerCase());
      return existing ? { ...existing } : this.createSubject(normalized);
    },
    renameSubject(id, name) {
      const subjects = read();
      const position = subjects.findIndex((item) => item.id === id);
      if (position < 0) throw new Error('科目不存在');
      const normalized = validateName(name, subjects, id);
      subjects[position] = { ...subjects[position], name: normalized, updatedAt: now() };
      write(subjects);
      return { ...subjects[position] };
    },
    deleteSubject(id, usedSubjectIds = []) {
      const subjects = read();
      if (!subjects.some((item) => item.id === id)) throw new Error('科目不存在');
      if (new Set(usedSubjectIds).has(id)) throw new Error('请先修改或删除该科目下的题库');
      write(subjects.filter((item) => item.id !== id));
    },
  };
}

function migrateBankSubjects(subjectStorage, userBankStorage) {
  const subjects = new Map(subjectStorage.listSubjects().map((item) => [item.id, item]));
  for (const manifest of userBankStorage.listAllBanks()) {
    if (manifest.subjectId && subjects.has(manifest.subjectId)) continue;
    const subject = subjectStorage.ensureSubject(manifest.category || '未分类');
    subjects.set(subject.id, subject);
    userBankStorage.setBankSubject(manifest.id, subject.id);
  }
}

module.exports = {
  SUBJECTS_KEY,
  normalizeSubjectName,
  createSubjectStorage,
  migrateBankSubjects,
};
