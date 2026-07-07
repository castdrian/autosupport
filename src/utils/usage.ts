import type OpenAI from "openai";

type CostsResponse = Awaited<
	ReturnType<OpenAI["admin"]["organization"]["usage"]["costs"]>
>;
type CostBucket = CostsResponse["data"][number];

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
		const response = await client.admin.organization.usage.costs({
			start_time: startTime,
			limit: 31,
			...(page ? { page } : {}),
		});
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
			if (result.object !== "organization.costs.result") continue;
			const value = Number(result.amount?.value ?? 0);
			currency = result.amount?.currency ?? currency;
			monthToDateUsd += value;
			if (bucket.start_time >= dayStart) {
				todayUsd += value;
			}
		}
	}

	return { todayUsd, monthToDateUsd, currency };
}
