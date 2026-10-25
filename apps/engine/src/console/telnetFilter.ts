const IAC = 0xff;
const SB = 0xfa;
const SE = 0xf0;

/**
 * Strips Telnet IAC negotiation sequences from a byte stream so they don't
 * show up as garbage in the terminal. QEMU's own `-serial telnet:...`
 * backend sends these at connection time (confirmed against a real QEMU
 * process in manual testing — raw control-byte noise preceded the actual
 * shell output). We don't need to answer the negotiation for the console to
 * work, just avoid displaying it: handles simple 3-byte commands
 * (IAC <cmd> <option>), escaped 0xFF literals (IAC IAC), and SB...SE
 * subnegotiation blocks.
 */
export function stripTelnetIAC(input: Buffer): Buffer {
  const out: number[] = [];
  let i = 0;
  while (i < input.length) {
    const byte = input[i]!;
    if (byte === IAC) {
      const cmd = input[i + 1];
      if (cmd === IAC) {
        out.push(IAC);
        i += 2;
        continue;
      }
      if (cmd === SB) {
        let j = i + 2;
        while (j < input.length - 1 && !(input[j] === IAC && input[j + 1] === SE)) j++;
        i = j + 2;
        continue;
      }
      i += 3; // IAC <cmd> <option>
      continue;
    }
    out.push(byte);
    i++;
  }
  return Buffer.from(out);
}
