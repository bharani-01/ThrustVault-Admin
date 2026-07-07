import React, { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { KPICard } from '../components/KPICard';
import { Database, Activity, Zap, Play, Info, BarChart2 } from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface TestRun {
  id: string;
  test_run_name: string;
  operator_name?: string;
  created_at: string;
  motor_id?: string;
  motor_model?: string;
  voltage?: number;
  propeller_model?: string;
  esc_model?: string;
  battery_info?: string;
  ambient_temperature_c?: number;
}

interface TelemetryPoint {
  id: string;
  run_id: string;
  throttle: number; // 0 to 1.0
  voltage: number;
  current: number;
  power: number;
  thrust_g: number;
  rpm?: number;
  efficiency?: number;
  temperature?: number;
}

export const PerformanceAnalytics: React.FC = () => {
  const [runs, setRuns] = useState<TestRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [telemetry, setTelemetry] = useState<TelemetryPoint[]>([]);
  const [isLoadingRuns, setIsLoadingRuns] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Statistics
  const [stats, setStats] = useState({
    totalRuns: 0,
    totalPoints: 0,
    maxThrust: 0,
  });

  const fetchRuns = async () => {
    setIsLoadingRuns(true);
    try {
      const res = await fetch('/api/motor-test-runs?order=created_at.desc');
      if (!res.ok) throw new Error('Failed to load test runs');
      const data = await res.json();
      setRuns(data || []);
      setStats(prev => ({ ...prev, totalRuns: data.length }));

      if (data.length > 0) {
        setSelectedRunId(data[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingRuns(false);
    }
  };

  const fetchTelemetry = async (runId: string) => {
    setIsLoadingData(true);
    try {
      const res = await fetch(`/api/motor-test-data-points?run_id=eq.${runId}&order=throttle.asc`);
      if (!res.ok) throw new Error('Failed to load telemetry points');
      const data = (await res.json()) || [];
      
      const mapped = data.map((p: any) => ({
        ...p,
        throttle: parseFloat(String(p.throttle || 0)),
        voltage: parseFloat(String(p.voltage || 0)),
        current: parseFloat(String(p.current || 0)),
        power: parseFloat(String(p.power || 0)),
        thrust_g: parseFloat(String(p.thrust_g || 0)),
        rpm: p.rpm ? parseFloat(String(p.rpm)) : undefined,
        efficiency: p.efficiency ? parseFloat(String(p.efficiency)) : undefined,
        temperature: p.temperature ? parseFloat(String(p.temperature)) : undefined
      }));
      setTelemetry(mapped);

      // Find max thrust
      let maxT = 0;
      mapped.forEach((p: TelemetryPoint) => {
        if (p.thrust_g > maxT) maxT = p.thrust_g;
      });

      setStats(prev => ({
        ...prev,
        totalPoints: prev.totalPoints === 0 ? mapped.length : prev.totalPoints,
        maxThrust: maxT > prev.maxThrust ? maxT : prev.maxThrust
      }));
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    fetchRuns();
  }, []);

  useEffect(() => {
    if (selectedRunId) {
      fetchTelemetry(selectedRunId);
    }
  }, [selectedRunId]);

  const activeRun = runs.find(r => r.id === selectedRunId);

  // Chart configuration data
  const chartLabels = telemetry.map(p => `${Math.round(p.throttle * 100)}%`);
  
  const thrustChartData = {
    labels: chartLabels,
    datasets: [
      {
        label: 'Thrust (g)',
        data: telemetry.map(p => p.thrust_g),
        borderColor: 'rgb(37, 99, 235)',
        backgroundColor: 'rgba(37, 99, 235, 0.1)',
        tension: 0.3,
        fill: true,
        yAxisID: 'yThrust',
      },
      {
        label: 'Current (A)',
        data: telemetry.map(p => p.current),
        borderColor: 'rgb(245, 158, 11)',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        tension: 0.3,
        fill: false,
        yAxisID: 'yCurrent',
      }
    ]
  };

  const efficiencyChartData = {
    labels: chartLabels,
    datasets: [
      {
        label: 'Efficiency (g/W)',
        data: telemetry.map(p => {
          const power = p.voltage * p.current;
          return power > 0 ? (p.thrust_g / power) : 0;
        }),
        borderColor: 'rgb(16, 185, 129)',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        tension: 0.3,
        fill: true,
        yAxisID: 'y',
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    scales: {
      yThrust: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        title: {
          display: true,
          text: 'Thrust (g)',
          font: { weight: 'bold' as const }
        },
        grid: {
          color: 'rgba(148, 163, 184, 0.1)',
        }
      },
      yCurrent: {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        title: {
          display: true,
          text: 'Current (A)',
          font: { weight: 'bold' as const }
        },
        grid: {
          drawOnChartArea: false, // only want gridlines from primary y-axis
        }
      }
    }
  };

  const efficiencyChartOptions = {
    responsive: true,
    scales: {
      y: {
        title: {
          display: true,
          text: 'Efficiency (g/W)',
          font: { weight: 'bold' as const }
        },
        grid: {
          color: 'rgba(148, 163, 184, 0.1)',
        }
      }
    }
  };

  return (
    <Layout>
      <main className="flex-1 flex flex-col px-4 md:px-12 py-6 max-w-[1800px] w-full mx-auto relative z-10">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-slate-200/50 dark:border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2 py-0.5 rounded text-[11px] font-bold font-mono uppercase tracking-wider bg-[#003366]/10 dark:bg-blue-950/40 text-[#003366] dark:text-[#a7c8ff]">
                Powertrain Telemetry
              </span>
              <span className="text-xs text-slate-400 font-medium">Test Runs Analysis</span>
            </div>
            <h2 className="text-2xl font-extrabold text-[#001e40] dark:text-slate-100 tracking-tight">
              Performance Analytics
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">
              Analyze powertrain test runs and map throttle curves to load values.
            </p>
          </div>
        </header>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <KPICard title="Total Test Runs" value={isLoadingRuns ? '...' : String(stats.totalRuns)} sub="Stored telemetry runs" icon={<Database className="w-4 h-4" />} />
          <KPICard title="Data Points" value={isLoadingData ? '...' : String(telemetry.length)} sub="In active telemetry profile" icon={<Activity className="w-4 h-4" />} iconBgColor="bg-emerald-50 dark:bg-emerald-950/30" iconTextColor="text-emerald-600 dark:text-emerald-400" />
          <KPICard title="Peak Thrust Recorded" value={isLoadingData ? '...' : `${stats.maxThrust.toFixed(0)} g`} sub="Across active datasets" icon={<Zap className="w-4 h-4" />} iconBgColor="bg-amber-50 dark:bg-amber-950/30" iconTextColor="text-amber-500 dark:text-amber-400" />
        </div>

        {/* Split View: Left List, Right Charts */}
        <div className="flex flex-col lg:flex-row items-stretch gap-6">
          
          {/* Left panel: Runs List */}
          <div className="w-full lg:w-80 shrink-0 bg-white dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 shadow-sm rounded-xl p-5 flex flex-col max-h-[600px] overflow-hidden">
            <h3 className="font-extrabold text-[#001e40] dark:text-slate-100 text-xs mb-4 border-b pb-2 flex items-center gap-1.5 uppercase font-mono tracking-wider">
              <BarChart2 className="w-4 h-4" /> Telemetry Datasets
            </h3>
            
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {isLoadingRuns ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-14 w-full bg-slate-100 rounded-lg animate-pulse"></div>
                ))
              ) : runs.length === 0 ? (
                <div className="text-center text-xs text-slate-400 py-8">No test runs available.</div>
              ) : (
                runs.map(run => (
                  <div 
                    key={run.id}
                    onClick={() => setSelectedRunId(run.id)}
                    className={`p-3 rounded-lg border text-xs font-semibold cursor-pointer transition-all ${
                      selectedRunId === run.id 
                        ? 'bg-[#003366] border-[#003366] text-white' 
                        : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850/40 text-slate-700 dark:text-slate-355'
                    }`}
                  >
                    <div className="flex justify-between items-center gap-2 mb-1">
                      <span className="truncate text-xs font-extrabold">{run.test_run_name}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase ${
                        selectedRunId === run.id ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                      }`}>
                        {run.voltage ? `${run.voltage}V` : 'Telemetry'}
                      </span>
                    </div>
                    <div className="text-[10px] opacity-75 truncate">
                      {run.propeller_model || 'Standard propeller'} &bull; {run.esc_model || 'Standard ESC'}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right panel: Charts */}
          <div className="flex-1 bg-white dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 shadow-sm rounded-xl p-5 flex flex-col justify-between">
            {isLoadingData ? (
              <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-400">
                <Activity className="w-8 h-8 animate-spin mb-2" />
                <span>Loading telemetry coordinates...</span>
              </div>
            ) : telemetry.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-400 text-center">
                <Info className="w-8 h-8 mb-2" />
                <h4 className="font-bold">Select a telemetry dataset</h4>
                <span className="text-xs">No active data points to render.</span>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-extrabold text-[#001e40] dark:text-slate-100 leading-tight">
                    {activeRun?.test_run_name}
                  </h3>
                  <span className="text-xs text-slate-400 mt-1 block">
                    Operator: {activeRun?.operator_name || 'Standard operator'} &bull; Temp: {activeRun?.ambient_temperature_c || 25}&deg;C
                  </span>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  {/* Thrust Curve chart */}
                  <div className="bg-slate-50/50 dark:bg-slate-950/30 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                    <h4 className="text-xs font-bold text-[#001e40] dark:text-slate-355 uppercase font-mono mb-3">
                      Thrust & Current vs Throttle
                    </h4>
                    <Line data={thrustChartData} options={chartOptions} />
                  </div>

                  {/* Efficiency Curve Chart */}
                  <div className="bg-slate-50/50 dark:bg-slate-950/30 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                    <h4 className="text-xs font-bold text-[#001e40] dark:text-slate-355 uppercase font-mono mb-3">
                      Efficiency (g/W) vs Throttle
                    </h4>
                    <Line data={efficiencyChartData} options={efficiencyChartOptions} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

      </main>
    </Layout>
  );
};
