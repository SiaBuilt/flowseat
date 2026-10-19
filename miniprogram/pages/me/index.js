const { request } = require('../../services/api');
const config = require('../../config');
Page({
  data: { preview: config.mode !== 'cloud', session: null, loading: false, error: '' },
  onShow() { this.setData({ session: getApp().globalData.session }); },
  async login() {
    if (this.data.loading) return;
    this.setData({ loading: true, error: '' });
    try {
      const session = await request('session.login');
      getApp().globalData.session = session;
      this.setData({ session });
    } catch (error) { this.setData({ error: error.message }); }
    finally { this.setData({ loading: false }); }
  },
  review() { wx.navigateTo({ url: '/pages/review/index' }); },
  copyAccount() {
    if (this.data.session) wx.setClipboardData({ data: this.data.session.accountId });
  }
});
