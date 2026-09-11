const { prepareUserBankImport } = require('../../services/user-bank-import');

const MAX_FILE_BYTES = 10 * 1024 * 1024;

function formatTime(timestamp) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

Page({
  data: {
    state: 'idle',
    fileName: '',
    summary: null,
    fatalErrors: [],
    issues: [],
    duplicates: [],
    canImport: false,
    importing: false,
    subjects: [],
    subjectNames: [],
    subjectIndex: 0,
    subjectId: '',
    validationPassed: false,
  },
  onShow() { this.refreshSubjects(); },
  refreshSubjects(preferredName = '') {
    const subjects = getApp().globalData.subjectStorage.listSubjects();
    let subjectIndex = subjects.findIndex(({ id }) => id === this.data.subjectId);
    if (preferredName) {
      const preferredIndex = subjects.findIndex(({ name }) => name === preferredName);
      if (preferredIndex >= 0) subjectIndex = preferredIndex;
    }
    if (subjectIndex < 0) subjectIndex = 0;
    const subjectId = subjects[subjectIndex]?.id || '';
    this.setData({
      subjects,
      subjectNames: subjects.map(({ name }) => name),
      subjectIndex,
      subjectId,
      canImport: this.data.validationPassed && Boolean(subjectId),
    });
  },
  chooseSubject(event) {
    const subjectIndex = Number(event.detail.value);
    const subjectId = this.data.subjects[subjectIndex]?.id || '';
    this.setData({ subjectIndex, subjectId, canImport: this.data.validationPassed && Boolean(subjectId) });
  },
  createSubject() {
    wx.showModal({
      title: '新增科目',
      editable: true,
      placeholderText: '例如：事业单位、教师招聘',
      success: ({ confirm, content }) => {
        if (!confirm) return;
        try {
          const subject = getApp().globalData.subjectStorage.createSubject(content);
          this.refreshSubjects(subject.name);
        } catch (error) {
          wx.showToast({ title: error.message, icon: 'none' });
        }
      },
    });
  },
  manageSubjects() { wx.navigateTo({ url: '/pages/subjects/index' }); },
  chooseFile() {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['json'],
      success: ({ tempFiles }) => {
        const file = tempFiles && tempFiles[0];
        if (!file) return;
        if (!/\.json$/i.test(file.name || '')) {
          wx.showToast({ title: '请选择 JSON 文件', icon: 'none' });
          return;
        }
        if (Number(file.size) > MAX_FILE_BYTES) {
          wx.showToast({ title: '文件不能超过 10MB', icon: 'none' });
          return;
        }
        this.readFile(file);
      },
      fail: (error) => {
        if (!/cancel/i.test(error?.errMsg || '')) wx.showToast({ title: '无法选择文件', icon: 'none' });
      },
    });
  },
  readFile(file) {
    this.setData({ state: 'reading', fileName: file.name || '题库.json' });
    wx.getFileSystemManager().readFile({
      filePath: file.path,
      encoding: 'utf8',
      success: ({ data }) => this.preview(String(data), file.name || '题库.json'),
      fail: () => {
        this.setData({ state: 'idle' });
        wx.showToast({ title: '文件读取失败', icon: 'none' });
      },
    });
  },
  preview(text, fileName) {
    const manifests = getApp().globalData.userBankStorage.listAllBanks().map((item) => ({
      ...item,
      importedAtText: formatTime(item.importedAt),
    }));
    const prepared = prepareUserBankImport(text, manifests);
    this.preparedImport = prepared;
    const validationPassed = prepared.canImport;
    this.setData({
      state: 'preview',
      fileName,
      summary: prepared.summary,
      fatalErrors: prepared.fatalErrors.slice(0, 20),
      issues: prepared.issues.slice(0, 30),
      duplicates: prepared.duplicates.slice(0, 20),
      validationPassed,
      canImport: validationPassed && Boolean(this.data.subjectId),
    });
    if (prepared.bank.subject) this.refreshSubjects(prepared.bank.subject);
  },
  confirmImport() {
    if (!this.data.canImport || !this.preparedImport || this.data.importing) return;
    this.setData({ importing: true });
    try {
      const manifest = getApp().globalData.userBankStorage.importBank(this.preparedImport, {
        sourceFileName: this.data.fileName,
        subjectId: this.data.subjectId,
      });
      wx.showToast({ title: `已导入 ${manifest.questionCount} 题`, icon: 'success' });
      setTimeout(() => wx.navigateBack({ fail: () => wx.reLaunch({ url: '/pages/bank/index' }) }), 500);
    } catch (error) {
      this.setData({ importing: false });
      wx.showModal({ title: '导入失败', content: error.message || '写入题库时发生错误', showCancel: false });
    }
  },
  reset() {
    this.preparedImport = null;
    this.setData({
      state: 'idle', fileName: '', summary: null, fatalErrors: [], issues: [],
      duplicates: [], canImport: false, importing: false, validationPassed: false,
    });
  },
});
