import { describe, expect, test } from "bun:test";
import { getUsageSummary } from "@utils/usage";
import type OpenAI from "openai";

function startOfUtcDay(date: Date): number {
	return (
		Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) /
		1000
	);
}

interface CostsPage {
	data: unknown[];
	has_more: boolean;
	next_page?: string;
}

function createClient(pages: CostsPage[]): {
	client: OpenAI;
	calls: Array<{ page?: string }>;
} {
	const calls: Array<{ page?: string }> = [];
	let index = 0;

	const client = {
		admin: {
			organization: {
				usage: {
					costs: async (params: { page?: string }) => {
						calls.push(params);
						const page = pages[index];
						index++;
						return page;
					},
				},
			},
		},
	} as unknown as OpenAI;

	return { client, calls };
}

describe("getUsageSummary", () => {
	const dayStart = startOfUtcDay(new Date());

	test("sums today and month-to-date costs, excluding older buckets from today", async () => {
		const { client } = createClient([
			{
				data: [
					{
						start_time: dayStart - 2 * 86400,
						results: [
							{
								object: "organization.costs.result",
								amount: { value: 5, currency: "usd" },
							},
						],
					},
					{
						start_time: dayStart,
						results: [
							{
								object: "organization.costs.result",
								amount: { value: 3, currency: "usd" },
							},
						],
					},
				],
				has_more: false,
			},
		]);

		const summary = await getUsageSummary(client);

		expect(summary.monthToDateUsd).toBe(8);
		expect(summary.todayUsd).toBe(3);
		expect(summary.currency).toBe("usd");
	});

	test("follows pagination until has_more is false", async () => {
		const { client, calls } = createClient([
			{
				data: [
					{
						start_time: dayStart,
						results: [
							{
								object: "organization.costs.result",
								amount: { value: 1, currency: "usd" },
							},
						],
					},
				],
				has_more: true,
				next_page: "page-2",
			},
			{
				data: [
					{
						start_time: dayStart,
						results: [
							{
								object: "organization.costs.result",
								amount: { value: 2, currency: "usd" },
							},
						],
					},
				],
				has_more: false,
			},
		]);

		const summary = await getUsageSummary(client);

		expect(summary.monthToDateUsd).toBe(3);
		expect(calls).toHaveLength(2);
		expect(calls[1]?.page).toBe("page-2");
	});

	test("ignores non-cost result entries and defaults missing amounts to 0", async () => {
		const { client } = createClient([
			{
				data: [
					{
						start_time: dayStart,
						results: [
							{ object: "organization.costs.result" },
							{
								object: "some.other.result",
								amount: { value: 100, currency: "usd" },
							},
						],
					},
				],
				has_more: false,
			},
		]);

		const summary = await getUsageSummary(client);

		expect(summary.monthToDateUsd).toBe(0);
	});
});
