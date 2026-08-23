import { run } from './cli/run';

/**
 * Executable entry point. The only file that touches `process` — all logic lives in
 * `cli/run.ts`, which returns an exit code instead of terminating.
 */
const main = async (): Promise<void> => {
  // `quran-search-engine "رحمة" --format json | head -1` closes the pipe while we are still
  // writing. That is an ordinary shell idiom, so exit quietly instead of reporting a crash.
  const exitQuietlyOnBrokenPipe = (error: Error & { code?: string }): void => {
    if (error.code === 'EPIPE') {
      process.exit(0);
    }
    throw error;
  };
  process.stdout.on('error', exitQuietlyOnBrokenPipe);
  process.stderr.on('error', exitQuietlyOnBrokenPipe);

  const code = await run(process.argv.slice(2), {
    stdout: (text) => {
      process.stdout.write(text);
    },
    stderr: (text) => {
      process.stderr.write(text);
    },
  });

  // Set the code and let the process end on its own. Calling process.exit() here would
  // discard whatever is still queued in stdout: when stdout is a pipe, writes are
  // asynchronous, and anything past the 64 KB pipe buffer had not been flushed yet — so
  // `--format json | jq .` silently received truncated JSON.
  process.exitCode = code;
};

void main();
