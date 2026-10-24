#!/usr/bin/env python3
"""
LG webOS Smart TV Controller - Script de Control Real
Compatible con LG webOS 3.5, 4.0, 5.0, 6.0, 22, 23 y 24 (OLED, QNED, NanoCell, UHD).

Dependencias recomendadas:
    pip install bscpylgtv websockets wakeonlan
"""

import sys
import os
import json
import socket
import asyncio
import argparse
from typing import Optional

CONFIG_FILE = "lg_tv_config.json"

# ==============================================================================
# 1. WAKE-ON-LAN (ENCENDIDO POR WI-FI / ETHERNET)
# ==============================================================================
def send_wake_on_lan(mac_address: str, broadcast_ip: str = "255.255.255.255", port: int = 9) -> bool:
    """
    Envía el paquete mágico Wake-on-LAN (102 bytes) al televisor LG.
    Funciona sin librerías externas utilizando únicamente sockets UDP nativos de Python.
    """
    clean_mac = mac_address.replace(":", "").replace("-", "").strip()
    if len(clean_mac) != 12:
        raise ValueError(f"Dirección MAC inválida: {mac_address}")

    # Paquete mágico: 6 bytes de 0xFF seguido de 16 repeticiones de la dirección MAC
    mac_bytes = bytes.fromhex(clean_mac)
    magic_packet = b"\xff" * 6 + mac_bytes * 16

    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
        sock.sendto(magic_packet, (broadcast_ip, port))
    
    print(f"[OK] Paquete Wake-On-LAN emitido a la MAC {mac_address}")
    return True


# ==============================================================================
# 2. CONTROLADOR WEBSOCKET (webOS SSAP PROTOCOL)
# ==============================================================================
class LGWebOSTV:
    def __init__(self, ip: str, mac: Optional[str] = None, key_file: str = CONFIG_FILE):
        self.ip = ip
        self.mac = mac
        self.key_file = key_file
        self.client_key = self._load_client_key()

    def _load_client_key(self) -> Optional[str]:
        if os.path.exists(self.key_file):
            try:
                with open(self.key_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    return data.get(self.ip, {}).get("client_key")
            except Exception:
                return None
        return None

    def _save_client_key(self, key: str):
        data = {}
        if os.path.exists(self.key_file):
            try:
                with open(self.key_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
            except Exception:
                data = {}
        if self.ip not in data:
            data[self.ip] = {}
        data[self.ip]["client_key"] = key
        if self.mac:
            data[self.ip]["mac"] = self.mac
        with open(self.key_file, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
        print(f"[INFO] Llave de emparejamiento guardada en {self.key_file}")

    async def execute_command(self, action: str, **kwargs):
        """
        Ejecuta comandos usando bscpylgtv (el cliente moderno más robusto para webOS).
        Si no está instalado bscpylgtv, usa websockets nativo.
        """
        try:
            from bscpylgtv import WebOsClient
        except ImportError:
            print("[AVISO] Para control avanzado instala: pip install bscpylgtv")
            await self._execute_native_websocket(action, **kwargs)
            return

        client = await WebOsClient.create(
            self.ip,
            client_key=self.client_key,
            ping_interval=None,
            states=[]
        )

        try:
            await client.connect()
            if not self.client_key and client.client_key:
                self.client_key = client.client_key
                self._save_client_key(client.client_key)

            print(f"[CONECTADO] LG webOS en {self.ip}")

            # Ejecutar acción
            if action == "turn_off":
                await client.power_off()
                print("[OK] Televisor apagado.")

            elif action == "volume_up":
                await client.volume_up()
                print("[OK] Volumen aumentado.")

            elif action == "volume_down":
                await client.volume_down()
                print("[OK] Volumen reducido.")

            elif action == "set_volume":
                vol = kwargs.get("volume", 20)
                await client.set_volume(int(vol))
                print(f"[OK] Volumen fijado en {vol}%.")

            elif action == "mute":
                mute_state = kwargs.get("state", True)
                await client.set_mute(mute_state)
                print(f"[OK] Silencio (Mute): {mute_state}")

            elif action == "launch_app":
                app_name = kwargs.get("app", "youtube").lower()
                app_map = {
                    "netflix": "netflix",
                    "youtube": "youtube.leanback.v4",
                    "prime": "amazon",
                    "disney": "com.disney.disneyplus-prod",
                    "spotify": "spotify-medialink",
                    "appletv": "com.apple.appletv",
                    "browser": "com.webos.app.browser",
                }
                app_id = app_map.get(app_name, app_name)
                await client.launch_app(app_id)
                print(f"[OK] Aplicación iniciada: {app_id}")

            elif action == "switch_input":
                inp = kwargs.get("input", "HDMI_2")
                # Las entradas en LG webOS suelen ser HDMI_1, HDMI_2, etc.
                await client.set_input(inp.replace("hdmi", "HDMI_"))
                print(f"[OK] Entrada cambiada a {inp}")

            elif action == "home":
                await client.button("HOME")
                print("[OK] Botón HOME presionado.")

            elif action == "ok":
                await client.button("ENTER")
                print("[OK] Botón ENTER / OK presionado.")

            elif action == "back":
                await client.button("BACK")
                print("[OK] Botón ATRÁS presionado.")

            elif action == "dpad":
                direction = kwargs.get("direction", "UP").upper()
                await client.button(direction)
                print(f"[OK] Dirección {direction} enviada.")

            elif action == "sleep_timer":
                minutes = kwargs.get("minutes", 30)
                print(f"[OK] Temporizador de apagado configurado para {minutes} minutos.")
                try:
                    await client.system_notification(f"Temporizador de apagado activado: {minutes} minutos")
                except Exception:
                    pass
                print(f"[INFO] Esperando {minutes} minutos para apagar el televisor...")
                await asyncio.sleep(minutes * 60)
                await client.power_off()
                print(f"[OK] Televisor apagado por temporizador ({minutes} min).")

        finally:
            await client.disconnect()

    async def _execute_native_websocket(self, action: str, **kwargs):
        """Fallback usando websockets directo sin bscpylgtv"""
        import websockets
        import ssl

        ssl_ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
        ssl_ctx.check_hostname = False
        ssl_ctx.verify_mode = ssl.CERT_NONE

        # Registro de Handshake SSAP de LG
        handshake = {
            "type": "register",
            "id": "register_0",
            "payload": {
                "forcePairing": False,
                "pairingType": "PROMPT",
                "client-key": self.client_key,
                "manifest": {
                    "manifestVersion": 1,
                    "appVersion": "1.0",
                    "signed": {
                        "created": "20261022",
                        "appId": "com.lge.remote.python",
                        "vendorId": "com.lge",
                        "localizedAppNames": {"": "LG Remote Python"},
                        "permissions": [
                            "LAUNCH", "CONTROL_AUDIO", "CONTROL_POWER", "READ_INSTALLED_APPS"
                        ],
                    },
                },
            },
        }

        uri = f"wss://{self.ip}:3001"
        print(f"[INFO] Conectando a {uri} (Revisa si aparece aviso en la pantalla del TV)...")
        async with websockets.connect(uri, ssl=ssl_ctx) as ws:
            await ws.send(json.dumps(handshake))
            resp = await ws.recv()
            data = json.loads(resp)

            # Si el televisor devuelve una nueva llave tras presionar 'Aceptar' en el TV
            if "client-key" in data.get("payload", {}):
                new_key = data["payload"]["client-key"]
                self.client_key = new_key
                self._save_client_key(new_key)

            # Mapeo básico de comandos SSAP
            commands = {
                "turn_off": "ssap://system/turnOff",
                "volume_up": "ssap://audio/volumeUp",
                "volume_down": "ssap://audio/volumeDown",
                "mute": "ssap://audio/setMute",
            }

            if action in commands:
                req = {
                    "type": "request",
                    "id": "cmd_1",
                    "uri": commands[action],
                    "payload": {}
                }
                if action == "mute":
                    req["payload"] = {"mute": kwargs.get("state", True)}
                await ws.send(json.dumps(req))
                print(f"[OK] Comando {action} enviado exitosamente.")


# ==============================================================================
# 3. INTERFAZ DE LÍNEA DE COMANDOS (CLI)
# ==============================================================================
def main():
    parser = argparse.ArgumentParser(description="Control Remoto LG webOS en Python")
    parser.add_argument("--ip", required=True, help="Dirección IP del televisor LG (ej. 192.168.1.105)")
    parser.add_argument("--mac", help="Dirección MAC del televisor para Wake-on-LAN (ej. A4:08:01:2C:9E:54)")
    parser.add_argument("--power-on", action="store_true", help="Encender el televisor por Wi-Fi (WoL)")
    parser.add_argument("--power-off", action="store_true", help="Apagar el televisor")
    parser.add_argument("--vol-up", action="store_true", help="Subir volumen (+1)")
    parser.add_argument("--vol-down", action="store_true", help="Bajar volumen (-1)")
    parser.add_argument("--set-vol", type=int, help="Fijar nivel de volumen (0-100)")
    parser.add_argument("--mute", action="store_true", help="Silenciar audio")
    parser.add_argument("--unmute", action="store_true", help="Restablecer audio")
    parser.add_argument("--app", choices=["netflix", "youtube", "prime", "disney", "spotify", "browser"], help="Lanzar aplicación")
    parser.add_argument("--input", choices=["HDMI_1", "HDMI_2", "HDMI_3", "HDMI_4"], help="Cambiar entrada HDMI")
    parser.add_argument("--home", action="store_true", help="Abrir menú webOS Home")
    parser.add_argument("--sleep-timer", type=int, choices=[30, 60, 90], help="Temporizador de apagado en minutos (30, 60, 90)")
    parser.add_argument("--interactive", action="store_true", help="Abrir menú interactivo en terminal")

    args = parser.parse_args()

    # Si se pide encendido
    if args.power_on:
        if not args.mac:
            print("[ERROR] Debes proporcionar la dirección MAC (--mac XX:XX:XX:XX:XX:XX) para encender el TV por Wi-Fi.")
            sys.exit(1)
        send_wake_on_lan(args.mac)
        return

    tv = LGWebOSTV(ip=args.ip, mac=args.mac)

    async def run():
        if args.power_off:
            await tv.execute_command("turn_off")
        elif args.vol_up:
            await tv.execute_command("volume_up")
        elif args.vol_down:
            await tv.execute_command("volume_down")
        elif args.set_vol is not None:
            await tv.execute_command("set_volume", volume=args.set_vol)
        elif args.mute:
            await tv.execute_command("mute", state=True)
        elif args.unmute:
            await tv.execute_command("mute", state=False)
        elif args.app:
            await tv.execute_command("launch_app", app=args.app)
        elif args.input:
            await tv.execute_command("switch_input", input=args.input)
        elif args.home:
            await tv.execute_command("home")
        elif args.sleep_timer:
            await tv.execute_command("sleep_timer", minutes=args.sleep_timer)
        elif args.interactive:
            await interactive_menu(tv)
        else:
            parser.print_help()

    asyncio.run(run())


async def interactive_menu(tv: LGWebOSTV):
    print("\n" + "=" * 50)
    print("   CONTROL REMOTO LG webOS - MODO INTERACTIVO")
    print("=" * 50)
    print("1. Subir Volumen (+)")
    print("2. Bajar Volumen (-)")
    print("3. Alternar Silencio (Mute)")
    print("4. Abrir YouTube")
    print("5. Abrir Netflix")
    print("6. Cambiar a HDMI 2 (eARC)")
    print("7. Menú Home webOS")
    print("8. Encender (Wake-on-LAN)")
    print("9. Apagar TV")
    print("0. Salir")
    print("=" * 50)

    while True:
        choice = input("\nElige una opción: ").strip()
        if choice == "1":
            await tv.execute_command("volume_up")
        elif choice == "2":
            await tv.execute_command("volume_down")
        elif choice == "3":
            await tv.execute_command("mute", state=True)
        elif choice == "4":
            await tv.execute_command("launch_app", app="youtube")
        elif choice == "5":
            await tv.execute_command("launch_app", app="netflix")
        elif choice == "6":
            await tv.execute_command("switch_input", input="HDMI_2")
        elif choice == "7":
            await tv.execute_command("home")
        elif choice == "8":
            if tv.mac:
                send_wake_on_lan(tv.mac)
            else:
                mac = input("Ingresa la MAC de tu TV: ")
                send_wake_on_lan(mac)
        elif choice == "9":
            await tv.execute_command("turn_off")
        elif choice == "0":
            print("Saliendo...")
            break
        else:
            print("Opción inválida.")


if __name__ == "__main__":
    main()
