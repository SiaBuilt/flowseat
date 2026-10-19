const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    if (['node_modules', '.git', 'dist', 'unpackage', '.wrangler', '.sites-runtime', '.vinext', '.next', '.vite'].includes(entry.name)) return [];
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}
const files = walk(root);
for (const file of files) {
  if (file.endsWith('.json')) JSON.parse(fs.readFileSync(file, 'utf8'));
  if (file.endsWith('.js')) execFileSync(process.execPath, ['--check', file]);
}
const app = JSON.parse(fs.readFileSync(path.join(root, 'miniprogram/app.json')));
for (const page of app.pages) {
  for (const suffix of ['.js', '.wxml']) {
    if (!fs.existsSync(path.join(root, 'miniprogram', page + suffix))) throw new Error('页面文件缺失：' + page + suffix);
  }
}
const rule = JSON.parse(fs.readFileSync(path.join(root, 'infrastructure/database.rules.json')));
if (rule.read !== false || rule.write !== false) throw new Error('数据库默认不能向客户端开放');
console.log('JS 语法、JSON、页面路径、数据库默认规则检查通过；尚未进行微信开发者工具编译。');
