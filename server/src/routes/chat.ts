import { Router } from "express";
import { z } from "zod";

import { menuItems } from "../data/menu";
import { processOrder } from "../lib/gemini";

const cartItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  price: z.number(),
  quantity: z.number().int().nonnegative(),
});

const chatBodySchema = z.object({
  message: z.string().min(1),
  cart: z.array(cartItemSchema),
});

const chatRouter = Router();

chatRouter.post("/chat", async (req, res) => {
  console.log("[Chat Route] Received incoming chat request:", req.body);
  const parsed = chatBodySchema.safeParse(req.body);

  if (!parsed.success) {
    console.error("[Chat Route] Validation failed for request body:", parsed.error.format());
    return res.status(400).json({ error: "Invalid request body" });
  }

  try {
    const { message, cart } = parsed.data;
    console.log("[Chat Route] Calling processOrder with message:", message);
    const aiResponse = await processOrder(message, cart, menuItems);
    console.log("[Chat Route] processOrder returned successfully:", aiResponse);
    return res.status(200).json(aiResponse);
  } catch (error) {
    console.error("[Chat Route] Caught error during processOrder:", error);
    return res.status(500).json({ error: "Processing failed" });
  }
});

export default chatRouter;
