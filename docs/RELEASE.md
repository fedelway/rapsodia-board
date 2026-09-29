# Rapsodia — release para GitHub Pages

Build estático del juego (Svelte + Vite) para servir desde la carpeta `docs`.

## Cómo publicarlo

1. Subí el repo a GitHub.
2. En **Settings → Pages**:
   - Source: **Deploy from a branch**
   - Branch: `main` (o `master`)
   - Folder: **/docs**
3. La app queda en `https://<usuario>.github.io/<repo>/`

Los samples de instrumentos se cargan desde jsDelivr (`tonejs-instruments`, CC BY 3.0). El primer sonido puede tardar unos segundos.

## Qué incluye esta versión

- 4 jugadores en hotseat (rojo, azul, verde, amarillo) con roles que rotan
- Armonía: raíz, terceras, extremos, 7ma opcional y duración del acorde
- Melodía: nota, octava, duración; preview naranja en la partitura
- Partitura 4/4 con barras de compás, cifrado americano (tríada al 3er jugador; al cerrar, notas entre paréntesis)
- Samples de piano, cuerdas, vientos, etc.

Regenerar este sitio desde la raíz del proyecto:

```bash
npm install
npm run build
```
