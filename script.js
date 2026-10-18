import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Configuração do Firebase com as suas credenciais reais
const firebaseConfig = {
  apiKey: "SUA_API_KEY_REAL_AQUI",
  authDomain: "meu-controle-financeiro.firebaseapp.com",
  projectId: "meu-controle-financeiro",
  storageBucket: "meu-controle-financeiro.appspot.com",
  messagingSenderId: "SEU_MESSAGING_SENDER_ID",
  appId: "SEU_APP_ID"
};

// Inicializa Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Referências aos Elementos do DOM
const form = document.getElementById("form-transacao");
const listaTransacoes = document.getElementById("lista-transacoes");

// Elementos de Resumo Geral
const totalEntradasEl = document.getElementById("total-entradas");
const totalDespesasEl = document.getElementById("total-despesas");
const saldoTotalEl = document.getElementById("saldo-total");
const totalInvestimentosEl = document.getElementById("total-investimentos");

// Elementos Individuais
const saldoRuteEl = document.getElementById("saldo-rute");
const saldoVandersonEl = document.getElementById("saldo-vanderson");
const faturaRuteEl = document.getElementById("fatura-rute");
const faturaVandersonEl = document.getElementById("fatura-vanderson");

// Novos Elementos de Limite Mensal
const gastosMesValorEl = document.getElementById("gastos-mes-valor");
const gastosPagoValorEl = document.getElementById("gastos-pago-valor");
const gastosApagarValorEl = document.getElementById("gastos-apagar-valor");
const inputLimiteEl = document.getElementById("input-limite");
const textoLimitePercentualEl = document.getElementById("texto-limite-percentual");
const textoLimiteRestanteEl = document.getElementById("texto-limite-restante");
const barraPreenchimentoEl = document.getElementById("barra-preenchimento");
const valorGastoDiarioEl = document.getElementById("valor-gasto-diario");

// Carrega Limite Salvo no LocalStorage (ou usa 2800.00 padrão)
let limiteMensal = parseFloat(localStorage.getItem("limiteMensalCasal")) || 2800.00;
if (inputLimiteEl) {
  inputLimiteEl.value = limiteMensal.toFixed(2);
  inputLimiteEl.addEventListener("change", (e) => {
    const novoValor = parseFloat(e.target.value);
    if (!isNaN(novoValor) && novoValor > 0) {
      limiteMensal = novoValor;
      localStorage.setItem("limiteMensalCasal", limiteMensal);
      atualizarTotais(transacoesGlobais);
    }
  });
}

let transacoesGlobais = [];

// Formata Valor para R$
function formatarMoeda(valor) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Adicionar Transação
if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const descricao = document.getElementById("descricao").value;
    const valor = parseFloat(document.getElementById("valor").value);
    const tipo = document.getElementById("tipo").value;
    const responsavel = document.getElementById("responsavel").value;
    const categoria = document.getElementById("categoria").value;
    const metodo = document.getElementById("metodo").value;
    const status = document.getElementById("status").value;

    try {
      await addDoc(collection(db, "transacoes"), {
        descricao,
        valor,
        tipo,
        responsavel,
        categoria,
        metodo,
        status,
        data: new Date()
      });
      form.reset();
    } catch (erro) {
      console.error("Erro ao adicionar transação: ", erro);
    }
  });
}

// Ler Transações em Tempo Real
onSnapshot(collection(db, "transacoes"), (snapshot) => {
  transacoesGlobais = [];
  listaTransacoes.innerHTML = "";

  snapshot.forEach((docSnapshot) => {
    const item = docSnapshot.data();
    item.id = docSnapshot.id;
    transacoesGlobais.push(item);
    exibirTransacao(item);
  });

  atualizarTotais(transacoesGlobais);
});

// Exibir Transação na Lista
function exibirTransacao(item) {
  const li = document.createElement("li");
  li.className = `item-transacao ${item.tipo}`;

  const iconeStatus = item.status === "Concluído" ? "✅" : "⏳";
  const sinal = item.tipo === "despesa" ? "-" : "+";

  li.innerHTML = `
    <div>
      <strong>${item.descricao}</strong>
      <small>${item.categoria} • ${item.metodo} • 👤 ${item.responsavel} ${iconeStatus} ${item.status}</small>
    </div>
    <div>
      <span class="valor ${item.tipo === "despesa" ? "negativo" : "positivo"}">
        ${sinal} ${formatarMoeda(item.valor)}
      </span>
      <button class="btn-deletar" data-id="${item.id}" style="border:none; background:none; cursor:pointer; margin-left:10px;">🗑️</button>
    </div>
  `;

  listaTransacoes.prepend(li);

  li.querySelector(".btn-deletar").addEventListener("click", async (e) => {
    const id = e.target.getAttribute("data-id");
    await deleteDoc(doc(db, "transacoes", id));
  });
}

// Atualizar Todos os Totais do Painel
function atualizarTotais(transacoes) {
  let entradas = 0;
  let despesas = 0;
  let investimentos = 0;

  let saldoRute = 0;
  let saldoVanderson = 0;
  let faturaRute = 0;
  let faturaVanderson = 0;

  let gastosPago = 0;
  let gastosApagar = 0;

  transacoes.forEach((item) => {
    const v = item.valor;

    if (item.tipo === "entrada") {
      entradas += v;
      if (item.responsavel === "Rute") saldoRute += v;
      if (item.responsavel === "Vanderson") saldoVanderson += v;
    } else if (item.tipo === "despesa") {
      despesas += v;

      // Classifica Pago vs A Pagar
      if (item.status === "Concluído") {
        gastosPago += v;
      } else {
        gastosApagar += v;
      }

      // Saldos Individuais
      if (item.responsavel === "Rute") saldoRute -= v;
      if (item.responsavel === "Vanderson") saldoVanderson -= v;

      // Faturas de Cartão de Crédito
      if (item.metodo === "Cartão de Crédito") {
        if (item.responsavel === "Rute") faturaRute += v;
        if (item.responsavel === "Vanderson") faturaVanderson += v;
      }
    } else if (item.tipo === "investimento") {
      investimentos += v;
      if (item.responsavel === "Rute") saldoRute -= v;
      if (item.responsavel === "Vanderson") saldoVanderson -= v;
    }
  });

  const saldoGeral = entradas - despesas - investimentos;

  // Atualiza Valores Gerais
  totalEntradasEl.textContent = formatarMoeda(entradas);
  totalDespesasEl.textContent = formatarMoeda(despesas);
  saldoTotalEl.textContent = formatarMoeda(saldoGeral);
  totalInvestimentosEl.textContent = formatarMoeda(investimentos);

  // Atualiza Saldos Individuais e Faturas
  saldoRuteEl.textContent = formatarMoeda(saldoRute);
  saldoVandersonEl.textContent = formatarMoeda(saldoVanderson);
  faturaRuteEl.textContent = formatarMoeda(faturaRute);
  faturaVandersonEl.textContent = formatarMoeda(faturaVanderson);

  // NOVO PAINEL DE GASTOS E LIMITE MENSAL
  gastosMesValorEl.textContent = formatarMoeda(despesas);
  gastosPagoValorEl.textContent = formatarMoeda(gastosPago);
  gastosApagarValorEl.textContent = formatarMoeda(gastosApagar);

  // Cálculo da Porcentagem e Barra de Progresso
  const percentualUsado = Math.min(Math.round((despesas / limiteMensal) * 100), 100);
  textoLimitePercentualEl.textContent = `${percentualUsado}% do limite usado (Limite: ${formatarMoeda(limiteMensal)})`;

  barraPreenchimentoEl.style.width = `${percentualUsado}%`;
  if (percentualUsado >= 90) {
    barraPreenchimentoEl.classList.add("perigo");
  } else {
    barraPreenchimentoEl.classList.remove("perigo");
  }

  // Quanto falta para o limite
  const quantoFalta = limiteMensal - despesas;
  if (quantoFalta >= 0) {
    textoLimiteRestanteEl.textContent = `Faltam ${formatarMoeda(quantoFalta)} para atingir o limite`;
  } else {
    textoLimiteRestanteEl.textContent = `Atenção: Limite ultrapassado em ${formatarMoeda(Math.abs(quantoFalta))}`;
  }

  // Cálculo de Média Diária Restante até ao fim do mês
  const hoje = new Date();
  const ultimoDiaMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
  const diasRestantes = Math.max(ultimoDiaMes - hoje.getDate() + 1, 1);

  const saldoParaGastar = Math.max(quantoFalta, 0);
  const mediaDiaria = saldoParaGastar / diasRestantes;

  valorGastoDiarioEl.innerHTML = `${formatarMoeda(mediaDiaria)} <small>/dia (${diasRestantes} dias restantes)</small>`;
}