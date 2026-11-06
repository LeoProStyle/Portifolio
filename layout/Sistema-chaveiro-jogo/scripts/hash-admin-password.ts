// Prints the value for ADMIN_PASSWORD_HASH.
// Usage: npm run hash-password            (asks twice, input hidden)
//        <password source> | npm run hash-password   (reads the first line of stdin)
// The password is never taken from argv, so it does not land in the shell history.
// Only the hash goes to stdout; prompts and errors go to stderr.
import { createInterface } from 'node:readline';
import { hashPassword } from '../lib/password';

function promptHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stderr, terminal: true });
    const output = rl as unknown as { _writeToOutput: (text: string) => void };
    let prompted = false;
    output._writeToOutput = (text: string) => {
      // Show the prompt once and nothing typed after it.
      if (!prompted) {
        process.stderr.write(text);
        prompted = true;
      }
    };
    rl.question(question, (answer) => {
      process.stderr.write('\n');
      rl.close();
      resolve(answer);
    });
  });
}

async function readFirstLine(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8').split(/\r?\n/)[0] ?? '';
}

async function main() {
  let password: string;
  if (process.stdin.isTTY) {
    password = await promptHidden('Nova senha do admin: ');
    const again = await promptHidden('Repita a senha: ');
    if (password !== again) {
      process.stderr.write('As senhas não conferem.\n');
      process.exit(1);
    }
  } else {
    password = await readFirstLine();
  }

  if (!password) {
    process.stderr.write('Senha vazia: nada foi gerado.\n');
    process.exit(1);
  }

  process.stdout.write(`${await hashPassword(password)}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`Falha ao gerar o hash: ${error instanceof Error ? error.name : 'erro desconhecido'}\n`);
  process.exit(1);
});
