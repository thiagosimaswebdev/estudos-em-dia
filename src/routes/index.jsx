import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { scheduleSms, cancelSms } from "@/lib/sms.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Meu Organizador de Estudos" },
      { name: "description", content: "Organize suas tarefas acadêmicas com listas, prioridades e lembretes." },
      { property: "og:title", content: "Meu Organizador de Estudos" },
      { property: "og:description", content: "Organize suas tarefas acadêmicas com listas, prioridades e lembretes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

const PRIORIDADES = [
  { valor: "alta", rotulo: "Alta", classe: "bg-priority-high/15 text-priority-high border-priority-high/40" },
  { valor: "media", rotulo: "Média", classe: "bg-priority-medium/15 text-priority-medium border-priority-medium/40" },
  { valor: "baixa", rotulo: "Baixa", classe: "bg-priority-low/15 text-priority-low border-priority-low/40" },
];
const BARRA = { alta: "bg-priority-high", media: "bg-priority-medium", baixa: "bg-priority-low" };
const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const fmt = (iso) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const mesmoDia = (a, b) => a.toDateString() === b.toDateString();

function Index() {
  const [tarefas, setTarefas] = useState([]);
  const [listas, setListas] = useState(["Geral"]);
  const [telefone, setTelefone] = useState("");
  const [carregado, setCarregado] = useState(false);
  const [tema, setTema] = useState("escuro");

  const [texto, setTexto] = useState("");
  const [prioridade, setPrioridade] = useState("media");
  const [agenda, setAgenda] = useState("");
  const [lembrete, setLembrete] = useState(false);
  const [listaAtiva, setListaAtiva] = useState("Geral");
  const [novaLista, setNovaLista] = useState("");
  const [diaFiltro, setDiaFiltro] = useState(null);
  const [aviso, setAviso] = useState("");

  const [editandoId, setEditandoId] = useState(null);
  const [textoEdicao, setTextoEdicao] = useState("");

  useEffect(() => {
    try {
      const d = JSON.parse(localStorage.getItem("organizador") || "{}");
      if (d.tarefas) setTarefas(d.tarefas);
      if (d.listas?.length) setListas(d.listas);
      if (d.telefone) setTelefone(d.telefone);
      if (d.tema === "claro" || d.tema === "escuro") setTema(d.tema);
    } catch {}
    setCarregado(true);
  }, []);
  useEffect(() => {
    if (carregado)
      localStorage.setItem(
        "organizador",
        JSON.stringify({ tarefas, listas, telefone, tema }),
      );
  }, [tarefas, listas, telefone, tema, carregado]);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", tema === "escuro");
  }, [tema]);

  const semana = useMemo(() => {
    const hoje = new Date();
    const inicio = new Date(hoje);
    inicio.setDate(hoje.getDate() - hoje.getDay());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(inicio);
      d.setDate(inicio.getDate() + i);
      return d;
    });
  }, []);

  const adicionar = async (e) => {
    e.preventDefault();
    const t = texto.trim();
    if (!t) return;
    setAviso("");
    const nova = {
      id: Date.now(),
      texto: t,
      concluida: false,
      criadaEm: new Date().toISOString(),
      agendadaPara: agenda ? new Date(agenda).toISOString() : undefined,
      prioridade,
      lista: listaAtiva,
    };
    if (lembrete && nova.agendadaPara) {
      try {
        const envio = new Date(new Date(nova.agendadaPara).getTime() - 30 * 60000).toISOString();
        const r = await scheduleSms({
          data: { to: telefone.trim(), body: `Lembrete: "${t}" começa em 30 minutos (${fmt(nova.agendadaPara)}).`, sendAt: envio },
        });
        nova.smsSid = r.sid;
        nova.smsStatus = r.status;
        if (r.status === "past") setAviso("O horário do lembrete já passou; SMS não enviado.");
        if (r.status === "sent") setAviso("Faltam menos de 30 minutos: o SMS foi enviado agora.");
      } catch (err) {
        setAviso(err instanceof Error ? err.message : "Não foi possível agendar o SMS.");
      }
    }
    setTarefas((prev) => [...prev, nova]);
    setTexto("");
    setAgenda("");
    setLembrete(false);
  };

  const alternar = (id) =>
    setTarefas((prev) => prev.map((t) => (t.id === id ? { ...t, concluida: !t.concluida } : t)));
  const excluir = (id) => {
    const t = tarefas.find((x) => x.id === id);
    if (t?.smsSid && t.smsStatus === "scheduled") cancelSms({ data: { sid: t.smsSid } }).catch(() => {});
    if (editandoId === id) cancelarEdicao();
    setTarefas((prev) => prev.filter((x) => x.id !== id));
  };

  const iniciarEdicao = (t) => {
    setEditandoId(t.id);
    setTextoEdicao(t.texto);
  };
  const cancelarEdicao = () => {
    setEditandoId(null);
    setTextoEdicao("");
  };
  const salvarEdicao = (id) => {
    const t = textoEdicao.trim();
    if (!t) return;
    setTarefas((prev) => prev.map((x) => (x.id === id ? { ...x, texto: t } : x)));
    cancelarEdicao();
  };

  const criarLista = (e) => {
    e.preventDefault();
    const n = novaLista.trim();
    if (!n || listas.includes(n)) return;
    setListas([...listas, n]);
    setListaAtiva(n);
    setNovaLista("");
  };
  const excluirLista = (n) => {
    setListas(listas.filter((l) => l !== n));
    setTarefas((prev) => prev.filter((t) => t.lista !== n));
    setListaAtiva("Geral");
  };

  const ordem = { alta: 0, media: 1, baixa: 2 };
  const visiveis = tarefas
    .filter((t) => t.lista === listaAtiva)
    .filter((t) => !diaFiltro || (t.agendadaPara && mesmoDia(new Date(t.agendadaPara), new Date(diaFiltro))))
    .sort((a, b) => Number(a.concluida) - Number(b.concluida) || ordem[a.prioridade] - ordem[b.prioridade]);
  const concluidas = tarefas.filter((t) => t.concluida).length;
  const hoje = new Date();

  return (
    <main className="min-h-screen bg-tech-grid px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="relative text-center">
          <button
            onClick={() => setTema(tema === "escuro" ? "claro" : "escuro")}
            aria-label={tema === "escuro" ? "Ativar modo claro" : "Ativar modo escuro"}
            className="absolute right-0 top-0 rounded-full border border-border bg-secondary/60 px-3 py-2 text-sm text-foreground transition-colors hover:border-primary/60 hover:text-primary sm:px-4"
          >
            {tema === "escuro" ? "☀ Modo claro" : "☾ Modo escuro"}
          </button>
          <p className="text-xs uppercase tracking-[0.3em] text-primary">// painel de estudos</p>
          <h1 className="mt-2 bg-gradient-tech bg-clip-text text-3xl font-bold text-transparent sm:text-5xl">
            Meu Organizador de Estudos
          </h1>
          <p className="mt-2 text-muted-foreground">
            Olá! Seja bem-vindo(a). Vamos organizar suas tarefas e estudar com tranquilidade.
          </p>
        </header>

        <section className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Stat rotulo="Tarefas cadastradas" valor={tarefas.length} />
          <Stat rotulo="Tarefas concluídas" valor={concluidas} />
          <Stat rotulo="Pendentes" valor={tarefas.length - concluidas} className="col-span-2 sm:col-span-1" />
        </section>

        <section className="card-tech p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-primary">Semana</h2>
            {diaFiltro && (
              <button onClick={() => setDiaFiltro(null)} className="text-xs text-muted-foreground hover:text-primary">
                Mostrar todos os dias
              </button>
            )}
          </div>
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {semana.map((d) => {
              const qtd = tarefas.filter((t) => t.lista === listaAtiva && t.agendadaPara && mesmoDia(new Date(t.agendadaPara), d)).length;
              const ativo = diaFiltro && mesmoDia(new Date(diaFiltro), d);
              const ehHoje = mesmoDia(d, hoje);
              return (
                <button
                  key={d.toISOString()}
                  onClick={() => setDiaFiltro(ativo ? null : d.toISOString())}
                  className={`rounded-lg border p-2 text-center transition-all ${
                    ativo ? "border-primary bg-primary/20 shadow-glow" : ehHoje ? "border-primary/60 bg-secondary" : "border-border bg-secondary/40 hover:border-primary/50"
                  }`}
                >
                  <div className="text-[10px] uppercase text-muted-foreground sm:text-xs">{DIAS[d.getDay()]}</div>
                  <div className={`text-lg font-bold ${ehHoje ? "text-primary" : ""}`}>{d.getDate()}</div>
                  <div className="text-[10px] text-muted-foreground">{qtd > 0 ? `${qtd} tarefa${qtd > 1 ? "s" : ""}` : "—"}</div>
                </button>
              );
            })}
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
          <aside className="card-tech h-fit p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary">Listas</h2>
            <ul className="space-y-1">
              {listas.map((l) => (
                <li key={l} className="flex items-center gap-1">
                  <button
                    onClick={() => setListaAtiva(l)}
                    className={`flex flex-1 justify-between rounded-md px-3 py-2 text-left text-sm transition-colors ${
                      listaAtiva === l ? "bg-primary/20 text-primary" : "hover:bg-secondary"
                    }`}
                  >
                    <span className="truncate">{l}</span>
                    <span className="text-muted-foreground">{tarefas.filter((t) => t.lista === l).length}</span>
                  </button>
                  {l !== "Geral" && (
                    <button onClick={() => excluirLista(l)} aria-label={`Excluir lista ${l}`} className="px-2 text-muted-foreground hover:text-destructive">
                      ×
                    </button>
                  )}
                </li>
              ))}
            </ul>
            <form onSubmit={criarLista} className="mt-3 flex gap-2">
              <input value={novaLista} onChange={(e) => setNovaLista(e.target.value)} placeholder="Nova lista" className="input-tech min-w-0 flex-1 py-2 text-sm" />
              <button className="rounded-md border border-primary/50 px-3 text-primary hover:bg-primary/10">+</button>
            </form>
          </aside>

          <div className="space-y-6">
            <section className="card-tech p-5">
              <form onSubmit={adicionar} className="space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row">
                  <label htmlFor="nova" className="sr-only">Nova tarefa</label>
                  <input id="nova" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Digite uma nova tarefa..." className="input-tech flex-1" />
                  <button type="submit" className="rounded-lg bg-gradient-tech px-5 py-3 font-semibold text-primary-foreground shadow-glow transition-transform hover:scale-[1.02]">
                    Adicionar tarefa
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="text-muted-foreground">Prioridade:</span>
                  {PRIORIDADES.map((p) => (
                    <button
                      type="button"
                      key={p.valor}
                      onClick={() => setPrioridade(p.valor)}
                      className={`rounded-full border px-3 py-1 font-medium transition-opacity ${p.classe} ${prioridade === p.valor ? "opacity-100 ring-1 ring-current" : "opacity-50"}`}
                    >
                      ● {p.rotulo}
                    </button>
                  ))}
                </div>
                <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center">
                  <label className="flex items-center gap-2">
                    <span className="text-muted-foreground">Agendar para:</span>
                    <input type="datetime-local" value={agenda} onChange={(e) => setAgenda(e.target.value)} className={`input-tech py-2 text-sm ${tema === "escuro" ? "[color-scheme:dark]" : ""}`} />
                  </label>
                  <label className={`flex items-center gap-2 ${agenda ? "" : "opacity-50"}`}>
                    <input type="checkbox" disabled={!agenda} checked={lembrete} onChange={(e) => setLembrete(e.target.checked)} className="h-4 w-4 accent-primary" />
                    Lembrete por SMS (30 min antes)
                  </label>
                </div>
                {lembrete && (
                  <input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="Seu celular: +5511999999999" className="input-tech w-full py-2 text-sm" />
                )}
                {aviso && <p className="text-sm text-priority-medium">{aviso}</p>}
              </form>
            </section>

            <section className="card-tech p-5">
              <h2 className="mb-3 text-lg font-semibold">
                {listaAtiva}
                {diaFiltro && <span className="ml-2 text-sm font-normal text-muted-foreground">· {new Date(diaFiltro).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" })}</span>}
              </h2>
              {visiveis.length === 0 ? (
                <p className="py-6 text-center text-muted-foreground">Nenhuma tarefa aqui. Adicione a primeira acima!</p>
              ) : (
                <ul className="space-y-2">
                  {visiveis.map((t) => {
                    const p = PRIORIDADES.find((x) => x.valor === t.prioridade);
                    const emEdicao = editandoId === t.id;
                    return (
                      <li key={t.id} className="relative flex items-start gap-3 overflow-hidden rounded-lg border bg-secondary/40 p-3 pl-4">
                        <span className={`absolute inset-y-0 left-0 w-1 ${BARRA[t.prioridade]}`} />
                        <input type="checkbox" checked={t.concluida} onChange={() => alternar(t.id)} aria-label="Marcar como concluída" className="mt-1 h-5 w-5 accent-primary" />
                        <div className="min-w-0 flex-1">
                          {emEdicao ? (
                            <form
                              onSubmit={(e) => {
                                e.preventDefault();
                                salvarEdicao(t.id);
                              }}
                              className="flex flex-col gap-2 sm:flex-row"
                            >
                              <input
                                value={textoEdicao}
                                onChange={(e) => setTextoEdicao(e.target.value)}
                                aria-label="Editar título da tarefa"
                                autoFocus
                                className="input-tech flex-1 py-2 text-sm"
                              />
                              <div className="flex gap-2">
                                <button
                                  type="submit"
                                  disabled={!textoEdicao.trim()}
                                  className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  Salvar
                                </button>
                                <button
                                  type="button"
                                  onClick={cancelarEdicao}
                                  className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-secondary"
                                >
                                  Cancelar
                                </button>
                              </div>
                            </form>
                          ) : (
                            <p className={`break-words ${t.concluida ? "text-muted-foreground line-through" : ""}`}>{t.texto}</p>
                          )}
                          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            <span className={`rounded-full border px-2 ${p.classe}`}>{p.rotulo}</span>
                            <span>Adicionada em {fmt(t.criadaEm)}</span>
                            {t.agendadaPara && <span className="text-primary">Agendada: {fmt(t.agendadaPara)}</span>}
                            {t.smsStatus === "scheduled" && <span>SMS agendado</span>}
                            {t.smsStatus === "sent" && <span>SMS enviado</span>}
                          </div>
                        </div>
                        {!emEdicao && (
                          <div className="flex shrink-0 gap-1">
                            <button onClick={() => iniciarEdicao(t)} className="rounded-md px-3 py-1 text-sm font-medium text-primary hover:bg-primary/10">
                              Editar
                            </button>
                            <button onClick={() => excluir(t.id)} className="rounded-md px-3 py-1 text-sm font-medium text-destructive hover:bg-destructive/10">
                              Excluir
                            </button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}

function Stat({ rotulo, valor, className = "" }) {
  return (
    <div className={`card-tech p-4 text-center ${className}`}>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{rotulo}</p>
      <p className="mt-1 font-mono text-3xl font-bold text-primary">{valor}</p>
    </div>
  );
}
