import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Check, CheckCircle2, ListTodo, LoaderCircle, Moon, Pencil, Plus, Sun, Trash2 } from "lucide-react";
import { scheduleSms, cancelSms } from "@/lib/sms.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Meu Organizador de Tarefas" },
      { name: "description", content: "Organize suas tarefas acadêmicas com listas, prioridades e lembretes." },
      { property: "og:title", content: "Meu Organizador de Tarefas" },
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
  const [tema, setTema] = useState("claro");

  const [texto, setTexto] = useState("");
  const [prioridade, setPrioridade] = useState("media");
  const [agenda, setAgenda] = useState("");
  const [lembrete, setLembrete] = useState(false);
  const [listaAtiva, setListaAtiva] = useState("Geral");
  const [novaLista, setNovaLista] = useState("");
  const [diaFiltro, setDiaFiltro] = useState(null);
  const [aviso, setAviso] = useState("");
  const [erroSms, setErroSms] = useState(false);
  const [erroLista, setErroLista] = useState("");
  const [adicionando, setAdicionando] = useState(false);
  const [anuncio, setAnuncio] = useState("");

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
    setErroSms(false);
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
      setAdicionando(true);
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
        setErroSms(true);
      } finally {
        setAdicionando(false);
      }
    }
    setTarefas((prev) => [...prev, nova]);
    setAnuncio("Tarefa adicionada.");
    setTexto("");
    setAgenda("");
    setLembrete(false);
  };

  const alternar = (id) => {
    const tarefa = tarefas.find((t) => t.id === id);
    setTarefas((prev) => prev.map((t) => (t.id === id ? { ...t, concluida: !t.concluida } : t)));
    setAnuncio(tarefa?.concluida ? "Tarefa marcada como pendente." : "Tarefa concluída.");
  };
  const excluir = (id) => {
    const t = tarefas.find((x) => x.id === id);
    if (t?.smsSid && t.smsStatus === "scheduled") cancelSms({ data: { sid: t.smsSid } }).catch(() => {});
    if (editandoId === id) cancelarEdicao();
    setTarefas((prev) => prev.filter((x) => x.id !== id));
    setAnuncio("Tarefa excluída.");
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
    setAnuncio("Tarefa atualizada.");
    cancelarEdicao();
  };

  const criarLista = (e) => {
    e.preventDefault();
    const n = novaLista.trim();
    if (!n) {
      setErroLista("Informe um nome para a lista.");
      return;
    }
    if (listas.includes(n)) {
      setErroLista("Já existe uma lista com esse nome.");
      return;
    }
    setListas([...listas, n]);
    setListaAtiva(n);
    setNovaLista("");
    setErroLista("");
    setAnuncio(`Lista ${n} criada.`);
  };
  const excluirLista = (n) => {
    setListas(listas.filter((l) => l !== n));
    setTarefas((prev) => prev.filter((t) => t.lista !== n));
    setListaAtiva("Geral");
    setAnuncio(`Lista ${n} e suas tarefas foram excluídas.`);
  };

  const ordem = { alta: 0, media: 1, baixa: 2 };
  const visiveis = tarefas
    .filter((t) => t.lista === listaAtiva)
    .filter((t) => !diaFiltro || (t.agendadaPara && mesmoDia(new Date(t.agendadaPara), new Date(diaFiltro))))
    .sort((a, b) => Number(a.concluida) - Number(b.concluida) || ordem[a.prioridade] - ordem[b.prioridade]);
  const concluidas = tarefas.filter((t) => t.concluida).length;
  const hoje = new Date();

  return (
    <>
      <a href="#conteudo" className="sr-only z-50 rounded-lg bg-card px-4 py-3 font-medium text-foreground shadow-lg focus:fixed focus:left-4 focus:top-4 focus:not-sr-only">
        Pular para o conteúdo
      </a>
      <main id="conteudo" tabIndex={-1} className="min-h-screen bg-tech-grid px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="inline-flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              <span className="grid size-8 place-items-center rounded-lg bg-retro-lime text-retro-lime-foreground">
                <ListTodo className="size-4" aria-hidden="true" />
              </span>
              Agenda / 01
            </p>
            <button
              onClick={() => setTema(tema === "escuro" ? "claro" : "escuro")}
              aria-label={tema === "escuro" ? "Ativar modo claro" : "Ativar modo escuro"}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
            >
              {tema === "escuro" ? <Sun className="size-4" aria-hidden="true" /> : <Moon className="size-4" aria-hidden="true" />}
              <span>{tema === "escuro" ? "Modo claro" : "Modo escuro"}</span>
            </button>
          </div>
          <div>
            <h1 className="text-3xl font-bold leading-tight text-foreground sm:text-4xl">
            Meu Organizador de Tarefas
            </h1>
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">
              Planeje sua semana e acompanhe cada tarefa concluída.
            </p>
          </div>
        </header>

        <section aria-label="Resumo das tarefas" className="grid grid-cols-3 gap-2.5 sm:gap-3">
          <Stat rotulo="No total" valor={tarefas.length} />
          <Stat rotulo="Concluídas" valor={concluidas} />
          <Stat rotulo="Pendentes" valor={tarefas.length - concluidas} />
        </section>

        <div className="grid items-start gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
          <aside aria-labelledby="listas-heading" className="card-tech h-fit p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 id="listas-heading" className="text-base font-bold text-foreground">Minhas listas</h2>
              <ListTodo className="size-4 text-primary" aria-hidden="true" />
            </div>
            <ul className="space-y-1.5">
              {listas.map((l) => (
                <li key={l} className="flex items-center gap-1.5">
                  <button
                    onClick={() => setListaAtiva(l)}
                    aria-pressed={listaAtiva === l}
                    className={`flex min-h-10 flex-1 items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
                      listaAtiva === l ? "bg-retro-lime text-retro-lime-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    }`}
                  >
                    <span className="truncate">{l}</span>
                    <span className="font-mono text-xs">{tarefas.filter((t) => t.lista === l).length}</span>
                  </button>
                  {l !== "Geral" && (
                    <button onClick={() => excluirLista(l)} aria-label={`Excluir lista ${l}`} title={`Excluir lista ${l}`} className="grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive">
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
            <form aria-label="Criar lista" onSubmit={criarLista} className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
              <label className="sr-only" htmlFor="nova-lista">Nome da nova lista</label>
              <input id="nova-lista" value={novaLista} onChange={(e) => { setNovaLista(e.target.value); setErroLista(""); }} aria-invalid={Boolean(erroLista)} aria-describedby={erroLista ? "erro-lista" : undefined} required placeholder="Nova lista" className="input-tech min-w-0 flex-1 py-2 text-sm" />
              <button type="submit" aria-label="Criar lista" title="Criar lista" className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground transition-colors hover:opacity-90">
                <Plus className="size-4" aria-hidden="true" />
              </button>
              {erroLista && <p id="erro-lista" role="alert" className="w-full text-sm font-medium text-destructive">{erroLista}</p>}
            </form>
          </aside>

          <div className="space-y-5">
            <section aria-labelledby="adicionar-tarefa-heading" className="card-tech p-4 sm:p-5">
              <div className="mb-4">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Próximo passo</p>
                <h2 id="adicionar-tarefa-heading" className="mt-1 text-lg font-bold text-foreground">Adicionar tarefa</h2>
              </div>
              <form aria-busy={adicionando} onSubmit={adicionar} className="space-y-4">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <label htmlFor="nova" className="sr-only">Nova tarefa</label>
                  <input id="nova" value={texto} onChange={(e) => setTexto(e.target.value)} required placeholder="O que você precisa fazer?" className="input-tech min-h-12 flex-1" />
                  <button type="submit" disabled={adicionando} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-primary px-5 font-semibold text-primary-foreground transition-colors hover:opacity-90 disabled:opacity-60 sm:min-w-44">
                    {adicionando ? <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
                    {adicionando ? "Salvando..." : "Adicionar tarefa"}
                  </button>
                </div>
                <div className="flex flex-col gap-4 border-t border-border pt-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                  <div role="group" aria-labelledby="prioridade-label" className="flex flex-wrap items-center gap-2 text-sm">
                    <span id="prioridade-label" className="mr-1 font-medium text-muted-foreground">Prioridade</span>
                    {PRIORIDADES.map((p) => (
                      <button
                        type="button"
                        key={p.valor}
                        onClick={() => setPrioridade(p.valor)}
                        aria-pressed={prioridade === p.valor}
                        className={`inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors ${p.classe} ${prioridade === p.valor ? "ring-2 ring-primary/25" : "border-border bg-background text-muted-foreground opacity-75 hover:opacity-100"}`}
                      >
                        <span className={`size-1.5 rounded-full ${BARRA[p.valor]}`} aria-hidden="true" />
                        {p.rotulo}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-3 text-sm">
                    <label htmlFor="agenda" className="flex flex-wrap items-center gap-2 text-muted-foreground">
                      <CalendarDays className="size-4 text-primary" aria-hidden="true" />
                      <span>Agendar</span>
                      <input
                        id="agenda"
                        type="datetime-local"
                        value={agenda}
                        onChange={(e) => {
                          setAgenda(e.target.value);
                          if (!e.target.value) setLembrete(false);
                        }}
                        className={`input-tech min-h-10 w-full py-1.5 text-xs sm:w-auto ${tema === "escuro" ? "scheme-dark" : ""}`}
                      />
                    </label>
                    <label className={`inline-flex min-h-11 items-center gap-2 ${agenda ? "text-foreground" : "text-muted-foreground"}`}>
                      <input type="checkbox" disabled={!agenda} checked={lembrete} onChange={(e) => setLembrete(e.target.checked)} className="size-5 accent-primary" />
                      Lembrete por SMS
                    </label>
                  </div>
                </div>
                {lembrete && (
                  <div className="space-y-1.5">
                    <label htmlFor="telefone-sms" className="text-sm font-medium text-foreground">Celular para lembretes por SMS</label>
                    <input id="telefone-sms" type="tel" autoComplete="tel" aria-describedby="telefone-sms-ajuda" value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="+55 11 99999-9999" required className="input-tech w-full py-2 text-sm" />
                    <p id="telefone-sms-ajuda" className="text-xs text-muted-foreground">Inclua o código do país e o DDD.</p>
                  </div>
                )}
                {aviso && <p role={erroSms ? "alert" : "status"} aria-live={erroSms ? "assertive" : "polite"} className={`rounded-lg px-3 py-2 text-sm ${erroSms ? "bg-destructive/10 font-medium text-destructive" : "bg-accent/50 text-accent-foreground"}`}>{aviso}</p>}
              </form>
            </section>

            <section aria-labelledby="semana-heading" className="card-tech p-4 sm:p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 id="semana-heading" className="flex items-center gap-2 text-base font-bold text-foreground">
                  <CalendarDays className="size-4 text-primary" aria-hidden="true" />
                  Esta semana
                </h2>
                {diaFiltro && (
                  <button onClick={() => setDiaFiltro(null)} className="rounded-md px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-secondary">
                    Limpar filtro
                  </button>
                )}
              </div>
              <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                {semana.map((d) => {
                  const qtd = tarefas.filter((t) => t.lista === listaAtiva && t.agendadaPara && mesmoDia(new Date(t.agendadaPara), d)).length;
                  const ativo = diaFiltro && mesmoDia(new Date(diaFiltro), d);
                  const ehHoje = mesmoDia(d, hoje);
                  const corTexto = ativo ? "text-primary-foreground" : ehHoje ? "text-retro-lime-foreground" : "text-muted-foreground";
                  const resumoDia = qtd === 1 ? "1 tarefa agendada" : `${qtd} tarefas agendadas`;
                  return (
                    <button
                      key={d.toISOString()}
                      onClick={() => setDiaFiltro(ativo ? null : d.toISOString())}
                      aria-pressed={Boolean(ativo)}
                      aria-label={`${d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}${ehHoje ? ", hoje" : ""}, ${resumoDia}`}
                      className={`min-w-0 rounded-lg border px-1 py-2 text-center transition-colors sm:px-2 ${
                        ativo ? "border-primary bg-primary text-primary-foreground" : ehHoje ? "border-retro-lime bg-retro-lime/35 text-retro-lime-foreground" : "border-border bg-background text-foreground hover:bg-secondary"
                      }`}
                    >
                      <div className={`text-[9px] font-semibold uppercase sm:text-[10px] ${corTexto}`}>{DIAS[d.getDay()]}</div>
                      <div className="text-base font-bold sm:text-lg">{d.getDate()}</div>
                      <div className={`font-mono text-[9px] ${corTexto}`}>{qtd > 0 ? qtd : "·"}</div>
                    </button>
                  );
                })}
              </div>
            </section>

            <section aria-labelledby="tarefas-heading" className="card-tech p-4 sm:p-5">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 id="tarefas-heading" className="text-lg font-bold text-foreground">{listaAtiva}</h2>
                  {diaFiltro && <p className="mt-1 text-xs text-muted-foreground">{new Date(diaFiltro).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}</p>}
                </div>
                <span className="rounded-full bg-secondary px-2.5 py-1 font-mono text-xs font-semibold text-muted-foreground">{visiveis.length}</span>
              </div>
              {visiveis.length === 0 ? (
                <div className="flex min-h-32 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-background px-4 py-6 text-center">
                  <CheckCircle2 className="mb-2 size-6 text-primary" aria-hidden="true" />
                  <p className="text-sm font-semibold text-foreground">Nenhuma tarefa por aqui</p>
                  <p className="mt-1 text-xs text-muted-foreground">Adicione a próxima tarefa acima.</p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {visiveis.map((t) => {
                    const p = PRIORIDADES.find((x) => x.valor === t.prioridade);
                    const emEdicao = editandoId === t.id;
                    return (
                      <li key={t.id} className="relative grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-2 overflow-hidden rounded-lg border border-border bg-background p-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
                        <span className={`absolute inset-y-0 left-0 w-1 ${BARRA[t.prioridade]}`} />
                        <label className="grid size-11 shrink-0 cursor-pointer place-items-center" title={`Concluir tarefa: ${t.texto}`}>
                          <span className="sr-only">Concluir tarefa: {t.texto}</span>
                          <input type="checkbox" checked={t.concluida} onChange={() => alternar(t.id)} className="size-5 accent-primary" />
                        </label>
                        <div className="min-w-0">
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
                                required
                                className="input-tech min-w-0 flex-1 py-2 text-sm"
                              />
                              <div className="flex gap-2">
                                <button
                                  type="submit"
                                  disabled={!textoEdicao.trim()}
                                  className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  <Check className="size-4" aria-hidden="true" />
                                  Salvar
                                </button>
                                <button
                                  type="button"
                                  onClick={cancelarEdicao}
                                  className="min-h-9 rounded-lg border border-border px-3 text-sm text-muted-foreground transition-colors hover:bg-secondary"
                                >
                                  Cancelar
                                </button>
                              </div>
                            </form>
                          ) : (
                            <p className={`wrap-break-word text-sm font-medium ${t.concluida ? "text-muted-foreground line-through" : "text-foreground"}`}>{t.texto}</p>
                          )}
                          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                            <span className={`rounded-full border px-2 py-0.5 font-semibold ${p.classe}`}>{p.rotulo}</span>
                            <span>{fmt(t.criadaEm)}</span>
                            {t.agendadaPara && <span className="text-primary">Agendada: {fmt(t.agendadaPara)}</span>}
                            {t.smsStatus === "scheduled" && <span>Lembrete agendado</span>}
                            {t.smsStatus === "sent" && <span>Lembrete enviado</span>}
                          </div>
                        </div>
                        {!emEdicao && (
                          <div className="col-start-2 flex justify-end gap-1 sm:col-start-3 sm:row-start-1">
                            <button onClick={() => iniciarEdicao(t)} aria-label={`Editar tarefa: ${t.texto}`} title="Editar tarefa" className="grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-primary">
                              <Pencil className="size-4" aria-hidden="true" />
                            </button>
                            <button onClick={() => excluir(t.id)} aria-label={`Excluir tarefa: ${t.texto}`} title="Excluir tarefa" className="grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive">
                              <Trash2 className="size-4" aria-hidden="true" />
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
        <p className="sr-only" aria-live="polite" aria-atomic="true">{anuncio}</p>
      </main>
    </>
  );
}

function Stat({ rotulo, valor }) {
  return (
    <div className="card-tech min-w-0 p-3 sm:p-4">
      <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sm:text-xs">{rotulo}</p>
      <p className="mt-1 font-mono text-2xl font-bold text-primary sm:text-3xl">{valor}</p>
    </div>
  );
}
