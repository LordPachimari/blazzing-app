import type { WorkerBindings, WorkerEnv } from "@blazzing-app/validators";
import { OrderSchema } from "@blazzing-app/validators/server";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { getDB } from "../lib/db";
import { cache } from "hono/cache";
export namespace OrderApi {
	export const route = new OpenAPIHono<{
		Bindings: WorkerBindings & WorkerEnv;
	}>().openapi(
		createRoute({
			security: [{ Bearer: [] }],
			method: "get",
			path: "/id",
			request: {
				query: z.object({
					id: z.optional(z.array(z.string()).or(z.string())),
				}),
			},
			middleware: [
				cache({
					cacheName: "blazzing-cache",
				}),
			],
			responses: {
				200: {
					content: {
						"application/json": {
							schema: z.object({
								result: z.array(OrderSchema),
							}),
						},
					},
					description: "Creates orders, clears the cart and returns order IDs",
				},
			},
		}),
		//@ts-ignore
		async (c) => {
			console.log("what");
			const { id } = c.req.valid("query");
			console.log("id", id);
			if (!id) return [];
			const db = getDB({ connectionString: c.env.DATABASE_URL });
			const result = await db.query.orders.findMany({
				where: (orders, { inArray }) =>
					inArray(orders.id, typeof id === "string" ? [id] : id),
				with: {
					items: {
						with: {
							variant: {
								with: {
									optionValues: {
										with: {
											optionValue: {
												with: {
													option: true,
												},
											},
										},
									},
									prices: true,
								},
							},
							product: {
								with: {
									baseVariant: true,
								},
							},
						},
					},
					shippingAddress: true,
					billingAddress: true,
					store: {
						columns: {
							id: true,
							image: true,
							name: true,
						},
					},
				},
			});

			if (!result) return [];

			return c.json({ result });
		},
	);
}
