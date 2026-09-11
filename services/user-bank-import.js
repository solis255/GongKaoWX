const BANK_FIELDS = ['version', 'subject', 'category', 'title', 'description', 'questionCount', 'materials', 'questions'];
const QUESTION_FIELDS = [
  'id', 'type', 'category', 'subtype', 'difficulty', 'stem', 'materialId', 'options',
  'answer', 'explanation', 'knowledgePoints', 'sourceRefs', 'status',
];
const REQUIRED_QUESTION_FIELDS = QUESTION_FIELDS.filter((field) => field !== 'type');
const MATERIAL_FIELDS = ['id', 'title', 'content', 'sourceRefs'];
const SOURCE_FIELDS = ['kind', 'title', 'url', 'publishedAt', 'accessedAt'];
const OPTION_FIELDS = ['key', 'text'];
const DIFFICULTIES = new Set(['easy', 'medium', 'hard', 'unknown']);
const ANSWERS = ['A', 'B', 'C', 'D'];
const SOURCE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

function normalizeText(value) {
  return String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .trim();
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => (
      `${JSON.stringify(key)}:${stableStringify(value[key])}`
    )).join(',')}}`;
  }
  return JSON.stringify(value);
}

function utf8Bytes(value) {
  const bytes = [];
  for (const character of String(value)) {
    const code = character.codePointAt(0);
    if (code <= 0x7f) bytes.push(code);
    else if (code <= 0x7ff) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    else if (code <= 0xffff) {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    }
  }
  return bytes;
}

function rotateRight(value, count) {
  return (value >>> count) | (value << (32 - count));
}

function sha256(value) {
  const constants = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
    0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
    0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
    0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
    0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
    0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  const hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];
  const bytes = utf8Bytes(value);
  const bitLength = bytes.length * 8;
  bytes.push(0x80);
  while ((bytes.length % 64) !== 56) bytes.push(0);
  const high = Math.floor(bitLength / 0x100000000);
  const low = bitLength >>> 0;
  for (let shift = 24; shift >= 0; shift -= 8) bytes.push((high >>> shift) & 0xff);
  for (let shift = 24; shift >= 0; shift -= 8) bytes.push((low >>> shift) & 0xff);

  for (let offset = 0; offset < bytes.length; offset += 64) {
    const words = new Array(64);
    for (let index = 0; index < 16; index += 1) {
      const position = offset + index * 4;
      words[index] = (
        (bytes[position] << 24) | (bytes[position + 1] << 16)
        | (bytes[position + 2] << 8) | bytes[position + 3]
      );
    }
    for (let index = 16; index < 64; index += 1) {
      const x = words[index - 15];
      const y = words[index - 2];
      const sigma0 = rotateRight(x, 7) ^ rotateRight(x, 18) ^ (x >>> 3);
      const sigma1 = rotateRight(y, 17) ^ rotateRight(y, 19) ^ (y >>> 10);
      words[index] = (words[index - 16] + sigma0 + words[index - 7] + sigma1) | 0;
    }
    let [a, b, c, d, e, f, g, h] = hash;
    for (let index = 0; index < 64; index += 1) {
      const sum1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choice = (e & f) ^ (~e & g);
      const temp1 = (h + sum1 + choice + constants[index] + words[index]) | 0;
      const sum0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (sum0 + majority) | 0;
      h = g; g = f; f = e; e = (d + temp1) | 0;
      d = c; c = b; b = a; a = (temp1 + temp2) | 0;
    }
    hash[0] = (hash[0] + a) | 0; hash[1] = (hash[1] + b) | 0;
    hash[2] = (hash[2] + c) | 0; hash[3] = (hash[3] + d) | 0;
    hash[4] = (hash[4] + e) | 0; hash[5] = (hash[5] + f) | 0;
    hash[6] = (hash[6] + g) | 0; hash[7] = (hash[7] + h) | 0;
  }
  return hash.map((word) => (word >>> 0).toString(16).padStart(8, '0')).join('');
}

function unknownFields(value, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  const set = new Set(allowed);
  return Object.keys(value).filter((key) => !set.has(key));
}

function missingFields(value, required) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return required.slice();
  return required.filter((key) => !Object.prototype.hasOwnProperty.call(value, key));
}

function normalizeSourceRefs(value, owner, issues) {
  if (!Array.isArray(value)) {
    issues.push(`${owner}：sourceRefs 必须是数组`);
    return [];
  }
  return value.map((source, index) => {
    const label = `${owner}来源${index + 1}`;
    if (!source || typeof source !== 'object' || Array.isArray(source)) {
      issues.push(`${label}：必须是对象`);
      return { kind: '', title: '' };
    }
    const missing = missingFields(source, ['kind', 'title']);
    if (missing.length) issues.push(`${label}：缺少字段 ${missing.join('、')}`);
    const extra = unknownFields(source, SOURCE_FIELDS);
    if (extra.length) issues.push(`${label}：包含未知字段 ${extra.join('、')}`);
    const normalized = {
      kind: normalizeText(source?.kind),
      title: normalizeText(source?.title),
    };
    if (typeof source.kind !== 'string' || typeof source.title !== 'string') {
      issues.push(`${label}：kind 和 title 必须是字符串`);
    }
    if (!normalized.kind || !normalized.title) issues.push(`${label}：kind 和 title 不能为空`);
    for (const field of ['url', 'publishedAt', 'accessedAt']) {
      if (source && Object.prototype.hasOwnProperty.call(source, field)) {
        normalized[field] = normalizeText(source[field]);
        if (!normalized[field]) issues.push(`${label}：${field} 不能为空`);
        if (typeof source[field] !== 'string') issues.push(`${label}：${field} 必须是字符串`);
      }
    }
    if (normalized.url && !/^[A-Za-z][A-Za-z0-9+.-]*:/.test(normalized.url)) {
      issues.push(`${label}：url 不是有效 URI`);
    }
    for (const field of ['publishedAt', 'accessedAt']) {
      if (normalized[field] && !/^\d{4}-\d{2}-\d{2}$/.test(normalized[field])) {
        issues.push(`${label}：${field} 必须使用 YYYY-MM-DD`);
      }
    }
    return normalized;
  });
}

function questionFingerprint(question, materialContent = '') {
  return sha256(stableStringify({
    material: normalizeText(materialContent),
    stem: normalizeText(question.stem),
    options: question.options.map(({ key, text }) => ({ key, text: normalizeText(text) })),
  }));
}

function prepareUserBankImport(input, existingBanks = []) {
  let source = input;
  const fatalErrors = [];
  if (typeof input === 'string') {
    try { source = JSON.parse(input.replace(/^\uFEFF/, '')); }
    catch (error) {
      return {
        canImport: false,
        fatalErrors: [`JSON 无法解析：${error.message}`],
        issues: [],
        duplicates: [],
        summary: { total: 0, valid: 0, invalid: 0, duplicate: 0, crossBankDuplicate: 0 },
      };
    }
  }
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    return {
      canImport: false,
      fatalErrors: ['题库根节点必须是对象'], issues: [], duplicates: [],
      summary: { total: 0, valid: 0, invalid: 0, duplicate: 0, crossBankDuplicate: 0 },
    };
  }
  const extraBankFields = unknownFields(source, BANK_FIELDS);
  if (extraBankFields.length) fatalErrors.push(`题库包含未知字段：${extraBankFields.join('、')}`);
  const missingBankFields = missingFields(source, ['version', 'category', 'title', 'questionCount', 'materials', 'questions']);
  if (missingBankFields.length) fatalErrors.push(`题库缺少字段：${missingBankFields.join('、')}`);
  if (source.version !== 1) fatalErrors.push('version 必须为 1');
  const title = normalizeText(source.title);
  const category = normalizeText(source.category);
  if (!title) fatalErrors.push('title 不能为空');
  if (!category) fatalErrors.push('category 不能为空');
  if (typeof source.title !== 'string') fatalErrors.push('title 必须是字符串');
  if (typeof source.category !== 'string') fatalErrors.push('category 必须是字符串');
  if (Object.prototype.hasOwnProperty.call(source, 'subject')) {
    if (typeof source.subject !== 'string' || !normalizeText(source.subject)) fatalErrors.push('subject 必须是非空字符串');
    else if (normalizeText(source.subject).length > 20) fatalErrors.push('subject 不能超过 20 个字符');
  }
  if (Object.prototype.hasOwnProperty.call(source, 'description') && typeof source.description !== 'string') {
    fatalErrors.push('description 必须是字符串');
  }
  if (!Number.isInteger(source.questionCount) || source.questionCount < 1) {
    fatalErrors.push('questionCount 必须是正整数');
  }
  if (!Array.isArray(source.materials)) fatalErrors.push('materials 必须是数组');
  if (!Array.isArray(source.questions) || !source.questions.length) fatalErrors.push('questions 必须是非空数组');

  const materialIssues = [];
  const materialIds = new Set();
  const materials = Array.isArray(source.materials) ? source.materials.map((material, index) => {
    const owner = `材料${index + 1}`;
    if (!material || typeof material !== 'object' || Array.isArray(material)) {
      materialIssues.push(`${owner}：必须是对象`);
      return { id: '', title: '', content: '', sourceRefs: [] };
    }
    const missing = missingFields(material, MATERIAL_FIELDS);
    if (missing.length) materialIssues.push(`${owner}：缺少字段 ${missing.join('、')}`);
    const extra = unknownFields(material, MATERIAL_FIELDS);
    if (extra.length) materialIssues.push(`${owner}：包含未知字段 ${extra.join('、')}`);
    const normalized = {
      id: normalizeText(material?.id),
      title: normalizeText(material?.title),
      content: normalizeText(material?.content),
      sourceRefs: normalizeSourceRefs(material?.sourceRefs, owner, materialIssues),
    };
    for (const field of ['id', 'title', 'content']) {
      if (typeof material[field] !== 'string') materialIssues.push(`${owner}：${field} 必须是字符串`);
    }
    if (!normalized.id) materialIssues.push(`${owner}：id 不能为空`);
    else if (!SOURCE_ID_PATTERN.test(normalized.id)) materialIssues.push(`${owner}：id 格式不合法`);
    else if (materialIds.has(normalized.id)) materialIssues.push(`${owner}：材料 ID 重复`);
    else materialIds.add(normalized.id);
    if (!normalized.title) materialIssues.push(`${owner}：title 不能为空`);
    if (!normalized.content) materialIssues.push(`${owner}：content 不能为空`);
    return normalized;
  }) : [];
  const materialMap = new Map(materials.map((material) => [material.id, material]));

  if (materialIssues.length) fatalErrors.push(...materialIssues);
  const issues = [];
  const duplicates = [];
  const fingerprints = new Set();
  const existingFingerprints = new Set(
    existingBanks.flatMap((bank) => Array.isArray(bank.questionFingerprints) ? bank.questionFingerprints : []),
  );
  let invalidCount = 0;
  let crossBankDuplicate = 0;
  const questions = [];
  const sourceIds = new Set();

  for (const [index, question] of (Array.isArray(source.questions) ? source.questions : []).entries()) {
    const owner = `第${index + 1}题`;
    const questionIssues = [];
    if (!question || typeof question !== 'object' || Array.isArray(question)) {
      invalidCount += 1;
      issues.push(`${owner}：必须是对象`);
      continue;
    }
    const missing = missingFields(question, REQUIRED_QUESTION_FIELDS);
    if (missing.length) questionIssues.push(`缺少字段 ${missing.join('、')}`);
    const extra = unknownFields(question, QUESTION_FIELDS);
    if (extra.length) questionIssues.push(`包含未知字段 ${extra.join('、')}`);
    const sourceId = normalizeText(question?.id);
    if (!sourceId) questionIssues.push('id 不能为空');
    else if (!SOURCE_ID_PATTERN.test(sourceId)) questionIssues.push('id 格式不合法');
    else if (sourceIds.has(sourceId)) questionIssues.push(`题目 ID 重复：${sourceId}`);
    else sourceIds.add(sourceId);
    const options = Array.isArray(question?.options) ? question.options.map((option, optionIndex) => {
      if (!option || typeof option !== 'object' || Array.isArray(option)) {
        questionIssues.push(`选项${optionIndex + 1}必须是对象`);
        return { key: '', text: '' };
      }
      const optionMissing = missingFields(option, OPTION_FIELDS);
      if (optionMissing.length) questionIssues.push(`选项${optionIndex + 1}缺少字段 ${optionMissing.join('、')}`);
      const optionExtra = unknownFields(option, OPTION_FIELDS);
      if (optionExtra.length) questionIssues.push(`选项${optionIndex + 1}包含未知字段 ${optionExtra.join('、')}`);
      if (typeof option.key !== 'string' || typeof option.text !== 'string') {
        questionIssues.push(`选项${optionIndex + 1}的 key 和 text 必须是字符串`);
      }
      return { key: normalizeText(option?.key).toUpperCase(), text: normalizeText(option?.text) };
    }) : [];
    if (options.map(({ key }) => key).join(',') !== 'A,B,C,D') questionIssues.push('选项必须按 A、B、C、D 排列');
    if (options.some(({ text }) => !text)) questionIssues.push('选项内容不能为空');
    if (new Set(options.map(({ text }) => text)).size !== options.length) questionIssues.push('选项内容不能重复');
    const type = question.type === undefined ? 'single-choice' : normalizeText(question.type);
    if (!['single-choice', 'multiple-choice'].includes(type)) {
      questionIssues.push('type 必须是 single-choice 或 multiple-choice');
    }
    if (question.type !== undefined && typeof question.type !== 'string') {
      questionIssues.push('type 必须是字符串');
    }
    let answer;
    if (type === 'multiple-choice') {
      if (!Array.isArray(question.answer)) {
        questionIssues.push('多选题答案必须是数组');
        answer = [];
      } else {
        answer = [...new Set(question.answer.map((item) => normalizeText(item).toUpperCase()))];
        answer = ANSWERS.filter((key) => answer.includes(key));
        if (question.answer.some((item) => typeof item !== 'string')) {
          questionIssues.push('多选题答案数组只能包含字符串');
        }
        if (answer.length < 2 || answer.length !== question.answer.length) {
          questionIssues.push('多选题答案必须包含至少两个不重复的 A、B、C、D 选项');
        }
      }
    } else {
      answer = typeof question.answer === 'string' ? normalizeText(question.answer).toUpperCase() : '';
      if (!ANSWERS.includes(answer)) questionIssues.push('单选题答案必须是 A、B、C、D 之一');
    }
    const difficulty = normalizeText(question?.difficulty);
    if (!DIFFICULTIES.has(difficulty)) questionIssues.push('difficulty 必须是 easy、medium、hard 或 unknown');
    const materialId = question?.materialId === null ? null : normalizeText(question?.materialId);
    if (question?.materialId !== null && typeof question?.materialId !== 'string') {
      questionIssues.push('materialId 必须是字符串或 null');
    }
    if (materialId !== null && (!materialId || !materialIds.has(materialId))) questionIssues.push('materialId 未指向有效材料');
    const knowledgePoints = Array.isArray(question?.knowledgePoints)
      ? [...new Set(question.knowledgePoints.map(normalizeText).filter(Boolean))] : [];
    if (!Array.isArray(question?.knowledgePoints)) questionIssues.push('knowledgePoints 必须是数组');
    else if (question.knowledgePoints.some((point) => typeof point !== 'string' || !normalizeText(point))) {
      questionIssues.push('knowledgePoints 只能包含非空字符串');
    }
    const normalized = {
      id: sourceId,
      type,
      category: normalizeText(question?.category),
      subtype: normalizeText(question?.subtype),
      difficulty,
      stem: normalizeText(question?.stem),
      materialId,
      options,
      answer,
      explanation: normalizeText(question?.explanation),
      knowledgePoints,
      sourceRefs: normalizeSourceRefs(question?.sourceRefs, owner, questionIssues),
      status: normalizeText(question?.status),
    };
    for (const field of ['id', 'category', 'subtype', 'difficulty', 'stem', 'explanation', 'status']) {
      if (typeof question[field] !== 'string') questionIssues.push(`${field} 必须是字符串`);
    }
    if (!normalized.category) questionIssues.push('category 不能为空');
    if (!normalized.subtype) questionIssues.push('subtype 不能为空');
    if (!normalized.stem) questionIssues.push('stem 不能为空');
    if (!['draft', 'reviewed'].includes(normalized.status)) questionIssues.push('status 必须是 draft 或 reviewed');
    if (questionIssues.length) {
      invalidCount += 1;
      issues.push(...questionIssues.map((message) => `${owner}：${message}`));
      continue;
    }
    const fingerprint = questionFingerprint(normalized, materialMap.get(materialId)?.content || '');
    if (fingerprints.has(fingerprint)) {
      duplicates.push(`${owner}：与文件内前面的题目重复`);
      continue;
    }
    fingerprints.add(fingerprint);
    if (existingFingerprints.has(fingerprint)) crossBankDuplicate += 1;
    questions.push({ ...normalized, fingerprint });
  }

  if (source.questionCount !== (Array.isArray(source.questions) ? source.questions.length : 0)) {
    fatalErrors.push('questionCount 与 questions 实际数量不一致');
  }
  const normalizedBank = {
    version: 1,
    subject: normalizeText(source.subject),
    category,
    title,
    description: normalizeText(source.description),
    materials,
    questions,
  };
  const { subject: subjectSuggestion, ...bankContent } = normalizedBank;
  const contentHash = sha256(stableStringify(bankContent));
  const exactDuplicate = existingBanks.find((bank) => bank.contentHash === contentHash);
  if (exactDuplicate) fatalErrors.push(`该题库已于 ${exactDuplicate.importedAtText || '此前'} 导入：${exactDuplicate.name}`);
  return {
    canImport: fatalErrors.length === 0 && questions.length > 0,
    fatalErrors,
    issues,
    duplicates,
    contentHash,
    bank: normalizedBank,
    summary: {
      total: Array.isArray(source.questions) ? source.questions.length : 0,
      valid: questions.length,
      invalid: invalidCount,
      duplicate: duplicates.length,
      crossBankDuplicate,
    },
  };
}

module.exports = {
  prepareUserBankImport,
  questionFingerprint,
  normalizeText,
  sha256,
  stableStringify,
};
