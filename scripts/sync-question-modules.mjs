import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const questionDirectory = path.join(root, 'questions');
const outputDirectory = path.join(questionDirectory, 'generated');
const names = ['politics', 'common-sense', 'verbal', 'quantitative', 'reasoning', 'data-analysis'];

fs.mkdirSync(outputDirectory, { recursive: true });

for (const name of names) {
  const source = path.join(questionDirectory, `${name}.json`);
  const output = path.join(outputDirectory, `${name}.js`);
  const bank = JSON.parse(fs.readFileSync(source, 'utf8'));
  fs.writeFileSync(output, `// Generated from questions/${name}.json. Do not edit directly.\nmodule.exports = ${JSON.stringify(bank)};\n`);
  process.stdout.write(`${name}.js: ${bank.questionCount} questions\n`);
}
