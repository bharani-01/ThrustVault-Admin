import React, { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { ChevronRight, Info } from 'lucide-react';

interface Motor {
  id: string;
  name: string;
  brand: string;
  kv: number;
  voltage: string;
  thrust: number; // in kg
  thrustRaw: string;
  propeller: string;
  esc: string;
}

export const MotorFinder: React.FC = () => {
  const [motors, setMotors] = useState<Motor[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Wizard Steps
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [uavType, setUavType] = useState<'cinewhoop' | 'freestyle' | 'heavy' | 'agri' | 'custom'>('freestyle');

  // Sliders Filter States
  const [kvRange, setKvRange] = useState<[number, number]>([100, 2000]);
  const [thrustRange, setThrustRange] = useState<[number, number]>([0.5, 15]);
  const [selectedCells, setSelectedCells] = useState<number[]>([4, 6]);

  const fetchMotors = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/motors?limit=200');
      if (!res.ok) throw new Error('Failed to load motors');
      const data = await res.json();

      const convertToKg = (val: number, unit: string) => {
        switch (unit?.toLowerCase()) {
          case 'g': return val / 1000;
          case 'n': return val / 9.80665;
          case 'lb': return val * 0.453592;
          default: return val;
        }
      };

      const mapped = data.map((m: any) => {
        const rawThrust = m.max_thrust;
        let kgVal = 1.0;
        if (rawThrust) {
          const match = String(rawThrust).trim().match(/^([\d\.]+)\s*(kg|g|n|lb)?/i);
          if (match) {
            kgVal = convertToKg(parseFloat(match[1]), match[2] || 'kg');
          }
        }

        return {
          id: m.id,
          name: m.motor_name,
          brand: m.company,
          kv: m.kv_rating || 0,
          voltage: m.operating_voltage || '',
          thrust: kgVal,
          thrustRaw: m.max_thrust,
          propeller: m.recommended_propeller || '—',
          esc: m.recommended_esc || '—'
        };
      });

      setMotors(mapped);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMotors();
  }, []);

  // Update slider bounds based on UAV application preset
  const handleUavTypeSelect = (type: typeof uavType) => {
    setUavType(type);
    if (type === 'cinewhoop') {
      setKvRange([1200, 2800]);
      setThrustRange([0.2, 1.2]);
      setSelectedCells([3, 4]);
    } else if (type === 'freestyle') {
      setKvRange([1600, 2500]);
      setThrustRange([0.8, 2.2]);
      setSelectedCells([4, 6]);
    } else if (type === 'heavy') {
      setKvRange([200, 800]);
      setThrustRange([4, 12]);
      setSelectedCells([6, 12]);
    } else if (type === 'agri') {
      setKvRange([80, 250]);
      setThrustRange([10, 30]);
      setSelectedCells([12, 14]);
    }
  };

  const handleCellToggle = (cell: number) => {
    setSelectedCells(prev => 
      prev.includes(cell) ? prev.filter(c => c !== cell) : [...prev, cell]
    );
  };

  // Dynamic filter matching motors
  const matchedMotors = motors.filter(m => {
    const matchesKv = m.kv >= kvRange[0] && m.kv <= kvRange[1];
    const matchesThrust = m.thrust >= thrustRange[0] && m.thrust <= thrustRange[1];
    
    // Check if motor voltage string contains any of selected lipo cells
    let matchesVoltage = selectedCells.length === 0;
    if (selectedCells.length > 0 && m.voltage) {
      matchesVoltage = selectedCells.some(cell => 
        m.voltage.toLowerCase().includes(`${cell}s`)
      );
    }

    return matchesKv && matchesThrust && matchesVoltage;
  });

  return (
    <Layout>
      <main className="flex-1 flex flex-col px-4 md:px-12 py-6 max-w-[1000px] w-full mx-auto relative z-10">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 border-b border-slate-200/50 dark:border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2 py-0.5 rounded text-[11px] font-bold font-mono uppercase tracking-wider bg-[#003366]/10 dark:bg-blue-950/40 text-[#003366] dark:text-[#a7c8ff]">
                Powertrain Designer
              </span>
              <span className="text-xs text-slate-400 font-medium">UAV Matcher</span>
            </div>
            <h2 className="text-2xl font-extrabold text-[#001e40] dark:text-slate-100 tracking-tight">
              Motor Finder Wizard
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">
              Select your UAV target metrics, voltage options, and get matched motors instantly.
            </p>
          </div>
        </header>

        {/* Multi-step progress bar */}
        <div className="flex items-center justify-between mb-8 max-w-lg mx-auto w-full px-4 text-xs font-bold text-slate-400 dark:text-slate-500 font-mono uppercase tracking-wider">
          <button onClick={() => setStep(1)} className={`pb-1 border-b-2 transition-colors cursor-pointer ${step === 1 ? 'border-[#003366] text-[#003366] dark:text-blue-400' : 'border-transparent'}`}>
            1. UAV Target
          </button>
          <ChevronRight className="w-4 h-4 text-slate-300" />
          <button onClick={() => setStep(2)} className={`pb-1 border-b-2 transition-colors cursor-pointer ${step === 2 ? 'border-[#003366] text-[#003366] dark:text-blue-400' : 'border-transparent'}`}>
            2. Specs Sliders
          </button>
          <ChevronRight className="w-4 h-4 text-slate-300" />
          <button onClick={() => setStep(3)} className={`pb-1 border-b-2 transition-colors cursor-pointer ${step === 3 ? 'border-[#003366] text-[#003366] dark:text-blue-400' : 'border-transparent'}`}>
            3. Matches ({matchedMotors.length})
          </button>
        </div>

        {/* STEP 1: UAV TYPE SELECTION */}
        {step === 1 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div 
              onClick={() => { handleUavTypeSelect('cinewhoop'); setStep(2); }}
              className={`p-5 rounded-2xl border cursor-pointer transition-all ${
                uavType === 'cinewhoop' 
                  ? 'border-[#003366] bg-[#003366]/5 dark:border-blue-500 dark:bg-blue-950/20' 
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <h3 className="font-extrabold text-[#001e40] dark:text-slate-100 text-sm mb-1 uppercase tracking-wide">Cinewhoop / Cinematic</h3>
              <p className="text-xs text-slate-400">Indoor filming, 3" props. High KV ranges, 4S LiPo setups, sub-1kg thrust levels.</p>
            </div>
            <div 
              onClick={() => { handleUavTypeSelect('freestyle'); setStep(2); }}
              className={`p-5 rounded-2xl border cursor-pointer transition-all ${
                uavType === 'freestyle' 
                  ? 'border-[#003366] bg-[#003366]/5 dark:border-blue-500 dark:bg-blue-950/20' 
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <h3 className="font-extrabold text-[#001e40] dark:text-slate-100 text-sm mb-1 uppercase tracking-wide">Freestyle / Racing</h3>
              <p className="text-xs text-slate-400">Outdoor agility, 5" props. Balanced 1600–2500 KV specs, 4S/6S Lipo, 1kg–2kg peak thrust.</p>
            </div>
            <div 
              onClick={() => { handleUavTypeSelect('heavy'); setStep(2); }}
              className={`p-5 rounded-2xl border cursor-pointer transition-all ${
                uavType === 'heavy' 
                  ? 'border-[#003366] bg-[#003366]/5 dark:border-blue-500 dark:bg-blue-950/20' 
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <h3 className="font-extrabold text-[#001e40] dark:text-slate-100 text-sm mb-1 uppercase tracking-wide">Heavy Lift / Enterprise</h3>
              <p className="text-xs text-slate-400">Industrial carry, 15"–22" props. Lower KV specs (200–800), 6S–12S High Volts, 4kg–12kg thrust range.</p>
            </div>
            <div 
              onClick={() => { handleUavTypeSelect('agri'); setStep(2); }}
              className={`p-5 rounded-2xl border cursor-pointer transition-all ${
                uavType === 'agri' 
                  ? 'border-[#003366] bg-[#003366]/5 dark:border-blue-500 dark:bg-blue-950/20' 
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <h3 className="font-extrabold text-[#001e40] dark:text-slate-100 text-sm mb-1 uppercase tracking-wide">Agricultural UAVs</h3>
              <p className="text-xs text-slate-400">Spray drone loads, 30"+ folding props. Ultralow KV (80–250), 12S/14S battery loads, 10kg–30kg extreme thrust.</p>
            </div>
          </div>
        )}

        {/* STEP 2: SPECIFICATION SLIDERS */}
        {step === 2 && (
          <div className="bg-white dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 shadow-sm rounded-xl p-6 flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-200">
            {/* KV Slider */}
            <div className="flex flex-col">
              <div className="flex justify-between items-center mb-2 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono">
                <span>KV Rating Range</span>
                <span className="text-[#003366] dark:text-blue-400">{kvRange[0]} KV - {kvRange[1]} KV</span>
              </div>
              <div className="flex gap-4">
                <input 
                  type="range" 
                  min="50" 
                  max="3000" 
                  value={kvRange[0]} 
                  onChange={e => setKvRange([parseInt(e.target.value), kvRange[1]])}
                  className="flex-1 accent-[#003366]" 
                />
                <input 
                  type="range" 
                  min="50" 
                  max="3000" 
                  value={kvRange[1]} 
                  onChange={e => setKvRange([kvRange[0], parseInt(e.target.value)])}
                  className="flex-1 accent-[#003366]" 
                />
              </div>
            </div>

            {/* Thrust Slider */}
            <div className="flex flex-col">
              <div className="flex justify-between items-center mb-2 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono">
                <span>Max Thrust Range (kg)</span>
                <span className="text-[#003366] dark:text-blue-400">{thrustRange[0]} kg - {thrustRange[1]} kg</span>
              </div>
              <div className="flex gap-4">
                <input 
                  type="range" 
                  min="0.1" 
                  max="40" 
                  step="0.1"
                  value={thrustRange[0]} 
                  onChange={e => setThrustRange([parseFloat(e.target.value), thrustRange[1]])}
                  className="flex-1 accent-[#003366]" 
                />
                <input 
                  type="range" 
                  min="0.1" 
                  max="40" 
                  step="0.1"
                  value={thrustRange[1]} 
                  onChange={e => setThrustRange([thrustRange[0], parseFloat(e.target.value)])}
                  className="flex-1 accent-[#003366]" 
                />
              </div>
            </div>

            {/* Lipo Cells Selectors */}
            <div className="flex flex-col">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 font-mono">Voltage Cells Supported</label>
              <div className="flex flex-wrap gap-2">
                {[3, 4, 6, 8, 12, 14].map(cell => {
                  const active = selectedCells.includes(cell);
                  return (
                    <button 
                      key={cell}
                      onClick={() => handleCellToggle(cell)}
                      className={`px-4 py-2 border rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        active 
                          ? 'bg-[#003366] border-[#003366] text-white shadow-sm' 
                          : 'bg-slate-50 border-slate-200 dark:bg-slate-950 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                      }`}
                    >
                      {cell}S
                    </button>
                  );
                })}
              </div>
            </div>

            <button 
              onClick={() => setStep(3)}
              className="w-full bg-[#003366] hover:bg-[#002244] dark:bg-blue-600 dark:hover:bg-blue-700 text-white text-xs font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
            >
              See Match Recommendations
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* STEP 3: matched MOTORS DISPLAY */}
        {step === 3 && (
          <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono">
                Matched Motors ({matchedMotors.length})
              </span>
              <button 
                onClick={() => setStep(2)}
                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 hover:underline cursor-pointer"
              >
                Adjust Filters
              </button>
            </div>

            {matchedMotors.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center text-slate-400 flex flex-col items-center justify-center">
                <Info className="w-8 h-8 mb-2" />
                <h4 className="font-bold">No Matches Found</h4>
                <p className="text-xs mt-1">Try widening your KV range or selecting more battery voltage configuration options.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {matchedMotors.map(m => (
                  <div key={m.id} className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-xl p-4 flex flex-col justify-between hover:shadow-md transition-shadow">
                    <div>
                      <div className="flex justify-between items-start gap-2 mb-1.5">
                        <h4 className="font-extrabold text-[#001e40] dark:text-slate-100 text-sm truncate">{m.name}</h4>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#003366]/10 text-[#003366] dark:bg-blue-950/40 dark:text-blue-400 uppercase">{m.brand}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 font-semibold mb-3">{m.kv} KV &bull; {m.voltage}</p>
                      
                      <div className="grid grid-cols-2 gap-3 text-xs border-t border-slate-100 dark:border-slate-850 pt-3">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-slate-400 uppercase font-mono mb-0.5">Peak Thrust</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">{m.thrustRaw}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] text-slate-400 uppercase font-mono mb-0.5">Propeller</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200 truncate">{m.propeller}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </main>
    </Layout>
  );
};
