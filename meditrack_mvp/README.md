# MediTrack MVP

Prototipo educativo para registrar medicamentos y consultar el historial reportado por un paciente.

## Tecnologías
- HTML
- CSS
- JavaScript
- Chart.js
- Papa Parse
- SheetJS
- LocalStorage

## Funciones
- Registro básico de paciente.
- Registro de medicamentos y dosis.
- Marcar una toma como tomada u omitida.
- Historial cronológico.
- Vista de médico.
- Gráfica de adherencia registrada.
- Exportación a CSV y Excel.

## Cómo ejecutarlo en Visual Studio Code
1. Abre la carpeta `meditrack_mvp`.
2. Abre `index.html`.
3. Usa la extensión Live Server.
4. Presiona `Go Live`.

## Importante
Este MVP usa LocalStorage y NO debe utilizarse con información clínica real.

Una versión productiva debería agregar:
- Login y autenticación.
- Roles de paciente, médico y administrador.
- Backend seguro.
- PostgreSQL u otra base de datos.
- Cifrado.
- Consentimiento.
- Bitácora de auditoría.
- Control de sesiones y accesos.
- Validaciones de privacidad y regulación aplicables.
