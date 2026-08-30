# Medis

**Medis — Tu historia médica, organizada por ti y lista cuando realmente la necesitas.**

MVP educativo y de portafolio desarrollado como aplicación web estática.

## Funciones incluidas

### Inicio
- Saludo personalizado.
- Resumen de medicamentos activos.
- Tomas del día.
- Próxima cita.
- Cantidad de documentos.
- Gráfica de adherencia de 7 días.
- Resumen de cambios desde la última consulta.

### Modo Consulta
Genera un resumen con:
- Medicamentos actuales.
- Alergias y tipo sanguíneo.
- Cambios de tratamiento desde la última consulta.
- Documentos recientes.
- Adherencia registrada.
- Próxima cita.
- Opción de imprimir / guardar como PDF.

### Medicamentos
- Registro de medicamento.
- Dosis, frecuencia, horarios, médico, motivo e indicaciones.
- Registro de tomas.
- Cambio formal de tratamiento.
- Comparación dosis anterior → dosis nueva.
- Finalización del tratamiento.
- Relación con documentos del expediente.

### Calendario
- Consultas.
- Laboratorios.
- Estudios.
- Seguimientos.
- Vacunas.
- Vista mensual y lista.

### Expediente relacionado
- Carga de imágenes y PDF.
- Categorías.
- Asociación con medicamento.
- Asociación con cita.
- Búsqueda.
- Vista previa de imágenes.

### Receta inteligente (demostración)
- Tesseract.js para OCR de imágenes.
- Extrae texto de una receta.
- El usuario debe revisar y confirmar el texto.
- El MVP NO toma decisiones médicas.

### Historial médico
Línea de tiempo de:
- Medicamentos registrados.
- Tomas.
- Cambios de tratamiento.
- Citas.
- Documentos.
- Accesos temporales.

### Compartir con médico
- Selección de información a compartir.
- Duración: 30 minutos, 24 horas o 7 días.
- Generación de token.
- Generación de QR.
- Auditoría de accesos.

**Limitación importante:** como este MVP no tiene backend, el enlace/QR solo puede recuperar los datos en el mismo navegador/dispositivo. Una versión real necesita servidor y base de datos.

### Modo Emergencia
- Nombre.
- Tipo sanguíneo.
- Alergias.
- Contacto de emergencia.
- Medicamentos actuales.
- Opción de imprimir.

### Perfil
- Fecha de nacimiento.
- Teléfono.
- Tipo de sangre.
- Alergias.
- Contacto de emergencia.
- Notas.

## Librerías utilizadas

- Chart.js
- FullCalendar
- SweetAlert2
- Papa Parse
- SheetJS
- QRCode.js
- Tesseract.js
- IndexedDB
- Web Crypto API

## Cómo abrirlo

1. Descomprime `medis_web.zip`.
2. Abre la carpeta `medis_web` en Visual Studio Code.
3. Instala la extensión **Live Server**.
4. Abre `index.html`.
5. Presiona **Go Live**.
6. Crea una cuenta o usa **Probar con datos de demostración**.

## Estructura

```text
medis_web/
├── index.html
├── README.md
├── css/
│   └── styles.css
└── js/
    ├── db.js
    └── app.js
```

## Almacenamiento del MVP

- Usuarios, medicamentos, citas, historial y permisos: `localStorage`.
- Sesión: `sessionStorage`.
- Documentos: `IndexedDB`.
- Contraseña: hash SHA-256 solamente para fines demostrativos.

## No usar con datos médicos reales

Este prototipo es educativo. No es un sistema clínico ni sustituye recomendaciones, diagnósticos o prescripciones médicas.

Para convertir Medis en una aplicación real se requiere como mínimo:

- Backend seguro.
- PostgreSQL u otra base de datos robusta.
- Autenticación real con sesiones seguras.
- Argon2, bcrypt o scrypt para contraseñas.
- Cifrado en tránsito y en reposo.
- Almacenamiento privado de archivos.
- Consentimiento explícito del paciente.
- Roles Paciente / Médico / Administrador.
- Control de acceso granular.
- Acceso temporal real con tokens firmados.
- Auditoría inmutable.
- Expiración y revocación de permisos.
- Política de privacidad.
- Revisión jurídica y regulatoria aplicable a datos de salud.
- Validaciones de carga de archivos y antimalware.

## Arquitectura recomendada para Medis v2

### Frontend
- React
- TypeScript
- Vite

### Backend
- Node.js + NestJS o Express
- Alternativa: Python + FastAPI

### Datos
- PostgreSQL

### Archivos
- Object Storage privado (S3 compatible)
- URLs firmadas de corta duración

### Analítica
- SQL
- Python
- Plotly / Power BI

### Seguridad
- RBAC
- MFA opcional
- Auditoría
- Tokens temporales
- Cifrado
