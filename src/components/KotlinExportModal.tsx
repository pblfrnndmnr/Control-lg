import React, { useState } from 'react';
import { X, Code2, Copy, Check, Download, Layers, ShieldCheck, Radio, Wifi, Zap, Smartphone } from 'lucide-react';
import { playHapticClick, playSuccessBeep } from '../utils/audioFeedback.ts';

interface KotlinExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeIp?: string;
  activeMac?: string;
}

const KOTLIN_FILES = {
  LgWebOsClient: {
    filename: 'LgWebOsClient.kt',
    title: 'Cliente WebSocket SSAP',
    icon: Wifi,
    description: 'Conexión WebSocket (puertos 3001 TLS y 3000 WS), protocolo SSAP, gestión de client-key y heartbeat.',
    code: `package com.example.lgremote.network

import com.example.lgremote.security.LanSslHelper
import com.example.lgremote.security.TvKeyStore
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.serialization.json.*
import okhttp3.*
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicInteger

sealed class TvConnectionState {
    object Idle : TvConnectionState()
    data class Connecting(val message: String) : TvConnectionState()
    object PromptShownOnTv : TvConnectionState()
    data class PinRequired(val pin: String = "") : TvConnectionState()
    data class Connected(val clientKey: String, val ipAddress: String) : TvConnectionState()
    data class Error(val throwable: Throwable, val message: String) : TvConnectionState()
    object Disconnected : TvConnectionState()
}

class LgWebOsClient(
    private val keyStore: TvKeyStore,
    private val clientScope: CoroutineScope = CoroutineScope(Dispatchers.IO + SupervisorJob())
) : WebSocketListener() {

    private val httpClient: OkHttpClient = LanSslHelper.createSafeLanOkHttpClient()
    private var webSocket: WebSocket? = null
    private var targetIp: String = ""
    private var targetPort: Int = 3001
    private val requestId = AtomicInteger(1)

    private val _connectionState = MutableStateFlow<TvConnectionState>(TvConnectionState.Idle)
    val connectionState: StateFlow<TvConnectionState> = _connectionState.asStateFlow()

    private val pendingCallbacks = ConcurrentHashMap<String, (JsonObject?) -> Unit>()

    // Manifiesto con permisos exhaustivos para webOS 4.0, 5.0, 6.0, 22, 23 y 24
    private val webOsManifest: JsonObject = buildJsonObject {
        put("manifestVersion", 1)
        put("appVersion", "1.2.0")
        put("signed", buildJsonObject {
            put("created", "20240101")
            put("appId", "com.lge.thinq.remote.android")
            put("vendorId", "com.lge")
            put("localizedAppNames", buildJsonObject { put("", "Android LG Controller") })
            put("localizedVendorNames", buildJsonObject { put("", "LG Electronics") })
            put("permissions", buildJsonArray {
                listOf(
                    "CONTROL_AUDIO", "CONTROL_POWER", "CONTROL_TV_SCREEN",
                    "READ_INSTALLED_APPS", "READ_RUNNING_APPS", "READ_CURRENT_CHANNEL",
                    "READ_TV_CHANNEL_LIST", "WRITE_SETTINGS", "READ_SETTINGS",
                    "WRITE_NOTIFICATION_TOAST", "CONTROL_INPUT_TEXT",
                    "CONTROL_MOUSE_AND_KEYBOARD", "LAUNCH", "LAUNCH_WEBAPP", "APP_TO_APP", "CLOSE"
                ).forEach { add(it) }
            })
            put("serial", "2f930e2d2cdc08497f64013db10b51cc")
        })
        put("permissions", buildJsonArray {
            listOf(
                "LAUNCH", "LAUNCH_WEBAPP", "APP_TO_APP", "CLOSE", "TEST_OPEN",
                "TEST_SECURE", "CONTROL_AUDIO", "CONTROL_INPUT_TEXT",
                "CONTROL_MOUSE_AND_KEYBOARD", "READ_INSTALLED_APPS", "READ_CURRENT_CHANNEL",
                "READ_RUNNING_APPS", "WRITE_NOTIFICATION_TOAST", "READ_POWER_STATE",
                "READ_COUNTRY_INFO", "READ_SETTINGS", "WRITE_SETTINGS", "CONTROL_POWER",
                "CONTROL_TV_SCREEN", "READ_TV_CHANNEL_LIST", "READ_TV_CURRENT_TIME"
            ).forEach { add(it) }
        })
    }

    fun connect(ip: String, pairingType: String = "PROMPT") {
        targetIp = ip
        targetPort = 3001
        disconnect()

        _connectionState.value = TvConnectionState.Connecting("Conectando a $ip:3001 (WSS)...")
        initiateSocketConnection("wss://$ip:3001", pairingType)
    }

    private fun initiateSocketConnection(url: String, pairingType: String) {
        val request = Request.Builder().url(url).build()
        webSocket = httpClient.newWebSocket(request, this)
    }

    override fun onOpen(webSocket: WebSocket, response: Response) {
        clientScope.launch {
            _connectionState.value = TvConnectionState.Connecting("Enviando handshake de registro webOS...")
            sendRegistrationPayload()
        }
    }

    private fun sendRegistrationPayload() {
        val savedKey = keyStore.getClientKey(targetIp)
        val registrationId = "register_\${requestId.getAndIncrement()}"

        val payload = buildJsonObject {
            put("forcePairing", false)
            put("pairingType", "PROMPT")
            savedKey?.let { put("client-key", it) }
            put("manifest", webOsManifest)
        }

        val request = buildJsonObject {
            put("type", "register")
            put("id", registrationId)
            put("payload", payload)
        }

        webSocket?.send(request.toString())
    }

    override fun onMessage(webSocket: WebSocket, text: String) {
        clientScope.launch {
            try {
                val json = Json.parseToJsonElement(text).jsonObject
                val type = json["type"]?.jsonPrimitive?.content
                val payload = json["payload"]?.jsonObject

                when (type) {
                    "registered" -> {
                        val newKey = payload?.get("client-key")?.jsonPrimitive?.content
                        if (!newKey.isNullOrBlank()) {
                            keyStore.saveClientKey(targetIp, newKey)
                            _connectionState.value = TvConnectionState.Connected(newKey, targetIp)
                        }
                    }
                    "response" -> {
                        val pairingType = payload?.get("pairingType")?.jsonPrimitive?.content
                        if (pairingType == "PROMPT") {
                            _connectionState.value = TvConnectionState.PromptShownOnTv
                        } else if (pairingType == "PIN") {
                            _connectionState.value = TvConnectionState.PinRequired()
                        }
                        val reqId = json["id"]?.jsonPrimitive?.content
                        if (reqId != null) {
                            pendingCallbacks.remove(reqId)?.invoke(payload)
                        }
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
        clientScope.launch {
            if (targetPort == 3001) {
                targetPort = 3000
                _connectionState.value = TvConnectionState.Connecting("Fallback a puerto 3000 (ws)...")
                initiateSocketConnection("ws://$targetIp:3000", "PROMPT")
            } else {
                _connectionState.value = TvConnectionState.Error(t, t.localizedMessage ?: "Fallo de conexión")
            }
        }
    }

    fun sendCommand(uri: String, payload: JsonObject? = null, callback: ((JsonObject?) -> Unit)? = null) {
        val id = "req_\${requestId.getAndIncrement()}"
        if (callback != null) pendingCallbacks[id] = callback

        val request = buildJsonObject {
            put("id", id)
            put("type", "request")
            put("uri", uri)
            payload?.let { put("payload", it) }
        }
        webSocket?.send(request.toString())
    }

    fun setVolume(level: Int) = sendCommand("ssap://audio/setVolume", buildJsonObject { put("volume", level.coerceIn(0, 100)) })
    fun volumeUp() = sendCommand("ssap://audio/volumeUp")
    fun volumeDown() = sendCommand("ssap://audio/volumeDown")
    fun setMute(mute: Boolean) = sendCommand("ssap://audio/setMute", buildJsonObject { put("mute", mute) })
    fun play() = sendCommand("ssap://media.controls/play")
    fun pause() = sendCommand("ssap://media.controls/pause")
    fun stop() = sendCommand("ssap://media.controls/stop")
    fun launchApp(appId: String) = sendCommand("ssap://system.launcher/launch", buildJsonObject { put("id", appId) })
    fun turnOff() = sendCommand("ssap://system/turnOff")

    fun disconnect() {
        webSocket?.close(1000, "Cierre voluntario")
        webSocket = null
        _connectionState.value = TvConnectionState.Disconnected
    }
}`
  },
  SsdpDiscoveryClient: {
    filename: 'SsdpDiscoveryClient.kt',
    title: 'Descubrimiento SSDP (UDP)',
    icon: Radio,
    description: 'Búsqueda por UDP Multicast (239.255.255.250:1900) con M-SEARCH para encontrar televisores LG automáticos.',
    code: `package com.example.lgremote.discovery

import kotlinx.coroutines.*
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOn
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress
import java.net.SocketTimeoutException

data class DiscoveredTv(
    val ipAddress: String,
    val port: Int = 3001,
    val modelName: String,
    val locationXmlUrl: String
)

class SsdpDiscoveryClient(
    private val ioDispatcher: CoroutineDispatcher = Dispatchers.IO
) {
    companion object {
        private const val SSDP_MULTICAST_IP = "239.255.255.250"
        private const val SSDP_PORT = 1900
        private const val ST_WEBOS = "urn:lge-com:service:webos:secondscreen-1"
    }

    fun discoverDevices(timeoutMillis: Long = 5000L): Flow<DiscoveredTv> = flow {
        val discoveredIps = mutableSetOf<String>()
        val mSearchQuery = "M-SEARCH * HTTP/1.1\\r\\n" +
                "HOST: $SSDP_MULTICAST_IP:$SSDP_PORT\\r\\n" +
                "MAN: \\"ssdp:discover\\"\\r\\n" +
                "MX: 2\\r\\n" +
                "ST: $ST_WEBOS\\r\\n\\r\\n"

        var socket: DatagramSocket? = null
        try {
            socket = DatagramSocket().apply {
                soTimeout = 3000
                broadcast = true
            }

            val groupAddress = InetAddress.getByName(SSDP_MULTICAST_IP)
            val sendData = mSearchQuery.toByteArray(Charsets.UTF_8)
            val sendPacket = DatagramPacket(sendData, sendData.size, groupAddress, SSDP_PORT)
            
            socket.send(sendPacket)

            val startTime = System.currentTimeMillis()
            val buffer = ByteArray(4096)

            while (System.currentTimeMillis() - startTime < timeoutMillis) {
                try {
                    val receivePacket = DatagramPacket(buffer, buffer.size)
                    socket.receive(receivePacket)
                    val response = String(receivePacket.data, 0, receivePacket.length, Charsets.UTF_8)
                    val hostAddress = receivePacket.address.hostAddress ?: continue

                    if (discoveredIps.add(hostAddress)) {
                        val location = response.lines().firstOrNull { it.startsWith("LOCATION:", true) }?.substringAfter(":")?.trim()
                        val server = response.lines().firstOrNull { it.startsWith("SERVER:", true) }?.substringAfter(":")?.trim() ?: "LG Smart TV"
                        if (location != null) {
                            emit(DiscoveredTv(hostAddress, 3001, server, location))
                        }
                    }
                } catch (e: SocketTimeoutException) {
                    break
                }
            }
        } finally {
            socket?.close()
        }
    }.flowOn(ioDispatcher)
}`
  },
  LanSslHelper: {
    filename: 'LanSslHelper.kt',
    title: 'Bypass SSL para IPs Locales',
    icon: ShieldCheck,
    description: 'Permite el handshake WSS seguro con certificados autofirmados del TV LG sin desproteger conexiones externas.',
    code: `package com.example.lgremote.security

import okhttp3.OkHttpClient
import java.net.InetAddress
import java.security.SecureRandom
import java.security.cert.X509Certificate
import java.util.concurrent.TimeUnit
import javax.net.ssl.*

object LanSslHelper {

    fun createSafeLanOkHttpClient(): OkHttpClient {
        val trustAllManager = object : X509TrustManager {
            override fun checkClientTrusted(chain: Array<out X509Certificate>?, authType: String?) {}
            override fun checkServerTrusted(chain: Array<out X509Certificate>?, authType: String?) {}
            override fun getAcceptedIssuers(): Array<X509Certificate> = arrayOf()
        }

        val sslContext = SSLContext.getInstance("TLS").apply {
            init(null, arrayOf<TrustManager>(trustAllManager), SecureRandom())
        }

        val lanHostnameVerifier = HostnameVerifier { hostname, _ ->
            isPrivateLanAddress(hostname)
        }

        return OkHttpClient.Builder()
            .sslSocketFactory(sslContext.socketFactory, trustAllManager)
            .hostnameVerifier(lanHostnameVerifier)
            .pingInterval(8, TimeUnit.SECONDS) // Keep-Alive Heartbeat
            .connectTimeout(5, TimeUnit.SECONDS)
            .readTimeout(0, TimeUnit.MILLISECONDS)
            .retryOnConnectionFailure(true)
            .build()
    }

    private fun isPrivateLanAddress(host: String): Boolean {
        return try {
            val addr = InetAddress.getByName(host)
            addr.isSiteLocalAddress || addr.isLoopbackAddress
        } catch (e: Exception) {
            host.startsWith("192.168.") || host.startsWith("10.") || host.startsWith("172.")
        }
    }
}`
  },
  WakeOnLanHelper: {
    filename: 'WakeOnLanHelper.kt',
    title: 'Encendido Remoto (WoWLAN)',
    icon: Zap,
    description: 'Generación y envío del Magic Packet UDP de 102 bytes a la dirección MAC del televisor.',
    code: `package com.example.lgremote.wol

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress

object WakeOnLanHelper {

    suspend fun wakeUpTv(macAddress: String, broadcastIp: String = "255.255.255.255", port: Int = 9): Result<Unit> = withContext(Dispatchers.IO) {
        runCatching {
            val cleanMac = macAddress.replace(":", "").replace("-", "").trim()
            require(cleanMac.length == 12) { "MAC inválida: $macAddress" }

            val macBytes = ByteArray(6) { index ->
                cleanMac.substring(index * 2, index * 2 + 2).toInt(16).toByte()
            }

            val packetBuffer = ByteArray(102)
            for (i in 0 until 6) packetBuffer[i] = 0xFF.toByte()
            for (rep in 0 until 16) System.arraycopy(macBytes, 0, packetBuffer, 6 + (rep * 6), 6)

            DatagramSocket().use { socket ->
                socket.broadcast = true
                val address = InetAddress.getByName(broadcastIp)
                val packet = DatagramPacket(packetBuffer, packetBuffer.size, address, port)
                repeat(3) {
                    socket.send(packet)
                    Thread.sleep(80)
                }
            }
        }
    }
}`
  }
};

export const KotlinExportModal: React.FC<KotlinExportModalProps> = ({
  isOpen,
  onClose,
  activeIp = '192.168.1.105',
  activeMac = 'A4:08:01:2C:9E:54'
}) => {
  const [selectedKey, setSelectedKey] = useState<keyof typeof KOTLIN_FILES>('LgWebOsClient');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const currentFile = KOTLIN_FILES[selectedKey];

  const handleCopy = () => {
    playHapticClick(700);
    navigator.clipboard.writeText(currentFile.code);
    setCopied(true);
    playSuccessBeep();
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownload = () => {
    playHapticClick(650);
    const blob = new Blob([currentFile.code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = currentFile.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    playSuccessBeep();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800/80 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
              <Code2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                Módulo Nativo Android (Kotlin)
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-400 border border-indigo-800/60">
                  webOS 4.0+
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Código Kotlin de producción listo para Android Studio y Jetpack Compose
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              playHapticClick(400);
              onClose();
            }}
            className="w-9 h-9 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* File Tabs */}
        <div className="flex items-center gap-1.5 p-2 bg-slate-950/40 border-b border-slate-800/60 overflow-x-auto no-scrollbar">
          {(Object.keys(KOTLIN_FILES) as Array<keyof typeof KOTLIN_FILES>).map((key) => {
            const file = KOTLIN_FILES[key];
            const Icon = file.icon;
            const isSelected = selectedKey === key;
            return (
              <button
                key={key}
                onClick={() => {
                  playHapticClick(500);
                  setSelectedKey(key);
                }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {file.filename}
              </button>
            );
          })}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 flex flex-col gap-4">
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-sm font-bold text-white flex items-center gap-2">
                <span>{currentFile.title}</span>
                <span className="text-xs text-slate-400 font-mono">({currentFile.filename})</span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{currentFile.description}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copiado' : 'Copiar'}
              </button>
              <button
                onClick={handleDownload}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shadow-sm shadow-indigo-600/30 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Descargar
              </button>
            </div>
          </div>

          {/* Code Viewer */}
          <div className="relative rounded-2xl bg-slate-950 border border-slate-800/90 overflow-hidden shadow-inner">
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800/80 bg-slate-950 text-[11px] text-slate-400 font-mono">
              <span>{currentFile.filename}</span>
              <span>Kotlin 1.9+ / 2.0+</span>
            </div>
            <pre className="p-4 text-xs font-mono text-slate-300 overflow-x-auto leading-relaxed max-h-[46vh]">
              <code>{currentFile.code}</code>
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/60 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            TV actual: <strong className="text-indigo-400 font-mono">{activeIp}</strong>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
