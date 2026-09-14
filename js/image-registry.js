// ============================================
// NOISImageRegistry
// Carrega e expõe imagens de data/images.json
// ============================================

(function () {
    'use strict';

    var MANIFEST_FILENAME = 'data/images.json';

    // Estado interno
    var _cache = null;       // Promise do fetch (evita duplicidade)
    var _images = [];        // Array de imagens carregadas
    var _ready = false;      // Indica se o manifesto foi carregado com sucesso
    var _basePath = '';      // Prefixo de caminho resolvido para a página atual

    // ============================================
    // Detecção de base path
    // ============================================

    function detectBasePath() {
        // Páginas dentro de /pages precisam de "../" para alcançar a raiz.
        // A home (index.html na raiz) usa "./" ou caminho sem prefixo.
        var path = window.location.pathname;

        if (path.indexOf('/pages/') !== -1) {
            return '../';
        }

        return './';
    }

    // ============================================
    // Normalização para matching
    // ============================================

    function normalizeForMatch(value) {
        if (!value) return '';

        return String(value)
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')   // remover acentos
            .replace(/\.\w+$/, '')              // remover extensão de arquivo
            .replace(/[^a-z0-9]+/g, '-')        // trocar especiais por hífen
            .replace(/^-+|-+$/g, '')            // remover hífens das pontas
            .replace(/-{2,}/g, '-');             // remover hífens duplicados
    }

    // ============================================
    // Carregamento do manifesto
    // ============================================

    function loadManifest() {
        if (_cache) return _cache;

        var url = _basePath + MANIFEST_FILENAME;

        _cache = fetch(url)
            .then(function (response) {
                if (!response.ok) {
                    throw new Error('HTTP ' + response.status);
                }
                return response.json();
            })
            .then(function (data) {
                if (data && Array.isArray(data.images) && data.images.length > 0) {
                    _images = data.images;
                    _ready = true;
                }
            })
            .catch(function () {
                // Fallback silencioso: manifesto ausente ou inválido.
                _images = [];
                _ready = false;
            });

        return _cache;
    }

    // ============================================
    // Funções utilitárias
    // ============================================

    function isReady() {
        return _ready;
    }

    function getByCategory(category) {
        if (!_ready || !category) return [];

        var cat = normalizeForMatch(category);

        return _images.filter(function (img) {
            return normalizeForMatch(img.category) === cat;
        });
    }

    function getByKey(key) {
        if (!_ready || !key) return null;

        var normalized = normalizeForMatch(key);

        for (var i = 0; i < _images.length; i++) {
            if (normalizeForMatch(_images[i].key) === normalized) {
                return _images[i];
            }
        }

        return null;
    }

    function getByName(name) {
        if (!_ready || !name) return null;

        var normalized = normalizeForMatch(name);

        for (var i = 0; i < _images.length; i++) {
            if (normalizeForMatch(_images[i].name) === normalized) {
                return _images[i];
            }
        }

        return null;
    }

    function getByAlias(alias) {
        if (!_ready || !alias) return null;

        var normalized = normalizeForMatch(alias);

        for (var i = 0; i < _images.length; i++) {
            var aliases = _images[i].aliases;

            if (Array.isArray(aliases)) {
                for (var j = 0; j < aliases.length; j++) {
                    if (normalizeForMatch(aliases[j]) === normalized) {
                        return _images[i];
                    }
                }
            }
        }

        return null;
    }

    /**
     * Busca combinada: tenta key → alias → name → filename.
     * Se category for informada, restringe a busca àquela categoria.
     */
    function findImage(query, category) {
        if (!_ready || !query) return null;

        var normalized = normalizeForMatch(query);
        var pool = category ? getByCategory(category) : _images;

        // Tentar por key
        for (var i = 0; i < pool.length; i++) {
            if (normalizeForMatch(pool[i].key) === normalized) {
                return pool[i];
            }
        }

        // Tentar por alias
        for (var i = 0; i < pool.length; i++) {
            var aliases = pool[i].aliases;
            if (Array.isArray(aliases)) {
                for (var j = 0; j < aliases.length; j++) {
                    if (normalizeForMatch(aliases[j]) === normalized) {
                        return pool[i];
                    }
                }
            }
        }

        // Tentar por name
        for (var i = 0; i < pool.length; i++) {
            if (normalizeForMatch(pool[i].name) === normalized) {
                return pool[i];
            }
        }

        // Tentar por filename
        for (var i = 0; i < pool.length; i++) {
            if (normalizeForMatch(pool[i].filename) === normalized) {
                return pool[i];
            }
        }

        return null;
    }

    /**
     * Resolve o caminho público de uma entrada do manifesto,
     * ajustando o prefixo com base na localização da página.
     */
    function resolvePath(imageEntry) {
        if (!imageEntry || !imageEntry.path) return '';

        return _basePath + imageEntry.path;
    }

    // ============================================
    // Inicialização e exposição global
    // ============================================

    _basePath = detectBasePath();

    window.NOISImageRegistry = {
        init: loadManifest,
        isReady: isReady,
        getByCategory: getByCategory,
        getByKey: getByKey,
        getByName: getByName,
        getByAlias: getByAlias,
        findImage: findImage,
        resolvePath: resolvePath,
        normalizeForMatch: normalizeForMatch
    };

    // Disparar o carregamento automaticamente.
    loadManifest();
})();
