// ============================================
// Banner Slider Automático
// ============================================
class BannerSlider {
    constructor() {
        this.currentIndex = 0;
        this.images = [];
        this.interval = null;
        this.container = document.getElementById('bannerSlider');
        this.track = null;
        this.dots = [];

        // Só inicializa o slider se a página tiver o container do banner.
        // Isso permite carregar este arquivo em todas as páginas sem gerar erro.
        if (!this.container) return;

        this.init();
    }

    async init() {
        await this.loadImages();

        if (!this.images.length) {
            this.container.innerHTML = '<div class="slider-loading">Nenhum banner disponível.</div>';
            return;
        }

        this.createSlider();

        if (this.images.length > 1) {
            this.startAutoPlay();
        }
    }

    async loadImages() {
        // ID da pasta fornecida
        const folderId = '1LI-0O752A964jVGWviU3fIJ0AeRg7JqW';
        // ATENÇÃO: Para ler o Google Drive via JavaScript no navegador, você precisará de uma API Key pública.
        // Crie uma no Google Cloud Console com acesso à Google Drive API.
        const apiKey = 'SUA_API_KEY_AQUI'; 
        
        try {
            // Caso a API Key não tenha sido configurada, lançamos um erro para cair no fallback
            if (apiKey === 'SUA_API_KEY_AQUI') {
                throw new Error('API Key não configurada. Configure sua API Key no js/main.js');
            }

            const url = `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+trashed=false&fields=files(id,name,mimeType)&key=${apiKey}`;
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`Erro ao buscar imagens do Drive: HTTP ${response.status}`);
            }
            
            const data = await response.json();
            
            // Filtra apenas os arquivos que são imagens
            const arquivosImagens = data.files.filter(file => file.mimeType.startsWith('image/'));
            
            // Mapeia os arquivos do Drive para o formato esperado pelo slider
            this.images = arquivosImagens.map(file => ({
                src: `https://drive.google.com/uc?export=view&id=${file.id}`,
                alt: file.name.replace(/\.[^/.]+$/, "") // Remove a extensão (.jpg, .png) para usar como texto alternativo
            }));

        } catch (error) {
            console.error('Erro ao carregar banners do Drive:', error);
            // Fallback (plano B) caso a API falhe ou a chave não esteja configurada
            this.images = [
                { src: 'https://placehold.co/1200x400/1a2b4c/white?text=NOIS+Research', alt: 'Pesquisa NOIS' },
                { src: 'https://placehold.co/1200x400/2c3e66/white?text=Healthcare+Analytics', alt: 'Healthcare Analytics' },
                { src: 'https://placehold.co/1200x400/00a3a3/white?text=Data+Science', alt: 'Data Science' }
            ];
        }
    }

    createSlider() {
        const track = document.createElement('div');
        track.className = 'slider-track';

        this.images.forEach((img) => {
            const slide = document.createElement('div');
            slide.className = 'slide';

            const image = document.createElement('img');
            image.src = img.src;
            image.alt = img.alt;
            image.loading = 'lazy';

            const caption = document.createElement('div');
            caption.className = 'slide-caption';
            caption.textContent = img.alt;

            slide.appendChild(image);
            slide.appendChild(caption);
            track.appendChild(slide);
        });

        this.container.innerHTML = '';
        this.container.appendChild(track);
        this.track = track;

        // Se houver apenas um banner, não precisa criar navegação.
        if (this.images.length <= 1) {
            this.updateSlider();
            return;
        }

        const prevBtn = document.createElement('button');
        prevBtn.type = 'button';
        prevBtn.className = 'slider-btn prev';
        prevBtn.innerHTML = '❮';
        prevBtn.setAttribute('aria-label', 'Banner anterior');
        prevBtn.addEventListener('click', () => this.prevSlide());

        const nextBtn = document.createElement('button');
        nextBtn.type = 'button';
        nextBtn.className = 'slider-btn next';
        nextBtn.innerHTML = '❯';
        nextBtn.setAttribute('aria-label', 'Próximo banner');
        nextBtn.addEventListener('click', () => this.nextSlide());

        const dots = document.createElement('div');
        dots.className = 'slider-dots';
        dots.setAttribute('aria-label', 'Navegação dos banners');

        this.images.forEach((_, index) => {
            const dot = document.createElement('button');
            dot.type = 'button';
            dot.className = 'dot';
            dot.setAttribute('aria-label', `Ir para o banner ${index + 1}`);
            dot.addEventListener('click', () => this.goToSlide(index));
            dots.appendChild(dot);
        });

        this.container.appendChild(prevBtn);
        this.container.appendChild(nextBtn);
        this.container.appendChild(dots);

        this.dots = dots.querySelectorAll('.dot');
        this.updateSlider();
    }

    updateSlider() {
        if (!this.track || !this.images.length) return;

        this.track.style.transform = `translateX(-${this.currentIndex * 100}%)`;

        if (this.dots.length) {
            this.dots.forEach((dot, index) => {
                dot.classList.toggle('active', index === this.currentIndex);
            });
        }
    }

    nextSlide() {
        if (!this.images.length) return;

        this.currentIndex = (this.currentIndex + 1) % this.images.length;
        this.updateSlider();
        this.resetAutoPlay();
    }

    prevSlide() {
        if (!this.images.length) return;

        this.currentIndex = (this.currentIndex - 1 + this.images.length) % this.images.length;
        this.updateSlider();
        this.resetAutoPlay();
    }

    goToSlide(index) {
        if (index < 0 || index >= this.images.length) return;

        this.currentIndex = index;
        this.updateSlider();
        this.resetAutoPlay();
    }

    startAutoPlay() {
        this.stopAutoPlay();
        this.interval = setInterval(() => this.nextSlide(), 5000);
    }

    stopAutoPlay() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }

    resetAutoPlay() {
        if (this.images.length > 1) {
            this.startAutoPlay();
        }
    }
}

// ============================================
// Menu mobile
// ============================================
function initMobileMenu() {
    const header = document.querySelector('.header');
    const nav = document.querySelector('.nav');
    const headerContainer = header?.querySelector('.container');

    if (!header || !nav || !headerContainer) return;

    // Evita criar mais de um botão caso a função seja chamada novamente.
    if (header.querySelector('.hamburger')) return;

    const hamburger = document.createElement('button');
    hamburger.type = 'button';
    hamburger.className = 'hamburger';
    hamburger.innerHTML = '☰';
    hamburger.setAttribute('aria-label', 'Abrir menu');
    hamburger.setAttribute('aria-expanded', 'false');

    headerContainer.insertBefore(hamburger, nav);

    const atualizarMenu = () => {
        const isMobile = window.innerWidth <= 768;
        const isOpen = nav.classList.contains('show');

        if (isMobile) {
            hamburger.style.display = 'block';
            nav.style.display = isOpen ? 'flex' : 'none';
            hamburger.setAttribute('aria-expanded', String(isOpen));
            hamburger.setAttribute('aria-label', isOpen ? 'Fechar menu' : 'Abrir menu');
        } else {
            hamburger.style.display = 'none';
            nav.style.display = 'flex';
            nav.classList.remove('show');
            hamburger.setAttribute('aria-expanded', 'false');
            hamburger.setAttribute('aria-label', 'Abrir menu');
        }
    };

    hamburger.addEventListener('click', () => {
        nav.classList.toggle('show');
        atualizarMenu();
    });

    window.addEventListener('resize', atualizarMenu);
    atualizarMenu();
}

// ============================================
// Inicialização geral
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    new BannerSlider();
    initMobileMenu();
});