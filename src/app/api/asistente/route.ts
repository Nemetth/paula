// Turns one sentence from Paula into proposed plan changes. Claude only picks
// tools; nothing is executed here. The app shows the proposals and applies
// them with the same writes the "Algo cambió" sheet uses, once Paula confirms.

import Anthropic from "@anthropic-ai/sdk";
import { AccionAsistente, ContextoAsistente, RespuestaAsistente, accionDeHerramienta } from "@/lib/domain/asistente";

const MODELO = "claude-opus-5-5";

const fecha = { type: "string", description: "Fecha ISO yyyy-MM-dd" } as const;
const ids = { type: "array", items: { type: "string" }, description: "Ids de tareas tomados del contexto" } as const;

function herramienta(name: string, description: string, properties: Record<string, unknown>) {
  return {
    name,
    description,
    strict: true,
    input_schema: { type: "object" as const, properties, required: Object.keys(properties), additionalProperties: false },
  };
}

const HERRAMIENTAS = [
  herramienta("pasar_tareas", "Pasar tareas a otro día (no llegó, las quiere hacer más adelante).", { unidad_ids: ids, fecha }),
  herramienta("marcar_hechas", "Marcar tareas como hechas (las terminó o las adelantó).", { unidad_ids: ids }),
  herramienta("no_trabajo", "Paula no trabaja ese día: lo planificado se reparte en los días siguientes.", { fecha }),
  herramienta("tope_de_hoy", "Hoy puede hacer menos piezas que su tope habitual.", {
    piezas: { type: "number", description: "Cuántas piezas puede hacer hoy" },
  }),
  herramienta("mover_grabacion", "Una grabación cambió de fecha.", { grabacion_id: { type: "string" }, fecha }),
  herramienta("mover_entrega", "Correr la fecha de entrega de un cliente.", {
    cliente_id: { type: "string" },
    fecha_actual: fecha,
    fecha_nueva: fecha,
  }),
  herramienta("pausar_cliente", "Un cliente quedó frenado: su trabajo sale del plan.", { cliente_id: { type: "string" } }),
];

const SISTEMA = `Sos el asistente de planificación de Paula, community manager. Paula te cuenta en una frase qué le pasó en el día y vos lo traducís a cambios del plan usando las herramientas.

Reglas:
- Usá solo ids y fechas que estén en el contexto. Las fechas relativas ("mañana", "el jueves") se calculan desde la fecha "hoy" del contexto.
- Si la frase implica varios cambios, llamá a varias herramientas.
- Si no queda claro qué tarea, cliente o fecha quiere decir, no adivines: no llames a ninguna herramienta y preguntale en una frase corta, en castellano rioplatense.
- No expliques lo que hiciste: Paula ve los cambios propuestos y los confirma ella.`;

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "El asistente no está configurado (falta ANTHROPIC_API_KEY)." }, { status: 503 });
  }
  const { texto, contexto } = (await request.json().catch(() => ({}))) as { texto?: string; contexto?: ContextoAsistente };
  if (!texto?.trim() || !contexto) return Response.json({ error: "Falta la frase o el contexto." }, { status: 400 });
  if (texto.length > 1000) return Response.json({ error: "La frase es muy larga." }, { status: 400 });

  const client = new Anthropic();
  try {
    const respuesta = await client.beta.messages.create({
      model: MODELO,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low" },
      system: SISTEMA,
      tools: HERRAMIENTAS,
      messages: [
        {
          role: "user",
          content: `Contexto:\n${JSON.stringify(contexto)}\n\nLo que pasó: ${texto.trim()}`,
        },
      ],
    });

    if (respuesta.stop_reason === "refusal") {
      return Response.json({ acciones: [], mensaje: "No pude interpretar eso. Probá contarlo de otra forma." } satisfies RespuestaAsistente);
    }
    const acciones: AccionAsistente[] = [];
    const textos: string[] = [];
    for (const bloque of respuesta.content) {
      if (bloque.type === "tool_use") {
        const accion = accionDeHerramienta(bloque.name, bloque.input, contexto);
        if (accion) acciones.push(accion);
      } else if (bloque.type === "text" && bloque.text.trim()) {
        textos.push(bloque.text.trim());
      }
    }
    const mensaje = textos.join(" ") || (acciones.length === 0 ? "No encontré qué cambiar. ¿Me lo contás con más detalle?" : undefined);
    return Response.json({ acciones, mensaje } satisfies RespuestaAsistente);
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) {
      return Response.json({ error: "El asistente está saturado. Probá en un ratito." }, { status: 429 });
    }
    if (e instanceof Anthropic.APIError) {
      console.error("[asistente]", e.status, e.message);
      return Response.json({ error: "El asistente no respondió. Probá de nuevo." }, { status: 502 });
    }
    throw e;
  }
}
