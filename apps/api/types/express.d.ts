declare module "express-serve-static-core" {
  interface Request {
    user?: { id: string; role: "admin" | "ventas" | "consulta" };
  }
}

export {};
