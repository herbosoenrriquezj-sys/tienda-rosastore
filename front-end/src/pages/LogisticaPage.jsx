import { useState, useEffect } from 'react';
import axios from 'axios';
import { Truck, MapPin, Search, Package, User, CheckCircle, Clock, Eye, XCircle, RotateCcw, Ban, AlertCircle } from 'lucide-react';

const LogisticaPage = () => {
  const [entregas, setEntregas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [entregaSeleccionada, setEntregaSeleccionada] = useState(null);

  const fetchEntregas = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/logistica/detalles`);
      setEntregas(res.data);
    } catch (error) {
      console.error("Error al cargar logística:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntregas();
  }, []);

  const handleUpdate = async (id, field, value) => {
    try {
      await axios.put(`${import.meta.env.VITE_API_URL}/api/logistica/${id}`, { [field]: value });
      setEntregas(entregas.map(e => e._id === id ? { ...e, [field]: value } : e));
    } catch (error) {
      console.error("Error al actualizar logística:", error);
      alert("No se pudo actualizar el registro.");
    }
  };

  const handleAnularVenta = async (ventaId) => {
    if (!ventaId) return;
    if (window.confirm("¿Estás seguro de ANULAR esta venta y cancelar el despacho? Se devolverá todo el stock al inventario y se revertirá el monto en finanzas y dashboard.")) {
      try {
        await axios.put(`${import.meta.env.VITE_API_URL}/api/ventas/${ventaId}/anular`);
        alert("Venta anulada y despacho cancelado con éxito. Stock, finanzas y dashboard actualizados. 🔄");
        setEntregaSeleccionada(null);
        fetchEntregas();
      } catch (error) {
        console.error(error);
        alert(error.response?.data?.message || "Error al anular la venta.");
      }
    }
  };

  const handleDevolverProducto = async (ventaId, productoId, maxCantidad) => {
    const cantidad = prompt(`¿Cuántas unidades deseas devolver/rechazar? (Máximo: ${maxCantidad})`);
    if (!cantidad) return;
    
    const cantidadNum = parseInt(cantidad, 10);
    if (isNaN(cantidadNum) || cantidadNum <= 0 || cantidadNum > maxCantidad) {
      alert("Cantidad inválida.");
      return;
    }

    if (window.confirm(`¿Confirmas el rechazo de ${cantidadNum} unidades? Esto devolverá el stock y restará el monto en finanzas y dashboard.`)) {
      try {
        await axios.put(`${import.meta.env.VITE_API_URL}/api/ventas/${ventaId}/devolver-producto`, {
          productoId,
          cantidadADevolver: cantidadNum
        });
        alert("Devolución/Rechazo procesado con éxito. 🔄");
        setEntregaSeleccionada(null);
        fetchEntregas();
      } catch (error) {
        console.error(error);
        alert(error.response?.data?.message || "Error al procesar la devolución.");
      }
    }
  };

  const entregasFiltradas = entregas.filter(e => {
    const cliente = e.venta?.cliente?.nombre || 'Consumidor Final';
    const tipo = e.tipoEnvio || '';
    const dir = e.direccionEntrega || '';
    const punto = e.puntoEntrega || '';
    const low = searchTerm.toLowerCase();
    return cliente.toLowerCase().includes(low) || 
           tipo.toLowerCase().includes(low) ||
           dir.toLowerCase().includes(low) ||
           punto.toLowerCase().includes(low);
  });

  const getStatusColor = (estado, ventaEstado) => {
    if (estado === 'Cancelado' || ventaEstado === 'Anulada') return 'bg-red-100 text-red-700 border border-red-200';
    switch(estado) {
      case 'Pendiente': return 'bg-amber-100 text-amber-700';
      case 'Recibido':  return 'bg-emerald-100 text-emerald-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  if (loading) return <div className="p-8 text-center text-kitty-pink">Cargando módulo de logística... 🚚</div>;

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-kitty-pink mb-2 flex items-center gap-2">
            <Truck size={32} /> Logística y Envíos
          </h1>
          <p className="text-gray-600">Gestiona los despachos, envíos a domicilio y retiros sincronizados con inventario y ventas</p>
        </div>
      </div>

      <div className="kitty-card p-6 mb-8 flex items-center gap-4">
        <Search className="text-gray-400" />
        <input 
          type="text" 
          placeholder="Buscar por cliente, tipo de envío o dirección..." 
          className="flex-1 outline-none text-slate-700 bg-transparent"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-pink-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider">
                <th className="p-4 border-b border-pink-100 font-bold">Fecha / Venta</th>
                <th className="p-4 border-b border-pink-100 font-bold">Cliente</th>
                <th className="p-4 border-b border-pink-100 font-bold">Productos</th>
                <th className="p-4 border-b border-pink-100 font-bold">Envío / Dirección</th>
                <th className="p-4 border-b border-pink-100 font-bold text-center">Estado</th>
                <th className="p-4 border-b border-pink-100 font-bold">Repartidor</th>
                <th className="p-4 border-b border-pink-100 font-bold text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {entregasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-gray-500">
                    No hay registros de logística. 🚚
                  </td>
                </tr>
              ) : (
                entregasFiltradas.map(entrega => {
                  const esAnulada = entrega.venta?.estado === 'Anulada' || entrega.estadoEntrega === 'Cancelado';
                  return (
                    <tr key={entrega._id} className={`hover:bg-pink-50/50 transition-colors border-b border-pink-50 last:border-0 ${esAnulada ? 'bg-rose-50/30' : ''}`}>
                      <td className="p-4">
                        <p className="font-bold text-slate-800 text-sm">{new Date(entrega.createdAt).toLocaleDateString()}</p>
                        <p className="text-xs text-gray-400 font-mono">
                          ID: {entrega.venta?._id ? `${entrega.venta._id.toString().slice(-6).toUpperCase()}` : 'N/A'}
                        </p>
                        {entrega.venta?.estado === 'Anulada' && (
                          <span className="inline-block mt-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 bg-rose-100 text-rose-600 rounded">
                            Venta Anulada
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${esAnulada ? 'bg-slate-100 text-slate-400' : 'bg-pink-100 text-pink-500'}`}>
                            <User size={16} />
                          </div>
                          <span className={`font-bold ${esAnulada ? 'text-slate-500 line-through' : 'text-slate-700'}`}>
                            {entrega.venta?.cliente?.nombre 
                              ? `${entrega.venta.cliente.nombre} ${entrega.venta.cliente.apellidos || ''}` 
                              : 'Consumidor Final'}
                          </span>
                        </div>
                      </td>
                      <td className="p-4">
                        <button 
                          onClick={() => setEntregaSeleccionada(entrega)}
                          className="flex items-center gap-2 px-3 py-1.5 bg-pink-50 text-kitty-pink hover:bg-kitty-pink hover:text-white rounded-lg transition-colors text-xs font-bold"
                        >
                          <Eye size={14} /> Ver / Rechazar ({entrega.venta?.productos?.length || 0})
                        </button>
                      </td>
                      <td className="p-4">
                        <p className="font-bold text-kitty-pink text-sm flex items-center gap-1">
                          {entrega.tipoEnvio === 'Envio a Domicilio' && <span>🏠</span>}
                          {entrega.tipoEnvio === 'Envio Nacional' && <span>🚚</span>}
                          {entrega.tipoEnvio === 'Punto de Entrega' && <span>📍</span>}
                          {entrega.tipoEnvio}
                        </p>
                        {entrega.tipoEnvio === 'Punto de Entrega' ? (
                          <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                            <MapPin size={12} /> {entrega.puntoEntrega || 'Sin punto registrado'}
                          </p>
                        ) : (
                          <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                            <MapPin size={12} /> {entrega.direccionEntrega || 'Sin dirección registrada'}
                          </p>
                        )}
                        {entrega.costoEnvio > 0 && (
                          <p className="text-xs font-bold text-slate-600 mt-1">Costo: Bs. {entrega.costoEnvio}</p>
                        )}
                        {entrega.tipoEnvio === 'Punto de Entrega' && (
                          <p className="text-xs font-bold text-emerald-600 mt-1">📍 Sin costo de envío</p>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        {esAnulada ? (
                          <span className={`text-xs font-bold px-3 py-1.5 rounded-full inline-block ${getStatusColor('Cancelado', 'Anulada')}`}>
                            ❌ Cancelado
                          </span>
                        ) : (
                          <select
                            value={entrega.estadoEntrega}
                            onChange={(e) => handleUpdate(entrega._id, 'estadoEntrega', e.target.value)}
                            className={`text-xs font-bold px-3 py-1.5 rounded-full outline-none border-2 border-transparent focus:border-pink-300 appearance-none cursor-pointer ${getStatusColor(entrega.estadoEntrega, entrega.venta?.estado)}`}
                          >
                            <option value="Pendiente">⏳ Pendiente</option>
                            <option value="Recibido">✅ Recibido</option>
                          </select>
                        )}
                      </td>
                      <td className="p-4">
                        {esAnulada ? (
                          <span className="text-xs text-gray-400 italic">Despacho cancelado</span>
                        ) : (
                          <input 
                            type="text" 
                            placeholder="Asignar repartidor..."
                            defaultValue={entrega.repartidor || ''}
                            onBlur={(e) => {
                              if (e.target.value !== entrega.repartidor) {
                                handleUpdate(entrega._id, 'repartidor', e.target.value);
                              }
                            }}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm outline-none focus:border-kitty-pink focus:bg-white"
                          />
                        )}
                      </td>
                      <td className="p-4 text-center">
                        {!esAnulada && entrega.venta?._id && (
                          <button
                            onClick={() => handleAnularVenta(entrega.venta._id)}
                            className="px-3 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-500 hover:text-white rounded-lg transition-colors text-xs font-bold flex items-center gap-1 mx-auto"
                            title="Anular venta y cancelar despacho"
                          >
                            <Ban size={13} /> Anular
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Productos de la Entrega */}
      {entregaSeleccionada && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl relative">
            <button 
              onClick={() => setEntregaSeleccionada(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-rose-500 transition-colors"
            >
              <XCircle size={24} />
            </button>
            <h3 className="text-xl font-black text-slate-800 mb-4 flex items-center gap-2">
              <Package className="text-kitty-pink" /> Detalles de la Entrega
            </h3>

            {entregaSeleccionada.venta?.estado === 'Anulada' && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs font-bold text-rose-700">
                <AlertCircle size={16} />
                <span>Esta venta está ANULADA. El stock y el dinero ya fueron devueltos.</span>
              </div>
            )}
            
            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2">
              {entregaSeleccionada.venta?.productos?.map((item, i) => {
                const pVenta = item.precioUnitario || item.producto?.precioVenta || 0;
                return (
                  <div key={i} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div>
                      <p className="font-bold text-slate-700 text-sm">
                        {item.producto?.nombre || 'Producto eliminado'}
                        {item.cantidadDevuelta > 0 && (
                          <span className="ml-2 text-xs font-bold text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full">
                            (-{item.cantidadDevuelta} rechazadas)
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-slate-500">{item.cantidad} x Bs. {pVenta.toFixed(2)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="font-black text-kitty-pink">Bs. {(item.cantidad * pVenta).toFixed(2)}</p>
                      {entregaSeleccionada.venta?.estado !== 'Anulada' && item.cantidad > 0 && (
                        <button 
                          onClick={() => handleDevolverProducto(entregaSeleccionada.venta._id, item.producto?._id, item.cantidad)}
                          className="px-2.5 py-1 bg-rose-100 text-rose-600 hover:bg-rose-500 hover:text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                          title="Rechazar unidades en entrega"
                        >
                          <RotateCcw size={12} /> Rechazar
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className="mt-6 pt-4 border-t border-slate-100 flex justify-between items-center">
              <span className="text-sm font-bold text-slate-500">Total Venta Activa</span>
              <span className="text-2xl font-black text-slate-800">
                {entregaSeleccionada.venta?.estado === 'Anulada' 
                  ? 'Bs. 0.00' 
                  : `Bs. ${entregaSeleccionada.venta?.total?.toFixed(2) || '0.00'}`}
              </span>
            </div>

            {entregaSeleccionada.venta?.estado !== 'Anulada' && entregaSeleccionada.venta?._id && (
              <div className="mt-4 pt-3 border-t border-slate-100">
                <button
                  onClick={() => handleAnularVenta(entregaSeleccionada.venta._id)}
                  className="w-full py-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2 shadow-md shadow-rose-200"
                >
                  <Ban size={16} /> Anular Venta Completa y Despacho
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LogisticaPage;
