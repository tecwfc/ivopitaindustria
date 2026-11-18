// ============================================
// IVO PITA — ADMIN (Supabase)
// ============================================
const sb = window.supabaseClient;
if (!sb) {
  console.error('❌ supabaseClient não inicializado. Verifique o <head> do admin.html');
}

// ============================================
// ESTADO GLOBAL
// ============================================
let produtosAdmin = [];
let vendasAdmin = [];
let configAdmin = {};
let marqueeAdmin = [];
let bannersAdmin = [];
let estruturaAdmin = [];
let tamanhosAdmin = [];
let usuariosAdmin = [];
let visualizacaoCards = false;

// ============================================
// HELPERS
// ============================================
const loading = (on) => {
  const el = document.getElementById('loading-overlay');
  if (el) el.classList.toggle('active', !!on);
};

const driveImg = (url, size = 400) => {
  if (!url) return '';
  if (url.includes('googleusercontent.com')) {
    const base = url.replace(/=w\d+.*$/, '').replace(/=s\d+.*$/, '').split('?')[0];
    return `${base}=w${size}`;
  }
  const m = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (m) return `https://lh3.googleusercontent.com/u/0/d/${m[1]}=w${size}`;
  return url;
};

const fmtMoney = (v) =>
  `R$ ${(parseFloat(v) || 0).toFixed(2).replace('.', ',')}`;

const fmtDate = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('pt-BR');
  } catch { return '—'; }
};

// ============================================
// MODAIS
// ============================================
window.abrirModal = function (id) {
  const m = document.getElementById(id);
  if (m) m.classList.add('active');
  if (id === 'modalProduto') prepararNovoProduto();
  if (id === 'modalConfig') carregarConfig();
  if (id === 'modalMarquee') carregarMarquee();
  if (id === 'modalBanner') carregarBanners();
  if (id === 'modalEstrutura') carregarEstrutura();
  if (id === 'modalTamanhos') carregarTamanhos();
  if (id === 'modalUsuarios') carregarUsuarios();
  if (id === 'modalVendas') carregarVendasAdmin();
  if (id === 'modalManutencao') carregarManutencao();
};

window.fecharModal = function (id) {
  const m = document.getElementById(id);
  if (m) m.classList.remove('active');
  if (id === 'modalProduto') resetFormProduto();
};

window.logout = function () {
  sessionStorage.removeItem('ivo_auth');
  window.location.href = 'login.html';
};

// ============================================
// PRODUTOS — FORM
// ============================================
function resetFormProduto() {
  const form = document.getElementById('formProduto');
  if (form) form.reset();
  const edit = document.getElementById('editID'); if (edit) edit.value = '';
  const id = document.getElementById('ID'); if (id) id.value = '';
  const title = document.getElementById('modalProdutoTitle');
  if (title) title.textContent = 'Adicionar Produto';
  const box = document.getElementById('imagePreviewBox');
  if (box) box.classList.remove('has-image');
  const img = document.getElementById('imagePreviewImg');
  if (img) { img.src = ''; img.style.display = 'none'; }
  const txt = document.getElementById('imagePreviewText');
  if (txt) txt.textContent = 'Cole uma URL acima para visualizar a imagem';
}

function prepararNovoProduto() {
  resetFormProduto();
}

// Preview da imagem
document.addEventListener('DOMContentLoaded', () => {
  const imgInput = document.getElementById('Imagem');
  if (imgInput) {
    imgInput.addEventListener('input', function () {
      const url = this.value.trim();
      const box = document.getElementById('imagePreviewBox');
      const img = document.getElementById('imagePreviewImg');
      const txt = document.getElementById('imagePreviewText');
      if (!url) {
        box.classList.remove('has-image');
        img.style.display = 'none';
        txt.textContent = 'Cole uma URL acima para visualizar a imagem';
        return;
      }
      const src = driveImg(url, 400);
      img.src = src;
      img.style.display = 'block';
      img.onload = () => { box.classList.add('has-image'); txt.textContent = 'Imagem carregada ✓'; };
      img.onerror = () => { box.classList.remove('has-image'); img.style.display = 'none'; txt.textContent = 'Não foi possível carregar'; };
    });
  }

  // Submit do form produto
  const formProd = document.getElementById('formProduto');
  if (formProd) formProd.addEventListener('submit', salvarProduto);

  const dataAtual = document.getElementById('data-atual');
  if (dataAtual) dataAtual.textContent = new Date().toLocaleDateString('pt-BR');

  // Botões de nova categoria
  const btnNovaCat = document.getElementById('btnNovaCategoria');
  if (btnNovaCat) btnNovaCat.addEventListener('click', adicionarNovaCategoria);

  // Init
  carregarProdutos();
  carregarCategoriasSelect();
});

async function salvarProduto(e) {
  e.preventDefault();

  const editID = document.getElementById('editID').value.trim();
  const payload = {
  
  "ID": document.getElementById('ID').value.trim() || null,
  "referencia": document.getElementById('referencia').value.trim(),
  "Nome do Produto": document.getElementById('Nome do Produto').value.trim(),
  "Categoria": document.getElementById('Categoria').value.trim(),
  "Subcategoria": document.getElementById('Subcategoria').value.trim() || null,
  "Cores": document.getElementById('Cores').value.trim() || null,
  "Tamanho": document.getElementById('Tamanho').value.trim() || null,
  "Quantidade": document.getElementById('Quantidade').value.trim() || null,
  "Preço": parseFloat(document.getElementById('Preço').value) || 0,
  "Estoque": parseInt(document.getElementById('Estoque').value) || 0,
  "Vendidos": 0,
  // ❌ "Saldo Estoque" NÃO vai aqui — é gerada pelo banco
  "Imagem": document.getElementById('Imagem').value.trim() || null,
  "Disponível": document.getElementById('Disponível').checked ? 'sim' : 'não',
  "Destaque": document.getElementById('Destaque').checked ? 'sim' : 'não'
};

  if (!payload.referencia) return alert('Informe a referência');
  if (!payload['Nome do Produto']) return alert('Informe o nome');
  if (!payload.Categoria) return alert('Informe a categoria');
  if (!payload['Preço'] || payload['Preço'] <= 0) return alert('Preço inválido');

  loading(true);
  try {
    if (editID) {
      const { error } = await sb.from('produtos').update(payload).eq('"ID"', editID);
      if (error) throw error;
      alert('✅ Produto atualizado!');
    } else {
      const { data, error } = await sb.from('produtos').insert([payload]).select('id').single();
      if (error) throw error;
      if (!payload.ID && data?.id) {
        await sb.from('produtos').update({ "ID": String(data.id) }).eq('id', data.id);
      }
      alert('✅ Produto cadastrado!');
    }
    fecharModal('modalProduto');
    carregarProdutos();
  } catch (err) {
    console.error(err);
    alert('❌ Erro: ' + (err.message || 'desconhecido'));
  } finally {
    loading(false);
  }
}

async function adicionarNovaCategoria() {
  const input = document.getElementById('novaCategoria');
  const valor = input.value.trim();
  if (!valor) return alert('Digite uma categoria');
  const { error } = await sb.from('estrutura').insert([{
    grupo: 'Folheado Dourado',
    categoria: valor,
    subcategoria: ''
  }]);
  if (error) return alert('❌ ' + error.message);
  alert('✅ Categoria criada');
  input.value = '';
  carregarCategoriasSelect();
}

async function carregarCategoriasSelect() {
  const select = document.getElementById('Categoria');
  if (!select) return;
  const { data } = await sb.from('estrutura').select('categoria');
  const cats = [...new Set((data || []).map(x => x.categoria).filter(Boolean))];
  const valorAtual = select.value;
  select.innerHTML = '<option value="">Selecione uma categoria</option>' +
    cats.map(c => `<option value="${c}">${c}</option>`).join('');
  if (valorAtual) select.value = valorAtual;
}

// ============================================
// PRODUTOS — CARREGAR E RENDERIZAR
// ============================================
window.carregarProdutos = async function () {
  loading(true);
  try {
    const { data, error } = await sb.from('produtos').select('*').order('id', { ascending: true });
    if (error) throw error;

    produtosAdmin = (data || []).map(p => ({
      id: p.id,
      ID: p["ID"] || String(p.id),
      referencia: p["referencia"] || '',
      nome: p["Nome do Produto"] || '',
      categoria: p["Categoria"] || '',
      subcategoria: p["Subcategoria"] || '',
      cores: p["Cores"] || '',
      tamanho: p["Tamanho"] || '',
      quantidade: p["Quantidade"] || '',
      preco: parseFloat(p["Preço"]) || 0,
      estoque: parseInt(p["Estoque"]) || 0,
      vendidos: parseInt(p["Vendidos"]) || 0,
      saldo: Math.max(0, (parseInt(p["Estoque"]) || 0) - (parseInt(p["Vendidos"]) || 0)),
      imagem: p["Imagem"] || '',
      disponivel: (p["Disponível"] || '').toLowerCase() === 'sim',
      destaque: (p["Destaque"] || '').toLowerCase() === 'sim'
    }));

    renderizarTabela();
    renderizarCards();
    atualizarDashboard();
    atualizarGraficos();
    atualizarFiltrosCards();
  } catch (err) {
    console.error(err);
    alert('❌ Erro ao carregar: ' + err.message);
  } finally {
    loading(false);
  }
};

function renderizarTabela() {
  const tbody = document.getElementById('produtos-tbody');
  if (!tbody) return;

  if (!produtosAdmin.length) {
    tbody.innerHTML = `<tr><td colspan="16" class="text-center py-6 text-gray-400">
      <i class="fas fa-inbox text-2xl block mb-2"></i>Nenhum produto</td></tr>`;
    return;
  }

  tbody.innerHTML = produtosAdmin.map(p => {
    const img = p.imagem
      ? `<img src="${driveImg(p.imagem, 100)}" onerror="this.style.display='none'">`
      : '—';
    const badge = p.estoque <= 0
      ? '<span class="badge-estoque bg-red-100">0</span>'
      : p.estoque <= 5
        ? `<span class="badge-estoque bg-yellow-100">${p.estoque}</span>`
        : `<span class="badge-estoque bg-green-100">${p.estoque}</span>`;

    return `
      <tr data-id="${p.ID}">
        <td class="text-center">${p.ID}</td>
        <td class="text-center">${img}</td>
        <td>${p.nome}</td>
        <td>${p.referencia}</td>
        <td class="text-right">${fmtMoney(p.preco)}</td>
        <td>${p.quantidade || '—'}</td>
        <td><span class="badge-categoria">${p.categoria || '—'}</span></td>
        <td><span class="badge-subcategoria">${p.subcategoria || '—'}</span></td>
        <td>${p.tamanho || '—'}</td>
        <td class="text-xs">${p.imagem ? '✓' : '—'}</td>
        <td class="text-center">${p.disponivel ? '✅' : '❌'}</td>
        <td class="text-center">${p.destaque ? '⭐' : '—'}</td>
        <td class="text-center">${badge}</td>
        <td class="text-center">${p.vendidos}</td>
        <td class="text-center">${p.saldo}</td>
        <td>
          <div class="acoes-rapidas">
            <button class="btn-acao btn-repor" onclick="abrirRepor('${p.ID}')" title="Repor"><i class="fas fa-plus"></i></button>
            <button class="btn-acao btn-editar" onclick="editarProduto('${p.ID}')" title="Editar"><i class="fas fa-pen"></i></button>
            <button class="btn-acao btn-ocultar ${p.disponivel ? '' : 'esta-oculto'}" onclick="toggleDisponivel('${p.ID}')" title="Disponível"><i class="fas fa-eye${p.disponivel ? '' : '-slash'}"></i></button>
            <button class="btn-acao btn-destaque ${p.destaque ? 'esta-destaque' : ''}" onclick="toggleDestaque('${p.ID}')" title="Destaque"><i class="fas fa-star"></i></button>
            <button class="btn-acao btn-esgotar" onclick="zerarEstoque('${p.ID}')" title="Zerar"><i class="fas fa-ban"></i></button>
            <button class="btn-acao btn-excluir" onclick="excluirProduto('${p.ID}')" title="Excluir"><i class="fas fa-trash"></i></button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

function renderizarCards() {
  const cont = document.getElementById('produtos-cards-container');
  if (!cont) return;

  if (!produtosAdmin.length) {
    cont.innerHTML = `<p class="col-span-full text-center py-6 text-gray-400">Nenhum produto</p>`;
    return;
  }

  cont.innerHTML = produtosAdmin.map(p => {
    const badgeEstoque = p.estoque <= 0
      ? '<span class="card-estoque-badge esgotado"><span class="dot"></span>Esgotado</span>'
      : p.estoque <= 5
        ? `<span class="card-estoque-badge baixo"><span class="dot"></span>${p.estoque} un.</span>`
        : `<span class="card-estoque-badge"><span class="dot"></span>${p.estoque} un.</span>`;

    return `
      <div class="produto-card">
        <div class="card-imagem-wrapper">
          <img class="card-imagem" src="${driveImg(p.imagem, 300) || 'data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22300%22 height=%22300%22><text x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 fill=%22%23999%22>Sem imagem</text></svg>'}" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22300%22 height=%22300%22><text x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 fill=%22%23999%22>Sem imagem</text></svg>'">
          <div class="card-badges-status">
            ${p.destaque ? '<div class="card-badge-status destaque"><i class="fas fa-star"></i></div>' : ''}
            ${!p.disponivel ? '<div class="card-badge-status oculto"><i class="fas fa-eye-slash"></i></div>' : ''}
          </div>
          ${p.referencia ? `<div class="card-ref-overlay"><span class="card-ref-label">REF</span><span class="card-ref-valor">${p.referencia}</span></div>` : ''}
        </div>
        <div class="card-body">
          <div class="card-categoria-titulo">${p.categoria || '—'}</div>
          <div class="card-nome">${p.nome}</div>
          ${p.subcategoria ? `<span class="card-ref-badge">${p.subcategoria}</span>` : ''}
          <div class="card-preco">${fmtMoney(p.preco)}</div>
          ${badgeEstoque}
        </div>
        <div class="card-acoes">
          <button class="btn-acao btn-repor" onclick="abrirRepor('${p.ID}')" title="Repor"><i class="fas fa-plus"></i></button>
          <button class="btn-acao btn-editar" onclick="editarProduto('${p.ID}')" title="Editar"><i class="fas fa-pen"></i></button>
          <button class="btn-acao btn-ocultar ${p.disponivel ? '' : 'esta-oculto'}" onclick="toggleDisponivel('${p.ID}')" title="Disponível"><i class="fas fa-eye${p.disponivel ? '' : '-slash'}"></i></button>
          <button class="btn-acao btn-destaque ${p.destaque ? 'esta-destaque' : ''}" onclick="toggleDestaque('${p.ID}')" title="Destaque"><i class="fas fa-star"></i></button>
          <button class="btn-acao btn-esgotar" onclick="zerarEstoque('${p.ID}')" title="Zerar"><i class="fas fa-ban"></i></button>
          <button class="btn-acao btn-excluir" onclick="excluirProduto('${p.ID}')" title="Excluir"><i class="fas fa-trash"></i></button>
        </div>
      </div>`;
  }).join('');
}

function atualizarDashboard() {
  const total = produtosAdmin.length;
  const estoqueTotal = produtosAdmin.reduce((s, p) => s + p.estoque, 0);
  const baixo = produtosAdmin.filter(p => p.estoque <= 5 && p.estoque > 0).length;
  const destaques = produtosAdmin.filter(p => p.destaque).length;
  const cats = new Set(produtosAdmin.map(p => p.categoria).filter(Boolean)).size;

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('total-produtos', total);
  set('total-estoque', estoqueTotal);
  set('estoque-baixo', baixo);
  set('total-destaques', destaques);
  set('total-categorias', cats);
  set('total-registros', `${total} registros`);
}

let chartCat = null, chartEstoque = null;
function atualizarGraficos() {
  if (typeof Chart === 'undefined') return;

  const porCat = {};
  produtosAdmin.forEach(p => {
    const k = p.categoria || 'Sem categoria';
    porCat[k] = (porCat[k] || 0) + 1;
  });

  const top5 = [...produtosAdmin]
    .sort((a, b) => b.estoque - a.estoque)
    .slice(0, 5);

  const ctx1 = document.getElementById('chartCategorias');
  if (ctx1) {
    if (chartCat) chartCat.destroy();
    chartCat = new Chart(ctx1, {
      type: 'doughnut',
      data: {
        labels: Object.keys(porCat),
        datasets: [{ data: Object.values(porCat), backgroundColor: ['#2f6b4f','#d4af37','#3b82f6','#ef4444','#a855f7','#f59e0b','#10b981'] }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { font: { size: 10 } } } } }
    });
  }

  const ctx2 = document.getElementById('chartEstoque');
  if (ctx2) {
    if (chartEstoque) chartEstoque.destroy();
    chartEstoque = new Chart(ctx2, {
      type: 'bar',
      data: {
        labels: top5.map(p => p.nome.substring(0, 20)),
        datasets: [{ label: 'Estoque', data: top5.map(p => p.estoque), backgroundColor: '#2f6b4f' }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });
  }
}

// ============================================
// AÇÕES RÁPIDAS
// ============================================
window.editarProduto = function (idTexto) {
  const p = produtosAdmin.find(x => String(x.ID) === String(idTexto));
  if (!p) return alert('Produto não encontrado');

  document.getElementById('editID').value = p.ID;
  document.getElementById('ID').value = p.ID;
  document.getElementById('referencia').value = p.referencia;
  document.getElementById('Nome do Produto').value = p.nome;
  document.getElementById('Categoria').value = p.categoria;
  document.getElementById('Subcategoria').value = p.subcategoria;
  document.getElementById('Cores').value = p.cores;
  document.getElementById('Tamanho').value = p.tamanho;
  document.getElementById('Quantidade').value = p.quantidade;
  document.getElementById('Preço').value = p.preco;
  document.getElementById('Estoque').value = p.estoque;
  document.getElementById('Saldo Estoque').value = p.saldo;
  document.getElementById('Imagem').value = p.imagem;
  document.getElementById('Disponível').checked = p.disponivel;
  document.getElementById('Destaque').checked = p.destaque;

  if (p.imagem) {
    const box = document.getElementById('imagePreviewBox');
    const img = document.getElementById('imagePreviewImg');
    img.src = driveImg(p.imagem, 300);
    img.style.display = 'block';
    box.classList.add('has-image');
    document.getElementById('imagePreviewText').textContent = 'Imagem carregada ✓';
  }

  document.getElementById('modalProdutoTitle').textContent = 'Editar Produto';
  abrirModal('modalProduto');
};

window.excluirProduto = async function (idTexto) {
  if (!confirm(`Excluir o produto #${idTexto}?`)) return;
  loading(true);
  try {
    const { error } = await sb.from('produtos').delete().eq('"ID"', idTexto);
    if (error) throw error;
    alert('✅ Produto excluído');
    carregarProdutos();
  } catch (err) {
    alert('❌ ' + err.message);
  } finally { loading(false); }
};

window.toggleDisponivel = async function (idTexto) {
  const p = produtosAdmin.find(x => String(x.ID) === String(idTexto));
  if (!p) return;
  const novo = p.disponivel ? 'não' : 'sim';
  const { error } = await sb.from('produtos').update({ "Disponível": novo }).eq('"ID"', idTexto);
  if (error) return alert('❌ ' + error.message);
  carregarProdutos();
};

window.toggleDestaque = async function (idTexto) {
  const p = produtosAdmin.find(x => String(x.ID) === String(idTexto));
  if (!p) return;
  const novo = p.destaque ? 'não' : 'sim';
  const { error } = await sb.from('produtos').update({ "Destaque": novo }).eq('"ID"', idTexto);
  if (error) return alert('❌ ' + error.message);
  carregarProdutos();
};

window.zerarEstoque = async function (idTexto) {
  if (!confirm('Zerar o estoque deste produto?')) return;
  const p = produtosAdmin.find(x => String(x.ID) === String(idTexto));
  if (!p) return;
  const { error } = await sb.from('produtos')
    .update({ "Estoque": 0 })
    .eq('"ID"', idTexto);
  if (error) return alert('❌ ' + error.message);
  carregarProdutos();
};

// ============================================
// REPOR ESTOQUE
// ============================================
let reporProdutoAtual = null;

window.abrirRepor = function (idTexto) {
  const p = produtosAdmin.find(x => String(x.ID) === String(idTexto));
  if (!p) return;
  reporProdutoAtual = p;

  document.getElementById('reporProdutoNome').textContent = p.nome;
  document.getElementById('reporProdutoRef').textContent = `REF: ${p.referencia}`;
  document.getElementById('reporEstoqueAtual').textContent = p.estoque;
  document.getElementById('reporQtdInput').value = 10;

  const preview = document.getElementById('previewRepor');
  if (preview) preview.innerHTML = `Novo estoque: <strong>${p.estoque + 10}</strong>`;

  abrirModal('modalRepor');
};

window.setReporQtd = function (qtd) {
  document.getElementById('reporQtdInput').value = qtd;
  atualizarPreviewRepor();
};

window.atualizarPreviewRepor = function () {
  if (!reporProdutoAtual) return;
  const qtd = parseInt(document.getElementById('reporQtdInput').value) || 0;
  const preview = document.getElementById('previewRepor');
  if (preview) preview.innerHTML = `Novo estoque: <strong>${reporProdutoAtual.estoque + qtd}</strong>`;
};

window.confirmarRepor = async function () {
  if (!reporProdutoAtual) return;
  const qtd = parseInt(document.getElementById('reporQtdInput').value) || 0;
  if (qtd <= 0) return alert('Informe uma quantidade');

  const btn = document.getElementById('btnConfirmarRepor');
  if (btn) { btn.disabled = true; btn.textContent = 'Salvando...'; }

  const novoEstoque = reporProdutoAtual.estoque + qtd;
  const novoSaldo = reporProdutoAtual.saldo + qtd;

  const { error } = await sb.from('produtos')
    .update({ "Estoque": novoEstoque })   // ✅
    .eq('"ID"', reporProdutoAtual.ID);

  if (btn) { btn.disabled = false; btn.textContent = 'Confirmar'; }

  if (error) return alert('❌ ' + error.message);

  alert('✅ Estoque reposto!');
  fecharModal('modalRepor');
  carregarProdutos();
};

// ============================================
// VISUALIZAÇÃO / FILTROS
// ============================================
window.alternarVisualizacao = function () {
  visualizacaoCards = !visualizacaoCards;
  const cards = document.getElementById('produtos-cards-view');
  const tabela = document.getElementById('produtos-tabela-view');
  const icone = document.getElementById('icone-toggle-view');
  const texto = document.getElementById('texto-toggle-view');
  const btn = document.getElementById('btn-toggle-view');

  if (visualizacaoCards) {
    cards.classList.remove('hidden');
    tabela.classList.add('hidden');
    icone.className = 'fas fa-table';
    texto.textContent = 'Tabela';
    btn.style.backgroundColor = '#2f6b4f';
  } else {
    cards.classList.add('hidden');
    tabela.classList.remove('hidden');
    icone.className = 'fas fa-th-large';
    texto.textContent = 'Cards';
    btn.style.backgroundColor = '#f59e0b';
  }
  renderizarCards();
};

function atualizarFiltrosCards() {
  const sel = document.getElementById('cards-filtro-categoria');
  if (!sel) return;
  const cats = [...new Set(produtosAdmin.map(p => p.categoria).filter(Boolean))].sort();
  sel.innerHTML = '<option value="">Todas as categorias</option>' +
    cats.map(c => `<option value="${c}">${c}</option>`).join('');
}

document.addEventListener('DOMContentLoaded', () => {
  const busca = document.getElementById('cards-filtro-busca');
  const cat = document.getElementById('cards-filtro-categoria');
  const ordem = document.getElementById('cards-filtro-ordem');
  if (busca) busca.addEventListener('input', filtrarCards);
  if (cat) cat.addEventListener('change', filtrarCards);
  if (ordem) ordem.addEventListener('change', filtrarCards);

  const filtroSub = document.getElementById('filtro-subcategoria');
  if (filtroSub) filtroSub.addEventListener('input', filtrarTabela);
});

function filtrarCards() {
  const busca = (document.getElementById('cards-filtro-busca')?.value || '').toLowerCase();
  const cat = document.getElementById('cards-filtro-categoria')?.value || '';
  const ordem = document.getElementById('cards-filtro-ordem')?.value || 'relevancia';

  let lista = produtosAdmin.filter(p => {
    if (busca && !p.nome.toLowerCase().includes(busca) && !p.referencia.toLowerCase().includes(busca)) return false;
    if (cat && p.categoria !== cat) return false;
    return true;
  });

  switch (ordem) {
    case 'menor-preco': lista.sort((a, b) => a.preco - b.preco); break;
    case 'maior-preco': lista.sort((a, b) => b.preco - a.preco); break;
    case 'nome-az': lista.sort((a, b) => a.nome.localeCompare(b.nome)); break;
    case 'nome-za': lista.sort((a, b) => b.nome.localeCompare(a.nome)); break;
    case 'maior-estoque': lista.sort((a, b) => b.estoque - a.estoque); break;
    case 'menor-estoque': lista.sort((a, b) => a.estoque - b.estoque); break;
  }

  const backup = produtosAdmin;
  produtosAdmin = lista;
  renderizarCards();
  produtosAdmin = backup;
}

window.limparFiltrosCards = function () {
  const b = document.getElementById('cards-filtro-busca'); if (b) b.value = '';
  const c = document.getElementById('cards-filtro-categoria'); if (c) c.value = '';
  const o = document.getElementById('cards-filtro-ordem'); if (o) o.value = 'relevancia';
  renderizarCards();
};

function filtrarTabela() {
  const termo = (document.getElementById('filtro-subcategoria')?.value || '').toLowerCase();
  const linhas = document.querySelectorAll('#produtos-tbody tr[data-id]');
  linhas.forEach(tr => {
    const texto = tr.textContent.toLowerCase();
    tr.style.display = texto.includes(termo) ? '' : 'none';
  });
}

// ============================================
// PAINEL DE COLUNAS
// ============================================
const COLUNAS = [
  { idx: 0, nome: 'ID' }, { idx: 1, nome: 'Img' }, { idx: 2, nome: 'Nome' },
  { idx: 3, nome: 'Referência' }, { idx: 4, nome: 'Preço' }, { idx: 5, nome: 'Quantidade' },
  { idx: 6, nome: 'Categoria' }, { idx: 7, nome: 'Subcategoria' }, { idx: 8, nome: 'Tamanho' },
  { idx: 9, nome: 'Imagem' }, { idx: 10, nome: 'Disponível' }, { idx: 11, nome: 'Destaque' },
  { idx: 12, nome: 'Estoque' }, { idx: 13, nome: 'Vendidos' }, { idx: 14, nome: 'Saldo' },
  { idx: 15, nome: 'Ações' }
];

window.togglePainelColunas = function () {
  const p = document.getElementById('painel-colunas');
  if (!p) return;
  p.classList.toggle('hidden');
  if (!p.classList.contains('hidden')) renderCheckboxesColunas();
};

function renderCheckboxesColunas() {
  const cont = document.getElementById('checkboxes-colunas');
  if (!cont) return;
  const hidden = JSON.parse(localStorage.getItem('admin_colunas_ocultas') || '[]');
  cont.innerHTML = COLUNAS.map(c => `
    <label class="flex items-center gap-2 text-xs">
      <input type="checkbox" ${hidden.includes(c.idx) ? '' : 'checked'} onchange="toggleColuna(${c.idx}, this.checked)">
      ${c.nome}
    </label>`).join('');
  aplicarColunas(hidden);
}

window.toggleColuna = function (idx, visible) {
  let hidden = JSON.parse(localStorage.getItem('admin_colunas_ocultas') || '[]');
  if (visible) hidden = hidden.filter(i => i !== idx);
  else if (!hidden.includes(idx)) hidden.push(idx);
  localStorage.setItem('admin_colunas_ocultas', JSON.stringify(hidden));
  aplicarColunas(hidden);
};

function aplicarColunas(hidden) {
  const ths = document.querySelectorAll('#produtosTable thead th');
  const trs = document.querySelectorAll('#produtos-tbody tr');
  ths.forEach((th, i) => th.style.display = hidden.includes(i) ? 'none' : '');
  trs.forEach(tr => {
    [...tr.children].forEach((td, i) => td.style.display = hidden.includes(i) ? 'none' : '');
  });
}

window.selecionarTodasColunas = function (show) {
  localStorage.setItem('admin_colunas_ocultas', show ? '[]' : JSON.stringify(COLUNAS.map(c => c.idx)));
  renderCheckboxesColunas();
};

window.resetarColunas = function () {
  localStorage.removeItem('admin_colunas_ocultas');
  renderCheckboxesColunas();
};

// ============================================
// CONFIGURAÇÕES
// ============================================
async function carregarConfig() {
  const { data } = await sb.from('config').select('*').limit(1).maybeSingle();
  if (!data) return;
  configAdmin = data;
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
  set('cfgWhatsapp', data.whatsapp);
  set('cfgWhatsappDisplay', data.whatsapp_display);
  set('cfgInstagram', data.instagram);
  set('cfgInstagramDisplay', data.instagram_display);
  set('cfgTelefone', data.telefone);
  set('cfgEmail', data.email);
  set('cfgEndereco', data.endereco);
  set('cfgSobreTexto', data.sobre_texto);
  set('cfgFreteGratis', data.frete_gratis_valor);
  set('cfgTaxaFrete', data.taxa_frete);
  set('cfgPixDesconto', data.pix_desconto);
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('formConfig');
  if (form) form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      whatsapp: document.getElementById('cfgWhatsapp').value.trim(),
      whatsapp_display: document.getElementById('cfgWhatsappDisplay').value.trim(),
      instagram: document.getElementById('cfgInstagram').value.trim(),
      instagram_display: document.getElementById('cfgInstagramDisplay').value.trim(),
      telefone: document.getElementById('cfgTelefone').value.trim(),
      email: document.getElementById('cfgEmail').value.trim(),
      endereco: document.getElementById('cfgEndereco').value.trim(),
      sobre_texto: document.getElementById('cfgSobreTexto').value.trim(),
      frete_gratis_valor: parseFloat(document.getElementById('cfgFreteGratis').value) || 3500,
      taxa_frete: parseFloat(document.getElementById('cfgTaxaFrete').value) || 15,
      pix_desconto: parseFloat(document.getElementById('cfgPixDesconto').value) || 5
    };
    loading(true);
    try {
      if (configAdmin?.id) {
        const { error } = await sb.from('config').update(payload).eq('id', configAdmin.id);
        if (error) throw error;
      } else {
        const { error } = await sb.from('config').insert([payload]);
        if (error) throw error;
      }
      alert('✅ Configurações salvas');
      fecharModal('modalConfig');
    } catch (err) {
      alert('❌ ' + err.message);
    } finally { loading(false); }
  });
});

// ============================================
// MARQUEE
// ============================================
async function carregarMarquee() {
  const { data } = await sb.from('marquee').select('*').order('ordem', { ascending: true });
  marqueeAdmin = data || [];
  renderizarMarquee();
}

function renderizarMarquee() {
  const cont = document.getElementById('marquee-list');
  if (!cont) return;
  if (!marqueeAdmin.length) {
    cont.innerHTML = '<p class="text-sm text-gray-400">Nenhuma frase cadastrada</p>';
    return;
  }
  cont.innerHTML = marqueeAdmin.map(m => `
    <div class="flex justify-between items-center bg-gray-50 p-3 rounded-lg">
      <div class="flex items-center gap-2 text-sm">
        <i class="${m.icone || 'fas fa-star'} text-yellow-500"></i>
        <span>${m.texto}</span>
      </div>
      <button onclick="excluirMarquee(${m.id})" class="text-red-500 text-xs"><i class="fas fa-trash"></i></button>
    </div>`).join('');
}

window.excluirMarquee = async (id) => {
  if (!confirm('Excluir esta frase?')) return;
  const { error } = await sb.from('marquee').delete().eq('id', id);
  if (error) return alert('❌ ' + error.message);
  carregarMarquee();
};

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('formMarquee');
  if (form) form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      texto: document.getElementById('marqueeTexto').value.trim(),
      icone: document.getElementById('marqueeIcone').value.trim() || 'fa-solid fa-star',
      cor: document.getElementById('marqueeCor').value
    };
    const { error } = await sb.from('marquee').insert([payload]);
    if (error) return alert('❌ ' + error.message);
    form.reset();
    carregarMarquee();
  });
});

// ============================================
// BANNERS
// ============================================
async function carregarBanners() {
  const { data } = await sb.from('banners').select('*').order('id', { ascending: true });
  bannersAdmin = data || [];
  renderizarBanners();
}

function renderizarBanners() {
  const cont = document.getElementById('banners-list');
  if (!cont) return;
  if (!bannersAdmin.length) {
    cont.innerHTML = '<p class="text-sm text-gray-400">Nenhum banner cadastrado</p>';
    return;
  }
  cont.innerHTML = bannersAdmin.map(b => `
    <div class="bg-gray-50 p-3 rounded-lg flex gap-2 items-center">
      <img src="${driveImg(b.imagem, 100)}" style="width:60px;height:40px;object-fit:cover;border-radius:6px">
      <div class="flex-1 text-sm">
        <div class="font-bold">${b.titulo}</div>
        <div class="text-xs text-gray-500">${b.btn_text || ''}</div>
      </div>
      <button onclick="excluirBanner(${b.id})" class="text-red-500"><i class="fas fa-trash"></i></button>
    </div>`).join('');
}

window.excluirBanner = async (id) => {
  if (!confirm('Excluir este banner?')) return;
  const { error } = await sb.from('banners').delete().eq('id', id);
  if (error) return alert('❌ ' + error.message);
  carregarBanners();
};

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('formBanner');
  if (form) form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      imagem: document.getElementById('bannerImagem').value.trim(),
      titulo: document.getElementById('bannerTitulo').value.trim(),
      btn_text: document.getElementById('bannerBtnText').value.trim() || null,
      btn_link: document.getElementById('bannerBtnLink').value.trim() || null,
      posicao: document.getElementById('bannerPosicao').value,
      ativo: document.getElementById('bannerAtivo').checked
    };
    const { error } = await sb.from('banners').insert([payload]);
    if (error) return alert('❌ ' + error.message);
    form.reset();
    carregarBanners();
  });
});

// ============================================
// ESTRUTURA
// ============================================
let estruturaFiltro = 'todos';

async function carregarEstrutura() {
  const { data } = await sb.from('estrutura').select('*').order('id', { ascending: true });
  estruturaAdmin = data || [];
  renderizarEstrutura();
}

function renderizarEstrutura() {
  const cont = document.getElementById('estrutura-list');
  if (!cont) return;
  const lista = estruturaFiltro === 'todos'
    ? estruturaAdmin
    : estruturaAdmin.filter(e => e.grupo === estruturaFiltro);

  if (!lista.length) {
    cont.innerHTML = '<p class="text-sm text-gray-400">Nenhum item</p>';
    return;
  }

  const grupos = {};
  lista.forEach(e => {
    if (!grupos[e.grupo]) grupos[e.grupo] = {};
    if (!grupos[e.grupo][e.categoria]) grupos[e.grupo][e.categoria] = [];
    if (e.subcategoria) grupos[e.grupo][e.categoria].push({ id: e.id, sub: e.subcategoria });
  });

  let html = '';
  Object.keys(grupos).forEach(g => {
    html += `<div class="mb-3"><h5 class="font-bold text-sm text-gray-700 mb-2">${g}</h5>`;
    Object.keys(grupos[g]).forEach(c => {
      html += `<div class="estrutura-item-card">
        <div class="font-bold text-sm">${c}</div>
        <div class="mt-2">${grupos[g][c].map(s => `
          <span class="estrutura-sub-chip">${s.sub}
            <button onclick="excluirEstruturaItem(${s.id})"><i class="fas fa-times text-red-500"></i></button>
          </span>`).join('') || '<span class="text-xs text-gray-400">Sem subcategorias</span>'}
        </div>
      </div>`;
    });
    html += '</div>';
  });
  cont.innerHTML = html;
}

window.filtrarEstrutura = function (filtro) {
  estruturaFiltro = filtro;
  document.querySelectorAll('[id^="btn-filtro-"]').forEach(b => {
    b.style.background = '#f3f4f6';
    b.style.color = '#374151';
  });
  const map = { 'todos': 'btn-filtro-todos', 'Folheado Dourado': 'btn-filtro-dourado', 'Folheado Prata': 'btn-filtro-prata' };
  const btn = document.getElementById(map[filtro]);
  if (btn) { btn.style.background = '#059669'; btn.style.color = '#fff'; }
  renderizarEstrutura();
};

window.excluirEstruturaItem = async (id) => {
  if (!confirm('Excluir este item?')) return;
  const { error } = await sb.from('estrutura').delete().eq('id', id);
  if (error) return alert('❌ ' + error.message);
  carregarEstrutura();
};

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('formEstrutura');
  if (form) form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      grupo: document.getElementById('estruturaGrupo').value,
      categoria: document.getElementById('estruturaCategoria').value.trim(),
      subcategoria: document.getElementById('estruturaSubcategoria').value.trim() || null
    };
    const { error } = await sb.from('estrutura').insert([payload]);
    if (error) return alert('❌ ' + error.message);
    form.reset();
    carregarEstrutura();
    carregarCategoriasSelect();
  });
});

window.cancelarEdicaoEstrutura = function () {
  document.getElementById('formEstrutura').reset();
};

// ============================================
// TAMANHOS
// ============================================
async function carregarTamanhos() {
  const { data } = await sb.from('tamanhos').select('*');
  tamanhosAdmin = data || [];
  console.log('Tamanhos:', tamanhosAdmin);
}

// ============================================
// USUÁRIOS
// ============================================
async function carregarUsuarios() {
  const { data } = await sb.from('usuarios').select('*').order('id', { ascending: true });
  usuariosAdmin = data || [];
  renderizarUsuarios();
}

function renderizarUsuarios() {
  const cont = document.getElementById('usuarios-list');
  if (!cont) return;
  if (!usuariosAdmin.length) {
    cont.innerHTML = '<p class="text-sm text-gray-400">Nenhum usuário</p>';
    return;
  }
  cont.innerHTML = usuariosAdmin.map(u => `
    <div class="flex justify-between items-center bg-gray-50 p-3 rounded-lg">
      <div class="text-sm">
        <div class="font-bold">${u.nome || u.email}</div>
        <div class="text-xs text-gray-500">${u.email} • ${u.nivel || 'admin'} ${u.ativo ? '• ✅ ativo' : '• ❌ inativo'}</div>
      </div>
      <button onclick="excluirUsuario(${u.id})" class="text-red-500"><i class="fas fa-trash"></i></button>
    </div>`).join('');
}

window.excluirUsuario = async (id) => {
  if (!confirm('Excluir este usuário?')) return;
  const { error } = await sb.from('usuarios').delete().eq('id', id);
  if (error) return alert('❌ ' + error.message);
  carregarUsuarios();
};

window.cancelarEdicaoUsuario = function () {
  document.getElementById('formUsuario').reset();
  document.getElementById('usuarioEditIndex').value = '-1';
  document.getElementById('btnSalvarUsuarioText').textContent = 'Adicionar';
};

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('formUsuario');
  if (form) form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      email: document.getElementById('usuarioEmail').value.trim(),
      senha: document.getElementById('usuarioSenha').value,
      nome: document.getElementById('usuarioNome').value.trim() || null,
      nivel: document.getElementById('usuarioNivel').value,
      ativo: document.getElementById('usuarioAtivo').checked
    };
    const { error } = await sb.from('usuarios').insert([payload]);
    if (error) return alert('❌ ' + error.message);
    form.reset();
    carregarUsuarios();
  });
});

// ============================================
// VENDAS
// ============================================
window.carregarVendasAdmin = async function () {
  loading(true);
  try {
    const { data, error } = await sb.from('pedidos').select('*').order('id', { ascending: false });
    if (error) throw error;
    vendasAdmin = data || [];
    renderizarVendas();
  } catch (err) {
    console.error(err);
  } finally { loading(false); }
};

function renderizarVendas() {
  const tbody = document.getElementById('vendas-tbody');
  if (!tbody) return;
  if (!vendasAdmin.length) {
    tbody.innerHTML = `<tr><td colspan="9" class="text-center py-6 text-gray-400">
      <i class="fas fa-inbox text-2xl block mb-2"></i>Nenhum pedido</td></tr>`;
    document.getElementById('vendas-count').textContent = '0 registros';
    return;
  }

  tbody.innerHTML = vendasAdmin.map(v => `
    <tr>
      <td>${v.id}</td>
      <td>${fmtDate(v.created_at)}</td>
      <td>${v.cliente_nome || '—'}</td>
      <td>${v.endereco || '—'}</td>
      <td>${v.itens || '—'}</td>
      <td class="text-right">${fmtMoney(v.subtotal)}</td>
      <td class="text-right">${fmtMoney(v.frete)}</td>
      <td class="text-right font-bold">${fmtMoney(v.total)}</td>
      <td class="text-center"><span class="status-${(v.status || 'pendente').toLowerCase()}">${v.status || 'Pendente'}</span></td>
    </tr>`).join('');

  document.getElementById('vendas-count').textContent = `${vendasAdmin.length} registros`;
}

window.aplicarFiltros = () => carregarVendasAdmin();
window.limparFiltros = () => { carregarVendasAdmin(); };

window.exportarCSV = function () {
  if (!vendasAdmin.length) return alert('Sem pedidos para exportar');
  const header = ['ID', 'Data', 'Cliente', 'Endereço', 'Itens', 'Subtotal', 'Frete', 'Total', 'Status'];
  const rows = vendasAdmin.map(v => [
    v.id, fmtDate(v.created_at), v.cliente_nome || '', v.endereco || '',
    v.itens || '', v.subtotal || 0, v.frete || 0, v.total || 0, v.status || 'Pendente'
  ]);
  const csv = [header, ...rows].map(r => r.join(';')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `vendas_${Date.now()}.csv`;
  a.click();
};

window.gerarPDFFormatoCliente = function () {
  alert('Função PDF ainda não implementada. Use Exportar CSV.');
};

// ============================================
// MANUTENÇÃO
// ============================================
async function carregarManutencao() {
  const { data } = await sb.from('manutencao').select('*').limit(1).maybeSingle();
  if (data) {
    document.getElementById('manutencaoMensagem').value = data.mensagem || '';
    document.getElementById('manutencaoWhatsapp').value = data.whatsapp || '';
    atualizarStatusManutencao(data.ativa);
  } else {
    atualizarStatusManutencao(false);
  }
}

function atualizarStatusManutencao(ativa) {
  const box = document.getElementById('manutencaoStatusBox');
  const icon = document.getElementById('manutencaoStatusIcon');
  const title = document.getElementById('manutencaoStatusTitle');
  const desc = document.getElementById('manutencaoStatusDesc');
  const btn = document.getElementById('btnToggleManutencao');

  if (ativa) {
    box.className = 'rounded-2xl p-5 mb-5 border-2 border-orange-300 bg-orange-50 flex items-center gap-4';
    icon.className = 'w-14 h-14 rounded-full bg-orange-200 flex items-center justify-center text-2xl flex-shrink-0';
    icon.innerHTML = '<i class="fas fa-tools text-orange-600"></i>';
    title.textContent = '🔴 Manutenção ATIVA';
    desc.textContent = 'Os visitantes veem a tela de manutenção';
    btn.className = 'flex-1 px-6 py-3 bg-red-600 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition';
    btn.innerHTML = '<i class="fas fa-power-off"></i> Desativar';
  } else {
    box.className = 'rounded-2xl p-5 mb-5 border-2 border-green-300 bg-green-50 flex items-center gap-4';
    icon.className = 'w-14 h-14 rounded-full bg-green-200 flex items-center justify-center text-2xl flex-shrink-0';
    icon.innerHTML = '<i class="fas fa-check-circle text-green-600"></i>';
    title.textContent = '🟢 Site Ativo';
    desc.textContent = 'Os visitantes estão vendo o site normal';
    btn.className = 'flex-1 px-6 py-3 bg-green-600 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition';
    btn.innerHTML = '<i class="fas fa-tools"></i> Ativar Manutenção';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const btnToggle = document.getElementById('btnToggleManutencao');
  if (btnToggle) btnToggle.addEventListener('click', async () => {
    const { data } = await sb.from('manutencao').select('*').limit(1).maybeSingle();
    const ativa = data ? !data.ativa : true;
    if (data) {
      await sb.from('manutencao').update({ ativa }).eq('id', data.id);
    } else {
      await sb.from('manutencao').insert([{ ativa, mensagem: '', whatsapp: '' }]);
    }
    atualizarStatusManutencao(ativa);
  });

  const btnSalvar = document.getElementById('btnSalvarManutencaoMsg');
  if (btnSalvar) btnSalvar.addEventListener('click', async () => {
    const msg = document.getElementById('manutencaoMensagem').value;
    const wpp = document.getElementById('manutencaoWhatsapp').value;
    const { data } = await sb.from('manutencao').select('*').limit(1).maybeSingle();
    if (data) {
      await sb.from('manutencao').update({ mensagem: msg, whatsapp: wpp }).eq('id', data.id);
    } else {
      await sb.from('manutencao').insert([{ ativa: false, mensagem: msg, whatsapp: wpp }]);
    }
    alert('✅ Mensagem salva');
  });
});

// ============================================
// INIT GERAL
// ============================================
console.log('✅ admin.js carregado');