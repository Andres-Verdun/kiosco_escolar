/* Mejoras Kiosco Escolar 360
   Rama: mejora-transferencias-fiados
   - Medio de pago en recaudaciones y pagos de fiados
   - Fiados agrupados por persona
   - Historial por persona
   - Totales de efectivo y transferencia
   Compatible con la estructura actual de Supabase.
*/

(() => {
  const css = `
    .kpi.efectivo{border-left-color:#4B8A64}
    .kpi.transferencia{border-left-color:#376FA6}
    .chip.medio{background:#E9EEF4;color:#456}
    .chip.medio.transferencia{background:#E4EEF8;color:#265B8C}
    .fiado-grupo{display:block!important;padding:12px 4px!important}
    .fiado-cabecera{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}
    .acciones-fiado{display:flex;gap:6px;flex-wrap:wrap}
    .fiado-detalle{margin-top:9px;border-top:1px dashed var(--borde);padding-top:8px}
    .fiado-detalle summary{cursor:pointer;color:var(--pizarron);font-weight:800;font-size:.85rem}
    .historial-fiado{margin-top:8px}
    .mov-fiado{display:grid;grid-template-columns:105px 1fr auto;gap:8px;align-items:center;padding:8px 2px;border-bottom:1px solid #edf0ee;font-size:.82rem}
    .mov-fiado:last-child{border-bottom:none}
    .mov-fiado .fecha-mov{color:var(--gris);font-size:.72rem}
    .mov-fiado .importe{font-weight:800}
    .mov-fiado .importe.cargo{color:#8A6414}
    .mov-fiado .importe.pago{color:var(--verde-ok)}
    dialog#dialogCobroMejora{border:none;border-radius:14px;padding:0;width:min(92vw,430px);box-shadow:0 20px 70px rgba(0,0,0,.35);color:var(--tinta)}
    dialog#dialogCobroMejora::backdrop{background:rgba(10,25,20,.55)}
    .dialog-mejora{padding:20px}.dialog-mejora h2{font-family:'Patrick Hand',cursive;color:var(--pizarron);font-size:1.55rem;margin-bottom:5px}
    .dialog-mejora .saldo-dialog{font-weight:800;margin-bottom:14px;color:#8A6414}.dialog-mejora form{display:flex;flex-direction:column}
    .dialog-acciones{display:flex;gap:8px;justify-content:flex-end;margin-top:6px}
    @media(max-width:640px){.fiado-cabecera{align-items:flex-start}.acciones-fiado{width:100%}.acciones-fiado .btn{flex:1}.mov-fiado{grid-template-columns:90px 1fr auto}}
  `;
  const st = document.createElement('style');
  st.textContent = css;
  document.head.appendChild(st);

  function normalizarNombre(s){
    return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,' ').toLowerCase();
  }
  function medio(x){ return x && x.medioPago === 'transferencia' ? 'transferencia' : 'efectivo'; }
  function etiquetaMedio(x){ return medio(x) === 'transferencia' ? '🏦 Transferencia' : '💵 Efectivo'; }
  function saldo(f){
    const pagado = (f.pagos || []).reduce((a,p)=>a + Number(p.monto || 0), 0);
    return Math.max(Number(f.monto || 0) - pagado, 0);
  }
  function esc(s){
    const d = document.createElement('div'); d.textContent = String(s ?? ''); return d.innerHTML;
  }
  function agrupar(){
    const mapa = new Map();
    (datos.fiados || []).forEach(f=>{
      if (!Array.isArray(f.pagos)) f.pagos = [];
      const clave = normalizarNombre(f.nombre);
      if (!clave) return;
      const ultimoPago = Math.max(0, ...(f.pagos || []).map(p=>Number(p.fecha || 0)));
      const ultima = Math.max(Number(f.fecha || 0), ultimoPago);
      if (!mapa.has(clave)) mapa.set(clave,{clave,nombre:f.nombre,registros:[],saldo:0,ultimaFecha:ultima});
      const g = mapa.get(clave);
      g.registros.push(f); g.saldo += saldo(f);
      if (ultima >= g.ultimaFecha){ g.ultimaFecha = ultima; g.nombre = f.nombre; }
    });
    return [...mapa.values()];
  }
  function grupoPorClave(clave){ return agrupar().find(g=>g.clave===clave); }

  // Agregar selector de medio de pago a Recaudación.
  const formRec = document.getElementById('formRecaudacion');
  if (formRec && !document.getElementById('medioPagoRecaudacion')){
    const sel = document.createElement('select');
    sel.id = 'medioPagoRecaudacion';
    sel.required = true;
    sel.innerHTML = '<option value="efectivo">💵 Efectivo</option><option value="transferencia">🏦 Transferencia</option>';
    const nota = document.getElementById('notaRecaudacion');
    formRec.insertBefore(sel, nota);

    // Captura antes del listener original para guardar medioPago.
    formRec.addEventListener('submit', async e=>{
      e.preventDefault(); e.stopImmediatePropagation();
      const monto = parseFloat(document.getElementById('montoRecaudacion').value);
      const notaTxt = document.getElementById('notaRecaudacion').value.trim();
      const medioPago = sel.value;
      if (!(monto > 0)) return;
      datos.recaudaciones.push({id:uid(),monto,nota:notaTxt,medioPago,fecha:Date.now()});
      formRec.reset();
      await guardar(); render(); mostrarToast('Recaudación guardada ✔');
    }, true);
  }

  // Datalist para reutilizar nombres existentes.
  const nombreFiado = document.getElementById('nombreFiado');
  if (nombreFiado && !document.getElementById('nombresFiados')){
    const dl = document.createElement('datalist');
    dl.id = 'nombresFiados';
    nombreFiado.setAttribute('list','nombresFiados');
    nombreFiado.after(dl);
  }

  // Capturar nuevo fiado: conserva la escritura del nombre ya existente.
  const formFiado = document.getElementById('formFiado');
  if (formFiado){
    formFiado.addEventListener('submit', async e=>{
      e.preventDefault(); e.stopImmediatePropagation();
      const entrada = nombreFiado.value.trim();
      const monto = parseFloat(document.getElementById('montoFiado').value);
      if (!entrada || !(monto > 0)) return;
      const clave = normalizarNombre(entrada);
      const existente = grupoPorClave(clave);
      const nombre = existente ? existente.nombre : entrada;
      datos.fiados.push({id:uid(),nombre,monto,pagos:[],fecha:Date.now()});
      formFiado.reset();
      await guardar(); render(); mostrarToast(existente ? 'Nuevo fiado agregado a '+nombre+' ✔' : 'Fiado anotado ✔');
    }, true);
  }

  // Modal propio para cobrar una deuda agrupada.
  const dialog = document.createElement('dialog');
  dialog.id = 'dialogCobroMejora';
  dialog.innerHTML = `
    <div class="dialog-mejora">
      <h2 id="tituloCobroMejora">Cobrar fiado</h2>
      <div class="saldo-dialog" id="saldoCobroMejora"></div>
      <form id="formCobroMejora">
        <input type="hidden" id="claveCobroMejora">
        <input type="number" id="montoCobroMejora" min="0.01" step="0.01" inputmode="decimal" placeholder="Monto que paga" required>
        <select id="medioPagoCobroMejora"><option value="efectivo">💵 Efectivo</option><option value="transferencia">🏦 Transferencia</option></select>
        <div class="dialog-acciones"><button type="button" class="btn btn-sec" id="cancelarCobroMejora">Cancelar</button><button type="submit" class="btn">Registrar pago</button></div>
      </form>
    </div>`;
  document.body.appendChild(dialog);
  document.getElementById('cancelarCobroMejora').onclick = ()=>dialog.close();

  window.abrirCobroAgrupado = function(claveCod){
    const clave = decodeURIComponent(claveCod);
    const g = grupoPorClave(clave);
    if (!g || !(g.saldo > 0)) return;
    document.getElementById('claveCobroMejora').value = clave;
    document.getElementById('tituloCobroMejora').textContent = 'Cobrar a ' + g.nombre;
    document.getElementById('saldoCobroMejora').textContent = 'Deuda total: ' + fmt(g.saldo);
    const inp = document.getElementById('montoCobroMejora');
    inp.value = g.saldo; inp.max = g.saldo;
    document.getElementById('medioPagoCobroMejora').value = 'efectivo';
    dialog.showModal();
  };
  window.prepararNuevoFiadoAgrupado = function(claveCod){
    const g = grupoPorClave(decodeURIComponent(claveCod));
    if (!g) return;
    nombreFiado.value = g.nombre;
    document.getElementById('montoFiado').focus();
    formFiado.scrollIntoView({behavior:'smooth',block:'center'});
  };

  document.getElementById('formCobroMejora').addEventListener('submit', async e=>{
    e.preventDefault();
    const clave = document.getElementById('claveCobroMejora').value;
    const g = grupoPorClave(clave);
    if (!g) return dialog.close();
    let monto = parseFloat(String(document.getElementById('montoCobroMejora').value).replace(',','.'));
    if (!(monto > 0)) return mostrarToast('Monto inválido');
    monto = Math.min(monto, g.saldo);
    const medioPago = document.getElementById('medioPagoCobroMejora').value;
    const ahora = Date.now();
    let restante = monto;
    const regs = [...g.registros].filter(f=>saldo(f)>0).sort((a,b)=>a.fecha-b.fecha);
    for (const f of regs){
      if (restante <= 0) break;
      const aplica = Math.min(saldo(f), restante);
      f.pagos = f.pagos || [];
      f.pagos.push({monto:aplica,fecha:ahora,medioPago});
      restante -= aplica;
    }
    await guardar(); dialog.close(); render();
    const nuevo = grupoPorClave(clave);
    mostrarToast(nuevo && nuevo.saldo === 0 ? 'Fiado saldado ✔' : 'Pago parcial registrado ✔');
  });

  // Reemplazos visuales manteniendo los datos originales.
  const renderOriginal = render;
  render = function(){
    renderOriginal();
    const t = (()=>{
      let efectivo=0, transferencia=0;
      (datos.recaudaciones||[]).forEach(r=>{ medio(r)==='transferencia' ? transferencia+=Number(r.monto||0) : efectivo+=Number(r.monto||0); });
      (datos.fiados||[]).forEach(f=>(f.pagos||[]).forEach(p=>{ medio(p)==='transferencia' ? transferencia+=Number(p.monto||0) : efectivo+=Number(p.monto||0); }));
      return {efectivo,transferencia};
    })();

    const kpis = document.querySelector('#resumen .kpis');
    if (kpis){
      let ke = document.getElementById('kpiEfectivo');
      if (!ke){
        const a=document.createElement('div');a.className='kpi efectivo';a.innerHTML='<div class="etiqueta">💵 Ingresos efectivo</div><div class="valor" id="kpiEfectivo">$0</div>';
        const b=document.createElement('div');b.className='kpi transferencia';b.innerHTML='<div class="etiqueta">🏦 Transferencias</div><div class="valor" id="kpiTransferencia">$0</div>';
        kpis.insertBefore(b,kpis.children[1]||null);kpis.insertBefore(a,b);ke=document.getElementById('kpiEfectivo');
      }
      ke.textContent=fmt(t.efectivo);document.getElementById('kpiTransferencia').textContent=fmt(t.transferencia);
    }

    // Historial de recaudación con medio de pago.
    const ulR=document.getElementById('listaRecaudacion');
    if (ulR && (datos.recaudaciones||[]).length){
      ulR.innerHTML=[...datos.recaudaciones].sort((a,b)=>b.fecha-a.fecha).map(r=>`<li><div class="dato"><div class="nombre">${r.nota?esc(r.nota):'Recaudación del día'}</div><div class="fecha">${fechaLegible(r.fecha)} · <span class="chip medio ${medio(r)==='transferencia'?'transferencia':''}">${etiquetaMedio(r)}</span></div></div><span class="monto verde">${fmt(r.monto)}</span><button class="btn btn-peligro" onclick="borrar('recaudaciones','${r.id}')">Borrar</button></li>`).join('');
    }

    // Actualizar sugerencias de nombres.
    const dl=document.getElementById('nombresFiados');
    if(dl) dl.innerHTML=agrupar().sort((a,b)=>a.nombre.localeCompare(b.nombre,'es')).map(g=>`<option value="${esc(g.nombre)}"></option>`).join('');

    function historial(g){
      const mov=[];
      g.registros.forEach(f=>{
        mov.push({tipo:'fiado',fecha:Number(f.fecha||0),monto:Number(f.monto||0),id:f.id});
        (f.pagos||[]).forEach(p=>mov.push({tipo:'pago',fecha:Number(p.fecha||0),monto:Number(p.monto||0),medio:medio(p)}));
      });
      return mov.sort((a,b)=>b.fecha-a.fecha).map(m=>m.tipo==='fiado'
        ? `<div class="mov-fiado"><div class="fecha-mov">${fechaLegible(m.fecha)}</div><div>📒 Fiado <button class="btn btn-peligro" style="padding:1px 5px" onclick="borrar('fiados','${m.id}')">Borrar</button></div><div class="importe cargo">+${fmt(m.monto)}</div></div>`
        : `<div class="mov-fiado"><div class="fecha-mov">${fechaLegible(m.fecha)}</div><div>✅ Pago · ${m.medio==='transferencia'?'🏦 Transferencia':'💵 Efectivo'}</div><div class="importe pago">−${fmt(m.monto)}</div></div>`).join('');
    }
    function tarjetaGrupo(g,pagado){
      const c=encodeURIComponent(g.clave), cant=g.registros.length;
      return `<li class="fiado-grupo"><div class="fiado-cabecera"><div class="dato"><div class="nombre">${esc(g.nombre)} ${pagado?'<span class="chip pagado">Sin deuda</span>':'<span class="chip">Debe '+fmt(g.saldo)+'</span>'}</div><div class="fecha">${cant} ${cant===1?'fiado':'fiados'} registrados · Último movimiento ${fechaCorta(g.ultimaFecha)}</div></div><div class="acciones-fiado"><button class="btn btn-sec btn-mini" onclick="prepararNuevoFiadoAgrupado('${c}')">+ Fiado</button>${!pagado?`<button class="btn btn-mini" onclick="abrirCobroAgrupado('${c}')">Cobrar</button>`:''}</div></div><details class="fiado-detalle"><summary>Ver detalle e historial</summary><div class="historial-fiado">${historial(g)}</div></details></li>`;
    }
    const grupos=agrupar();
    const p=grupos.filter(g=>g.saldo>0).sort((a,b)=>b.ultimaFecha-a.ultimaFecha);
    const ok=grupos.filter(g=>g.saldo===0).sort((a,b)=>b.ultimaFecha-a.ultimaFecha);
    const ulP=document.getElementById('listaFiadosPendientes'), ulOk=document.getElementById('listaFiadosPagados');
    if(ulP) ulP.innerHTML=p.length?p.map(g=>tarjetaGrupo(g,false)).join(''):itemVacio('No hay fiados pendientes. 🎉');
    if(ulOk) ulOk.innerHTML=ok.length?ok.map(g=>tarjetaGrupo(g,true)).join(''):itemVacio('Todavía no hay personas con fiados saldados.');
  };

  // Refrescar una vez para aplicar la nueva vista si ya hay datos cargados.
  setTimeout(()=>{ try{ render(); }catch(e){ console.error('Mejora kiosco:',e); } }, 300);
})();
