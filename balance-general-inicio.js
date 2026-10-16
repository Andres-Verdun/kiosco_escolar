/* Balance general de ambas cajas (solo importes efectivamente cobrados).
   No altera los registros: consulta kiosco_datos y muestra un resumen. */
(() => {
  const pantalla = document.getElementById('pantallaTurno');
  const botones = pantalla?.querySelector('.botones-turno');
  if (!pantalla || !botones) return;

  const estilos = document.createElement('style');
  estilos.textContent = `
    .balance-general-inicio{width:100%;max-width:500px;background:#fff;color:#22302B;border-radius:14px;padding:18px 20px;text-align:center;box-shadow:0 4px 12px rgba(0,0,0,.22);border-bottom:5px solid #2E7D5B}
    .balance-general-inicio h2{font-size:1rem;font-weight:800;margin:0 0 5px}
    .balance-general-inicio .importe-general{font-size:2rem;font-weight:800;color:#2E7D5B;line-height:1.3}
    .balance-general-inicio .detalle-general{font-size:.83rem;color:#65736B;margin:8px 0 0;opacity:1}
    .balance-general-inicio .error-general{font-size:.85rem;color:#A53227;margin-top:8px;opacity:1}
    @media(max-width:640px){.balance-general-inicio{padding:14px}.balance-general-inicio .importe-general{font-size:1.7rem}}
  `;
  document.head.appendChild(estilos);
  const tarjeta = document.createElement('div');
  tarjeta.className = 'balance-general-inicio';
  tarjeta.setAttribute('role','status');
  tarjeta.setAttribute('aria-live','polite');
  tarjeta.innerHTML = '<h2>💰 Dinero disponible entre ambos turnos</h2><div class="importe-general" id="balanceGeneralMonto">Consultando...</div><p class="detalle-general" id="balanceGeneralDetalle">Ventas cobradas + pagos de fiados − pedidos pagados</p><p class="error-general" id="balanceGeneralError" style="display:none"></p>';
  botones.insertAdjacentElement('afterend', tarjeta);

  const suma = (lista) => (Array.isArray(lista) ? lista : []).reduce((total, item) => total + (Number(item?.monto) || 0), 0);
  function calcularCaja(caja){
    const recaudaciones = Array.isArray(caja?.recaudaciones) ? caja.recaudaciones : [];
    const fiados = Array.isArray(caja?.fiados) ? caja.fiados : [];
    const pedidos = Array.isArray(caja?.pedidos) ? caja.pedidos : [];
    const cobros = fiados.flatMap(f => Array.isArray(f.pagos) ? f.pagos : []);
    return {ingresos:suma(recaudaciones)+suma(cobros), gastos:suma(pedidos)};
  }
  let solicitud = 0;
  async function actualizarBalanceGeneral(){
    if (pantalla.classList.contains('oculta') || !sesionEmail) return;
    const numero = ++solicitud;
    const monto = document.getElementById('balanceGeneralMonto');
    const detalle = document.getElementById('balanceGeneralDetalle');
    const errorEl = document.getElementById('balanceGeneralError');
    monto.textContent = 'Consultando...';
    errorEl.style.display = 'none';
    try {
      let cajas;
      if (memoriaSolo || !configurada()){
        cajas = [datosPorTurno.manana || (turno === 'manana' ? datos : null), datosPorTurno.tarde || (turno === 'tarde' ? datos : null)];
      } else {
        const respuesta = await sb.from('kiosco_datos').select('id,datos').in('id',['manana','tarde']);
        if (respuesta.error) throw respuesta.error;
        cajas = ['manana','tarde'].map(id => respuesta.data?.find(f=>f.id===id)?.datos || null);
      }
      if (numero !== solicitud || pantalla.classList.contains('oculta')) return;
      const total = cajas.map(calcularCaja).reduce((a,c)=>({ingresos:a.ingresos+c.ingresos,gastos:a.gastos+c.gastos}),{ingresos:0,gastos:0});
      monto.textContent = fmt(total.ingresos-total.gastos);
      monto.style.color = total.ingresos-total.gastos < 0 ? '#C24B3A' : '#2E7D5B';
      detalle.textContent = 'Cobrado: '+fmt(total.ingresos)+' · Gastos: '+fmt(total.gastos)+' · Sin fiados pendientes';
    } catch (e) {
      if (numero !== solicitud) return;
      monto.textContent = 'No disponible';
      detalle.textContent = 'No fue posible consultar el total de ambas cajas.';
      errorEl.textContent = 'Revisá tu conexión o los permisos de lectura en Supabase.';
      errorEl.style.display = 'block';
      console.error('Balance general:',e);
    }
  }

  const observador = new MutationObserver(()=>{
    if (!pantalla.classList.contains('oculta')) actualizarBalanceGeneral();
    else solicitud++;
  });
  observador.observe(pantalla,{attributes:true,attributeFilter:['class']});
  // También se actualiza si otro usuario registra movimientos mientras está abierto.
  setInterval(()=>{ if (!pantalla.classList.contains('oculta')) actualizarBalanceGeneral(); },30000);
  if (!pantalla.classList.contains('oculta')) actualizarBalanceGeneral();
})();
