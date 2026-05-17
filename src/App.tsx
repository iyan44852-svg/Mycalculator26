/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { 
  Calculator, 
  Plus, 
  Minus, 
  X, 
  Divide, 
  Delete, 
  History as HistoryIcon, 
  Mic, 
  MicOff, 
  Settings, 
  Save, 
  Trash2, 
  Zap,
  Globe,
  Loader2,
  ChevronRight,
  PlusCircle
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { evaluate } from "mathjs";

interface CustomButton {
  id: string;
  name: string;
  formula: string; // e.g., "x * 1.3 + 5000"
}

interface HistoryItem {
  id: string;
  expression: string;
  result: string;
  timestamp: number;
}

export default function App() {
  const [display, setDisplay] = useState("0");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [customButtons, setCustomButtons] = useState<CustomButton[]>([]);
  const [isEditingButtons, setIsEditingButtons] = useState(false);
  const [newButtonName, setNewButtonName] = useState("");
  const [newButtonFormula, setNewButtonFormula] = useState("");
  
  // Natural Language State
  const [naturalInput, setNaturalInput] = useState("");
  const [isProcessingNL, setIsProcessingNL] = useState(false);
  const [nlExplanation, setNlExplanation] = useState("");
  const [isListening, setIsListening] = useState(false);

  const recognitionRef = useRef<any>(null);

  // Load from localStorage
  useEffect(() => {
    const savedButtons = localStorage.getItem("mycalc_custom_buttons");
    if (savedButtons) {
      setCustomButtons(JSON.parse(savedButtons));
    } else {
      // Default recipes for first-time users
      const defaults: CustomButton[] = [
        { id: "1", name: "Jual Barang", formula: "x * 1.3 + 15000" },
        { id: "2", name: "Pajak PPN 11%", formula: "x * 1.11" },
        { id: "3", name: "Diskon Member", formula: "x * 0.9" }
      ];
      setCustomButtons(defaults);
      localStorage.setItem("mycalc_custom_buttons", JSON.stringify(defaults));
    }

    const savedHistory = localStorage.getItem("mycalc_history");
    if (savedHistory) setHistory(JSON.parse(savedHistory));
  }, []);

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem("mycalc_custom_buttons", JSON.stringify(customButtons));
  }, [customButtons]);

  useEffect(() => {
    localStorage.setItem("mycalc_history", JSON.stringify(history));
  }, [history]);

  // Voice Recognition Setup
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = "id-ID";

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setNaturalInput(transcript);
        setIsListening(false);
      };

      recognitionRef.current.onerror = () => {
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      setIsListening(true);
      recognitionRef.current?.start();
    }
  };

  const handleNumber = (num: string) => {
    if (display === "0") {
      setDisplay(num);
    } else {
      setDisplay(display + num);
    }
  };

  const handleOperator = (op: string) => {
    setDisplay(display + " " + op + " ");
  };

  const handleClear = () => {
    setDisplay("0");
    setNlExplanation("");
  };

  const handleBackspace = () => {
    if (display.length > 1) {
      setDisplay(display.slice(0, -1).trim());
    } else {
      setDisplay("0");
    }
  };

  const handleCalculate = () => {
    try {
      const cleanDisplay = display.replace(/x/g, "*").replace(/÷/g, "/");
      const result = evaluate(cleanDisplay);
      const resultStr = result.toString();
      
      const newItem: HistoryItem = {
        id: Date.now().toString(),
        expression: display,
        result: resultStr,
        timestamp: Date.now()
      };

      setHistory([newItem, ...history].slice(0, 10));
      setDisplay(resultStr);
    } catch (error) {
      setDisplay("Error");
      setTimeout(() => setDisplay("0"), 1000);
    }
  };

  const handleCustomButtonClick = (button: CustomButton) => {
    try {
      // If display is 0 or empty, we treat x as 0 or ask for input?
      // Usually, user types price then hits custom button.
      const baseValue = parseFloat(display) || 0;
      const formula = button.formula.replace(/x/g, baseValue.toString());
      const result = evaluate(formula);
      const resultStr = result.toString();

      const newItem: HistoryItem = {
        id: Date.now().toString(),
        expression: `${button.name}(${baseValue})`,
        result: resultStr,
        timestamp: Date.now()
      };

      setHistory([newItem, ...history].slice(0, 10));
      setDisplay(resultStr);
      setNlExplanation(`${button.name}: ${button.formula} (x=${baseValue})`);
    } catch (error) {
      setDisplay("Formula Error");
      setTimeout(() => setDisplay(display), 1000);
    }
  };

  const addCustomButton = () => {
    if (newButtonName && newButtonFormula) {
      const newBtn: CustomButton = {
        id: Date.now().toString(),
        name: newButtonName,
        formula: newButtonFormula
      };
      setCustomButtons([...customButtons, newBtn]);
      setNewButtonName("");
      setNewButtonFormula("");
    }
  };

  const removeCustomButton = (id: string) => {
    setCustomButtons(customButtons.filter(b => b.id !== id));
  };

  const handleNaturalInput = async () => {
    if (!naturalInput) return;
    setIsProcessingNL(true);
    setNlExplanation("");

    try {
      const response = await fetch("/api/calculate-natural", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          prompt: naturalInput,
          customButtons: customButtons 
        })
      });

      const data = await response.json();
      if (data.expression) {
        setDisplay(data.expression);
        setNlExplanation(data.explanation);
        // Automatically calculate if it's a simple expression
        try {
          const result = evaluate(data.expression);
          setDisplay(result.toString());
          setHistory([{
            id: Date.now().toString(),
            expression: naturalInput,
            result: result.toString(),
            timestamp: Date.now()
          }, ...history].slice(0, 10));
        } catch (e) {
          // If expression is complex, keep it on display for user to check
        }
      }
    } catch (error) {
      console.error(error);
      setNlExplanation("Gagal menghubungi server Gemini.");
    } finally {
      setIsProcessingNL(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 font-sans selection:bg-blue-500/30 mesh-bg">
      <div className="max-w-6xl mx-auto min-h-screen flex flex-col">
        
        {/* Header */}
        <nav className="flex items-center justify-between px-8 py-6 border-b border-white/5 bg-black/20 backdrop-blur-md">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center font-bold text-xl shadow-lg shadow-blue-500/20">m26</div>
            <h1 className="text-2xl font-bold tracking-tight">mycalculator<span className="text-blue-500">26</span></h1>
          </div>
          <div className="flex items-center space-x-6">
            <div className="hidden md:flex space-x-1 bg-white/5 p-1 rounded-lg border border-white/10">
              <button className="px-4 py-1.5 rounded-md bg-white/10 text-sm font-medium shadow-sm">Standard</button>
              <button className="px-4 py-1.5 rounded-md text-sm font-medium text-slate-400 hover:text-white transition-colors">Pro</button>
            </div>
            <button 
              onClick={() => setIsEditingButtons(!isEditingButtons)}
              className={`w-10 h-10 rounded-full border border-white/10 flex items-center justify-center transition-all ${isEditingButtons ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </nav>

        <main className="flex-1 flex flex-col md:flex-row p-4 md:p-8 gap-8 overflow-hidden">
          
          {/* Left Content: Display and Pad */}
          <div className="flex-1 flex flex-col gap-6">
            
            {/* Natural Language Bar */}
            <div className="glass-panel rounded-2xl p-4 flex items-center space-x-4 shadow-xl">
              <div className={`p-2 rounded-lg transition-all ${isListening ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'}`}>
                {isListening ? <MicOff className="w-5 h-5 animate-pulse" /> : <Mic className="w-5 h-5" onClick={toggleListening} />}
              </div>
              <input 
                type="text" 
                value={naturalInput}
                onChange={(e) => setNaturalInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleNaturalInput()}
                placeholder="Ketik atau gunakan suara (misal: 'Harga 50rb diskon 10%')" 
                className="bg-transparent border-none outline-none flex-1 text-slate-200 placeholder-slate-500 text-lg"
              />
              {isProcessingNL ? (
                <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
              ) : (
                <kbd className="hidden sm:block bg-white/10 px-2.5 py-1 rounded-md text-[10px] font-bold text-slate-400 border border-white/10">ENTER</kbd>
              )}
            </div>

            {/* Main Display Area */}
            <div className="flex-1 min-h-[240px] flex flex-col justify-end items-end p-8 glass-panel rounded-[2rem] relative overflow-hidden shadow-2xl">
              <AnimatePresence mode="wait">
                {nlExplanation && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="absolute top-8 left-8 right-8 text-blue-400/80 text-sm font-medium tracking-wide italic"
                  >
                    {nlExplanation}
                  </motion.div>
                )}
              </AnimatePresence>
              
              <div className="text-slate-500 text-2xl font-light mb-4 tracking-wide overflow-x-auto w-full text-right custom-scrollbar">
                {history.length > 0 ? history[0].expression : ""}
              </div>
              <div className="text-7xl font-bold tracking-tighter text-white drop-shadow-sm">
                {display}
              </div>

              {/* Decorative elements */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 blur-[100px] rounded-full pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-500/5 blur-[60px] rounded-full pointer-events-none" />
            </div>

            {/* Main Pad Grid */}
            <div className="grid grid-cols-4 gap-4 pb-4">
              <CalcButton label="AC" onClick={handleClear} variant="special" />
              <CalcButton label="C" onClick={handleBackspace} variant="special" />
              <CalcButton label="%" onClick={() => handleOperator("%")} variant="special" />
              <CalcButton label="÷" onClick={() => handleOperator("÷")} variant="operator" />
              
              <CalcButton label="7" onClick={() => handleNumber("7")} />
              <CalcButton label="8" onClick={() => handleNumber("8")} />
              <CalcButton label="9" onClick={() => handleNumber("9")} />
              <CalcButton label="x" onClick={() => handleOperator("x")} variant="operator" />
              
              <CalcButton label="4" onClick={() => handleNumber("4")} />
              <CalcButton label="5" onClick={() => handleNumber("5")} />
              <CalcButton label="6" onClick={() => handleNumber("6")} />
              <CalcButton label="-" onClick={() => handleOperator("-")} variant="operator" />
              
              <CalcButton label="1" onClick={() => handleNumber("1")} />
              <CalcButton label="2" onClick={() => handleNumber("2")} />
              <CalcButton label="3" onClick={() => handleNumber("3")} />
              <CalcButton label="+" onClick={() => handleOperator("+")} variant="operator" />

              <CalcButton label="0" onClick={() => handleNumber("0")} span={2} />
              <CalcButton label="." onClick={() => handleNumber(".")} />
              <CalcButton label="=" onClick={handleCalculate} variant="operatorHighlight" />
            </div>
          </div>

          {/* Right Section: Sidebar */}
          <aside className="w-full md:w-[380px] flex flex-col gap-8">
            
            {/* Smart Recipes Section */}
            <section className="flex flex-col h-full bg-black/20 rounded-[2rem] border border-white/5 p-6 shadow-xl relative overflow-hidden backdrop-blur-xl">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-purple-400" />
                  <h2 className="text-xl font-bold tracking-tight">Smart Recipes</h2>
                </div>
                <button 
                  onClick={() => setIsEditingButtons(!isEditingButtons)}
                  className="p-1 px-3 rounded-lg bg-blue-500/10 text-blue-400 text-[10px] font-bold uppercase tracking-wider border border-blue-500/20 hover:bg-blue-500/20 transition-all"
                >
                  {isEditingButtons ? "Close" : "+ Create New"}
                </button>
              </div>

              <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar flex-1">
                <AnimatePresence>
                  {customButtons.map(btn => (
                    <motion.div 
                      key={btn.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="smart-button p-5 rounded-2xl relative overflow-hidden group shadow-md"
                    >
                      <div className="relative z-10">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-purple-400 font-bold tracking-widest uppercase text-[10px]">Workflow</span>
                          {isEditingButtons && (
                            <button 
                              onClick={() => removeCustomButton(btn.id)}
                              className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        <h3 className="text-lg font-bold mb-1">{btn.name}</h3>
                        <p className="text-slate-400 text-xs mb-4 font-mono font-medium truncate">Rumus: {btn.formula}</p>
                        <button 
                          onClick={() => handleCustomButtonClick(btn)}
                          className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-purple-900/40 transition-all active:scale-95"
                        >
                          RUN RECIPE
                        </button>
                      </div>
                      <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform pointer-events-none">
                        <Calculator className="w-24 h-24" />
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {customButtons.length === 0 && !isEditingButtons && (
                  <div className="flex flex-col items-center justify-center py-12 text-center opacity-20">
                    <Zap className="w-12 h-12 mb-4" />
                    <p className="text-sm font-medium tracking-tight">Belum ada resep pintar</p>
                  </div>
                )}

                {isEditingButtons && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="p-5 glass-panel rounded-2xl border-purple-500/20 bg-purple-500/5 space-y-4 shadow-inner"
                  >
                    <h4 className="text-[10px] uppercase font-bold text-purple-400 tracking-widest">New Custom Button</h4>
                    <input 
                      type="text" 
                      placeholder="Nama (e.g. Pajak)" 
                      value={newButtonName}
                      onChange={(e) => setNewButtonName(e.target.value)}
                      className="w-full bg-[#0f172a] border border-white/10 rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:border-purple-500/50"
                    />
                    <input 
                      type="text" 
                      placeholder="Rumus (e.g. x * 1.11)" 
                      value={newButtonFormula}
                      onChange={(e) => setNewButtonFormula(e.target.value)}
                      className="w-full bg-[#0f172a] border border-white/10 rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:border-purple-500/50 font-mono"
                    />
                    <button 
                      onClick={addCustomButton}
                      className="w-full bg-white text-black py-2.5 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all shadow-xl active:scale-95"
                    >
                      SAVE RECIPE
                    </button>
                  </motion.div>
                )}
              </div>

              {/* History Section Integrated in Sidebar */}
              <div className="mt-8 border-t border-white/5 pt-8 overflow-hidden h-[240px] flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <HistoryIcon className="w-4 h-4 text-blue-400" />
                    <h2 className="text-sm font-bold tracking-tight uppercase">Riwayat</h2>
                  </div>
                  {history.length > 0 && (
                    <button onClick={() => setHistory([])} className="text-[10px] text-slate-500 hover:text-red-400 font-bold uppercase">Clear</button>
                  )}
                </div>
                <div className="space-y-3 overflow-y-auto pr-2 custom-scrollbar flex-1">
                  {history.map(item => (
                    <div key={item.id} className="glass-panel p-3 rounded-xl flex flex-col items-end group hover:bg-white/5 transition-colors">
                      <span className="text-slate-500 text-[9px] w-full text-left font-mono">{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <span className="text-slate-400 text-[11px] font-mono truncate w-full text-right">{item.expression}</span>
                      <span className="text-blue-400 font-bold font-mono text-base">= {item.result}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Decorative side mesh */}
              <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-blue-500/10 blur-[60px] rounded-full pointer-events-none" />
            </section>
          </aside>
        </main>

        {/* Footer */}
        <footer className="px-8 py-4 bg-black/40 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-500 font-medium uppercase tracking-[0.2em] backdrop-blur-md">
          <div className="flex items-center space-x-6">
            <span className="flex items-center space-x-2">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span> 
              <span>System Operational</span>
            </span>
            <span className="hidden sm:inline">V2.6.0-stable</span>
          </div>
          <div className="flex items-center space-x-6">
            <span className="text-slate-300">© 2024 mycalculator26 studio</span>
          </div>
        </footer>
      </div>
    </div>
  );
}

function CalcButton({ 
  label, 
  onClick, 
  variant = 'number', 
  span = 1 
}: { 
  label: string, 
  onClick: () => void, 
  variant?: 'number' | 'operator' | 'special' | 'operatorHighlight',
  span?: number 
}) {
  const getStyles = () => {
    switch (variant) {
      case 'operator':
        return 'glass-button text-blue-400 hover:bg-white/10 hover:scale-[1.02] active:scale-95';
      case 'operatorHighlight':
        return 'accent-button text-white font-bold hover:scale-[1.02] active:scale-95';
      case 'special':
        return 'glass-button text-red-300/80 hover:bg-white/10 hover:scale-[1.02] active:scale-95';
      default:
        return 'glass-button text-white font-semibold hover:bg-white/15 hover:scale-[1.02] active:scale-95';
    }
  };

  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      style={{ gridColumn: `span ${span}` }}
      className={`py-5 md:py-6 rounded-2xl text-xl transition-all shadow-lg ${getStyles()}`}
    >
      {label}
    </motion.button>
  );
}

