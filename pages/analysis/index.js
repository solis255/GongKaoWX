const { currentQuestion, moveNext, movePrevious, getQuestionType } = require('../../services/practice-session');
const { loadBank } = require('../../services/question-bank');

Page({
  data: {
    question: null, material: null, record: null, correct: false,
    index: 0, total: 0, seconds: 0, sources: [], sourcesExpanded: false,
  },
  onLoad() {
    const session = getApp().globalData.session;
    if (!session || !session.submitted) { wx.redirectTo({ url: '/pages/question/index' }); return; }
    const question = currentQuestion(session);
    const record = session.answers[session.currentIndex];
    const bank = loadBank(question.moduleKey || session.moduleKey);
    const material = question.materialId ? bank.materials.find(({ id }) => id === question.materialId) : null;
    const correctKeys = new Set(Array.isArray(question.answer) ? question.answer : [question.answer]);
    const chosenKeys = new Set(Array.isArray(record.userAnswer) ? record.userAnswer : [record.userAnswer]);
    const questionView = {
      ...question,
      options: question.options.map((option) => ({
        ...option,
        correct: correctKeys.has(option.key),
        chosen: chosenKeys.has(option.key),
        wrong: chosenKeys.has(option.key) && !correctKeys.has(option.key),
      })),
    };
    const sources = (Array.isArray(question.sourceRefs) ? question.sourceRefs : []).map((source) => ({
      ...source,
      kindText: source.kind === 'official' ? '官方资料' : '参考资料',
    }));
    this.setData({
      question: questionView, material, record, sources,
      questionTypeText: getQuestionType(question) === 'multiple-choice' ? '多选题' : '单选题',
      answerText: [...correctKeys].join('、'),
      correct: record.correct,
      index: session.currentIndex + 1,
      total: session.questions.length,
      seconds: Math.max(1, Math.round(record.elapsedMs / 1000)),
      sourcesExpanded: false,
    });
  },
  previous() {
    const app = getApp();
    if (app.globalData.session.currentIndex === 0) { wx.navigateBack(); return; }
    app.globalData.session = movePrevious(app.globalData.session);
    wx.redirectTo({ url: '/pages/analysis/index' });
  },
  next() {
    const app = getApp();
    const session = app.globalData.session;
    if (session.currentIndex >= session.questions.length - 1) { wx.redirectTo({ url: '/pages/result/index' }); return; }
    app.globalData.session = moveNext(session);
    wx.redirectTo({ url: app.globalData.session.submitted ? '/pages/analysis/index' : '/pages/question/index' });
  },
  openCard() { wx.navigateTo({ url: '/pages/question-card/index' }); },
  toggleSources() { this.setData({ sourcesExpanded: !this.data.sourcesExpanded }); },
  copySource(event) {
    const source = this.data.sources[Number(event.currentTarget.dataset.index)];
    if (!source || !source.url) return;
    wx.setClipboardData({
      data: source.url,
      success: () => wx.showToast({ title: '来源链接已复制', icon: 'none' }),
    });
  },
});
