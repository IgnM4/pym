import { Router } from "express";
import {
  parseVentaBody,
  parseUserIdFromHeaders,
} from "../dto/ventas.dto.js";
import * as service from "../services/ventas.service.js";

const router = Router();

router.post("/", async (req, res, next) => {
  try {
    const userId = parseUserIdFromHeaders(req);
    const body = parseVentaBody(req);
    const venta = await service.createVenta(body, userId);
    res.status(201).json(venta);
  } catch (err) {
    next(err);
  }
});

export default router;
