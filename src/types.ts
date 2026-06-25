export type LanguageId = 'python' | 'cpp';

export type Difficulty = '入门' | '基础' | '进阶';

export type DiagnosticSeverity = 'info' | 'warning' | 'error';

export type RuntimeStatus = 'idle' | 'success' | 'error' | 'timeout';

export interface TestCase {
  name: string;
  stdin: string;
  expectedStdout: string;
}

export interface Problem {
  id: string;
  title: string;
  difficulty: Difficulty;
  description: string;
  inputDescription: string;
  outputDescription: string;
  samples: TestCase[];
  starterCode: string;
  testCases: TestCase[];
}

export interface Diagnostic {
  message: string;
  severity: DiagnosticSeverity;
  line?: number;
  column?: number;
  source: 'python' | 'runtime' | 'judge';
}

export interface CompileResult {
  status: Exclude<RuntimeStatus, 'idle'>;
  diagnostics: Diagnostic[];
  bytecodePreview?: string;
  durationMs: number;
}

export interface RunResult {
  status: Exclude<RuntimeStatus, 'idle'>;
  stdout: string;
  stderr: string;
  error?: string;
  durationMs: number;
}

export interface JudgeCaseResult {
  name: string;
  status: 'passed' | 'failed' | 'error' | 'timeout';
  stdin: string;
  expectedStdout: string;
  actualStdout: string;
  stderr: string;
  error?: string;
  durationMs: number;
}

export interface JudgeResult {
  status: 'passed' | 'failed' | 'error';
  passed: number;
  total: number;
  cases: JudgeCaseResult[];
  durationMs: number;
}

export type PythonWorkerAction = 'compile' | 'run';

export interface PythonWorkerRequest {
  id: number;
  action: PythonWorkerAction;
  source: string;
  stdin?: string;
}

export interface PythonWorkerResponse {
  id: number;
  action: PythonWorkerAction;
  result?: CompileResult | RunResult;
  error?: string;
}
