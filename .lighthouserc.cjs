module.exports = {
  ci: {
    collect: {
      startServerCommand: 'node tests/serve.cjs',
      startServerReadyPattern: 'Test server ready',
      url: ['http://localhost:4173/', 'http://localhost:4173/arcade/'],
      numberOfRuns: 1,
      settings: { chromeFlags: '--no-sandbox', onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'] }
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.6 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 6000 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.15 }],
        'total-byte-weight': ['error', { maxNumericValue: 1500000 }]
      }
    },
    upload: { target: 'filesystem', outputDir: './performance-report' }
  }
};
