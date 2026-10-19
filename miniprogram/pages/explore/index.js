const { request } = require('../../services/api');
const config = require('../../config');
Page({
  data: { preview: config.mode !== 'cloud', view: 'list', places: [], markers: [], loading: false, error: '', nextCursor: null },
  onLoad() { this.load(); },
  async load() {
    this.setData({ loading: true, error: '' });
    try {
      const result = await request('places.list');
      this.setData({ places: result.places, nextCursor: result.nextCursor, markers: this.markers(result.places) });
    } catch (error) { this.setData({ error: error.message }); }
    finally { this.setData({ loading: false }); }
  },
  markers(places) {
    return places.map((place, index) => ({ id: index, latitude: place.latitude, longitude: place.longitude, title: place.name, iconPath: '/assets/marker.png', width: 28, height: 38 }));
  },
  async loadMore() {
    if (this.data.loading || !this.data.nextCursor) return;
    this.setData({ loading: true, error: '' });
    try {
      const result = await request('places.list', { cursor: this.data.nextCursor });
      const places = this.data.places.concat(result.places);
      this.setData({ places, markers: this.markers(places), nextCursor: result.nextCursor });
    } catch (error) { this.setData({ error: error.message }); }
    finally { this.setData({ loading: false }); }
  },
  changeView(event) { this.setData({ view: event.currentTarget.dataset.view }); },
  openPlace(event) { this.open(this.data.places.find(place => place.id === event.currentTarget.dataset.id)); },
  openMarker(event) { this.open(this.data.places[event.detail.markerId]); },
  open(place) { if (place) wx.navigateTo({ url: '/pages/detail/index?id=' + encodeURIComponent(place.id) }); }
});
