import { useState, useEffect } from 'react';
import axios from 'axios';
import { Banknote, ShoppingBag, AlertTriangle, Users, TrendingUp, Calendar, FilterX, Sparkles, RefreshCw } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import DatePicker, { registerLocale } from 'react-datepicker';
import { es } from 'date-fns/locale/es';
import 'react-datepicker/dist/react-datepicker.css';

registerLocale('es', es);

const DashboardPage = () => {
  const [stats, setStats] = useState({
    resumen: { totalVentas: 0, utilidadReal: 0, ventasCount: 0, bajoStockCount: 0, clientesCount: 0 },
    ventasRecientes: [],
    ventasGrafico: []
  });
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState('general');
  const [fechaInicio, setFechaInicio] = useState(null);
  const [fechaFin, setFechaFin] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        let url = `${import.meta.env.VITE_API_URL}/api/dashboard/stats?periodo=${periodo}`;
        if (periodo === 'personalizado') {
          if (fechaInicio) {
            const startStr = fechaInicio instanceof Date ? fechaInicio.toISOString().split('T')[0] : fechaInicio;
            url += `&fechaInicio=${startStr}`;
          }
          if (fechaFin) {
            const endStr = fechaFin instanceof Date ? fechaFin.toISOString().split('T')[0] : fechaFin;
            url += `&fechaFin=${endStr}`;
          }
        }
        const response = await axios.get(url);
        setStats(response.data);
      } catch (error) {
        console.error("Error cargando dashboard:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [periodo, fechaInicio, fechaFin]);

  const aplicarRangoRapido = (diasAtras) => {
    const fin = new Date();
    const inicio = new Date();
    inicio.setDate(fin.getDate() - diasAtras);
    setFechaInicio(inicio);
    setFechaFin(fin);
  };

  const aplicarMesActual = () => {
    const now = new Date();
    const inicio = new Date(now.getFullYear(), now.getMonth(), 1);
    const fin = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    setFechaInicio(inicio);
    setFechaFin(fin);
  };

  const aplicarMesAnterior = () => {
    const now = new Date();
    const inicio = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const fin = new Date(now.getFullYear(), now.getMonth(), 0);
    setFechaInicio(inicio);
    setFechaFin(fin);
  };

  const StatCard = ({ title, value, icon: Icon, colorClass }) => (
    <div className="kitty-card p-6 flex items-center justify-between transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
      <div>
        <p className="text-xs font-black uppercase tracking-wider text-gray-500 mb-1">{title}</p>
        <h3 className="text-2xl lg:text-3xl font-black text-slate-800">{value}</h3>
      </div>
      <div className={`p-4 rounded-2xl ${colorClass}`}>
        <Icon size={26} />
      </div>
    </div>
  );

  const formatFechaTitulo = () => {
    if (periodo === 'dia') return '(Hoy)';
    if (periodo === 'semana') return '(Últimos 7 días)';
    if (periodo === 'mes') return '(Último mes)';
    if (periodo === 'año') return '(Último año)';
    if (periodo === 'personalizado') {
      if (fechaInicio && fechaFin) {
        return `(${fechaInicio.toLocaleDateString('es-ES')} al ${fechaFin.toLocaleDateString('es-ES')})`;
      }
      if (fechaInicio) return `(Desde ${fechaInicio.toLocaleDateString('es-ES')})`;
      if (fechaFin) return `(Hasta ${fechaFin.toLocaleDateString('es-ES')})`;
      return '(Rango personalizado)';
    }
    return '(Todos los datos)';
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      {/* Encabezado Principal */}
      <div className="mb-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-kitty-pink mb-1 flex items-center gap-2">
            Bienvenida al Dashboard 🎀
          </h1>
          <p className="text-gray-600 text-sm">Resumen general y estadísticas de Tienda Rosestore</p>
        </div>

        {/* Botones de Filtro por Período */}
        <div className="flex flex-wrap items-center bg-white p-1.5 rounded-2xl shadow-sm border border-pink-100 gap-1 w-fit">
          {[
            { id: 'general', label: 'Todo' },
            { id: 'dia', label: 'Hoy' },
            { id: 'semana', label: '7 Días' },
            { id: 'mes', label: 'Mes' },
            { id: 'año', label: 'Año' },
            { id: 'personalizado', label: 'Personalizado', icon: Calendar }
          ].map((opt) => {
            const Icon = opt.icon;
            const isSelected = periodo === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => setPeriodo(opt.id)}
                className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl transition-all duration-200 ${
                  isSelected
                    ? 'bg-kitty-pink text-white shadow-md transform scale-105'
                    : 'text-gray-500 hover:text-kitty-pink hover:bg-pink-50'
                }`}
              >
                {Icon && <Icon size={14} />}
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selector de Fechas Personalizadas */}
      {periodo === 'personalizado' && (
        <div className="mb-8 p-5 bg-gradient-to-r from-pink-50/80 via-white to-pink-50/80 rounded-2xl border border-pink-200 shadow-sm animate-fadeIn">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-600">Desde:</span>
                <DatePicker
                  selected={fechaInicio}
                  onChange={(date) => setFechaInicio(date)}
                  selectsStart
                  startDate={fechaInicio}
                  endDate={fechaFin}
                  locale="es"
                  dateFormat="dd/MM/yyyy"
                  placeholderText="dd/mm/aaaa"
                  className="w-32 px-3 py-1.5 bg-white border border-pink-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-kitty-pink focus:ring-2 focus:ring-pink-100 shadow-sm"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-600">Hasta:</span>
                <DatePicker
                  selected={fechaFin}
                  onChange={(date) => setFechaFin(date)}
                  selectsEnd
                  startDate={fechaInicio}
                  endDate={fechaFin}
                  minDate={fechaInicio}
                  locale="es"
                  dateFormat="dd/MM/yyyy"
                  placeholderText="dd/mm/aaaa"
                  className="w-32 px-3 py-1.5 bg-white border border-pink-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-kitty-pink focus:ring-2 focus:ring-pink-100 shadow-sm"
                />
              </div>

              {(fechaInicio || fechaFin) && (
                <button
                  onClick={() => {
                    setFechaInicio(null);
                    setFechaFin(null);
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-slate-500 bg-white hover:bg-rose-50 hover:text-rose-600 rounded-xl border border-pink-200 transition-colors shadow-sm"
                >
                  <FilterX size={14} /> Limpiar
                </button>
              )}
            </div>

            {/* Accesos rápidos de fechas */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Atajos:</span>
              <button
                onClick={() => aplicarRangoRapido(15)}
                className="px-2.5 py-1 text-xs font-semibold bg-white text-kitty-dark hover:bg-pink-100 rounded-lg border border-pink-100 transition-colors"
              >
                Últimos 15 días
              </button>
              <button
                onClick={aplicarMesActual}
                className="px-2.5 py-1 text-xs font-semibold bg-white text-kitty-dark hover:bg-pink-100 rounded-lg border border-pink-100 transition-colors"
              >
                Este Mes
              </button>
              <button
                onClick={aplicarMesAnterior}
                className="px-2.5 py-1 text-xs font-semibold bg-white text-kitty-dark hover:bg-pink-100 rounded-lg border border-pink-100 transition-colors"
              >
                Mes Anterior
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Indicador de carga suave */}
      {loading && (
        <div className="mb-4 flex items-center justify-center gap-2 text-xs font-bold text-kitty-pink bg-pink-50/60 py-2 rounded-xl border border-pink-100">
          <RefreshCw size={14} className="animate-spin" /> Actualizando estadísticas... 🎀
        </div>
      )}

      {/* Tarjetas de Resumen */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5 mb-8 transition-opacity duration-300 ${loading ? 'opacity-60' : 'opacity-100'}`}>
        <StatCard 
          title="Ingresos Totales" 
          value={`Bs. ${(stats.resumen.totalVentas || 0).toFixed(2)}`} 
          icon={Banknote} 
          colorClass="bg-pink-100 text-kitty-pink" 
        />
        <StatCard 
          title="Utilidad Real" 
          value={`Bs. ${(stats.resumen.utilidadReal || 0).toFixed(2)}`} 
          icon={TrendingUp} 
          colorClass="bg-green-100 text-green-500" 
        />
        <StatCard 
          title="Ventas Realizadas" 
          value={stats.resumen.ventasCount} 
          icon={ShoppingBag} 
          colorClass="bg-blue-100 text-blue-500" 
        />
        <StatCard 
          title="Alertas de Stock" 
          value={stats.resumen.bajoStockCount} 
          icon={AlertTriangle} 
          colorClass="bg-yellow-100 text-yellow-600" 
        />
        <StatCard 
          title="Clientes Registrados" 
          value={stats.resumen.clientesCount} 
          icon={Users} 
          colorClass="bg-purple-100 text-purple-500" 
        />
      </div>

      <div className={`grid grid-cols-1 lg:grid-cols-3 gap-8 transition-opacity duration-300 ${loading ? 'opacity-60' : 'opacity-100'}`}>
        {/* Gráfico de Ventas */}
        <div className="kitty-card p-6 lg:col-span-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-2">
            <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
              <Sparkles size={18} className="text-kitty-pink" />
              Gráfico de Ventas <span className="text-xs font-semibold text-slate-500">{formatFechaTitulo()}</span>
            </h2>
          </div>
          <div className="h-72">
            {stats.ventasGrafico && stats.ventasGrafico.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.ventasGrafico} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#FF69B4" stopOpacity={0.85}/>
                      <stop offset="95%" stopColor="#FF69B4" stopOpacity={0.2}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#fce7f3" />
                  <XAxis 
                    dataKey="_id" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#9ca3af', fontSize: 12 }} 
                    dy={10}
                    tickFormatter={(dateStr) => {
                      if (!dateStr) return '';
                      const partes = dateStr.split('-');
                      if (partes.length === 3) return `${partes[2]}/${partes[1]}`; // DD/MM
                      if (partes.length === 2) {
                        const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
                        const mesIndex = parseInt(partes[1], 10) - 1;
                        return `${meses[mesIndex] || partes[1]} ${partes[0].substring(2)}`; // Ene 26
                      }
                      return dateStr;
                    }}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#9ca3af', fontSize: 12 }}
                    tickFormatter={(value) => `Bs.${value}`} 
                  />
                  <Tooltip 
                    cursor={{ fill: 'rgba(255, 105, 180, 0.06)' }} 
                    contentStyle={{ 
                      borderRadius: '16px', 
                      border: '1px solid #fce7f3', 
                      boxShadow: '0 10px 25px -5px rgb(255 105 180 / 0.15)',
                      backgroundColor: 'rgba(255, 255, 255, 0.98)',
                      padding: '12px 16px'
                    }} 
                    itemStyle={{ color: '#FF69B4', fontWeight: 'bold' }}
                    formatter={(value) => [`Bs. ${Number(value).toFixed(2)}`, 'Total']}
                    labelStyle={{ color: '#6b7280', marginBottom: '4px', fontWeight: '600' }}
                  />
                  <Bar 
                    dataKey="total" 
                    fill="url(#colorTotal)" 
                    radius={[8, 8, 0, 0]} 
                    barSize={36}
                    animationDuration={1200}
                    animationEasing="ease-out"
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col h-full items-center justify-center text-gray-400 gap-2">
                <span className="text-3xl">📊</span>
                <p className="text-sm font-medium">No hay registros de ventas para el período seleccionado.</p>
              </div>
            )}
          </div>
        </div>

        {/* Lista de Ventas Recientes */}
        <div className="kitty-card p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2">
              <ShoppingBag size={18} className="text-kitty-pink" /> Últimas Ventas
            </h2>
            <div className="space-y-3.5">
              {stats.ventasRecientes && stats.ventasRecientes.length > 0 ? (
                stats.ventasRecientes.map((venta) => (
                  <div key={venta._id} className="flex justify-between items-center border-b border-pink-50 pb-3 last:border-0 hover:bg-pink-50/40 p-2 rounded-xl transition-colors">
                    <div>
                      <p className="font-bold text-slate-800 text-sm">
                        {venta.cliente ? `${venta.cliente.nombre} ${venta.cliente.apellidos || ''}`.trim() : 'Cliente Rápido'}
                      </p>
                      <p className="text-[11px] text-gray-400">
                        {new Date(venta.fecha).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                    <div className="font-black text-kitty-dark text-sm bg-pink-50 px-2.5 py-1 rounded-lg">
                      Bs. {venta.total.toFixed(2)}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-gray-400 text-sm text-center py-8">
                  No hay ventas registradas en este período.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
