const webpack = require('webpack');

module.exports = {
  entry: './index.js',
  output: {
    filename: 'lasercam.js',
    library: 'lasercam',
    libraryTarget: 'window',
  },
  mode: 'production',
  plugins: [
   new webpack.BannerPlugin({banner:"(c) 2018 bookchain / Abe Winter. Pls don't steal this. Reach out to talk licensing."}),
  ],
};
