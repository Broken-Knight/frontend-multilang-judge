import type { CompileResult, PythonWorkerRequest, PythonWorkerResponse, RunResult } from '../types';

type Pyodide = {
  globals: {
    set: (key: string, value: unknown) => void;
  };
  runPython: (code: string) => unknown;
  runPythonAsync: (code: string) => Promise<unknown>;
  setStdin: (options?: unknown) => void;
  setStdout: (options?: unknown) => void;
  setStderr: (options?: unknown) => void;
};

type LoadPyodide = (options: { indexURL: string }) => Promise<Pyodide>;

const PYODIDE_VERSION = '0.29.4';
const PYODIDE_INDEX_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

let pyodidePromise: Promise<Pyodide> | null = null;

self.onmessage = async (event: MessageEvent<PythonWorkerRequest>) => {
  const { id, action, source } = event.data;

  try {
    const result = action === 'compile' ? await compilePython(source) : await runPython(source, event.data.stdin ?? '');
    postResponse({ id, action, result });
  } catch (error) {
    postResponse({
      id,
      action,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

async function loadRuntime() {
  if (!pyodidePromise) {
    pyodidePromise = import(/* @vite-ignore */ `${PYODIDE_INDEX_URL}pyodide.mjs`).then((module) => {
      const loadPyodide = (module as { loadPyodide: LoadPyodide }).loadPyodide;
      return loadPyodide({ indexURL: PYODIDE_INDEX_URL });
    });
  }

  return pyodidePromise;
}

async function compilePython(source: string): Promise<CompileResult> {
  const startedAt = performance.now();
  const pyodide = await loadRuntime();
  pyodide.globals.set('__codex_source__', source);

  const raw = pyodide.runPython(`
import ast
import dis
import io
import json
import traceback

try:
    tree = ast.parse(__codex_source__, filename="<user>")
    code = compile(tree, "<user>", "exec")
    buffer = io.StringIO()
    dis.dis(code, file=buffer)
    payload = {
        "ok": True,
        "bytecode": buffer.getvalue()[:6000],
        "node_count": sum(1 for _ in ast.walk(tree)),
    }
except BaseException as exc:
    payload = {
        "ok": False,
        "error_type": type(exc).__name__,
        "message": str(exc),
        "line": getattr(exc, "lineno", None),
        "column": getattr(exc, "offset", None),
        "traceback": traceback.format_exc(),
    }

json.dumps(payload, ensure_ascii=False)
`);

  const payload = JSON.parse(String(raw)) as {
    ok: boolean;
    bytecode?: string;
    node_count?: number;
    error_type?: string;
    message?: string;
    line?: number;
    column?: number;
    traceback?: string;
  };

  if (payload.ok) {
    return {
      status: 'success',
      diagnostics: [
        {
          severity: 'info',
          source: 'python',
          message: `编译成功，AST 节点 ${payload.node_count ?? 0} 个。`,
        },
      ],
      bytecodePreview: payload.bytecode ?? '',
      durationMs: Math.round(performance.now() - startedAt),
    };
  }

  return {
    status: 'error',
    diagnostics: [
      {
        severity: 'error',
        source: 'python',
        message: `${payload.error_type ?? 'PythonError'}: ${payload.message ?? '编译失败'}`,
        line: payload.line,
        column: payload.column,
      },
    ],
    bytecodePreview: payload.traceback,
    durationMs: Math.round(performance.now() - startedAt),
  };
}

async function runPython(source: string, stdin: string): Promise<RunResult> {
  const startedAt = performance.now();
  const pyodide = await loadRuntime();
  const stdout: string[] = [];
  const stderr: string[] = [];
  const inputLines = stdin.length > 0 ? stdin.replace(/\r\n/g, '\n').split('\n') : [];
  let inputIndex = 0;

  pyodide.setStdin({
    stdin: () => {
      if (inputIndex >= inputLines.length) {
        return undefined;
      }
      return inputLines[inputIndex++];
    },
    isatty: false,
  });
  pyodide.setStdout({ batched: (text: string) => stdout.push(text) });
  pyodide.setStderr({ batched: (text: string) => stderr.push(text) });
  pyodide.globals.set('__codex_source__', source);

  try {
    await pyodide.runPythonAsync(`
__codex_globals__ = {"__name__": "__main__"}
exec(compile(__codex_source__, "<user>", "exec"), __codex_globals__)
`);

    return {
      status: 'success',
      stdout: stdout.join('\\n'),
      stderr: stderr.join('\\n'),
      durationMs: Math.round(performance.now() - startedAt),
    };
  } catch (error) {
    return {
      status: 'error',
      stdout: stdout.join('\\n'),
      stderr: stderr.join('\\n'),
      error: error instanceof Error ? error.message : String(error),
      durationMs: Math.round(performance.now() - startedAt),
    };
  } finally {
    pyodide.setStdin();
    pyodide.setStdout();
    pyodide.setStderr();
  }
}

function postResponse(response: PythonWorkerResponse) {
  self.postMessage(response);
}

export {};
