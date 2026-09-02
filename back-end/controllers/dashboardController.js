import Venta from '../models/Venta.js';
import Producto from '../models/Producto.js';
import Cliente from '../models/Cliente.js';

export const getDashboardStats = async (req, res) => {
  try {
    const { periodo, fechaInicio, fechaFin } = req.query;
    let filterFecha = {};
    let filterCreatedAt = {};
    let dateFormat = "%Y-%m-%d";

    if (periodo === 'personalizado' || (fechaInicio || fechaFin)) {
      filterFecha.fecha = {};
      filterCreatedAt.createdAt = {};

      let sDate = null;
      let eDate = null;

      if (fechaInicio) {
        if (typeof fechaInicio === 'string' && fechaInicio.includes('-')) {
          const [y, m, d] = fechaInicio.split('T')[0].split('-').map(Number);
          sDate = new Date(Date.UTC(y, m - 1, d, 4, 0, 0, 0)); // 00:00 Bolivia (UTC-4)
        } else {
          sDate = new Date(fechaInicio);
          sDate.setHours(0, 0, 0, 0);
        }
        filterFecha.fecha.$gte = sDate;
        filterCreatedAt.createdAt.$gte = sDate;
      }

      if (fechaFin) {
        if (typeof fechaFin === 'string' && fechaFin.includes('-')) {
          const [y, m, d] = fechaFin.split('T')[0].split('-').map(Number);
          eDate = new Date(Date.UTC(y, m - 1, d + 1, 3, 59, 59, 999)); // 23:59:59 Bolivia
        } else {
          eDate = new Date(fechaFin);
          eDate.setHours(23, 59, 59, 999);
        }
        filterFecha.fecha.$lte = eDate;
        filterCreatedAt.createdAt.$lte = eDate;
      }

      if (Object.keys(filterFecha.fecha).length === 0) {
        delete filterFecha.fecha;
        delete filterCreatedAt.createdAt;
      }

      if (sDate && eDate) {
        const diffDays = Math.ceil(Math.abs(eDate - sDate) / (1000 * 60 * 60 * 24));
        if (diffDays > 90) {
          dateFormat = "%Y-%m";
        }
      }
    } else if (periodo && periodo !== 'general') {
      const startDate = new Date();
      // Ajustar a 00:00 de Bolivia (UTC-4 => 04:00 UTC)
      startDate.setUTCHours(4, 0, 0, 0);
      
      // Si aún no son las 4 AM UTC, hoy en Bolivia empezó ayer a las 4 AM UTC
      if (new Date().getUTCHours() < 4) {
        startDate.setUTCDate(startDate.getUTCDate() - 1);
      }

      if (periodo === 'dia') {
        // Hoy
      } else if (periodo === 'semana') {
        startDate.setUTCDate(startDate.getUTCDate() - 7);
      } else if (periodo === 'mes') {
        startDate.setUTCMonth(startDate.getUTCMonth() - 1);
      } else if (periodo === 'año') {
        startDate.setUTCFullYear(startDate.getUTCFullYear() - 1);
        dateFormat = "%Y-%m";
      }
      
      filterFecha = { fecha: { $gte: startDate } };
      filterCreatedAt = { createdAt: { $gte: startDate } };
    }

    // Calcular total de ventas y utilidad real (excluyendo ventas anuladas)
    const ventas = await Venta.find(filterFecha).populate('productos.producto');
    const ventasActivas = ventas.filter(v => v.estado !== 'Anulada');
    const totalVentas = ventasActivas.reduce((sum, venta) => sum + (venta.total || 0), 0);
    const ventasCount = ventasActivas.length;

    const utilidadReal = ventasActivas.reduce((sum, venta) => {
      const utilidadVenta = (venta.productos || []).reduce((acc, item) => {
        const cCompraHistorico = item.costoHistorico || item.producto?.precioCompra || 0; 
        const pVenta = item.precioUnitario || 0;
        const cantEfectiva = item.cantidad - (item.cantidadDevuelta || 0);
        return acc + ((pVenta - cCompraHistorico) * cantEfectiva);
      }, 0);
      const descAplicado = venta.descuento?.montoAplicado || 0;
      return sum + Math.max(0, utilidadVenta - descAplicado);
    }, 0);

    // Calcular productos con stock bajo
    const productosBajoStock = await Producto.find({ $expr: { $lte: ["$stock", "$stockMinimo"] } });
    const bajoStockCount = productosBajoStock.length;

    // Total Clientes
    const clientesCount = await Cliente.countDocuments(filterCreatedAt);

    // Ventas recientes (ultimas 5 ventas activas en el filtro)
    const ventasRecientes = await Venta.find({ ...filterFecha, estado: { $ne: 'Anulada' } })
      .sort({ fecha: -1 })
      .limit(5)
      .populate('cliente', 'nombre apellidos');

    // Datos para gráfico de ventas (excluyendo anuladas)
    let matchGrafico = { estado: { $ne: 'Anulada' } };
    if (filterFecha.fecha) {
      matchGrafico.fecha = filterFecha.fecha;
    } else {
      let fechaGrafico = new Date();
      fechaGrafico.setUTCHours(4, 0, 0, 0);
      if (new Date().getUTCHours() < 4) {
        fechaGrafico.setUTCDate(fechaGrafico.getUTCDate() - 1);
      }
      fechaGrafico.setUTCDate(fechaGrafico.getUTCDate() - 7);
      matchGrafico.fecha = { $gte: fechaGrafico };
    }
    
    const ventasGrafico = await Venta.aggregate([
      { $match: matchGrafico },
      {
        $group: {
          _id: { $dateToString: { format: dateFormat, date: "$fecha", timezone: "-04:00" } },
          total: { $sum: "$total" }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.status(200).json({
      resumen: {
        totalVentas,
        utilidadReal,
        ventasCount,
        bajoStockCount,
        clientesCount
      },
      ventasRecientes,
      ventasGrafico
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
