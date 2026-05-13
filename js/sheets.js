// ============================================
// CONFIGURAÇÃO DOS LINKS PÚBLICOS
// ============================================
const SHEETS_CONFIG = {
    equipe: '../csv/equipe.csv',
    projetos: '../csv/projetos.csv',
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
    const dados = await carregarCSV(SHEETS_CONFIG.equipe);
    
    // Filtra apenas membros ativos (case insensitive)
    return dados.filter(membro => {
        const status = membro['status :'] || membro.status || '';
        return status.trim().toLowerCase() === 'ativo';
    });
}

function renderizarEquipe(membros) {
    // Seleciona os containers
    const coordContainer = document.querySelector('.equipe-coordenadores');
    const pesquisadoresContainer = document.querySelector('.equipe-pesquisadores');
    const icContainer = document.querySelector('.equipe-ic');
    
    // Limpa os containers
    if (coordContainer) coordContainer.innerHTML = '';
    if (pesquisadoresContainer) pesquisadoresContainer.innerHTML = '';
    if (icContainer) icContainer.innerHTML = '';
    
    if (!membros || membros.length === 0) {
        const msg = '<p class="sem-dados">Nenhum membro encontrado.</p>';
        if (coordContainer) coordContainer.innerHTML = msg;
        return;
    }
    
    membros.forEach(membro => {
        // NOVOS CABEÇALHOS (sem dois pontos)
        const nome = membro.nome || membro.Nome || 'Nome não informado';
        const cargoTexto = membro.cargo || 'Membro';
        const equipeCategoria = (membro.equipe || '').trim();
        const lattes = membro.lattes || '';
        const linkedin = membro.linkedin || '';
        const fotoNome = membro.foto || '';
        const fotoPath = fotoNome ? `../assets/images/equipe/${fotoNome}` : null;
        
        // Define qual container usar baseado na coluna "equipe"
        let container = null;
        if (equipeCategoria.toLowerCase().includes('coord')) {
            container = coordContainer;
        } else if (equipeCategoria.toLowerCase().includes('pesquisador')) {
            container = pesquisadoresContainer;
        } else if (equipeCategoria.toLowerCase().includes('iniciação') || equipeCategoria.toLowerCase().includes('ic')) {
            container = icContainer;
        } else {
            container = pesquisadoresContainer;
        }
        
        if (!container) return;
        
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
            <div class="membro-links">
                ${lattes ? `<a href="${escapeHtml(lattes)}" target="_blank" rel="noopener noreferrer">📄 Lattes</a>` : ''}
                ${linkedin ? `<a href="${escapeHtml(linkedin)}" target="_blank" rel="noopener noreferrer">🔗 LinkedIn</a>` : ''}
            </div>
        `;
        container.appendChild(card);
    });
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
// PUBLICAÇÕES COM BUSCA, FILTROS E PAGINAÇÃO
// ============================================

let todasPublicacoes = [];
let publicacoesAgrupadas = [];
let publicacoesFiltradas = [];
let paginaAtual = 1;
const itensPorPagina = 20;

// Carregar publicações do CSV
async function carregarPublicacoes() {
    const dados = await carregarCSV(SHEETS_CONFIG.publicacoes);
    
    const dadosFiltrados = dados.filter(row => {
        const titulo = row.Titulo || row.titulo || '';
        return titulo && titulo !== 'Publicações' && titulo !== 'Titulo';
    });
    
    todasPublicacoes = dadosFiltrados;
    
    const agrupadas = {};
    dadosFiltrados.forEach(pub => {
        const ano = pub.Ano || pub.ano;
        if (!ano) return;
        if (!agrupadas[ano]) agrupadas[ano] = [];
        agrupadas[ano].push(pub);
    });
    
    publicacoesAgrupadas = Object.keys(agrupadas)
        .sort((a, b) => b - a)
        .map(ano => ({ ano, publicacoes: agrupadas[ano] }));
    
    publicacoesFiltradas = [...publicacoesAgrupadas];
    return publicacoesAgrupadas;
}

// Preencher opções de anos
function preencherOpcoesAnos() {
    const container = document.getElementById('ano-options');
    if (!container || todasPublicacoes.length === 0) return;
    
    const anos = [...new Set(todasPublicacoes.map(p => p.Ano || p.ano))];
    anos.sort((a, b) => b - a);
    
    // Manter a opção "Todos os anos" no topo
    const todosOption = container.querySelector('.select-option[data-ano="todos"]');
    container.innerHTML = '';
    container.appendChild(todosOption);
    
    anos.forEach(ano => {
        const label = document.createElement('label');
        label.className = 'select-option';
        label.setAttribute('data-ano', ano);
        label.innerHTML = `<input type="radio" name="ano" value="${ano}"> ${ano}`;
        container.appendChild(label);
    });
    
    // Busca nos anos
    const buscaAnoInput = document.getElementById('busca-ano-input');
    if (buscaAnoInput) {
        buscaAnoInput.addEventListener('input', (e) => {
            const termo = e.target.value.toLowerCase();
            const anosFiltrados = anos.filter(ano => ano.toString().includes(termo));
            
            container.innerHTML = '';
            container.appendChild(todosOption);
            anosFiltrados.forEach(ano => {
                const label = document.createElement('label');
                label.className = 'select-option';
                label.setAttribute('data-ano', ano);
                label.innerHTML = `<input type="radio" name="ano" value="${ano}"> ${ano}`;
                container.appendChild(label);
            });
        });
    }
}

// Obter ano selecionado
function getAnoSelecionado() {
    const selected = document.querySelector('input[name="ano"]:checked');
    return selected ? selected.value : 'todos';
}

// Aplicar filtros
function aplicarFiltros() {
    const termoBusca = document.getElementById('busca-input')?.value.toLowerCase() || '';
    const anoSelecionado = getAnoSelecionado();
    
    let filtradas = [...todasPublicacoes];
    
    if (termoBusca) {
        filtradas = filtradas.filter(pub => {
            const titulo = (pub.Titulo || pub.titulo || '').toLowerCase();
            const autores = (pub.Autores || pub.autores || '').toLowerCase();
            const veiculo = (pub.Modelo || pub.modelo || '').toLowerCase();
            return titulo.includes(termoBusca) || autores.includes(termoBusca) || veiculo.includes(termoBusca);
        });
    }
    
    if (anoSelecionado !== 'todos') {
        filtradas = filtradas.filter(pub => (pub.Ano || pub.ano || '').toString() === anoSelecionado);
    }
    
    const agrupadas = {};
    filtradas.forEach(pub => {
        const ano = pub.Ano || pub.ano;
        if (!ano) return;
        if (!agrupadas[ano]) agrupadas[ano] = [];
        agrupadas[ano].push(pub);
    });
    
    publicacoesFiltradas = Object.keys(agrupadas)
        .sort((a, b) => b - a)
        .map(ano => ({ ano, publicacoes: agrupadas[ano] }));
    
    paginaAtual = 1;
    renderizarPublicacoes();
}

// Limpar filtros
function limparFiltros() {
    document.getElementById('busca-input').value = '';
    document.getElementById('busca-ano-input').value = '';
    const todosRadio = document.querySelector('input[name="ano"][value="todos"]');
    if (todosRadio) todosRadio.checked = true;
    
    publicacoesFiltradas = [...publicacoesAgrupadas];
    paginaAtual = 1;
    renderizarPublicacoes();
    
    // Re-renderizar opções de anos
    preencherOpcoesAnos();
}

// Renderizar publicações com paginação
function renderizarPublicacoes() {
    const container = document.querySelector('.publicacoes-lista');
    const loader = document.getElementById('loader-publicacoes');
    
    if (!container) return;
    if (loader) loader.style.display = 'none';
    
    if (!publicacoesFiltradas || publicacoesFiltradas.length === 0) {
        container.innerHTML = '<p class="sem-dados">Nenhuma publicação encontrada.</p>';
        return;
    }
    
    let todasPublicacoesLista = [];
    publicacoesFiltradas.forEach(grupo => {
        grupo.publicacoes.forEach(pub => {
            todasPublicacoesLista.push({ ano: grupo.ano, ...pub });
        });
    });
    
    const total = todasPublicacoesLista.length;
    const totalPaginas = Math.ceil(total / itensPorPagina);
    const inicio = (paginaAtual - 1) * itensPorPagina;
    const fim = inicio + itensPorPagina;
    const publicacoesPagina = todasPublicacoesLista.slice(inicio, fim);
    
    const agrupadasPagina = {};
    publicacoesPagina.forEach(pub => {
        const ano = pub.ano;
        if (!agrupadasPagina[ano]) agrupadasPagina[ano] = [];
        agrupadasPagina[ano].push(pub);
    });
    
    const gruposOrdenados = Object.keys(agrupadasPagina)
        .sort((a, b) => b - a)
        .map(ano => ({ ano, publicacoes: agrupadasPagina[ano] }));
    
    container.innerHTML = '';
    
    // Paginação top
    container.appendChild(gerarPaginacaoHTML(paginaAtual, totalPaginas, total, inicio, fim, true));
    
    gruposOrdenados.forEach(grupo => {
        const anoSection = document.createElement('div');
        anoSection.className = 'publicacoes-ano';
        anoSection.innerHTML = `<h2>📅 ${grupo.ano}</h2>`;
        
        const lista = document.createElement('ul');
        lista.className = 'publicacoes-lista-ano';
        
        grupo.publicacoes.forEach(pub => {
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
                    ${doi ? `<a href="${escapeHtml(doi)}" target="_blank" class="doi-link">🔗 Acessar</a>` : ''}
                </div>
            `;
            lista.appendChild(item);
        });
        
        anoSection.appendChild(lista);
        container.appendChild(anoSection);
    });
    
    // Paginação bottom
    container.appendChild(gerarPaginacaoHTML(paginaAtual, totalPaginas, total, inicio, fim, false));
    
    document.querySelectorAll('.btn-pagina').forEach(btn => {
        btn.addEventListener('click', () => {
            paginaAtual = parseInt(btn.dataset.pagina);
            renderizarPublicacoes();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    });
}

function gerarPaginacaoHTML(pagina, totalPaginas, total, inicio, fim, isTop) {
    const div = document.createElement('div');
    div.className = `paginacao-controles ${isTop ? 'paginacao-top' : 'paginacao-bottom'}`;
    
    let html = `<div class="paginacao-info">📄 Mostrando ${inicio + 1}-${Math.min(fim, total)} de ${total} publicações</div>`;
    html += '<div class="paginacao-botoes">';
    
    if (pagina > 1) {
        html += `<button class="btn-pagina" data-pagina="${pagina - 1}">◀ Anterior</button>`;
    }
    
    let inicioPaginas = Math.max(1, pagina - 2);
    let fimPaginas = Math.min(totalPaginas, pagina + 2);
    
    if (inicioPaginas > 1) {
        html += `<button class="btn-pagina" data-pagina="1">1</button>`;
        if (inicioPaginas > 2) html += `<span class="paginacao-pontos">...</span>`;
    }
    
    for (let i = inicioPaginas; i <= fimPaginas; i++) {
        if (i === pagina) {
            html += `<button class="btn-pagina ativo" data-pagina="${i}">${i}</button>`;
        } else {
            html += `<button class="btn-pagina" data-pagina="${i}">${i}</button>`;
        }
    }
    
    if (fimPaginas < totalPaginas) {
        if (fimPaginas < totalPaginas - 1) html += `<span class="paginacao-pontos">...</span>`;
        html += `<button class="btn-pagina" data-pagina="${totalPaginas}">${totalPaginas}</button>`;
    }
    
    if (pagina < totalPaginas) {
        html += `<button class="btn-pagina" data-pagina="${pagina + 1}">Próximo ▶</button>`;
    }
    
    html += '</div>';
    div.innerHTML = html;
    return div;
}

// Inicializar dropdown customizado
function initCustomSelect() {
    const trigger = document.getElementById('ano-select-trigger');
    const container = document.getElementById('ano-select-container');
    
    if (!trigger || !container) return;
    
    trigger.addEventListener('click', () => {
        container.classList.toggle('open');
    });
    
    // Fechar ao clicar fora
    document.addEventListener('click', (e) => {
        if (!container.contains(e.target)) {
            container.classList.remove('open');
        }
    });
    
    // Atualizar texto do trigger quando selecionar um ano
    document.addEventListener('change', (e) => {
        if (e.target.name === 'ano') {
            const selectedValue = e.target.value;
            const triggerSpan = trigger.querySelector('span:first-child');
            if (selectedValue === 'todos') {
                triggerSpan.innerHTML = '📅 Todos os anos';
            } else {
                triggerSpan.innerHTML = `📅 ${selectedValue}`;
            }
            container.classList.remove('open');
            aplicarFiltros();
        }
    });
}

// ============================================
// FUNÇÃO AUXILIAR ESCAPE HTML
// ============================================
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
// INICIALIZAÇÃO POR PÁGINA
// ============================================
async function inicializarPagina() {
    const bodyId = document.body.id || '';
    console.log(`Inicializando página: ${bodyId}`);
    
    if (bodyId === 'pagina-equipe') {
        const membros = await carregarEquipe();
        renderizarEquipe(membros);
        
    } else if (bodyId === 'pagina-projetos') {
        const projetos = await carregarProjetos();
        renderizarProjetos(projetos, 'todos');
        configurarFiltros();
        
    } else if (bodyId === 'pagina-publicacoes') {
    console.log('Carregando publicações...');
    
    await carregarPublicacoes();
    preencherOpcoesAnos();
    initCustomSelect();
    
    document.getElementById('buscar-btn')?.addEventListener('click', aplicarFiltros);
    document.getElementById('busca-input')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') aplicarFiltros();
    });
    document.getElementById('limpar-filtros-btn')?.addEventListener('click', limparFiltros);
    
    renderizarPublicacoes();
        
    } else if (bodyId === 'pagina-contato') {
        console.log('Página de contato - sem inicialização dinâmica');
    } else {
        console.log('Página sem inicialização específica (provavelmente index ou sobre)');
    }
}

// Aguarda o DOM carregar e inicializa
document.addEventListener('DOMContentLoaded', inicializarPagina);