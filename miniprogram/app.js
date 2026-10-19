const config = require('./config');
App({
  globalData: { config, session: null },
  onLaunch() {
    if (config.mode === 'cloud' && config.cloudEnv && wx.cloud) {
      wx.cloud.init({ env: config.cloudEnv, traceUser: false });
    }
  }
});
