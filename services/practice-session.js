function createSession(moduleKey, questions, settings = {}) {
  return {
    moduleKey,
    questions: questions.slice(),
    settings: { autoWrong: true, ...settings },
    currentIndex: 0,
    selectedAnswer: null,
    submitted: false,
    answers: [],
    startedAt: Date.now(),
  };
}

function currentQuestion(session) {
  return session.questions[session.currentIndex] || null;
}

function selectAnswer(session, answer) {
  const question = currentQuestion(session);
  if (!question?.options?.some(({ key }) => key === answer)) {
    throw new Error(`Invalid answer: ${answer}`);
  }
  if (session.submitted) return session;
  return { ...session, selectedAnswer: answer };
}

function submitAnswer(session, elapsedMs = 0) {
  const question = currentQuestion(session);
  if (!question) throw new Error('No current question');
  if (!session.selectedAnswer) throw new Error('Select an answer before submitting');
  if (session.submitted) return session;
  const record = {
    questionId: question.id,
    userAnswer: session.selectedAnswer,
    correct: session.selectedAnswer === question.answer,
    elapsedMs: Math.max(0, Number(elapsedMs) || 0),
  };
  return { ...session, submitted: true, answers: [...session.answers, record] };
}

function jumpToQuestion(session, index) {
  const target = Number(index);
  if (!Number.isInteger(target) || target < 0 || target >= session.questions.length) {
    throw new RangeError('Invalid question index');
  }
  if (target > session.answers.length) throw new Error('Question is locked');
  const record = session.answers[target] || null;
  return {
    ...session,
    currentIndex: target,
    selectedAnswer: record ? record.userAnswer : null,
    submitted: Boolean(record),
  };
}

function buildQuestionCard(session) {
  return session.questions.map((question, index) => {
    const record = session.answers[index];
    return {
      questionId: question.id,
      index,
      number: index + 1,
      status: record
        ? (record.correct ? 'correct' : 'wrong')
        : (index === session.answers.length ? 'current' : 'locked'),
      current: index === session.currentIndex,
      locked: index > session.answers.length,
    };
  });
}

function movePrevious(session) {
  if (session.currentIndex === 0) return session;
  return jumpToQuestion(session, session.currentIndex - 1);
}

function moveNext(session) {
  if (!session.submitted) throw new Error('Submit the current answer before moving next');
  if (session.currentIndex >= session.questions.length - 1) return session;
  return jumpToQuestion(session, session.currentIndex + 1);
}

function summarizeSession(session) {
  const correct = session.answers.filter((answer) => answer.correct).length;
  const total = session.answers.length;
  return {
    total,
    correct,
    incorrect: total - correct,
    accuracy: total ? Math.round((correct / total) * 100) : 0,
    elapsedMs: session.answers.reduce((sum, answer) => sum + answer.elapsedMs, 0),
  };
}

module.exports = {
  createSession,
  currentQuestion,
  selectAnswer,
  submitAnswer,
  moveNext,
  movePrevious,
  jumpToQuestion,
  buildQuestionCard,
  summarizeSession,
};
