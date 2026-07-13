import { Octokit } from "@octokit/rest";
import { config } from "@src/config";

const REPO_OWNER = "castdrian";
const REPO_NAME = "autosupport";
const DATA_FILE_PATH = "src/data.toml";
const BRANCH = "main";
const MAX_SHA_CONFLICT_RETRIES = 3;

let octokit: Octokit | undefined;

export class MissingGithubTokenError extends Error {
	public constructor() {
		super("No GitHub token configured; cannot commit knowledge base changes.");
		this.name = "MissingGithubTokenError";
	}
}

export function isGithubCommitConfigured(): boolean {
	return Boolean(config.githubToken);
}

function getOctokit(): Octokit {
	if (!config.githubToken) throw new MissingGithubTokenError();
	if (!octokit) octokit = new Octokit({ auth: config.githubToken });
	return octokit;
}

async function getCurrentFileSha(client: Octokit): Promise<string | undefined> {
	try {
		const response = await client.repos.getContent({
			owner: REPO_OWNER,
			repo: REPO_NAME,
			path: DATA_FILE_PATH,
			ref: BRANCH,
		});
		if (!Array.isArray(response.data) && "sha" in response.data) {
			return response.data.sha;
		}
		return undefined;
	} catch (error) {
		if (
			typeof error === "object" &&
			error !== null &&
			"status" in error &&
			error.status === 404
		) {
			return undefined;
		}
		throw error;
	}
}

// Commits new data.toml content directly to main. The commit message carries
// [skip ci] so the deploy workflow does not redeploy — the live process is
// updated in memory instead. Retries on the 409 that GitHub returns when the
// file's sha moved between our read and write (e.g. concurrent edits).
export async function commitDataFile(
	content: string,
	message: string,
): Promise<void> {
	const client = getOctokit();
	const encoded = Buffer.from(content, "utf8").toString("base64");

	for (let attempt = 0; attempt <= MAX_SHA_CONFLICT_RETRIES; attempt++) {
		const sha = await getCurrentFileSha(client);
		try {
			await client.repos.createOrUpdateFileContents({
				owner: REPO_OWNER,
				repo: REPO_NAME,
				path: DATA_FILE_PATH,
				branch: BRANCH,
				message,
				content: encoded,
				sha,
			});
			return;
		} catch (error) {
			const status =
				typeof error === "object" && error !== null && "status" in error
					? error.status
					: undefined;
			if (status === 409 && attempt < MAX_SHA_CONFLICT_RETRIES) continue;
			throw error;
		}
	}
}
