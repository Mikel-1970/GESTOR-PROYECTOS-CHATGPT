# GPT Activity Manager — MVP local-first

MVP funcional para inventariar y gestionar chats, Projects, Work, tareas y otros recursos relacionados con ChatGPT sin depender de APIs privadas o no documentadas.

## Funciones implementadas
- Dashboard con activos, Work a revisar, bloqueos, elementos sin clasificar, elementos sin siguiente acción y próximos vencimientos.
- CRUD local de elementos.
- Tipos: chat, project, work, task, file, other.
- Estados: nuevo, activo, esperando, requiere revisión, bloqueado, terminado, archivado.
- Proyectos y vínculos entre elementos.
- Búsqueda global y filtros.
- Ficha de proyecto con elementos vinculados.
- Detección local de posibles relaciones/duplicados por similitud textual; solo propone, no modifica.
- Enlace al recurso original.
- Importación JSON/CSV; parser tolerante para JSON exportado de ChatGPT, sin asumir que su esquema sea estable.
- Backup JSON.
- PWA instalable y cache básico offline.
- Datos guardados solo en localStorage del navegador.

## Ejecutar
No abras `index.html` directamente si quieres que funcione el service worker. Sirve la carpeta por HTTP:

```bash
python3 -m http.server 8080
```

Después abre `http://localhost:8080`.

## Importar un export de ChatGPT
1. Solicita el export desde ChatGPT > Settings > Data controls > Export data.
2. Descarga y extrae el ZIP.
3. En el MVP pulsa **Importar** y selecciona el JSON de conversaciones si está presente.

OpenAI documenta que el ZIP incluye el historial, pero no publica el esquema del JSON como contrato estable. El importador se ha implementado de forma defensiva y debe validarse con un export real antes de considerarlo integración estable.

## Seguridad
- El MVP no pide ni almacena API keys.
- Los datos permanecen en el navegador salvo que el usuario exporte un backup.
- Los enlaces compartidos de ChatGPT no deben usarse para material confidencial; para el MVP es preferible guardar el enlace privado/original cuando el usuario lo tenga y solo crear shared links si existe un motivo explícito.

## Próxima fase recomendada
- Backend ligero + Postgres/Supabase para sincronización multidispositivo y multiusuario.
- Adaptador de importación incremental.
- Clasificación/resumen vía OpenAI API desde backend, con minimización de contenido.
- Posible extensión de navegador solo como capturador explícito y opt-in, nunca como fuente crítica basada en scraping frágil.
- Adaptador Enterprise/Edu Compliance API únicamente si el plan y permisos lo justifican.
