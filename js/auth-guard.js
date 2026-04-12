import { auth, db } from "./firebase-config.js";
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

async function obtenerUsuario(uid) {
  const ref = doc(db, "usuarios", uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    throw new Error("No existe usuario en Firestore.");
  }

  const data = snap.data();

  if (!data.activo) {
    throw new Error("Usuario inactivo.");
  }

  return data;
}

function paginaActual() {
  const path = window.location.pathname.split("/").pop();
  return path || "index.html";
}

function rolPermitido(rol, pagina) {
  const permisos = {
    admin: ["index.html", "mesas.html", "pedido.html", "cocina.html", "caja.html", "ticket.html", "dashboard.html"],
    mesero: ["index.html", "mesas.html", "pedido.html", "ticket.html"],
    cocina: ["index.html", "cocina.html"],
    caja: ["index.html", "mesas.html", "pedido.html", "caja.html", "ticket.html"]
  };

  return (permisos[rol] || []).includes(pagina);
}

onAuthStateChanged(auth, async (user) => {
  const pagina = paginaActual();

  if (!user) {
    window.location.href = "login.html";
    return;
  }

  try {
    const usuario = await obtenerUsuario(user.uid);
    const rol = usuario.rol || "";

    if (!rolPermitido(rol, pagina)) {
      if (rol === "cocina") {
        window.location.href = "cocina.html";
        return;
      }

      window.location.href = "mesas.html";
      return;
    }
  } catch (error) {
    console.error(error);
    await signOut(auth);
    window.location.href = "login.html";
  }
});