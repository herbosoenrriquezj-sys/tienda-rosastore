import { useState, useEffect } from 'react';
import axios from 'axios';
import { FileText, TrendingUp, Calendar, CheckCircle, XCircle, ShoppingCart, ShoppingBag, Package, User, Truck, RotateCcw, Users, List, FilterX, Eye } from 'lucide-react';
import DatePicker, { registerLocale } from 'react-datepicker';
import { es } from 'date-fns/locale/es';
import 'react-datepicker/dist/react-datepicker.css';

registerLocale('es', es);

const ReportesPage = () => {
  const [ventas, setVentas] = useState([]);
  const [compras, setCompras] = useState([]);
  const [historialInventario, setHistorialInventario] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ventas'); // ventas, compras, detalle_compras, rentabilidad, inventario, clientes

  // Estados de Filtros
  const [filtroRentabilidad, setFiltroRentabilidad] = useState({ fechaInicio: null, fechaFin: null, productoBusqueda: '' });
  const [filtroVentas, setFiltroVentas] = useState({ fechaInicio: null, fechaFin: null, metodoPago: '', estado: '', clienteBusqueda: '' });
  const [filtroCompras, setFiltroCompras] = useState({ fechaInicio: null, fechaFin: null, estado: '', proveedorBusqueda: '', productoBusqueda: '' });
  const [filtroInventario, setFiltroInventario] = useState({ fechaInicio: null, fechaFin: null, tipo: '', productoBusqueda: '' });
  const [ventaSeleccionada, setVentaSeleccionada] = useState(null);
  const [compraSeleccionada, setCompraSeleccionada] = useState(null);
  const [ventaParaEditarFecha, setVentaParaEditarFecha] = useState(null);
  const [nuevaFechaVenta, setNuevaFechaVenta] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      const [resVentas, resCompras, resInventario] = await Promise.all([
        axios.get(`${import.meta.env.VITE_API_URL}/api/ventas`),
        axios.get(`${import.meta.env.VITE_API_URL}/api/compras`),
        axios.get(`${import.meta.env.VITE_API_URL}/api/inventario/historial`)
      ]);
      
      setVentas(resVentas.data.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)));
      setCompras(resCompras.data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
      setHistorialInventario(resInventario.data);
    } catch (error) {
      console.error("Error al cargar reportes:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const abrirModalEditarFecha = (v) => {
    setVentaParaEditarFecha(v);
    const d = new Date(v.fecha);
    const pad = (n) => String(n).padStart(2, '0');
    const formatted = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    setNuevaFechaVenta(formatted);
  };

  const handleGuardarNuevaFecha = async (e) => {
    e.preventDefault();
    if (!nuevaFechaVenta) return;
    try {
      await axios.put(`${import.meta.env.VITE_API_URL}/api/ventas/${ventaParaEditarFecha._id}/fecha`, {
        fecha: new Date(nuevaFechaVenta)
      });
      alert("¡Fecha de la venta actualizada con éxito! 🗓️✨");
      setVentaParaEditarFecha(null);
      fetchData();
    } catch (error) {
      console.error("Error al actualizar la fecha:", error);
      alert(error.response?.data?.message || "Error al actualizar la fecha.");
    }
  };

  const handleAnularCompra = async (id) => {
    if (window.confirm("¿Estás seguro de ANULAR esta compra? Se descontará el stock ingresado y se devolverá el dinero a la caja como una devolución.")) {
      try {
        await axios.put(`${import.meta.env.VITE_API_URL}/api/compras/${id}/anular`);
        alert("Compra anulada con éxito. Stock y Dinero revertidos. 🔄");
        fetchData(); // Recargar datos
      } catch (error) {
        console.error(error);
        alert("Error al anular compra.");
      }
    }
  };

  const handleAnularVenta = async (id) => {
    if (window.confirm("¿Estás seguro de ANULAR esta venta? Se devolverá el stock al inventario y se registrará un egreso por devolución en finanzas.")) {
      try {
        await axios.put(`${import.meta.env.VITE_API_URL}/api/ventas/${id}/anular`);
        alert("Venta anulada con éxito. Stock y Finanzas actualizados. 🔄");
        fetchData();
      } catch (error) {
        console.error(error);
        alert("Error al anular venta.");
      }
    }
  };

  const handleDevolverProducto = async (ventaId, productoId, maxCantidad) => {
    const cantidad = prompt(`¿Cuántas unidades deseas devolver? (Máximo: ${maxCantidad})`);
    if (!cantidad) return;
    
    const cantidadNum = parseInt(cantidad, 10);
    if (isNaN(cantidadNum) || cantidadNum <= 0 || cantidadNum > maxCantidad) {
      alert("Cantidad inválida.");
      return;
    }

    if (window.confirm(`¿Confirmas la devolución de ${cantidadNum} unidades? Esto actualizará finanzas e inventario.`)) {
      try {
        await axios.put(`${import.meta.env.VITE_API_URL}/api/ventas/${ventaId}/devolver-producto`, {
          productoId,
          cantidadADevolver: cantidadNum
        });
        alert("Devolución parcial procesada con éxito. 🔄");
        setVentaSeleccionada(null);
        fetchData();
      } catch (error) {
        console.error(error);
        alert(error.response?.data?.message || "Error al procesar la devolución.");
      }
    }
  };

  const totalVendido = ventas.reduce((sum, v) => sum + (v.estado !== 'Anulada' ? v.total : 0), 0);
  const totalComprado = compras.reduce((sum, c) => sum + (c.estado !== 'Anulada' ? c.total : 0), 0);

  // Calcular Utilidad Real basada en el costo histórico de las ventas
  const utilidadReal = ventas.reduce((sum, v) => {
    if (v.estado === 'Anulada') return sum;
    const utilidadVenta = v.productos?.reduce((acc, item) => {
      const cCompraHistorico = item.costoHistorico || item.producto?.precioCompra || 0; 
      const pVenta = item.precioUnitario || 0;
      return acc + ((pVenta - cCompraHistorico) * item.cantidad);
    }, 0) || 0;
    return sum + utilidadVenta;
  }, 0);

  // Helper para verificar fechas
  const isDateInRange = (dateStr, start, end) => {
    const d = new Date(dateStr);
    if (start && d < start) return false;
    if (end) {
      const endOfDay = new Date(end);
      endOfDay.setHours(23, 59, 59, 999);
      if (d > endOfDay) return false;
    }
    return true;
  };

  // --- Filtros Rentabilidad ---
  const ventasFiltradasRentabilidad = ventas.filter(v => {
    if (v.estado === 'Anulada') return false;
    return isDateInRange(v.fecha, filtroRentabilidad.fechaInicio, filtroRentabilidad.fechaFin);
  });

  const rowsRentabilidad = ventasFiltradasRentabilidad.flatMap(v => 
    v.productos.map(item => {
      const cCompraHistorico = item.costoHistorico || item.producto?.precioCompra || 0; 
      const pVenta = item.precioUnitario || 0;
      const utilidadUnit = pVenta - cCompraHistorico;
      const utilidadTotal = utilidadUnit * item.cantidad;
      return { v, item, cCompraHistorico, pVenta, utilidadUnit, utilidadTotal };
    })
  ).filter(row => {
    if (filtroRentabilidad.productoBusqueda) {
      const nombre = row.item.producto?.nombre?.toLowerCase() || '';
      return nombre.includes(filtroRentabilidad.productoBusqueda.toLowerCase());
    }
    return true;
  });

  const utilidadTotalFiltrada = rowsRentabilidad.reduce((sum, row) => sum + row.utilidadTotal, 0);

  // --- Filtros Ventas ---
  const ventasFiltradas = ventas.filter(v => {
    if (filtroVentas.estado && v.estado !== filtroVentas.estado) return false;
    if (filtroVentas.metodoPago && v.metodoPago !== filtroVentas.metodoPago) return false;
    if (filtroVentas.clienteBusqueda) {
      const nombre = v.cliente?.nombre?.toLowerCase() || 'venta rápida';
      if (!nombre.includes(filtroVentas.clienteBusqueda.toLowerCase())) return false;
    }
    return isDateInRange(v.fecha, filtroVentas.fechaInicio, filtroVentas.fechaFin);
  });

  // --- Filtros Compras ---
  const comprasFiltradas = compras.filter(c => {
    if (filtroCompras.estado && c.estado !== filtroCompras.estado) return false;
    if (filtroCompras.proveedorBusqueda) {
      const prov = (c.proveedor?.nombreEmpresa || c.proveedor?.nombre || 'importación').toLowerCase();
      if (!prov.includes(filtroCompras.proveedorBusqueda.toLowerCase())) return false;
    }
    return isDateInRange(c.createdAt, filtroCompras.fechaInicio, filtroCompras.fechaFin);
  });

  const comprasDetalleFiltradas = comprasFiltradas.flatMap(c => 
    (c.productos || []).map(item => ({ c, item }))
  ).filter(row => {
    if (filtroCompras.productoBusqueda) {
      const prod = (row.item.producto?.nombre || 'eliminado').toLowerCase();
      return prod.includes(filtroCompras.productoBusqueda.toLowerCase());
    }
    return true;
  });

  // --- Filtros Inventario ---
  const inventarioFiltrado = historialInventario.filter(mov => {
    if (filtroInventario.tipo && mov.tipoMovimiento !== filtroInventario.tipo) return false;
    if (filtroInventario.productoBusqueda) {
      const prod = (mov.producto?.nombre || 'eliminado').toLowerCase();
      if (!prod.includes(filtroInventario.productoBusqueda.toLowerCase())) return false;
    }
    return isDateInRange(mov.createdAt, filtroInventario.fechaInicio, filtroInventario.fechaFin);
  });

  // --- Procesar Reporte de Clientes ---
  const reporteClientes = ventas.reduce((acc, v) => {
    if (v.estado !== 'Anulada') {
      const clienteId = v.cliente?._id || 'rapida';
      const clienteNombre = v.cliente?.nombre || 'Venta Rápida';
      if (!acc[clienteId]) {
        acc[clienteId] = { id: clienteId, nombre: clienteNombre, totalGastado: 0, compras: 0, ultimaCompra: v.fecha };
      }
      acc[clienteId].totalGastado += v.total;
      acc[clienteId].compras += 1;
      if (new Date(v.fecha) > new Date(acc[clienteId].ultimaCompra)) {
        acc[clienteId].ultimaCompra = v.fecha;
      }
    }
    return acc;
  }, {});
  const clientesArray = Object.values(reporteClientes).sort((a, b) => b.totalGastado - a.totalGastado);

  if (loading) return <div className="p-8 text-center text-kitty-pink font-bold">Generando reportes maestros... 🎀📊</div>;

  return (
    <div className="p-8 bg-slate-50 min-h-full">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-black text-slate-800 mb-2 flex items-center gap-3">
            <FileText size={40} className="text-kitty-pink" /> Centro de Reportes
          </h1>
          <p className="text-slate-500 font-medium italic">Análisis detallado de ingresos y egresos de Rosestore</p>
        </div>
      </div>

      {/* KPIs Rápidos */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-emerald-100 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Total Ventas</span>
            <div className="p-2 bg-emerald-50 text-emerald-500 rounded-xl"><ShoppingBag size={20} /></div>
          </div>
          <p className="text-2xl font-black text-slate-800">Bs. {totalVendido.toFixed(2)}</p>
          <p className="text-xs text-slate-400 mt-1">{ventas.filter(v => v.estado !== 'Anulada').length} operaciones exitosas</p>
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-sm border border-rose-100 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Inversión Stock</span>
            <div className="p-2 bg-rose-50 text-rose-500 rounded-xl"><ShoppingCart size={20} /></div>
          </div>
          <p className="text-2xl font-black text-slate-800">Bs. {totalComprado.toFixed(2)}</p>
          <p className="text-xs text-slate-400 mt-1">{compras.filter(c => c.estado !== 'Anulada').length} compras activas</p>
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-sm border border-pink-100 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-black text-kitty-pink uppercase tracking-widest">Utilidad Real</span>
            <div className="p-2 bg-pink-50 text-kitty-pink rounded-xl"><TrendingUp size={20} /></div>
          </div>
          <p className="text-2xl font-black text-slate-800">Bs. {utilidadReal.toFixed(2)}</p>
          <p className="text-xs text-slate-400 mt-1">Basado en ventas realizadas</p>
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Volumen</span>
            <div className="p-2 bg-slate-50 text-slate-500 rounded-xl"><Package size={20} /></div>
          </div>
          <p className="text-2xl font-black text-slate-800">{ventas.length + compras.length}</p>
          <p className="text-xs text-slate-400 mt-1">Movimientos totales</p>
        </div>
      </div>

      {/* Selector de Pestaña */}
      <div className="flex flex-wrap gap-4 mb-6 bg-white p-2 rounded-2xl border border-pink-100 w-fit">
        <button 
          onClick={() => setActiveTab('ventas')}
          className={`flex items-center gap-2 px-6 py-2 rounded-xl font-bold transition-all ${activeTab === 'ventas' ? 'bg-kitty-pink text-white shadow-md' : 'text-slate-500 hover:bg-pink-50'}`}
        >
          <ShoppingBag size={18} /> Historial de Ventas
        </button>
        <button 
          onClick={() => setActiveTab('compras')}
          className={`flex items-center gap-2 px-6 py-2 rounded-xl font-bold transition-all ${activeTab === 'compras' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}
        >
          <ShoppingCart size={18} /> Historial de Compras
        </button>
        <button 
          onClick={() => setActiveTab('detalle_compras')}
          className={`flex items-center gap-2 px-6 py-2 rounded-xl font-bold transition-all ${activeTab === 'detalle_compras' ? 'bg-cyan-500 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}
        >
          <List size={18} /> Detalle de Compras
        </button>
        <button 
          onClick={() => setActiveTab('rentabilidad')}
          className={`flex items-center gap-2 px-6 py-2 rounded-xl font-bold transition-all ${activeTab === 'rentabilidad' ? 'bg-indigo-500 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}
        >
          <TrendingUp size={18} /> Rentabilidad por Venta
        </button>
        <button 
          onClick={() => setActiveTab('inventario')}
          className={`flex items-center gap-2 px-6 py-2 rounded-xl font-bold transition-all ${activeTab === 'inventario' ? 'bg-orange-500 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}
        >
          <Package size={18} /> Movimientos de Stock
        </button>
        <button 
          onClick={() => setActiveTab('clientes')}
          className={`flex items-center gap-2 px-6 py-2 rounded-xl font-bold transition-all ${activeTab === 'clientes' ? 'bg-teal-500 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}
        >
          <Users size={18} /> Mejores Clientes
        </button>
      </div>

      {/* Tabla Dinámica */}
      <div className="bg-white rounded-3xl shadow-sm border border-pink-100 overflow-hidden">
        
        {/* --- PESTAÑA: CLIENTES --- */}
        {activeTab === 'clientes' ? (
          <div className="overflow-x-auto">
            <div className="p-6 border-b border-teal-100 flex justify-between items-center bg-teal-50/30">
              <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                <Users className="text-teal-400" /> Reporte de Mejores Clientes
              </h2>
            </div>
            <table className="w-full text-left">
              <thead>
                <tr className="bg-white text-slate-500 text-[10px] font-black uppercase tracking-widest">
                  <th className="p-5 border-b border-slate-100">Cliente</th>
                  <th className="p-5 border-b border-slate-100 text-center">Nº de Compras</th>
                  <th className="p-5 border-b border-slate-100 text-right">Total Invertido</th>
                  <th className="p-5 border-b border-slate-100">Última Compra</th>
                </tr>
              </thead>
              <tbody>
                {clientesArray.length === 0 ? (
                  <tr><td colSpan="4" className="p-10 text-center text-slate-400 font-medium italic">No hay datos de clientes.</td></tr>
                ) : (
                  clientesArray.map((c, index) => (
                    <tr key={c.id} className="hover:bg-teal-50/20 transition-colors border-b border-slate-50 last:border-0">
                      <td className="p-5">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-black ${index < 3 ? 'bg-yellow-100 text-yellow-600' : 'bg-slate-100 text-slate-500'}`}>
                            {index + 1}
                          </div>
                          <p className="font-bold text-slate-800">{c.nombre}</p>
                        </div>
                      </td>
                      <td className="p-5 text-center"><span className="font-black text-slate-600">{c.compras}</span></td>
                      <td className="p-5 text-right font-black text-teal-600">Bs. {c.totalGastado.toFixed(2)}</td>
                      <td className="p-5">
                        <p className="text-sm font-bold text-slate-700">{new Date(c.ultimaCompra).toLocaleDateString()}</p>
                        <p className="text-[10px] text-slate-400">{new Date(c.ultimaCompra).toLocaleTimeString()}</p>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

        // --- PESTAÑA: DETALLE COMPRAS ---
        ) : activeTab === 'detalle_compras' ? (
          <div className="overflow-x-auto">
            <div className="p-6 border-b border-cyan-100 bg-cyan-50/30">
              <h2 className="text-xl font-black text-slate-800 flex items-center gap-2 mb-4">
                <List className="text-cyan-400" /> Detalle de Productos Comprados
              </h2>
              {/* Filtros */}
              <div className="flex flex-wrap gap-4 items-end bg-white p-4 rounded-xl border border-cyan-100 shadow-sm">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs font-bold text-slate-500 mb-1">Buscar Producto</label>
                  <input type="text" placeholder="Ej. Rosa Roja..." 
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-cyan-400"
                    value={filtroCompras.productoBusqueda} onChange={(e) => setFiltroCompras({...filtroCompras, productoBusqueda: e.target.value})}
                  />
                </div>
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs font-bold text-slate-500 mb-1">Buscar Proveedor</label>
                  <input type="text" placeholder="Ej. Distribuidora Sur..." 
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-cyan-400"
                    value={filtroCompras.proveedorBusqueda} onChange={(e) => setFiltroCompras({...filtroCompras, proveedorBusqueda: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Fecha Inicio</label>
                  <DatePicker selected={filtroCompras.fechaInicio} onChange={(date) => setFiltroCompras({...filtroCompras, fechaInicio: date})}
                    locale="es" dateFormat="dd/MM/yyyy" placeholderText="dd/mm/aaaa"
                    className="w-32 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Fecha Fin</label>
                  <DatePicker selected={filtroCompras.fechaFin} onChange={(date) => setFiltroCompras({...filtroCompras, fechaFin: date})}
                    locale="es" dateFormat="dd/MM/yyyy" placeholderText="dd/mm/aaaa"
                    className="w-32 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <button onClick={() => setFiltroCompras({ fechaInicio: null, fechaFin: null, estado: '', proveedorBusqueda: '', productoBusqueda: '' })}
                  className="px-4 py-2 text-sm font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex gap-2 items-center">
                  <FilterX size={16}/> Limpiar
                </button>
              </div>
            </div>
            <table className="w-full text-left">
              <thead>
                <tr className="bg-white text-slate-500 text-xs font-black">
                  <th className="p-5 border-b border-slate-100">Fecha</th>
                  <th className="p-5 border-b border-slate-100">Proveedor</th>
                  <th className="p-5 border-b border-slate-100">Producto</th>
                  <th className="p-5 border-b border-slate-100 text-center">Cant.</th>
                  <th className="p-5 border-b border-slate-100">Costo Unit.</th>
                  <th className="p-5 border-b border-slate-100 text-right">Inversión Total</th>
                </tr>
              </thead>
              <tbody>
                {comprasDetalleFiltradas.length === 0 ? (
                  <tr><td colSpan="6" className="p-10 text-center text-slate-400 font-medium italic">No se encontraron resultados.</td></tr>
                ) : (
                  comprasDetalleFiltradas.map((row, idx) => {
                    const c = row.c;
                    const item = row.item;
                    const costoUnit = item.costoUnitario || item.precioCompra || 0;
                    const inversionTotal = costoUnit * item.cantidad;
                    return (
                      <tr key={`${c._id}-${item.producto?._id || idx}`} className="hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0">
                        <td className="p-5 text-sm text-slate-600">{new Date(c.createdAt).toLocaleDateString()}</td>
                        <td className="p-5 font-bold text-slate-700">{c.proveedor?.nombreEmpresa || c.proveedor?.nombre || 'Importación'}</td>
                        <td className="p-5 font-bold text-slate-800">
                          {item.producto?.nombre || 'Producto Eliminado'} <span className="text-gray-400 text-xs font-normal">({item.producto?.codigo || 'S/N'})</span>
                        </td>
                        <td className="p-5 text-center text-slate-600 font-medium">{item.cantidad}</td>
                        <td className="p-5 text-slate-500">Bs. {costoUnit.toFixed(2)}</td>
                        <td className="p-5 font-black text-right text-cyan-600">Bs. {inversionTotal.toFixed(2)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

        // --- PESTAÑA: INVENTARIO ---
        ) : activeTab === 'inventario' ? (
          <div className="overflow-x-auto">
            <div className="p-6 border-b border-orange-100 bg-orange-50/30">
              <h2 className="text-xl font-black text-slate-800 flex items-center gap-2 mb-4">
                <Package className="text-orange-400" /> Historial de Movimientos de Stock
              </h2>
              {/* Filtros */}
              <div className="flex flex-wrap gap-4 items-end bg-white p-4 rounded-xl border border-orange-100 shadow-sm">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs font-bold text-slate-500 mb-1">Buscar Producto</label>
                  <input type="text" placeholder="Ej. Rosa Roja..." 
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-orange-400"
                    value={filtroInventario.productoBusqueda} onChange={(e) => setFiltroInventario({...filtroInventario, productoBusqueda: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Tipo de Movimiento</label>
                  <select 
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-orange-400 text-slate-600 font-bold"
                    value={filtroInventario.tipo} onChange={(e) => setFiltroInventario({...filtroInventario, tipo: e.target.value})}
                  >
                    <option value="">Todos los Tipos</option>
                    <option value="Entrada">Entrada (+)</option>
                    <option value="Salida">Salida (-)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Fecha Inicio</label>
                  <DatePicker selected={filtroInventario.fechaInicio} onChange={(date) => setFiltroInventario({...filtroInventario, fechaInicio: date})}
                    locale="es" dateFormat="dd/MM/yyyy" placeholderText="dd/mm/aaaa"
                    className="w-32 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-orange-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Fecha Fin</label>
                  <DatePicker selected={filtroInventario.fechaFin} onChange={(date) => setFiltroInventario({...filtroInventario, fechaFin: date})}
                    locale="es" dateFormat="dd/MM/yyyy" placeholderText="dd/mm/aaaa"
                    className="w-32 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-orange-400"
                  />
                </div>
                <button onClick={() => setFiltroInventario({ fechaInicio: null, fechaFin: null, tipo: '', productoBusqueda: '' })}
                  className="px-4 py-2 text-sm font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex gap-2 items-center">
                  <FilterX size={16}/> Limpiar
                </button>
              </div>
            </div>
            <table className="w-full text-left">
              <thead>
                <tr className="bg-white text-slate-500 text-[10px] font-black uppercase tracking-widest">
                  <th className="p-5 border-b border-slate-100">Fecha y Hora</th>
                  <th className="p-5 border-b border-slate-100">Producto</th>
                  <th className="p-5 border-b border-slate-100 text-center">Tipo</th>
                  <th className="p-5 border-b border-slate-100 text-center">Cant.</th>
                  <th className="p-5 border-b border-slate-100">Motivo / Referencia</th>
                </tr>
              </thead>
              <tbody>
                {inventarioFiltrado.length === 0 ? (
                  <tr><td colSpan="5" className="p-10 text-center text-slate-400 font-medium italic">No hay movimientos con los filtros actuales.</td></tr>
                ) : (
                  inventarioFiltrado.map(mov => (
                    <tr key={mov._id} className="hover:bg-orange-50/20 transition-colors border-b border-slate-50 last:border-0">
                      <td className="p-5">
                        <p className="text-sm font-bold text-slate-700">{new Date(mov.createdAt).toLocaleDateString()}</p>
                        <p className="text-[10px] text-slate-400">{new Date(mov.createdAt).toLocaleTimeString()}</p>
                      </td>
                      <td className="p-5">
                        <p className="font-bold text-slate-800">{mov.producto?.nombre || 'Producto Eliminado'}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{mov.producto?.codigo || '---'}</p>
                      </td>
                      <td className="p-5 text-center">
                        <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase ${mov.tipoMovimiento === 'Entrada' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                          {mov.tipoMovimiento}
                        </span>
                      </td>
                      <td className={`p-5 text-center font-black text-lg ${mov.tipoMovimiento === 'Entrada' ? 'text-green-600' : 'text-red-600'}`}>
                        {mov.tipoMovimiento === 'Entrada' ? '+' : '-'}{mov.cantidad}
                      </td>
                      <td className="p-5">
                        <p className="text-xs font-bold text-slate-600">{mov.motivo}</p>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

        // --- PESTAÑA: RENTABILIDAD ---
        ) : activeTab === 'rentabilidad' ? (
          <div className="overflow-x-auto">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                  <TrendingUp className="text-indigo-500" /> Detalle de Rentabilidad por Venta
                </h2>
                <div className="bg-white px-4 py-2 rounded-xl shadow-sm border border-indigo-100 flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-400 uppercase">Utilidad Filtrada:</span>
                  <span className={`text-lg font-black ${utilidadTotalFiltrada >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                    Bs. {utilidadTotalFiltrada.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Filtros */}
              <div className="flex flex-wrap gap-4 items-end bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs font-bold text-slate-500 mb-1">Buscar Producto</label>
                  <input type="text" placeholder="Ej. Rosa Roja..." 
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-400"
                    value={filtroRentabilidad.productoBusqueda} onChange={(e) => setFiltroRentabilidad({...filtroRentabilidad, productoBusqueda: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Fecha Inicio</label>
                  <DatePicker selected={filtroRentabilidad.fechaInicio} onChange={(date) => setFiltroRentabilidad({...filtroRentabilidad, fechaInicio: date})}
                    locale="es" dateFormat="dd/MM/yyyy" placeholderText="dd/mm/aaaa"
                    className="w-32 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Fecha Fin</label>
                  <DatePicker selected={filtroRentabilidad.fechaFin} onChange={(date) => setFiltroRentabilidad({...filtroRentabilidad, fechaFin: date})}
                    locale="es" dateFormat="dd/MM/yyyy" placeholderText="dd/mm/aaaa"
                    className="w-32 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-400"
                  />
                </div>
                <button onClick={() => setFiltroRentabilidad({ fechaInicio: null, fechaFin: null, productoBusqueda: '' })}
                  className="px-4 py-2 text-sm font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex gap-2 items-center">
                  <FilterX size={16}/> Limpiar
                </button>
              </div>
            </div>
            <table className="w-full text-left">
              <thead>
                <tr className="bg-white text-slate-500 text-xs font-black">
                  <th className="p-5 border-b border-slate-100">Fecha</th>
                  <th className="p-5 border-b border-slate-100">Nº Venta</th>
                  <th className="p-5 border-b border-slate-100">Producto</th>
                  <th className="p-5 border-b border-slate-100 text-center">Cant.</th>
                  <th className="p-5 border-b border-slate-100">P. Venta</th>
                  <th className="p-5 border-b border-slate-100">C. Compra (Histórico)</th>
                  <th className="p-5 border-b border-slate-100">Utilidad Unit.</th>
                  <th className="p-5 border-b border-slate-100 text-right">Utilidad Total</th>
                </tr>
              </thead>
              <tbody>
                {rowsRentabilidad.length === 0 ? (
                  <tr><td colSpan="8" className="p-10 text-center text-slate-400 font-medium italic">No se encontraron resultados con los filtros actuales.</td></tr>
                ) : (
                  rowsRentabilidad.map((row, idx) => (
                    <tr key={`${row.v._id}-${row.item.producto?._id || idx}`} className="hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0">
                      <td className="p-5 text-sm text-slate-600">{new Date(row.v.fecha).toLocaleDateString()}</td>
                      <td className="p-5 text-sm text-slate-500 font-mono">#{row.v._id.slice(-5).toUpperCase()}</td>
                      <td className="p-5 font-bold text-slate-800">
                        {row.item.producto?.nombre || 'Producto Eliminado'} <span className="text-gray-400 text-xs font-normal">({row.item.producto?.codigo || 'S/N'})</span>
                      </td>
                      <td className="p-5 text-center text-slate-600 font-medium">{row.item.cantidad}</td>
                      <td className="p-5 text-indigo-500 font-bold">Bs. {row.pVenta.toFixed(2)}</td>
                      <td className="p-5 text-slate-500">Bs. {row.cCompraHistorico.toFixed(2)}</td>
                      <td className={`p-5 font-bold ${row.utilidadUnit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        Bs. {row.utilidadUnit.toFixed(2)}
                      </td>
                      <td className={`p-5 font-black text-right ${row.utilidadTotal >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        Bs. {row.utilidadTotal.toFixed(2)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

        // --- PESTAÑA: VENTAS ---
        ) : activeTab === 'ventas' ? (
          <div className="overflow-x-auto">
            <div className="p-6 border-b border-pink-100 bg-pink-50/30">
              <h2 className="text-xl font-black text-slate-800 flex items-center gap-2 mb-4">
                <ShoppingBag className="text-kitty-pink" /> Historial de Ventas
              </h2>
              {/* Filtros */}
              <div className="flex flex-wrap gap-4 items-end bg-white p-4 rounded-xl border border-pink-100 shadow-sm">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs font-bold text-slate-500 mb-1">Buscar Cliente</label>
                  <input type="text" placeholder="Ej. Juan Perez..." 
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-kitty-pink"
                    value={filtroVentas.clienteBusqueda} onChange={(e) => setFiltroVentas({...filtroVentas, clienteBusqueda: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Método de Pago</label>
                  <select 
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-kitty-pink font-bold text-slate-600"
                    value={filtroVentas.metodoPago} onChange={(e) => setFiltroVentas({...filtroVentas, metodoPago: e.target.value})}
                  >
                    <option value="">Todos</option>
                    <option value="Efectivo">Efectivo</option>
                    <option value="Transferencia">Transferencia</option>
                    <option value="Tarjeta">Tarjeta</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Estado</label>
                  <select 
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-kitty-pink font-bold text-slate-600"
                    value={filtroVentas.estado} onChange={(e) => setFiltroVentas({...filtroVentas, estado: e.target.value})}
                  >
                    <option value="">Todos</option>
                    <option value="Completada">Completada</option>
                    <option value="Anulada">Anulada</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Fecha Inicio</label>
                  <DatePicker selected={filtroVentas.fechaInicio} onChange={(date) => setFiltroVentas({...filtroVentas, fechaInicio: date})}
                    locale="es" dateFormat="dd/MM/yyyy" placeholderText="dd/mm/aaaa"
                    className="w-32 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-kitty-pink"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Fecha Fin</label>
                  <DatePicker selected={filtroVentas.fechaFin} onChange={(date) => setFiltroVentas({...filtroVentas, fechaFin: date})}
                    locale="es" dateFormat="dd/MM/yyyy" placeholderText="dd/mm/aaaa"
                    className="w-32 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-kitty-pink"
                  />
                </div>
                <button onClick={() => setFiltroVentas({ fechaInicio: null, fechaFin: null, metodoPago: '', estado: '', clienteBusqueda: '' })}
                  className="px-4 py-2 text-sm font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex gap-2 items-center">
                  <FilterX size={16}/> Limpiar
                </button>
              </div>
            </div>
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest">
                  <th className="p-5 border-b border-pink-50">Fecha y Hora</th>
                  <th className="p-5 border-b border-pink-50">Cliente</th>
                  <th className="p-5 border-b border-pink-50">Productos</th>
                  <th className="p-5 border-b border-pink-50 text-right">Monto</th>
                  <th className="p-5 border-b border-pink-50">Método / Cuenta</th>
                  <th className="p-5 border-b border-pink-50 text-center">Estado</th>
                  <th className="p-5 border-b border-pink-50 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {ventasFiltradas.length === 0 ? (
                  <tr><td colSpan="7" className="p-10 text-center text-slate-400 font-medium italic">No se encontraron ventas con los filtros actuales.</td></tr>
                ) : (
                  ventasFiltradas.map(v => (
                    <tr key={v._id} className={`hover:bg-pink-50/30 transition-colors border-b border-slate-50 last:border-0 ${v.estado === 'Anulada' ? 'opacity-50' : ''}`}>
                      <td className="p-5">
                        <p className="text-sm font-bold text-slate-700">{new Date(v.fecha).toLocaleDateString()}</p>
                        <p className="text-[10px] text-slate-400">{new Date(v.fecha).toLocaleTimeString()}</p>
                      </td>
                      <td className="p-5">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-pink-100 flex items-center justify-center text-kitty-pink text-[10px] font-bold"><User size={14} /></div>
                          <span className="text-sm font-medium text-slate-600">{v.cliente?.nombre || 'Venta Rápida'}</span>
                        </div>
                      </td>
                      <td className="p-5">
                        <button 
                          onClick={() => setVentaSeleccionada(v)}
                          className="flex items-center gap-2 px-3 py-1.5 bg-pink-50 text-kitty-pink hover:bg-kitty-pink hover:text-white rounded-lg transition-colors text-xs font-bold"
                        >
                          <Eye size={14} /> Ver Detalles ({v.productos?.length || 0})
                        </button>
                      </td>
                      <td className="p-5 text-right font-black text-slate-800">Bs. {v.total.toFixed(2)}</td>
                      <td className="p-5">
                        <p className="text-xs font-bold text-slate-600">{v.metodoPago}</p>
                        <p className="text-[10px] text-slate-400">{v.cuentaDestino}</p>
                      </td>
                      <td className="p-5 text-center">
                        <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase ${v.estado === 'Completada' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-500'}`}>
                          {v.estado}
                        </span>
                      </td>
                      <td className="p-5 text-center">
                        {v.estado !== 'Anulada' && (
                          <div className="flex items-center justify-center gap-1.5">
                            <button 
                              onClick={() => abrirModalEditarFecha(v)} 
                              className="p-2 bg-pink-50 text-kitty-pink rounded-lg hover:bg-kitty-pink hover:text-white transition-all" 
                              title="Cambiar Fecha de Venta"
                            >
                              <Calendar size={16} />
                            </button>
                            <button 
                              onClick={() => handleAnularVenta(v._id)} 
                              className="p-2 bg-rose-50 text-rose-500 rounded-lg hover:bg-rose-500 hover:text-white transition-all" 
                              title="Anular Venta"
                            >
                              <RotateCcw size={16} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

        // --- PESTAÑA: COMPRAS ---
        ) : (
          <div className="overflow-x-auto">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-xl font-black text-slate-800 flex items-center gap-2 mb-4">
                <ShoppingCart className="text-slate-600" /> Historial de Compras
              </h2>
              {/* Filtros */}
              <div className="flex flex-wrap gap-4 items-end bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs font-bold text-slate-500 mb-1">Buscar Proveedor</label>
                  <input type="text" placeholder="Ej. Importadora X..." 
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400"
                    value={filtroCompras.proveedorBusqueda} onChange={(e) => setFiltroCompras({...filtroCompras, proveedorBusqueda: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Estado</label>
                  <select 
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400 font-bold text-slate-600"
                    value={filtroCompras.estado} onChange={(e) => setFiltroCompras({...filtroCompras, estado: e.target.value})}
                  >
                    <option value="">Todos</option>
                    <option value="Recibido">Recibido</option>
                    <option value="Anulada">Anulada</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Fecha Inicio</label>
                  <DatePicker selected={filtroCompras.fechaInicio} onChange={(date) => setFiltroCompras({...filtroCompras, fechaInicio: date})}
                    locale="es" dateFormat="dd/MM/yyyy" placeholderText="dd/mm/aaaa"
                    className="w-32 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Fecha Fin</label>
                  <DatePicker selected={filtroCompras.fechaFin} onChange={(date) => setFiltroCompras({...filtroCompras, fechaFin: date})}
                    locale="es" dateFormat="dd/MM/yyyy" placeholderText="dd/mm/aaaa"
                    className="w-32 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400"
                  />
                </div>
                <button onClick={() => setFiltroCompras({ fechaInicio: null, fechaFin: null, estado: '', proveedorBusqueda: '', productoBusqueda: '' })}
                  className="px-4 py-2 text-sm font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex gap-2 items-center">
                  <FilterX size={16}/> Limpiar
                </button>
              </div>
            </div>
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest">
                  <th className="p-5 border-b border-slate-100">Fecha</th>
                  <th className="p-5 border-b border-slate-100">Proveedor</th>
                  <th className="p-5 border-b border-slate-100">Productos</th>
                  <th className="p-5 border-b border-slate-100 text-right">Inversión</th>
                  <th className="p-5 border-b border-slate-100 text-center">Estado</th>
                  <th className="p-5 border-b border-slate-100 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {comprasFiltradas.length === 0 ? (
                  <tr><td colSpan="6" className="p-10 text-center text-slate-400 font-medium italic">No se encontraron compras con los filtros actuales.</td></tr>
                ) : (
                  comprasFiltradas.map(c => (
                    <tr key={c._id} className={`hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0 ${c.estado === 'Anulada' ? 'opacity-50' : ''}`}>
                      <td className="p-5">
                        <p className="text-sm font-bold text-slate-700">{new Date(c.createdAt).toLocaleDateString()}</p>
                      </td>
                      <td className="p-5">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500"><Truck size={14} /></div>
                          <span className="text-sm font-medium text-slate-600">{c.proveedor?.nombreEmpresa || c.proveedor?.nombre || 'Importación'}</span>
                        </div>
                      </td>
                      <td className="p-5">
                        <button 
                          onClick={() => setCompraSeleccionada(c)}
                          className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-600 hover:bg-slate-800 hover:text-white rounded-lg transition-colors text-xs font-bold"
                        >
                          <Eye size={14} /> Ver Detalles ({c.productos?.length || 0})
                        </button>
                      </td>
                      <td className="p-5 text-right font-black text-slate-800">Bs. {c.total.toFixed(2)}</td>
                      <td className="p-5 text-center">
                        <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase ${c.estado === 'Anulada' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                          {c.estado || 'Recibido'}
                        </span>
                      </td>
                      <td className="p-5 text-center">
                        {c.estado !== 'Anulada' && (
                          <button onClick={() => handleAnularCompra(c._id)} className="p-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all" title="Anular Compra">
                            <RotateCcw size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Productos de Venta */}
      {ventaSeleccionada && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl relative">
            <button 
              onClick={() => setVentaSeleccionada(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-rose-500 transition-colors"
            >
              <XCircle size={24} />
            </button>
            <h3 className="text-xl font-black text-slate-800 mb-4 flex items-center gap-2">
              <Package className="text-kitty-pink" /> Detalles de la Venta
            </h3>
            
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
              {ventaSeleccionada.productos?.map((item, i) => {
                const pVenta = item.precioUnitario || item.producto?.precioVenta || 0;
                return (
                  <div key={i} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div>
                      <p className="font-bold text-slate-700 text-sm">
                        {item.producto?.nombre || 'Producto eliminado'}
                        {item.cantidadDevuelta > 0 && (
                          <span className="ml-2 text-xs font-bold text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full">
                            (-{item.cantidadDevuelta} devueltas)
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-slate-500">{item.cantidad} x Bs. {pVenta.toFixed(2)}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <p className="font-black text-kitty-pink">Bs. {(item.cantidad * pVenta).toFixed(2)}</p>
                      {ventaSeleccionada.estado !== 'Anulada' && item.cantidad > 0 && (
                        <button 
                          onClick={() => handleDevolverProducto(ventaSeleccionada._id, item.producto?._id, item.cantidad)}
                          className="px-3 py-1 bg-rose-100 text-rose-600 hover:bg-rose-500 hover:text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                          title="Devolver unidades de este producto"
                        >
                          <RotateCcw size={12} /> Devolver
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className="mt-6 pt-4 border-t border-slate-100 flex justify-between items-center">
              <span className="text-sm font-bold text-slate-500">Total Venta</span>
              <span className="text-2xl font-black text-slate-800">Bs. {ventaSeleccionada.total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Productos de Compra */}
      {compraSeleccionada && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl relative">
            <button 
              onClick={() => setCompraSeleccionada(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-rose-500 transition-colors"
            >
              <XCircle size={24} />
            </button>
            <h3 className="text-xl font-black text-slate-800 mb-4 flex items-center gap-2">
              <ShoppingCart className="text-slate-600" /> Detalles de la Compra
            </h3>
            
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
              {compraSeleccionada.productos?.map((item, i) => {
                const cCompra = item.costoUnitario || item.precioCompra || item.producto?.precioCompra || 0;
                return (
                  <div key={i} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div>
                      <p className="font-bold text-slate-700 text-sm">{item.producto?.nombre || 'Producto eliminado'}</p>
                      <p className="text-xs text-slate-500">{item.cantidad} x Bs. {cCompra.toFixed(2)}</p>
                    </div>
                    <p className="font-black text-slate-800">Bs. {(item.cantidad * cCompra).toFixed(2)}</p>
                  </div>
                );
              })}
            </div>
            
            <div className="mt-6 pt-4 border-t border-slate-100 flex justify-between items-center">
              <span className="text-sm font-bold text-slate-500">Inversión Total</span>
              <span className="text-2xl font-black text-slate-800">Bs. {compraSeleccionada.total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar Fecha de Venta */}
      {ventaParaEditarFecha && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl relative">
            <button 
              onClick={() => setVentaParaEditarFecha(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-rose-500 transition-colors"
            >
              <XCircle size={24} />
            </button>
            <h3 className="text-xl font-black text-slate-800 mb-1.5 flex items-center gap-2">
              <Calendar className="text-kitty-pink" /> Modificar Fecha
            </h3>
            <p className="text-xs text-slate-500 mb-4 font-medium">
              Venta #{ventaParaEditarFecha._id.slice(-6).toUpperCase()} • {ventaParaEditarFecha.cliente?.nombre || 'Venta Rápida'}
            </p>
            
            <form onSubmit={handleGuardarNuevaFecha}>
              <div className="mb-5">
                <label className="block text-xs font-bold text-slate-600 mb-1.5">Nueva Fecha y Hora de la Venta:</label>
                <input
                  type="datetime-local"
                  required
                  value={nuevaFechaVenta}
                  onChange={(e) => setNuevaFechaVenta(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-pink-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-kitty-pink focus:bg-white"
                />
                <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                  💡 Al modificar esta fecha, las estadísticas de ventas en el Dashboard, reportes y finanzas se reubicarán en este nuevo día.
                </p>
              </div>

              <div className="flex gap-2.5 justify-end">
                <button
                  type="button"
                  onClick={() => setVentaParaEditarFecha(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-kitty-pink hover:bg-kitty-rose shadow-md transition-colors"
                >
                  Guardar Fecha
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportesPage;
