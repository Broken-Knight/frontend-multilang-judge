import type {
  CompileResult,
  Diagnostic,
  JudgeCaseResult,
  JudgeResult,
  PythonWorkerAction,
  PythonWorkerRequest,
  PythonWorkerResponse,
  RunResult,
  TestCase,
} from '../types';

type PendingRequest = {
  resolve: (response: PythonWorkerResponse) => void;
  timeout: number;
};

const DEFAULT_TIMEOUT_MS = 3000;

export class PythonRunnerClient {
  private worker: Worker | null = null;
  private nextId = 1;
  private pending = new Map<number, PendingRequest>();

  dispose() {
    this.resetWorker();
  }

  compile(source: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<CompileResult> {
    return this.send<CompileResult>('compile', { source }, timeoutMs, {
      status: 'timeout',
      diagnostics: [
        {
          severity: 'error',
          source: 'runtime',
          message: `编译超过 ${timeoutMs}ms，已终止 Python Worker。`,
        },
      ],
      durationMs: timeoutMs,
    });
  }

  run(source: string, stdin: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<RunResult> {
    return this.send<RunResult>('run', { source, stdin }, timeoutMs, {
      status: 'timeout',
      stdout: '',
      stderr: '',
      error: `运行超过 ${timeoutMs}ms，已终止 Python Worker。`,
      durationMs: timeoutMs,
    });
  }

  async judge(source: string, testCases: TestCase[], timeoutMs = DEFAULT_TIMEOUT_MS): Promise<JudgeResult> {
    const startedAt = performance.now();
    const cases: JudgeCaseResult[] = [];

    const compileResult = await this.compile(source, timeoutMs);
    if (compileResult.status !== 'success') {
      return {
        status: 'error',
        passed: 0,
        total: testCases.length,
        cases,
        durationMs: Math.round(performance.now() - startedAt),
      };
    }

    for (const testCase of testCases) {
      const runResult = await this.run(source, testCase.stdin, timeoutMs);
      const actual = normalizeOutput(runResult.stdout);
      const expected = normalizeOutput(testCase.expectedStdout);
      const passed = runResult.status === 'success' && actual === expected;

      cases.push({
        name: testCase.name,
        status: passed ? 'passed' : runResult.status === 'timeout' ? 'timeout' : runResult.status === 'error' ? 'error' : 'failed',
        stdin: testCase.stdin,
        expectedStdout: testCase.expectedStdout,
        actualStdout: runResult.stdout,
        stderr: runResult.stderr,
        error: runResult.error,
        durationMs: runResult.durationMs,
      });
    }

    const passed = cases.filter((item) => item.status === 'passed').length;
    return {
      status: passed === testCases.length ? 'passed' : 'failed',
      passed,
      total: testCases.length,
      cases,
      durationMs: Math.round(performance.now() - startedAt),
    };
  }

  private send<T extends CompileResult | RunResult>(
    action: PythonWorkerAction,
    payload: Omit<PythonWorkerRequest, 'id' | 'action'>,
    timeoutMs: number,
    timeoutResult: T,
  ): Promise<T> {
    const id = this.nextId++;
    const worker = this.ensureWorker();

    return new Promise((resolve) => {
      const timeout = window.setTimeout(() => {
        this.pending.delete(id);
        this.resetWorker();
        resolve(timeoutResult);
      }, timeoutMs);

      this.pending.set(id, {
        timeout,
        resolve: (response) => {
          window.clearTimeout(timeout);
          if (response.result) {
            resolve(response.result as T);
            return;
          }

          resolve({
            ...timeoutResult,
            status: 'error',
            diagnostics:
              action === 'compile'
                ? [
                    {
                      severity: 'error',
                      source: 'runtime',
                      message: response.error ?? 'Python Worker 返回了未知错误。',
                    } satisfies Diagnostic,
                  ]
                : undefined,
            error: response.error ?? 'Python Worker 返回了未知错误。',
            durationMs: 0,
          } as T);
        },
      });

      worker.postMessage({ id, action, ...payload } satisfies PythonWorkerRequest);
    });
  }

  private ensureWorker() {
    if (this.worker) {
      return this.worker;
    }

    this.worker = new Worker(new URL('../workers/pythonWorker.ts', import.meta.url), {
      type: 'module',
    });

    this.worker.onmessage = (event: MessageEvent<PythonWorkerResponse>) => {
      const pending = this.pending.get(event.data.id);
      if (!pending) {
        return;
      }

      this.pending.delete(event.data.id);
      pending.resolve(event.data);
    };

    this.worker.onerror = (event) => {
      for (const [id, pending] of this.pending) {
        window.clearTimeout(pending.timeout);
        pending.resolve({
          id,
          action: 'run',
          error: event.message || 'Python Worker 执行失败。',
        });
      }
      this.pending.clear();
      this.resetWorker();
    };

    return this.worker;
  }

  private resetWorker() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }

    for (const pending of this.pending.values()) {
      window.clearTimeout(pending.timeout);
    }
    this.pending.clear();
  }
}

function normalizeOutput(value: string) {
  return value.trim();
}
