import { db } from "./firebase-config.js";
import {
  doc,
  setDoc,
  getDoc,
  collection,
  addDoc,
  onSnapshot,
  serverTimestamp,
  runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// =========================
// ELEMENTOS DOM
// =========================
const mesas = document.querySelectorAll(".mesa");
const tituloMesa = document.getElementById("tituloMesa");
const listaPedido = document.getElementById("listaPedido");
const totalPedido = document.getElementById("totalPedido");
const btnCobrar = document.getElementById("btnCobrar");
const btnLimpiar = document.getElementById("btnLimpiar");
const btnEnviarCocina = document.getElementById("btnEnviarCocina");
const btnReabrirPedido = document.getElementById("btnReabrirPedido");
const estadoPedido = document.getElementById("estadoPedido");

const cocinaActiva = document.getElementById("cocinaActiva");
const cocinaLista = document.getElementById("cocinaLista");

const cajaMesa = document.getElementById("cajaMesa");
const cajaTotal = document.getElementById("cajaTotal");
const btnMetodos = document.querySelectorAll(".btn-metodo");
const btnConfirmarPago = document.getElementById("btnConfirmarPago");

const ticketNumero = document.getElementById("ticketNumero");
const ticketFecha = document.getElementById("ticketFecha");
const ticketMesa = document.getElementById("ticketMesa");
const ticketMetodo = document.getElementById("ticketMetodo");
const ticketItems = document.getElementById("ticketItems");
const ticketTotal = document.getElementById("ticketTotal");

const dashboardTotalHoy = document.getElementById("dashboardTotalHoy");
const dashboardCantidadVentas = document.getElementById("dashboardCantidadVentas");
const dashboardListaVentas = document.getElementById("dashboardListaVentas");

// producto manual
const manualNombre = document.getElementById("manualNombre");
const manualPrecio = document.getElementById("manualPrecio");
const manualComentario = document.getElementById("manualComentario");
const btnAgregarManual = document.getElementById("btnAgregarManual");

// =========================
// ESTADO GLOBAL
// =========================
let pedido = [];
let total = 0;
let estado = "libre";
let metodoPago = "";

// =========================
// HELPERS
// =========================
function getMesaFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get("mesa") || "";
}

function getVentaFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get("venta") || "";
}

function hoyISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function calcularTotal(lista = []) {
  return lista.reduce((acc, item) => acc + Number(item.precio || 0), 0);
}

function textoEstado(v) {
  if (v === "enviado") return "En cocina";
  if (v === "listo") return "Listo";
  if (v === "editando") return "Editando";
  return "Libre";
}

function textoEstadoItem(v) {
  if (v === "pendiente") return "Pendiente";
  if (v === "enviado") return "En cocina";
  if (v === "listo") return "Listo";
  return "Pendiente";
}

function formatearQ(n) {
  return `Q${Number(n || 0)}`;
}

function formatearPrecioVisual(n) {
  return Number(n || 0) === 0 ? "Incluido" : formatearQ(n);
}

function normalizarItem(item = {}, estadoMesa = "libre") {
  let estadoItem = item.estadoItem;

  if (!estadoItem) {
    if (estadoMesa === "listo") estadoItem = "listo";
    else if (estadoMesa === "enviado") estadoItem = "enviado";
    else estadoItem = "pendiente";
  }

  if (!["pendiente", "enviado", "listo"].includes(estadoItem)) {
    estadoItem = "pendiente";
  }

  return {
    nombre: item.nombre || "",
    precio: Number(item.precio || 0),
    comentario: item.comentario || "",
    estadoItem
  };
}

function normalizarPedido(lista = [], estadoMesa = "libre") {
  return (Array.isArray(lista) ? lista : []).map((item) => normalizarItem(item, estadoMesa));
}

function hayItemsConEstado(lista = [], estadoBuscado = "") {
  return lista.some((item) => item.estadoItem === estadoBuscado);
}

function calcularEstadoMesa(lista = []) {
  if (!Array.isArray(lista) || lista.length === 0) return "libre";
  if (hayItemsConEstado(lista, "enviado")) return "enviado";
  if (hayItemsConEstado(lista, "pendiente")) return "editando";
  if (hayItemsConEstado(lista, "listo")) return "listo";
  return "libre";
}

function mesaClase(data) {
  const pedidoMesa = normalizarPedido(data?.pedido, data?.estado || "libre");
  const estadoMesa = calcularEstadoMesa(pedidoMesa);

  if (pedidoMesa.length === 0) return "libre";
  if (estadoMesa === "listo") return "lista";
  if (estadoMesa === "enviado") return "enviada";
  return "ocupada";
}

function esEditable() {
  return estado === "editando" || estado === "libre" || estado === "listo" || estado === "enviado";
}

function setBotonesMetodoVisual() {
  btnMetodos.forEach((b) => {
    b.style.outline = "none";
    b.style.opacity = "0.7";
  });

  const activo = [...btnMetodos].find((b) => b.dataset.metodo === metodoPago);
  if (activo) {
    activo.style.opacity = "1";
    activo.style.outline = "3px solid white";
  }
}

function limpiarFormularioManual() {
  if (manualNombre) manualNombre.value = "";
  if (manualPrecio) manualPrecio.value = "";
  if (manualComentario) manualComentario.value = "";
}

// =========================
// FIREBASE
// =========================
async function crearMesaSiNoExiste(nombreMesa) {
  if (!nombreMesa) return;

  const ref = doc(db, "mesas", nombreMesa);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await setDoc(ref, {
      nombre: nombreMesa,
      pedido: [],
      total: 0,
      estado: "libre",
      updatedAt: serverTimestamp()
    });
  }
}

async function asegurarMesasBase() {
  if (!mesas.length) return;

  for (const mesa of mesas) {
    const nombreMesa = mesa.querySelector(".mesa-nombre")?.textContent?.trim();
    if (!nombreMesa) continue;
    await crearMesaSiNoExiste(nombreMesa);
  }
}

async function guardarMesa(mesaNombre) {
  if (!mesaNombre) return;

  pedido = normalizarPedido(pedido, estado);
  total = calcularTotal(pedido);
  const estadoFinal = calcularEstadoMesa(pedido);

  await setDoc(
    doc(db, "mesas", mesaNombre),
    {
      nombre: mesaNombre,
      pedido,
      total,
      estado: estadoFinal,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );

  estado = estadoFinal;
}

async function limpiarMesaTotal(mesaNombre) {
  await setDoc(
    doc(db, "mesas", mesaNombre),
    {
      nombre: mesaNombre,
      pedido: [],
      total: 0,
      estado: "libre",
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
}

async function obtenerSiguienteTicket() {
  const ref = doc(db, "config", "correlativos");

  return await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);

    if (!snap.exists()) {
      transaction.set(ref, {
        ticket: 2,
        updatedAt: serverTimestamp()
      });
      return 1;
    }

    const actual = Number(snap.data().ticket || 1);
    transaction.update(ref, {
      ticket: actual + 1,
      updatedAt: serverTimestamp()
    });
    return actual;
  });
}

async function generarVenta(mesaNombre) {
  const numeroTicket = await obtenerSiguienteTicket();

  pedido = normalizarPedido(pedido, estado);
  total = calcularTotal(pedido);

  const ahora = new Date();
  const venta = {
    numeroTicket,
    mesa: mesaNombre,
    total: Number(total || 0),
    metodoPago,
    items: pedido,
    fechaTexto: ahora.toLocaleString("es-GT"),
    fechaISO: hoyISO(),
    createdAt: serverTimestamp()
  };

  const ventaRef = await addDoc(collection(db, "ventas"), venta);
  await limpiarMesaTotal(mesaNombre);

  return ventaRef.id;
}

// =========================
// RENDER MESAS
// =========================
function renderizarMesasConDatos(datosMesas) {
  if (!mesas.length) return;

  mesas.forEach((mesa) => {
    const nombreMesa = mesa.querySelector(".mesa-nombre")?.textContent?.trim();
    const totalMesa = mesa.querySelector(".mesa-total");
    const estadoMesa = mesa.querySelector(".mesa-estado");

    const datos = datosMesas[nombreMesa] || {
      nombre: nombreMesa,
      pedido: [],
      total: 0,
      estado: "libre"
    };

    const pedidoMesa = normalizarPedido(datos.pedido, datos.estado || "libre");
    const estadoMesaReal = calcularEstadoMesa(pedidoMesa);
    const totalMesaReal = calcularTotal(pedidoMesa);

    mesa.classList.remove("libre", "ocupada", "enviada", "lista");
    mesa.classList.add(
      mesaClase({ ...datos, pedido: pedidoMesa, total: totalMesaReal, estado: estadoMesaReal })
    );

    if (totalMesa) {
      totalMesa.textContent = `Total: ${formatearQ(totalMesaReal)}`;
    }

    if (estadoMesa) {
      estadoMesa.textContent = `Estado: ${textoEstado(estadoMesaReal)}`;
    }

    mesa.onclick = () => {
      window.location.href = `pedido.html?mesa=${encodeURIComponent(nombreMesa)}`;
    };
  });
}

function escucharMesas() {
  onSnapshot(collection(db, "mesas"), (snapshot) => {
    const datosMesas = {};

    snapshot.forEach((docSnap) => {
      datosMesas[docSnap.id] = docSnap.data();
    });

    renderizarMesasConDatos(datosMesas);
  });
}

// =========================
// RENDER PEDIDO
// =========================
function actualizarEstadoVisual() {
  if (estadoPedido) {
    let mostrado = estado;
    if (pedido.length === 0 && estado === "libre") mostrado = "editando";
    estadoPedido.textContent = `Estado: ${textoEstado(mostrado)}`;
  }

  if (manualNombre) manualNombre.disabled = false;
  if (manualPrecio) manualPrecio.disabled = false;
  if (manualComentario) manualComentario.disabled = false;
  if (btnAgregarManual) btnAgregarManual.disabled = false;

  if (btnLimpiar) btnLimpiar.disabled = pedido.length === 0;

  if (btnEnviarCocina) {
    const hayPendientes = pedido.some((item) => item.estadoItem === "pendiente");
    btnEnviarCocina.disabled = !hayPendientes;
  }

  if (btnReabrirPedido) {
    btnReabrirPedido.style.display =
      estado === "enviado" || estado === "listo" ? "inline-block" : "none";
  }
}

function renderizarPedidoHTML() {
  if (!listaPedido || !totalPedido) return;

  listaPedido.innerHTML = "";

  if (pedido.length === 0) {
    const vacio = document.createElement("li");
    vacio.textContent = "No hay productos agregados.";
    vacio.style.opacity = "0.8";
    listaPedido.appendChild(vacio);
  }

  pedido.forEach((item, index) => {
    const li = document.createElement("li");
    li.style.marginBottom = "12px";

    const nombre = document.createElement("div");
    nombre.style.fontWeight = "bold";
    nombre.textContent = `${item.nombre} — ${formatearPrecioVisual(item.precio)}`;
    li.appendChild(nombre);

    const estadoItem = document.createElement("div");
    estadoItem.style.fontSize = "13px";
    estadoItem.style.opacity = "0.75";
    estadoItem.textContent = `Estado: ${textoEstadoItem(item.estadoItem)}`;
    li.appendChild(estadoItem);

    if (item.comentario) {
      const comentario = document.createElement("div");
      comentario.style.fontSize = "14px";
      comentario.style.opacity = "0.7";
      comentario.textContent = `💬 ${item.comentario}`;
      li.appendChild(comentario);
    }

    const btnEliminar = document.createElement("button");
    btnEliminar.textContent = "❌";
    btnEliminar.style.marginTop = "5px";
    btnEliminar.style.background = "#b33232";
    btnEliminar.style.border = "none";
    btnEliminar.style.color = "white";
    btnEliminar.style.padding = "5px 10px";
    btnEliminar.style.borderRadius = "6px";
    btnEliminar.style.cursor = "pointer";

    btnEliminar.addEventListener("click", async () => {
      const mesaNombre = getMesaFromURL();
      if (!mesaNombre) return;

      const confirmar = confirm(`¿Eliminar ${item.nombre}?`);
      if (!confirmar) return;

      pedido.splice(index, 1);
      pedido = normalizarPedido(pedido, estado);
      estado = calcularEstadoMesa(pedido);

      await guardarMesa(mesaNombre);
    });

    li.appendChild(btnEliminar);
    listaPedido.appendChild(li);
  });

  total = calcularTotal(pedido);
  totalPedido.textContent = `Total: ${formatearQ(total)}`;
  actualizarEstadoVisual();
}

async function escucharMesaActual() {
  const mesaNombre = getMesaFromURL();
  if (!mesaNombre || !tituloMesa) return;

  await crearMesaSiNoExiste(mesaNombre);
  tituloMesa.textContent = `Pedido - ${mesaNombre}`;

  onSnapshot(doc(db, "mesas", mesaNombre), (snap) => {
    const datos = snap.data() || {
      nombre: mesaNombre,
      pedido: [],
      total: 0,
      estado: "libre"
    };

    pedido = normalizarPedido(datos.pedido, datos.estado || "libre");
    total = calcularTotal(pedido);
    estado = calcularEstadoMesa(pedido);

    renderizarPedidoHTML();
  });
}

// =========================
// COCINA
// =========================
function crearCardCocina(datos, tipo) {
  const mesaNombre = datos.nombre || datos.id || "Mesa";
  const pedidoMesa = normalizarPedido(datos.pedido, datos.estado || "libre");

  const itemsMostrar = pedidoMesa.filter((item) => {
    if (tipo === "enviado") return item.estadoItem === "enviado";
    if (tipo === "listo") return item.estadoItem === "listo";
    return false;
  });

  if (itemsMostrar.length === 0) return null;

  const totalMostrar = calcularTotal(itemsMostrar);

  const card = document.createElement("div");
  card.className = "card-cocina";

  const header = document.createElement("div");
  header.className = "card-cocina-header";

  const titulo = document.createElement("h3");
  titulo.textContent = mesaNombre;

  const estadoBox = document.createElement("span");
  estadoBox.className = `card-cocina-estado ${tipo}`;
  estadoBox.textContent = tipo === "enviado" ? "En cocina" : "Listo";

  header.appendChild(titulo);
  header.appendChild(estadoBox);
  card.appendChild(header);

  const items = document.createElement("div");
  items.className = "card-cocina-items";

  itemsMostrar.forEach((item) => {
    const itemBox = document.createElement("div");
    itemBox.className = "item-cocina";

    const nombre = document.createElement("div");
    nombre.className = "item-cocina-nombre";
    nombre.textContent = item.nombre;

    const precio = document.createElement("div");
    precio.className = "item-cocina-precio";
    precio.textContent = formatearPrecioVisual(item.precio);

    itemBox.appendChild(nombre);
    itemBox.appendChild(precio);

    if (item.comentario) {
      const comentario = document.createElement("div");
      comentario.className = "item-cocina-comentario";
      comentario.textContent = `💬 ${item.comentario}`;
      itemBox.appendChild(comentario);
    }

    items.appendChild(itemBox);
  });

  card.appendChild(items);

  const totalBox = document.createElement("div");
  totalBox.className = "card-cocina-total";
  totalBox.textContent = `Total: ${formatearQ(totalMostrar)}`;
  card.appendChild(totalBox);

  const acciones = document.createElement("div");
  acciones.className = "card-cocina-acciones";

  if (tipo === "enviado") {
    const btn = document.createElement("button");
    btn.className = "btn-cocina btn-cocina-listo";
    btn.textContent = "✅ Listo";
    btn.onclick = async () => {
      const ref = doc(db, "mesas", mesaNombre);
      const snap = await getDoc(ref);
      if (!snap.exists()) return;

      const datosMesa = snap.data() || {};
      const pedidoActual = normalizarPedido(datosMesa.pedido, datosMesa.estado || "libre");

      const pedidoActualizado = pedidoActual.map((item) => {
        if (item.estadoItem === "enviado") {
          return { ...item, estadoItem: "listo" };
        }
        return item;
      });

      const estadoActualizado = calcularEstadoMesa(pedidoActualizado);
      const totalActualizado = calcularTotal(pedidoActualizado);

      await setDoc(
        ref,
        {
          pedido: pedidoActualizado,
          total: totalActualizado,
          estado: estadoActualizado,
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );
    };
    acciones.appendChild(btn);
  }

  if (tipo === "listo") {
    const btn = document.createElement("button");
    btn.className = "btn-cocina btn-cocina-regresar";
    btn.textContent = "↩️ Regresar";
    btn.onclick = async () => {
      const ref = doc(db, "mesas", mesaNombre);
      const snap = await getDoc(ref);
      if (!snap.exists()) return;

      const datosMesa = snap.data() || {};
      const pedidoActual = normalizarPedido(datosMesa.pedido, datosMesa.estado || "libre");

      const pedidoActualizado = pedidoActual.map((item) => {
        if (item.estadoItem === "listo") {
          return { ...item, estadoItem: "enviado" };
        }
        return item;
      });

      const estadoActualizado = calcularEstadoMesa(pedidoActualizado);
      const totalActualizado = calcularTotal(pedidoActualizado);

      await setDoc(
        ref,
        {
          pedido: pedidoActualizado,
          total: totalActualizado,
          estado: estadoActualizado,
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );
    };
    acciones.appendChild(btn);
  }

  card.appendChild(acciones);
  return card;
}

function escucharCocina() {
  if (!cocinaActiva || !cocinaLista) return;

  onSnapshot(collection(db, "mesas"), (snapshot) => {
    cocinaActiva.innerHTML = "";
    cocinaLista.innerHTML = "";

    const docs = [];
    snapshot.forEach((d) => docs.push({ id: d.id, ...d.data() }));

    const conPedido = docs
      .map((x) => ({
        ...x,
        pedido: normalizarPedido(x.pedido, x.estado || "libre")
      }))
      .filter((x) => x.pedido.length > 0);

    const enviados = conPedido.filter((x) =>
      x.pedido.some((item) => item.estadoItem === "enviado")
    );
    const listos = conPedido.filter((x) =>
      x.pedido.some((item) => item.estadoItem === "listo")
    );

    if (enviados.length === 0) {
      cocinaActiva.innerHTML = '<div class="cocina-vacia">No hay pedidos en cocina.</div>';
    } else {
      enviados.forEach((p) => {
        const card = crearCardCocina(p, "enviado");
        if (card) cocinaActiva.appendChild(card);
      });
    }

    if (listos.length === 0) {
      cocinaLista.innerHTML = '<div class="cocina-vacia">No hay pedidos listos.</div>';
    } else {
      listos.forEach((p) => {
        const card = crearCardCocina(p, "listo");
        if (card) cocinaLista.appendChild(card);
      });
    }
  });
}

// =========================
// CAJA
// =========================
function escucharCaja() {
  const mesaNombre = getMesaFromURL();
  if (!mesaNombre || !cajaMesa || !cajaTotal) return;

  cajaMesa.textContent = `Cobro - ${mesaNombre}`;

  onSnapshot(doc(db, "mesas", mesaNombre), (snap) => {
    const datos = snap.data() || {
      nombre: mesaNombre,
      pedido: [],
      total: 0,
      estado: "libre"
    };

    pedido = normalizarPedido(datos.pedido, datos.estado || "libre");
    total = calcularTotal(pedido);
    estado = calcularEstadoMesa(pedido);

    cajaTotal.textContent = formatearQ(total);
  });
}

// =========================
// TICKET
// =========================
async function renderizarTicket() {
  const ventaId = getVentaFromURL();
  if (!ventaId || !ticketNumero || !ticketItems || !ticketTotal) return;

  const snap = await getDoc(doc(db, "ventas", ventaId));
  if (!snap.exists()) return;

  const venta = snap.data() || {};

  ticketNumero.textContent = `Ticket #${venta.numeroTicket || ""}`;
  ticketFecha.textContent = `Fecha: ${venta.fechaTexto || ""}`;
  ticketMesa.textContent = `Mesa: ${venta.mesa || ""}`;
  ticketMetodo.textContent = `Pago: ${venta.metodoPago || ""}`;
  ticketTotal.textContent = formatearQ(venta.total);

  ticketItems.innerHTML = "";

  const itemsVenta = normalizarPedido(venta.items, "listo");

  itemsVenta.forEach((item) => {
    const itemBox = document.createElement("div");
    itemBox.className = "ticket-item";

    const row = document.createElement("div");
    row.className = "ticket-row";

    const nombre = document.createElement("span");
    nombre.textContent = item.nombre;

    const precio = document.createElement("span");
    precio.textContent = formatearPrecioVisual(item.precio);

    row.appendChild(nombre);
    row.appendChild(precio);
    itemBox.appendChild(row);

    if (item.comentario) {
      const comentario = document.createElement("div");
      comentario.className = "ticket-comentario";
      comentario.textContent = `• ${item.comentario}`;
      itemBox.appendChild(comentario);
    }

    ticketItems.appendChild(itemBox);
  });
}

// =========================
// DASHBOARD
// =========================
function escucharDashboard() {
  if (!dashboardTotalHoy || !dashboardCantidadVentas || !dashboardListaVentas) return;

  onSnapshot(collection(db, "ventas"), (snapshot) => {
    const ventas = [];
    snapshot.forEach((d) => ventas.push({ id: d.id, ...d.data() }));

    const hoy = hoyISO();
    const ventasHoy = ventas.filter((v) => v.fechaISO === hoy);
    const totalHoy = ventasHoy.reduce((acc, v) => acc + Number(v.total || 0), 0);

    dashboardTotalHoy.textContent = formatearQ(totalHoy);
    dashboardCantidadVentas.textContent = String(ventasHoy.length);

    dashboardListaVentas.innerHTML = "";

    if (ventasHoy.length === 0) {
      dashboardListaVentas.innerHTML =
        '<div class="dashboard-vacio">No hay ventas registradas hoy.</div>';
      return;
    }

    const ordenadas = [...ventasHoy].sort(
      (a, b) => Number(b.numeroTicket || 0) - Number(a.numeroTicket || 0)
    );

    ordenadas.forEach((venta) => {
      const card = document.createElement("div");
      card.className = "dashboard-venta";

      const top = document.createElement("div");
      top.className = "dashboard-venta-top";

      const t = document.createElement("div");
      t.className = "dashboard-venta-ticket";
      t.textContent = `Ticket #${venta.numeroTicket}`;

      const tt = document.createElement("div");
      tt.className = "dashboard-venta-total";
      tt.textContent = formatearQ(venta.total);

      top.appendChild(t);
      top.appendChild(tt);

      const info = document.createElement("div");
      info.className = "dashboard-venta-info";

      const mesa = document.createElement("div");
      mesa.textContent = `Mesa: ${venta.mesa}`;

      const metodo = document.createElement("div");
      metodo.textContent = `Pago: ${venta.metodoPago}`;

      const fecha = document.createElement("div");
      fecha.textContent = `Fecha: ${venta.fechaTexto || ""}`;

      info.appendChild(mesa);
      info.appendChild(metodo);
      info.appendChild(fecha);

      card.appendChild(top);
      card.appendChild(info);

      dashboardListaVentas.appendChild(card);
    });
  });
}

// =========================
// EVENTOS
// =========================
if (btnMetodos.length > 0) {
  btnMetodos.forEach((btn) => {
    btn.addEventListener("click", () => {
      metodoPago = btn.dataset.metodo || "";
      setBotonesMetodoVisual();
    });
  });
}

if (btnAgregarManual) {
  btnAgregarManual.addEventListener("click", async () => {
    const mesaNombre = getMesaFromURL();
    if (!mesaNombre) return;

    const nombre = (manualNombre?.value || "").trim();
    const precioTexto = (manualPrecio?.value || "").trim();
    const precio = Number(precioTexto);
    const comentario = (manualComentario?.value || "").trim();

    if (!nombre) {
      alert("Escribe el nombre del producto.");
      return;
    }

    if (precioTexto === "" || Number.isNaN(precio) || precio < 0) {
      alert("Ingresa un precio válido.");
      return;
    }

    pedido.push({
      nombre,
      precio,
      comentario,
      estadoItem: "pendiente"
    });

    pedido = normalizarPedido(pedido, estado);
    estado = calcularEstadoMesa(pedido);

    await guardarMesa(mesaNombre);
    limpiarFormularioManual();
  });
}

if (btnEnviarCocina) {
  btnEnviarCocina.addEventListener("click", async () => {
    const mesaNombre = getMesaFromURL();
    if (!mesaNombre) return;

    const hayPendientes = pedido.some((item) => item.estadoItem === "pendiente");

    if (!hayPendientes) {
      alert("No hay productos nuevos para enviar a cocina");
      return;
    }

    pedido = pedido.map((item) => {
      if (item.estadoItem === "pendiente") {
        return { ...item, estadoItem: "enviado" };
      }
      return item;
    });

    estado = calcularEstadoMesa(pedido);
    await guardarMesa(mesaNombre);
    alert("Productos nuevos enviados a cocina");
  });
}

if (btnReabrirPedido) {
  btnReabrirPedido.addEventListener("click", async () => {
    const mesaNombre = getMesaFromURL();
    if (!mesaNombre) return;

    if (estado !== "enviado" && estado !== "listo") return;

    const confirmar = confirm("¿Reabrir pedido?");
    if (!confirmar) return;

    estado = "editando";

    await setDoc(
      doc(db, "mesas", mesaNombre),
      {
        estado: "editando",
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );

    alert("Pedido reabierto. Los productos listos no volverán a cocina.");
  });
}

if (btnLimpiar) {
  btnLimpiar.addEventListener("click", async () => {
    const mesaNombre = getMesaFromURL();
    if (!mesaNombre) return;

    const confirmar = confirm("¿Limpiar pedido?");
    if (!confirmar) return;

    pedido = [];
    total = 0;
    estado = "libre";

    await limpiarMesaTotal(mesaNombre);
  });
}

if (btnCobrar) {
  btnCobrar.addEventListener("click", () => {
    const mesaNombre = getMesaFromURL();
    if (!mesaNombre) return;

    if (pedido.length === 0) {
      alert("No hay productos para cobrar");
      return;
    }

    window.location.href = `caja.html?mesa=${encodeURIComponent(mesaNombre)}`;
  });
}

if (btnConfirmarPago) {
  btnConfirmarPago.addEventListener("click", async () => {
    const mesaNombre = getMesaFromURL();
    if (!mesaNombre) return;

    if (pedido.length === 0) {
      alert("No hay productos para cobrar");
      return;
    }

    if (!metodoPago) {
      alert("Selecciona un método de pago");
      return;
    }

    const confirmar = confirm(
      `Total a cobrar: ${formatearQ(total)}\nMétodo: ${metodoPago}\n¿Confirmar pago?`
    );
    if (!confirmar) return;

    const ventaId = await generarVenta(mesaNombre);
    window.location.href = `ticket.html?venta=${encodeURIComponent(ventaId)}`;
  });
}

// =========================
// INIT
// =========================
(async function iniciar() {
  if (mesas.length > 0) {
    await asegurarMesasBase();
    escucharMesas();
  }

  if (tituloMesa) {
    await escucharMesaActual();
  }

  if (cocinaActiva && cocinaLista) {
    escucharCocina();
  }

  if (cajaMesa && cajaTotal) {
    escucharCaja();
  }

  if (ticketNumero && ticketItems && ticketTotal) {
    await renderizarTicket();
  }

  if (dashboardTotalHoy && dashboardCantidadVentas && dashboardListaVentas) {
    escucharDashboard();
  }
})();