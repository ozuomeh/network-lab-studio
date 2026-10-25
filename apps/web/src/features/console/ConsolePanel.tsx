import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

export interface ConsolePanelProps {
  labId: string;
  nodeId: string;
  visible: boolean;
}

function safeFit(fitAddon: FitAddon): void {
  try {
    fitAddon.fit();
  } catch {
    // xterm's FitAddon can throw if called before the terminal's renderer
    // has finished its first layout pass (e.g. container briefly has zero
    // size, or a React StrictMode double-effect disposed the terminal
    // mid-setup in dev). Safe to ignore — the next resize/fit succeeds.
  }
}

export function ConsolePanel({ labId, nodeId, visible }: ConsolePanelProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;
    const term = new Terminal({ convertEol: true, cursorBlink: true });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(container);
    requestAnimationFrame(() => {
      if (!disposed) safeFit(fitAddon);
    });

    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${protocol}://${window.location.host}/api/labs/${labId}/nodes/${nodeId}/console`);
    ws.binaryType = "arraybuffer";

    ws.onmessage = (event) => {
      if (typeof event.data === "string") {
        term.write(event.data);
      } else {
        term.write(new Uint8Array(event.data as ArrayBuffer));
      }
    };
    ws.onclose = () => {
      if (!disposed) term.write("\r\n\x1b[31m[console closed]\x1b[0m\r\n");
    };
    ws.onerror = () => {
      if (!disposed) term.write("\r\n\x1b[31m[console error]\x1b[0m\r\n");
    };

    const dataDisposable = term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(data);
    });

    // Debounced: calling fit() inside a ResizeObserver on the same element
    // it resizes can otherwise trigger a resize feedback loop that pegs the
    // main thread (observed firsthand — a screenshot call hung 120s while
    // this fired unthrottled).
    let resizeTimer: ReturnType<typeof setTimeout> | undefined;
    const resizeObserver = new ResizeObserver(() => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (!disposed) safeFit(fitAddon);
      }, 100);
    });
    resizeObserver.observe(container);

    return () => {
      disposed = true;
      clearTimeout(resizeTimer);
      dataDisposable.dispose();
      resizeObserver.disconnect();
      ws.close();
      term.dispose();
    };
  }, [labId, nodeId]);

  return <div ref={containerRef} style={{ width: "100%", height: "100%", display: visible ? "block" : "none" }} />;
}
