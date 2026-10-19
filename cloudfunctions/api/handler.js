const d = require('./domain');
function createHandler({ db, context, env, log = () => {} }) {
  return async function handle(event = {}) {
    try {
      const openid = d.identity(context, env.MINIPROGRAM_APPID);
      const payload = event.payload || {};
      const reviewer = d.canReview(openid, env.REVIEWER_OPENIDS);
      let data;
      switch (event.action) {
        case 'session.login': {
          const user = await db.runTransaction(async transaction => {
            const ref = transaction.collection('users').doc(openid);
            let found;
            try { found = await ref.get(); }
            catch (error) {
              // 仅将明确的“单个文档不存在”视为首次登录；集合/网络错误继续失败。
              if (!/document.*does not exist/i.test(error.errMsg || error.message || '')) throw error;
            }
            if (found && found.data) return found.data;
            const created = { nickname: '工位同行者', createdAt: db.serverDate() };
            await ref.set({ data: created });
            return created;
          });
          data = { accountId: openid, nickname: user.nickname || '工位同行者', canReview: reviewer };
          break;
        }
        case 'places.list': {
          const filter = { city: '上海', status: db.command.in(d.VISIBLE_STATUSES) };
          if (payload.cursor) filter._id = db.command.gt(d.placeId(payload.cursor));
          const query = db.collection('places').where(filter);
          const result = await query.orderBy('_id', 'asc').limit(20).get();
          data = { places: result.data.filter(d.validPlace).map(d.preview), nextCursor: result.data.length === 20 ? result.data[19]._id : null };
          break;
        }
        case 'places.get': {
          const result = await db.collection('places').where({ _id: d.placeId(payload.id), city: '上海', status: db.command.in(d.VISIBLE_STATUSES) }).limit(1).get();
          if (!result.data.length || !d.validPlace(result.data[0])) d.fail('NOT_FOUND', '地点不存在或已隐藏');
          data = d.preview(result.data[0]);
          break;
        }
        case 'review.pending': {
          d.requireReviewer(openid, env.REVIEWER_OPENIDS);
          const result = await db.collection('review_tasks').where({ status: 'pending' }).orderBy('createdAt', 'asc').limit(30).get();
          data = { items: result.data.map(item => ({ id: item._id, kind: item.kind || '待审核', summary: item.summary || '' })) };
          break;
        }
        default: d.fail('UNKNOWN_ACTION', '当前版本尚未提供此功能');
      }
      return { ok: true, data };
    } catch (error) {
      if (!error.code) log(error);
      const known = ['SERVER_NOT_CONFIGURED', 'UNAUTHENTICATED', 'FORBIDDEN', 'INVALID_INPUT', 'NOT_FOUND', 'UNKNOWN_ACTION'].includes(error.code);
      return { ok: false, code: known ? error.code : 'SERVICE_ERROR', message: known ? error.message : '服务暂时不可用，请稍后重试' };
    }
  };
}
module.exports = { createHandler };
