import { useEffect, useMemo, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import {
  AlertTriangle,
  BadgeCheck,
  Braces,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Code2,
  FileText,
  Hammer,
  Loader2,
  Play,
  RefreshCw,
  Send,
  Terminal,
  XCircle,
} from 'lucide-react';
import { problems } from './data/problems';
import { PythonRunnerClient } from './services/pythonRunner';
import type { CompileResult, JudgeResult, Problem, RunResult } from './types';

type ResultTab = 'compile' | 'run' | 'judge';
type BusyAction = 'compile' | 'run' | 'judge' | null;

const CODE_KEY_PREFIX = 'multilang-judge-code:';
const SELECTED_PROBLEM_KEY = 'multilang-judge-selected-problem';
const INPUT_KEY_PREFIX = 'multilang-judge-input:';
const TIMEOUT_MS = 3000;

export default function App() {
  const initialProblem = useMemo(() => {
    const savedId = window.localStorage.getItem(SELECTED_PROBLEM_KEY);
    return problems.find((problem) => problem.id === savedId) ?? problems[0];
  }, []);

  const [selectedProblemId, setSelectedProblemId] = useState(initialProblem.id);
  const selectedProblem = problems.find((problem) => problem.id === selectedProblemId) ?? problems[0];
  const [code, setCode] = useState(() => loadCode(initialProblem));
  const [stdin, setStdin] = useState(() => loadInput(initialProblem));
  const [compileResult, setCompileResult] = useState<CompileResult | null>(null);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [judgeResult, setJudgeResult] = useState<JudgeResult | null>(null);
  const [resultTab, setResultTab] = useState<ResultTab>('run');
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const runnerRef = useRef<PythonRunnerClient | null>(null);

  useEffect(() => {
    runnerRef.current = new PythonRunnerClient();
    return () => runnerRef.current?.dispose();
  }, []);

  useEffect(() => {
    window.localStorage.setItem(SELECTED_PROBLEM_KEY, selectedProblemId);
  }, [selectedProblemId]);

  useEffect(() => {
    window.localStorage.setItem(`${CODE_KEY_PREFIX}${selectedProblemId}`, code);
  }, [code, selectedProblemId]);

  useEffect(() => {
    window.localStorage.setItem(`${INPUT_KEY_PREFIX}${selectedProblemId}`, stdin);
  }, [stdin, selectedProblemId]);

  function selectProblem(problem: Problem) {
    setSelectedProblemId(problem.id);
    setCode(loadCode(problem));
    setStdin(loadInput(problem));
    setCompileResult(null);
    setRunResult(null);
    setJudgeResult(null);
    setResultTab('run');
  }

  async function compile() {
    setBusyAction('compile');
    setResultTab('compile');
    const result = await runnerRef.current!.compile(code, TIMEOUT_MS);
    setCompileResult(result);
    setBusyAction(null);
  }

  async function run() {
    setBusyAction('run');
    setResultTab('run');
    const result = await runnerRef.current!.run(code, stdin, TIMEOUT_MS);
    setRunResult(result);
    setBusyAction(null);
  }

  async function judge() {
    setBusyAction('judge');
    setResultTab('judge');
    const result = await runnerRef.current!.judge(code, selectedProblem.testCases, TIMEOUT_MS);
    setJudgeResult(result);
    setBusyAction(null);
  }

  function resetCode() {
    setCode(selectedProblem.starterCode);
    setCompileResult(null);
    setRunResult(null);
    setJudgeResult(null);
  }

  const busy = busyAction !== null;

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <Braces size={22} aria-hidden="true" />
          </div>
          <div>
            <h1>Frontend Multilanguage Judge</h1>
            <span>纯前端 MVP</span>
          </div>
        </div>

        <div className="language-switch" aria-label="语言选择">
          <button className="language-option active" type="button">
            <Code2 size={16} aria-hidden="true" />
            Python
          </button>
          <button className="language-option disabled" type="button" disabled>
            <Code2 size={16} aria-hidden="true" />
            C++ 第二阶段
          </button>
        </div>

        <div className="top-actions">
          <ActionButton icon={<Hammer size={17} />} label="编译" busy={busyAction === 'compile'} disabled={busy} onClick={compile} />
          <ActionButton icon={<Play size={17} />} label="运行" busy={busyAction === 'run'} disabled={busy} onClick={run} />
          <ActionButton icon={<Send size={17} />} label="提交评测" busy={busyAction === 'judge'} disabled={busy} primary onClick={judge} />
        </div>
      </header>

      <section className="workspace" aria-label="编程评测工作区">
        <aside className="problem-panel">
          <div className="panel-heading">
            <FileText size={18} aria-hidden="true" />
            <h2>题目</h2>
          </div>

          <div className="problem-list">
            {problems.map((problem) => (
              <button
                className={`problem-item ${problem.id === selectedProblem.id ? 'selected' : ''}`}
                type="button"
                key={problem.id}
                onClick={() => selectProblem(problem)}
              >
                <span>
                  <strong>{problem.title}</strong>
                  <small>{problem.difficulty}</small>
                </span>
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            ))}
          </div>

          <article className="problem-detail">
            <div className="difficulty-row">
              <span className={`difficulty difficulty-${selectedProblem.difficulty}`}>{selectedProblem.difficulty}</span>
              <span>{selectedProblem.testCases.length} 个测试点</span>
            </div>
            <h2>{selectedProblem.title}</h2>
            <p>{selectedProblem.description}</p>

            <h3>输入</h3>
            <p>{selectedProblem.inputDescription}</p>

            <h3>输出</h3>
            <p>{selectedProblem.outputDescription}</p>

            <h3>样例</h3>
            {selectedProblem.samples.map((sample) => (
              <div className="sample-block" key={sample.name}>
                <span>{sample.name}</span>
                <pre>{sample.stdin}</pre>
                <pre>{sample.expectedStdout}</pre>
              </div>
            ))}
          </article>
        </aside>

        <section className="editor-panel">
          <div className="editor-toolbar">
            <div>
              <span className="file-pill">main.py</span>
              <span className="status-note">Pyodide CDN / {TIMEOUT_MS}ms</span>
            </div>
            <button className="icon-button" type="button" onClick={resetCode} aria-label="重置代码" title="重置代码">
              <RefreshCw size={17} aria-hidden="true" />
            </button>
          </div>

          <div className="editor-frame">
            <Editor
              theme="vs-dark"
              defaultLanguage="python"
              language="python"
              value={code}
              onChange={(value) => setCode(value ?? '')}
              options={{
                fontSize: 14,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                tabSize: 4,
                padding: { top: 16, bottom: 16 },
                automaticLayout: true,
              }}
            />
          </div>

          <label className="stdin-box">
            <span>标准输入</span>
            <textarea value={stdin} onChange={(event) => setStdin(event.target.value)} spellCheck={false} />
          </label>
        </section>

        <section className="result-panel">
          <div className="result-tabs" role="tablist" aria-label="结果面板">
            <TabButton active={resultTab === 'compile'} icon={<Hammer size={16} />} label="编译" onClick={() => setResultTab('compile')} />
            <TabButton active={resultTab === 'run'} icon={<Terminal size={16} />} label="运行" onClick={() => setResultTab('run')} />
            <TabButton active={resultTab === 'judge'} icon={<BadgeCheck size={16} />} label="评测" onClick={() => setResultTab('judge')} />
          </div>

          <div className="result-content">
            {busyAction && (
              <div className="loading-line">
                <Loader2 size={18} aria-hidden="true" />
                <span>{busyAction === 'judge' ? '正在评测' : busyAction === 'compile' ? '正在编译' : '正在运行'}</span>
              </div>
            )}

            {resultTab === 'compile' && <CompileView result={compileResult} />}
            {resultTab === 'run' && <RunView result={runResult} />}
            {resultTab === 'judge' && <JudgeView result={judgeResult} />}
          </div>
        </section>
      </section>
    </main>
  );
}

function ActionButton({
  icon,
  label,
  busy,
  disabled,
  primary,
  onClick,
}: {
  icon: JSX.Element;
  label: string;
  busy: boolean;
  disabled: boolean;
  primary?: boolean;
  onClick: () => void;
}) {
  return (
    <button className={`action-button ${primary ? 'primary' : ''}`} type="button" disabled={disabled} onClick={onClick}>
      {busy ? <Loader2 className="spin" size={17} aria-hidden="true" /> : icon}
      <span>{label}</span>
    </button>
  );
}

function TabButton({ active, icon, label, onClick }: { active: boolean; icon: JSX.Element; label: string; onClick: () => void }) {
  return (
    <button className={`tab-button ${active ? 'active' : ''}`} type="button" role="tab" aria-selected={active} onClick={onClick}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

function CompileView({ result }: { result: CompileResult | null }) {
  if (!result) {
    return <EmptyState icon={<Hammer size={22} />} title="还没有编译结果" />;
  }

  return (
    <div className="result-stack">
      <StatusLine status={result.status} label={result.status === 'success' ? '编译成功' : '编译失败'} durationMs={result.durationMs} />
      <div className="diagnostic-list">
        {result.diagnostics.map((item, index) => (
          <div className={`diagnostic diagnostic-${item.severity}`} key={`${item.message}-${index}`}>
            <AlertTriangle size={16} aria-hidden="true" />
            <span>
              {item.line ? `第 ${item.line} 行${item.column ? `:${item.column}` : ''} ` : ''}
              {item.message}
            </span>
          </div>
        ))}
      </div>
      {result.bytecodePreview && (
        <OutputBlock title="Bytecode / Traceback" value={result.bytecodePreview} tone={result.status === 'success' ? 'neutral' : 'danger'} />
      )}
    </div>
  );
}

function RunView({ result }: { result: RunResult | null }) {
  if (!result) {
    return <EmptyState icon={<Terminal size={22} />} title="还没有运行结果" />;
  }

  return (
    <div className="result-stack">
      <StatusLine status={result.status} label={result.status === 'success' ? '运行完成' : result.status === 'timeout' ? '运行超时' : '运行异常'} durationMs={result.durationMs} />
      <OutputBlock title="stdout" value={result.stdout || '(无输出)'} tone="neutral" />
      {result.stderr && <OutputBlock title="stderr" value={result.stderr} tone="warning" />}
      {result.error && <OutputBlock title="error" value={result.error} tone="danger" />}
    </div>
  );
}

function JudgeView({ result }: { result: JudgeResult | null }) {
  if (!result) {
    return <EmptyState icon={<BadgeCheck size={22} />} title="还没有评测结果" />;
  }

  return (
    <div className="result-stack">
      <div className={`judge-summary ${result.status}`}>
        <div>
          <span>{result.status === 'passed' ? 'Accepted' : result.status === 'error' ? 'Compile Error' : 'Wrong Answer'}</span>
          <strong>
            {result.passed}/{result.total}
          </strong>
        </div>
        <span>{result.durationMs}ms</span>
      </div>

      {result.cases.length === 0 ? (
        <OutputBlock title="评测未执行" value="代码未通过编译，先查看编译面板中的诊断。" tone="danger" />
      ) : (
        result.cases.map((item) => (
          <details className={`case-result ${item.status}`} key={item.name} open={item.status !== 'passed'}>
            <summary>
              <span>
                {item.status === 'passed' ? <CheckCircle2 size={16} aria-hidden="true" /> : <XCircle size={16} aria-hidden="true" />}
                {item.name}
              </span>
              <small>{item.durationMs}ms</small>
            </summary>
            <OutputBlock title="输入" value={item.stdin || '(空)'} tone="neutral" />
            <OutputBlock title="期望输出" value={item.expectedStdout || '(空)'} tone="neutral" />
            <OutputBlock title="实际输出" value={item.actualStdout || '(无输出)'} tone={item.status === 'passed' ? 'neutral' : 'danger'} />
            {item.stderr && <OutputBlock title="stderr" value={item.stderr} tone="warning" />}
            {item.error && <OutputBlock title="error" value={item.error} tone="danger" />}
          </details>
        ))
      )}
    </div>
  );
}

function StatusLine({ status, label, durationMs }: { status: CompileResult['status']; label: string; durationMs: number }) {
  const icon =
    status === 'success' ? <CheckCircle2 size={18} aria-hidden="true" /> : status === 'timeout' ? <Clock3 size={18} aria-hidden="true" /> : <XCircle size={18} aria-hidden="true" />;

  return (
    <div className={`status-line status-${status}`}>
      <span>
        {icon}
        {label}
      </span>
      <small>{durationMs}ms</small>
    </div>
  );
}

function OutputBlock({ title, value, tone }: { title: string; value: string; tone: 'neutral' | 'warning' | 'danger' }) {
  return (
    <div className={`output-block ${tone}`}>
      <span>{title}</span>
      <pre>{value}</pre>
    </div>
  );
}

function EmptyState({ icon, title }: { icon: JSX.Element; title: string }) {
  return (
    <div className="empty-state">
      {icon}
      <span>{title}</span>
    </div>
  );
}

function loadCode(problem: Problem) {
  return window.localStorage.getItem(`${CODE_KEY_PREFIX}${problem.id}`) ?? problem.starterCode;
}

function loadInput(problem: Problem) {
  return window.localStorage.getItem(`${INPUT_KEY_PREFIX}${problem.id}`) ?? problem.samples[0]?.stdin ?? '';
}
