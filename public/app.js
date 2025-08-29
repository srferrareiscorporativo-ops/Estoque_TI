// Sistema de Estoque TI - JavaScript

// Inicializa o Supabase



const supabaseClient = window.supabase.createClient(
  window.CONFIG.SUPABASE_URL,
  window.CONFIG.SUPABASE_ANON_KEY
);

window.showToast = function(message, type = 'success') {
  const toast = document.getElementById('toast');
  const messageEl = document.getElementById('toast-message');
  if (!toast || !messageEl) return;

  messageEl.textContent = message;

  toast.className = `fixed top-4 right-4 ${
    type === 'error' ? 'bg-red-500' : 'bg-green-500'
  } text-white px-6 py-3 rounded-lg shadow-lg z-50 toast-show`;

  toast.classList.remove('hidden');

  setTimeout(() => {
    toast.classList.add('toast-hide');
    setTimeout(() => {
      toast.classList.add('hidden');
      toast.classList.remove('toast-show', 'toast-hide');
    }, 300);
  }, 3000);
};


class EstoqueApp {
    constructor() {
        this.produtos = [];
        this.movimentacoes = [];
        this.stats = {};
        this.currentPage = 'dashboard';
        this.editingProduct = null;
        this.filiais = [];     
        this.filialAtual = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadData();
        this.showPage('dashboard');
    }

setupEventListeners() {
    // helper local para adicionar listener com proteção
    const safeAdd = (selectorOrId, event, handler, useQuerySelector = false) => {
        try {
            const el = useQuerySelector ? document.querySelector(selectorOrId) : document.getElementById(selectorOrId);
            if (!el) {
                // console.debug(`Elemento não encontrado: ${selectorOrId}`);
                return null;
            }
            el.addEventListener(event, handler);
            return el;
        } catch (err) {
            console.error('safeAdd error for', selectorOrId, err);
            return null;
        }
    };

    // Navigation (links no sidebar)
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = e.target.closest('.nav-link').getAttribute('href').substring(1);
            this.showPage(page);
        });
    });

    // Buttons (existem na sua UI — usamos safeAdd para evitar erro se algum for removido)
    safeAdd('btn-novo-produto', 'click', () => this.openProductModal());
    safeAdd('btn-nova-movimentacao', 'click', () => this.openMovementModal());

    // Modal controls
    safeAdd('close-modal-produto', 'click', () => this.closeProductModal());
    safeAdd('cancel-produto', 'click', () => this.closeProductModal());
    safeAdd('close-modal-movimentacao', 'click', () => this.closeMovementModal());
    safeAdd('cancel-movimentacao', 'click', () => this.closeMovementModal());

    // Forms (só adiciona listener se o form existir)
    const formProduto = document.getElementById('form-produto');
    if (formProduto) formProduto.addEventListener('submit', (e) => this.handleProductSubmit(e));

    const formMov = document.getElementById('form-movimentacao');
    if (formMov) formMov.addEventListener('submit', (e) => this.handleMovementSubmit(e));

    // Search
    const searchEl = document.getElementById('search-produtos');
    if (searchEl) searchEl.addEventListener('input', (e) => this.filterProducts(e.target.value));

    // Report type change
    const tipoRel = document.getElementById('tipo-relatorio');
    if (tipoRel) tipoRel.addEventListener('change', (e) => this.loadReport(e.target.value));

    // Close modals on background click (proteger se modal não existir)
    const modalProduto = document.getElementById('modal-produto');
    if (modalProduto) {
        modalProduto.addEventListener('click', (e) => {
            if (e.target.id === 'modal-produto') this.closeProductModal();
        });
    }
    const modalMov = document.getElementById('modal-movimentacao');
    if (modalMov) {
        modalMov.addEventListener('click', (e) => {
            if (e.target.id === 'modal-movimentacao') this.closeMovementModal();
        });
    }

    // Controle de Envio (botão voltar + form de novo envio) — só adiciona se os IDs existirem
    const btnVoltar = document.getElementById('btn-voltar-filiais');
    if (btnVoltar) {
        btnVoltar.addEventListener('click', () => {
            this.voltarParaFiliais();
        });
    }

    // Se você removeu o form-novo-envio, não faremos a adição — proteção aplicada:
    const formNovoEnvio = document.getElementById('form-novo-envio');
    if (formNovoEnvio) {
        formNovoEnvio.addEventListener('submit', (e) => this.novoEnvio(e));
    } else {
        // opcional: debug
        // console.debug('form-novo-envio não encontrado — listener não registrado');
    }

    // Botão de submit do modal de movimentação (se existir - no caso do layout sticky)
    const btnSubmit = document.getElementById('btn-submit-movimentacao');
    if (btnSubmit) {
        btnSubmit.addEventListener('click', (e) => {
            // evita comportamento padrão se for button fora do form
            e.preventDefault();
            // delega ao handler (que já faz validação)
            this.handleMovementSubmit(e);
        });
    }

    // Export button listener
    const btnExport = document.getElementById('btn-exportar-relatorio');
    if (btnExport) {
        btnExport.addEventListener('click', () => {
            const content = document.getElementById('relatorio-content');
            const tabela = content ? content.querySelector('table') : null;

            if (!tabela) {
                alert('Nenhuma tabela para exportar!');
                return;
            }

            const tipoRelatorio = document.querySelector('select#tipo-relatorio')?.value || 'relatorio';
            const wb = XLSX.utils.table_to_book(tabela, { sheet: tipoRelatorio });
            XLSX.writeFile(wb, `${tipoRelatorio}.xlsx`);
        });
    }
}



    async loadData() {
try {
const [produtosRes, movRes, filRes] = await Promise.all([
supabaseClient.from('produtos').select('*'),
supabaseClient
.from('movimentacoes')
.select('*, produto:produtos(*)')
.order('data', { ascending: false }),
supabaseClient.from('filiais').select('*').order('nome', { ascending: true })
]);


if (produtosRes.error) throw produtosRes.error;
if (movRes.error) throw movRes.error;
if (filRes.error) throw filRes.error;


this.produtos = produtosRes.data || [];
this.movimentacoes = movRes.data || [];
this.filiais = filRes.data || [];


// constrói o mapa id→nome ANTES de atualizar o dashboard
this.buildFilialMap();


// Estatísticas simples
const hoje = new Date().toISOString().split('T')[0];
const hojeMovs = this.movimentacoes.filter(m => (m.data || '').startsWith(hoje));
const baixoEstoque = this.produtos.filter(p => (p.quantidade ?? 0) <= (p.quantidade_minima ?? 0));


this.stats = {
totalProducts: this.produtos.length,
lowStock: baixoEstoque.length,
todayMovements: hojeMovs.length
};


// Agora sim, com filiais e mapa prontos
this.updateDashboard?.();
this.updateProductsTable?.();
this.updateMovementsTable?.();
this.updateHistoryTable?.();
this.updateProductSelect?.();
} catch (error) {
console.error('Erro ao carregar dados:', error);
this.showToast?.('Erro ao carregar dados', 'error');
}
}


    showPage(pageId) {
        // Update navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        document.querySelector(`[href="#${pageId}"]`).classList.add('active');

        // Update pages
        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
        });
        document.getElementById(pageId).classList.add('active');

        this.currentPage = pageId;

        // Load page-specific data
        if (pageId === 'relatorios') {
            this.loadReport('estoque');
        }

        if (pageId === 'envios-filiais') {
          this.loadFiliais();
        }

    }

    updateDashboard() {
        document.getElementById('total-produtos').textContent = this.stats.totalProducts || 0;
        document.getElementById('estoque-baixo').textContent = this.stats.lowStock || 0;
        document.getElementById('movimentacoes-hoje').textContent = this.stats.todayMovements || 0;
    }

  updateProductsTable() {
    const tbody = document.getElementById('produtos-table-body');
    tbody.innerHTML = '';

    this.produtos.forEach(produto => {
        const row = document.createElement('tr');
        row.innerHTML = `
      <td data-label="Produto" class="responsive-cell px-6 py-2 whitespace-nowrap flex flex-col gap-1">
        <span class="font-medium text-gray-900">${produto.nome}</span>
        <span class="text-sm text-gray-500">${produto.categoria || ''}</span>
      </td>
      <td data-label="Código" class="responsive-cell px-6 py-2 whitespace-nowrap text-sm font-mono">
        ${produto.codigo}
      </td>
      <td data-label="Quantidade" class="responsive-cell px-6 py-2 whitespace-nowrap text-sm font-semibold">
        ${produto.quantidade}
      </td>
      <td data-label="Mínimo" class="responsive-cell px-6 py-2 whitespace-nowrap text-sm text-gray-500">
        ${produto.quantidade_minima}
      </td>
      <td data-label="Status" class="responsive-cell px-6 py-2 whitespace-nowrap">
        ${this.getStatusBadge(produto)}
      </td>
      <td data-label="Ações" class="responsive-cell px-6 py-2 whitespace-nowrap text-sm font-medium flex gap-2 justify-start sm:justify-end">
  <button onclick="app.editProduct('${produto.id}')" class="text-blue-600 hover:text-blue-900">
    <i class="fas fa-edit"></i>
  </button>
  <button onclick="app.deleteProduct('${produto.id}')" class="text-red-600 hover:text-red-900">
    <i class="fas fa-trash"></i>
  </button>
</td>
    `;
        tbody.appendChild(row);
    });
}

updateMovementsTable() {
  const tbody = document.getElementById('movimentacoes-table-body');
  tbody.innerHTML = '';

  this.movimentacoes.slice(0, 20).forEach(mov => {
    const filialName = this.getFilialName(mov.filial_id);

    const row = document.createElement('tr');
    row.innerHTML = `
  <td data-label="Produto" class="px-2 py-4 whitespace-nowrap flex flex-col gap-1 responsive-cell text-center">
    <span class="font-medium text-gray-900">${mov.produto.nome}</span>
    <span class="text-sm text-gray-500 font-mono">${mov.produto.codigo}</span>
  </td>
  <td data-label="Tipo" class="px-2 py-4 whitespace-nowrap responsive-cell text-center">
    ${this.getTypeBadge(mov.tipo)}
  </td>
  <td data-label="Quantidade" class="px-2 py-4 whitespace-nowrap text-sm font-semibold responsive-cell text-center">
    ${mov.quantidade}
  </td>
  <td data-label="Responsável" class="px-2 py-4 whitespace-nowrap text-sm text-gray-900 responsive-cell text-center">
    ${mov.responsavel}
  </td>
  <td data-label="Solicitante" class="px-2 py-4 whitespace-nowrap text-sm text-gray-700 responsive-cell text-center">
    ${mov.solicitante || '-'}
  </td>
  <td data-label="Chamado" class="px-2 py-4 whitespace-nowrap text-sm text-gray-700 responsive-cell text-center">
    ${mov.chamado}
  </td>
  <td data-label="Setor" class="px-2 py-4 whitespace-nowrap text-sm text-gray-700 responsive-cell text-center">
    ${mov.setor || '-'}
  </td>
  <td data-label="Data" class="px-2 py-4 whitespace-nowrap text-sm text-gray-500 responsive-cell text-center">
    ${this.formatDate(mov.data)}
  </td>
`;
    tbody.appendChild(row);
  });
}


  updateHistoryTable() {
  const tbody = document.getElementById('historico-table-body');
  tbody.innerHTML = '';

  this.movimentacoes.forEach(mov => {
    const filialName = this.getFilialName(mov.filial_id);

    const row = document.createElement('tr');
    row.innerHTML = `
      <td data-label="Produto" class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 responsive-cell">
        ${mov.produto.nome}
      </td>
      <td data-label="Tipo" class="px-6 py-4 whitespace-nowrap text-sm responsive-cell text-center">
        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          mov.tipo === 'entrada' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }">
          ${mov.tipo === 'entrada' ? '↑ Entrada' : '↓ Saída'}
        </span>
      </td>
      <td data-label="Quantidade" class="px-6 py-4 whitespace-nowrap text-sm font-bold responsive-cell text-center">
        ${mov.quantidade}
      </td>
      <td data-label="Responsável" class="px-6 py-4 whitespace-nowrap text-sm responsive-cell text-center">
        ${mov.responsavel}
      </td>
      <td data-label="Solicitante" class="px-6 py-4 whitespace-nowrap text-sm responsive-cell text-center">
        ${mov.solicitante || '-'}
      </td>
      <td data-label="Chamado" class="px-6 py-4 whitespace-nowrap text-sm responsive-cell text-center">
        ${mov.chamado}
      </td>
      <td data-label="Setor" class="px-6 py-4 whitespace-nowrap text-sm responsive-cell text-center">
        ${mov.setor || '-'}
      </td>
      <td data-label="Data" class="px-6 py-4 whitespace-nowrap text-sm responsive-cell text-center">
        ${this.formatDate(mov.data)}
      </td>
    `;
    tbody.appendChild(row);
  });
}


    updateProductSelect() {
        const select = document.getElementById('movimentacao-produto');
        select.innerHTML = '<option value="">Selecione um produto</option>';

        this.produtos.forEach(produto => {
            const option = document.createElement('option');
            option.value = produto.id;
            option.textContent = `${produto.nome} - ${produto.codigo}`;
            select.appendChild(option);
        });
    }

    getStatusBadge(produto) {
        if (produto.quantidade === 0) {
            return '<span class="status-badge status-sem-estoque">Sem Estoque</span>';
        } else if (produto.quantidade <= produto.quantidade_minima) {
            return '<span class="status-badge status-baixo">Baixo</span>';
        } else {
            return '<span class="status-badge status-normal">Normal</span>';
        }
    }

    getTypeBadge(tipo) {
        if (tipo === 'entrada') {
            return '<span class="status-badge tipo-entrada"><i class="fas fa-arrow-up mr-1"></i>Entrada</span>';
        } else {
            return '<span class="status-badge tipo-saida"><i class="fas fa-arrow-down mr-1"></i>Saída</span>';
        }
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    filterProducts(searchTerm) {
        const tbody = document.getElementById('produtos-table-body');
        const rows = tbody.getElementsByTagName('tr');

        Array.from(rows).forEach(row => {
            const text = row.textContent.toLowerCase();
            if (text.includes(searchTerm.toLowerCase())) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    }

    openProductModal(product = null) {
    this.editingProduct = product;
    const modal = document.getElementById('modal-produto');
    const title = document.getElementById('modal-produto-title');

    if (product) {
        title.textContent = 'Editar Produto';

        const nomeEl = document.getElementById('produto-nome');
        if (nomeEl) nomeEl.value = product.nome || '';

        const codigoEl = document.getElementById('produto-codigo');
        if (codigoEl) codigoEl.value = product.codigo || '';

        const quantidadeEl = document.getElementById('produto-quantidade');
        if (quantidadeEl) quantidadeEl.value = product.quantidade ?? 0;

        const minimoEl = document.getElementById('produto-minimo');
        if (minimoEl) minimoEl.value = product.quantidade_minima ?? 0;

        const categoriaEl = document.getElementById('produto-categoria');
        if (categoriaEl) categoriaEl.value = product.categoria || '';

        const descricaoEl = document.getElementById('produto-descricao');
        if (descricaoEl) descricaoEl.value = product.descricao || '';

        const notificarEl = document.getElementById('produto-notificar');
        if (notificarEl) notificarEl.checked = !!product.notify_on_low;

        const emailEl = document.getElementById('produto-email');
        if (emailEl) emailEl.value = product.notify_email || '';

    } else {
        title.textContent = 'Novo Produto';
        const form = document.getElementById('form-produto');
        if (form) form.reset();
    }

    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('modal-enter');
    } else {
        console.warn('Modal "modal-produto" não encontrado no DOM.');
    }
}

    closeProductModal() {
        const modal = document.getElementById('modal-produto');
        modal.classList.add('hidden');
        this.editingProduct = null;
    }

    openMovementModal() {
        const modal = document.getElementById('modal-movimentacao');
        const form = document.getElementById('form-movimentacao');
        if (form) form.reset();
        
        this._populateProductSelect();
        this._populateFilialSelect();
        this._setupMovementTypeListener();
        
        modal.classList.remove('hidden');
        modal.classList.add('modal-enter');
    }

    closeMovementModal() {
        const modal = document.getElementById('modal-movimentacao');
        modal.classList.add('hidden');
    }

  async handleProductSubmit(e) {
  e.preventDefault();

  const nome = document.getElementById('produto-nome').value;
  const quantidade = parseInt(document.getElementById('produto-quantidade').value, 10);
  const quantidade_minima = parseInt(document.getElementById('produto-minimo').value, 10);
  const descricao = document.getElementById('produto-descricao').value;
  const categoria = document.getElementById('produto-categoria').value;
  const notify_on_low = !!document.getElementById('produto-notificar').checked;
  const notify_email = document.getElementById('produto-email').value.trim() || null;

  let codigo;

  if (this.editingProduct) {
  codigo = this.editingProduct.codigo;
} else {
  // Buscar maior código existente
  const { data: produtos, error } = await supabaseClient
    .from('produtos')
    .select('codigo')
    .order('codigo', { ascending: false })
    .limit(1);

  if (error) {
    console.error('Erro ao buscar último código:', error);
    this.showToast('Erro ao gerar código do produto', 'error');
    return;
  }

  let ultimoCodigo = produtos?.[0]?.codigo || '000000';

  // Converte para número, soma 1 e formata novamente com zeros à esquerda
  const novoCodigoNumero = parseInt(ultimoCodigo, 10) + 1;
  codigo = novoCodigoNumero.toString().padStart(6, '0');
}

  const payload = {
    nome,
    codigo,
    quantidade,
    quantidade_minima,
    descricao,
    categoria,
    notify_on_low,
    notify_email
  };

  try {
    let res;

    if (this.editingProduct) {
      res = await supabaseClient
        .from('produtos')
        .update(payload)
        .eq('id', this.editingProduct.id);
    } else {
      res = await supabaseClient
        .from('produtos')
        .insert([payload]);
    }

    const { error } = res;
    if (error) throw error;

    this.showToast(this.editingProduct
      ? 'Produto atualizado com sucesso'
      : 'Produto criado com sucesso'
    );
    this.closeProductModal();
    this.loadData();

  } catch (err) {
    console.error('Erro ao salvar produto:', err);
    if (err.code === '23505' && err.details?.includes('(codigo)')) {
      this.showToast('Já existe um produto com esse código.', 'error');
    } else {
      this.showToast(err.message || 'Erro ao salvar produto', 'error');
    }
  }
}

showToast(mensagem, tipo = 'success') {
  const toast = document.createElement('div');
  toast.className = `fixed bottom-4 right-4 px-4 py-2 rounded shadow text-white z-50 transition-all ${
    tipo === 'error' ? 'bg-red-500' : 'bg-green-500'
  }`;
  toast.textContent = mensagem;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('opacity-0');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

  async handleMovementSubmit(e) {
  e.preventDefault();

  const produtoId = document.getElementById('movimentacao-produto').value;
  const tipo = document.getElementById('movimentacao-tipo').value;
  const quantidade = parseInt(document.getElementById('movimentacao-quantidade').value, 10);
  const responsavel = document.getElementById('movimentacao-responsavel').value;
  const chamado = document.getElementById('movimentacao-chamado').value;
  const solicitante = document.getElementById('movimentacao-solicitante').value;
  const setor = document.getElementById('movimentacao-setor').value;
  const observacoes = document.getElementById('movimentacao-observacoes').value;
  const selectedFilial = document.getElementById('movimentacao-filial')?.value ?? '';

  // valida básica
  if (!produtoId || !tipo || !quantidade || quantidade <= 0) {
    this.showToast('Preencha produto, tipo e quantidade válidos', 'error');
    return;
  }

  try {
    // 1) Busca estoque atual
      const { data: prod, error: fetchErr } = await supabaseClient
    .from('produtos')
    .select('quantidade, quantidade_minima, notify_on_low, notify_email, nome')
    .eq('id', produtoId)
    .single();
  if (fetchErr) throw fetchErr;

    const delta = tipo === 'entrada' ? quantidade : -quantidade;
    const novaQuantidade = (prod.quantidade || 0) + delta;

    if (novaQuantidade < 0) {
      this.showToast('Estoque insuficiente para realizar a saída.', 'error');
      return;
    }

    // 2) Prepara payload de movimentação, incluindo filial_id quando aplicável
    const payload = {
      produto_id: produtoId,
      tipo,
      quantidade,
      responsavel,
      chamado,
      solicitante,
      setor,
      observacoes
    };

    // Tratamento do destino:
    // - '' (Estoque TI) -> não inclui filial_id no payload (movimentação local)
    // - 'VAN' -> filial_id = 'VAN' para identificação especial
    // - 'AGRICOPEL' -> filial_id = NULL (registramos movimento com filial_id null)
    // - outro -> filial_id = id
    let filial_id_payload;
    if (selectedFilial === 'VAN') {
      payload.filial_id = null; // Vamos usar o campo setor para identificar a Van
      payload.setor = 'VAN'; // Força o setor como Van para identificação
    } else if (selectedFilial === 'AGRICOPEL') {
      filial_id_payload = null;
      payload.filial_id = null;
    } else if (selectedFilial === '') {
      // não adiciona propriedade filial_id (movimentação local)
    } else {
      filial_id_payload = selectedFilial;
      payload.filial_id = filial_id_payload;
    }

    // 3) Insere movimentação
    const { error: movErr } = await supabaseClient.from('movimentacoes').insert([ payload ]);
    if (movErr) throw movErr;

    // 4) Atualiza estoque do produto
    const { error: updErr } = await supabaseClient
      .from('produtos')
      .update({ quantidade: novaQuantidade })
      .eq('id', produtoId);
    if (updErr) throw updErr;

    try {
  // só notifica em saídas, ou sempre que quiser (aqui checamos qualquer mudança que resulte em baixo/zero)
  const shouldNotify = prod.notify_on_low && prod.notify_email;
  const enteredLow = novaQuantidade <= (prod.quantidade_minima ?? 0);
  const enteredZero = novaQuantidade === 0;

 // dentro de handleMovementSubmit, onde você chama a notificação:
if (shouldNotify && (enteredLow || enteredZero)) {
  const subject = enteredZero
    ? `Produto "${prod.nome}" sem estoque`
    : `Produto "${prod.nome}" com estoque baixo (${novaQuantidade})`;

  const text = `O produto "${prod.nome}" agora tem ${novaQuantidade} unidades. Mínimo configurado: ${prod.quantidade_minima}.\n\nTipo de movimentação: ${tipo}\nResponsável: ${responsavel}\nObservações: ${observacoes || '-'}`;

  // monta objeto produto atualizado
  const produtoAtualizado = {
    nome: prod.nome,
    quantidade: novaQuantidade,
    quantidade_minima: prod.quantidade_minima
  };

  // agora passa como quarto parâmetro
  await this.sendNotificationEmail(prod.notify_email, subject, text, produtoAtualizado);
}

} catch (errNotify) {
  console.error('Erro ao tentar enviar notificação:', errNotify);
  // não interrompe o fluxo principal
}

    // 5) Se for saída e tiver filial selecionada (inclui AGRICOPEL) -> registra em envios_filiais
    if (tipo === 'saida' && (selectedFilial === 'AGRICOPEL' || (selectedFilial && selectedFilial !== ''))) {
      const envioPayload = {
        filial_id: filial_id_payload === undefined ? null : filial_id_payload, // if AGRICOPEL -> null, else id
        produto_id: produtoId,
        quantidade
      };
      const { error: envErr } = await supabaseClient.from('envios_filiais').insert([envioPayload]);
      if (envErr) {
        console.error('Erro ao inserir envios_filiais:', envErr);
        // não aborta a operação principal, apenas avisa
        this.showToast('Movimentação salva, mas falha ao registrar envio para filial (veja console)', 'error');
      }
    }

    this.showToast('Movimentação registrada e estoque atualizado com sucesso');
    this.closeMovementModal();
    this.loadData();
  } catch (err) {
    console.error('Erro ao registrar movimentação ou atualizar estoque:', err);
    this.showToast(err.message || 'Erro ao registrar movimentação', 'error');
  }
}



    editProduct(id) {
        const product = this.produtos.find(p => p.id === id);
        if (product) {
            this.openProductModal(product);
        }
    }

    async deleteProduct(id) {
  if (!confirm('Tem certeza que deseja excluir este produto e todas as movimentações?')) return;

  try {
    // 1) Apaga movimentações ligadas
    const { error: errMov } = await supabaseClient
      .from('movimentacoes')
      .delete()
      .eq('produto_id', id);
    if (errMov) throw errMov;

    // 2) Apaga o produto
    const { error: errProd } = await supabaseClient
      .from('produtos')
      .delete()
      .eq('id', id);
    if (errProd) throw errProd;

    showToast('Produto e movimentações excluídos com sucesso');
    this.loadData();
  } catch (err) {
    console.error('Erro ao deletar produto ou movimentações:', err);
    showToast(err.message || 'Erro ao excluir produto', 'error');
  }
}

async sendNotificationEmail(toEmail, subject, message, produto) {
  try {
    const serviceID = "service_ei18gu4";   // do EmailJS
    const templateID = "template_89ip877"; // do EmailJS

    const params = {
      email: toEmail, // 👈 precisa ser "email" (não "to_email")
      product_name: produto.nome,
      status: message.includes("sem estoque") ? "zerado" : "baixo",
      quantity: produto.quantidade,
      min_quantity: produto.quantidade_minima,
    };

     await emailjs.send(serviceID, templateID, params);
    this.showToast("Notificação enviada para " + toEmail);
  } catch (err) {
    console.error("Erro ao enviar email:", err);
    this.showToast("Falha ao enviar notificação", "error");
  }
}





// Controle de Envios

buildFilialMap() {
this.filialById = new Map((this.filiais || []).map(f => [String(f.id), f.nome]));
}

getFilialName(id) {
if (id == null) return '—';
return this.filialById?.get(String(id)) || `ID ${id}`; // fallback visível para detectar gaps
}

_populateFilialSelect() {
  const select = document.getElementById('movimentacao-filial');
  if (!select) return;

  // Limpa e monta opções
  select.innerHTML = '';

  const noneOpt = document.createElement('option');
  noneOpt.value = '';
  noneOpt.textContent = 'Estoque TI (movimentação local)';
  select.appendChild(noneOpt);

  // Adiciona a Van como opção especial
  const vanOpt = document.createElement('option');
  vanOpt.value = 'VAN';
  vanOpt.textContent = 'Van (Estoque Móvel)';
  select.appendChild(vanOpt);

  // Agricopel com setores
  const agricopelOpt = document.createElement('option');
  agricopelOpt.value = 'AGRICOPEL';
  agricopelOpt.textContent = 'Agricopel (Matriz)';
  select.appendChild(agricopelOpt);

  // Filiais reais
  (this.filiais || []).forEach(f => {
    const opt = document.createElement('option');
    opt.value = f.id;
    opt.textContent = f.nome || `Filial ${f.id}`;
    select.appendChild(opt);
  });
}

_populateProductSelect() {
  const select = document.getElementById('movimentacao-produto');
  if (!select) return;

  select.innerHTML = '<option value="">Selecione um produto</option>';
  
  (this.produtos || []).forEach(produto => {
    const opt = document.createElement('option');
    opt.value = produto.id;
    opt.textContent = `${produto.nome} (${produto.codigo}) - Qtd: ${produto.quantidade}`;
    select.appendChild(opt);
  });
}

_setupMovementTypeListener() {
  const tipoSelect = document.getElementById('movimentacao-tipo');
  const solicitanteDiv = document.getElementById('movimentacao-solicitante')?.parentElement;
  const chamadoDiv = document.getElementById('movimentacao-chamado')?.parentElement;
  const setorDiv = document.getElementById('movimentacao-setor')?.parentElement;
  const destinoSelect = document.getElementById('movimentacao-filial');
  
  if (!tipoSelect) return;
  
  tipoSelect.addEventListener('change', (e) => {
    const isEntrada = e.target.value === 'entrada';
    
    // Para entrada, esconde solicitante e chamado
    if (solicitanteDiv) solicitanteDiv.style.display = isEntrada ? 'none' : 'block';
    if (chamadoDiv) chamadoDiv.style.display = isEntrada ? 'none' : 'block';
    
    // Limpa valores quando escondidos
    if (isEntrada) {
      const solicitanteInput = document.getElementById('movimentacao-solicitante');
      const chamadoInput = document.getElementById('movimentacao-chamado');
      if (solicitanteInput) solicitanteInput.value = '';
      if (chamadoInput) chamadoInput.value = '';
    }
  });
  
  // Listener para mudança de destino (setores)
  if (destinoSelect) {
    destinoSelect.addEventListener('change', (e) => {
      this._updateSetorField(e.target.value);
    });
  }
}

_updateSetorField(destino) {
  const setorInput = document.getElementById('movimentacao-setor');
  if (!setorInput) return;
  
  if (destino === 'AGRICOPEL') {
    // Converte input em select para setores da Agricopel
    this._convertSetorToSelect([
      'TI', 'Contabilidade', 'RH', 'Vendas', 'Compras', 
      'Financeiro', 'Expedição', 'Almoxarifado', 'Diretoria'
    ]);
  } else if (destino && destino !== '' && destino !== 'VAN' && !isNaN(destino)) {
    // Para filiais/postos, converte para select de setores
    this._convertSetorToSelect([
      'Administração', 'Vendas', 'Operação', 'Manutenção', 'Conveniência'
    ]);
  } else {
    // Para outros casos, mantém como input text
    this._convertSetorToInput();
  }
}

_convertSetorToSelect(options) {
  const setorInput = document.getElementById('movimentacao-setor');
  const container = setorInput.parentElement;
  
  // Remove input atual
  setorInput.remove();
  
  // Cria select
  const select = document.createElement('select');
  select.id = 'movimentacao-setor';
  select.className = 'w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500';
  
  // Adiciona opções
  const defaultOpt = document.createElement('option');
  defaultOpt.value = '';
  defaultOpt.textContent = 'Selecione o setor';
  select.appendChild(defaultOpt);
  
  options.forEach(option => {
    const opt = document.createElement('option');
    opt.value = option;
    opt.textContent = option;
    select.appendChild(opt);
  });
  
  container.appendChild(select);
}

_convertSetorToInput() {
  const setorSelect = document.getElementById('movimentacao-setor');
  const container = setorSelect.parentElement;
  
  // Se já é input, não faz nada
  if (setorSelect.tagName === 'INPUT') return;
  
  // Remove select atual
  setorSelect.remove();
  
  // Cria input
  const input = document.createElement('input');
  input.type = 'text';
  input.id = 'movimentacao-setor';
  input.className = 'w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500';
  input.placeholder = 'Digite o setor';
  
  container.appendChild(input);
}

voltarParaFiliais() {
  const grid = document.getElementById('grid-filiais');
  const detalhes = document.getElementById('detalhes-filial');
  if (grid) grid.classList.remove('hidden');
  if (detalhes) detalhes.classList.add('hidden');
  this.filialAtual = null; // Reset da filial atual
}

async loadFiliais() {
  try {
    const { data, error } = await supabaseClient.from('filiais').select('*').order('nome', { ascending: true });
    if (error) {
      console.error('Erro ao buscar filiais:', error);
      return;
    }

    const grid = document.getElementById('grid-filiais');
    if (!grid) return;
    grid.innerHTML = '';

    // Cards reais
    (data || []).forEach(f => {
      const card = document.createElement('div');
      card.className = 'bg-white p-6 rounded-lg shadow cursor-pointer hover:bg-blue-50 text-center';
      card.innerHTML = `<h3 class="text-lg font-semibold">${f.nome}</h3>`;
      card.addEventListener('click', () => this.openFilial(f.id, f.nome));
      grid.appendChild(card);
    });
  } catch (err) {
    console.error('Erro em loadFiliais:', err);
  }
}


async openFilial(id, nome) {
  this.filialAtual = id;
  document.getElementById('grid-filiais').classList.add('hidden');
  document.getElementById('detalhes-filial').classList.remove('hidden');
  document.getElementById('nome-filial').textContent = nome;

  //await this.loadProdutosEnvio();
  await this.loadEnvios();
}

async loadProdutosEnvio() {
  const { data, error } = await supabaseClient.from('produtos').select('id, nome');
  if (error) return console.error(error);

  const select = document.getElementById('produto-envio');
  select.innerHTML = '<option value="">Selecione o produto</option>';
  data.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.nome;
    select.appendChild(opt);
  });
}

async loadEnvios() {
  try {
    const lista = document.getElementById('lista-envios-filial');
    if (!lista) return;
    lista.innerHTML = '';

    // Monta query: se AGRICOPEL então filial_id IS NULL, senão eq(filial_id, id)
    let query = supabaseClient
      .from('envios_filiais')
      .select('id, quantidade, data_envio, produto_id');
    
    if (this.filialAtual === 'AGRICOPEL') {
      query = query.is('filial_id', null);
    } else {
      query = query.eq('filial_id', this.filialAtual);
    }

    const { data: envios, error } = await query.order('data_envio', { ascending: false });
    if (error) {
      console.error('Erro ao buscar envios:', error);
      lista.innerHTML = `<div class="p-4 text-red-600">Erro ao carregar envios (veja console)</div>`;
      return;
    }

    if (!envios || envios.length === 0) {
      lista.innerHTML = '<div class="p-4 text-gray-600">Nenhum envio registrado para esta seleção.</div>';
      return;
    }

    // Para cada envio, busca solicitante e observações na tabela movimentacoes
    for (const e of envios) {
      const { data: movs, error: movError } = await supabaseClient
        .from('movimentacoes')
        .select('solicitante, observacoes')
        .eq('produto_id', e.produto_id)
        .eq('filial_id', this.filialAtual === 'AGRICOPEL' ? null : this.filialAtual)
        .order('data', { ascending: false })
        .limit(1); // pega a movimentação mais recente

      if (movError) {
        console.error('Erro ao buscar movimentações:', movError);
      }

      e.solicitante = movs?.[0]?.solicitante || '—';
      e.observacoes = movs?.[0]?.observacoes || '—';
    }

    // Renderiza cards
    lista.innerHTML = '';
    envios.forEach(e => {
  const produto = this.produtos.find(p => String(p.id) === String(e.produto_id));
  const produtoNome = produto ? produto.nome : '—';
  const color = e.quantidade <= 2 ? 'bg-green-50 border-green-400 text-green-800'
             : e.quantidade <= 5 ? 'bg-yellow-50 border-yellow-400 text-yellow-800'
             : 'bg-red-50 border-red-400 text-red-800';
  
  const card = document.createElement('div');
  card.className = `p-4 rounded-lg border shadow-md w-64 flex flex-col justify-between gap-3 ${color}`;

  card.innerHTML = `
    <!-- Nome do produto em destaque -->
    <div class="mb-2">
      <p class="text-2xl font-extrabold text-gray-800 truncate">${produtoNome}</p>
      <p class="text-xs text-gray-500">${e.data_envio ? new Date(e.data_envio).toLocaleString('pt-BR') : ''}</p>
    </div>

    <!-- Quantidade -->
    <div class="flex items-center justify-between mb-2">
      <span class="text-xl font-bold">${e.quantidade} unid.</span>
      <span class="px-2 py-1 rounded text-sm font-medium ${color}">${e.quantidade <= 2 ? 'Baixo' : e.quantidade <= 5 ? 'Médio' : 'Alto'}</span>
    </div>

    <!-- Solicitante e Observações -->
    <div class="text-sm text-gray-700 space-y-1">
      <p><strong>Solicitante:</strong> ${e.solicitante}</p>
      <p><strong>Observações:</strong> ${e.observacoes}</p>
    </div>
  `;

  lista.appendChild(card);
});



  } catch (err) {
    console.error('Erro em loadEnvios:', err);
  }
}




async novoEnvio(e) {
  e.preventDefault();
  const produtoId = document.getElementById('produto-envio').value;
  const quantidade = parseInt(document.getElementById('quantidade-envio').value, 10);

  if (!produtoId || !quantidade) return;

  let filialPayload;
  if (this.filialAtual === 'AGRICOPEL') {
    filialPayload = null;
  } else {
    filialPayload = this.filialAtual;
  }

  const insertObj = {
    filial_id: filialPayload,
    produto_id: produtoId,
    quantidade
  };

  const { error } = await supabaseClient.from('envios_filiais').insert([ insertObj ]);
  if (error) {
    console.error(error);
    this.showToast('Erro ao registrar envio (veja console)', 'error');
    return;
  }

  document.getElementById('form-novo-envio').reset();
  this.loadEnvios();
}








// Sua função loadReport só atualiza o conteúdo
loadReport(type) {
    const content = document.getElementById('relatorio-content');
    
    switch (type) {
        case 'estoque':
            content.innerHTML = this.generateStockReport();
            break;
        case 'movimentacoes':
            content.innerHTML = this.generateMovementReport();
            break;
        case 'categorias':
            content.innerHTML = this.generateCategoryReport();
            break;
        case 'historico':
            content.innerHTML = this.generateHistoryReport();
            break;
    }
}

generateStockReport() {
    const lowStock = this.produtos.filter(p => p.quantidade <= p.quantidade_minima);
    const zeroStock = this.produtos.filter(p => p.quantidade === 0);
    const normalStock = this.produtos.filter(p => p.quantidade > p.quantidade_minima);

    return `
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div class="bg-white p-6 rounded-lg shadow">
                <h3 class="text-lg font-semibold text-gray-800 mb-2">Estoque Normal</h3>
                <p class="text-2xl font-bold text-green-600">${normalStock.length}</p>
            </div>
            <div class="bg-white p-6 rounded-lg shadow">
                <h3 class="text-lg font-semibold text-gray-800 mb-2">Estoque Baixo</h3>
                <p class="text-2xl font-bold text-yellow-600">${lowStock.length}</p>
            </div>
            <div class="bg-white p-6 rounded-lg shadow">
                <h3 class="text-lg font-semibold text-gray-800 mb-2">Sem Estoque</h3>
                <p class="text-2xl font-bold text-red-600">${zeroStock.length}</p>
            </div>
        </div>
        <div class="bg-white rounded-lg shadow">
            <div class="px-6 py-4 border-b border-gray-200">
                <h3 class="text-lg font-semibold text-gray-800">Todos os Produtos</h3>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produto</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Código</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantidade</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mínimo</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                        ${this.produtos.map(produto => `
                            <tr>
                                <td data-label="Produto" class="px-6 py-4 whitespace font-medium text-gray-900 responsive-cell">${produto.nome}</td>
                                <td data-label="Código" class="px-6 py-4 whitespace text-sm font-mono responsive-cell">${produto.codigo}</td>
                                <td data-label="Quantidade" class="px-6 py-4 whitespace text-sm font-semibold responsive-cell">${produto.quantidade}</td>
                                <td data-label="Mínimo" class="px-6 py-4 whitespace text-sm responsive-cell">${produto.quantidade_minima}</td>
                                <td data-label="Status" class="px-6 py-4 whitespace responsive-cell">${this.getStatusBadge(produto)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

generateMovementReport() {
    const productMovements = {};
    
    this.movimentacoes.forEach(mov => {
        if (!productMovements[mov.produto.id]) {
            productMovements[mov.produto.id] = {
                produto: mov.produto,
                entradas: 0,
                saidas: 0,
                total: 0
            };
        }
        
        if (mov.tipo === 'entrada') {
            productMovements[mov.produto.id].entradas += mov.quantidade;
        } else {
            productMovements[mov.produto.id].saidas += mov.quantidade;
        }
        productMovements[mov.produto.id].total += mov.quantidade;
    });

    const sortedProducts = Object.values(productMovements)
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);

    return `
        <div class="bg-white rounded-lg shadow">
            <div class="px-6 py-4 border-b border-gray-200">
                <h3 class="text-lg font-semibold text-gray-800">Top 10 Produtos Mais Movimentados</h3>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produto</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Código</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entradas</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Saídas</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                        ${sortedProducts.map(item => `
                            <tr>
                                <td data-label="Produto" class="px-6 py-4 whitespace-nowrap font-medium text-gray-900 responsive-cell">${item.produto.nome}</td>
                                <td data-label="Código" class="px-6 py-4 whitespace-nowrap text-sm font-mono responsive-cell">${item.produto.codigo}</td>
                                <td data-label="Entradas" class="px-6 py-4 whitespace-nowrap text-sm text-green-600 responsive-cell">${item.entradas}</td>
                                <td data-label="Saídas" class="px-6 py-4 whitespace-nowrap text-sm text-red-600 responsive-cell">${item.saidas}</td>
                                <td data-label="Total" class="px-6 py-4 whitespace-nowrap text-sm font-semibold responsive-cell">${item.total}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

generateHistoryReport() {
    if (!this.movimentacoes || this.movimentacoes.length === 0) {
        return '<p class="p-4 text-center text-gray-600">Nenhum histórico encontrado.</p>';
    }

    return `
        <div class="bg-white rounded-lg shadow">
            <div class="px-6 py-4 border-b border-gray-200">
                <h3 class="text-lg font-semibold text-gray-800">Histórico</h3>
            </div>
            <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                    <tr>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Produto</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantidade</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Responsável</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Solicitante</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Chamado</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Filial</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Setor</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Observações</th>
                    </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                    ${this.movimentacoes.map(mov =>  {const filialName = this.getFilialName(mov.filial_id);
                      return `
                        <tr>
                            <td data-label="Produto" class="px-6 py-4 whitespace-nowrap font-medium text-gray-900 responsive-cell">${mov.produto.nome}</td>
                            <td data-label="Tipo" class="px-6 py-4 whitespace-nowrap text-sm font-semibold responsive-cell ${mov.tipo === 'entrada' ? 'text-green-600' : 'text-red-600'}">
                                ${mov.tipo === 'entrada' ? '↑ Entrada' : '↓ Saída'}
                            </td>
                            <td data-label="Quantidade" class="px-6 py-4 whitespace-nowrap text-sm responsive-cell">${mov.quantidade}</td>
                            <td data-label="Responsável" class="px-6 py-4 whitespace-nowrap text-sm responsive-cell">${mov.responsavel || '-'}</td>
                            <td data-label="Solicitante" class="px-6 py-4 whitespace-nowrap text-sm responsive-cell">${mov.solicitante || '-'}</td>
                            <td data-label="Chamado" class="px-6 py-4 whitespace-nowrap text-sm responsive-cell">${mov.chamado || '-'}</td>
                            <td data-label="Filial" class="px-6 py-4 whitespace-nowrap text-sm responsive-cell">${filialName || '-'}</td>
                            <td data-label="Setor" class="px-6 py-4 whitespace-nowrap text-sm responsive-cell">${mov.setor || '-'}</td>
                            <td data-label="Data" class="px-6 py-4 whitespace-nowrap text-sm responsive-cell">${new Date(mov.data).toLocaleString('pt-BR')}</td>
                            <td data-label="Observações" class="px-6 py-4 whitespace-nowrap text-sm responsive-cell">${mov.observacoes || '-'}</td>
                        </tr>
                    `}).join('')}
                </tbody>
            </table>
        </div>
    `;
}

generateCategoryReport() {
    const categories = {};
    
    this.movimentacoes.forEach(mov => {
        const categoria = mov.produto.categoria || 'Outros';
        if (!categories[categoria]) {
            categories[categoria] = { entradas: 0, saidas: 0 };
        }
        
        if (mov.tipo === 'entrada') {
            categories[categoria].entradas += mov.quantidade;
        } else {
            categories[categoria].saidas += mov.quantidade;
        }
    });

    return `
        <div class="bg-white rounded-lg shadow">
            <div class="px-6 py-4 border-b border-gray-200">
                <h3 class="text-lg font-semibold text-gray-800">Movimentações por Categoria</h3>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Categoria</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entradas</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Saídas</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Saldo</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                        ${Object.entries(categories).map(([categoria, dados]) => {
                            const saldo = dados.entradas - dados.saidas;
                            return `
                                <tr>
                                    <td data-label="Categoria" class="px-6 py-4 whitespace-nowrap font-medium text-gray-900 responsive-cell">${categoria}</td>
                                    <td data-label="Entradas" class="px-6 py-4 whitespace-nowrap text-sm text-green-600 responsive-cell">${dados.entradas}</td>
                                    <td data-label="Saídas" class="px-6 py-4 whitespace-nowrap text-sm text-red-600 responsive-cell">${dados.saidas}</td>
                                    <td data-label="Saldo" class="px-6 py-4 whitespace-nowrap text-sm font-semibold responsive-cell ${saldo >= 0 ? 'text-green-600' : 'text-red-600'}">${saldo}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

// Adicione no final do app.js

updateDashboard() {
    document.getElementById('total-produtos').textContent = this.stats.totalProducts || 0;
    document.getElementById('estoque-baixo').textContent = this.stats.lowStock || 0;
    document.getElementById('movimentacoes-hoje').textContent = this.stats.todayMovements || 0;

    // Atualiza Top 5 mais movimentados
    this.updateTopMovimentados();
    this.updateEnviosPorFilial();
    this.updateSaldoPorCategoria();
    this.updateProdutosZerados();
    this.updateListaSimplificada();
    
    // Novos cards solicitados
    this.updateTopUsuarios();
    this.updateTopSetores();
    this.updateTopFiliais();
}

updateTopMovimentados() {
  const container = document.getElementById('top-movimentados');
  if (!container) return;

  const contagem = {};
  this.movimentacoes.forEach(m => {
    contagem[m.produto.nome] = (contagem[m.produto.nome] || 0) + m.quantidade;
  });

  const top5 = Object.entries(contagem)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  container.innerHTML = top5.map(([nome, qtd]) => `<p>${nome} - <span class="font-bold">${qtd}</span></p>`).join('');
}

updateEnviosPorFilial() {
const container = document.getElementById('envios-por-filial');
if (!container) return;


if (!this.movimentacoes?.length || !this.filiais?.length) {
container.innerHTML = '<p class="text-sm text-gray-500">Sem dados</p>';
return;
}


const contagem = {};
this.movimentacoes
.filter(m => m.tipo === 'saida' && m.filial_id != null)
.forEach(m => {
const nome = this.getFilialName(m.filial_id);
const qtd = Number(m.quantidade) || 0;
contagem[nome] = (contagem[nome] || 0) + qtd;
});


const top = Object.entries(contagem)
.sort((a, b) => b[1] - a[1])
.slice(0, 5);


container.innerHTML = top.length
? top
.map(([filial, qtd]) => `
<div class="flex justify-between text-sm">
<span class="text-gray-700">${filial}</span>
<span class="font-bold">${qtd}</span>
</div>`)
.join('')
: '<p class="text-sm text-gray-500">Nenhum envio registrado</p>';
}

updateSaldoPorCategoria() {
  const container = document.getElementById('saldo-categoria');
  if (!container) return;

  const contagem = {};
  this.produtos.forEach(p => {
    contagem[p.categoria] = (contagem[p.categoria] || 0) + p.quantidade;
  });

  const top = Object.entries(contagem)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  container.innerHTML = top.map(([cat, qtd]) => `<p>${cat} - <span class="font-bold">${qtd}</span></p>`).join('');
}

updateProdutosZerados() {
  const container = document.getElementById('produtos-zerados');
  if (!container) return;

  const zerados = this.produtos.filter(p => p.quantidade === 0);

  if (zerados.length === 0) {
    container.innerHTML = `<p class="text-green-600">Nenhum produto zerado</p>`;
    return;
  }

  // Lista os produtos zerados
  const listaProdutos = zerados.map(p => `<li>${p.nome}</li>`).join('');
  container.innerHTML = `
    <ul class="ml-4 list-disc text-red-600">${listaProdutos}</ul>
  `;
}


updateListaSimplificada() {
  const tbody = document.getElementById('lista-simplificada');
  if (!tbody) return;

  // Ordena produtos por nome (A-Z)
  const produtosOrdenados = [...this.produtos].sort((a, b) => a.nome.localeCompare(b.nome));

  tbody.innerHTML = produtosOrdenados.map(p => `
    <tr>
      <td class="px-6 py-2 text-sm text-gray-900">${p.nome}</td>
      <td class="px-6 py-2 text-sm font-bold">${p.quantidade}</td>
    </tr>
  `).join('');
}



}





// Adicionar funções dos novos cards na classe (antes da inicialização)
EstoqueApp.prototype.updateTopUsuarios = function() {
  const container = document.getElementById('top-usuarios');
  if (!container) return;

  const contagem = {};
  this.movimentacoes.forEach(m => {
    if (m.tipo === 'saida' && m.solicitante) {
      contagem[m.solicitante] = (contagem[m.solicitante] || 0) + m.quantidade;
    }
  });

  const top5 = Object.entries(contagem)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  if (top5.length === 0) {
    container.innerHTML = '<p class="text-gray-500 text-xs">Nenhum usuário encontrado</p>';
    return;
  }

  container.innerHTML = top5.map(([usuario, qtd]) => 
    `<p class="text-xs">${usuario} - <span class="font-bold">${qtd}</span></p>`
  ).join('');
};

EstoqueApp.prototype.updateTopSetores = function() {
  const container = document.getElementById('top-setores');
  if (!container) return;

  const contagem = {};
  this.movimentacoes.forEach(m => {
    if (m.tipo === 'saida' && m.setor && m.setor !== 'VAN') {
      contagem[m.setor] = (contagem[m.setor] || 0) + m.quantidade;
    }
  });

  const top5 = Object.entries(contagem)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  if (top5.length === 0) {
    container.innerHTML = '<p class="text-gray-500 text-xs">Nenhum setor encontrado</p>';
    return;
  }

  container.innerHTML = top5.map(([setor, qtd]) => 
    `<p class="text-xs">${setor} - <span class="font-bold">${qtd}</span></p>`
  ).join('');
};

EstoqueApp.prototype.updateTopFiliais = function() {
  const container = document.getElementById('top-filiais');
  if (!container) return;

  const contagem = {};
  this.movimentacoes.forEach(m => {
    if (m.tipo === 'saida' && m.filial_id) {
      const filialNome = this.getFilialName(m.filial_id);
      if (filialNome && filialNome !== '—') {
        contagem[filialNome] = (contagem[filialNome] || 0) + m.quantidade;
      }
    }
  });

  const top5 = Object.entries(contagem)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  if (top5.length === 0) {
    container.innerHTML = '<p class="text-gray-500 text-xs">Nenhuma filial encontrada</p>';
    return;
  }

  container.innerHTML = top5.map(([filial, qtd]) => 
    `<p class="text-xs">${filial} - <span class="font-bold">${qtd}</span></p>`
  ).join('');
};

// Initialize the application e exponha globalmente
const app = new EstoqueApp();
window.app = app;                        // para o HTML enxergar `app`
window.fetchMovimentacoes = () => {
  app.loadData();                        // ou app.updateMovementsTable()
};



