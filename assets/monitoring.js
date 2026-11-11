/* Public browser error reporting. The DSN is a public ingestion address, not a secret. */
(function () {
  'use strict';
  if (!window.Sentry || !/^(placesiwent\.eu|www\.placesiwent\.eu|localhost|127\.0\.0\.1)$/.test(location.hostname)) return;

  function cleanUrl(value) {
    if (typeof value !== 'string') return value;
    try {
      var url = new URL(value, location.origin);
      url.search = '';
      url.hash = '';
      url.username = '';
      url.password = '';
      return url.href;
    } catch (_) { return '[invalid URL]'; }
  }

  var development = /\/(dev|Meshdev)(\/|$)/i.test(location.pathname) || /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  try {
    window.Sentry.init({
      dsn: 'https://8d2f9ee74984b87db50404c015d008a5@o4512413287710720.ingest.de.sentry.io/4512413325852752',
      environment: development ? 'development' : 'production',
      release: 'placesiwent-monitoring@1.0.0',
      sampleRate: 1,
      tracesSampleRate: 0,
      autoSessionTracking: false,
      maxBreadcrumbs: 0,
      defaultIntegrations: false,
      integrations: [window.Sentry.globalHandlersIntegration(), window.Sentry.inboundFiltersIntegration(), window.Sentry.dedupeIntegration()],
      dataCollection: {
        userInfo: false, cookies: false, httpHeaders: false, httpBodies: [],
        urlQueryParams: false, graphQL: { document: false, variables: false },
        genAI: { inputs: false, outputs: false }, mcp: { inputs: false, outputs: false },
        databaseQueryData: false, queues: false, stackFrameVariables: false,
        frameContextLines: 0
      },
      beforeSend: function (event) {
        delete event.user;
        delete event.breadcrumbs;
        delete event.extra;
        event.request = { url: cleanUrl(location.href) };
        if (event.exception && event.exception.values) {
          event.exception.values.forEach(function (exception) {
            if (exception.stacktrace && exception.stacktrace.frames) {
              exception.stacktrace.frames.forEach(function (frame) {
                if (frame.filename) frame.filename = cleanUrl(frame.filename);
                delete frame.vars;
              });
            }
          });
        }
        return event;
      }
    });
  } catch (_) { /* A monitoring failure must not interrupt the application. */ }
}());
