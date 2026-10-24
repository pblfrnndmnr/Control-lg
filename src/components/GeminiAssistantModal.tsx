import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Send,
  X,
  Upload,
  BrainCircuit,
  Tv,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Zap,
  Volume2,
  Power,
  Sliders,
  ChevronRight,
} from 'lucide-react';
import type { ChatMessage, TVState } from '../types.ts';
import { playHapticClick, playSuccessBeep } from '../utils/audioFeedback.ts';

interface GeminiAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  tvState: TVState;
  onExecuteCommand: (action: string, value?: any) => void;
}

export const GeminiAssistantModal: React.FC<GeminiAssistantModalProps> = ({
  isOpen,
  onClose,
  tvState,
  onExecuteCommand,
}) => {
  const [activeTab, setActiveTab] = useState<'chat' | 'image' | 'thinking'>('chat');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'assistant',
      content:
        '¡Hola! Soy tu asistente inteligente LG ThinQ con Gemini. Puedo controlar tu televisor por voz/texto (ej: "Sube el volumen", "Pon Netflix", "Cambia a HDMI 2", "Apagar TV") o resolver dudas sobre calibración de imagen y audio eARC.',
      timestamp: 'Ahora',
    },
  ]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState<'gemini-3.8-flash' | 'gemini-3.1-flash-lite' | 'gemini-4-argon'>('gemini-3.8-flash');
  const [enableThinking, setEnableThinking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Image analysis state (Feature: Analyze images using gemini-4-argon)
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imagePrompt, setImagePrompt] = useState(
    'Analiza la foto de mi televisor LG: detecta modelo, estado del panel o configuraciones óptimas de imagen.'
  );
  const [imageAnalysisResult, setImageAnalysisResult] = useState<string | null>(null);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!isOpen) return null;

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputPrompt;
    if (!text.trim() || isLoading) return;

    playHapticClick(650);

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputPrompt('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMsg].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          model: selectedModel,
          enableThinking: enableThinking && selectedModel === 'gemini-4-argon',
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Error al comunicarse con Gemini.');
      }

      // If a TV command was detected, execute it on the TV!
      if (data.parsedCommand) {
        onExecuteCommand(data.parsedCommand.action, data.parsedCommand.value);
        playSuccessBeep();
      }

      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        commandExecuted: data.parsedCommand?.label,
        modelUsed: data.modelUsed,
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `Lo siento, ocurrió un error: ${err.message}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Image analysis with gemini-4-argon
  const handleAnalyzeImage = async () => {
    if (!selectedImage || isAnalyzingImage) return;

    playHapticClick(700);
    setIsAnalyzingImage(true);
    setImageAnalysisResult(null);

    try {
      const res = await fetch('/api/gemini/analyze-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: selectedImage,
          prompt: imagePrompt,
          enableHighThinking: true, // Feature: Enable high thinking with gemini-4-argon
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Error analizando imagen con gemini-4-argon');
      }

      setImageAnalysisResult(data.analysis);
      playSuccessBeep();
    } catch (err: any) {
      setImageAnalysisResult(`Error en el análisis de imagen: ${err.message}`);
    } finally {
      setIsAnalyzingImage(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
        setImageAnalysisResult(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const loadPresetImage = async (url: string) => {
    try {
      const resp = await fetch(url);
      const blob = await resp.blob();
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
        setImageAnalysisResult(null);
      };
      reader.readAsDataURL(blob);
    } catch {
      // Ignore
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 select-none animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full h-[650px] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-rose-600 to-purple-600 flex items-center justify-center text-white shadow-md shadow-rose-600/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">LG ThinQ AI Copilot</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-800/60 font-mono">
                  Gemini
                </span>
              </div>
              <p className="text-xs text-slate-400">Control por voz, análisis de pantalla y calibración</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar asistente Gemini"
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-900/60 p-1">
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-colors ${
              activeTab === 'chat' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Chat & Voz
          </button>
          <button
            onClick={() => setActiveTab('image')}
            className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'image' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5 text-purple-400" />
            <span>Analizar Foto (Argon)</span>
          </button>
          <button
            onClick={() => setActiveTab('thinking')}
            className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'thinking' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BrainCircuit className="w-3.5 h-3.5 text-rose-400" />
            <span>High Thinking</span>
          </button>
        </div>

        {/* TAB 1: MULTI-TURN CHAT INTERFACE */}
        {activeTab === 'chat' && (
          <div className="flex-1 flex flex-col min-h-0 bg-slate-950/60">
            {/* Model & Thinking Bar */}
            <div className="px-4 py-2 border-b border-slate-800/70 flex items-center justify-between text-xs bg-slate-950">
              <div className="flex items-center gap-1.5 text-slate-400">
                <span className="font-semibold text-slate-300">Modelo:</span>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value as any)}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-slate-200 font-mono text-[11px] focus:outline-none focus:border-rose-500"
                >
                  <option value="gemini-3.8-flash">gemini-3.8-flash (General)</option>
                  <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite (Rápido)</option>
                  <option value="gemini-4-argon">gemini-4-argon (Complejo)</option>
                </select>
              </div>

              {selectedModel === 'gemini-4-argon' && (
                <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-purple-300">
                  <input
                    type="checkbox"
                    checked={enableThinking}
                    onChange={(e) => setEnableThinking(e.target.checked)}
                    className="rounded border-slate-700 text-rose-600 focus:ring-0"
                  />
                  <span>Pensamiento Alto</span>
                </label>
              )}
            </div>

            {/* Quick Voice Command Chips */}
            <div className="px-3 py-2 bg-slate-900/40 border-b border-slate-800/50 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
              <span className="text-[10px] text-slate-500 font-bold uppercase shrink-0">Comandos:</span>
              {[
                'Sube el volumen 5',
                'Baja el volumen',
                'Apagar en 30 min',
                'Apagar en 60 min',
                'Pon YouTube',
                'Abrir Netflix',
                'Cambiar a HDMI 2',
                'Modo Cine',
                'Apagar TV',
              ].map((cmd) => (
                <button
                  key={cmd}
                  onClick={() => handleSendMessage(cmd)}
                  className="px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 shrink-0 transition-colors"
                >
                  {cmd}
                </button>
              ))}
            </div>

            {/* Chat Thread */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed ${
                      m.role === 'user'
                        ? 'bg-rose-600 text-white rounded-br-sm'
                        : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-sm'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{m.content}</p>

                    {m.commandExecuted && (
                      <div className="mt-2 pt-1.5 border-t border-slate-700/60 flex items-center gap-1.5 text-[11px] text-emerald-400 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>Comando TV ejecutado: {m.commandExecuted}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 mt-1 px-1 text-[10px] text-slate-500 font-mono">
                    <span>{m.timestamp}</span>
                    {m.modelUsed && <span>· {m.modelUsed}</span>}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex items-center gap-2 p-3 bg-slate-900 rounded-2xl border border-slate-800 w-fit">
                  <div className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                  <span className="text-xs text-slate-400">Gemini procesando comando...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Chat Input */}
            <div className="p-3 border-t border-slate-800 bg-slate-950 flex gap-2">
              <input
                type="text"
                placeholder="Escribe un comando o consulta (ej: 'Sube el volumen a 25', '¿Cómo activo Dolby Atmos?')..."
                value={inputPrompt}
                onChange={(e) => setInputPrompt(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                disabled={isLoading}
                className="flex-1 px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
              />
              <button
                onClick={() => handleSendMessage()}
                disabled={isLoading || !inputPrompt.trim()}
                className="w-10 h-10 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white flex items-center justify-center transition-colors shrink-0 shadow-md shadow-rose-600/30"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: IMAGE ANALYSIS (gemini-4-argon) */}
        {activeTab === 'image' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-950/60">
            <div className="p-3 rounded-2xl bg-purple-950/30 border border-purple-800/40">
              <div className="flex items-center gap-2 text-purple-300 font-bold text-xs mb-1">
                <ImageIcon className="w-4 h-4 text-purple-400" />
                <span>Análisis de Fotos con gemini-4-argon</span>
              </div>
              <p className="text-xs text-purple-200/80">
                Sube una foto de tu pantalla para detectar problemas de imagen (banding, retención, aspecto) o de la etiqueta trasera para autoconfigurar el modelo exacto.
              </p>
            </div>

            {/* Sample Image Presets */}
            <div>
              <span className="text-xs font-semibold text-slate-400 block mb-2">Fotos de muestra para probar:</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => loadPresetImage('/src/assets/images/tv_rear_model_label_1792439193496.jpg')}
                  className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-purple-500/50 flex items-center gap-2 text-left transition-colors"
                >
                  <img
                    src="/src/assets/images/tv_rear_model_label_1792439193496.jpg"
                    alt="Etiqueta LG"
                    className="w-10 h-10 rounded object-cover shrink-0"
                  />
                  <div>
                    <p className="text-xs font-bold text-slate-200">Etiqueta Trasera</p>
                    <p className="text-[10px] text-slate-400">Modelo OLED55CX</p>
                  </div>
                </button>

                <button
                  onClick={() => loadPresetImage('/src/assets/images/tv_screen_calibration_1792439193291.jpg')}
                  className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-purple-500/50 flex items-center gap-2 text-left transition-colors"
                >
                  <img
                    src="/src/assets/images/tv_screen_calibration_1792439193291.jpg"
                    alt="Pantalla OLED"
                    className="w-10 h-10 rounded object-cover shrink-0"
                  />
                  <div>
                    <p className="text-xs font-bold text-slate-200">Pantalla OLED</p>
                    <p className="text-[10px] text-slate-400">Calibración Cine</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Custom Upload Slot */}
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-900 border border-dashed border-slate-700 hover:border-purple-500 flex items-center justify-center gap-2 text-xs font-medium text-slate-300 transition-colors"
              >
                <Upload className="w-4 h-4 text-purple-400" />
                <span>Subir foto desde tu dispositivo Android / PC</span>
              </button>
            </div>

            {/* Preview of Selected Image */}
            {selectedImage && (
              <div className="space-y-3">
                <div className="relative rounded-2xl overflow-hidden border border-slate-800 max-h-48 bg-black flex items-center justify-center">
                  <img src={selectedImage} alt="Selected preview" className="max-h-48 object-contain" />
                  <button
                    onClick={() => {
                      setSelectedImage(null);
                      setImageAnalysisResult(null);
                    }}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <textarea
                  value={imagePrompt}
                  onChange={(e) => setImagePrompt(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  placeholder="Pregunta o instrucción para el análisis de imagen..."
                />

                <button
                  onClick={handleAnalyzeImage}
                  disabled={isAnalyzingImage}
                  className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-lg shadow-purple-600/30"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{isAnalyzingImage ? 'Analizando con gemini-4-argon...' : 'Analizar Imagen con Gemini'}</span>
                </button>
              </div>
            )}

            {/* Analysis Result */}
            {imageAnalysisResult && (
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-2 animate-in fade-in duration-200">
                <div className="flex items-center justify-between text-xs font-bold text-purple-400">
                  <span>Resultado del Diagnóstico</span>
                  <span className="font-mono text-[10px] text-slate-500">gemini-4-argon</span>
                </div>
                <div className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">
                  {imageAnalysisResult}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: HIGH THINKING MODE (gemini-4-argon) */}
        {activeTab === 'thinking' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-950/60">
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-rose-950/40 to-slate-900 border border-rose-800/40">
              <div className="flex items-center gap-2 text-rose-300 font-bold text-xs mb-1">
                <BrainCircuit className="w-4 h-4 text-rose-400" />
                <span>Modo de Razonamiento Profundo (ThinkingLevel.HIGH)</span>
              </div>
              <p className="text-xs text-slate-300">
                Diseñado para consultas técnicas avanzadas: sincronización de retraso de audio eARC en consolas/barras de sonido, calibración de gamma 2.2 / BT.1886 en paneles OLED y optimización de ancho de banda Wi-Fi.
              </p>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-400">Diagnósticos recomendados:</span>
              {[
                '¿Cómo elimino el retraso de audio entre mi barra de sonido eARC y mi LG TV?',
                'Optimiza los ajustes de imagen para jugar en PS5 a 4K 120Hz con VRR en LG OLED.',
                '¿Cómo funciona el ciclo de limpieza de píxeles (Pixel Cleaning) en webOS para evitar quemados?',
                'Configuración recomendada de calibración para ver películas en una habitación oscura.',
              ].map((q) => (
                <button
                  key={q}
                  onClick={() => {
                    setSelectedModel('gemini-4-argon');
                    setEnableThinking(true);
                    setActiveTab('chat');
                    handleSendMessage(q);
                  }}
                  className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-rose-500/50 text-left text-xs text-slate-300 hover:text-white flex items-center justify-between transition-colors group"
                >
                  <span className="truncate pr-2">{q}</span>
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-rose-400 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
