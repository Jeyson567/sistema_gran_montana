import { auth, db } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const btnLogin = document.getElementById("btnLogin");
const loginError = document.getElementById("loginError");

async function obtenerRol(uid) {
  const ref = doc(db, "usuarios", uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    throw new Error("No existe usuario en Firestore.");
  }

  const data = snap.data();

  if (!data.activo) {
    throw new Error("Usuario inactivo.");
  }

  return data.rol || "";
}

function redirigirPorRol(rol) {
  if (rol === "cocina") {
    window.location.href = "cocina.html";
    return;
  }

  if (rol === "caja" || rol === "mesero" || rol === "admin") {
    window.location.href = "mesas.html";
    return;
  }

  throw new Error("Rol no válido: " + rol);
}

btnLogin.addEventListener("click", async () => {
  loginError.textContent = "";

  const email = (emailInput.value || "").trim();
  const password = passwordInput.value || "";

  if (!email || !password) {
    loginError.textContent = "Escribe tu correo y contraseña.";
    return;
  }

  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const rol = await obtenerRol(cred.user.uid);
    redirigirPorRol(rol);
  } catch (error) {
    console.error(error);
    loginError.textContent = error.message || "No se pudo iniciar sesión.";
  }
});

onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  try {
    const rol = await obtenerRol(user.uid);
    redirigirPorRol(rol);
  } catch (error) {
    console.error(error);
  }
});