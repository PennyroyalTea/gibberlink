const path = require('path');

module.exports = {
  entry: './src/index.ts',
  mode: 'production',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  output: {
    filename: 'sal-sdk.js',
    path: path.resolve(__dirname, 'dist/umd'),
    library: 'salSDK',
    libraryTarget: 'umd',
    globalObject: 'this'
  },
  externals: {
    '@solana/web3.js': 'solanaWeb3'
  }
}; 