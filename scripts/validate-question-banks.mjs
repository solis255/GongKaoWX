import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const BANK_FILE_NAMES = Object.freeze([
  'politics.json',
  'common-sense.json',
  'verbal.json',
  'quantitative.json',
  'reasoning.json',
  'data-analysis.json',
]);

const REQUIRED_BANK_FIELDS = [
  'version',
  'category',
  'title',
  'questionCount',
  'materials',
  'questions',
];
const REQUIRED_QUESTION_FIELDS = [
  'id',
  'category',
  'subtype',
  'difficulty',
  'stem',
  'materialId',
  'options',
  'answer',
  'explanation',
  'knowledgePoints',
  'sourceRefs',
  'status',
];
const DIFFICULTY_COUNTS = { easy: 18, medium: 30, hard: 12 };

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasOwn(value, key) {
  return value !== null
    && typeof value === 'object'
    && Object.prototype.hasOwnProperty.call(value, key);
}

function validateSourceRefs(sourceRefs, owner, errors) {
  if (!Array.isArray(sourceRefs)) {
    errors.push(`${owner}: sourceRefs must be an array`);
    return;
  }
  sourceRefs.forEach((source, index) => {
    const label = `${owner}: sourceRefs[${index}]`;
    if (!isNonEmptyString(source?.kind)) errors.push(`${label} kind is required`);
    if (!isNonEmptyString(source?.title)) errors.push(`${label} title is required`);
    for (const field of ['url', 'publishedAt', 'accessedAt']) {
      if (hasOwn(source, field) && !isNonEmptyString(source[field])) {
        errors.push(`${label} ${field} must be non-empty when present`);
      }
    }
  });
}

export function validateBank(bank, fileName = 'question bank') {
  const errors = [];
  if (bank === null || typeof bank !== 'object' || Array.isArray(bank)) {
    return [`${fileName}: bank must be an object`];
  }

  for (const field of REQUIRED_BANK_FIELDS) {
    if (!hasOwn(bank, field)) errors.push(`${fileName}: missing required field ${field}`);
  }
  if (bank.version !== 1) errors.push(`${fileName}: version must be 1`);
  if (!isNonEmptyString(bank.category)) errors.push(`${fileName}: category is required`);
  if (!isNonEmptyString(bank.title)) errors.push(`${fileName}: title is required`);

  const questions = Array.isArray(bank.questions) ? bank.questions : [];
  if (!Array.isArray(bank.questions)) errors.push(`${fileName}: questions must be an array`);
  if (bank.questionCount !== questions.length) {
    errors.push(`${fileName}: questionCount mismatch`);
  }
  if (questions.length !== 60) errors.push(`${fileName}: must contain exactly 60 questions`);

  const materials = Array.isArray(bank.materials) ? bank.materials : [];
  if (!Array.isArray(bank.materials)) errors.push(`${fileName}: materials must be an array`);
  const materialIds = new Set();
  for (const [index, material] of materials.entries()) {
    const owner = `${fileName}: material[${index}]`;
    if (!isNonEmptyString(material?.id)) errors.push(`${owner} id is required`);
    if (materialIds.has(material?.id)) errors.push(`${fileName}: duplicate material id ${material.id}`);
    if (isNonEmptyString(material?.id)) materialIds.add(material.id);
    if (!isNonEmptyString(material?.title)) errors.push(`${owner} title is required`);
    if (!isNonEmptyString(material?.content)) errors.push(`${owner} content is required`);
    validateSourceRefs(material?.sourceRefs, owner, errors);
  }

  const prefix = path.basename(fileName, path.extname(fileName));
  const ids = new Set();
  const difficultyCounts = { easy: 0, medium: 0, hard: 0 };

  questions.forEach((question, index) => {
    const owner = `${fileName}: question[${index}]`;
    for (const field of REQUIRED_QUESTION_FIELDS) {
      if (!hasOwn(question, field)) errors.push(`${owner} missing required field ${field}`);
    }

    if (!isNonEmptyString(question?.id)) {
      errors.push(`${owner} id is required`);
    } else {
      if (ids.has(question.id)) errors.push(`${fileName}: duplicate id ${question.id}`);
      ids.add(question.id);
      const expectedId = `${prefix}-${String(index + 1).padStart(3, '0')}`;
      if (question.id !== expectedId) {
        errors.push(`${question.id}: IDs must be unique and continuous; expected ${expectedId}`);
      }
    }

    for (const field of ['category', 'subtype', 'stem', 'explanation', 'status']) {
      if (!isNonEmptyString(question?.[field])) errors.push(`${owner} ${field} is required`);
    }
    if (hasOwn(difficultyCounts, question?.difficulty)) {
      difficultyCounts[question.difficulty] += 1;
    } else {
      errors.push(`${owner} difficulty must be easy, medium, or hard`);
    }

    const options = Array.isArray(question?.options) ? question.options : [];
    const keys = options.map((option) => option?.key);
    if (keys.join(',') !== 'A,B,C,D') errors.push(`${question?.id ?? owner}: options must be A-D`);
    options.forEach((option) => {
      if (!isNonEmptyString(option?.text)) {
        errors.push(`${question?.id ?? owner}: option ${option?.key ?? '?'} text is required`);
      }
    });
    if (!['A', 'B', 'C', 'D'].includes(question?.answer) || !keys.includes(question.answer)) {
      errors.push(`${question?.id ?? owner}: answer is not one of the available A-D options`);
    }

    if (!Array.isArray(question?.knowledgePoints) || question.knowledgePoints.length === 0
      || question.knowledgePoints.some((point) => !isNonEmptyString(point))) {
      errors.push(`${question?.id ?? owner}: knowledgePoints must contain non-empty values`);
    }
    if (question?.materialId !== null
      && (!isNonEmptyString(question?.materialId) || !materialIds.has(question.materialId))) {
      errors.push(`${question?.id ?? owner}: materialId does not reference an existing material`);
    }
    validateSourceRefs(question?.sourceRefs, question?.id ?? owner, errors);
  });

  if (Object.entries(DIFFICULTY_COUNTS).some(([key, count]) => difficultyCounts[key] !== count)) {
    errors.push(
      `${fileName}: difficulty distribution must be easy 18, medium 30, hard 12`,
    );
  }
  return errors;
}

async function readAndValidate(filePath) {
  const fileName = path.basename(filePath);
  try {
    const bank = JSON.parse(await readFile(filePath, 'utf8'));
    return {
      name: fileName,
      questionCount: Array.isArray(bank.questions) ? bank.questions.length : 0,
      errors: validateBank(bank, fileName),
    };
  } catch (error) {
    return { name: fileName, questionCount: 0, errors: [`${fileName}: ${error.message}`] };
  }
}

export async function validateDirectory(directory) {
  const files = [];
  const errors = [];
  for (const fileName of BANK_FILE_NAMES) {
    const result = await readAndValidate(path.join(directory, fileName));
    if (result.errors.length === 1 && /ENOENT/.test(result.errors[0])) {
      result.errors = [`${fileName}: missing required bank file`];
    }
    files.push(result);
    errors.push(...result.errors);
  }
  const totalQuestions = files.reduce((sum, file) => sum + file.questionCount, 0);
  if (totalQuestions !== 360) errors.push(`question banks: expected 360 questions, found ${totalQuestions}`);
  return { files, totalQuestions, errors };
}

async function runCli(args) {
  if (args.length > 1) {
    console.error('Usage: node scripts/validate-question-banks.mjs [bank.json]');
    return 1;
  }
  if (args.length === 1) {
    const result = await readAndValidate(path.resolve(args[0]));
    if (result.errors.length > 0) {
      console.error(result.errors.join('\n'));
      return 1;
    }
    console.log(`${result.name}: ${result.questionCount} questions, valid`);
    return 0;
  }

  const directory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'questions');
  const result = await validateDirectory(directory);
  if (result.errors.length > 0) {
    console.error(result.errors.join('\n'));
    return 1;
  }
  for (const file of result.files) console.log(`${file.name}: ${file.questionCount} questions, valid`);
  console.log(`Total: ${result.totalQuestions} questions, valid`);
  return 0;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  process.exitCode = await runCli(process.argv.slice(2));
}
