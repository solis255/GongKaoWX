let userBankStorage = null;
let subjectStorage = null;

function configureQuestionBankStorage(bankStorage, customSubjectStorage) {
  userBankStorage = bankStorage || null;
  subjectStorage = customSubjectStorage || null;
}

function isValidQuestion(question) {
  if (!Array.isArray(question?.options) || question.options.length !== 4) return false;
  const keys = question.options.map((option) => option?.key).join(',');
  const type = question?.type || 'single-choice';
  const answerIsValid = type === 'multiple-choice'
    ? Array.isArray(question.answer)
      && question.answer.length >= 2
      && new Set(question.answer).size === question.answer.length
      && question.answer.every((answer) => ['A', 'B', 'C', 'D'].includes(answer))
    : type === 'single-choice'
      && typeof question.answer === 'string'
      && ['A', 'B', 'C', 'D'].includes(question.answer);
  return Boolean(
    question?.id
      && question?.stem
      && keys === 'A,B,C,D'
      && answerIsValid,
  );
}

function listUserBanks(options = {}) {
  if (!userBankStorage) return [];
  const subjectMap = new Map(
    (subjectStorage ? subjectStorage.listSubjects() : []).map((subject) => [subject.id, subject]),
  );
  const manifests = options.includeTrash
    ? userBankStorage.listAllBanks()
    : userBankStorage.listBanks();
  return manifests.map((manifest, index) => ({
    key: manifest.id,
    name: manifest.name,
    shortName: manifest.name.slice(0, 2),
    accent: index % 2 ? 'blue' : 'green',
    questionCount: manifest.questionCount,
    userBank: true,
    status: manifest.status,
    importedAt: manifest.importedAt,
    subjectId: manifest.subjectId || '',
    subjectName: subjectMap.get(manifest.subjectId)?.name || '未分类',
  }));
}

function listAllBanks() {
  return listUserBanks();
}

function listSubjectSummaries() {
  if (!subjectStorage) return [];
  const banks = listUserBanks();
  return subjectStorage.listSubjects().map((subject, index) => {
    const subjectBanks = banks.filter((bank) => bank.subjectId === subject.id);
    return {
      key: subject.id,
      name: subject.name,
      shortName: subject.name.slice(0, 2),
      accent: index % 2 ? 'blue' : 'green',
      bankCount: subjectBanks.length,
      bankKeys: subjectBanks.map(({ key }) => key),
      questionCount: subjectBanks.reduce((sum, bank) => sum + bank.questionCount, 0),
    };
  });
}

function loadBank(moduleKey) {
  if (userBankStorage) {
    try {
      const userBank = userBankStorage.loadBank(moduleKey);
      return { ...userBank, questions: userBank.questions.filter(isValidQuestion) };
    } catch (error) {
      // Fall through to the stable public error below.
    }
  }
  throw new Error(`Unknown question bank: ${moduleKey}`);
}

function shuffle(items) {
  const result = items.slice();
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function pickQuestions(moduleKey, count = 20, random = false, excludeIds = []) {
  const excluded = new Set(excludeIds);
  const questions = loadBank(moduleKey).questions.filter(({ id }) => !excluded.has(id));
  const selected = random ? shuffle(questions) : questions;
  return selected.slice(0, Math.max(0, Math.min(Number(count) || 20, selected.length)));
}

function getQuestionById(id) {
  if (userBankStorage && typeof id === 'string') {
    const separator = id.indexOf(':');
    if (separator > 0) {
      const moduleKey = id.slice(0, separator);
      try {
        const question = loadBank(moduleKey).questions.find((item) => item.id === id);
        if (question) return { ...question, moduleKey };
      } catch (error) {
        return undefined;
      }
    }
  }
  return undefined;
}

function pickMixedQuestions(count = 20, options = {}) {
  const normalizedOptions = options ?? {};
  const defaultModuleKeys = listAllBanks().map(({ key }) => key);
  const selectedModuleKeys = Array.isArray(normalizedOptions.moduleKeys)
    ? normalizedOptions.moduleKeys
    : defaultModuleKeys;
  const moduleKeys = [...new Set(selectedModuleKeys)];
  const excluded = new Set(normalizedOptions.excludeIds ?? []);
  const queues = moduleKeys.map((moduleKey) => loadBank(moduleKey).questions
    .filter(({ id }) => !excluded.has(id))
    .map((question) => ({ ...question, moduleKey })));
  const numericCount = Number(count);
  const limit = numericCount === 0 ? 0 : Math.max(0, Math.floor(numericCount || 20));
  const picked = [];

  while (picked.length < limit) {
    let added = false;
    for (const queue of queues) {
      if (picked.length >= limit) break;
      const question = queue.shift();
      if (question) {
        picked.push(question);
        added = true;
      }
    }
    if (!added) break;
  }

  return shuffle(picked);
}

module.exports = {
  configureQuestionBankStorage,
  listUserBanks,
  listAllBanks,
  listSubjectSummaries,
  loadBank,
  pickQuestions,
  getQuestionById,
  pickMixedQuestions,
  isValidQuestion,
};
