// Service Worker for PSYCH 302 - Offline Access
// Cache-first strategy for HTML/CSS, Network-first for external resources

const CACHE_NAME = 'psych302-v1';
const URLS_TO_CACHE = [
  '/',
  '/index.html',
  '/styles/main.css',
  '/syllabus.html',
  '/calendar.html',
  '/today.html',
  '/course-navigation.html',
  '/course-literature.html',
  '/assignments.html',
  '/interactive-demos.html',
  // Lecture pages (01-17)
  '/lectures/lecture-01.html',
  '/lectures/lecture-02.html',
  '/lectures/lecture-03.html',
  '/lectures/lecture-04.html',
  '/lectures/lecture-05.html',
  '/lectures/lecture-06.html',
  '/lectures/lecture-07.html',
  '/lectures/lecture-08.html',
  '/lectures/lecture-09.html',
  '/lectures/lecture-10.html',
  '/lectures/lecture-11.html',
  '/lectures/lecture-12.html',
  '/lectures/lecture-13.html',
  '/lectures/lecture-14.html',
  '/lectures/lecture-15.html',
  '/lectures/lecture-16.html',
  '/lectures/lecture-17.html',
  // Lecture content pages (01-17)
  '/lecture-content/lecture-01/index.html',
  '/lecture-content/lecture-02/index.html',
  '/lecture-content/lecture-03/index.html',
  '/lecture-content/lecture-04/index.html',
  '/lecture-content/lecture-05/index.html',
  '/lecture-content/lecture-06/index.html',
  '/lecture-content/lecture-07/index.html',
  '/lecture-content/lecture-08/index.html',
  '/lecture-content/lecture-09/index.html',
  '/lecture-content/lecture-10/index.html',
  '/lecture-content/lecture-11/index.html',
  '/lecture-content/lecture-12/index.html',
  '/lecture-content/lecture-13/index.html',
  '/lecture-content/lecture-14/index.html',
  '/lecture-content/lecture-15/index.html',
  '/lecture-content/lecture-16/index.html',
  '/lecture-content/lecture-17/index.html',
  // Google Fonts
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap'
];

// Install event: Cache all specified resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(URLS_TO_CACHE);
      })
      .catch((err) => {
        console.error('Cache installation failed:', err);
      })
  );
});

// Activate event: Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Fetch event: Implement cache strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Cache-first strategy for HTML and CSS (local resources)
  if (request.destination === 'document' || request.destination === 'style' ||
      url.pathname.endsWith('.html') || url.pathname.endsWith('.css')) {
    event.respondWith(
      caches.match(request)
        .then((response) => {
          if (response) {
            return response;
          }
          return fetch(request)
            .then((response) => {
              // Only cache successful responses
              if (!response || response.status !== 200 || response.type === 'error') {
                return response;
              }
              // Clone the response as it can only be consumed once
              const responseToCache = response.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, responseToCache);
              });
              return response;
            });
        })
        .catch(() => {
          // Return offline page if resource not cached
          return caches.match('/offline.html')
            .catch(() => {
              return new Response('You are offline. Please check your connection.');
            });
        })
    );
  }

  // Network-first strategy for external resources (fonts, Google Drive embeds, etc.)
  else {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Only cache successful responses
          if (!response || response.status !== 200 || response.type === 'error') {
            return response;
          }
          // Clone the response as it can only be consumed once
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
          return response;
        })
        .catch(() => {
          // Fall back to cache if network fails
          return caches.match(request)
            .catch(() => {
              return new Response('Resource unavailable offline.');
            });
        })
    );
  }
});
