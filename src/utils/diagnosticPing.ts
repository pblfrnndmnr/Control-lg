/**
 * LG TV Port Diagnostic Tool
 * Uses fetch with mode: 'no-cors' to ping port 3001 (and 3000)
 * to verify if physical LG Smart TVs respond over LAN before WebSocket pairing.
 */

export interface DiagnosticResult {
  ip: string;
  port: number;
  isOpen: boolean;
  status: 'open' | 'blocked' | 'timeout';
  latencyMs: number;
  message: string;
  details: string;
  timestamp: number;
}

export interface DiagnosticEvaluation {
  badgeColor: string;
  textColor: string;
  borderColor: string;
  label: string;
  iconType: 'open' | 'blocked' | 'idle';
}

/**
 * Pings port 3001 using fetch with mode 'no-cors' over HTTPS
 * Checks if the TV's TLS/WSS port is alive and reachable by the browser.
 */
export async function pingPort3001(
  ip: string,
  timeoutMs: number = 3000,
  fetchFn?: typeof fetch
): Promise<DiagnosticResult> {
  const cleanIp = ip.trim();
  const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const fetchToUse = fetchFn || (typeof fetch !== 'undefined' ? fetch : undefined);

  if (!cleanIp) {
    return {
      ip: '',
      port: 3001,
      isOpen: false,
      status: 'blocked',
      latencyMs: 0,
      message: 'Dirección IP vacía',
      details: 'Por favor ingresa una dirección IP válida (ej. 192.168.1.100).',
      timestamp: Date.now(),
    };
  }

  if (!fetchToUse) {
    return {
      ip: cleanIp,
      port: 3001,
      isOpen: false,
      status: 'blocked',
      latencyMs: 0,
      message: 'Fetch API no disponible',
      details: 'El entorno actual no dispone de soporte para la API fetch.',
      timestamp: Date.now(),
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // Mode 'no-cors' allows performing the TCP/TLS handshake without CORS preflight failures
    const url = `https://${cleanIp}:3001`;
    const res = await fetchToUse(url, {
      method: 'GET',
      mode: 'no-cors',
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timer);

    const endTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const latencyMs = Math.max(1, Math.round(endTime - startTime));

    return {
      ip: cleanIp,
      port: 3001,
      isOpen: true,
      status: 'open',
      latencyMs,
      message: `Puerto 3001 Abierto y Respondiendo (${latencyMs}ms)`,
      details: `El televisor respondió con éxito vía TLS en el puerto 3001 (tipo de respuesta: ${res?.type || 'opaque'}). El canal seguro está disponible para conexión WebSocket.`,
      timestamp: Date.now(),
    };
  } catch (err: any) {
    clearTimeout(timer);
    const endTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const latencyMs = Math.round(endTime - startTime);

    const isTimeout =
      err?.name === 'AbortError' ||
      err?.name === 'TimeoutError' ||
      err?.message?.toLowerCase().includes('timeout') ||
      err?.message?.toLowerCase().includes('aborted');

    if (isTimeout) {
      return {
        ip: cleanIp,
        port: 3001,
        isOpen: false,
        status: 'timeout',
        latencyMs,
        message: `Puerto 3001 Bloqueado / Tiempo Agotado (>${timeoutMs}ms)`,
        details: `El televisor en ${cleanIp} no respondió dentro de ${timeoutMs}ms. Comprueba que el televisor esté encendido, conectado a la misma red Wi-Fi y no bloqueado por un firewall.`,
        timestamp: Date.now(),
      };
    }

    return {
      ip: cleanIp,
      port: 3001,
      isOpen: false,
      status: 'blocked',
      latencyMs,
      message: 'Puerto 3001 Bloqueado / Certificado No Autorizado',
      details: `El navegador rechazó la conexión a https://${cleanIp}:3001 (${err?.message || 'Failed to fetch'}). Debes autorizar el certificado SSL en Chrome haciendo clic en el enlace de autorización o usar el Control Local .html.`,
      timestamp: Date.now(),
    };
  }
}

/**
 * Pings port 3000 using fetch with mode 'no-cors' over HTTP
 * (The basic HTTP webOS server that returns "hello world")
 */
export async function pingPort3000(
  ip: string,
  timeoutMs: number = 2500,
  fetchFn?: typeof fetch
): Promise<DiagnosticResult> {
  const cleanIp = ip.trim();
  const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const fetchToUse = fetchFn || (typeof fetch !== 'undefined' ? fetch : undefined);

  if (!cleanIp) {
    return {
      ip: '',
      port: 3000,
      isOpen: false,
      status: 'blocked',
      latencyMs: 0,
      message: 'Dirección IP vacía',
      details: 'Por favor ingresa una dirección IP válida.',
      timestamp: Date.now(),
    };
  }

  if (!fetchToUse) {
    return {
      ip: cleanIp,
      port: 3000,
      isOpen: false,
      status: 'blocked',
      latencyMs: 0,
      message: 'Fetch API no disponible',
      details: 'El entorno actual no dispone de soporte para la API fetch.',
      timestamp: Date.now(),
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url = `http://${cleanIp}:3000`;
    const res = await fetchToUse(url, {
      method: 'GET',
      mode: 'no-cors',
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timer);

    const endTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const latencyMs = Math.max(1, Math.round(endTime - startTime));

    return {
      ip: cleanIp,
      port: 3000,
      isOpen: true,
      status: 'open',
      latencyMs,
      message: `Puerto 3000 Abierto (HTTP "Hello World" ${latencyMs}ms)`,
      details: `El servidor HTTP básico del TV respondió en el puerto 3000 (tipo: ${res?.type || 'opaque'}). Confirma que el TV está vivo.`,
      timestamp: Date.now(),
    };
  } catch (err: any) {
    clearTimeout(timer);
    const endTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const latencyMs = Math.round(endTime - startTime);

    const isTimeout =
      err?.name === 'AbortError' ||
      err?.name === 'TimeoutError' ||
      err?.message?.toLowerCase().includes('aborted');

    return {
      ip: cleanIp,
      port: 3000,
      isOpen: false,
      status: isTimeout ? 'timeout' : 'blocked',
      latencyMs,
      message: isTimeout
        ? `Puerto 3000 Sin Respuesta (Tiempo Agotado >${timeoutMs}ms)`
        : 'Puerto 3000 Bloqueado por el Navegador (Mixed Content)',
      details: `Error al probar http://${cleanIp}:3000: ${err?.message || 'Failed to fetch'}. En páginas HTTPS, Chrome bloquea HTTP plano.`,
      timestamp: Date.now(),
    };
  }
}

/**
 * Returns formatted visual styling metadata based on diagnostic ping status
 */
export function evaluateDiagnosticStatus(result: DiagnosticResult | null): DiagnosticEvaluation {
  if (!result) {
    return {
      badgeColor: 'bg-slate-800',
      textColor: 'text-slate-400',
      borderColor: 'border-slate-700',
      label: 'No probado',
      iconType: 'idle',
    };
  }

  if (result.isOpen) {
    return {
      badgeColor: 'bg-emerald-950/80',
      textColor: 'text-emerald-300',
      borderColor: 'border-emerald-500/40',
      label: `Puerto Abierto (${result.latencyMs}ms)`,
      iconType: 'open',
    };
  }

  return {
    badgeColor: 'bg-rose-950/80',
    textColor: 'text-rose-300',
    borderColor: 'border-rose-500/40',
    label: result.status === 'timeout' ? 'Puerto Bloqueado (Timeout)' : 'Puerto Bloqueado',
    iconType: 'blocked',
  };
}
