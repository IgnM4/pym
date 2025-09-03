import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
  extendZodWithOpenApi,
} from "@asteasolutions/zod-to-openapi";

import config from "./config.js";
import pkg from "../package.json";
import {
  clienteBodySchema,
  clienteIdParamsSchema,
} from "./dto/clientes.dto.js";
import {
  ventaBodySchema,
  ventaHeaderSchema,
} from "./dto/ventas.dto.js";

extendZodWithOpenApi(z);

const registry = new OpenAPIRegistry();

const clienteSchema = registry.register(
  "Cliente",
  clienteBodySchema.extend({ id: z.number().int().positive() })
);

registry.registerPath({
  method: "get",
  path: "/api/clientes",
  responses: {
    200: {
      description: "Lista de clientes",
      content: {
        "application/json": {
          schema: z.array(clienteSchema),
        },
      },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/clientes",
  request: {
    body: {
      content: {
        "application/json": { schema: clienteBodySchema },
      },
    },
  },
  responses: {
    201: {
      description: "Cliente creado",
      content: {
        "application/json": { schema: clienteSchema },
      },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/clientes/{id}",
  request: { params: clienteIdParamsSchema },
  responses: {
    200: {
      description: "Cliente",
      content: {
        "application/json": { schema: clienteSchema },
      },
    },
    404: { description: "No encontrado" },
  },
});

const ventaResponseSchema = registry.register(
  "VentaResponse",
  z.object({
    ok: z.literal(true),
    idBoleta: z.number().int(),
    numero: z.string(),
    idCliente: z.number().int(),
    origenUbicacion: z.number().int(),
    items: z.array(
      z.object({ idProducto: z.number().int(), cantidad: z.number().int() })
    ),
    totales: z.object({
      neto: z.number(),
      iva: z.number(),
      total: z.number(),
    }),
  })
);

registry.registerPath({
  method: "post",
  path: "/api/ventas",
  request: {
    headers: ventaHeaderSchema,
    body: {
      content: {
        "application/json": { schema: ventaBodySchema },
      },
    },
  },
  responses: {
    201: {
      description: "Venta creada",
      content: {
        "application/json": { schema: ventaResponseSchema },
      },
    },
  },
});

const generator = new OpenApiGeneratorV3(registry.definitions);
const document = generator.generateDocument({
  openapi: "3.0.0",
  info: {
    title: "API",
    version: pkg.version,
  },
  servers: [{ url: `http://localhost:${config.port}` }],
});

export function generateOpenApi(): void {
  const outDir = join(process.cwd(), "dist");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "openapi.json"), JSON.stringify(document, null, 2));
}

if (require.main === module) {
  generateOpenApi();
}
