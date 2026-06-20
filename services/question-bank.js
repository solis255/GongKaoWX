const BANKS = {
  politics: require('../questions/generated/politics.js'),
  'common-sense': require('../questions/generated/common-sense.js'),
  verbal: require('../questions/generated/verbal.js'),
  quantitative: require('../questions/generated/quantitative.js'),
  reasoning: require('../questions/generated/reasoning.js'),
  'data-analysis': require('../questions/generated/data-analysis.js'),
};

const MODULES = [
  { key: 'politics', name: '政治理论', shortName: '政治', accent: 'green' },
  { key: 'common-sense', name: '常识判断', shortName: '常识', accent: 'blue' },
  { key: 'verbal', name: '言语理解', shortName: '言语', accent: 'green' },
  { key: 'quantitative', name: '数量关系', shortName: '数量', accent: 'blue' },
  { key: 'reasoning', name: '判断推理', shortName: '推理', accent: 'green' },
  { key: 'data-analysis', name: '资料分析', shortName: '资料', accent: 'blue' },
];

function isValidQuestion(question) {
  if (!Array.isArray(question?.options) || question.options.length !== 4) return false;
  const keys = question.options.map((option) => option?.key).join(',');
  return Boolean(
    question?.id
      && question?.stem
      && keys === 'A,B,C,D'
      && question.options.some((option) => option?.key === question.answer),
  );
}

function listModules() {
  return MODULES.map((module) => ({
    ...module,
    questionCount: BANKS[module.key].questions.filter(isValidQuestion).length,
  }));
}

function loadBank(moduleKey) {
  const bank = BANKS[moduleKey];
  if (!bank) throw new Error(`Unknown module: ${moduleKey}`);
  return {
    ...bank,
    questions: bank.questions.filter(isValidQuestion),
  };
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
  for (const { key: moduleKey } of MODULES) {
    const question = loadBank(moduleKey).questions.find((item) => item.id === id);
    if (question) return { ...question, moduleKey };
  }
  return undefined;
}

function pickMixedQuestions(count = 20, options = {}) {
  const normalizedOptions = options ?? {};
  const defaultModuleKeys = MODULES.map(({ key }) => key);
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
  listModules,
  loadBank,
  pickQuestions,
  getQuestionById,
  pickMixedQuestions,
  isValidQuestion,
};
