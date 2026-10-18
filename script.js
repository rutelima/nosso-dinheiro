import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, deleteDoc, doc, query, where, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
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

// Referências de Configuração de Nomes
const btnToggleConfig = document.getElementById("btn-toggle-config");
const formConfigPerfis = document.getElementById("form-config-perfis");
const selectModoUso = document.getElementById("modo-uso");
const inputNomePerfil1 = document.getElementById("nome-perfil-1");
const inputNomePerfil2 = document.getElementById("nome-perfil-2");
const containerPerfil2 = document.getElementById("container-perfil-2");
const selectResponsavel = document.getElementById("responsavel");

// Elementos de Saldos Individuais / Faturas
const tituloSaldo1 = document.getElementById("titulo-saldo-1");
const tituloSaldo2 = document.getElementById("titulo-saldo-2");
const saldoPerfil1El = document.getElementById("saldo-perfil-1");
const saldoPerfil2El = document.getElementById("saldo-perfil-2");
const cardSaldo2 = document.getElementById("card-saldo-2");

const tituloFatura1 = document.getElementById("titulo-fatura-1");
const tituloFatura2 = document.getElementById("titulo-fatura-2");
const faturaPerfil1El = document.getElementById("fatura-perfil-1");
const faturaPerfil2El = document.getElementById("fatura-perfil-2");
const cardFatura2 = document.getElementById("card-fatura-2");

// Elementos de Painel Geral
const form = document.getElementById("form-transacao");
const listaTransacoes = document.getElementById("lista-transacoes");

const totalEntradasEl = document.getElementById("total-entradas");
const totalDespesasEl = document.getElementById("total-despesas");
const saldoTotalEl = document.getElementById("saldo-total");
const totalInvestimentosEl = document.getElementById("total-investimentos");

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
let transacoesGlobais = [];

// E-mail principal do casal que herda o histórico antigo
const EMAIL_CASAL_PRINCIPAL = "rutecunhalima@icloud.com";

// Configuração de Nomes e Perfis Padrão
let configPerfil = {
  modo: "dupla",
  nome1: "Rute",
  nome2: "Vanderson"
};

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

function formatarMoeda(valor) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Toggle do Menu de Configuração de Nomes
btnToggleConfig.addEventListener("click", () => {
  formConfigPerfis.classList.toggle("esconde-config");
});

selectModoUso.addEventListener("change", (e) => {
  if (e.target.value === "individual") {
    containerPerfil2.style.display = "none";
  } else {
    containerPerfil2.style.display = "flex";
  }
});

// Salvar Configurações de Nome no Firestore por Usuário
formConfigPerfis.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!usuarioAtual) return;

  configPerfil = {
    modo: selectModoUso.value,
    nome1: inputNomePerfil1.value.trim() || "Integrante 1",
    nome2: selectModoUso.value === "individual" ? "" : (inputNomePerfil2.value.trim() || "Integrante 2")
  };

  try {
    await setDoc(doc(db, "configuracoes_usuario", usuarioAtual.uid), configPerfil);
    aplicarConfiguracaoPerfil();
    atualizarTotais(transacoesGlobais);
    formConfigPerfis.classList.add("esconde-config");
  } catch (err) {
    console.error("Erro ao salvar perfil:", err);
  }
});

// Aplicar nomes na Interface e no Select do Formulário
function aplicarConfiguracaoPerfil() {
  selectModoUso.value = configPerfil.modo;
  inputNomePerfil1.value = configPerfil.nome1;
  inputNomePerfil2.value = configPerfil.nome2 || "";

  selectResponsavel.innerHTML = "";
  const opt1 = document.createElement("option");
  opt1.value = configPerfil.nome1;
  opt1.textContent = `👤 ${configPerfil.nome1}`;
  selectResponsavel.appendChild(opt1);

  if (configPerfil.modo === "dupla" && configPerfil.nome2) {
    const opt2 = document.createElement("option");
    opt2.value = configPerfil.nome2;
    opt2.textContent = `👤 ${configPerfil.nome2}`;
    selectResponsavel.appendChild(opt2);

    containerPerfil2.style.display = "flex";
    cardSaldo2.style.display = "block";
    cardFatura2.style.display = "block";
  } else {
    containerPerfil2.style.display = "none";
    cardSaldo2.style.display = "none";
    cardFatura2.style.display = "none";
  }

  tituloSaldo1.textContent = `Saldo ${configPerfil.nome1}`;
  tituloFatura1.textContent = `💳 Fatura ${configPerfil.nome1}`;

  if (configPerfil.nome2) {
    tituloSaldo2.textContent = `Saldo ${configPerfil.nome2}`;
    tituloFatura2.textContent = `💳 Fatura ${configPerfil.nome2}`;
  }
}

// Toggle de Login / Cadastro
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

// Submit de Login/Cadastro
formAuth.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = authEmailInput.value.trim();
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
      authErroEl.textContent = "Este e-mail já está cadastrado. Clique em 'Fazer Login'.";
    } else if (erro.code === "auth/weak-password") {
      authErroEl.textContent = "A senha deve ter pelo menos 6 caracteres.";
    } else {
      authErroEl.textContent = "Erro de autenticação: " + erro.message;
    }
  }
});

btnLogout.addEventListener("click", () => {
  signOut(auth);
});

// Monitora Autenticação
onAuthStateChanged(auth, async (user) => {
  if (user) {
    usuarioAtual = user;
    secaoAuth.classList.add("esconde-app");
    appPrincipal.classList.remove("esconde-app");
    usuarioLogadoEmail.textContent = `Conectado como: ${user.email}`;

    // Carrega Configurações do Usuário
    const docRef = doc(db, "configuracoes_usuario", user.uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      configPerfil = docSnap.data();
    } else {
      configPerfil = { modo: "dupla", nome1: "Rute", nome2: "Vanderson" };
    }
    aplicarConfiguracaoPerfil();

    carregarTransacoesDoUsuario(user);
  } else {
    usuarioAtual = null;
    secaoAuth.classList.remove("esconde-app");
    appPrincipal.classList.add("esconde-app");
    if (unsubscribeFirestore) unsubscribeFirestore();
  }
});

// Carregar Dados Isolados (e herdar histórico antigo se for o e-mail do casal)
function carregarTransacoesDoUsuario(user) {
  const isCasalPrincipal = user.email.toLowerCase() === EMAIL_CASAL_PRINCIPAL.toLowerCase();

  unsubscribeFirestore = onSnapshot(collection(db, "transacoes"), (snapshot) => {
    transacoesGlobais = [];
    listaTransacoes.innerHTML = "";

    snapshot.forEach((docSnapshot) => {
      const item = docSnapshot.data();
      item.id = docSnapshot.id;

      const pertenceAoUsuario = item.userId === user.uid;
      const ehHistoricoAntigoSemUserId = isCasalPrincipal && !item.userId;

      if (pertenceAoUsuario || ehHistoricoAntigoSemUserId) {
        transacoesGlobais.push(item);
        exibirTransacao(item);
      }
    });

    atualizarTotais(transacoesGlobais);
  });
}

// Adicionar Transação
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
  let despesasGerais = 0;
  let investimentos = 0;

  let despesasPerfil1 = 0;
  let despesasPerfil2 = 0;

  let saldoPerfil1 = 0;
  let saldoPerfil2 = 0;
  let faturaPerfil1 = 0;
  let faturaPerfil2 = 0;

  let gastosPagoPerfil1 = 0;
  let gastosApagarPerfil1 = 0;

  transacoes.forEach((item) => {
    const v = item.valor;

    if (item.tipo === "entrada") {
      entradas += v;
      if (item.responsavel === configPerfil.nome1) saldoPerfil1 += v;
      if (item.responsavel === configPerfil.nome2) saldoPerfil2 += v;
    } else if (item.tipo === "despesa") {
      despesasGerais += v;

      if (item.responsavel === configPerfil.nome1) {
        despesasPerfil1 += v;
        saldoPerfil1 -= v;

        if (item.status === "Concluído") {
          gastosPagoPerfil1 += v;
        } else {
          gastosApagarPerfil1 += v;
        }

        if (item.metodo === "Cartão de Crédito") {
          faturaPerfil1 += v;
        }
      } else if (item.responsavel === configPerfil.nome2) {
        despesasPerfil2 += v;
        saldoPerfil2 -= v;

        if (item.metodo === "Cartão de Crédito") {
          faturaPerfil2 += v;
        }
      }
    } else if (item.tipo === "investimento") {
      investimentos += v;
      if (item.responsavel === configPerfil.nome1) saldoPerfil1 -= v;
      if (item.responsavel === configPerfil.nome2) saldoPerfil2 -= v;
    }
  });

  const saldoGeral = entradas - despesasGerais - investimentos;

  // Atualização dos Cards Inferiores
  totalEntradasEl.textContent = formatarMoeda(entradas);
  totalDespesasEl.textContent = formatarMoeda(despesasGerais);
  saldoTotalEl.textContent = formatarMoeda(saldoGeral);
  totalInvestimentosEl.textContent = formatarMoeda(investimentos);

  saldoPerfil1El.textContent = formatarMoeda(saldoPerfil1);
  saldoPerfil2El.textContent = formatarMoeda(saldoPerfil2);
  faturaPerfil1El.textContent = formatarMoeda(faturaPerfil1);
  faturaPerfil2El.textContent = formatarMoeda(faturaPerfil2);

  // PAINEL ROXO: Filtra unicamente os gastos do Perfil 1 (Rute)
  gastosMesValorEl.textContent = formatarMoeda(despesasPerfil1);
  gastosPagoValorEl.textContent = formatarMoeda(gastosPagoPerfil1);
  gastosApagarValorEl.textContent = formatarMoeda(gastosApagarPerfil1);

  const percentualUsado = Math.min(Math.round((despesasPerfil1 / limiteMensal) * 100), 100);
  textoLimitePercentualEl.textContent = `${percentualUsado}% do limite usado (Limite: ${formatarMoeda(limiteMensal)})`;

  barraPreenchimentoEl.style.width = `${percentualUsado}%`;
  if (percentualUsado >= 90) {
    barraPreenchimentoEl.classList.add("perigo");
  } else {
    barraPreenchimentoEl.classList.remove("perigo");
  }

  const quantoFalta = limiteMensal - despesasPerfil1;
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