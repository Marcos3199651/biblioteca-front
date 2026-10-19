// Cliente da API de livros: uma única porta de entrada para todas as chamadas.
// Mesma origem (o Worker serve o front end e a API), então não precisa de CORS.

const BASE = "/api/livros";
const TEMPO_LIMITE_MS = 10_000;

export class ApiError extends Error {
  constructor(mensagem, status = 0) {
    super(mensagem);
    this.name = "ApiError";
    this.status = status;
  }
}

async function requisitar(caminho = "", { metodo = "GET", corpo, signal } = {}) {
  const controlador = new AbortController();
  const aoCancelar = () => controlador.abort();
  signal?.addEventListener("abort", aoCancelar, { once: true });
  const relogio = setTimeout(() => controlador.abort(), TEMPO_LIMITE_MS);

  try {
    let resposta;
    try {
      resposta = await fetch(BASE + caminho, {
        method: metodo,
        headers: corpo ? { "Content-Type": "application/json" } : undefined,
        body: corpo ? JSON.stringify(corpo) : undefined,
        signal: controlador.signal,
      });
    } catch (erro) {
      if (signal?.aborted) throw erro; // cancelado de propósito por quem chamou
      if (erro.name === "AbortError") {
        throw new ApiError("O servidor demorou demais para responder. Tente de novo.");
      }
      throw new ApiError("Sem conexão com o servidor. Verifique a internet e tente de novo.");
    }

    const ehJson = (resposta.headers.get("content-type") ?? "").includes("application/json");
    const dados = ehJson ? await resposta.json().catch(() => null) : null;

    if (!resposta.ok) {
      throw new ApiError(dados?.erro ?? "Algo deu errado. Tente de novo.", resposta.status);
    }
    return dados;
  } finally {
    clearTimeout(relogio);
    signal?.removeEventListener("abort", aoCancelar);
  }
}

export const listarLivros = (signal) => requisitar("", { signal });
export const criarLivro = (livro) => requisitar("", { metodo: "POST", corpo: livro });
export const atualizarLivro = (id, livro) =>
  requisitar(`/${encodeURIComponent(id)}`, { metodo: "PUT", corpo: livro });
export const excluirLivro = (id) =>
  requisitar(`/${encodeURIComponent(id)}`, { metodo: "DELETE" });
