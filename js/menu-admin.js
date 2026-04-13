import { db } from "./firebase-config.js";
import {
  collection,
  addDoc,
  onSnapshot,
  serverTimestamp,
  doc,
  updateDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const menuNombre = document.getElementById("menuNombre");
const menuPrecio = document.getElementById("menuPrecio");
const menuArea = document.getElementById("menuArea");
const menuActivo = document.getElementById("menuActivo");
const btnGuardarProducto = document.getElementById("btnGuardarProducto");
const menuLista = document.getElementById("menuLista");

function formatearQ(n) {
  return `Q${Number(n || 0)}`;
}

function limpiarFormulario() {
  if (menuNombre) menuNombre.value = "";
  if (menuPrecio) menuPrecio.value = "";
  if (menuArea) menuArea.value = "comida";
  if (menuActivo) menuActivo.value = "true";
}

function textoArea(area) {
  return area === "bebidas" ? "Bebidas" : "Comida";
}

if (btnGuardarProducto) {
  btnGuardarProducto.addEventListener("click", async () => {
    const nombre = (menuNombre?.value || "").trim();
    const precioTexto = (menuPrecio?.value || "").trim();
    const precio = Number(precioTexto);
    const area = menuArea?.value || "comida";
    const activo = (menuActivo?.value || "true") === "true";

    if (!nombre) {
      alert("Escribe el nombre del producto.");
      return;
    }

    if (precioTexto === "" || Number.isNaN(precio) || precio < 0) {
      alert("Ingresa un precio válido.");
      return;
    }

    try {
      await addDoc(collection(db, "menu"), {
        nombre,
        precio,
        area,
        activo,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      limpiarFormulario();
      alert("Producto guardado en el menú.");
    } catch (error) {
      console.error(error);
      alert("No se pudo guardar el producto.");
    }
  });
}

function crearCardProducto(id, data) {
  const card = document.createElement("div");
  card.style.background = "#252525";
  card.style.padding = "16px";
  card.style.borderRadius = "12px";
  card.style.marginBottom = "12px";

  const titulo = document.createElement("div");
  titulo.style.fontWeight = "bold";
  titulo.style.fontSize = "18px";
  titulo.textContent = data.nombre || "Sin nombre";

  const info = document.createElement("div");
  info.style.marginTop = "8px";
  info.style.opacity = "0.9";
  info.innerHTML = `
    <div>Precio: ${formatearQ(data.precio)}</div>
    <div>Área: ${textoArea(data.area)}</div>
    <div>Estado: ${data.activo ? "Activo" : "Inactivo"}</div>
  `;

  const acciones = document.createElement("div");
  acciones.style.display = "flex";
  acciones.style.flexWrap = "wrap";
  acciones.style.gap = "10px";
  acciones.style.marginTop = "12px";

  const btnEstado = document.createElement("button");
  btnEstado.className = "boton-pequeno";
  btnEstado.textContent = data.activo ? "Desactivar" : "Activar";
  btnEstado.addEventListener("click", async () => {
    try {
      await updateDoc(doc(db, "menu", id), {
        activo: !data.activo,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error(error);
      alert("No se pudo cambiar el estado.");
    }
  });

  const btnEditar = document.createElement("button");
  btnEditar.className = "boton-pequeno";
  btnEditar.textContent = "Editar";
  btnEditar.addEventListener("click", async () => {
    const nuevoNombre = prompt("Nuevo nombre:", data.nombre || "");
    if (nuevoNombre === null) return;

    const nuevoPrecioTexto = prompt("Nuevo precio:", String(data.precio ?? 0));
    if (nuevoPrecioTexto === null) return;

    const nuevoPrecio = Number(nuevoPrecioTexto);
    if (!nuevoNombre.trim()) {
      alert("Nombre inválido.");
      return;
    }

    if (nuevoPrecioTexto.trim() === "" || Number.isNaN(nuevoPrecio) || nuevoPrecio < 0) {
      alert("Precio inválido.");
      return;
    }

    const nuevaArea = prompt("Área: comida o bebidas", data.area || "comida");
    if (nuevaArea === null) return;

    const areaFinal = nuevaArea.trim().toLowerCase() === "bebidas" ? "bebidas" : "comida";

    try {
      await updateDoc(doc(db, "menu", id), {
        nombre: nuevoNombre.trim(),
        precio: nuevoPrecio,
        area: areaFinal,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error(error);
      alert("No se pudo editar el producto.");
    }
  });

  const btnEliminar = document.createElement("button");
  btnEliminar.className = "boton-pequeno";
  btnEliminar.style.background = "#b33232";
  btnEliminar.textContent = "Eliminar";
  btnEliminar.addEventListener("click", async () => {
    const confirmar = confirm(`¿Eliminar ${data.nombre}?`);
    if (!confirmar) return;

    try {
      await deleteDoc(doc(db, "menu", id));
    } catch (error) {
      console.error(error);
      alert("No se pudo eliminar el producto.");
    }
  });

  acciones.appendChild(btnEstado);
  acciones.appendChild(btnEditar);
  acciones.appendChild(btnEliminar);

  card.appendChild(titulo);
  card.appendChild(info);
  card.appendChild(acciones);

  return card;
}

function escucharMenu() {
  if (!menuLista) return;

  onSnapshot(collection(db, "menu"), (snapshot) => {
    menuLista.innerHTML = "";

    const productos = [];
    snapshot.forEach((docSnap) => {
      productos.push({
        id: docSnap.id,
        ...docSnap.data()
      });
    });

    productos.sort((a, b) => {
      const nombreA = (a.nombre || "").toLowerCase();
      const nombreB = (b.nombre || "").toLowerCase();
      return nombreA.localeCompare(nombreB, "es");
    });

    if (productos.length === 0) {
      menuLista.innerHTML = '<div style="opacity:.8;">No hay productos en el menú.</div>';
      return;
    }

    productos.forEach((producto) => {
      menuLista.appendChild(crearCardProducto(producto.id, producto));
    });
  });
}

escucharMenu();