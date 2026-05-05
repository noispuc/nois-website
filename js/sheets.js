// ============================================
// CONFIGURAÇÃO DOS LINKS PÚBLICOS
// ============================================
const SHEETS_CONFIG = {
    equipe: 'https://docs.google.com/spreadsheets/d/SEU_ID_AQUI/export?format=csv&gid=0',
    projetos: 'https://docs.google.com/spreadsheets/d/SEU_ID_AQUI/export?format=csv&gid=1',
    publicacoes: '../csv/publicacoes.csv'
};

// ============================================
// FUNÇÃO GENÉRICA PARA CARREGAR CSV
// ============================================
async function carregarCSV(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const texto = await response.text();
        const linhas = texto.split('\n');
        if (linhas.length < 2) return [];
        
        const cabecalhos = linhas[0].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
        const dados = [];
        
        for (let i = 1; i < linhas.length; i++) {
            if (!linhas[i].trim()) continue;
            
            // Parse simples (para valores com vírgula, idealmente usar biblioteca)
            const valores = [];
            let dentroAspas = false;
            let valorAtual = '';
            
            for (let char of linhas[i]) {
                if (char === '"') {
                    dentroAspas = !dentroAspas;
                } else if (char === ',' && !dentroAspas) {
                    valores.push(valorAtual.trim().replace(/^"|"$/g, ''));
                    valorAtual = '';
                } else {
                    valorAtual += char;
                }
            }
            valores.push(valorAtual.trim().replace(/^"|"$/g, ''));
            
            if (valores.length >= cabecalhos.length) {
                const obj = {};
                cabecalhos.forEach((cab, idx) => {
                    obj[cab] = valores[idx] || '';
                });
                dados.push(obj);
            }
        }
        return dados;
    } catch (error) {
        console.error('Erro ao carregar CSV:', error);
        return [];
    }
}

// ============================================
// EQUIPE
// ============================================
async function carregarEquipe() {
    const todos = await carregarCSV(SHEETS_CONFIG.equipe);
    // Filtra apenas membros com status = "ativo" (case insensitive)
    return todos.filter(membro => 
        membro.status && membro.status.trim().toLowerCase() === 'ativo'
    );
}

function renderizarEquipe(membros) {
    // Seleciona os containers
    const coordContainer = document.querySelector('.equipe-coordenadores');
    const pesqContainer = document.querySelector('.equipe-pesquisadores');
    const icContainer = document.querySelector('.equipe-ic');
    
    // Limpa os containers antes de renderizar
    if (coordContainer) coordContainer.innerHTML = '';
    if (pesqContainer) pesqContainer.innerHTML = '';
    if (icContainer) icContainer.innerHTML = '';
    
    if (!membros || membros.length === 0) {
        const msg = '<p class="sem-dados">Nenhum membro encontrado.</p>';
        if (coordContainer) coordContainer.innerHTML = msg;
        return;
    }
    
    membros.forEach(membro => {
        const cargo = (membro.cargo || '').toLowerCase();
        let container = null;
        
        if (cargo.includes('coord') || cargo.includes('prof')) {
            container = coordContainer;
        } else if (cargo.includes('doutor') || cargo.includes('mest') || cargo.includes('pesquisador')) {
            container = pesqContainer;
        } else {
            container = icContainer;
        }
        
        if (!container) return;
        
        const nome = membro.Nome || membro.nome || 'Nome não informado';
        const cargoTexto = membro.cargo || 'Membro';
        const area = membro.area || 'Saúde';
        const lattes = membro.lattes || '';
        const linkedin = membro.linkedin || '';
        const fotoNome = membro.foto || '';
        const fotoPath = fotoNome ? `assets/images/equipe/${fotoNome}` : null;
        
        const card = document.createElement('div');
        card.className = 'membro-card';
        card.innerHTML = `
            <div class="membro-foto">
                ${fotoPath ? 
                    `<img src="${fotoPath}" alt="${nome}" onerror="this.onerror=null; this.parentElement.innerHTML='<div class=\'foto-placeholder\'>📷</div>';">` : 
                    '<div class="foto-placeholder">📷</div>'}
            </div>
            <h3>${escapeHtml(nome)}</h3>
            <p class="membro-funcao">${escapeHtml(cargoTexto)}</p>
            <p class="membro-area">Área: ${escapeHtml(area)}</p>
            <div class="membro-links">
                ${lattes ? `<a href="${escapeHtml(lattes)}" target="_blank" rel="noopener noreferrer">📄 Lattes</a>` : ''}
                ${linkedin ? `<a href="${escapeHtml(linkedin)}" target="_blank" rel="noopener noreferrer">🔗 LinkedIn</a>` : ''}
            </div>
        `;
        container.appendChild(card);
    });
}

// Função auxiliar para evitar injeção de HTML
function escapeHtml(texto) {
    if (!texto) return '';
    return texto
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ============================================
// PROJETOS
// ============================================

// Variável global para armazenar todos os projetos (para filtro)
let todosProjetos = [];

async function carregarProjetos() {
    const dados = await carregarCSV(SHEETS_CONFIG.projetos);
    todosProjetos = dados;
    return dados;
}

function renderizarProjetos(projetos, filtro = 'todos') {
    const container = document.querySelector('.projetos-grid');
    const loader = document.getElementById('loader-projetos');
    
    if (!container) return;
    
    // Esconde o loader
    if (loader) loader.style.display = 'none';
    
    // Aplica filtro
    let projetosFiltrados = projetos;
    if (filtro === 'ativo') {
        projetosFiltrados = projetos.filter(p => p.status?.toLowerCase() === 'ativo');
    } else if (filtro === 'concluido') {
        projetosFiltrados = projetos.filter(p => p.status?.toLowerCase() === 'concluido');
    }
    
    if (!projetosFiltrados || projetosFiltrados.length === 0) {
        container.innerHTML = '<p class="sem-dados">Nenhum projeto encontrado.</p>';
        return;
    }
    
    container.innerHTML = '';
    
    projetosFiltrados.forEach(proj => {
        const card = document.createElement('div');
        card.className = 'projeto-card';
        
        const titulo = proj.Titulo || proj.titulo || 'Sem título';
        const descricao = proj.Descricao || proj.descricao || '';
        const tags = (proj.Temas || proj.temas || '').split(',').filter(t => t.trim());
        const ano = proj.Ano || proj.ano || '—';
        const equipe = proj.Equipe || proj.equipe || '';
        const link = proj.Link || proj.link || '';
        const status = (proj.status || 'ativo').toLowerCase();
        
        const statusClass = status === 'concluido' ? 'status-concluido' : 'status-ativo';
        const statusTexto = status === 'concluido' ? '✅ Concluído' : '🟢 Em andamento';
        
        card.innerHTML = `
            <div class="projeto-imagem">
                📁 ${status === 'concluido' ? '✅' : '🚀'}
            </div>
            <div class="status-badge ${statusClass}">${statusTexto}</div>
            <h3>${escapeHtml(titulo)}</h3>
            <div class="projeto-tags">
                ${tags.map(tag => `<span class="tag">${escapeHtml(tag.trim())}</span>`).join('')}
            </div>
            <p class="projeto-descricao">${escapeHtml(descricao)}</p>
            ${equipe ? `<p class="projeto-equipe"><strong>👥 Equipe:</strong> ${escapeHtml(equipe)}</p>` : ''}
            <p class="projeto-ano">📅 ${escapeHtml(ano)}</p>
            ${link ? `<a href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer" class="projeto-link">🔗 Saiba mais</a>` : ''}
        `;
        container.appendChild(card);
    });
}

// Configurar filtros
function configurarFiltros() {
    const botoes = document.querySelectorAll('.filtro-btn');
    if (!botoes.length) return;
    
    botoes.forEach(botao => {
        botao.addEventListener('click', () => {
            // Remove active de todos
            botoes.forEach(btn => btn.classList.remove('active'));
            botao.classList.add('active');
            
            const filtro = botao.getAttribute('data-filtro');
            renderizarProjetos(todosProjetos, filtro);
        });
    });
}

// ============================================
// PUBLICAÇÕES
// ============================================

// ============================================
// PUBLICAÇÕES (com CSV local)
// ============================================

async function carregarPublicacoes() {
    const dados = await carregarCSV(SHEETS_CONFIG.publicacoes);
    
    // Remove a primeira linha se for cabeçalho duplicado
    const dadosFiltrados = dados.filter(row => {
        // Ignora linhas vazias ou com "Publicações" no título
        const titulo = row.Titulo || row.titulo || '';
        return titulo && titulo !== 'Publicações' && titulo !== 'Titulo';
    });
    
    const agrupadas = {};
    
    dadosFiltrados.forEach(pub => {
        const ano = pub.Ano || pub.ano;
        if (!ano) return;
        if (!agrupadas[ano]) agrupadas[ano] = [];
        agrupadas[ano].push(pub);
    });
    
    // Ordenar anos decrescentes
    return Object.keys(agrupadas)
        .sort((a, b) => b - a)
        .map(ano => ({
            ano,
            publicacoes: agrupadas[ano]
        }));
}

function renderizarPublicacoes(publicacoesAgrupadas) {
    const container = document.querySelector('.publicacoes-lista');
    const loader = document.getElementById('loader-publicacoes');
    
    if (!container) return;
    if (loader) loader.style.display = 'none';
    
    if (!publicacoesAgrupadas || publicacoesAgrupadas.length === 0) {
        container.innerHTML = '<p class="sem-dados">Nenhuma publicação encontrada.</p>';
        return;
    }
    
    container.innerHTML = '';
    
    publicacoesAgrupadas.forEach(grupo => {
        const anoSection = document.createElement('div');
        anoSection.className = 'publicacoes-ano';
        anoSection.innerHTML = `<h2>📅 ${grupo.ano}</h2>`;
        
        const lista = document.createElement('ul');
        lista.className = 'publicacoes-lista-ano';
        
        grupo.publicacoes.forEach(pub => {
            // Mapeamento correto para seu CSV
            const titulo = pub.Titulo || pub.titulo || 'Sem título';
            const autores = pub.Autores || pub.autores || 'Autores não informados';
            const veiculo = pub['Modelo: '] || pub.Modelo || pub.modelo || 'Publicação';
            const doi = pub['DOI / LINK'] || pub.DOI || pub.doi || pub.Link || pub.link || '';
            
            const item = document.createElement('li');
            item.innerHTML = `
                <strong>${escapeHtml(titulo)}</strong>
                <span class="autores">${escapeHtml(autores)}</span>
                <div>
                    <span class="veiculo">📖 ${escapeHtml(veiculo)}</span>
                    ${doi ? `<a href="${escapeHtml(doi)}" target="_blank" rel="noopener noreferrer" class="doi-link">🔗 DOI/Link</a>` : ''}
                </div>
            `;
            lista.appendChild(item);
        });
        
        anoSection.appendChild(lista);
        container.appendChild(anoSection);
    });
}

// ============================================
// INICIALIZAÇÃO POR PÁGINA
// ============================================
// Detecta qual página está carregada baseado no body ID
async function inicializarPagina() {
    const bodyId = document.body.id || '';
    
    if (bodyId === 'pagina-equipe') {
        const membros = await carregarEquipe();
        renderizarEquipe(membros);
    } else if (bodyId === 'pagina-projetos') {
        const projetos = await carregarProjetos();
        renderizarProjetos(projetos, 'todos');
        configurarFiltros();
    } else if (bodyId === 'pagina-publicacoes') {
        const pubs = await carregarPublicacoes();
        renderizarPublicacoes(pubs);
    }
}

// Aguarda o DOM carregar e inicializa
document.addEventListener('DOMContentLoaded', inicializarPagina);