import * as Cloudflare from "alchemy/Cloudflare";

/**
 * AI Gateway the agent dispatches every model call through.
 *
 * `apps/agent/src/app.ts` registers the Workers AI provider naming this gateway
 * id, and binding this resource as `AI` on the agent Worker is what emits the
 * `ai` binding. No provider API key is involved: authorization and billing
 * follow the Worker's own account.
 */
export const AI_GATEWAY = Cloudflare.AI.Gateway("AiGateway", {
	id: "open-cash-gateway",
});

/**
 * Dynamic route used by `useModel("cloudflare/dynamic/low-budget")`.
 *
 * Requests start on GPT OSS 120B and fall back to GLM 5.3 when the primary
 * model cannot start a successful response. Both models run on Workers AI, so
 * they use the gateway's Workers AI billing configuration without provider
 * API keys.
 */
export const LOW_BUDGET_ROUTE = (gatewayId: string) =>
	Cloudflare.AI.GatewayDynamicRouting("AiGatewayLowBudget", {
		gatewayId,
		name: "low-budget",
		elements: [
			{
				id: "START",
				type: "start",
				outputs: { next: { elementId: "model-start" } },
			},
			{
				id: "model-start",
				type: "model",
				properties: {
					provider: "workers-ai",
					model: "@cf/openai/gpt-oss-120b",
					timeout: 0,
					retries: 0,
				},
				outputs: {
					success: { elementId: "END" },
					fallback: { elementId: "model-1788287997746-sf9a31" },
				},
			},
			{
				id: "END",
				type: "end",
				outputs: {},
			},
			{
				id: "model-1788287997746-sf9a31",
				type: "model",
				properties: {
					provider: "workers-ai",
					model: "@cf/zai-org/glm-5.3",
					timeout: 0,
					retries: 0,
				},
				outputs: {
					success: { elementId: "END" },
					fallback: { elementId: "END" },
				},
			},
		],
	});
