const test = require('node:test');
const assert = require('node:assert/strict');
const { createHandler } = require('../cloudfunctions/api/handler');
const d = require('../cloudfunctions/api/domain');
const env = { MINIPROGRAM_APPID: 'wx0123456789abcdef', REVIEWER_OPENIDS: 'owner-1' };
function api(openid, db = {}) { return createHandler({ db, context: { OPENID: openid, APPID: env.MINIPROGRAM_APPID }, env }); }
test('前端伪造账号或角色不能读取审核队列，也不会访问数据库', async () => {
  const result = await api('visitor')({ action: 'review.pending', payload: { openid: 'owner-1', role: 'admin', canReview: true } });
  assert.equal(result.code, 'FORBIDDEN');
});
test('空审核员配置默认拒绝所有用户', () => {
  assert.equal(d.canReview('owner-1', ''), false);
  assert.equal(d.canReview('owner', 'owner-1'), false);
});
test('非所属小程序和缺失服务端配置不能通过身份校验', () => {
  assert.throws(() => d.identity({ OPENID: 'owner-1', APPID: 'another' }, env.MINIPROGRAM_APPID), { code: 'UNAUTHENTICATED' });
  assert.throws(() => d.identity({ OPENID: 'owner-1', APPID: env.MINIPROGRAM_APPID }, ''), { code: 'SERVER_NOT_CONFIGURED' });
});
test('指定审核员可以读取队列，但响应不泄露举报者OpenID', async () => {
  const query = { where() { return this; }, orderBy() { return this; }, limit() { return this; }, async get() { return { data: [{ _id: 'task-1', kind: '闭店', summary: '待确认', reporterOpenid: 'private' }] }; } };
  const result = await api('owner-1', { collection() { return query; } })({ action: 'review.pending' });
  assert.equal(result.ok, true);
  assert.equal(result.data.items[0].id, 'task-1');
  assert.equal('reporterOpenid' in result.data.items[0], false);
});
test('基础预览不泄露账号、完整办公数据和第三方评价正文', () => {
  const projected = d.preview({ _id: 'p-1', name: '测试', status: 'candidate', ownerOpenid: 'private', reviews: ['private'], workingConditions: { secret: true } });
  assert.equal('ownerOpenid' in projected, false);
  assert.equal('reviews' in projected, false);
  assert.equal('workingConditions' in projected, false);
});
test('隐藏地点即使通过旧链接也不可读', async () => {
  const query = { where(filter) { assert.ok(filter.status); return this; }, limit() { return this; }, async get() { return { data: [] }; } };
  const result = await api('visitor', { collection() { return query; }, command: { in(values) { assert.equal(values.includes('closed'), false); return values; } } })({ action: 'places.get', payload: { id: 'p-1' } });
  assert.equal(result.code, 'NOT_FOUND');
});
test('缺失数据库集合不能被包装成空地图或登录成功', async () => {
  const result = await api('visitor', { collection() { throw new Error('missing collection'); } })({ action: 'places.list' });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'SERVICE_ERROR');
});
test('本版本不允许前端制造支付成功或授予权益', async () => {
  const result = await api('visitor')({ action: 'payment.success', payload: { paid: true } });
  assert.equal(result.code, 'UNKNOWN_ACTION');
});
test('无效坐标和失效地点不能成为地图标记', () => {
  const place = { city: '上海', status: 'candidate', name: '仅测试', latitude: 31.2, longitude: 121.4 };
  assert.equal(d.validPlace(place), true);
  assert.equal(d.validPlace({ ...place, status: 'closed' }), false);
  assert.equal(d.validPlace({ ...place, latitude: '31.2' }), false);
});
test('首次登录只在缺少用户文档时创建，重复登录保留已有昵称', async () => {
  let stored;
  let writes = 0;
  const ref = { async get() { return { data: stored }; }, async set({ data }) { stored = data; writes++; } };
  const db = { serverDate() { return 'server-time'; }, async runTransaction(callback) { return callback({ collection() { return { doc(id) { assert.equal(id, 'owner-1'); return ref; } }; } }); } };
  const first = await api('owner-1', db)({ action: 'session.login', payload: { nickname: '伪造', openid: 'victim' } });
  assert.equal(first.data.accountId, 'owner-1');
  assert.equal(first.data.canReview, true);
  stored.nickname = '已设置的昵称';
  const second = await api('owner-1', db)({ action: 'session.login' });
  assert.equal(second.data.nickname, '已设置的昵称');
  assert.equal(writes, 1);
});
test('数据库错误不触发创建账号或覆盖已有资料', async () => {
  const db = { async runTransaction(callback) { return callback({ collection() { return { doc() { return { async get() { throw new Error('collection does not exist'); }, async set() { assert.fail('不能创建'); } }; } }; } }); } };
  const result = await api('owner-1', db)({ action: 'session.login' });
  assert.equal(result.code, 'SERVICE_ERROR');
});
test('翻页保持城市和可见状态约束', async () => {
  const query = { where(filter) { assert.equal(filter.city, '上海'); assert.deepEqual(filter.status, d.VISIBLE_STATUSES); assert.deepEqual(filter._id, { gt: 'p-1' }); return this; }, orderBy() { return this; }, limit() { return this; }, async get() { return { data: [] }; } };
  const db = { collection() { return query; }, command: { in(value) { return value; }, gt(value) { return { gt: value }; } } };
  const result = await api('visitor', db)({ action: 'places.list', payload: { cursor: 'p-1' } });
  assert.equal(result.ok, true);
});
