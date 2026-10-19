const { request } = require('../../services/api');
Page({
  data: { place: null, error: '', loading: true },
  onLoad(options) { this.placeId = options.id; this.load(); },
  async load() {
    this.setData({ loading: true, error: '' });
    try { this.setData({ place: await request('places.get', { id: this.placeId }) }); }
    catch (error) { this.setData({ error: error.message }); }
    finally { this.setData({ loading: false }); }
  }
});
