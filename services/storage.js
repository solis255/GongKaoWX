const KEYS = {
  wrong: 'guokao_wrong_answers',
  favorites: 'guokao_favorites',
  history: 'guokao_practice_history',
  settings: 'guokao_practice_settings',
  attempts: 'guokao_answer_events',
  dailyGoal: 'guokao_daily_goal',
  favoriteRecords: 'guokao_favorite_records',
  userProfile: 'guokao_user_profile_v1',
  examConfig: 'guokao_exam_config_v1',
};

const DEFAULT_USER_PROFILE = Object.freeze({
  nickname: '备考用户',
  avatarPath: '',
});

function getTextLength(value) {
  return Array.from(value).length;
}

function normalizeUserProfile(profile) {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
    return { ...DEFAULT_USER_PROFILE };
  }
  const nickname = typeof profile.nickname === 'string' ? profile.nickname.trim() : '';
  const avatarPath = typeof profile.avatarPath === 'string' ? profile.avatarPath.trim() : '';
  return {
    nickname: nickname && getTextLength(nickname) <= 20
      ? nickname
      : DEFAULT_USER_PROFILE.nickname,
    avatarPath,
  };
}

function isValidExamDate(value) {
  if (typeof value !== 'string') return false;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1900 || month < 1 || month > 12) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const monthDays = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day >= 1 && day <= monthDays[month - 1];
}

function normalizeExamConfig(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return null;
  const name = typeof config.name === 'string' ? config.name.trim() : '';
  const date = typeof config.date === 'string' ? config.date.trim() : '';
  if (!name || getTextLength(name) > 30 || !isValidExamDate(date)) return null;
  return { name, date };
}

function defaultAdapter() {
  if (typeof wx !== 'undefined') {
    return {
      get: (key) => wx.getStorageSync(key),
      set: (key, value) => wx.setStorageSync(key, value),
      remove: (key) => wx.removeStorageSync(key),
    };
  }
  const memory = new Map();
  return {
    get: (key) => memory.get(key),
    set: (key, value) => memory.set(key, value),
    remove: (key) => memory.delete(key),
  };
}

function createStorage(adapter = defaultAdapter()) {
  const readList = (key) => {
    const value = adapter.get(key);
    return Array.isArray(value) ? value : [];
  };
  const writeUnique = (key, value) => {
    const values = readList(key);
    if (!values.includes(value)) adapter.set(key, [...values, value]);
  };
  const isAnswerEvent = (event) => Boolean(
    event
    && typeof event.questionId === 'string'
    && typeof event.moduleKey === 'string'
    && Number.isFinite(event.answeredAt),
  );
  const getFavorites = () => {
    const records = readList(KEYS.favoriteRecords).filter((record) => (
      record
      && typeof record.questionId === 'string'
      && Number.isFinite(record.favoritedAt)
    ));
    if (records.length) return records;
    const migrated = readList(KEYS.favorites)
      .filter((questionId) => typeof questionId === 'string')
      .map((questionId) => ({ questionId, favoritedAt: 0 }));
    if (migrated.length) adapter.set(KEYS.favoriteRecords, migrated);
    return migrated;
  };
  return {
    getWrongAnswerIds: () => readList(KEYS.wrong),
    addWrongAnswer: (questionId) => writeUnique(KEYS.wrong, questionId),
    removeWrongAnswer: (questionId) => adapter.set(
      KEYS.wrong,
      readList(KEYS.wrong).filter((id) => id !== questionId),
    ),
    getFavoriteIds: () => getFavorites().map(({ questionId }) => questionId),
    getFavorites,
    toggleFavorite(questionId, favoritedAt = Date.now()) {
      const records = getFavorites();
      const active = records.some((record) => record.questionId === questionId);
      const next = active
        ? records.filter((record) => record.questionId !== questionId)
        : [...records, { questionId, favoritedAt }];
      adapter.set(KEYS.favoriteRecords, next);
      adapter.set(KEYS.favorites, next.map((record) => record.questionId));
      return !active;
    },
    getAnswerEvents: () => readList(KEYS.attempts).filter(isAnswerEvent),
    saveAnswerEvent(event, answeredAt = Date.now()) {
      const normalized = {
        questionId: event && event.questionId,
        moduleKey: event && event.moduleKey,
        userAnswer: event && event.userAnswer,
        correct: Boolean(event && event.correct),
        elapsedMs: Number.isFinite(event && event.elapsedMs) ? event.elapsedMs : 0,
        answeredAt: Number.isFinite(event && event.answeredAt) ? event.answeredAt : answeredAt,
      };
      if (!isAnswerEvent(normalized)) throw new TypeError('answer event requires questionId, moduleKey and answeredAt');
      adapter.set(KEYS.attempts, [...readList(KEYS.attempts).filter(isAnswerEvent), normalized]);
      adapter.set(KEYS.wrong, readList(KEYS.wrong).filter((id) => id !== normalized.questionId));
      return normalized;
    },
    getDailyGoal() {
      const value = adapter.get(KEYS.dailyGoal);
      return Number.isInteger(value) && value >= 1 && value <= 200 ? value : 20;
    },
    saveDailyGoal(value) {
      if (!Number.isInteger(value) || value < 1 || value > 200) throw new RangeError('daily goal must be an integer between 1 and 200');
      adapter.set(KEYS.dailyGoal, value);
      return value;
    },
    getUserProfile: () => normalizeUserProfile(adapter.get(KEYS.userProfile)),
    saveUserProfile(profile) {
      const nickname = profile && typeof profile.nickname === 'string'
        ? profile.nickname.trim()
        : '';
      if (!nickname || getTextLength(nickname) > 20) {
        throw new RangeError('nickname must contain between 1 and 20 characters');
      }
      const normalized = {
        nickname,
        avatarPath: profile && typeof profile.avatarPath === 'string'
          ? profile.avatarPath.trim()
          : '',
      };
      adapter.set(KEYS.userProfile, normalized);
      return normalized;
    },
    getExamConfig: () => normalizeExamConfig(adapter.get(KEYS.examConfig)),
    saveExamConfig(config) {
      const normalized = normalizeExamConfig(config);
      if (!normalized) throw new TypeError('exam config requires a name between 1 and 30 characters and a valid date');
      adapter.set(KEYS.examConfig, normalized);
      return normalized;
    },
    clearExamConfig() {
      if (typeof adapter.remove === 'function') adapter.remove(KEYS.examConfig);
      else adapter.set(KEYS.examConfig, null);
      return null;
    },
    getHistory: () => readList(KEYS.history),
    savePractice(record) {
      adapter.set(KEYS.history, [...readList(KEYS.history), { ...record, completedAt: Date.now() }]);
    },
    getStats() {
      const history = readList(KEYS.history);
      const total = history.reduce((sum, record) => sum + record.total, 0);
      const correct = history.reduce((sum, record) => sum + record.correct, 0);
      return {
        total,
        correct,
        accuracy: total ? Math.round((correct / total) * 100) : 0,
        elapsedMs: history.reduce((sum, record) => sum + (record.elapsedMs || 0), 0),
      };
    },
    getSettings: () => adapter.get(KEYS.settings) || null,
    saveSettings: (settings) => adapter.set(KEYS.settings, settings),
    removeQuestionData(questionIds, moduleKey) {
      const ids = new Set(Array.isArray(questionIds) ? questionIds : []);
      if (!ids.size && !moduleKey) return;
      adapter.set(KEYS.wrong, readList(KEYS.wrong).filter((id) => !ids.has(id)));
      const favoriteRecords = getFavorites().filter(({ questionId }) => !ids.has(questionId));
      adapter.set(KEYS.favoriteRecords, favoriteRecords);
      adapter.set(KEYS.favorites, favoriteRecords.map(({ questionId }) => questionId));
      adapter.set(KEYS.attempts, readList(KEYS.attempts).filter((event) => (
        !ids.has(event?.questionId) && (!moduleKey || event?.moduleKey !== moduleKey)
      )));
      adapter.set(KEYS.history, readList(KEYS.history).filter((record) => (
        !moduleKey || record?.moduleKey !== moduleKey
      )));
    },
  };
}

module.exports = {
  createStorage,
  KEYS,
  DEFAULT_USER_PROFILE,
  normalizeUserProfile,
  normalizeExamConfig,
  isValidExamDate,
};
