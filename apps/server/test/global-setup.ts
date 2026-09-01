import type { StartedTestContainer } from "testcontainers";
import type { ProvidedContext } from "vitest";

import { S3mini } from "s3mini";
import { GenericContainer, Wait } from "testcontainers";

interface GlobalSetupContext {
	provide<Key extends keyof ProvidedContext & string>(
		key: Key,
		value: ProvidedContext[Key],
	): void;
}

const S3_ACCESS_KEY_ID = "integration-test-access-key";
const S3_BUCKET = "open-cash-bucket";
const S3_SECRET_ACCESS_KEY = "integration-test-secret-key";

const startS3 = () =>
	new GenericContainer("minio/minio:RELEASE.2025-09-07T16-13-09Z")
		.withCommand(["server", "/data", "--console-address", ":9001"])
		.withEnvironment({
			MINIO_ROOT_PASSWORD: S3_SECRET_ACCESS_KEY,
			MINIO_ROOT_USER: S3_ACCESS_KEY_ID,
		})
		.withExposedPorts(9000)
		.withStartupTimeout(120_000)
		.withWaitStrategy(Wait.forHttp("/minio/health/ready", 9000))
		.start();

const stopContainers = async (containers: StartedTestContainer[]) => {
	await Promise.allSettled(containers.map(async (container) => await container.stop()));
};

const ensureS3Bucket = async (endpoint: string) => {
	const s3 = new S3mini({
		accessKeyId: S3_ACCESS_KEY_ID,
		endpoint,
		region: "us-east-1",
		secretAccessKey: S3_SECRET_ACCESS_KEY,
	});

	if (!(await s3.bucketExists())) {
		await s3.createBucket();
	}
	if (!(await s3.bucketExists())) {
		throw new Error(`Failed to create S3 bucket at ${endpoint}.`);
	}
};

export default async function setup({ provide }: GlobalSetupContext) {
	const results = await Promise.allSettled([startS3()]);
	const started = results.flatMap((result) =>
		result.status === "fulfilled" ? [result.value] : [],
	);
	const failures = results.flatMap((result) =>
		result.status === "rejected" ? [result.reason] : [],
	);

	if (failures.length > 0) {
		await stopContainers(started);
		throw new AggregateError(failures, "Failed to start integration test containers.");
	}

	const [s3] = started;
	if (!s3) {
		await stopContainers(started);
		throw new Error("Integration test containers did not start.");
	}

	const s3Endpoint = `http://${s3.getHost()}:${s3.getMappedPort(9000)}/${S3_BUCKET}`;

	try {
		await ensureS3Bucket(s3Endpoint);
	} catch (error) {
		await stopContainers(started);
		throw error;
	}

	provide("s3AccessKeyId", S3_ACCESS_KEY_ID);
	provide("s3Endpoint", s3Endpoint);
	provide("s3SecretAccessKey", S3_SECRET_ACCESS_KEY);

	return async () => await stopContainers(started);
}
