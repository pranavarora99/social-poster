// Chrome Extension Build Script using esbuild
const esbuild = require('esbuild');
const fs = require('fs');

// Chrome extension specific build configuration
const buildConfig = {
  entryPoints: {
    'popup': 'src/popup.ts',
    'background': 'src/background.ts', 
    'content': 'src/content.ts'
  },
  bundle: true,
  outdir: 'dist',
  format: 'iife', // Immediately Invoked Function Expression - perfect for Chrome extensions
  platform: 'browser',
  target: 'chrome58', // Target Chrome 58+ for good compatibility
  minify: false, // Keep readable for debugging
  sourcemap: true,
  define: {
    'process.env.NODE_ENV': '"production"'
  },
  loader: {
    '.ts': 'ts'
  }
};

async function build() {
  try {
    console.log('🔨 Building Chrome Extension...');
    
    // Clean dist directory
    if (fs.existsSync('dist')) {
      fs.rmSync('dist', { recursive: true });
    }
    fs.mkdirSync('dist', { recursive: true });
    
    // Build all entry points
    await esbuild.build(buildConfig);
    
    console.log('✅ Chrome Extension built successfully!');
    console.log('📁 Output files:');
    
    // List built files
    const files = fs.readdirSync('dist');
    files.forEach(file => {
      const stats = fs.statSync(`dist/${file}`);
      console.log(`   - ${file} (${Math.round(stats.size / 1024)}KB)`);
    });
    
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

// Build for development with watch mode
async function buildDev() {
  console.log('🔨 Building Chrome Extension in development mode...');
  
  const devConfig = {
    ...buildConfig,
    minify: false,
    sourcemap: true,
    define: {
      'process.env.NODE_ENV': '"development"'
    }
  };
  
  try {
    await esbuild.build(devConfig);
    console.log('✅ Development build complete!');
  } catch (error) {
    console.error('❌ Development build failed:', error);
    process.exit(1);
  }
}

// Run based on command line argument
const isDev = process.argv.includes('--dev');
if (isDev) {
  buildDev();
} else {
  build();
}