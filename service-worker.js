const CACHE_NAME = 'upaloopah-adventure-v1';
const urlsToCache = [
    './',
    'index.html',
    'style.css',
    'script.js',
    'manifest.json',
    // ���ӿ� ���Ǵ� ��� �̹����� ����� ���� ��θ� �߰��ؾ� �մϴ�.
    'assets/images/player.png',
    'assets/images/player_2.png',
    'assets/images/ground_obstacle.png',
    'assets/images/air_obstacle.png',
    'assets/images/air_obstacle_2.png',
    'assets/images/bird_obstacle_1.png',
    'assets/images/bird_obstacle_2.png',
    'assets/images/bird_obstacle_3.png',
    'assets/images/bird_obstacle_4.png',
    'assets/images/dana.png',
    'assets/images/dana_2.png',
    'assets/audio/bgm.mp3',
    'assets/audio/bgm2.mp3',
    'assets/audio/bgm3.mp3'
    // manifest.json�� ������ ������ �̹��� ��ε� �߰��ؾ� �մϴ�.
    // 'assets/icons/icon-192x192.png',
    // 'assets/icons/icon-512x512.png'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response;
                }
                return fetch(event.request);
            })
    );
});