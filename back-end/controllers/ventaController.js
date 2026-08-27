import Venta from '../models/Venta.js';
import Producto from '../models/Producto.js';
import Finanzas from '../models/Finanzas.js';
import Logistica from '../models/Logistica.js';
import Inventario from '../models/Inventario.js';

export const registrarVenta = async (req, res) => {
  try {
    const { cliente, productos, total, metodoPago, cuentaDestino, logistica, descuento, subtotalProductos, fecha } = req.body;
    const fechaVenta = fecha ? new Date(fecha) : new Date();

    if (!productos || productos.length === 0) {
      return res.status(400).json({ message: 'La venta debe tener al menos un producto' });
    }
    if (total < 0) {
      return res.status(400).json({ message: 'El total de la venta no puede ser negativo' });
    }

    // 1. Validar stock antes de vender y obtener costos históricos
    const productosConCosto = [];
    for (let item of productos) {
      const productoDb = await Producto.findById(item.producto);
      if (!productoDb) {
        return res.status(404).json({ message: `Producto no encontrado` });
      }
      if (item.cantidad <= 0) {
        return res.status(400).json({ message: `La cantidad para ${productoDb.nombre} debe ser mayor a 0` });
      }
      if (item.precioUnitario < 0) {
        return res.status(400).json({ message: `El precio para ${productoDb.nombre} no puede ser negativo` });
      }
      if (productoDb.stock < item.cantidad) {
        return res.status(400).json({ message: `Stock insuficiente para ${productoDb.nombre}` });
      }
      
      // Agregamos el costoHistorico al item
      productosConCosto.push({
        ...item,
        costoHistorico: productoDb.precioCompra || 0
      });
    }

    // Calcular subtotal real de productos (suma de ítems sin descuento de envío)
    const totalCarritoCalculado = productosConCosto.reduce((sum, item) => sum + item.subtotal, 0);

    // 2. Crear la venta
    const nuevaVenta = new Venta({
      cliente: cliente || null,
      productos: productosConCosto,
      subtotalProductos: subtotalProductos || totalCarritoCalculado,
      descuento: descuento || { tipo: 'ninguno', valor: 0, montoAplicado: 0 },
      total,
      metodoPago,
      cuentaDestino,
      fecha: fechaVenta
    });

    const ventaGuardada = await nuevaVenta.save();

    // 3. Reducir el stock de los productos
    for (let item of productos) {
      await Producto.findByIdAndUpdate(item.producto, {
        $inc: { stock: -item.cantidad }
      });

      // Registro en historial de inventario
      const movInventario = new Inventario({
        producto: item.producto,
        tipoMovimiento: 'Salida',
        cantidad: item.cantidad,
        motivo: `Venta #${ventaGuardada._id.toString().slice(-6).toUpperCase()}`,
        fecha: fechaVenta
      });
      await movInventario.save();
    }

    // 4. Registrar en Finanzas el ingreso
    const nuevoIngreso = new Finanzas({
      tipoTransaccion: 'Ingreso',
      monto: total,
      cuenta: cuentaDestino || 'Caja Tienda',
      categoria: 'Venta',
      descripcion: `Venta registrada por ${metodoPago}`,
      referenciaId: ventaGuardada._id,
      referenciaModelo: 'Venta',
      metodoPago: metodoPago,
      fecha: fechaVenta
    });
    await nuevoIngreso.save();

    // 5. Registrar Logistica si aplica
    if (logistica) {
      const nuevaLogistica = new Logistica({
        venta: ventaGuardada._id,
        tipoEnvio: logistica.tipoEnvio || 'Envio a Domicilio',
        direccionEntrega: logistica.direccionEntrega || '',
        puntoEntrega: logistica.puntoEntrega || '',
        costoEnvio: logistica.costoEnvio || 0,
        estadoEntrega: 'Pendiente'
      });
      await nuevaLogistica.save();
    }

    res.status(201).json(ventaGuardada);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const anularVenta = async (req, res) => {
  try {
    const { id } = req.params;
    const venta = await Venta.findById(id);
    
    if (!venta) return res.status(404).json({ message: 'Venta no encontrada' });
    if (venta.estado === 'Anulada') return res.status(400).json({ message: 'La venta ya está anulada' });

    // 1. Devolver stock
    for (let item of venta.productos) {
      await Producto.findByIdAndUpdate(item.producto, {
        $inc: { stock: item.cantidad }
      });

      // Registro en historial de inventario (Re-entrada)
      const movInventario = new Inventario({
        producto: item.producto,
        tipoMovimiento: 'Entrada',
        cantidad: item.cantidad,
        motivo: `Anulación de Venta #${venta._id.toString().slice(-6).toUpperCase()}`
      });
      await movInventario.save();
    }

    // 2. Revertir Finanzas (Devolver el dinero al cliente como Egreso)
    const devolucionFinanzas = new Finanzas({
      tipoTransaccion: 'Egreso',
      monto: venta.total,
      cuenta: venta.cuentaDestino || 'Caja Tienda',
      categoria: 'Devolución',
      descripcion: `Anulación de venta: ${venta._id}`,
      referenciaId: venta._id,
      referenciaModelo: 'Venta'
    });
    await devolucionFinanzas.save();

    // 3. Cancelar envío logístico si existía
    await Logistica.findOneAndUpdate(
      { venta: venta._id },
      { estadoEntrega: 'Cancelado' }
    );

    venta.estado = 'Anulada';
    await venta.save();

    res.status(200).json(venta);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const devolverProductoVenta = async (req, res) => {
  try {
    const { id } = req.params;
    const { productoId, cantidadADevolver } = req.body;

    if (!cantidadADevolver || cantidadADevolver <= 0) {
      return res.status(400).json({ message: 'La cantidad a devolver debe ser mayor a 0' });
    }

    const venta = await Venta.findById(id);
    if (!venta) return res.status(404).json({ message: 'Venta no encontrada' });
    if (venta.estado === 'Anulada') return res.status(400).json({ message: 'La venta ya está anulada' });

    // Encontrar el producto en la venta
    const itemIndex = venta.productos.findIndex(p => p.producto.toString() === productoId);
    if (itemIndex === -1) return res.status(404).json({ message: 'Producto no encontrado en esta venta' });

    const item = venta.productos[itemIndex];
    const cantidadDisponible = item.cantidad - (item.cantidadDevuelta || 0);

    if (cantidadADevolver > cantidadDisponible) {
      return res.status(400).json({ message: `No puedes devolver más de ${cantidadDisponible} unidades de este producto` });
    }

    // 1. Actualizar el ítem en la venta
    item.cantidadDevuelta = (item.cantidadDevuelta || 0) + cantidadADevolver;
    item.cantidad -= cantidadADevolver;
    
    const montoADevolver = item.precioUnitario * cantidadADevolver;
    item.subtotal -= montoADevolver;

    // Actualizar totales de la venta
    venta.subtotalProductos -= montoADevolver;
    venta.total -= montoADevolver;

    await venta.save();

    // 2. Devolver stock
    await Producto.findByIdAndUpdate(productoId, {
      $inc: { stock: cantidadADevolver }
    });

    // 3. Registro en historial de inventario (Re-entrada por devolución parcial)
    const movInventario = new Inventario({
      producto: productoId,
      tipoMovimiento: 'Entrada',
      cantidad: cantidadADevolver,
      motivo: `Devolución Parcial de Venta #${venta._id.toString().slice(-6).toUpperCase()}`
    });
    await movInventario.save();

    // 4. Revertir Finanzas (Devolver el dinero al cliente como Egreso)
    const devolucionFinanzas = new Finanzas({
      tipoTransaccion: 'Egreso',
      monto: montoADevolver,
      cuenta: venta.cuentaDestino || 'Caja Tienda',
      categoria: 'Devolución',
      descripcion: `Devolución parcial de venta: ${venta._id}`,
      referenciaId: venta._id,
      referenciaModelo: 'Venta'
    });
    await devolucionFinanzas.save();

    res.status(200).json(venta);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const actualizarFechaVenta = async (req, res) => {
  try {
    const { id } = req.params;
    const { fecha } = req.body;

    if (!fecha) {
      return res.status(400).json({ message: 'La fecha es obligatoria' });
    }

    const nuevaFecha = new Date(fecha);
    if (isNaN(nuevaFecha.getTime())) {
      return res.status(400).json({ message: 'Formato de fecha inválido' });
    }

    const venta = await Venta.findByIdAndUpdate(
      id,
      { fecha: nuevaFecha },
      { new: true }
    ).populate('cliente').populate('productos.producto');

    if (!venta) {
      return res.status(404).json({ message: 'Venta no encontrada' });
    }

    // Sincronizar fecha en Finanzas
    await Finanzas.updateMany(
      { referenciaId: id, referenciaModelo: 'Venta' },
      { fecha: nuevaFecha }
    );

    // Sincronizar fecha en Inventario
    const ventaCodigo = id.toString().slice(-6).toUpperCase();
    await Inventario.updateMany(
      { motivo: new RegExp(`Venta #${ventaCodigo}`, 'i') },
      { fecha: nuevaFecha }
    );

    res.status(200).json(venta);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
