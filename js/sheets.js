// ============================================
// CONFIGURAÇÃO DOS DADOS
// ============================================
// O site lê as três abas publicadas da planilha real do NOIS em formato CSV.
// Para funcionar no site público, cada URL precisa abrir sem solicitar login.

const SHEETS_CONFIG = Object.freeze({
    equipe: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTugjw_6AIkQmzKkroNp81nmXaZ5NtVlLcwDyKOOVwGMdsepq0dLyeY0t9A7ONU6A/pub?gid=654259127&single=true&output=csv',

    projetos: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTugjw_6AIkQmzKkroNp81nmXaZ5NtVlLcwDyKOOVwGMdsepq0dLyeY0t9A7ONU6A/pub?gid=228810788&single=true&output=csv',

    publicacoes: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTugjw_6AIkQmzKkroNp81nmXaZ5NtVlLcwDyKOOVwGMdsepq0dLyeY0t9A7ONU6A/pub?gid=1609554095&single=true&output=csv'
});

// ============================================
// FUNÇÕES AUXILIARES GERAIS
// ============================================

function limparValor(valor) {
    return String(valor ?? '')
        .replace(/\u00A0/g, ' ')
        .replace(/^\uFEFF/, '')
        .trim();
}

function normalizarTexto(valor) {
    return limparValor(valor)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

function normalizarChave(chave) {
    return normalizarTexto(chave)
        .replace(/^"|"$/g, '')
        .replace(/:$/g, '')
        .trim()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

function normalizarStatus(valor) {
    return normalizarChave(valor);
}

function obterCampo(objeto, nomesPossiveis, fallback = '') {
    for (const nome of nomesPossiveis) {
        const valor = objeto[nome];

        if (valor !== undefined && valor !== null && limparValor(valor) !== '') {
            return limparValor(valor);
        }
    }

    return fallback;
}

function normalizarUrl(valor) {
    const url = limparValor(valor);
    const textoNormalizado = normalizarTexto(url);

    if (!url) return '';

    const valoresSemLink = [
        'em breve',
        'a definir',
        'n/a',
        'na',
        '-',
        '--'
    ];

    if (valoresSemLink.includes(textoNormalizado)) {
        return '';
    }

    if (/^https?:\/\//i.test(url)) {
        return url;
    }

    if (/^www\./i.test(url)) {
        return `https://${url}`;
    }

    if (/^mailto:/i.test(url) || /^tel:/i.test(url)) {
        return url;
    }

    // Caso a planilha tenha somente o DOI, sem a URL completa.
    if (/^10\.\d{4,9}\//i.test(url)) {
        return `https://doi.org/${url}`;
    }

    return '';
}

function criarElementoTexto(tag, texto, classe = '') {
    const elemento = document.createElement(tag);

    if (classe) {
        elemento.className = classe;
    }

    elemento.textContent = texto;
    return elemento;
}

function criarLinkExterno(texto, url, classe = '') {
    const link = document.createElement('a');

    link.href = url;
    link.textContent = texto;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';

    if (classe) {
        link.className = classe;
    }

    return link;
}

function criarMensagemSemDados(texto) {
    return criarElementoTexto('p', texto, 'sem-dados');
}

// ============================================
// LEITURA E PARSE DE CSV
// ============================================

function parseCSV(texto) {
    const linhas = [];
    let linhaAtual = [];
    let valorAtual = '';
    let dentroDeAspas = false;

    const conteudo = String(texto ?? '')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n');

    for (let i = 0; i < conteudo.length; i++) {
        const caractere = conteudo[i];
        const proximoCaractere = conteudo[i + 1];

        if (caractere === '"' && dentroDeAspas && proximoCaractere === '"') {
            valorAtual += '"';
            i++;
        } else if (caractere === '"') {
            dentroDeAspas = !dentroDeAspas;
        } else if (caractere === ',' && !dentroDeAspas) {
            linhaAtual.push(limparValor(valorAtual));
            valorAtual = '';
        } else if (caractere === '\n' && !dentroDeAspas) {
            linhaAtual.push(limparValor(valorAtual));

            if (linhaAtual.some(campo => campo !== '')) {
                linhas.push(linhaAtual);
            }

            linhaAtual = [];
            valorAtual = '';
        } else {
            valorAtual += caractere;
        }
    }

    linhaAtual.push(limparValor(valorAtual));

    if (linhaAtual.some(campo => campo !== '')) {
        linhas.push(linhaAtual);
    }

    return linhas;
}

function localizarLinhaCabecalho(linhas, tipoAba) {
    const regras = {
        equipe: {
            principal: 'nome',
            secundarios: ['status', 'cargo', 'equipe', 'foto']
        },
        projetos: {
            principal: 'titulo',
            secundarios: [
                'ano',
                'link',
                'equipe',
                'descricao_do_projeto',
                'temas_palavras_chaves',
                'financiadores'
            ]
        },
        publicacoes: {
            principal: 'titulo',
            secundarios: ['ano', 'autores', 'doi_link', 'modelo']
        }
    };

    const regra = regras[tipoAba];

    if (!regra) {
        return 0;
    }

    const limiteBusca = Math.min(linhas.length, 10);

    for (let i = 0; i < limiteBusca; i++) {
        const chaves = linhas[i].map(normalizarChave);

        const temCampoPrincipal = chaves.includes(regra.principal);
        const quantidadeCamposSecundarios = regra.secundarios.filter(campo =>
            chaves.includes(campo)
        ).length;

        if (temCampoPrincipal && quantidadeCamposSecundarios >= 1) {
            return i;
        }
    }

    console.warn(
        `Cabeçalho da aba "${tipoAba}" não foi identificado automaticamente. Usando a primeira linha.`
    );

    return 0;
}

async function carregarCSV(url, tipoAba) {
    try {
        const response = await fetch(url, { cache: 'no-store' });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const texto = await response.text();
        const linhas = parseCSV(texto);

        if (linhas.length < 2) {
            console.warn(`A aba "${tipoAba}" não contém dados suficientes.`);
            return [];
        }

        const indiceCabecalho = localizarLinhaCabecalho(linhas, tipoAba);
        const cabecalhos = linhas[indiceCabecalho].map(normalizarChave);
        const dados = [];

        for (let i = indiceCabecalho + 1; i < linhas.length; i++) {
            const valores = linhas[i];

            if (!valores.some(valor => limparValor(valor) !== '')) {
                continue;
            }

            const registro = {};

            cabecalhos.forEach((cabecalho, index) => {
                if (cabecalho) {
                    registro[cabecalho] = limparValor(valores[index] || '');
                }
            });

            dados.push(registro);
        }

        return dados;
    } catch (error) {
        console.error(`Erro ao carregar a aba "${tipoAba}":`, error);
        return [];
    }
}

// ============================================
// EQUIPE
// ============================================

async function carregarEquipe() {
    const dados = await carregarCSV(SHEETS_CONFIG.equipe, 'equipe');

    return dados.filter(membro => {
        const status = normalizarStatus(obterCampo(membro, ['status']));
        const categoriaEquipe = normalizarTexto(
            obterCampo(membro, ['equipe', 'grupo', 'categoria'])
        ).replace(/\s+/g, ' ');

        const statusOcultos = [
            'oculto',
            'oculta',
            'nao_exibir',
            'nao_exibe',
            'desativado',
            'desativada'
        ];

        if (statusOcultos.includes(status)) {
            return false;
        }

        const pertenceAAlumni = [
            'alumni',
            'alumini',
            'egresso',
            'egressa'
        ].includes(categoriaEquipe);

        const statusVisiveis = [
            'ativo',
            'ativa',
            'alumni',
            'alumini',
            'egresso',
            'egressa'
        ];

        return statusVisiveis.includes(status) || pertenceAAlumni;
    });
}

function obterContainerEquipe(membro, containers) {
    const categoriaEquipe = normalizarTexto(
        obterCampo(membro, ['equipe', 'grupo', 'categoria'])
    ).replace(/\s+/g, ' ');

    const categorias = {
        coordenacao: containers.coordenadores,
        'pesquisadores associados': containers.pesquisadoresAssociados,
        'pesquisadores associados pos': containers.pesquisadoresPosGraduacao,
        'pesquisadores associados grad': containers.pesquisadoresGraduacao,
        alumni: containers.alumni
    };

    const container = categorias[categoriaEquipe];

    if (!container) {
        console.warn(
            `Categoria de equipe não reconhecida: "${categoriaEquipe || 'vazia'}".`,
            membro
        );

        return null;
    }

    return container;
}

function criarImagemMembro(nome, fotoNome) {
    const wrapper = document.createElement('div');
    wrapper.className = 'membro-foto';

    if (!fotoNome) {
        wrapper.appendChild(criarElementoTexto('div', '📷', 'foto-placeholder'));
        return wrapper;
    }

    const imagem = document.createElement('img');
    imagem.src = `../assets/images/equipe/${fotoNome}`;
    imagem.alt = nome;
    imagem.loading = 'lazy';

    imagem.addEventListener('error', () => {
        wrapper.innerHTML = '';
        wrapper.appendChild(criarElementoTexto('div', '📷', 'foto-placeholder'));
    });

    wrapper.appendChild(imagem);

    return wrapper;
}

function renderizarEquipe(membros) {
    const containers = {
        coordenadores: document.querySelector('.equipe-coordenadores'),
        pesquisadoresAssociados: document.querySelector('.equipe-pesquisadores-associados'),
        pesquisadoresPosGraduacao: document.querySelector('.equipe-pesquisadores-posgraduacao'),
        pesquisadoresGraduacao: document.querySelector('.equipe-pesquisadores-graduacao'),
        alumni: document.querySelector('.equipe-alumni')
    };

    Object.values(containers).forEach(container => {
        if (container) {
            container.innerHTML = '';
        }
    });

    if (!membros.length) {
        exibirMensagensEquipeVazia(containers);
        return;
    }

    membros.forEach(membro => {
        const nome = obterCampo(membro, ['nome'], 'Nome não informado');
        const cargo = obterCampo(
            membro,
            ['cargo', 'funcao', 'posição', 'posicao'],
            'Membro'
        );

        const lattes = normalizarUrl(obterCampo(membro, ['lattes']));
        const linkedin = normalizarUrl(obterCampo(membro, ['linkedin']));
        const foto = obterCampo(membro, ['foto']);

        const container = obterContainerEquipe(membro, containers);

        if (!container) return;

        const card = document.createElement('div');
        card.className = 'membro-card';

        card.appendChild(criarImagemMembro(nome, foto));
        card.appendChild(criarElementoTexto('h3', nome));
        card.appendChild(criarElementoTexto('p', cargo, 'membro-funcao'));

        const links = document.createElement('div');
        links.className = 'membro-links';

        if (lattes) {
            links.appendChild(criarLinkExterno('📄 Lattes', lattes));
        }

        if (linkedin) {
            links.appendChild(criarLinkExterno('🔗 LinkedIn', linkedin));
        }

        card.appendChild(links);
        container.appendChild(card);
    });

    exibirMensagensEquipeVazia(containers);
}

function exibirMensagensEquipeVazia(containers) {
    const mensagens = {
        coordenadores: 'Nenhum membro de coordenação encontrado.',
        pesquisadoresAssociados: 'Nenhum pesquisador associado encontrado.',
        pesquisadoresPosGraduacao: 'Nenhum pesquisador de pós-graduação encontrado.',
        pesquisadoresGraduacao: 'Nenhum pesquisador de graduação encontrado.',
        alumni: 'Nenhum alumni encontrado.'
    };

    Object.entries(containers).forEach(([chave, container]) => {
        if (!container || container.children.length) return;

        container.appendChild(
            criarMensagemSemDados(mensagens[chave])
        );
    });
}

// ============================================
// PROJETOS
// ============================================

let todosProjetos = [];

async function carregarProjetos() {
    const dados = await carregarCSV(SHEETS_CONFIG.projetos, 'projetos');

    todosProjetos = dados.filter(projeto => {
        const titulo = obterCampo(projeto, ['titulo']);

        return titulo && normalizarTexto(titulo) !== 'titulo';
    });

    return todosProjetos;
}

function obterStatusProjeto(projeto) {
    const status = normalizarStatus(
        obterCampo(projeto, ['status', 'situacao'])
    );

    const statusConcluidos = [
        'concluido',
        'concluida',
        'finalizado',
        'finalizada',
        'encerrado',
        'encerrada'
    ];

    if (statusConcluidos.includes(status)) {
        return 'concluido';
    }

    // Enquanto a planilha real não tiver coluna status,
    // o projeto é exibido como ativo por padrão.
    return 'ativo';
}

function obterFonteImagemProjeto(valorImagem) {
    const imagem = limparValor(valorImagem);

    if (!imagem) return '';

    const urlPublica = normalizarUrl(imagem);

    if (urlPublica) {
        return urlPublica;
    }

    return `../assets/images/projetos/${imagem}`;
}

function criarImagemProjeto(titulo, status, valorImagem) {
    const wrapper = document.createElement('div');
    wrapper.className = 'projeto-imagem';

    const fonteImagem = obterFonteImagemProjeto(valorImagem);

    if (!fonteImagem) {
        wrapper.appendChild(
            criarElementoTexto(
                'div',
                status === 'concluido' ? '✅' : '🚀',
                'projeto-placeholder'
            )
        );

        return wrapper;
    }

    const imagem = document.createElement('img');
    imagem.src = fonteImagem;
    imagem.alt = titulo;
    imagem.loading = 'lazy';

    imagem.addEventListener('error', () => {
        wrapper.innerHTML = '';
        wrapper.appendChild(
            criarElementoTexto(
                'div',
                status === 'concluido' ? '✅' : '🚀',
                'projeto-placeholder'
            )
        );
    });

    wrapper.appendChild(imagem);

    return wrapper;
}


function obterFinanciadoresProjeto(projeto) {
    const valor = obterCampo(projeto, [
        'financiadores',
        'financiador',
        'financiamento',
        'apoio'
    ]);

    if (!valor) return [];

    return [...new Set(
        valor
            .split(';')
            .map(item => limparValor(item))
            .filter(Boolean)
    )];
}

function renderizarProjetos(projetos, filtro = 'todos') {
    const container = document.querySelector('.projetos-grid');
    const loader = document.getElementById('loader-projetos');

    if (!container) return;

    if (loader) {
        loader.style.display = 'none';
    }

    let projetosFiltrados = Array.isArray(projetos) ? projetos : [];

    if (filtro === 'ativo') {
        projetosFiltrados = projetosFiltrados.filter(
            projeto => obterStatusProjeto(projeto) === 'ativo'
        );
    } else if (filtro === 'concluido') {
        projetosFiltrados = projetosFiltrados.filter(
            projeto => obterStatusProjeto(projeto) === 'concluido'
        );
    }

    container.innerHTML = '';

    if (!projetosFiltrados.length) {
        container.appendChild(criarMensagemSemDados('Nenhum projeto encontrado.'));
        return;
    }

    projetosFiltrados.forEach(projeto => {
        const titulo = obterCampo(projeto, ['titulo'], 'Sem título');

        const descricao = obterCampo(projeto, [
            'descricao',
            'descricao_do_projeto'
        ]);

        const temas = obterCampo(projeto, [
            'temas',
            'temas_palavras_chaves',
            'palavras_chaves'
        ]);

        const ano = obterCampo(projeto, ['ano'], '—');
        const equipe = obterCampo(projeto, ['equipe']);
        const valorLink = obterCampo(projeto, ['link']);
        const link = normalizarUrl(valorLink);
        const imagem = obterCampo(projeto, ['imagem', 'foto', 'capa']);
        const status = obterStatusProjeto(projeto);
        const financiadores = obterFinanciadoresProjeto(projeto);

        const tags = temas
            .split(/[;,]/)
            .map(tag => tag.trim())
            .filter(Boolean);

        const statusClasse = status === 'concluido'
            ? 'status-concluido'
            : 'status-ativo';

        const statusTexto = status === 'concluido'
            ? '✅ Concluído'
            : '🟢 Em andamento';

        const card = document.createElement('div');
        card.className = 'projeto-card';

        card.appendChild(criarImagemProjeto(titulo, status, imagem));
        card.appendChild(
            criarElementoTexto(
                'div',
                statusTexto,
                `status-badge ${statusClasse}`
            )
        );

        card.appendChild(criarElementoTexto('h3', titulo));

        if (tags.length) {
            const tagsContainer = document.createElement('div');
            tagsContainer.className = 'projeto-tags';

            tags.forEach(tag => {
                tagsContainer.appendChild(
                    criarElementoTexto('span', tag, 'tag')
                );
            });

            card.appendChild(tagsContainer);
        }

        if (descricao) {
            card.appendChild(
                criarElementoTexto('p', descricao, 'projeto-descricao')
            );
        }

        if (equipe) {
            const equipeTexto = document.createElement('p');
            equipeTexto.className = 'projeto-equipe';

            const rotulo = document.createElement('strong');
            rotulo.textContent = '👥 Equipe: ';

            equipeTexto.appendChild(rotulo);
            equipeTexto.appendChild(document.createTextNode(equipe));

            card.appendChild(equipeTexto);
        }

        if (financiadores.length) {
            const financiadoresTexto = document.createElement('p');
            financiadoresTexto.className = 'projeto-financiadores';

            const rotulo = document.createElement('strong');
            rotulo.textContent = '💰 Financiadores: ';

            financiadoresTexto.appendChild(rotulo);
            financiadoresTexto.appendChild(
                document.createTextNode(financiadores.join(', '))
            );

            card.appendChild(financiadoresTexto);
        }

        card.appendChild(
            criarElementoTexto('p', `📅 ${ano}`, 'projeto-ano')
        );

        if (link) {
            card.appendChild(
                criarLinkExterno('🔗 Saiba mais', link, 'projeto-link')
            );
        } else if (valorLink) {
            card.appendChild(
                criarElementoTexto(
                    'span',
                    '🔗 Saiba mais em breve',
                    'projeto-link projeto-link-indisponivel'
                )
            );
        }

        container.appendChild(card);
    });
}

function configurarFiltrosProjetos() {
    const botoes = document.querySelectorAll('.filtro-btn');

    if (!botoes.length) return;

    botoes.forEach(botao => {
        botao.addEventListener('click', () => {
            botoes.forEach(item => item.classList.remove('active'));
            botao.classList.add('active');

            const filtro = botao.getAttribute('data-filtro') || 'todos';
            renderizarProjetos(todosProjetos, filtro);
        });
    });
}

// ============================================
// PUBLICAÇÕES: BUSCA, FILTRO E PAGINAÇÃO
// ============================================

let todasPublicacoes = [];
let publicacoesAgrupadas = [];
let publicacoesFiltradas = [];
let paginaAtual = 1;

const ITENS_POR_PAGINA = 20;

async function carregarPublicacoes() {
    const dados = await carregarCSV(SHEETS_CONFIG.publicacoes, 'publicacoes');

    todasPublicacoes = dados.filter(publicacao => {
        const titulo = obterCampo(publicacao, ['titulo']);
        const tituloNormalizado = normalizarTexto(titulo);

        return titulo &&
            tituloNormalizado !== 'titulo' &&
            tituloNormalizado !== 'publicacoes';
    });

    publicacoesAgrupadas = agruparPublicacoesPorAno(todasPublicacoes);
    publicacoesFiltradas = [...publicacoesAgrupadas];

    return publicacoesAgrupadas;
}

function agruparPublicacoesPorAno(publicacoes) {
    const grupos = {};

    publicacoes.forEach(publicacao => {
        const ano = obterCampo(publicacao, ['ano']);

        if (!ano) return;

        if (!grupos[ano]) {
            grupos[ano] = [];
        }

        grupos[ano].push(publicacao);
    });

    return Object.keys(grupos)
        .sort((a, b) => Number(b) - Number(a))
        .map(ano => ({
            ano,
            publicacoes: grupos[ano]
        }));
}

function criarOpcaoAno(ano, selecionado = false) {
    const label = document.createElement('label');
    label.className = 'select-option';
    label.dataset.ano = ano;

    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'ano';
    radio.value = ano;
    radio.checked = selecionado;

    label.appendChild(radio);
    label.appendChild(
        document.createTextNode(
            ano === 'todos' ? ' 📅 Todos os anos' : ` ${ano}`
        )
    );

    return label;
}

function obterAnoSelecionado() {
    const selecionado = document.querySelector('input[name="ano"]:checked');

    return selecionado ? selecionado.value : 'todos';
}

function renderizarOpcoesAno(anos, termoBusca = '') {
    const container = document.getElementById('ano-options');

    if (!container) return;

    const anoSelecionado = obterAnoSelecionado();
    const termo = normalizarTexto(termoBusca);

    container.innerHTML = '';
    container.appendChild(
        criarOpcaoAno('todos', anoSelecionado === 'todos')
    );

    anos
        .filter(ano => normalizarTexto(ano).includes(termo))
        .forEach(ano => {
            container.appendChild(
                criarOpcaoAno(ano, anoSelecionado === ano)
            );
        });
}

function preencherOpcoesAnos() {
    const container = document.getElementById('ano-options');

    if (!container || !todasPublicacoes.length) return;

    const anos = [...new Set(
        todasPublicacoes
            .map(publicacao => obterCampo(publicacao, ['ano']))
            .filter(Boolean)
    )].sort((a, b) => Number(b) - Number(a));

    renderizarOpcoesAno(anos);

    const buscaAno = document.getElementById('busca-ano-input');

    if (buscaAno) {
        buscaAno.oninput = event => {
            renderizarOpcoesAno(anos, event.target.value);
        };
    }
}

function aplicarFiltrosPublicacoes() {
    const termoBusca = normalizarTexto(
        document.getElementById('busca-input')?.value || ''
    );

    const anoSelecionado = obterAnoSelecionado();

    let filtradas = [...todasPublicacoes];

    if (termoBusca) {
        filtradas = filtradas.filter(publicacao => {
            const titulo = normalizarTexto(
                obterCampo(publicacao, ['titulo'])
            );

            const autores = normalizarTexto(
                obterCampo(publicacao, ['autores'])
            );

            const modelo = normalizarTexto(
                obterCampo(publicacao, ['modelo'])
            );

            return titulo.includes(termoBusca) ||
                autores.includes(termoBusca) ||
                modelo.includes(termoBusca);
        });
    }

    if (anoSelecionado !== 'todos') {
        filtradas = filtradas.filter(publicacao => {
            return obterCampo(publicacao, ['ano']) === anoSelecionado;
        });
    }

    publicacoesFiltradas = agruparPublicacoesPorAno(filtradas);
    paginaAtual = 1;

    renderizarPublicacoes();
}

function limparFiltrosPublicacoes() {
    const busca = document.getElementById('busca-input');
    const buscaAno = document.getElementById('busca-ano-input');
    const radioTodos = document.querySelector('input[name="ano"][value="todos"]');
    const trigger = document.getElementById('ano-select-trigger');
    const textoTrigger = trigger?.querySelector('span:first-child');

    if (busca) {
        busca.value = '';
    }

    if (buscaAno) {
        buscaAno.value = '';
    }

    if (radioTodos) {
        radioTodos.checked = true;
    }

    if (textoTrigger) {
        textoTrigger.textContent = '📅 Todos os anos';
    }

    publicacoesFiltradas = [...publicacoesAgrupadas];
    paginaAtual = 1;

    preencherOpcoesAnos();
    renderizarPublicacoes();
}

function criarItemPublicacao(publicacao) {
    const titulo = obterCampo(publicacao, ['titulo'], 'Sem título');
    const autores = obterCampo(
        publicacao,
        ['autores'],
        'Autores não informados'
    );

    const modelo = obterCampo(publicacao, ['modelo'], 'Publicação');

    const link = normalizarUrl(
        obterCampo(publicacao, ['doi_link', 'doi', 'link'])
    );

    const item = document.createElement('li');

    item.appendChild(criarElementoTexto('strong', titulo));
    item.appendChild(criarElementoTexto('span', autores, 'autores'));

    const informacoes = document.createElement('div');
    informacoes.appendChild(
        criarElementoTexto('span', `📖 ${modelo}`, 'veiculo')
    );

    if (link) {
        informacoes.appendChild(document.createTextNode(' '));
        informacoes.appendChild(
            criarLinkExterno('🔗 Acessar', link, 'doi-link')
        );
    }

    item.appendChild(informacoes);

    return item;
}

function criarBotaoPaginacao(texto, paginaDestino, ativo = false) {
    const botao = document.createElement('button');

    botao.type = 'button';
    botao.className = ativo ? 'btn-pagina ativo' : 'btn-pagina';
    botao.dataset.pagina = String(paginaDestino);
    botao.textContent = texto;

    return botao;
}

function gerarPaginacao(
    pagina,
    totalPaginas,
    totalItens,
    inicio,
    fim,
    topo
) {
    const wrapper = document.createElement('div');

    wrapper.className = `paginacao-controles ${
        topo ? 'paginacao-top' : 'paginacao-bottom'
    }`;

    wrapper.appendChild(
        criarElementoTexto(
            'div',
            `📄 Mostrando ${inicio + 1}-${Math.min(fim, totalItens)} de ${totalItens} publicações`,
            'paginacao-info'
        )
    );

    const botoes = document.createElement('div');
    botoes.className = 'paginacao-botoes';

    if (pagina > 1) {
        botoes.appendChild(
            criarBotaoPaginacao('◀ Anterior', pagina - 1)
        );
    }

    const inicioPaginas = Math.max(1, pagina - 2);
    const fimPaginas = Math.min(totalPaginas, pagina + 2);

    if (inicioPaginas > 1) {
        botoes.appendChild(criarBotaoPaginacao('1', 1));

        if (inicioPaginas > 2) {
            botoes.appendChild(
                criarElementoTexto('span', '...', 'paginacao-pontos')
            );
        }
    }

    for (let i = inicioPaginas; i <= fimPaginas; i++) {
        botoes.appendChild(
            criarBotaoPaginacao(String(i), i, i === pagina)
        );
    }

    if (fimPaginas < totalPaginas) {
        if (fimPaginas < totalPaginas - 1) {
            botoes.appendChild(
                criarElementoTexto('span', '...', 'paginacao-pontos')
            );
        }

        botoes.appendChild(
            criarBotaoPaginacao(String(totalPaginas), totalPaginas)
        );
    }

    if (pagina < totalPaginas) {
        botoes.appendChild(
            criarBotaoPaginacao('Próximo ▶', pagina + 1)
        );
    }

    wrapper.appendChild(botoes);

    return wrapper;
}

function configurarBotoesPaginacao() {
    document.querySelectorAll('.btn-pagina').forEach(botao => {
        botao.addEventListener('click', () => {
            paginaAtual = Number.parseInt(botao.dataset.pagina, 10);

            renderizarPublicacoes();

            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    });
}

function renderizarPublicacoes() {
    const container = document.querySelector('.publicacoes-lista');
    const loader = document.getElementById('loader-publicacoes');

    if (!container) return;

    if (loader) {
        loader.style.display = 'none';
    }

    container.innerHTML = '';

    const listaCompleta = [];

    publicacoesFiltradas.forEach(grupo => {
        grupo.publicacoes.forEach(publicacao => {
            listaCompleta.push({
                ...publicacao,
                ano_grupo: grupo.ano
            });
        });
    });

    if (!listaCompleta.length) {
        container.appendChild(
            criarMensagemSemDados('Nenhuma publicação encontrada.')
        );

        return;
    }

    const totalItens = listaCompleta.length;
    const totalPaginas = Math.ceil(totalItens / ITENS_POR_PAGINA);

    paginaAtual = Math.min(Math.max(paginaAtual, 1), totalPaginas);

    const inicio = (paginaAtual - 1) * ITENS_POR_PAGINA;
    const fim = inicio + ITENS_POR_PAGINA;
    const itensPagina = listaCompleta.slice(inicio, fim);

    container.appendChild(
        gerarPaginacao(
            paginaAtual,
            totalPaginas,
            totalItens,
            inicio,
            fim,
            true
        )
    );

    const gruposPagina = {};

    itensPagina.forEach(publicacao => {
        const ano = publicacao.ano_grupo ||
            obterCampo(publicacao, ['ano']);

        if (!gruposPagina[ano]) {
            gruposPagina[ano] = [];
        }

        gruposPagina[ano].push(publicacao);
    });

    Object.keys(gruposPagina)
        .sort((a, b) => Number(b) - Number(a))
        .forEach(ano => {
            const secaoAno = document.createElement('div');
            secaoAno.className = 'publicacoes-ano';

            secaoAno.appendChild(
                criarElementoTexto('h2', `📅 ${ano}`)
            );

            const lista = document.createElement('ul');
            lista.className = 'publicacoes-lista-ano';

            gruposPagina[ano].forEach(publicacao => {
                lista.appendChild(criarItemPublicacao(publicacao));
            });

            secaoAno.appendChild(lista);
            container.appendChild(secaoAno);
        });

    container.appendChild(
        gerarPaginacao(
            paginaAtual,
            totalPaginas,
            totalItens,
            inicio,
            fim,
            false
        )
    );

    configurarBotoesPaginacao();
}

function iniciarSeletorAno() {
    const trigger = document.getElementById('ano-select-trigger');
    const container = document.getElementById('ano-select-container');

    if (!trigger || !container) return;

    trigger.setAttribute('aria-expanded', 'false');

    trigger.addEventListener('click', () => {
        const aberto = container.classList.toggle('open');
        trigger.setAttribute('aria-expanded', String(aberto));
    });

    document.addEventListener('click', event => {
        if (!container.contains(event.target)) {
            container.classList.remove('open');
            trigger.setAttribute('aria-expanded', 'false');
        }
    });

    document.addEventListener('change', event => {
        if (event.target.name !== 'ano') return;

        const valorSelecionado = event.target.value;
        const textoTrigger = trigger.querySelector('span:first-child');

        if (textoTrigger) {
            textoTrigger.textContent = valorSelecionado === 'todos'
                ? '📅 Todos os anos'
                : `📅 ${valorSelecionado}`;
        }

        container.classList.remove('open');
        trigger.setAttribute('aria-expanded', 'false');

        aplicarFiltrosPublicacoes();
    });
}

// ============================================
// INICIALIZAÇÃO POR PÁGINA
// ============================================

async function inicializarPagina() {
    const paginaAtualId = document.body.id || '';

    try {
        if (paginaAtualId === 'pagina-equipe') {
            const membros = await carregarEquipe();
            renderizarEquipe(membros);
        }

        if (paginaAtualId === 'pagina-projetos') {
            const projetos = await carregarProjetos();
            renderizarProjetos(projetos);
            configurarFiltrosProjetos();
        }

        if (paginaAtualId === 'pagina-publicacoes') {
            await carregarPublicacoes();

            preencherOpcoesAnos();
            iniciarSeletorAno();

            document
                .getElementById('buscar-btn')
                ?.addEventListener('click', aplicarFiltrosPublicacoes);

            document
                .getElementById('busca-input')
                ?.addEventListener('keydown', event => {
                    if (event.key === 'Enter') {
                        aplicarFiltrosPublicacoes();
                    }
                });

            document
                .getElementById('limpar-filtros-btn')
                ?.addEventListener('click', limparFiltrosPublicacoes);

            renderizarPublicacoes();
        }
    } catch (error) {
        console.error(
            `Erro ao inicializar a página "${paginaAtualId}":`,
            error
        );
    }
}

document.addEventListener('DOMContentLoaded', inicializarPagina);
