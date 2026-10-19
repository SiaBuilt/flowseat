const VISIBLE_STATUSES = ['candidate', 'visited', 'suspected_closed'];
const LABELS = { candidate: '待确认', visited: '有到访反馈', suspected_closed: '怀疑闭店' };
function fail(code, message) { const error = new Error(message); error.code = code; throw error; }
function identity(context, expectedAppId) {
  if (!expectedAppId) fail('SERVER_NOT_CONFIGURED', '服务端尚未配置所属小程序');
  if (!context || !context.OPENID || context.APPID !== expectedAppId) fail('UNAUTHENTICATED', '微信身份校验失败');
  return context.OPENID;
}
function canReview(openid, allowlist) {
  return Boolean(openid) && String(allowlist || '').split(',').map(item => item.trim()).filter(Boolean).includes(openid);
}
function requireReviewer(openid, allowlist) { if (!canReview(openid, allowlist)) fail('FORBIDDEN', '此账号没有审核权限'); }
function placeId(value) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(value)) fail('INVALID_INPUT', '地点编号无效');
  return value;
}
function preview(place) {
  return {
    id: place._id, name: String(place.name || ''), type: String(place.type || ''),
    district: String(place.district || ''), address: String(place.address || ''),
    latitude: place.latitude, longitude: place.longitude,
    status: place.status, statusLabel: LABELS[place.status] || '待确认'
  };
}
function validPlace(place) {
  return place && place.city === '上海' && VISIBLE_STATUSES.includes(place.status) &&
    typeof place.name === 'string' && place.name.trim().length > 0 &&
    Number.isFinite(place.latitude) && Number.isFinite(place.longitude) &&
    Math.abs(place.latitude) <= 90 && Math.abs(place.longitude) <= 180;
}
module.exports = { VISIBLE_STATUSES, fail, identity, canReview, requireReviewer, placeId, preview, validPlace };
