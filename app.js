const { createStorage } = require('./services/storage');
const { computeLayoutMetrics, getSafeWindowInfo } = require('./services/layout');
const { createUserBankStorage } = require('./services/user-bank-storage');
const { createSubjectStorage, migrateBankSubjects } = require('./services/subject-storage');
const { configureQuestionBankStorage } = require('./services/question-bank');

const LEGACY_BANK_KEYS = ['politics', 'common-sense', 'verbal', 'quantitative', 'reasoning', 'data-analysis'];

function removeLegacyBankData(storage) {
  for (const key of LEGACY_BANK_KEYS) {
    const questionIds = Array.from({ length: 60 }, (_, index) => `${key}-${String(index + 1).padStart(3, '0')}`);
    storage.removeQuestionData(questionIds, key);
  }
}

App({
  globalData: {
    moduleKey: null,
    practiceMode: 'module',
    mixedModuleKeys: [],
    session: null,
    storage: null,
    userBankStorage: null,
    subjectStorage: null,
    practiceTitle: '',
    layout: computeLayoutMetrics(),
  },
  onLaunch() {
    this.globalData.storage = createStorage();
    removeLegacyBankData(this.globalData.storage);
    this.globalData.userBankStorage = createUserBankStorage();
    this.globalData.subjectStorage = createSubjectStorage();
    migrateBankSubjects(this.globalData.subjectStorage, this.globalData.userBankStorage);
    configureQuestionBankStorage(this.globalData.userBankStorage, this.globalData.subjectStorage);

    let capsule;
    const windowInfo = getSafeWindowInfo(wx);
    try {
      capsule = wx.getMenuButtonBoundingClientRect();
    } catch (error) {
      capsule = {};
    }
    this.globalData.layout = computeLayoutMetrics(windowInfo, capsule);
  },
});
