const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
function argument(name) { const index = args.indexOf(name); return index === -1 ? '' : args[index + 1] || ''; }
const appid = argument('--appid');
const env = argument('--env');
if (!/^wx[a-fA-F0-9]{16}$/.test(appid) || !/^[a-zA-Z0-9_-]+$/.test(env)) {
  console.error('用法：npm run configure -- --appid wx真实AppID --env 真实云环境ID');
  process.exit(1);
}
const projectPath = path.join(root, 'project.config.json');
const project = JSON.parse(fs.readFileSync(projectPath, 'utf8'));
project.appid = appid;
fs.writeFileSync(projectPath, JSON.stringify(project, null, 2) + '\n');
fs.writeFileSync(path.join(root, 'miniprogram/config.js'), '// 非敏感公开配置；不要加入密钥。\nmodule.exports = ' + JSON.stringify({ mode: 'cloud', cloudEnv: env, city: '上海' }, null, 2) + ';\n');
console.log('已写入 AppID 和云环境ID。仍需创建集合、应用数据库规则、配置云函数环境变量并部署。');
