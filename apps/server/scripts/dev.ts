const serverDirectory = new URL("../", import.meta.url).pathname;
const agentDirectory = new URL("../../agent/", import.meta.url).pathname;

const migration = Bun.spawnSync(
	[
		"bun",
		"x",
		"wrangler",
		"d1",
		"migrations",
		"apply",
		"DATABASE",
		"--local",
		"--config",
		"wrangler.jsonc",
		"--persist-to",
		"../../.wrangler/dev-shared",
	],
	{ cwd: serverDirectory, stderr: "inherit", stdout: "inherit" },
);

if (!migration.success) process.exit(migration.exitCode);

const children = [
	Bun.spawn(["bun", "run", "dev"], {
		cwd: agentDirectory,
		stderr: "inherit",
		stdin: "inherit",
		stdout: "inherit",
	}),
	Bun.spawn(
		[
			"bun",
			"x",
			"wrangler",
			"dev",
			"--local",
			"--config",
			"wrangler.jsonc",
			"--persist-to",
			"../../.wrangler/dev-shared",
		],
		{
			cwd: serverDirectory,
			stderr: "inherit",
			stdin: "inherit",
			stdout: "inherit",
		},
	),
];

const stop = () => {
	for (const child of children) child.kill();
};

process.on("SIGINT", stop);
process.on("SIGTERM", stop);

const exitCode = await Promise.race(children.map(async (child) => await child.exited));
stop();
await Promise.allSettled(children.map(async (child) => await child.exited));
process.exit(exitCode);
