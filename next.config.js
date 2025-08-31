/** @type {import('next').NextConfig} */
const withTM = require("next-transpile-modules")([
  "@lookingglass/webxr-polyfill",
  "@lookingglass/webxr"
]);

const nextConfig = withTM({
  reactStrictMode: true,
  swcMinify: true,

  // Enable CORS for API routes
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,OPTIONS,PATCH,DELETE,POST,PUT' },
          { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization' },
        ],
      },
    ];
  },

  // Serve static files from the static directory
  async rewrites() {
    return [
      {
        source: '/static/:path*',
        destination: '/static/:path*',
      },
    ];
  },

  // Webpack configuration for audio and 3D files
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ".js": [".js", ".ts"],
    };

    // Handle audio files
    config.module.rules.push({
      test: /\.(mp3|wav|ogg)$/,
      use: {
        loader: 'file-loader',
        options: {
          publicPath: '/_next/static/audio/',
          outputPath: 'static/audio/',
          name: '[name].[ext]',
        },
      },
    });

    // Handle 3D model files
    config.module.rules.push({
      test: /\.(gltf|glb|vrm|fbx)$/,
      use: {
        loader: 'file-loader',
        options: {
          publicPath: '/_next/static/models/',
          outputPath: 'static/models/',
          name: '[name].[ext]',
        },
      },
    });

    return config;
  },
});

module.exports = nextConfig;
