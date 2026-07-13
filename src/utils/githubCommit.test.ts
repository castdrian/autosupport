import { describe, expect, it } from "bun:test";
import {
	isGithubCommitConfigured,
	MissingGithubTokenError,
} from "@utils/githubCommit";

describe("isGithubCommitConfigured", () => {
	it("returns a boolean reflecting whether a token is set", () => {
		expect(typeof isGithubCommitConfigured()).toBe("boolean");
	});
});

describe("MissingGithubTokenError", () => {
	it("is an Error with a descriptive name and message", () => {
		const error = new MissingGithubTokenError();
		expect(error).toBeInstanceOf(Error);
		expect(error.name).toBe("MissingGithubTokenError");
		expect(error.message).toContain("GitHub token");
	});
});
