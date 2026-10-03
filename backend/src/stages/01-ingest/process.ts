/**
 * Запуск внешних программ (yt-dlp, ffmpeg) и сбор их вывода.
 * Вынесено отдельно, чтобы не повторять обработку ошибок и отмены в каждом месте.
 */
import { spawn } from "node:child_process";

/**
 * Запускает программу и возвращает всё, что она напечатала в stdout, как байты.
 * - signal: если пользователь закрыл вкладку, процесс убивается.
 * - если программа завершилась с ошибкой, бросаем Error с последними строками stderr (там причина).
 */
export function run(cmd: string, args: string[], signal: AbortSignal): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { signal, stdio: ["ignore", "pipe", "pipe"] });
    const out: Buffer[] = [];
    let err = "";
    child.stdout.on("data", (b: Buffer) => out.push(b));
    child.stderr.on("data", (b: Buffer) => (err = (err + b.toString()).slice(-2000)));
    child.on("error", (e) =>
      reject(
        (e as NodeJS.ErrnoException).code === "ENOENT"
          ? new Error(`${cmd} не установлен (brew install ${cmd})`)
          : e,
      ),
    );
    child.on("close", (code) => {
      if (code === 0) resolve(Buffer.concat(out));
      else
        reject(
          new Error(`${cmd} завершился с кодом ${code}: ${err.trim().split("\n").slice(-3).join(" | ")}`),
        );
    });
  });
}
