import { spawn } from "child_process";
import { createReadStream, unlink } from "fs";
import { writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import crypto from "crypto";

export async function synthesize(text) {
  const pythonCmd = process.env.PIPER_PYTHON || "python";
  const modelPath = process.env.PIPER_MODEL_PATH;

  if (!modelPath) {
    throw new Error("PIPER_MODEL_PATH env variable is not set.");
  }

  const id = crypto.randomUUID();

  const inputFile = join(tmpdir(), `${id}.txt`);
  const outputFile = join(tmpdir(), `${id}.wav`);

  await writeFile(inputFile, text, "utf8");

  return new Promise((resolve, reject) => {
    const args = [
      "-m",
      "piper",
      "-m",
      modelPath,
      "-i",
      inputFile,
      "-f",
      outputFile
    ];

    const piper = spawn(pythonCmd, args);

    let errorOutput = "";

    piper.stderr.on("data", (data) => {
      errorOutput += data.toString();
    });

    piper.on("error", (err) => {
      reject(err);
    });

    piper.on("close", (code) => {
      if (code !== 0) {
        return reject(
          new Error(`Piper exited with code ${code}\n${errorOutput}`)
        );
      }

      const stream = createReadStream(outputFile);

      stream.on("close", () => {
        unlink(inputFile, () => {});
        unlink(outputFile, () => {});
      });

      resolve(stream);
    });
  });
}