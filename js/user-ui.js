import { auth, db } from "./firebase-config.js";
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const usuarioNombre = document.getElementById("usuarioNombre");
const btnLogout = document.getElementById("btnLogout");

onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  try {
    const ref = doc(db, "usuarios", user.uid);
    const snap = await getDoc(ref);

    if (!snap.exists()) return;

    const data = snap.data();

    if (usuarioNombre) {
      usuarioNombre.textContent = `Bienvenido, ${data.nombre || "Usuario"}`;
    }
  } catch (error) {
    console.error(error);
  }
});

btnLogout?.addEventListener("click", async () => {
  const confirmar = confirm("¿Cerrar sesión?");
  if (!confirmar) return;

  await signOut(auth);
  window.location.href = "login.html";
});