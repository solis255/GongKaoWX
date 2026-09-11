const {
  currentQuestion,
  selectAnswer,
  submitAnswer,
  movePrevious,
  getQuestionType,
  hasSelectedAnswer,
} = require('../../services/practice-session');
const { loadBank } = require('../../services/question-bank');

function optionViews(question, selectedAnswer) {
  const selected = new Set(Array.isArray(selectedAnswer) ? selectedAnswer : [selectedAnswer].filter(Boolean));
  return question.options.map((option) => ({ ...option, selected: selected.has(option.key) }));
}

Page({
  data: {
    layout: {}, question: null, material: null, options: [], selected: null,
    multiple: false, index: 0, total: 0, progress: 0, favorite: false, canSubmit: false,
  },
  onShow() {
    const app = getApp();
    const session = app.globalData.session;
    if (!session) { wx.redirectTo({ url: '/pages/practice-setup/index' }); return; }
    const question = currentQuestion(session);
    const bank = loadBank(question.moduleKey || session.moduleKey);
    const material = question.materialId ? bank.materials.find(({ id }) => id === question.materialId) : null;
    this.startedAt = Date.now();
    this.setData({
      layout: app.globalData.layout,
      question,
      material,
      options: optionViews(question, session.selectedAnswer),
      selected: session.selectedAnswer,
      multiple: getQuestionType(question) === 'multiple-choice',
      index: session.currentIndex + 1,
      total: session.questions.length,
      progress: Math.round(((session.currentIndex + 1) / session.questions.length) * 100),
      favorite: app.globalData.storage.getFavoriteIds().includes(question.id),
      canSubmit: hasSelectedAnswer(session.selectedAnswer),
    });
  },
  select(event) {
    const key = event.currentTarget.dataset.key;
    const app = getApp();
    const session = app.globalData.session;
    const question = currentQuestion(session);
    let answer = key;
    if (getQuestionType(question) === 'multiple-choice') {
      const selected = Array.isArray(session.selectedAnswer) ? session.selectedAnswer : [];
      answer = selected.includes(key)
        ? selected.filter((item) => item !== key)
        : [...selected, key];
    }
    app.globalData.session = selectAnswer(app.globalData.session, answer);
    const selectedAnswer = app.globalData.session.selectedAnswer;
    this.setData({
      selected: selectedAnswer,
      options: optionViews(question, selectedAnswer),
      canSubmit: hasSelectedAnswer(selectedAnswer),
    });
  },
  toggleFavorite() {
    const favorite = getApp().globalData.storage.toggleFavorite(this.data.question.id);
    this.setData({ favorite });
  },
  navigateBack() {
    wx.navigateBack({ fail: () => wx.reLaunch({ url: '/pages/home/index' }) });
  },
  previous() {
    const app = getApp();
    if (app.globalData.session.currentIndex === 0) { this.navigateBack(); return; }
    app.globalData.session = movePrevious(app.globalData.session);
    wx.redirectTo({ url: '/pages/analysis/index' });
  },
  submit() {
    if (!this.data.canSubmit) return;
    const app = getApp();
    if (app.globalData.session.submitted) return;
    this.setData({ canSubmit: false });
    const elapsedMs = Date.now() - this.startedAt;
    app.globalData.session = submitAnswer(app.globalData.session, elapsedMs);
    const record = app.globalData.session.answers[app.globalData.session.answers.length - 1];
    app.globalData.storage.saveAnswerEvent({
      ...record,
      moduleKey: this.data.question.moduleKey || app.globalData.session.moduleKey,
    });
    wx.redirectTo({ url: '/pages/analysis/index' });
  },
  openCard() { wx.navigateTo({ url: '/pages/question-card/index' }); }
});
