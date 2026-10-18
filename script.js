import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, deleteDoc, doc, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Credenciais Reais do Firebase do Casal
const firebaseConfig = {
  apiKey: "AIzaSyC5G-Tr3kcntYm4wosc5n361pJ4VSWFqys",
  authDomain: "nosso-dinheiro-56ad7.firebaseapp.com",
  projectId: "nosso-dinheiro-56ad7",
  storageBucket: "nosso-dinheiro-56ad7.firebasestorage.app",
  messagingSenderId: "903996625427",
  appId: "1:903996625427:web:f097fcdc3cf8e1173ee5e6"
};

// Inicialização
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Referências da Interface
const secaoAuth = document.getElementById("secao-auth");
const appPrincipal = document.getElementById("app-principal");
const formAuth = document.getElementById("form-auth");
const authEmailInput = document.getElementById("auth-email");
const authSenhaInput = document.getElementById("auth-senha");
const authErroEl = document.getElementById("auth-erro");
const btnAuthSubmit = document.getElementById("btn-auth-submit");
const btnToggleAuth = document.getElementById("btn-toggle-auth");
const authSubtitulo = document.getElementById("auth-subtitulo");
const textoToggle = document.getElementById("texto-toggle");
const usuarioLogadoEmail = document.getElementById("usuario-logado-email");
const btnLogout = document.getElementById("btn-logout");

const form = document.getElementById("form-transacao");
const listaTransacoes = document.getElementById("lista-transacoes");

const totalEntradasEl = document.getElementById("total-entradas");
const totalDespesasEl = document.getElementById("total-despesas");
const saldoTotalEl = document.getElementById("saldo-total");
const totalInvestimentosEl = document.getElementById("total-investimentos");

const saldoRuteEl = document.getElementById("saldo-rute");
const saldoVandersonEl = document.getElementById("saldo-vanderson");
const faturaRuteEl = document.getElementById("fatura-rute");
const faturaVandersonEl = document.getElementById("fatura-vanderson");

const gastosMesValorEl = document.getElementById("gastos-mes-valor");
const gastosPagoValorEl = document.getElementById("gastos-pago-valor");
const gastosApagarValorEl = document.getElementById("gastos-apagar-valor");
const inputLimiteEl = document.getElementById("input-limite");
const textoLimitePercentualEl = document.getElementById("texto-limite-percentual");
const textoLimiteRestanteEl = document.getElementById("texto-limite-restante");
const barraPreenchimentoEl = document.getElementById("barra-preenchimento");
const valorGastoDiarioEl = document.getElementById("valor-gasto-diario");

let modoCadastro = false;
let unsubscribeFirestore = null;
let usuarioAtual = null;

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

function formatarMoeda(valor) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Alternar entre Login e Cadastro
btnToggleAuth.addEventListener("click", () => {
  modoCadastro = !modoCadastro;
  authErroEl.style.display = "none";
  if (modoCadastro) {
    authSubtitulo.textContent = "Crie uma nova conta para começar.";
    btnAuthSubmit.textContent = "Cadastrar";
    textoToggle.textContent = "Já possui uma conta?";
    btnToggleAuth.textContent = "Fazer Login";
  } else {
    authSubtitulo.textContent = "Entre com a sua conta para acessar o controle financeiro.";
    btnAuthSubmit.textContent = "Entrar";
    textoToggle.textContent = "Ainda não tem conta?";
    btnToggleAuth.textContent = "Cadastrar-se";
  }
});

// Lógica de Login / Cadastro
formAuth.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = authEmailInput.value;
  const senha = authSenhaInput.value;
  authErroEl.style.display = "none";

  try {
    if (modoCadastro) {
      await createUserWithEmailAndPassword(auth, email, senha);
    } else {
      await signInWithEmailAndPassword(auth, email, senha);
    }
  } catch (erro) {
    authErroEl.style.display = "block";
    if (erro.code === "auth/invalid-credential" || erro.code === "auth/wrong-password") {
      authErroEl.textContent = "E-mail ou senha incorretos.";
    } else if (erro.code === "auth/email-already-in-use") {
      authErroEl.textContent = "Este e-mail já está cadastrado.";
    } else if (erro.code === "auth/weak-password") {
      authErroEl.textContent = "A senha deve ter pelo menos 6 caracteres.";
    } else {
      authErroEl.textContent = "Erro de autenticação: " + erro.message;
    }
  }
});

// Logout
btnLogout.addEventListener("click", () => {
  signOut(auth);
});

// Monitorar Estado de Login
onAuthStateChanged(auth, (user) => {
  if (user) {
    usuarioAtual = user;
    secaoAuth.classList.add("esconde-app");
    appPrincipal.classList.remove("esconde-app");
    usuarioLogadoEmail.textContent = `Conectado como: ${user.email}`;

    carregarTransacoesDoUsuario(user.uid);
  } else {
    usuarioAtual = null;
    secaoAuth.classList.remove("esconde-app");
    appPrincipal.classList.add("esconde-app");
    if (unsubscribeFirestore) unsubscribeFirestore();
  }
});

// Carregar Dados Isolados por Usuário
function carregarTransacoesDoUsuario(userId) {
  const q = query(collection(db, "transacoes"), where("userId", "==", userId));

  unsubscribeFirestore = onSnapshot(q, (snapshot) => {
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
}

// Adicionar Transação com vínculo do Usuário (userId)
if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!usuarioAtual) return;

    const descricao = document.getElementById("descricao").value;
    const valor = parseFloat(document.getElementById("valor").value);
    const tipo = document.getElementById("tipo").value;
    const responsavel = document.getElementById("responsavel").value;
    const categoria = document.getElementById("categoria").value;
    const metodo = document.getElementById("metodo").value;
    const status = document.getElementById("status").value;

    try {
      await addDoc(collection(db, "transacoes"), {
        userId: usuarioAtual.uid,
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

      if (item.status === "Concluído") {
        gastosPago += v;
      } else {
        gastosApagar += v;
      }

      if (item.responsavel === "Rute") saldoRute -= v;
      if (item.responsavel === "Vanderson") saldoVanderson -= v;

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

  totalEntradasEl.textContent = formatarMoeda(entradas);
  totalDespesasEl.textContent = formatarMoeda(despesas);
  saldoTotalEl.textContent = formatarMoeda(saldoGeral);
  totalInvestimentosEl.textContent = formatarMoeda(investimentos);

  saldoRuteEl.textContent = formatarMoeda(saldoRute);
  saldoVandersonEl.textContent = formatarMoeda(saldoVanderson);
  faturaRuteEl.textContent = formatarMoeda(faturaRute);
  faturaVandersonEl.textContent = formatarMoeda(faturaVanderson);

  gastosMesValorEl.textContent = formatarMoeda(despesas);
  gastosPagoValorEl.textContent = formatarMoeda(gastosPago);
  gastosApagarValorEl.textContent = formatarMoeda(gastosApagar);

  const percentualUsado = Math.min(Math.round((despesas / limiteMensal) * 100), 100);
  textoLimitePercentualEl.textContent = `${percentualUsado}% do limite usado (Limite: ${formatarMoeda(limiteMensal)})`;

  barraPreenchimentoEl.style.width = `${percentualUsado}%`;
  if (percentualUsado >= 90) {
    barraPreenchimentoEl.classList.add("perigo");
  } else {
    barraPreenchimentoEl.classList.remove("perigo");
  }

  const quantoFalta = limiteMensal - despesas;
  if (quantoFalta >= 0) {
    textoLimiteRestanteEl.textContent = `Faltam ${formatarMoeda(quantoFalta)} para atingir o limite`;
  } else {
    textoLimiteRestanteEl.textContent = `Atenção: Limite ultrapassado em ${formatarMoeda(Math.abs(quantoFalta))}`;
  }

  const hoje = new Date();
  const ultimoDiaMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
  const diasRestantes = Math.max(ultimoDiaMes - hoje.getDate() + 1, 1);

  const saldoParaGastar = Math.max(quantoFalta, 0);
  const mediaDiaria = saldoParaGastar / diasRestantes;

  valorGastoDiarioEl.innerHTML = `${formatarMoeda(mediaDiaria)} <small>/dia (${diasRestantes} dias restantes)</small>`;
}