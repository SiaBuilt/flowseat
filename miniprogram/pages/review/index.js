const { request } = require('../../services/api');
Page({
  data: { items: [], loading: false, error: '' },
  onShow() { this.load(); },
  async load() {
    this.setData({ loading: true, error: '' });
    try { this.setData({ items: (await request('review.pending')).items }); }
    catch (error) { this.setData({ items: [], error: error.message }); }
    finally { this.setData({ loading: false }); }
  }
});
