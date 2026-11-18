// ============================================
// IVO PITA JOIAS - SCRIPT v5 (SUPABASE + REALTIME)
// ============================================

// ✅ Garante que temos o CLIENTE, não o SDK
var supabase = window.supabaseClient || (window.supabase && window.supabase.createClient
  ? window.supabase.createClient(
      'https://cqvihtxgbzmgehdmqipr.supabase.co',
      'sb_publishable_n8JzHYyWSz_4QXTL_F6ZEw_N52k668d'
    )
  : null);

if (!supabase) {
  console.error('❌ supabaseClient não inicializado. Verifique o HTML.');
} else {
  console.log('✅ supabaseClient OK:', typeof supabase.from);
}


if (!supabase) {
  console.error('❌ window.supabaseClient não inicializado. Verifique o HTML.');
}

// ============================================
// 🗺️ MAPPER — colunas reais do Supabase
// ============================================
function mapProdutoSupabase(p) {
  const idTexto = p["ID"] ?? (p.id != null ? String(p.id) : "");
  const estoque = parseInt(p["Estoque"]) || 0;
  const vendidos = parseInt(p["Vendidos"]) || 0;
  return {
    "ID": String(idTexto),
    "Nome do Produto": p["Nome do Produto"] || "",
    "Preço": parseFloat(p["Preço"]) || 0,
    "referencia": p["referencia"] || "",
    "Categoria": p["Categoria"] || "",
    "Subcategoria": p["Subcategoria"] || "",
    "Tamanho": p["Tamanho"] || "",
    "Imagem": p["Imagem"] || "",
    "Saldo Estoque": Math.max(0, estoque - vendidos),
    "Estoque": estoque,
    "Vendidos": vendidos,
    "Disponível": p["Disponível"] || "não",
    "Cores": p["Cores"] || "",
    "Quantidade": p["Quantidade"] || ""
  };
}

// ============================================
// CACHE
// ============================================
const CACHE_KEY_DADOS = 'ivo_dados_v5_supabase';
const CACHE_KEY_TIME = 'ivo_dados_time_v5_supabase';
const CACHE_TTL_MS = 15 * 60 * 1000;

const IMG_SIZE_CARD = 300;
const IMG_SIZE_MODAL = 500;
const IMG_SIZE_ZOOM = 1000;

let siteConfig = {
  whatsapp: "5588999049636",
  whatsappDisplay: "(88) 99904-9636",
  email: "contato@ivopita.com.br",
  endereco: "Juazeiro do Norte, CE",
  telefone: "(88) 99909-9999",
  sobreTexto: "A IVO PITA nasceu para celebrar momentos especiais com peças que unem design sofisticado e materiais nobres.",
  freteGratisValor: 3500,
  taxaFrete: 15,
  pixDesconto: 5,
};

let FRETE_GRATIS_VALOR = 3500;
let TAXA_FRETE = 75;

const PLACEHOLDER_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
  <rect width="400" height="400" fill="#f0f7f2"/>
  <rect x="20" y="20" width="360" height="360" fill="none" stroke="#c9a86a" stroke-width="2" stroke-dasharray="8,6" rx="20"/>
  <text x="200" y="210" font-family="Montserrat, Arial, sans-serif" font-size="16" font-weight="600" fill="#2f6b4f" text-anchor="middle">SEM IMAGEM</text>
  <text x="200" y="235" font-family="Montserrat, Arial, sans-serif" font-size="11" fill="#5c6b63" text-anchor="middle">Ivo Pita Joias</text>
</svg>
`)}`;
window.PLACEHOLDER_SVG = PLACEHOLDER_SVG;

let allProducts = [];
let cart = JSON.parse(localStorage.getItem("cart")) || [];
let selectedColor = "";
let tempProduct = null;
let subtotal = 0;
let imagensZoom = [];
let zoomIndex = 0;
let quantidadeSelecionada = 0;
let coresSelecionadas = {};
let coresDisponiveis = [];
let estruturaCategorias = [];
let sidebarDinamicaAtiva = false;
let __dadosCarregados = null;

// Estoque cache
const ESTOQUE_CACHE = new Map();
const ESTOQUE_CACHE_TTL = 5 * 1000;

function getEstoqueCache(produtoId) {
  const entry = ESTOQUE_CACHE.get(String(produtoId));
  if (!entry) return null;
  if (Date.now() - entry.timestamp > ESTOQUE_CACHE_TTL) {
    ESTOQUE_CACHE.delete(String(produtoId));
    return null;
  }
  return entry.saldo;
}
function setEstoqueCache(produtoId, saldo) {
  ESTOQUE_CACHE.set(String(produtoId), { saldo: parseInt(saldo) || 0, timestamp: Date.now() });
}
function invalidarEstoqueCache() { ESTOQUE_CACHE.clear(); }

// ============================================
// LOG
// ============================================
const DEBUG = new URLSearchParams(location.search).has('debug');
const log = DEBUG ? console.log.bind(console) : () => { };
const warn = DEBUG ? console.warn.bind(console) : () => { };

// ============================================
// TOAST
// ============================================
function showToast(texto, tipo = 'success', duracao = 2500) {
  if (typeof Toastify === 'undefined') { console.log('[Toast]', texto); return; }
  const cores = {
    success: 'linear-gradient(135deg, #2f6b4f, #1f4d38)',
    error: '#ef4444', warning: '#f59e0b', info: '#3b82f6'
  };
  Toastify({
    text: texto, duration: duracao, gravity: 'top', position: 'right', stopOnFocus: true,
    style: {
      background: cores[tipo] || cores.success, borderRadius: '14px', fontWeight: '700',
      fontSize: '13px', padding: '14px 20px',
      boxShadow: '0 10px 30px rgba(15, 47, 34, 0.25)', maxWidth: '340px'
    },
    offset: { x: 16, y: 90 }
  }).showToast();
}
window.showToast = showToast;

// ============================================
// HELPERS
// ============================================
function normalizar(texto) {
  if (!texto) return "";
  return texto.toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function normalizarPalavraBusca(palavra) {
  return palavra.replace(/s$/, "").replace(/a$/, "").replace(/o$/, "").replace(/es$/, "").replace(/ns$/, "m");
}

function driveImg(url, size = IMG_SIZE_CARD) {
  if (!url || url === 'placeholder.png') return PLACEHOLDER_SVG;
  if (url.includes("googleusercontent.com")) {
    const baseUrl = url.replace(/=w\d+.*$/, '').replace(/=s\d+.*$/, '').replace(/=h\d+.*$/, '').split('?')[0];
    return `${baseUrl}=w${size}`;
  }
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return `https://lh3.googleusercontent.com/u/0/d/${match[1]}=w${size}`;
  if (url.startsWith("http")) return url;
  return PLACEHOLDER_SVG;
}

// ============================================
// CARREGAMENTO DE DADOS (SUPABASE)
// ============================================
async function carregarProdutos() {
  const container = document.getElementById('produtos-container');
  try {
    if (container && container.querySelectorAll('.product-card').length === 0) {
      container.innerHTML = Array(10).fill('<div class="skeleton-card"></div>').join('');
    }

    console.log('🔄 Buscando produtos no Supabase...');

    const { data, error } = await supabase
      .from('produtos')
      .select('*')
      .order('id', { ascending: true });

    if (error) throw error;

    const mapeados = (data || []).map(mapProdutoSupabase);
    allProducts = mapeados.filter(p => String(p["Disponível"] || '').toLowerCase().trim() === 'sim');

    await carregarExtrasSupabase();

    if (allProducts.length === 0) {
      if (container) container.innerHTML = `
        <div class="col-span-full text-center py-12">
          <i class="fas fa-gem text-4xl text-primary/30 mb-4"></i>
          <p class="text-textMuted font-bold mb-2">Nenhum produto disponível.</p>
          <button onclick="location.reload()" class="mt-4 bg-primary text-white px-6 py-2 rounded-full text-sm font-bold">
            <i class="fas fa-sync-alt mr-2"></i>Recarregar
          </button>
        </div>`;
    } else {
      allProducts.slice(0, 2).forEach(p => {
        if (!p.Imagem) return;
        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'image';
        link.href = driveImg(p.Imagem, 400);
        link.setAttribute('fetchpriority', 'high');
        document.head.appendChild(link);
      });
      renderProducts(allProducts);
    }

    if (estruturaCategorias.length > 0) {
      renderizarSidebarDinamica();
    } else {
      rebindSidebarEvents();
    }

    setTimeout(atualizarContadoresSidebar, 50);
    setTimeout(atualizarContadorProdutos, 50);

    try {
      localStorage.setItem(CACHE_KEY_DADOS, JSON.stringify({ produtos: allProducts }));
      localStorage.setItem(CACHE_KEY_TIME, String(Date.now()));
    } catch (e) { }

    console.log('✅ Carregamento concluído');
  } catch (err) {
    console.error('❌ Erro Supabase:', err);
    if (container) {
      container.innerHTML = `
        <div class="col-span-full text-center py-12">
          <i class="fas fa-exclamation-triangle text-4xl text-red-400 mb-4"></i>
          <p class="text-textMuted font-bold">Erro ao carregar produtos</p>
          <p class="text-textMuted text-xs mt-2">${err.message || ''}</p>
          <button onclick="location.reload()" class="mt-4 bg-primary text-white px-6 py-2 rounded-full text-sm font-bold">
            <i class="fas fa-sync-alt mr-2"></i>Tentar novamente
          </button>
        </div>`;
    }
  }
}

// ============================================
// REALTIME
// ============================================
let realtimeChannel = null;

function ativarRealtimeProdutos() {
  if (realtimeChannel) supabase.removeChannel(realtimeChannel);

  realtimeChannel = supabase
    .channel('produtos-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'produtos' }, (payload) => {
      console.log('🔄 Mudança detectada na tabela produtos:', payload);
      carregarProdutos();
      showToast('🔄 Catálogo atualizado!', 'info', 2000);
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('✅ Realtime conectado');
      } else {
        console.warn('⚠️ Realtime status:', status);
      }
    });
}

async function carregarExtrasSupabase() {
  try {
    const { data: cfgData } = await supabase.from('config').select('*').limit(1).maybeSingle();
    if (cfgData) {
      aplicarConfig({
        whatsapp: cfgData.whatsapp,
        whatsappDisplay: cfgData.whatsapp_display,
        email: cfgData.email,
        endereco: cfgData.endereco,
        telefone: cfgData.telefone,
        sobreTexto: cfgData.sobre_texto,
        freteGratisValor: cfgData.frete_gratis_valor,
        taxaFrete: cfgData.taxa_frete,
        pixDesconto: cfgData.pix_desconto,
        instagram: cfgData.instagram,
      });
    }
  } catch (e) { warn('config não carregou:', e.message); }

  try {
    const { data: mqData } = await supabase.from('marquee').select('*').order('ordem', { ascending: true });
    if (mqData && mqData.length > 0) {
      renderizarMarquee(mqData.map(m => ({ texto: m.texto, icone: m.icone, cor: m.cor })));
    }
  } catch (e) { warn('marquee não carregou:', e.message); }

  try {
    const { data: estData } = await supabase.from('estrutura').select('*');
    if (estData && estData.length > 0) {
      estruturaCategorias = estData.map(e => ({ grupo: e.grupo, categoria: e.categoria, subcategoria: e.subcategoria }));
    }
  } catch (e) { warn('estrutura não carregou:', e.message); }

  try {
    const { data: tamData } = await supabase.from('tamanhos').select('*');
    if (tamData && tamData.length > 0) {
      window.__tamanhosBackend = tamData.map(t => ({ cor: t.cor, chave: t.chave, label: t.label, valor: t.valor }));
    }
  } catch (e) { warn('tamanhos não carregou:', e.message); }
}

// ============================================
// VERIFICAR ESTOQUE
// ============================================
async function verificarEstoqueServidor(produtoId) {
  const cached = getEstoqueCache(produtoId);
  if (cached !== null) return { success: true, id: produtoId, saldo: cached, cached: true };

  try {
    const { data, error } = await supabase
      .from('produtos')
      .select('"Estoque"')
      .eq('"ID"', String(produtoId))
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    const saldo = parseInt(data?.["Estoque"]) || 0;
    setEstoqueCache(produtoId, saldo);
    return { success: true, id: produtoId, saldo };
  } catch (err) {
    console.error('Erro verificarEstoqueServidor:', err);
    return { success: false, error: err.message };
  }
}

function quantidadeNoCarrinho(baseId) {
  return cart.filter(item => String(item.baseId) === String(baseId))
    .reduce((soma, item) => soma + item.quantity, 0);
}

// ============================================
// CLIENTE
// ============================================
const CLIENTE_STORAGE_KEY = 'ivo_cliente_dados';
const CLIENTE_RASCUNHO_KEY = 'ivo_cliente_rascunho';

function carregarDadosCliente() {
  try {
    const raw = localStorage.getItem(CLIENTE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}
function persistirDadosCliente(dados) {
  try { localStorage.setItem(CLIENTE_STORAGE_KEY, JSON.stringify(dados)); } catch (e) { }
}
function clienteEstaCadastrado() {
  const c = carregarDadosCliente();
  return c && c.nome && c.endereco && c.numero && c.cidade && c.estado;
}
function carregarRascunhoCliente() {
  try {
    const raw = localStorage.getItem(CLIENTE_RASCUNHO_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}
function salvarRascunhoCliente() {
  try {
    const campos = ['cliente-nome', 'cliente-tipo', 'cliente-cpf', 'cliente-ie', 'cliente-nascimento', 'cliente-celular', 'cliente-email', 'cliente-cep', 'cliente-endereco', 'cliente-numero', 'cliente-complemento', 'cliente-bairro', 'cliente-cidade', 'cliente-estado'];
    const rascunho = {};
    let temConteudo = false;
    campos.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        const chave = id.replace('cliente-', '');
        rascunho[chave] = el.value;
        if (chave !== 'tipo' && el.value && el.value.trim() !== '') temConteudo = true;
      }
    });
    if (!temConteudo) { localStorage.removeItem(CLIENTE_RASCUNHO_KEY); return; }
    localStorage.setItem(CLIENTE_RASCUNHO_KEY, JSON.stringify(rascunho));
  } catch (e) { }
}
function limparRascunhoCliente() {
  try { localStorage.removeItem(CLIENTE_RASCUNHO_KEY); } catch (e) { }
}

function atualizarResumoCliente() {
  const btnTexto = document.getElementById('btn-cadastro-texto');
  const resumo = document.getElementById('cliente-resumo');
  const resumoNome = document.getElementById('cliente-resumo-nome');
  const resumoEndereco = document.getElementById('cliente-resumo-endereco');
  const resumoContato = document.getElementById('cliente-resumo-contato');
  const c = carregarDadosCliente();

  if (clienteEstaCadastrado() && c) {
    if (resumo) resumo.classList.remove('hidden');
    if (btnTexto) btnTexto.textContent = 'Editar Dados';
    if (resumoNome) resumoNome.textContent = c.nome || '—';
    if (resumoEndereco) {
      const partes = [`${c.endereco || ''}, ${c.numero || ''}`, c.complemento || null, c.bairro || '', `${c.cidade || ''} - ${c.estado || ''}`, c.cep ? `CEP: ${c.cep}` : null].filter(Boolean);
      resumoEndereco.textContent = partes.join(' • ');
    }
    if (resumoContato) {
      const contatos = [];
      if (c.celular) contatos.push(c.celular);
      if (c.email) contatos.push(c.email);
      resumoContato.textContent = contatos.join(' • ') || '—';
    }
  } else {
    if (resumo) resumo.classList.add('hidden');
    if (btnTexto) btnTexto.textContent = 'Cadastrar Dados';
  }
}

function atualizarLabelsTipo(tipo) {
  const labelCpf = document.getElementById('label-cpf');
  const labelIe = document.getElementById('label-ie');
  const inputCpf = document.getElementById('cliente-cpf');
  const inputIe = document.getElementById('cliente-ie');
  if (tipo === 'J') {
    if (labelCpf) labelCpf.textContent = 'CNPJ';
    if (labelIe) labelIe.textContent = 'Inscrição Estadual (I.E.)';
    if (inputCpf) { inputCpf.placeholder = '00.000.000/0000-00'; inputCpf.maxLength = 18; }
    if (inputIe) inputIe.placeholder = 'Ex: 1234567890';
  } else {
    if (labelCpf) labelCpf.textContent = 'CPF';
    if (labelIe) labelIe.textContent = 'RG / Identidade';
    if (inputCpf) { inputCpf.placeholder = '000.000.000-00'; inputCpf.maxLength = 14; }
    if (inputIe) inputIe.placeholder = 'Ex: 1234567890';
  }
}

window.abrirModalCliente = function () {
  const c = carregarDadosCliente();
  const rascunho = carregarRascunhoCliente();
  const dados = { ...(c || {}), ...(rascunho || {}) };
  if (dados && Object.keys(dados).length > 0) {
    document.getElementById('cliente-nome').value = dados.nome || '';
    document.getElementById('cliente-tipo').value = dados.tipo || 'F';
    document.getElementById('cliente-cpf').value = dados.cpf || '';
    document.getElementById('cliente-ie').value = dados.ie || '';
    document.getElementById('cliente-nascimento').value = dados.nascimento || '';
    document.getElementById('cliente-celular').value = dados.celular || '';
    document.getElementById('cliente-email').value = dados.email || '';
    document.getElementById('cliente-cep').value = dados.cep || '';
    document.getElementById('cliente-endereco').value = dados.endereco || '';
    document.getElementById('cliente-numero').value = dados.numero || '';
    document.getElementById('cliente-complemento').value = dados.complemento || '';
    document.getElementById('cliente-bairro').value = dados.bairro || '';
    document.getElementById('cliente-cidade').value = dados.cidade || '';
    document.getElementById('cliente-estado').value = dados.estado || '';
    atualizarLabelsTipo(dados.tipo || 'F');
  } else {
    document.getElementById('form-cliente')?.reset();
    document.getElementById('cliente-tipo').value = 'F';
    atualizarLabelsTipo('F');
  }
  const modal = document.getElementById('cliente-modal');
  if (modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); }
  document.body.style.overflow = 'hidden';
};

window.fecharModalCliente = function () {
  const modal = document.getElementById('cliente-modal');
  if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
  document.body.style.overflow = '';
};

async function salvarDadosCliente() {
  const dados = {
    nome: document.getElementById('cliente-nome').value.trim(),
    tipo: document.getElementById('cliente-tipo').value,
    cpf: document.getElementById('cliente-cpf').value.trim(),
    ie: document.getElementById('cliente-ie').value.trim(),
    nascimento: document.getElementById('cliente-nascimento').value,
    celular: document.getElementById('cliente-celular').value.trim(),
    email: document.getElementById('cliente-email').value.trim(),
    cep: document.getElementById('cliente-cep').value.trim(),
    endereco: document.getElementById('cliente-endereco').value.trim(),
    numero: document.getElementById('cliente-numero').value.trim(),
    complemento: document.getElementById('cliente-complemento').value.trim(),
    bairro: document.getElementById('cliente-bairro').value.trim(),
    cidade: document.getElementById('cliente-cidade').value.trim(),
    estado: document.getElementById('cliente-estado').value.trim().toUpperCase()
  };

  if (!dados.nome) { showToast("Informe o nome completo", "error", 2500); return; }
  if (!dados.cpf) { showToast(dados.tipo === 'J' ? "Informe o CNPJ" : "Informe o CPF", "error", 2500); return; }
  if (!dados.celular) { showToast("Informe o celular", "error", 2500); return; }
  if (!dados.cep) { showToast("Informe o CEP", "error", 2500); return; }
  if (!dados.endereco) { showToast("Informe o endereço", "error", 2500); return; }
  if (!dados.numero) { showToast("Informe o número", "error", 2500); return; }
  if (!dados.bairro) { showToast("Informe o bairro", "error", 2500); return; }
  if (!dados.cidade) { showToast("Informe a cidade", "error", 2500); return; }
  if (!dados.estado || dados.estado.length !== 2) { showToast("Informe o estado (ex: CE)", "error", 2500); return; }
  if (dados.tipo === 'F' && dados.cpf.length < 14) { showToast("CPF incompleto", "error", 3000); return; }
  if (dados.tipo === 'J' && dados.cpf.length < 18) { showToast("CNPJ incompleto", "error", 3000); return; }

  persistirDadosCliente(dados);
  limparRascunhoCliente();
  atualizarResumoCliente();
  fecharModalCliente();
  showToast("✅ Dados salvos!", "success", 3000);

  try {
    const payload = {
      nome: dados.nome, tipo: dados.tipo, cpf: dados.cpf,
      ie: dados.ie || null, nascimento: dados.nascimento || null,
      celular: dados.celular, email: dados.email || null,
      cep: dados.cep, endereco: dados.endereco, numero: dados.numero,
      complemento: dados.complemento || null, bairro: dados.bairro,
      cidade: dados.cidade, estado: dados.estado,
    };

    const { data: existente } = await supabase.from('clientes').select('id').eq('cpf', dados.cpf).maybeSingle();
    if (existente) {
      await supabase.from('clientes').update(payload).eq('id', existente.id);
    } else {
      await supabase.from('clientes').insert([payload]);
    }
  } catch (err) {
    console.warn('Erro ao sincronizar cliente:', err.message);
  }
}
window.salvarDadosCliente = salvarDadosCliente;

window.limparDadosCliente = function () {
  if (!confirm("⚠️ Tem certeza que deseja limpar TODOS os seus dados?")) return;
  try { localStorage.removeItem(CLIENTE_STORAGE_KEY); localStorage.removeItem(CLIENTE_RASCUNHO_KEY); } catch (e) { }
  ['cliente-nome', 'cliente-cpf', 'cliente-ie', 'cliente-nascimento', 'cliente-celular', 'cliente-email', 'cliente-cep', 'cliente-endereco', 'cliente-numero', 'cliente-complemento', 'cliente-bairro', 'cliente-cidade', 'cliente-estado'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const tipoEl = document.getElementById('cliente-tipo');
  if (tipoEl) tipoEl.value = 'F';
  atualizarLabelsTipo('F');
  atualizarResumoCliente();
  fecharModalCliente();
  showToast("🗑️ Dados limpos!", "success", 3000);
};

// ============================================
// MÁSCARAS
// ============================================
function aplicarMascaraCEP(input) {
  let v = input.value.replace(/\D/g, '').substring(0, 8);
  if (v.length > 5) v = v.replace(/(\d{5})(\d)/, '$1-$2');
  input.value = v;
}
function aplicarMascaraCPF(input, tipo) {
  let v = input.value.replace(/\D/g, '');
  if (tipo === 'J') {
    v = v.substring(0, 14);
    if (v.length > 12) v = v.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/, '$1.$2.$3/$4-$5');
    else if (v.length > 8) v = v.replace(/^(\d{2})(\d{3})(\d{3})(\d{0,4})/, '$1.$2.$3/$4');
    else if (v.length > 5) v = v.replace(/^(\d{2})(\d{3})(\d{0,3})/, '$1.$2.$3');
    else if (v.length > 2) v = v.replace(/^(\d{2})(\d{0,3})/, '$1.$2');
  } else {
    v = v.substring(0, 11);
    if (v.length > 9) v = v.replace(/^(\d{3})(\d{3})(\d{3})(\d{0,2})/, '$1.$2.$3-$4');
    else if (v.length > 6) v = v.replace(/^(\d{3})(\d{3})(\d{0,3})/, '$1.$2.$3');
    else if (v.length > 3) v = v.replace(/^(\d{3})(\d{0,3})/, '$1.$2');
  }
  input.value = v;
}
function aplicarMascaraCelular(input) {
  let v = input.value.replace(/\D/g, '').substring(0, 11);
  if (v.length > 10) v = v.replace(/^(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  else if (v.length > 6) v = v.replace(/^(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
  else if (v.length > 2) v = v.replace(/^(\d{2})(\d{0,5})/, '($1) $2');
  input.value = v;
}

async function buscarCEP() {
  const cepInput = document.getElementById('cliente-cep');
  const loading = document.getElementById('cep-loading');
  const cep = cepInput?.value.replace(/\D/g, '');
  if (!cep || cep.length !== 8) return;
  if (loading) loading.classList.remove('hidden');
  try {
    const resp = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const data = await resp.json();
    if (data.erro) { showToast("CEP não encontrado", "error", 2500); return; }
    document.getElementById('cliente-endereco').value = data.logradouro || '';
    document.getElementById('cliente-bairro').value = data.bairro || '';
    document.getElementById('cliente-cidade').value = data.localidade || '';
    document.getElementById('cliente-estado').value = (data.uf || '').toUpperCase();
    showToast("✅ Endereço preenchido!", "success", 2000);
    setTimeout(() => document.getElementById('cliente-numero')?.focus(), 300);
  } catch (e) {
    showToast("Erro ao buscar CEP.", "warning", 3000);
  } finally {
    if (loading) loading.classList.add('hidden');
  }
}

async function buscarCNPJ() {
  const cnpjInput = document.getElementById('cliente-cpf');
  const cnpj = cnpjInput?.value.replace(/\D/g, '');
  if (!cnpj || cnpj.length !== 14) return;
  try {
    showToast("Buscando CNPJ...", "info", 1500);
    const resp = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
    const data = await resp.json();
    if (data.message) { showToast("CNPJ não encontrado", "error", 2500); return; }
    if (data.razao_social) document.getElementById('cliente-nome').value = data.razao_social;
    if (data.inscricao_estadual) document.getElementById('cliente-ie').value = data.inscricao_estadual;
    if (data.ddd_telefone_1) {
      const tel = data.ddd_telefone_1.replace(/\D/g, '');
      document.getElementById('cliente-celular').value = tel.replace(/^(\d{2})(\d{4,5})(\d{4})/, '($1) $2-$3');
    }
    if (data.cep) {
      const cepLimpo = data.cep.replace(/\D/g, '');
      document.getElementById('cliente-cep').value = cepLimpo.replace(/(\d{5})(\d)/, '$1-$2');
      if (data.logradouro) document.getElementById('cliente-endereco').value = data.logradouro;
      if (data.numero) document.getElementById('cliente-numero').value = data.numero;
      if (data.complemento) document.getElementById('cliente-complemento').value = data.complemento;
      if (data.bairro) document.getElementById('cliente-bairro').value = data.bairro;
      if (data.municipio) document.getElementById('cliente-cidade').value = data.municipio;
      if (data.uf) document.getElementById('cliente-estado').value = data.uf.toUpperCase();
    }
    showToast("✅ Dados preenchidos!", "success", 2500);
  } catch (e) {
    showToast("Erro ao buscar CNPJ.", "warning", 3000);
  }
}

function configurarListenersCliente() {
  document.getElementById('cliente-tipo')?.addEventListener('change', function () {
    atualizarLabelsTipo(this.value);
    const cpfInput = document.getElementById('cliente-cpf');
    if (cpfInput) cpfInput.value = '';
    salvarRascunhoCliente();
  });
  document.getElementById('cliente-cpf')?.addEventListener('input', function () {
    const tipo = document.getElementById('cliente-tipo')?.value || 'F';
    aplicarMascaraCPF(this, tipo);
    salvarRascunhoCliente();
    if (tipo === 'J' && this.value.replace(/\D/g, '').length === 14) buscarCNPJ();
  });
  document.getElementById('cliente-celular')?.addEventListener('input', function () {
    aplicarMascaraCelular(this); salvarRascunhoCliente();
  });
  document.getElementById('cliente-cep')?.addEventListener('input', function () {
    aplicarMascaraCEP(this); salvarRascunhoCliente();
    if (this.value.replace(/\D/g, '').length === 8) buscarCEP();
  });
  document.getElementById('cliente-estado')?.addEventListener('input', function () {
    this.value = this.value.toUpperCase().replace(/[^A-Z]/g, '').substring(0, 2);
    salvarRascunhoCliente();
  });
  ['cliente-nome', 'cliente-ie', 'cliente-nascimento', 'cliente-email', 'cliente-endereco', 'cliente-numero', 'cliente-complemento', 'cliente-bairro', 'cliente-cidade'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', salvarRascunhoCliente);
    document.getElementById(id)?.addEventListener('change', salvarRascunhoCliente);
  });
  document.getElementById('btn-cadastro-cliente')?.addEventListener('click', abrirModalCliente);
  document.getElementById('form-cliente')?.addEventListener('submit', function (e) {
    e.preventDefault(); salvarDadosCliente();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      const modal = document.getElementById('cliente-modal');
      if (modal && !modal.classList.contains('hidden')) fecharModalCliente();
    }
  });
  document.getElementById('cliente-modal')?.addEventListener('click', function (e) {
    if (e.target === this) fecharModalCliente();
  });
  atualizarResumoCliente();
}

// ============================================
// CARRINHO
// ============================================
function updateCart() {
  localStorage.setItem("cart", JSON.stringify(cart));
  const cartCount = document.getElementById("cart-count");
  if (cartCount) cartCount.innerText = cart.reduce((s, i) => s + (i.quantity || 1), 0);

  const container = document.getElementById("cart-items");
  if (!container) return;
  container.innerHTML = "";
  subtotal = 0;

  if (cart.length === 0) {
    container.innerHTML = `
      <div class="cart-empty-state">
        <div class="cart-empty-icon"><i class="fas fa-shopping-bag"></i></div>
        <p class="cart-empty-title">Sacola vazia</p>
        <p class="cart-empty-subtitle">Adicione produtos</p>
      </div>`;
  } else {
    cart.forEach(item => {
      subtotal += item.price;
      const precoUnitario = item.precoUnitario || (item.price / item.quantity);
      const div = document.createElement("div");
      div.className = "cart-item";
      div.innerHTML = `
        <div class="cart-item-image">
          <img src="${driveImg(item.img, 200)}" alt="${item.name}" loading="lazy" decoding="async">
        </div>
        <div class="cart-item-details">
          <h4 class="cart-item-name">${item.name}</h4>
          ${item.ref ? `<p class="cart-item-ref">Ref: ${item.ref}</p>` : ""}
          <div class="cart-item-price-row">
            <span class="cart-item-unit-price">R$ ${precoUnitario.toFixed(2).replace(".", ",")} <small>/un</small></span>
            <span class="cart-item-total-price">R$ ${item.price.toFixed(2).replace(".", ",")}</span>
          </div>
          <div class="cart-item-controls">
            <div class="cart-qty-control">
              <button type="button" onclick="changeQty('${item.id}', -1)" class="cart-qty-btn"><i class="fas fa-minus"></i></button>
              <span class="cart-qty-value">${item.quantity}</span>
              <button type="button" onclick="changeQty('${item.id}', 1)" class="cart-qty-btn"><i class="fas fa-plus"></i></button>
            </div>
            <button type="button" onclick="removeCartItem('${item.id}')" class="cart-item-remove"><i class="fas fa-trash-alt"></i></button>
          </div>
        </div>`;
      container.appendChild(div);
    });
  }

  const bar = document.getElementById("free-shipping-bar");
  const text = document.getElementById("free-shipping-text");
  const subtotalEl = document.getElementById("cart-subtotal");
  const shippingEl = document.getElementById("cart-shipping");
  const totalEl = document.getElementById("cart-total");
  const clearBtn = document.getElementById("clear-cart-btn");

  if (subtotalEl) subtotalEl.innerText = `R$ ${subtotal.toFixed(2).replace(".", ",")}`;
  if (subtotal >= FRETE_GRATIS_VALOR) {
    if (bar) bar.style.width = "100%";
    if (text) text.innerHTML = "🎉 Frete GRÁTIS!";
    if (shippingEl) shippingEl.innerText = "GRÁTIS";
    if (totalEl) totalEl.innerText = `R$ ${subtotal.toFixed(2).replace(".", ",")}`;
  } else {
    const percent = (subtotal / FRETE_GRATIS_VALOR) * 100;
    const falta = FRETE_GRATIS_VALOR - subtotal;
    if (bar) bar.style.width = `${Math.min(percent, 100)}%`;
    if (text) text.innerHTML = `Faltam R$ ${falta.toFixed(2).replace(".", ",")} p/ frete grátis`;
    if (shippingEl) shippingEl.innerText = `R$ ${TAXA_FRETE.toFixed(2).replace(".", ",")}`;
    if (totalEl) totalEl.innerText = `R$ ${(subtotal + TAXA_FRETE).toFixed(2).replace(".", ",")}`;
  }
  if (clearBtn) clearBtn.classList.toggle("hidden", cart.length === 0);
  if (cart.length === 0) {
    document.getElementById("cart-modal")?.classList.add("hidden");
    document.getElementById("cart-modal")?.classList.remove("flex");
  }
}

window.removeCartItem = function (id) {
  cart = cart.filter(i => i.id !== id);
  updateCart();
  showToast("Item removido da sacola", "error", 2000);
};
window.changeQty = function (id, delta) {
  const item = cart.find(i => i.id === id);
  if (!item) return;
  if (delta > 0) item.quantity++;
  else {
    if (item.quantity > 1) item.quantity--;
    else { cart = cart.filter(i => i.id !== id); updateCart(); return; }
  }
  item.price = item.precoUnitario * item.quantity;
  updateCart();
};

async function validarCarrinho() {
  if (cart.length === 0) return;
  const ids = [...new Set(cart.map(i => i.baseId))];
  const checks = await Promise.all(ids.map(async id => ({ id, resp: await verificarEstoqueServidor(id) })));
  const problemas = [];
  for (const { id, resp } of checks) {
    if (resp && resp.success) {
      const qtdCart = quantidadeNoCarrinho(id);
      const saldo = parseInt(resp.saldo) || 0;
      if (saldo <= 0) problemas.push({ id, motivo: 'esgotado' });
      else if (qtdCart > saldo) problemas.push({ id, motivo: 'ajustar', saldo });
    }
  }
  if (problemas.length === 0) return;
  problemas.forEach(item => {
    if (item.motivo === 'esgotado') cart = cart.filter(i => String(i.baseId) !== String(item.id));
    else {
      let restante = item.saldo;
      cart = cart.filter(i => {
        if (String(i.baseId) !== String(item.id)) return true;
        if (restante <= 0) return false;
        if (i.quantity <= restante) { restante -= i.quantity; return true; }
        i.quantity = restante; i.price = i.precoUnitario * i.quantity; restante = 0; return true;
      });
    }
  });
  updateCart();
  showToast("⚠️ Itens ajustados (estoque).", "warning", 4000);
}
window.validarCarrinho = validarCarrinho;

function addToCart(id, name, price, img, baseId, ref, quantity, buttonElement) {
  const qty = quantity || 1;
  const existing = cart.find(i => i.id === id);
  if (existing) {
    existing.quantity += qty;
    existing.price = existing.precoUnitario * existing.quantity;
  } else {
    cart.push({ id, name, price, img, quantity: qty, baseId, ref, precoUnitario: price / qty });
  }
  invalidarEstoqueCache();
  showToast(`✅ ${name.substring(0, 30)} adicionado!`, "success", 2000);
  updateCart();
  if (buttonElement) {
    const original = buttonElement.innerHTML;
    const bg = buttonElement.style.background;
    buttonElement.innerHTML = '<i class="fas fa-check"></i> Adicionado!';
    buttonElement.style.background = 'linear-gradient(135deg, #28a745, #218838)';
    buttonElement.disabled = true;
    setTimeout(() => { buttonElement.innerHTML = original; buttonElement.style.background = bg; buttonElement.disabled = false; }, 1500);
  }
}

// ============================================
// RENDER PRODUTOS
// ============================================
function renderProducts(products) {
  const container = document.getElementById("produtos-container");
  if (!container) return;
  container.innerHTML = "";
  if (!products || products.length === 0) {
    container.innerHTML = `<div class="col-span-full text-center py-12"><i class="fas fa-search text-4xl text-primary/30 mb-4"></i><p class="text-textMuted">Nenhum produto encontrado.</p></div>`;
    setTimeout(atualizarContadorProdutos, 50);
    return;
  }
  const fragment = document.createDocumentFragment();
  products.forEach((p, index) => {
    const estoque = parseInt(p["Saldo Estoque"]) || 0;
    const temCores = p["Cores"] && String(p["Cores"]).trim() !== "";
    const preco = parseFloat(p["Preço"]) || 0;
    const nome = p["Nome do Produto"] || "Produto sem nome";
    const referencia = p["referencia"] || "";
    const categoria = p["Categoria"] || "";
    const subcategoria = p["Subcategoria"] || "";
    const imagem = p["Imagem"] || "";

    const imgSmall = driveImg(imagem, 300);
    const imgMedium = driveImg(imagem, 500);
    const srcsetAttr = `${imgSmall} 300w, ${imgMedium} 500w`;
    const sizesAttr = "(max-width: 600px) 45vw, (max-width: 1100px) 30vw, 20vw";

    let stockBadge = "";
    if (estoque <= 0) stockBadge = `<span class="stock-out"><i class="fas fa-times-circle"></i> Indisponível</span>`;
    else if (estoque <= 3) stockBadge = `<span class="stock-low"><i class="fas fa-exclamation-triangle"></i> Últimas ${estoque}!</span>`;
    else stockBadge = `<span class="stock-available"><i class="fas fa-check-circle"></i> ${estoque} disponíveis</span>`;

    const nomeEsc = nome.replace(/'/g, "\\'").replace(/"/g, "&quot;");
    const refEsc = referencia.replace(/'/g, "\\'").replace(/"/g, "&quot;");
    const imgEsc = imagem.replace(/"/g, "&quot;");

    let botaoHTML = "";
    if (estoque <= 0) botaoHTML = `<button disabled class="product-card-btn-disabled">Indisponível</button>`;
    else if (temCores) botaoHTML = `<button onclick='openSizeSelector("${p["ID"]}", "${nomeEsc}", "${refEsc}", ${preco}, "${imgEsc}")' class="product-card-btn"><i class="fas fa-palette"></i> Escolher Opções</button>`;
    else botaoHTML = `<button onclick='openSizeSelector("${p["ID"]}", "${nomeEsc}", "${refEsc}", ${preco}, "${imgEsc}")' class="product-card-btn product-card-btn-direct"><i class="fas fa-cart-plus"></i> Adicionar</button>`;

    const refHTML = referencia ? `<p class="product-card-ref">REF: ${referencia}</p>` : "";
    const categoriaHTML = categoria ? `<p class="product-card-category">${categoria}</p>` : "";
    const subcategoriaHTML = subcategoria ? `<p class="product-card-subcategory">${subcategoria}</p>` : "";
    const isPriority = index < 5;

    const imgTag = isPriority
      ? `<img src="${imgSmall}" srcset="${srcsetAttr}" sizes="${sizesAttr}" alt="${nome}" loading="eager" decoding="async" fetchpriority="high" width="400" height="400" class="product-card-img" onerror="this.onerror=null; this.src='${PLACEHOLDER_SVG}'" onclick="abrirZoomDireto('${imgEsc}')">`
      : `<img data-src="${imgMedium}" data-srcset="${srcsetAttr}" src="${PLACEHOLDER_SVG}" sizes="${sizesAttr}" alt="${nome}" loading="lazy" decoding="async" fetchpriority="low" width="400" height="400" class="product-card-img" onerror="this.onerror=null; this.src='${PLACEHOLDER_SVG}'" onclick="abrirZoomDireto('${imgEsc}')">`;

    const card = document.createElement("div");
    card.className = "product-card";
    card.innerHTML = `
      <div class="product-card-image">
        ${imgTag}
        ${estoque <= 0 ? '<div class="product-card-sold-out"><span>ESGOTADO</span></div>' : ""}
      </div>
      <div class="product-card-content">
        <h3 class="product-card-title">${nome}</h3>
        ${refHTML}${categoriaHTML}${subcategoriaHTML}
        <p class="product-card-price">R$ ${preco.toFixed(2).replace(".", ",")}</p>
        <div class="product-card-stock">${stockBadge}</div>
        ${botaoHTML}
      </div>`;
    fragment.appendChild(card);
  });
  container.appendChild(fragment);
  ativarLazyLoading();
  setTimeout(atualizarContadorProdutos, 100);
}

// ============================================
// LAZY LOADING
// ============================================
let lazyObserver = null;
function ativarLazyLoading() {
  if (!('IntersectionObserver' in window)) {
    document.querySelectorAll('img[data-src]').forEach(img => {
      img.src = img.dataset.src;
      if (img.dataset.srcset) img.srcset = img.dataset.srcset;
      img.removeAttribute('data-src'); img.removeAttribute('data-srcset');
    });
    return;
  }
  if (!lazyObserver) {
    lazyObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          if (img.dataset.src) {
            img.src = img.dataset.src;
            if (img.dataset.srcset) img.srcset = img.dataset.srcset;
            img.removeAttribute('data-src'); img.removeAttribute('data-srcset');
          }
          lazyObserver.unobserve(img);
        }
      });
    }, { rootMargin: '200px 0px', threshold: 0.01 });
  }
  document.querySelectorAll('img[data-src]').forEach(img => lazyObserver.observe(img));
}

// ============================================
// MARQUEE
// ============================================
function renderizarMarquee(items) {
  const track = document.getElementById("marquee-track");
  if (!track) return;
  if (!items || items.length === 0) {
    items = [
      { texto: "Frete Grátis acima de R$ 3.500", icone: "fa-solid fa-crown", cor: "dourado" },
      { texto: "Enviamos para todo o Brasil", icone: "fa-solid fa-truck-fast", cor: "branco" },
      { texto: "Joias Folheadas a Ouro e Prata", icone: "fa-solid fa-gem", cor: "dourado" },
      { texto: "5% OFF no PIX", icone: "fa-solid fa-percent", cor: "branco" },
      { texto: "@ivopita", icone: "fa-brands fa-instagram", cor: "dourado" },
      { texto: "Qualidade e Elegância", icone: "fa-solid fa-star", cor: "branco" },
    ];
  }
  const lista = [...items, ...items];
  track.innerHTML = lista.map(item => {
    const classe = item.cor === "dourado" ? "marquee-item-accent" : "";
    return `<span class="marquee-item ${classe}"><i class="${item.icone || "fa-solid fa-star"}"></i> ${item.texto}</span>`;
  }).join("");
}

// ============================================
// APLICAR CONFIG
// ============================================
function aplicarConfig(cfg) {
  if (!cfg || typeof cfg !== "object") return;
  siteConfig = Object.assign({}, siteConfig, cfg);
  if (cfg.freteGratisValor) FRETE_GRATIS_VALOR = parseFloat(cfg.freteGratisValor) || 3500;
  if (cfg.taxaFrete) TAXA_FRETE = parseFloat(cfg.taxaFrete) || 15;
  const whatsNumero = String(cfg.whatsapp || siteConfig.whatsapp).replace(/\D/g, "");
  document.querySelectorAll('a[href*="wa.me"]').forEach(a => a.href = `https://wa.me/${whatsNumero}`);
  const instaUser = String(cfg.instagram || siteConfig.instagram || "").replace("@", "");
  if (instaUser) document.querySelectorAll('a[href*="instagram.com"]').forEach(a => a.href = `https://www.instagram.com/${instaUser}`);
  const footerEndereco = document.querySelector("footer .fa-location-dot")?.parentElement;
  if (footerEndereco && cfg.endereco) footerEndereco.innerHTML = `<i class="fa-solid fa-location-dot text-gold"></i> ${cfg.endereco}`;
  const footerTelefone = document.querySelector("footer .fa-phone")?.parentElement;
  if (footerTelefone && (cfg.telefone || cfg.whatsappDisplay)) footerTelefone.innerHTML = `<i class="fa-solid fa-phone text-gold"></i> ${cfg.telefone || cfg.whatsappDisplay}`;
  const footerEmail = document.querySelector("footer .fa-envelope")?.parentElement;
  if (footerEmail && cfg.email) footerEmail.innerHTML = `<i class="fa-solid fa-envelope text-gold"></i> ${cfg.email}`;
  const sobreParagrafo = document.querySelector("footer p.text-slate-300");
  if (sobreParagrafo && cfg.sobreTexto) sobreParagrafo.innerHTML = `<strong>IVO PITA</strong> ${cfg.sobreTexto.replace(/^A\s+IVO PITA\s*/i, "")}`;
  window.__whatsappNumero = whatsNumero;
}
window.aplicarConfig = aplicarConfig;

// ============================================
// SIDEBAR DINÂMICA
// ============================================
function renderizarSidebarDinamica() {
  const scroll = document.getElementById('sidebar-scroll');
  if (!scroll) return;

  let tamanhos = [];
  if (window.__tamanhosBackend && Array.isArray(window.__tamanhosBackend) && window.__tamanhosBackend.length > 0) {
    tamanhos = window.__tamanhosBackend.map(t => ({
      cor: String(t.cor || 'dourado').toLowerCase().trim(),
      chave: normalizar(String(t.chave || '')),
      label: String(t.label || '').trim(),
      valor: String(t.valor || '').trim()
    }));
  }

  const btnTodas = scroll.querySelector('.sidebar-item[data-categoria="todos"]');
  scroll.innerHTML = '';
  if (btnTodas) scroll.appendChild(btnTodas);
  else {
    const nova = document.createElement('button');
    nova.className = 'sidebar-item sidebar-item-active';
    nova.setAttribute('data-categoria', 'todos');
    nova.innerHTML = `<span class="sidebar-icon"><i class="fas fa-gem"></i></span><span class="sidebar-label">Todas as Joias</span><span class="sidebar-count" id="count-todos">0</span>`;
    scroll.appendChild(nova);
  }

  if (!estruturaCategorias || estruturaCategorias.length === 0) return;

  const grupos = {};
  estruturaCategorias.forEach(item => {
    const g = item.grupo || 'Outros';
    if (!grupos[g]) grupos[g] = {};
    const c = item.categoria || 'Sem categoria';
    if (!grupos[g][c]) grupos[g][c] = [];
    if (item.subcategoria && item.subcategoria.trim() !== '') grupos[g][c].push(item.subcategoria);
  });

  const iconesGrupo = { 'Folheado Dourado': 'fa-solid fa-crown', 'Folheado Prata': 'fa-regular fa-gem' };
  const coresGrupo = { 'Folheado Dourado': 'linear-gradient(135deg, #fef3c7, #fcd34d)', 'Folheado Prata': 'linear-gradient(135deg, #f1f5f9, #cbd5e1)' };
  const coresIcone = { 'Folheado Dourado': '#92400e', 'Folheado Prata': '#475569' };

  Object.keys(grupos).forEach(nomeGrupo => {
    const groupDiv = document.createElement('div');
    groupDiv.className = 'sidebar-group';
    const titulo = document.createElement('button');
    titulo.className = 'sidebar-group-title';
    titulo.type = 'button';
    titulo.onclick = function () { toggleSidebarGroup(this); };
    titulo.innerHTML = `<span class="sidebar-group-icon" style="background: ${coresGrupo[nomeGrupo] || 'linear-gradient(135deg, #eef4ef, #d9e7de)'};"><i class="${iconesGrupo[nomeGrupo] || 'fa-solid fa-gem'}" style="color: ${coresIcone[nomeGrupo] || '#1f4d38'};"></i></span><span>${nomeGrupo}</span><i class="fas fa-chevron-down sidebar-group-arrow"></i>`;
    groupDiv.appendChild(titulo);

    const contentDiv = document.createElement('div');
    contentDiv.className = 'sidebar-group-content';
    Object.keys(grupos[nomeGrupo]).sort((a, b) => a.localeCompare(b, 'pt-BR')).forEach(nomeCategoria => {
      const subs = grupos[nomeGrupo][nomeCategoria];
      const nomeCatLower = nomeCategoria.toLowerCase();
      let corAtual = 'dourado';
      if (/prata|prateado|prateada/.test(nomeCatLower)) corAtual = 'prata';

      if (subs.length === 0) {
        const btn = document.createElement('button');
        btn.className = 'sidebar-item-sub';
        btn.type = 'button';
        btn.setAttribute('data-categoria', nomeCatLower);
        btn.innerHTML = `<span>${nomeCategoria}</span>`;
        contentDiv.appendChild(btn);
        return;
      }

      const nomeCurto = nomeCategoria.replace(/\s+(dourado|dourada|dourados|douradas)\s*$/i, '').replace(/\s+(prata|prateado|prateada|prateados|prateadas)\s*$/i, '').trim();

      if (subs.length === 1 && subs[0].toLowerCase() === nomeCurto.toLowerCase()) {
        const btn = document.createElement('button');
        btn.className = 'sidebar-item-sub';
        btn.type = 'button';
        btn.setAttribute('data-categoria', nomeCatLower);
        btn.innerHTML = `<span>${nomeCategoria}</span>`;
        contentDiv.appendChild(btn);
        return;
      }

      const subDiv = document.createElement('div');
      subDiv.className = 'sidebar-subgroup';
      const subTitle = document.createElement('button');
      subTitle.className = 'sidebar-subgroup-title';
      subTitle.type = 'button';
      subTitle.onclick = function () { toggleSidebarSubgroup(this); };
      subTitle.innerHTML = `<span>${nomeCurto}</span><i class="fas fa-chevron-down"></i>`;
      subDiv.appendChild(subTitle);
      const subContent = document.createElement('div');
      subContent.className = 'sidebar-subgroup-content';

      const catNorm = normalizar(nomeCatLower);
      subs.forEach(sub => {
        const btn = document.createElement('button');
        btn.className = 'sidebar-item-sub';
        btn.type = 'button';
        btn.setAttribute('data-categoria', (nomeCategoria + ' ' + sub).toLowerCase());
        btn.innerHTML = `<span>${sub}</span>`;
        subContent.appendChild(btn);

        const subNorm = normalizar(sub);
        tamanhos.filter(t => {
          if (!t.chave) return false;
          if (t.cor !== corAtual) return false;
          const k = normalizar(t.chave);
          return catNorm.indexOf(k) !== -1 || subNorm.indexOf(k) !== -1;
        }).forEach(t => {
          const btnT = document.createElement('button');
          btnT.className = 'sidebar-item-tamanho';
          btnT.type = 'button';
          btnT.setAttribute('data-categoria', `${t.chave} ${t.cor} ${t.valor}`);
          btnT.innerHTML = `<span>${t.label}</span>`;
          subContent.appendChild(btnT);
        });
      });
      subDiv.appendChild(subContent);
      contentDiv.appendChild(subDiv);
    });
    groupDiv.appendChild(contentDiv);
    scroll.appendChild(groupDiv);
  });

  sidebarDinamicaAtiva = true;
  rebindSidebarEvents();
}

function rebindSidebarEvents() {
  const botoes = document.querySelectorAll('.sidebar-item, .sidebar-item-sub, .sidebar-item-tamanho');
  botoes.forEach(btn => {
    btn.onclick = function (e) {
      e.preventDefault();
      e.stopPropagation();
      const cat = this.getAttribute('data-categoria');
      if (!cat) return;
      marcarItemSidebarAtivo(cat);
      filtrarPorCategoria(cat);
      if (window.innerWidth <= 900) fecharSidebarMobile();
    };
  });
  atualizarContadoresSidebar();
}

function toggleSidebarGroup(btn) { btn.closest('.sidebar-group')?.classList.toggle('open'); }
function toggleSidebarSubgroup(btn) { btn.closest('.sidebar-subgroup')?.classList.toggle('open'); }
window.toggleSidebarGroup = toggleSidebarGroup;
window.toggleSidebarSubgroup = toggleSidebarSubgroup;

function abrirSidebarMobile() {
  document.getElementById('mobile-menu')?.classList.add('translate-x-full');
  document.getElementById('mobile-overlay')?.classList.add('hidden');
  if (window.innerWidth <= 900) {
    document.querySelectorAll('.sidebar-group').forEach(g => g.classList.remove('open'));
    document.querySelectorAll('.sidebar-subgroup').forEach(sg => sg.classList.remove('open'));
  }
  document.getElementById('sidebar-categorias')?.classList.add('open');
  document.getElementById('sidebar-overlay')?.classList.add('active');
  document.body.style.overflow = 'hidden';
}
function fecharSidebarMobile() {
  document.getElementById('sidebar-categorias')?.classList.remove('open');
  document.getElementById('sidebar-overlay')?.classList.remove('active');
  document.body.style.overflow = '';
}
window.abrirSidebarMobile = abrirSidebarMobile;
window.fecharSidebarMobile = fecharSidebarMobile;

function marcarItemSidebarAtivo(categoria) {
  document.querySelectorAll('.sidebar-item, .sidebar-item-sub, .sidebar-item-tamanho').forEach(el => el.classList.remove('sidebar-item-active', 'active'));
  if (categoria === 'todos') {
    document.querySelector('.sidebar-item[data-categoria="todos"]')?.classList.add('sidebar-item-active');
    return;
  }
  const elT = document.querySelector(`.sidebar-item-tamanho[data-categoria="${categoria}"]`);
  if (elT) { elT.classList.add('active'); return; }
  document.querySelector(`.sidebar-item-sub[data-categoria="${categoria}"]`)?.classList.add('active');
}

function atualizarContadorProdutos() {
  const el = document.getElementById('products-count');
  if (el) {
    const total = document.querySelectorAll('#produtos-container .product-card').length;
    el.textContent = `${total} produto${total !== 1 ? 's' : ''}`;
  }
}

function atualizarContadoresSidebar() {
  if (!allProducts || allProducts.length === 0) return;
  const totalEl = document.getElementById('count-todos');
  if (totalEl) totalEl.textContent = allProducts.length;
  document.querySelectorAll('.sidebar-item-sub[data-categoria]').forEach(btn => {
    const cat = btn.getAttribute('data-categoria');
    if (!cat) return;
    const qtd = contarProdutosPorCategoria(cat);
    let sp = btn.querySelector('.sidebar-count');
    if (!sp) { sp = document.createElement('span'); sp.className = 'sidebar-count'; btn.appendChild(sp); }
    sp.textContent = qtd;
    btn.style.opacity = qtd === 0 ? '0.5' : '1';
  });
  document.querySelectorAll('.sidebar-item-tamanho[data-categoria]').forEach(btn => {
    const cat = btn.getAttribute('data-categoria');
    if (!cat) return;
    const qtd = contarProdutosPorCategoria(cat);
    let sp = btn.querySelector('.sidebar-count');
    if (!sp) { sp = document.createElement('span'); sp.className = 'sidebar-count'; btn.appendChild(sp); }
    sp.textContent = qtd;
    btn.style.opacity = qtd === 0 ? '0.5' : '1';
  });
}

function contarProdutosPorCategoria(categoria) {
  if (!allProducts || allProducts.length === 0) return 0;
  const catFiltro = normalizar(categoria);
  const palavras = catFiltro.split(/\s+/).filter(p => p.length > 0).map(normalizarPalavraBusca);
  return allProducts.filter(p => {
    const combinado = [normalizar(p["Categoria"]), normalizar(p["Subcategoria"]), normalizar(p["Tamanho"]), normalizar(p["Nome do Produto"]), normalizar(p["referencia"])].join(" ");
    const norm = combinado.split(/\s+/).map(normalizarPalavraBusca).join(" ");
    return palavras.every(w => norm.includes(w));
  }).length;
}

// ============================================
// FILTRO / BUSCA
// ============================================
function filtrarPorCategoria(categoria) {
  if (!categoria || categoria === 'todos') { renderProducts(allProducts); return; }
  const catFiltro = normalizar(categoria);
  const palavras = catFiltro.split(/\s+/).filter(p => p.length > 0).map(normalizarPalavraBusca);
  const filtrados = allProducts.filter(p => {
    const combinado = [normalizar(p["Categoria"]), normalizar(p["Subcategoria"]), normalizar(p["Tamanho"]), normalizar(p["Nome do Produto"]), normalizar(p["referencia"])].join(" ");
    const norm = combinado.split(/\s+/).map(normalizarPalavraBusca).join(" ");
    return palavras.every(w => norm.includes(w));
  });
  renderProducts(filtrados);
}
window.filtrarPorCategoria = filtrarPorCategoria;

function performSearch(termo) {
  const t = normalizar(termo);
  const filtrados = allProducts.filter(p => normalizar(p["Nome do Produto"]).includes(t) || normalizar(p["referencia"]).includes(t));
  renderProducts(filtrados);
}
window.performSearch = performSearch;

function ordenarProdutos(tipo) {
  if (!allProducts || allProducts.length === 0) return;
  const cards = [...document.querySelectorAll('#produtos-container .product-card')];
  if (cards.length === 0) return;
  const nomesVisiveis = cards.map(c => c.querySelector('.product-card-title')?.textContent.trim() || '');
  const filtrados = allProducts.filter(p => nomesVisiveis.includes(p["Nome do Produto"]));
  const ordenados = [...filtrados];
  switch (tipo) {
    case 'menor-preco': ordenados.sort((a, b) => (parseFloat(a["Preço"]) || 0) - (parseFloat(b["Preço"]) || 0)); break;
    case 'maior-preco': ordenados.sort((a, b) => (parseFloat(b["Preço"]) || 0) - (parseFloat(a["Preço"]) || 0)); break;
    case 'nome-az': ordenados.sort((a, b) => (a["Nome do Produto"] || '').localeCompare(b["Nome do Produto"] || '')); break;
    case 'nome-za': ordenados.sort((a, b) => (b["Nome do Produto"] || '').localeCompare(a["Nome do Produto"] || '')); break;
  }
  renderProducts(ordenados);
}
window.ordenarProdutos = ordenarProdutos;

// ============================================
// MODAL DE CORES
// ============================================
function renderizarCores() {
  const container = document.getElementById("colors-container");
  if (!container) return;
  container.innerHTML = "";
  if (!Array.isArray(coresDisponiveis) || coresDisponiveis.length === 0) {
    container.innerHTML = `<p class="text-sm text-gray-500">Nenhuma cor disponível.</p>`;
    return;
  }
  coresDisponiveis.forEach(nomeCor => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = nomeCor;
    btn.className = "px-4 py-3 rounded-xl border border-primary/20 bg-white hover:bg-primary hover:text-white transition-all duration-200 font-semibold text-sm";
    btn.onclick = () => window.selectColor(nomeCor);
    container.appendChild(btn);
  });
}
window.renderizarCores = renderizarCores;

function selectColor(cor) {
  if (quantidadeSelecionada <= 0) { showToast("Escolha a quantidade primeiro!", "error", 2000); return; }
  const corLower = cor.toLowerCase();
  const qtd = quantidadeSelecionada;
  coresSelecionadas[corLower] = (coresSelecionadas[corLower] || 0) + qtd;
  window.renderizarCores();
  quantidadeSelecionada = 0;
  window.atualizarResumoSelecao();
  showToast(`🎨 ${qtd}x ${cor} adicionado`, "success", 2000);
  document.querySelectorAll(".qty-option-btn").forEach(btn => btn.classList.remove("selected"));
  const instr = document.getElementById("color-instruction");
  if (instr) { instr.innerText = "Escolha a quantidade primeiro"; instr.classList.remove("highlight"); }
}
window.selectColor = selectColor;

function atualizarUISelecao() {
  document.querySelectorAll(".qty-option-btn").forEach(btn => {
    btn.classList.remove("selected");
    if (parseInt(btn.innerText) === quantidadeSelecionada) btn.classList.add("selected");
  });
  const instr = document.getElementById("color-instruction");
  if (instr) {
    if (quantidadeSelecionada > 0) { instr.innerText = `Agora escolha a cor para ${quantidadeSelecionada} unidade(s)`; instr.classList.add("highlight"); }
    else { instr.innerText = "Escolha a quantidade primeiro"; instr.classList.remove("highlight"); }
  }
}
window.atualizarUISelecao = atualizarUISelecao;

function atualizarResumoSelecao() {
  const c = document.getElementById("selection-summary");
  if (!c) return;
  const entradas = Object.entries(coresSelecionadas).filter(([_, q]) => q > 0);
  if (entradas.length === 0) { c.innerHTML = ""; c.classList.add("hidden"); return; }
  c.classList.remove("hidden");
  let html = `<p class="summary-title">Seleção atual:</p><div class="summary-items">`;
  let total = 0;
  entradas.forEach(([cor, qtd]) => {
    const original = coresDisponiveis.find(x => x.toLowerCase() === cor) || cor;
    html += `<div class="summary-item"><span class="summary-color">${original}</span><span class="summary-qty">${qtd}x</span></div>`;
    total += qtd;
  });
  html += `</div><p class="summary-total">Total: ${total} unidade(s)</p>`;
  c.innerHTML = html;
}
window.atualizarResumoSelecao = atualizarResumoSelecao;

function resetarModalUI() {
  const r = document.getElementById("selection-summary");
  if (r) { r.innerHTML = ""; r.classList.add("hidden"); }
  const i = document.getElementById("color-instruction");
  if (i) { i.innerText = "Escolha a quantidade primeiro"; i.classList.remove("highlight"); }
  const inp = document.getElementById("custom-quantity");
  if (inp) inp.value = 1;
  document.querySelectorAll(".qty-option-btn").forEach(btn => btn.classList.remove("selected"));
  document.querySelectorAll(".color-name-btn").forEach(btn => btn.classList.remove("selected"));
}
window.resetarModalUI = resetarModalUI;

function adicionarSemCor(quantidade, buttonElement) {
  if (!tempProduct) return;
  const estoque = tempProduct.estoqueDisponivel || 0;
  if (!quantidade || quantidade <= 0) { showToast("Digite uma quantidade válida", "error", 2000); return; }
  if (quantidade > estoque) { showToast(`Só temos ${estoque} unidade(s)`, "error", 2500); return; }
  const uniqueId = `${tempProduct.id}-unico`;
  const totalPrice = tempProduct.price * quantidade;
  addToCart(uniqueId, tempProduct.name, totalPrice, tempProduct.img, tempProduct.id, tempProduct.ref, quantidade, buttonElement || tempProduct.buttonElement);
  window.closeSizeModal();
}
window.adicionarSemCor = adicionarSemCor;

function confirmarSelecao() {
  const instr = document.getElementById("color-instruction");
  if (coresDisponiveis.length === 0) {
    const inp = document.getElementById("custom-quantity");
    const qtd = parseInt(inp?.value) || 0;
    if (!qtd || qtd <= 0) { showToast("Digite uma quantidade válida", "error", 2000); return; }
    window.adicionarSemCor(qtd);
    return;
  }
  if (quantidadeSelecionada > 0) {
    showToast(`Você escolheu ${quantidadeSelecionada} unidade(s). Clique em uma cor para confirmar!`, "warning", 3000);
    if (instr) { instr.classList.add("highlight"); instr.scrollIntoView({ behavior: "smooth", block: "center" }); }
    return;
  }
  const entradas = Object.entries(coresSelecionadas).filter(([_, q]) => q > 0);
  if (entradas.length === 0) { showToast("Selecione pelo menos uma cor!", "error", 2000); return; }
  const total = entradas.reduce((s, [_, q]) => s + q, 0);
  const estoque = tempProduct.estoqueDisponivel || 0;
  if (total > estoque) { showToast(`Total (${total}) ultrapassa o estoque (${estoque}).`, "error", 3000); return; }
  entradas.forEach(([cor, qtd]) => {
    const original = coresDisponiveis.find(c => c.toLowerCase() === cor) || cor;
    const uniqueId = `${tempProduct.id}-${original}`;
    const fullName = `${tempProduct.name} - ${original}`;
    addToCart(uniqueId, fullName, tempProduct.price * qtd, tempProduct.img, tempProduct.id, tempProduct.ref, qtd, tempProduct.buttonElement);
  });
  window.closeSizeModal();
}
window.confirmarSelecao = confirmarSelecao;

window.closeSizeModal = function () {
  const modal = document.getElementById("size-modal");
  if (modal) { modal.classList.add("hidden"); modal.classList.remove("flex"); }
  selectedColor = ""; tempProduct = null; quantidadeSelecionada = 0; coresSelecionadas = {};
  const imgContainer = document.getElementById("product-single-image");
  if (imgContainer) imgContainer.remove();
};

// ============================================
// OPEN SIZE SELECTOR
// ============================================
window.openSizeSelector = function (id, name, ref, price, img) {
  let buttonElement = null;
  if (window.event?.currentTarget) buttonElement = window.event.currentTarget;
  else if (window.event?.target) buttonElement = window.event.target.closest('button');

  const p = allProducts.find(prod => String(prod["ID"]) === String(id));
  if (!p) { showToast("Produto não encontrado!", "error", 2000); return; }

  const estoqueLocal = parseInt(p["Saldo Estoque"]) || 0;
  const jaNoCarrinho = quantidadeNoCarrinho(id);
  let estoqueDisponivel = estoqueLocal - jaNoCarrinho;
  const cached = getEstoqueCache(id);
  if (cached !== null) estoqueDisponivel = cached - jaNoCarrinho;

  if (estoqueDisponivel <= 0) {
    showToast(jaNoCarrinho > 0 ? `Você já tem ${jaNoCarrinho} no carrinho.` : "Produto esgotado!", "error", 3000);
    return;
  }

  const priceNum = parseFloat(price) || 0;
  tempProduct = { id: p["ID"], name, price: priceNum, img, ref, estoqueDisponivel, buttonElement };
  quantidadeSelecionada = 0; coresSelecionadas = {}; selectedColor = "";

  const nameEl = document.getElementById("size-product-name");
  const refEl = document.getElementById("size-product-ref");
  const priceEl = document.getElementById("size-product-price");
  if (nameEl) nameEl.innerText = name;
  if (refEl) refEl.innerText = ref ? `Ref: ${ref}` : "Ref: —";
  if (priceEl) priceEl.innerHTML = `R$ ${priceNum.toFixed(2).replace(".", ",")} cada<small id="estoque-display">${estoqueDisponivel} unidades disponíveis${jaNoCarrinho > 0 ? ` (${jaNoCarrinho} no carrinho)` : ""}</small>`;

  const imgContainer = document.getElementById("size-product-image-container");
  if (imgContainer) {
    imgContainer.innerHTML = `<img src="${driveImg(p["Imagem"], IMG_SIZE_MODAL)}" alt="${name}" loading="lazy" decoding="async" onerror="this.onerror=null; this.src=window.PLACEHOLDER_SVG;">`;
    imgContainer.onclick = () => abrirZoomModal(p["Imagem"]);
  }

  coresDisponiveis = p["Cores"] ? p["Cores"].split(",").map(c => c.trim()).filter(Boolean) : [];
  const temCores = coresDisponiveis.length > 0;

  const colorStep = document.getElementById("color-step");
  const sizeStep = document.getElementById("size-step");
  const summary = document.getElementById("selection-summary");
  const btnAdd = document.getElementById("add-custom-qty");

  if (temCores) {
    colorStep?.classList.remove("hidden");
    sizeStep?.classList.remove("hidden");
    summary?.classList.remove("hidden");
    const t = document.getElementById("modal-step-title");
    if (t) t.innerText = "Selecione a Quantidade";
    if (btnAdd) { btnAdd.innerHTML = "Selecionar"; btnAdd.classList.remove("btn-direct-add"); }
    window.renderizarCores();
  } else {
    colorStep?.classList.add("hidden");
    sizeStep?.classList.remove("hidden");
    summary?.classList.add("hidden");
    const t = document.getElementById("modal-step-title");
    if (t) t.innerText = "Escolha a Quantidade";
    if (btnAdd) { btnAdd.innerHTML = '<i class="fas fa-cart-plus"></i> Adicionar'; btnAdd.classList.add("btn-direct-add"); }
    selectedColor = "Único";
  }

  const options = document.getElementById("options-container");
  if (!options) return;
  options.innerHTML = "";

  let quantidades = [];
  if (p["Quantidade"] && p["Quantidade"].trim()) quantidades = p["Quantidade"].split(",").map(q => parseInt(q.trim())).filter(q => !isNaN(q) && q > 0);
  if (quantidades.length === 0) quantidades = [1, 2, 3, 5, 10];
  quantidades = quantidades.filter(q => q <= estoqueDisponivel);
  if (quantidades.length === 0) quantidades = [1];

  quantidades.forEach(qtd => {
    const btn = document.createElement("button");
    btn.className = "qty-option-btn";
    btn.innerText = qtd;
    btn.onclick = () => {
      if (temCores) { quantidadeSelecionada = qtd; window.atualizarUISelecao(); }
      else window.adicionarSemCor(qtd, buttonElement);
    };
    options.appendChild(btn);
  });

  const inputCustom = document.getElementById("custom-quantity");
  if (inputCustom) { inputCustom.value = 1; inputCustom.max = estoqueDisponivel; }

  if (typeof window.resetarModalUI === "function") window.resetarModalUI();

  const modal = document.getElementById("size-modal");
  if (modal) { modal.classList.remove("hidden"); modal.classList.add("flex"); }

  verificarEstoqueServidor(id).then(resp => {
    if (resp && resp.success) {
      const saldo = parseInt(resp.saldo) || 0;
      p["Saldo Estoque"] = saldo;
      const novo = saldo - jaNoCarrinho;
      if (tempProduct && String(tempProduct.id) === String(id)) {
        tempProduct.estoqueDisponivel = novo;
        const disp = document.getElementById("estoque-display");
        if (disp) disp.textContent = `${novo} unidades disponíveis${jaNoCarrinho > 0 ? ` (${jaNoCarrinho} no carrinho)` : ""}`;
        if (novo < estoqueDisponivel && novo >= 0) showToast(`⚠️ Estoque atualizado: ${novo} disponíveis`, "warning", 2500);
      }
    }
  }).catch(() => { });
};

// ============================================
// ZOOM
// ============================================
let zoomScale = 1, zoomPositionX = 0, zoomPositionY = 0, isDragging = false, dragStartX = 0, dragStartY = 0;
const ZOOM_MIN = 1, ZOOM_MAX = 5;

function abrirZoomDireto(imagem) {
  const modal = document.getElementById("image-zoom-modal");
  const img = document.getElementById("zoom-image");
  const thumbs = document.getElementById("zoom-thumbnails");
  if (!modal || !img || !thumbs) return;

  const previewUrl = driveImg(imagem, 400);
  const fullUrl = driveImg(imagem, IMG_SIZE_ZOOM);
  imagensZoom = [fullUrl]; zoomIndex = 0;
  zoomScale = 1; zoomPositionX = 0; zoomPositionY = 0;
  img.src = previewUrl;
  img.style.transform = 'scale(1) translate(0, 0)';
  img.classList.remove('zoomed');
  modal.classList.remove('zoomed-active');

  const hi = new Image();
  hi.src = fullUrl;
  hi.onload = () => { if (img.src === previewUrl) img.src = fullUrl; };
  img.onerror = function () { this.onerror = null; this.src = PLACEHOLDER_SVG; };

  thumbs.innerHTML = "";
  imagensZoom.forEach((src, i) => {
    const t = document.createElement("img");
    t.src = src;
    t.className = `thumbnail-image ${i === zoomIndex ? "active" : ""}`;
    t.onclick = e => { e.stopPropagation(); zoomIndex = i; document.getElementById("zoom-image").src = imagensZoom[i]; resetZoom(); document.querySelectorAll("#zoom-thumbnails .thumbnail-image").forEach((el, idx) => el.classList.toggle("active", idx === i)); };
    thumbs.appendChild(t);
  });

  configurarEventosZoom();
  modal.classList.add("active");
  document.body.style.overflow = "hidden";
}

function configurarEventosZoom() {
  const img = document.getElementById("zoom-image");
  const modal = document.getElementById("image-zoom-modal");
  if (!img || !modal) return;
  const clone = img.cloneNode(true);
  img.parentNode.replaceChild(clone, img);
  const newImg = document.getElementById("zoom-image");

  newImg.addEventListener('click', e => {
    e.stopPropagation();
    if (zoomScale === 1) { zoomScale = 2.5; aplicarTransformacao(); newImg.classList.add('zoomed'); modal.classList.add('zoomed-active'); }
    else resetZoom();
  });
  newImg.addEventListener('dblclick', e => { e.stopPropagation(); resetZoom(); });
  newImg.addEventListener('mousedown', e => {
    if (zoomScale <= 1) return;
    e.preventDefault(); isDragging = true;
    dragStartX = e.clientX - zoomPositionX; dragStartY = e.clientY - zoomPositionY;
  });
  modal.addEventListener('wheel', e => {
    if (!modal.classList.contains('active')) return;
    e.preventDefault();
    zoomScale = e.deltaY < 0 ? Math.min(zoomScale + 0.2, ZOOM_MAX) : Math.max(zoomScale - 0.2, ZOOM_MIN);
    aplicarTransformacao();
    if (zoomScale > 1) { newImg.classList.add('zoomed'); modal.classList.add('zoomed-active'); }
    else { newImg.classList.remove('zoomed'); modal.classList.remove('zoomed-active'); zoomPositionX = 0; zoomPositionY = 0; }
  }, { passive: false });

  document.removeEventListener('mousemove', handleMouseMove);
  document.removeEventListener('mouseup', handleMouseUp);
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);

  let touchDist = 0, touchScale = 1;
  newImg.addEventListener('touchstart', e => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      touchDist = Math.sqrt(dx * dx + dy * dy); touchScale = zoomScale;
    } else if (e.touches.length === 1 && zoomScale > 1) {
      isDragging = true; dragStartX = e.touches[0].clientX - zoomPositionX; dragStartY = e.touches[0].clientY - zoomPositionY;
    }
  });
  newImg.addEventListener('touchmove', e => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      zoomScale = Math.min(Math.max(touchScale * (Math.sqrt(dx * dx + dy * dy) / touchDist), ZOOM_MIN), ZOOM_MAX);
      aplicarTransformacao();
      if (zoomScale > 1) { newImg.classList.add('zoomed'); modal.classList.add('zoomed-active'); }
      else { newImg.classList.remove('zoomed'); modal.classList.remove('zoomed-active'); }
    } else if (e.touches.length === 1 && isDragging && zoomScale > 1) {
      e.preventDefault();
      zoomPositionX = e.touches[0].clientX - dragStartX; zoomPositionY = e.touches[0].clientY - dragStartY;
      aplicarTransformacao();
    }
  }, { passive: false });
  newImg.addEventListener('touchend', () => { isDragging = false; });
}

function handleMouseMove(e) {
  if (!isDragging || zoomScale <= 1) return;
  zoomPositionX = e.clientX - dragStartX; zoomPositionY = e.clientY - dragStartY;
  aplicarTransformacao();
}
function handleMouseUp() { isDragging = false; }

function aplicarTransformacao() {
  const img = document.getElementById("zoom-image");
  if (!img) return;
  const max = 200 * (zoomScale - 1);
  zoomPositionX = Math.max(-max, Math.min(max, zoomPositionX));
  zoomPositionY = Math.max(-max, Math.min(max, zoomPositionY));
  img.style.transform = `scale(${zoomScale}) translate(${zoomPositionX / zoomScale}px, ${zoomPositionY / zoomScale}px)`;
  const ind = document.getElementById('zoom-indicator');
  if (ind) ind.textContent = `🔍 Zoom ${Math.round(zoomScale * 100)}% — Arraste para explorar`;
}

function aplicarZoom(delta) {
  zoomScale = Math.min(Math.max(zoomScale + delta, ZOOM_MIN), ZOOM_MAX);
  aplicarTransformacao();
  const img = document.getElementById("zoom-image"), modal = document.getElementById("image-zoom-modal");
  if (zoomScale > 1) { img.classList.add('zoomed'); modal.classList.add('zoomed-active'); }
  else { img.classList.remove('zoomed'); modal.classList.remove('zoomed-active'); zoomPositionX = 0; zoomPositionY = 0; }
}
window.aplicarZoom = aplicarZoom;

function resetZoom() {
  zoomScale = 1; zoomPositionX = 0; zoomPositionY = 0;
  const img = document.getElementById("zoom-image"), modal = document.getElementById("image-zoom-modal");
  if (img) { img.style.transform = 'scale(1) translate(0, 0)'; img.classList.remove('zoomed'); }
  if (modal) modal.classList.remove('zoomed-active');
}
window.resetZoom = resetZoom;

function fecharZoom() {
  document.getElementById("image-zoom-modal")?.classList.remove("active");
  document.body.style.overflow = ""; resetZoom();
}
function zoomAnterior() {
  if (imagensZoom.length === 0) return;
  zoomIndex = (zoomIndex - 1 + imagensZoom.length) % imagensZoom.length;
  document.getElementById("zoom-image").src = imagensZoom[zoomIndex];
  resetZoom();
}
function zoomProximo() {
  if (imagensZoom.length === 0) return;
  zoomIndex = (zoomIndex + 1) % imagensZoom.length;
  document.getElementById("zoom-image").src = imagensZoom[zoomIndex];
  resetZoom();
}
function abrirZoomModal(imagem) { abrirZoomDireto(imagem); }
window.fecharZoom = fecharZoom;
window.zoomAnterior = zoomAnterior;
window.zoomProximo = zoomProximo;
window.abrirZoomDireto = abrirZoomDireto;
window.abrirZoomModal = abrirZoomModal;

// ============================================
// ✅ CHECKOUT WHATSAPP — mensagem completa
// ============================================
function montarMensagemPedido() {
  const linhas = [];
  linhas.push('*🛍️ NOVO PEDIDO — IVO PITA JOIAS*');
  linhas.push('');

  const cliente = (typeof carregarDadosCliente === 'function') ? carregarDadosCliente() : null;
  if (cliente && cliente.nome) {
    linhas.push('*👤 Cliente*');
    linhas.push(`Nome: ${cliente.nome}`);
    if (cliente.celular) linhas.push(`Celular: ${cliente.celular}`);
    if (cliente.email) linhas.push(`E-mail: ${cliente.email}`);
    if (cliente.endereco) {
      const end = [
        `${cliente.endereco}, ${cliente.numero || ''}`,
        cliente.complemento || null,
        cliente.bairro || '',
        `${cliente.cidade || ''} - ${cliente.estado || ''}`,
        cliente.cep ? `CEP: ${cliente.cep}` : null
      ].filter(Boolean).join(' • ');
      linhas.push(`Endereço: ${end}`);
    }
    linhas.push('');
  }

  linhas.push('*📦 Itens*');
  cart.forEach((item, i) => {
    const precoUnit = item.precoUnitario || (item.price / item.quantity);
    linhas.push(`${i + 1}. ${item.name}`);
    if (item.ref) linhas.push(`   Ref: ${item.ref}`);
    linhas.push(`   ${item.quantity}x R$ ${precoUnit.toFixed(2).replace('.', ',')} = R$ ${item.price.toFixed(2).replace('.', ',')}`);
  });
  linhas.push('');

  const freteGratis = subtotal >= FRETE_GRATIS_VALOR;
  const frete = freteGratis ? 0 : TAXA_FRETE;
  const total = subtotal + frete;

  linhas.push('*💰 Resumo*');
  linhas.push(`Subtotal: R$ ${subtotal.toFixed(2).replace('.', ',')}`);
  linhas.push(`Frete: ${freteGratis ? 'GRÁTIS 🎉' : 'R$ ' + frete.toFixed(2).replace('.', ',')}`);
  linhas.push(`*Total: R$ ${total.toFixed(2).replace('.', ',')}*`);
  linhas.push('');
  linhas.push('_Pedido gerado pelo site ivo pita joias_');

  return linhas.join('\n');
}

// ============================================
// ✅ SALVAR PEDIDO NO SUPABASE
// ============================================
async function salvarPedidoSupabase() {
  try {
    const cliente = (typeof carregarDadosCliente === 'function') ? carregarDadosCliente() : null;

    const itensTexto = cart.map(i =>
      `${i.quantity}x ${i.name}${i.ref ? ` (Ref: ${i.ref})` : ''}`
    ).join('\n');

    let endereco = '—';
    if (cliente && cliente.endereco) {
      endereco = [
        `${cliente.endereco}, ${cliente.numero || ''}`,
        cliente.complemento || null,
        cliente.bairro || '',
        `${cliente.cidade || ''} - ${cliente.estado || ''}`,
        cliente.cep ? `CEP: ${cliente.cep}` : null
      ].filter(Boolean).join(' • ');
    }

    const freteGratis = subtotal >= FRETE_GRATIS_VALOR;
    const frete = freteGratis ? 0 : TAXA_FRETE;
    const total = subtotal + frete;

    const payload = {
      cliente_nome: cliente?.nome || 'Não informado',
      cliente_celular: cliente?.celular || null,
      endereco: endereco,
      itens: itensTexto,
      subtotal: subtotal,
      frete: frete,
      total: total,
      status: 'Pendente'
    };

    const { data, error } = await supabase
      .from('pedidos')
      .insert([payload])
      .select('id')
      .single();

    if (error) throw error;
    console.log('✅ Pedido salvo:', data);
    return data;
  } catch (err) {
    console.error('❌ Erro ao salvar pedido:', err);
    return null;
  }
}
window.salvarPedidoSupabase = salvarPedidoSupabase;

// ============================================
// ✅ BAIXA DE ESTOQUE (RPC)
// ============================================
function agruparCarrinhoParaBaixa() {
  const mapa = {};
  cart.forEach(item => {
    const id = item.baseId;
    if (!id) return;
    mapa[id] = (mapa[id] || 0) + (item.quantity || 1);
  });
  return Object.entries(mapa).map(([id, quantidade]) => ({
    id: String(id),
    quantidade
  }));
}

async function baixarEstoquePedido() {
  const itens = agruparCarrinhoParaBaixa();
  if (itens.length === 0) return { success: true, vazio: true };

  console.log('📉 Baixando estoque:', itens);

  try {
    const { data, error } = await supabase.rpc('baixar_estoque', { itens });

    if (error) {
      console.error('❌ Erro RPC baixar_estoque:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ Resultado baixa:', data);

    if (!data?.success) {
      return { success: false, falhas: data?.falhas || [] };
    }

    if (typeof invalidarEstoqueCache === 'function') invalidarEstoqueCache();

    return { success: true, baixas: data.baixas };
  } catch (err) {
    console.error('❌ Exceção baixa estoque:', err);
    return { success: false, error: err.message };
  }
}

// ============================================
// 🚀 INIT
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 Iniciando sistema...');

  if (!supabase) {
    console.error('❌ Supabase não inicializado!');
    showToast('Erro de configuração: Supabase', 'error', 5000);
    return;
  }
  console.log('✅ Supabase client OK');

  const cache = localStorage.getItem(CACHE_KEY_DADOS);
  const cacheTime = parseInt(localStorage.getItem(CACHE_KEY_TIME) || '0');
  if (cache && Date.now() - cacheTime < CACHE_TTL_MS) {
    try {
      const dados = JSON.parse(cache);
      allProducts = (dados.produtos || []).map(p => p);
      if (allProducts.length > 0) {
        console.log(`⚡ ${allProducts.length} produtos do cache`);
        renderProducts(allProducts);
      }
      setTimeout(atualizarContadoresSidebar, 50);
      setTimeout(atualizarContadorProdutos, 50);
      setTimeout(() => carregarProdutos().catch(() => { }), 500);
    } catch (e) {
      localStorage.removeItem(CACHE_KEY_DADOS);
      await carregarProdutos();
    }
  } else {
    await carregarProdutos();
  }

  configurarListenersCliente();
  updateCart();
  ativarRealtimeProdutos();

  // ============================================
  // ✅ LISTENERS DO CARRINHO
  // ============================================
  const cartBtn = document.getElementById('cart-btn');
  if (cartBtn) {
    cartBtn.onclick = () => {
      const modal = document.getElementById('cart-modal');
      if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        if (typeof updateCart === 'function') updateCart();
      }
    };
  }

  const closeCartBtn = document.getElementById('close-modal-btn');
  if (closeCartBtn) {
    closeCartBtn.onclick = () => {
      const modal = document.getElementById('cart-modal');
      if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
      }
    };
  }

  const clearCartBtn = document.getElementById('clear-cart-btn');
  if (clearCartBtn) {
    clearCartBtn.onclick = () => {
      const confirmModal = document.getElementById('confirm-clear-modal');
      if (confirmModal) {
        confirmModal.classList.remove('hidden');
        confirmModal.classList.add('flex');
      }
    };
  }

  const confirmClearBtn = document.getElementById('confirm-clear-btn');
  if (confirmClearBtn) {
    confirmClearBtn.onclick = () => {
      cart = [];
      updateCart();
      const confirmModal = document.getElementById('confirm-clear-modal');
      if (confirmModal) {
        confirmModal.classList.add('hidden');
        confirmModal.classList.remove('flex');
      }
      showToast("Sacola limpa!", "info", 2000);
    };
  }

  const cancelClearBtn = document.getElementById('cancel-clear-btn');
  if (cancelClearBtn) {
    cancelClearBtn.onclick = () => {
      const confirmModal = document.getElementById('confirm-clear-modal');
      if (confirmModal) {
        confirmModal.classList.add('hidden');
        confirmModal.classList.remove('flex');
      }
    };
  }

  // ============================================
  // ✅ CHECKOUT WHATSAPP
  // ============================================
  const checkoutBtn = document.getElementById('checkout-btn');
  if (checkoutBtn) {
    checkoutBtn.onclick = async () => {
      if (cart.length === 0) {
        showToast('Sua sacola está vazia!', 'warning', 2500);
        return;
      }

      checkoutBtn.disabled = true;
      const textoOriginal = checkoutBtn.innerHTML;
      checkoutBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...';

      try {
        subtotal = cart.reduce((s, i) => s + i.price, 0);

        // 1) Valida estoque
        if (typeof validarCarrinho === 'function') {
          await validarCarrinho();
          if (cart.length === 0) {
            showToast('Itens esgotados foram removidos.', 'error', 3000);
            return;
          }
          subtotal = cart.reduce((s, i) => s + i.price, 0);
        }

        // 2) Baixa estoque
        const baixa = await baixarEstoquePedido();
        if (!baixa.success) {
          const falhas = baixa.falhas || [];
          if (falhas.length > 0) {
            const msg = falhas.map(f =>
              `Produto #${f.id}: ${f.motivo === 'estoque_insuficiente'
                ? `só temos ${f.disponivel}, você pediu ${f.pedido}`
                : f.motivo}`
            ).join('\n');
            showToast(`⚠️ Estoque insuficiente:\n${msg}`, 'error', 5000);
            if (typeof carregarProdutos === 'function') carregarProdutos();
          } else {
            showToast(`❌ Erro ao reservar estoque: ${baixa.error || 'desconhecido'}`, 'error', 4000);
          }
          return;
        }

        // ✅ 2.5) Salva pedido no histórico
        await salvarPedidoSupabase();

        // 3) Abre WhatsApp
        const numero = String(window.__whatsappNumero || siteConfig.whatsapp || '5588999049636').replace(/\D/g, '');
        const msg = montarMensagemPedido();
        const url = `https://wa.me/${numero}?text=${encodeURIComponent(msg)}`;

        const win = window.open(url, '_blank');
        if (!win) window.location.href = url;

        // 4) Limpa carrinho
        setTimeout(() => {
          cart = [];
          updateCart();
          const modal = document.getElementById('cart-modal');
          if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
          }
          showToast('✅ Pedido enviado! Sacola limpa.', 'success', 3000);
          if (typeof carregarProdutos === 'function') carregarProdutos();
        }, 800);

      } catch (err) {
        console.error('❌ Erro no checkout:', err);
        showToast('Erro ao processar pedido. Tente novamente.', 'error', 4000);
      } finally {
        checkoutBtn.disabled = false;
        checkoutBtn.innerHTML = textoOriginal;
      }
    };
  }

  console.log('✅ Sistema inicializado');
});