import type OpenAI from "openai";

interface CostAmount {
	value: number;
	currency: string;
}

interface CostResult {
	amount: CostAmount;
}

interface CostBucket {
	start_time: number;
	end_time: number;
	results: CostResult[];
}

interface CostsPage {
	data: CostBucket[];
	has_more: boolean;
	next_page: string | null;
}

export interface UsageSummary {
	todayUsd: number;
	monthToDateUsd: number;
	currency: string;
}

function startOfUtcDay(date: Date): number {
	return (
		Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) /
		1000
	);
}

function startOfUtcMonth(date: Date): number {
	return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1) / 1000;
}

async function fetchCostBuckets(
	client: OpenAI,
	startTime: number,
): Promise<CostBucket[]> {
	const buckets: CostBucket[] = [];
	let page: string | undefined;

	do {
		const response = await client.get<unknown, CostsPage>(
			"/organization/costs",
			{
				query: { start_time: startTime, limit: 31, ...(page ? { page } : {}) },
			},
		);
		buckets.push(...response.data);
		page = response.has_more && response.next_page ? response.next_page : undefined;
	} while (page);

	return buckets;
}

export async function getUsageSummary(client: OpenAI): Promise<UsageSummary> {
	const now = new Date();
	const monthStart = startOfUtcMonth(now);
	const dayStart = startOfUtcDay(now);

	const buckets = await fetchCostBuckets(client, monthStart);

	let monthToDateUsd = 0;
	let todayUsd = 0;
	let currency = "usd";

	for (const bucket of buckets) {
		for (const result of bucket.results) {
			monthToDateUsd += result.amount.value;
			currency = result.amount.currency;
			if (bucket.start_time >= dayStart) {
				todayUsd += result.amount.value;
			}
		}
	}

	return { todayUsd, monthToDateUsd, currency };
}
