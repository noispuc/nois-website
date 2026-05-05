// Banner Slider Automático
class BannerSlider {
    constructor() {
        this.currentIndex = 0;
        this.images = [];
        this.interval = null;
        this.container = document.getElementById('bannerSlider');
        this.init();
    }

    async init() {
        await this.loadImages();
        this.createSlider();
        this.startAutoPlay();
    }

    async loadImages() {
        // Lista de imagens da pasta assets/images/banner/
        // Por enquanto, imagens de exemplo
        this.images = [
            { src: 'https://placehold.co/1200x400/1a2b4c/white?text=NOIS+Research', alt: 'Pesquisa NOIS' },
            { src: 'https://placehold.co/1200x400/2c3e66/white?text=Healthcare+Analytics', alt: 'Healthcare Analytics' },
            { src: 'https://placehold.co/1200x400/00a3a3/white?text=Data+Science', alt: 'Data Science' }
        ];
        
        // TODO: No futuro, ler imagens da pasta assets/images/banner/
        // Por enquanto, use estas imagens de exemplo
    }

    createSlider() {
        const track = document.createElement('div');
        track.className = 'slider-track';
        
        this.images.forEach((img, index) => {
            const slide = document.createElement('div');
            slide.className = 'slide';
            slide.innerHTML = `
                <img src="${img.src}" alt="${img.alt}">
                <div class="slide-caption">${img.alt}</div>
            `;
            track.appendChild(slide);
        });
        
        this.container.innerHTML = '';
        this.container.appendChild(track);
        
        // Botões de navegação
        const prevBtn = document.createElement('button');
        prevBtn.className = 'slider-btn prev';
        prevBtn.innerHTML = '❮';
        prevBtn.onclick = () => this.prevSlide();
        
        const nextBtn = document.createElement('button');
        nextBtn.className = 'slider-btn next';
        nextBtn.innerHTML = '❯';
        nextBtn.onclick = () => this.nextSlide();
        
        // Dots
        const dots = document.createElement('div');
        dots.className = 'slider-dots';
        this.images.forEach((_, index) => {
            const dot = document.createElement('div');
            dot.className = 'dot';
            dot.onclick = () => this.goToSlide(index);
            dots.appendChild(dot);
        });
        
        this.container.appendChild(prevBtn);
        this.container.appendChild(nextBtn);
        this.container.appendChild(dots);
        this.dots = dots.querySelectorAll('.dot');
        
        this.track = track;
        this.updateSlider();
    }

    updateSlider() {
        if (this.track) {
            this.track.style.transform = `translateX(-${this.currentIndex * 100}%)`;
            if (this.dots) {
                this.dots.forEach((dot, index) => {
                    dot.classList.toggle('active', index === this.currentIndex);
                });
            }
        }
    }

    nextSlide() {
        this.currentIndex = (this.currentIndex + 1) % this.images.length;
        this.updateSlider();
        this.resetAutoPlay();
    }

    prevSlide() {
        this.currentIndex = (this.currentIndex - 1 + this.images.length) % this.images.length;
        this.updateSlider();
        this.resetAutoPlay();
    }

    goToSlide(index) {
        this.currentIndex = index;
        this.updateSlider();
        this.resetAutoPlay();
    }

    startAutoPlay() {
        this.interval = setInterval(() => this.nextSlide(), 5000);
    }

    resetAutoPlay() {
        if (this.interval) {
            clearInterval(this.interval);
            this.startAutoPlay();
        }
    }
}

// Google Sheets Integration (para equipe, projetos, publicações)
class GoogleSheetsLoader {
    constructor() {
        // IDs das planilhas (você vai substituir pelos seus)
        this.sheetIds = {
            equipe: 'SEU_ID_AQUI',
            projetos: 'SEU_ID_AQUI',
            publicacoes: 'SEU_ID_AQUI'
        };
    }

    async loadSheet(sheetId, sheetName = 'Sheet1') {
        const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&sheet=${sheetName}`;
        try {
            const response = await fetch(url);
            const text = await response.text();
            const json = JSON.parse(text.substring(47).slice(0, -2));
            return this.parseSheetData(json);
        } catch (error) {
            console.error('Erro ao carregar planilha:', error);
            return [];
        }
    }

    parseSheetData(data) {
        const rows = data.table.rows;
        const headers = rows[0].c.map(cell => cell?.v || '');
        const result = [];
        
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i].c;
            const obj = {};
            headers.forEach((header, idx) => {
                if (header) {
                    obj[header] = row?.[idx]?.v || '';
                }
            });
            result.push(obj);
        }
        return result;
    }
}

// Inicializar quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', () => {
    // Inicializar banner slider
    new BannerSlider();
    
    // Inicializar Google Sheets
    const sheetsLoader = new GoogleSheetsLoader();
    
    // Carregar equipe (se estiver na página de equipe)
    if (document.body.classList.contains('page-equipe')) {
        sheetsLoader.loadSheet(sheetsLoader.sheetIds.equipe).then(data => {
            console.log('Equipe carregada:', data);
            // Renderizar equipe
        });
    }
    
    // Carregar projetos (se estiver na página de projetos)
    if (document.body.classList.contains('page-projetos')) {
        sheetsLoader.loadSheet(sheetsLoader.sheetIds.projetos).then(data => {
            console.log('Projetos carregados:', data);
            // Renderizar projetos
        });
    }
    
    // Carregar publicações (se estiver na página de publicações)
    if (document.body.classList.contains('page-publicacoes')) {
        sheetsLoader.loadSheet(sheetsLoader.sheetIds.publicacoes).then(data => {
            console.log('Publicações carregadas:', data);
            // Renderizar publicações
        });
    }
});

// Menu mobile (para telas pequenas)
function initMobileMenu() {
    const header = document.querySelector('.header');
    if (!header) return;
    
    // Criar botão hambúrguer
    const hamburger = document.createElement('button');
    hamburger.className = 'hamburger';
    hamburger.innerHTML = '☰';
    hamburger.style.display = 'none';
    hamburger.style.background = 'none';
    hamburger.style.border = 'none';
    hamburger.style.fontSize = '1.5rem';
    hamburger.style.cursor = 'pointer';
    
    const nav = document.querySelector('.nav');
    if (nav) {
        header.querySelector('.container')?.insertBefore(hamburger, nav);
        
        hamburger.onclick = () => {
            nav.classList.toggle('show');
        };
        
        // Responsividade
        const checkMobile = () => {
            if (window.innerWidth <= 768) {
                hamburger.style.display = 'block';
                nav.style.display = 'none';
                if (nav.classList.contains('show')) {
                    nav.style.display = 'flex';
                }
            } else {
                hamburger.style.display = 'none';
                nav.style.display = 'flex';
            }
        };
        
        window.addEventListener('resize', checkMobile);
        checkMobile();
    }
}

initMobileMenu();