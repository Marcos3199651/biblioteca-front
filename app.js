import {
  ApiError,
  atualizarLivro,
  criarLivro,
  excluirLivro,
  listarLivros,
} from "./api.js";

/* ---------- Elementos ---------- */

const $ = (seletor) => document.querySelector(seletor);

const el = {
  principal: $("#conteudo"),
  lista: $("#lista"),
  modelo: $("#modelo-livro"),
  contagem: $("#contagem"),
  busca: $("#busca"),
  ordem: $("#ordem"),
  formBusca: $("#form-busca"),
  novo: $("#btn-novo"),
  vazio: $("#vazio"),
  vazioTitulo: $("#vazio-titulo"),
  vazioTexto: $("#vazio-texto"),
  vazioAcao: $("#vazio-acao"),
  erro: $("#erro"),
  erroMsg: $("#erro-msg"),
  tentar: $("#btn-tentar"),
  dlgForm: $("#dlg-form"),
  form: $("#form-livro"),
  formTitulo: $("#dlg-form-titulo"),
  formErro: $("#form-erro"),
  btnSalvar: $("#btn-salvar"),
  campos: {
    titulo: { entrada: $("#f-titulo"), erro: $("#e-titulo") },
    autor: { entrada: $("#f-autor"), erro: $("#e-autor") },
    ano: { entrada: $("#f-ano"), erro: $("#e-ano") },
  },
  dlgExcluir: $("#dlg-excluir"),
  excluirTexto: $("#dlg-excluir-texto"),
  btnConfirmarExcluir: $("#btn-confirmar-excluir"),
  avisos: $("#avisos"),
};

/* ---------- Estado ---------- */

const estado = {
  livros: [],
  busca: "",
  ordem: "titulo",
  carregando: true,
  erro: null,
  editando: null, // livro em edição (null = novo)
  excluindo: null, // livro aguardando confirmação
  salvando: false,
};

let controladorCarga = null;

/* ---------- Utilidades ---------- */

const colador = new Intl.Collator("pt-BR", { sensitivity: "base" });
const anoMaximo = new Date().getFullYear() + 1;

const normalizar = (texto) =>
  texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

const ordenadores = {
  titulo: (a, b) => colador.compare(a.titulo, b.titulo),
  autor: (a, b) => colador.compare(a.autor, b.autor),
  ano: (a, b) => (b.ano ?? 0) - (a.ano ?? 0),
  recentes: (a, b) => b.id - a.id,
};

function livrosVisiveis() {
  const termo = normalizar(estado.busca.trim());
  const filtrados = termo
    ? estado.livros.filter((l) =>
        normalizar(`${l.titulo} ${l.autor} ${l.ano ?? ""}`).includes(termo),
      )
    : [...estado.livros];
  return filtrados.sort(ordenadores[estado.ordem]);
}

function debounce(fn, atraso = 150) {
  let id;
  return (...args) => {
    clearTimeout(id);
    id = setTimeout(() => fn(...args), atraso);
  };
}

function plural(n, singular, pluralTxt) {
  return `${n} ${n === 1 ? singular : pluralTxt}`;
}

/* ---------- Avisos temporários ---------- */

function avisar(mensagem, { erro = false } = {}) {
  const item = document.createElement("p");
  item.className = "aviso-toast" + (erro ? " aviso-toast--erro" : "");
  item.textContent = mensagem;
  el.avisos.append(item);
  setTimeout(() => item.remove(), erro ? 6000 : 4000);
}

/* ---------- Renderização ---------- */

function criarEsqueletos(qtd = 4) {
  const fragmento = document.createDocumentFragment();
  for (let i = 0; i < qtd; i++) {
    const li = document.createElement("li");
    li.className = "livro livro--esqueleto";
    li.setAttribute("aria-hidden", "true");
    fragmento.append(li);
  }
  return fragmento;
}

function criarItem(livro) {
  const item = el.modelo.content.firstElementChild.cloneNode(true);
  item.dataset.id = livro.id;
  item.style.setProperty("--lombada", `var(--lombada-${Number(livro.id) % 6})`);

  item.querySelector(".livro__titulo").textContent = livro.titulo;
  item.querySelector(".livro__autor").textContent = livro.autor;

  const ano = item.querySelector(".livro__ano");
  if (livro.ano) ano.textContent = `Publicado em ${livro.ano}`;
  else ano.remove();

  const editar = item.querySelector('[data-acao="editar"]');
  const excluir = item.querySelector('[data-acao="excluir"]');
  editar.setAttribute("aria-label", `Editar ${livro.titulo}`);
  excluir.setAttribute("aria-label", `Excluir ${livro.titulo}`);
  return item;
}

function mostrarVazio({ titulo, texto, acao, aoClicar }) {
  el.vazioTitulo.textContent = titulo;
  el.vazioTexto.textContent = texto;
  el.vazioAcao.textContent = acao;
  el.vazioAcao.onclick = aoClicar;
  el.vazio.hidden = false;
}

function render() {
  el.lista.replaceChildren();
  el.vazio.hidden = true;
  el.erro.hidden = true;
  el.lista.setAttribute("aria-busy", String(estado.carregando));

  if (estado.carregando) {
    el.contagem.textContent = "Carregando livros…";
    el.lista.append(criarEsqueletos());
    return;
  }

  if (estado.erro) {
    el.contagem.textContent = "";
    el.erroMsg.textContent = estado.erro;
    el.erro.hidden = false;
    return;
  }

  const visiveis = livrosVisiveis();

  if (estado.livros.length === 0) {
    el.contagem.textContent = "";
    mostrarVazio({
      titulo: "Nenhum livro cadastrado",
      texto: "Cadastre o primeiro livro para começar o acervo.",
      acao: "Cadastrar primeiro livro",
      aoClicar: () => abrirFormulario(),
    });
    return;
  }

  if (visiveis.length === 0) {
    el.contagem.textContent = "Nenhum resultado.";
    mostrarVazio({
      titulo: "Nenhum livro encontrado",
      texto: `Nada corresponde a “${estado.busca.trim()}”. Confira a escrita ou busque por outro termo.`,
      acao: "Limpar busca",
      aoClicar: () => {
        el.busca.value = "";
        estado.busca = "";
        render();
        el.busca.focus();
      },
    });
    return;
  }

  const total = estado.livros.length;
  el.contagem.textContent =
    visiveis.length === total
      ? plural(total, "livro", "livros")
      : `${visiveis.length} de ${plural(total, "livro", "livros")}`;

  const fragmento = document.createDocumentFragment();
  visiveis.forEach((livro) => fragmento.append(criarItem(livro)));
  el.lista.append(fragmento);
}

/* ---------- Carregamento ---------- */

async function carregar() {
  controladorCarga?.abort();
  controladorCarga = new AbortController();

  estado.carregando = true;
  estado.erro = null;
  render();

  try {
    estado.livros = await listarLivros(controladorCarga.signal);
  } catch (erro) {
    if (erro.name === "AbortError") return; // uma carga mais nova assumiu
    estado.erro =
      erro instanceof ApiError ? erro.message : "Erro inesperado. Tente de novo.";
  }
  estado.carregando = false;
  render();
}

/* ---------- Formulário de cadastro/edição ---------- */

function limparErros() {
  el.formErro.hidden = true;
  el.formErro.textContent = "";
  for (const { entrada, erro } of Object.values(el.campos)) {
    entrada.removeAttribute("aria-invalid");
    erro.hidden = true;
    erro.textContent = "";
  }
}

function mostrarErroCampo(nome, mensagem) {
  const { entrada, erro } = el.campos[nome];
  entrada.setAttribute("aria-invalid", "true");
  erro.textContent = mensagem;
  erro.hidden = false;
}

function abrirFormulario(livro = null) {
  estado.editando = livro;
  el.form.reset();
  limparErros();

  el.formTitulo.textContent = livro ? "Editar livro" : "Novo livro";
  el.btnSalvar.textContent = livro ? "Salvar alterações" : "Cadastrar livro";

  if (livro) {
    el.campos.titulo.entrada.value = livro.titulo;
    el.campos.autor.entrada.value = livro.autor;
    el.campos.ano.entrada.value = livro.ano ?? "";
  }

  el.dlgForm.showModal();
  el.campos.titulo.entrada.focus();
}

function validar() {
  const titulo = el.campos.titulo.entrada.value.trim();
  const autor = el.campos.autor.entrada.value.trim();
  const anoTexto = el.campos.ano.entrada.value.trim();
  const erros = {};
  let ano = null;

  if (!titulo) erros.titulo = "Informe o título do livro.";
  if (!autor) erros.autor = "Informe o nome do autor.";

  if (anoTexto !== "") {
    ano = Number(anoTexto);
    if (!Number.isInteger(ano) || ano < 1 || ano > anoMaximo) {
      erros.ano = `Informe um ano inteiro entre 1 e ${anoMaximo}.`;
    }
  }

  return { erros, valores: { titulo, autor, ano } };
}

async function salvar(evento) {
  evento.preventDefault();
  if (estado.salvando) return;

  limparErros();
  const { erros, valores } = validar();
  const camposComErro = Object.keys(erros);

  if (camposComErro.length) {
    camposComErro.forEach((nome) => mostrarErroCampo(nome, erros[nome]));
    el.campos[camposComErro[0]].entrada.focus();
    return;
  }

  const editando = estado.editando;
  estado.salvando = true;
  el.btnSalvar.disabled = true;
  el.btnSalvar.textContent = "Salvando…";

  try {
    if (editando) {
      const atualizado = await atualizarLivro(editando.id, valores);
      estado.livros = estado.livros.map((l) => (l.id === atualizado.id ? atualizado : l));
      avisar("Alterações salvas.");
    } else {
      const criado = await criarLivro(valores);
      estado.livros = [...estado.livros, criado];
      avisar("Livro cadastrado.");
    }
    el.dlgForm.close();
    render();
  } catch (erro) {
    el.formErro.textContent =
      erro instanceof ApiError ? erro.message : "Erro inesperado. Tente de novo.";
    el.formErro.hidden = false;
  } finally {
    estado.salvando = false;
    el.btnSalvar.disabled = false;
    el.btnSalvar.textContent = editando ? "Salvar alterações" : "Cadastrar livro";
  }
}

/* ---------- Exclusão ---------- */

function pedirConfirmacao(livro) {
  estado.excluindo = livro;
  el.excluirTexto.textContent = `“${livro.titulo}”, de ${livro.autor}, será removido do acervo. Essa ação não pode ser desfeita.`;
  el.dlgExcluir.showModal();
}

async function confirmarExclusao() {
  const livro = estado.excluindo;
  if (!livro || el.btnConfirmarExcluir.disabled) return;

  el.btnConfirmarExcluir.disabled = true;
  el.btnConfirmarExcluir.textContent = "Excluindo…";

  try {
    await excluirLivro(livro.id);
    estado.livros = estado.livros.filter((l) => l.id !== livro.id);
    el.dlgExcluir.close();
    render();
    avisar("Livro excluído.");
    el.busca.focus();
  } catch (erro) {
    el.dlgExcluir.close();
    // 404: o livro já não existe no servidor, então sincroniza a lista.
    if (erro instanceof ApiError && erro.status === 404) {
      estado.livros = estado.livros.filter((l) => l.id !== livro.id);
      render();
    }
    avisar(erro instanceof ApiError ? erro.message : "Erro inesperado.", { erro: true });
  } finally {
    el.btnConfirmarExcluir.disabled = false;
    el.btnConfirmarExcluir.textContent = "Excluir livro";
    estado.excluindo = null;
  }
}

/* ---------- Eventos ---------- */

el.novo.addEventListener("click", () => abrirFormulario());
el.tentar.addEventListener("click", carregar);
el.form.addEventListener("submit", salvar);
el.btnConfirmarExcluir.addEventListener("click", confirmarExclusao);

// Busca com atraso curto; ordenar é imediato.
const aplicarBusca = debounce(() => {
  estado.busca = el.busca.value;
  render();
});
el.busca.addEventListener("input", aplicarBusca);
el.ordem.addEventListener("change", () => {
  estado.ordem = el.ordem.value;
  render();
});
el.formBusca.addEventListener("submit", (e) => e.preventDefault());

// Ações dos itens (delegação de eventos: um único listener para a lista).
el.lista.addEventListener("click", (evento) => {
  const botao = evento.target.closest("button[data-acao]");
  if (!botao) return;
  const id = Number(botao.closest(".livro").dataset.id);
  const livro = estado.livros.find((l) => l.id === id);
  if (!livro) return;
  if (botao.dataset.acao === "editar") abrirFormulario(livro);
  else pedirConfirmacao(livro);
});

// Diálogos: botões "Cancelar" e clique no fundo escurecido fecham.
for (const dialogo of [el.dlgForm, el.dlgExcluir]) {
  dialogo.addEventListener("click", (evento) => {
    if (evento.target === dialogo || evento.target.closest("[data-fechar]")) {
      dialogo.close();
    }
  });
}

carregar();
