const config = require('../config');
async function request(action, payload = {}) {
  if (config.mode !== 'cloud' || !config.cloudEnv) {
    if (action === 'places.list') return { places: [], nextCursor: null };
    const error = new Error('尚未接入云环境，当前不能登录或审核');
    error.code = 'NOT_CONFIGURED';
    throw error;
  }
  if (!wx.cloud) throw new Error('当前微信版本不支持云开发，请更新微信');
  const response = await wx.cloud.callFunction({ name: 'api', data: { action, payload } });
  const result = response.result;
  if (!result || !result.ok) {
    const error = new Error(result && result.message || '服务暂时不可用，请重试');
    error.code = result && result.code || 'SERVICE_ERROR';
    throw error;
  }
  return result.data;
}
module.exports = { request };
